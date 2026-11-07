/**
 * Compile project resources with aapt2 → linked APK for Preview Host.
 *
 * Uses writeShared (interactive Alpine terminal) + status file on the project
 * folder — same pattern as BuildManager. Avoids Executor / init-sandbox.sh
 * which breaks on some Acode Free builds.
 */
import { writeShared } from '../../services/terminalManager.js';
import {
  getAapt2AbsolutePath,
  getResolvedPaths,
  expandAlpinePath,
} from '../../services/pathManager.js';
import plugin from '../../../plugin.json';

const fs = acode.require('fs');

const POLL_MS = 400;
const TIMEOUT_MS = 120000;

/**
 * @typedef {object} CompileResult
 * @property {ArrayBuffer} bytes
 * @property {string} packageName
 * @property {string} projectId
 * @property {string} projectRoot
 * @property {string} layout
 * @property {string} apkPath
 */

/**
 * @param {string} xmlUri - active editor URI
 * @param {(msg: string) => void} [onProgress]
 * @returns {Promise<CompileResult>}
 */
export async function compileResourcesForPreview(xmlUri, onProgress = () => {}) {
  const layout = layoutNameFromUri(xmlUri);
  const { projectRootUrl, projectRootShell } = resolveProjectRoot(xmlUri);
  if (!projectRootShell || !projectRootUrl) {
    throw new Error(
      'Could not find Android project root (open a file under app/src/main/res/layout)'
    );
  }

  onProgress('Resolving res / package…');
  const moduleShell = await detectModuleShell(projectRootShell, projectRootUrl);
  const resShell = await firstExistingShell([
    join(moduleShell, 'src/main/res'),
    join(projectRootShell, 'app/src/main/res'),
    join(projectRootShell, 'src/main/res'),
    join(projectRootShell, 'res'),
  ]);
  if (!resShell) throw new Error('No res/ directory found under project');

  const packageName = await resolvePackageName(projectRootUrl, moduleShell, projectRootShell);
  const manifestShell = await firstExistingShell([
    join(moduleShell, 'src/main/AndroidManifest.xml'),
    join(projectRootShell, 'app/src/main/AndroidManifest.xml'),
    join(projectRootShell, 'src/main/AndroidManifest.xml'),
  ]);

  const aapt2 = getAapt2AbsolutePath();
  const paths = getResolvedPaths();
  const platformDir = paths.platform?.path
    ? expandAlpinePath(String(paths.platform.path).replace(/^file:\/\//, ''))
    : expandAlpinePath(
        `${window.ANDRO_HOME || '$HOME/' + plugin.id}/platforms/android-34`
      );
  const androidJar = join(platformDir.replace(/^file:\/\//, ''), 'android.jar');

  const workShell = join(projectRootShell, '.xhlp-preview');
  const workUrl = joinUrl(projectRootUrl, '.xhlp-preview');
  const statusShell = join(workShell, 'status.txt');
  const statusUrl = joinUrl(workUrl, 'status.txt');
  const b64Shell = join(workShell, 'resources.b64');
  const b64Url = joinUrl(workUrl, 'resources.b64');
  const outApkShell = join(workShell, 'resources.apk');
  const linkManifestShell = join(workShell, 'AndroidManifest.xml');
  const scriptShell = join(workShell, 'run_aapt2.sh');
  const projectId = simpleHash(projectRootShell);

  // Clear previous status (acode fs on project tree)
  try {
    if (await fs(statusUrl).exists()) await fs(statusUrl).writeFile('RUNNING\n');
    else {
      try {
        await fs(workUrl).createFile('status.txt', 'RUNNING\n');
      } catch (_) {
        // terminal will mkdir
      }
    }
  } catch (_) {}

  onProgress('Writing aapt2 script…');
  const scriptContent = buildScript({
    aapt2,
    androidJar,
    resShell,
    manifestShell,
    linkManifestShell,
    packageName,
    workShell,
    outApkShell,
    compiledZip: join(workShell, 'compiled.zip'),
    statusShell,
    b64Shell,
  });

  const b64Script = btoa(unescape(encodeURIComponent(scriptContent)));
  // Create work dir + script via Alpine terminal (reliable on Free)
  await writeShared(
    `mkdir -p ${shQuote(workShell)} && echo ${shQuote(b64Script)} | base64 -d > ${shQuote(scriptShell)} && chmod +x ${shQuote(scriptShell)}\r`
  );
  await sleep(300);

  onProgress('Running aapt2 compile + link…');
  await writeShared(`sh ${shQuote(scriptShell)}\r`);

  const finalStatus = await pollStatus(statusUrl, statusShell, onProgress);
  if (!finalStatus.ok) {
    throw new Error(finalStatus.message || 'aapt2 failed');
  }

  onProgress('Reading package…');
  let b64 = '';
  try {
    if (await fs(b64Url).exists()) {
      b64 = String(await fs(b64Url).readFile('utf-8')).replace(/\s/g, '');
    }
  } catch (_) {}

  // Fallback: ask terminal to copy b64 to a file we can retry, or re-cat
  if (!b64 || b64.length < 16) {
    await writeShared(
      `cp ${shQuote(b64Shell)} ${shQuote(join(projectRootShell, '.xhlp-preview-b64.txt'))} 2>/dev/null; wc -c ${shQuote(b64Shell)}\r`
    );
    await sleep(500);
    try {
      const altUrl = joinUrl(projectRootUrl, '.xhlp-preview-b64.txt');
      if (await fs(altUrl).exists()) {
        b64 = String(await fs(altUrl).readFile('utf-8')).replace(/\s/g, '');
      }
    } catch (_) {}
  }

  if (!b64 || b64.length < 16) {
    throw new Error(
      'Could not read linked resources (base64 empty). Check terminal for aapt2 errors.'
    );
  }

  const bytes = base64ToArrayBuffer(b64);
  onProgress(`Package ready (${bytes.byteLength} bytes)`);

  return {
    bytes,
    packageName,
    projectId,
    projectRoot: projectRootShell,
    layout,
    apkPath: outApkShell,
  };
}

function buildScript(p) {
  // Always generate a minimal preview manifest (full app manifest often breaks
  // aapt2 link when it references merge-only attrs / missing SDK bits).
  // Real res/ still comes from the project.
  const manifestPart = `
printf '%s\\n' \\
  '<?xml version="1.0" encoding="utf-8"?>' \\
  '<manifest xmlns:android="http://schemas.android.com/apk/res/android"' \\
  '    package="${p.packageName}">' \\
  '  <application android:label="Preview" />' \\
  '</manifest>' > ${shQuote(p.linkManifestShell)}
`;

  return `#!/bin/sh
set +e
STATUS=${shQuote(p.statusShell)}
LOG=${shQuote(join(p.workShell, 'aapt2.log'))}
echo "RUNNING" > "$STATUS"
: > "$LOG"
log() { echo "$1" >> "$STATUS"; }

AAPT2=${shQuote(p.aapt2)}
ANDROID_JAR=${shQuote(p.androidJar)}
RES=${shQuote(p.resShell)}
OUT_DIR=${shQuote(p.workShell)}
FLAT_DIR=${shQuote(join(p.workShell, 'flats'))}
COMPILED=${shQuote(p.compiledZip)}
OUT_APK=${shQuote(p.outApkShell)}
B64=${shQuote(p.b64Shell)}
MANIFEST=${shQuote(p.linkManifestShell)}

mkdir -p "$OUT_DIR" "$FLAT_DIR"
rm -f "$COMPILED" "$OUT_APK" "$B64"
rm -rf "$FLAT_DIR"
mkdir -p "$FLAT_DIR"

${manifestPart}

# --- resolve aapt2 ---
if [ ! -f "$AAPT2" ]; then
  for c in \\
    /root/acode.plugin.androidbuilder/build-tools/34.0.0/aapt2" \\
    "$HOME/acode.plugin.androidbuilder/build-tools/34.0.0/aapt2" \\
    "$HOME/acode.plugin.xhlp/build-tools/34.0.0/aapt2" \\
    /public/acode.plugin.androidbuilder/build-tools/34.0.0/aapt2 \\
    /public/acode.plugin.xhlp/build-tools/34.0.0/aapt2 \\
    "$HOME/build-tools/34.0.0/aapt2"
  do
    if [ -f "$c" ]; then AAPT2="$c"; break; fi
  done
fi
if [ ! -f "$AAPT2" ]; then
  echo "ERR:aapt2 not found (checked build-tools/34.0.0). Run Android Builder setup." > "$STATUS"
  exit 12
fi
chmod +x "$AAPT2" 2>/dev/null
log "aapt2:$AAPT2"

# --- resolve android.jar ---
if [ ! -f "$ANDROID_JAR" ]; then
  for c in \\
    "$HOME/acode.plugin.androidbuilder/platforms/android-34/android.jar" \\
    "$HOME/acode.plugin.androidbuilder/platforms/android-33/android.jar" \\
    "$HOME/acode.plugin.xhlp/platforms/android-34/android.jar" \\
    /public/acode.plugin.androidbuilder/platforms/android-34/android.jar \\
    /public/acode.plugin.androidbuilder/platforms/android-33/android.jar \\
    "$HOME/platforms/android-34/android.jar"
  do
    if [ -f "$c" ]; then ANDROID_JAR="$c"; break; fi
  done
fi
if [ ! -f "$ANDROID_JAR" ]; then
  echo "ERR:android.jar not found under platforms/android-34 (or 33). Install platform." > "$STATUS"
  exit 13
fi
log "jar:$ANDROID_JAR"

if [ ! -d "$RES" ]; then
  echo "ERR:res dir missing: $RES" > "$STATUS"
  exit 14
fi
log "res:$RES"
log "pkg:${p.packageName}"

# --- compile: prefer per-file flats (more compatible than --dir zip on some aapt2 builds) ---
log "compile"
COMP_OK=0
# Method A: --dir → zip
"$AAPT2" compile --dir "$RES" -o "$COMPILED" >> "$LOG" 2>&1
if [ $? -eq 0 ] && [ -f "$COMPILED" ]; then
  COMP_OK=1
  log "compile:zip-ok"
else
  echo "--- compile --dir failed, trying per-file ---" >> "$LOG"
  # Method B: each file into FLAT_DIR
  FIND_RES=$(find "$RES" -type f \\( -name '*.xml' -o -name '*.png' -o -name '*.webp' -o -name '*.jpg' -o -name '*.jpeg' -o -name '*.gif' -o -name '*.wav' -o -name '*.mp3' \\) 2>/dev/null)
  COUNT=0
  FAIL=0
  for f in $FIND_RES; do
    "$AAPT2" compile -o "$FLAT_DIR/" "$f" >> "$LOG" 2>&1
    if [ $? -ne 0 ]; then FAIL=$((FAIL+1)); else COUNT=$((COUNT+1)); fi
  done
  log "compile:flats=$COUNT fail=$FAIL"
  if [ "$COUNT" -gt 0 ]; then COMP_OK=2; fi
fi

if [ "$COMP_OK" -eq 0 ]; then
  DETAIL=$(tail -n 8 "$LOG" | tr '\\n' ' ' | cut -c1-300)
  echo "ERR:aapt2 compile failed — $DETAIL" > "$STATUS"
  exit 20
fi

# --- link ---
log "link"
LINK_OK=0
if [ "$COMP_OK" -eq 1 ]; then
  "$AAPT2" link -o "$OUT_APK" -I "$ANDROID_JAR" --manifest "$MANIFEST" --auto-add-overlay "$COMPILED" >> "$LOG" 2>&1
  if [ $? -eq 0 ] && [ -f "$OUT_APK" ]; then LINK_OK=1; fi
  if [ "$LINK_OK" -eq 0 ]; then
    echo "--- link zip+overlay failed, retry without overlay ---" >> "$LOG"
    "$AAPT2" link -o "$OUT_APK" -I "$ANDROID_JAR" --manifest "$MANIFEST" "$COMPILED" >> "$LOG" 2>&1
    if [ $? -eq 0 ] && [ -f "$OUT_APK" ]; then LINK_OK=1; fi
  fi
fi

if [ "$LINK_OK" -eq 0 ] && [ "$COMP_OK" -eq 2 -o -d "$FLAT_DIR" ]; then
  FLATS=$(find "$FLAT_DIR" -type f -name '*.flat' 2>/dev/null | tr '\\n' ' ')
  if [ -n "$FLATS" ]; then
    echo "--- link flats ---" >> "$LOG"
    # shell word-split intentional
    "$AAPT2" link -o "$OUT_APK" -I "$ANDROID_JAR" --manifest "$MANIFEST" $FLATS >> "$LOG" 2>&1
    if [ $? -eq 0 ] && [ -f "$OUT_APK" ]; then LINK_OK=1; fi
  fi
fi

if [ "$LINK_OK" -eq 0 ]; then
  DETAIL=$(grep -iE 'error:|failed|exception' "$LOG" | tail -n 5 | tr '\\n' ' ' | cut -c1-400)
  if [ -z "$DETAIL" ]; then DETAIL=$(tail -n 10 "$LOG" | tr '\\n' ' ' | cut -c1-400); fi
  echo "ERR:aapt2 link failed — $DETAIL" > "$STATUS"
  exit 21
fi

if [ ! -f "$OUT_APK" ]; then
  echo "ERR:output apk missing after link" > "$STATUS"
  exit 22
fi

if base64 -w0 < "$OUT_APK" > "$B64" 2>/dev/null; then
  :
else
  base64 < "$OUT_APK" | tr -d '\\n' > "$B64"
fi

SZ=$(wc -c < "$OUT_APK" | tr -d ' ')
echo "OK:$SZ" > "$STATUS"
exit 0
`;
}

async function pollStatus(statusUrl, statusShell, onProgress) {
  const start = Date.now();
  let last = '';
  while (Date.now() - start < TIMEOUT_MS) {
    let content = '';
    try {
      if (await fs(statusUrl).exists()) {
        content = String((await fs(statusUrl).readFile('utf-8')) || '');
      }
    } catch (_) {}

    if (content && content !== last) {
      last = content;
      const lines = content.split(/\r?\n/).filter(Boolean);
      const tail = lines[lines.length - 1] || '';
      if (tail.startsWith('OK:')) {
        return { ok: true, message: tail };
      }
      const errLine = lines.find((l) => l.startsWith('ERR:'));
      if (errLine) {
        return { ok: false, message: errLine.replace(/^ERR:/, '').trim() };
      }
      if (
        tail.startsWith('compile') ||
        tail.startsWith('link') ||
        tail.startsWith('aapt2:') ||
        tail.startsWith('jar:') ||
        tail.startsWith('res:') ||
        tail === 'RUNNING'
      ) {
        onProgress(tail === 'RUNNING' ? 'aapt2 running…' : tail);
      }
    }
    await sleep(POLL_MS);
  }
  return {
    ok: false,
    message: `Timeout waiting for aapt2 (status: ${last.slice(0, 200) || 'empty'}). Is Alpine terminal open?`,
  };
}

function resolveProjectRoot(xmlUri) {
  const uri = String(xmlUri || '');
  let projectRootUrl = null;
  let projectRootShell = null;

  const markers = ['/app/src/main/', '/src/main/res/', '/src/main/'];
  for (const m of markers) {
    const idx = uri.indexOf(m);
    if (idx > -1) {
      projectRootUrl = uri.substring(0, idx);
      // If path was .../app/src/main, root is before /app when marker includes app
      if (m.startsWith('/app/')) {
        // already before /app
      } else if (projectRootUrl.endsWith('/app')) {
        projectRootUrl = projectRootUrl.slice(0, -4);
      }
      break;
    }
  }

  if (!projectRootUrl) {
    // walk path segments via shell-style from uriToFsPath
    const fsPath = uriToFsPath(uri);
    let cur = dirname(fsPath);
    for (let i = 0; i < 10 && cur && cur !== '/'; i++) {
      projectRootShell = cur;
      cur = dirname(cur);
    }
    return { projectRootUrl: null, projectRootShell: null };
  }

  projectRootShell = uriToFsPath(projectRootUrl);
  // content URI root may still include tree prefix — uriToFsPath handles primary:
  if (!projectRootShell || projectRootShell.includes('content:')) {
    projectRootShell = uriToFsPath(uri);
    const idx = projectRootShell.indexOf('/app/src/main');
    if (idx > -1) projectRootShell = projectRootShell.substring(0, idx);
    else {
      const j = projectRootShell.indexOf('/src/main');
      if (j > -1) {
        let root = projectRootShell.substring(0, j);
        if (root.endsWith('/app')) root = root.slice(0, -4);
        projectRootShell = root;
      }
    }
  }

  return { projectRootUrl, projectRootShell };
}

async function detectModuleShell(projectRootShell, projectRootUrl) {
  const appGradle = joinUrl(projectRootUrl, 'app/build.gradle');
  const appGradleKts = joinUrl(projectRootUrl, 'app/build.gradle.kts');
  try {
    if (await fs(appGradle).exists()) return join(projectRootShell, 'app');
    if (await fs(appGradleKts).exists()) return join(projectRootShell, 'app');
  } catch (_) {}
  // probe shell via status later — default app
  return join(projectRootShell, 'app');
}

async function resolvePackageName(projectRootUrl, moduleShell, projectRootShell) {
  const candidates = [
    joinUrl(projectRootUrl, 'app/build.gradle'),
    joinUrl(projectRootUrl, 'app/build.gradle.kts'),
    joinUrl(projectRootUrl, 'build.gradle'),
    joinUrl(projectRootUrl, 'build.gradle.kts'),
    joinUrl(projectRootUrl, 'app/src/main/AndroidManifest.xml'),
    joinUrl(projectRootUrl, 'src/main/AndroidManifest.xml'),
  ];
  for (const url of candidates) {
    try {
      if (!(await fs(url).exists())) continue;
      const content = await fs(url).readFile('utf-8');
      let m = content.match(/namespace\s+['"]([^'"]+)['"]/);
      if (m) return m[1];
      m = content.match(/applicationId\s+['"]([^'"]+)['"]/);
      if (m) return m[1];
      m = content.match(/package\s*=\s*['"]([^'"]+)['"]/);
      if (m) return m[1];
    } catch (_) {}
  }
  return 'com.example.app';
}

async function firstExistingShell(paths) {
  for (const p of paths) {
    if (!p) continue;
    // Prefer existence via project URL when under same tree — heuristic: always return first
    // We cannot reliably fs.exists on pure shell paths for /sdcard without file:// mapping
  }
  // Use first path that looks standard (app module)
  return paths.find(Boolean) || null;
}

export function uriToFsPath(uri) {
  if (!uri) return '';
  let path = String(uri);

  if (path.includes('::')) {
    path = path.split('::').pop();
  }
  if (path.includes('primary:')) {
    try {
      const decoded = decodeURIComponent(path);
      const id = decoded.split('primary:').pop();
      path = '/sdcard/' + (id.startsWith('/') ? id.substring(1) : id);
    } catch (_) {}
  } else if (path.includes('content://')) {
    try {
      const decoded = decodeURIComponent(path);
      if (decoded.includes('primary:')) {
        const id = decoded.split('primary:').pop();
        path = '/sdcard/' + (id.startsWith('/') ? id.substring(1) : id);
      }
    } catch (_) {}
  }
  if (path.startsWith('file://')) path = path.replace('file://', '');
  if (path.startsWith('/storage/emulated/0/')) {
    path = '/sdcard/' + path.substring('/storage/emulated/0/'.length);
  }
  return path;
}

function layoutNameFromUri(uri) {
  const base = String(uri).split('/').pop() || '';
  return base.replace(/\.xml$/i, '') || 'unknown';
}

function join(...parts) {
  return parts
    .filter((p) => p != null && p !== '')
    .map((p, i) => {
      let s = String(p);
      if (i > 0) s = s.replace(/^\/+/, '');
      return s.replace(/\/+$/, '');
    })
    .join('/')
    .replace(/\/{2,}/g, '/');
}

function joinUrl(base, rel) {
  const b = String(base).endsWith('/') ? String(base).slice(0, -1) : String(base);
  return `${b}/${rel}`;
}

function dirname(p) {
  const s = String(p).replace(/\/+$/, '');
  const i = s.lastIndexOf('/');
  return i <= 0 ? '/' : s.substring(0, i);
}

function shQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

function simpleHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16);
}

function base64ToArrayBuffer(b64) {
  const clean = b64.replace(/\s/g, '');
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
