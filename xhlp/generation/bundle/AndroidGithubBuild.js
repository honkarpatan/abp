/**
 * GitHub Actions Android build — same variant/format options as terminal build.
 * Writes/uses workflow, dispatches, downloads artifact into app/build/outputs/...
 */
import { getSettings } from '../../services/settings.js';
import { BuildUI } from './buildUI.js';
import {
  ensureProjectGithubConfig,
  writeProjectGithubConfig,
  projectLeafName,
  sanitizeRepoName,
  randomRepoSuffix,
  makeProjectId,
} from './projectGithubConfig.js';

const fs = acode.require('fs');

const DEFAULT_WF_PATH = '.github/workflows/xhlp-android-build.yml';

function ghHeaders(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function gh(token, path, opts = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: { ...ghHeaders(token), ...(opts.headers || {}) },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (_) {
    body = text;
  }
  if (!res.ok) {
    const msg = (body && body.message) || text || res.statusText;
    throw new Error(`GitHub ${res.status}: ${msg}`);
  }
  return body;
}

/** Read minSdk / targetSdk / compileSdk hints from app gradle */
export async function readAndroidBuildHints(projectRootUrl) {
  const hints = {
    compileSdk: '34',
    minSdk: '24',
    targetSdk: '34',
    versionCode: '1',
    versionName: '1.0',
    javaVersion: '17',
    _gradleRel: null,
  };
  try {
    const root = String(projectRootUrl || '').replace(/\/+$/, '');
    for (const rel of ['app/build.gradle', 'app/build.gradle.kts', 'build.gradle', 'build.gradle.kts']) {
      const url = root + '/' + rel;
      try {
        if (!(await fs(url).exists())) continue;
        const text = String(await fs(url).readFile('utf-8'));
        const c = text.match(/compileSdk(?:Version)?\s*[=:]?\s*(\d+)/);
        const mn = text.match(/minSdk(?:Version)?\s*[=:]?\s*(\d+)/);
        const tg = text.match(/targetSdk(?:Version)?\s*[=:]?\s*(\d+)/);
        const vc = text.match(/versionCode\s*[=:]?\s*(\d+)/);
        const vn = text.match(/versionName\s*[=:]?\s*['"]([^'"]+)['"]/);
        if (c) hints.compileSdk = c[1];
        if (mn) hints.minSdk = mn[1];
        if (tg) hints.targetSdk = tg[1];
        if (vc) hints.versionCode = vc[1];
        if (vn) hints.versionName = vn[1];
        if (/JavaVersion\.VERSION_11|jvmTarget\s*=\s*['"]11['"]/.test(text)) hints.javaVersion = '11';
        if (/JavaVersion\.VERSION_17|jvmTarget\s*=\s*['"]17['"]/.test(text)) hints.javaVersion = '17';
        if (/JavaVersion\.VERSION_21|jvmTarget\s*=\s*['"]21['"]/.test(text)) hints.javaVersion = '21';
        hints._gradleRel = rel;
        hints._gradleUrl = url;
        break;
      } catch (_) {}
    }
  } catch (_) {}
  return hints;
}

/** Write SDK / version fields back into the module build.gradle(.kts) */
export async function applyAndroidBuildHints(projectRootUrl, hints) {
  if (!hints) return false;
  const root = String(projectRootUrl || '').replace(/\/+$/, '');
  let url = hints._gradleUrl;
  let rel = hints._gradleRel;
  if (!url) {
    for (const r of ['app/build.gradle', 'app/build.gradle.kts', 'build.gradle', 'build.gradle.kts']) {
      const u = root + '/' + r;
      try {
        if (await fs(u).exists()) {
          url = u;
          rel = r;
          break;
        }
      } catch (_) {}
    }
  }
  if (!url) return false;
  let text = String(await fs(url).readFile('utf-8'));
  const isKts = /\.kts$/i.test(rel || url);
  const replNum = (key, val) => {
    if (val == null || val === '') return;
    const re = new RegExp(key + '\\s*[=:]?\\s*\\d+');
    if (re.test(text)) {
      text = text.replace(re, key + (isKts ? ' = ' : ' ') + String(val));
    }
  };
  const replStr = (key, val) => {
    if (val == null || val === '') return;
    const re = new RegExp(key + "\\s*[=:]?\\s*['\"][^'\"]*['\"]");
    if (re.test(text)) {
      text = text.replace(re, key + (isKts ? ' = "' : ' "') + String(val) + (isKts ? '"' : '"'));
    }
  };
  replNum('compileSdk', hints.compileSdk);
  replNum('compileSdkVersion', hints.compileSdk);
  replNum('minSdk', hints.minSdk);
  replNum('minSdkVersion', hints.minSdk);
  replNum('targetSdk', hints.targetSdk);
  replNum('targetSdkVersion', hints.targetSdk);
  replNum('versionCode', hints.versionCode);
  replStr('versionName', hints.versionName);

  // Java / Kotlin JVM target (11 | 17 | 21)
  const jv = String(hints.javaVersion || '').trim();
  if (jv && /^(8|11|17|21)$/.test(jv)) {
    const verToken = jv === '8' ? 'VERSION_1_8' : 'VERSION_' + jv;
    text = text.replace(/JavaVersion\.VERSION_(?:1_)?\d+/g, 'JavaVersion.' + verToken);
    text = text.replace(/jvmTarget\s*=\s*['"][\d.]+['"]/g, "jvmTarget = '" + jv + "'");
    // sourceCompatibility / targetCompatibility string form
    text = text.replace(
      /sourceCompatibility\s*=\s*JavaVersion\.[A-Z0-9_]+/g,
      'sourceCompatibility = JavaVersion.' + verToken
    );
    text = text.replace(
      /targetCompatibility\s*=\s*JavaVersion\.[A-Z0-9_]+/g,
      'targetCompatibility = JavaVersion.' + verToken
    );
  }

  await fs(url).writeFile(text);
  return true;
}

/**
 * Auto workflow: variant + format as workflow_dispatch inputs (matches Build Settings UI).
 */

/** Read viewBinding / multiDex / minify / applicationId from app gradle */
export async function readAndroidFeatureHints(projectRootUrl) {
  const feats = {
    applicationId: '',
    namespace: '',
    viewBinding: false,
    dataBinding: false,
    multiDexEnabled: false,
    minifyEnabled: false,
    _gradleUrl: null,
    _gradleRel: null,
  };
  try {
    const root = String(projectRootUrl || '').replace(/\/+$/, '');
    for (const rel of ['app/build.gradle', 'app/build.gradle.kts']) {
      const url = root + '/' + rel;
      try {
        if (!(await fs(url).exists())) continue;
        const text = String(await fs(url).readFile('utf-8'));
        const appId = text.match(/applicationId\s*[=:]?\s*['"]([^'"]+)['"]/);
        const ns = text.match(/namespace\s*[=:]?\s*['"]([^'"]+)['"]/);
        if (appId) feats.applicationId = appId[1];
        if (ns) feats.namespace = ns[1];
        feats.viewBinding = /viewBinding\s*[=:]?\s*true/.test(text);
        feats.dataBinding = /dataBinding\s*[=:]?\s*true/.test(text);
        feats.multiDexEnabled = /multiDexEnabled\s*[=:]?\s*true/.test(text);
        // release minify
        const relBlock = text.match(/buildTypes\s*\{[\s\S]*?release\s*\{([\s\S]*?)\}/);
        if (relBlock && /minifyEnabled\s*[=:]?\s*true/.test(relBlock[1])) {
          feats.minifyEnabled = true;
        }
        feats._gradleUrl = url;
        feats._gradleRel = rel;
        break;
      } catch (_) {}
    }
  } catch (_) {}
  return feats;
}

/** Write feature toggles into app/build.gradle(.kts) */
export async function applyAndroidFeatureHints(projectRootUrl, feats) {
  if (!feats) return false;
  const root = String(projectRootUrl || '').replace(/\/+$/, '');
  let url = feats._gradleUrl;
  let rel = feats._gradleRel;
  if (!url) {
    for (const r of ['app/build.gradle', 'app/build.gradle.kts']) {
      const u = root + '/' + r;
      try {
        if (await fs(u).exists()) {
          url = u;
          rel = r;
          break;
        }
      } catch (_) {}
    }
  }
  if (!url) return false;
  let text = String(await fs(url).readFile('utf-8'));
  const isKts = /\.kts$/i.test(rel || url);
  const eq = isKts ? ' = ' : ' ';
  const q = (s) => (isKts ? `"${s}"` : `'${s}'`);

  if (feats.applicationId) {
    if (/applicationId\s*[=:]?\s*['"][^'"]*['"]/.test(text)) {
      text = text.replace(
        /applicationId\s*[=:]?\s*['"][^'"]*['"]/,
        `applicationId${eq}${q(feats.applicationId)}`
      );
    }
  }
  if (feats.namespace) {
    if (/namespace\s*[=:]?\s*['"][^'"]*['"]/.test(text)) {
      text = text.replace(
        /namespace\s*[=:]?\s*['"][^'"]*['"]/,
        `namespace${eq}${q(feats.namespace)}`
      );
    }
  }

  const setBoolInDefaultConfig = (key, on) => {
    const val = on ? 'true' : 'false';
    const re = new RegExp(key + '\\s*[=:]?\\s*(true|false)');
    if (re.test(text)) {
      text = text.replace(re, key + eq + val);
      return;
    }
    if (on && /defaultConfig\s*\{/.test(text)) {
      text = text.replace(
        /defaultConfig\s*\{/,
        `defaultConfig {\n        ${key}${eq}${val}`
      );
    }
  };
  setBoolInDefaultConfig('multiDexEnabled', !!feats.multiDexEnabled);

  // buildFeatures { viewBinding / dataBinding }
  const vb = !!feats.viewBinding;
  const db = !!feats.dataBinding;
  if (/buildFeatures\s*\{/.test(text)) {
    if (/viewBinding\s*[=:]?\s*(true|false)/.test(text)) {
      text = text.replace(/viewBinding\s*[=:]?\s*(true|false)/, `viewBinding${eq}${vb}`);
    } else {
      text = text.replace(/buildFeatures\s*\{/, `buildFeatures {\n        viewBinding${eq}${vb}`);
    }
    if (/dataBinding\s*[=:]?\s*(true|false)/.test(text)) {
      text = text.replace(/dataBinding\s*[=:]?\s*(true|false)/, `dataBinding${eq}${db}`);
    } else if (db || vb) {
      text = text.replace(/buildFeatures\s*\{/, `buildFeatures {\n        dataBinding${eq}${db}`);
    }
  } else if (vb || db) {
    // insert inside android { }
    text = text.replace(
      /android\s*\{/,
      `android {\n    buildFeatures {\n        viewBinding${eq}${vb}\n        dataBinding${eq}${db}\n    }`
    );
  }

  // release minifyEnabled
  const minOn = !!feats.minifyEnabled;
  if (/minifyEnabled\s*[=:]?\s*(true|false)/.test(text)) {
    // only first in release block ideally — replace all release minify
    text = text.replace(
      /(release\s*\{[\s\S]*?)minifyEnabled\s*[=:]?\s*(true|false)/,
      `$1minifyEnabled${eq}${minOn}`
    );
  } else if (minOn && /release\s*\{/.test(text)) {
    text = text.replace(
      /release\s*\{/,
      `release {\n            minifyEnabled${eq}true`
    );
  }

  await fs(url).writeFile(text);
  return true;
}

export function generateAndroidWorkflowYml(hints = {}) {
  const compileSdk = hints.compileSdk || '34';
  const javaVersion = hints.javaVersion || '17';
  // Use string concat so GitHub ${{ }} is not eaten by JS template literals
  const ghVar = "${{ github.event.inputs.variant || 'debug' }}";
  const ghFmt = "${{ github.event.inputs.format || 'apk' }}";
  return (
    'name: XHLP Android Build\n' +
    '\n' +
    'on:\n' +
    '  workflow_dispatch:\n' +
    '    inputs:\n' +
    '      variant:\n' +
    "        description: debug or release\n" +
    '        required: false\n' +
    '        default: debug\n' +
    '      format:\n' +
    '        description: apk or aab\n' +
    '        required: false\n' +
    '        default: apk\n' +
    '\n' +
    'jobs:\n' +
    '  build:\n' +
    '    runs-on: ubuntu-latest\n' +
    '    steps:\n' +
    '      - uses: actions/checkout@v4\n' +
    '\n' +
    '      - uses: actions/setup-java@v4\n' +
    '        with:\n' +
    '          distribution: temurin\n' +
    "          java-version: '" + javaVersion + "'\n" +
    '\n' +
    '      # Avoid android-actions/setup-android (installs obsolete package "tools")\n' +
    '      - name: Configure Android SDK (runner preinstall)\n' +
    '        shell: bash\n' +
    '        run: |\n' +
    '          set -e\n' +
    '          export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/usr/local/lib/android/sdk}}"\n' +
    '          export ANDROID_SDK_ROOT="$ANDROID_HOME"\n' +
    '          echo "ANDROID_HOME=$ANDROID_HOME"\n' +
    '          echo "ANDROID_HOME=$ANDROID_HOME" >> "$GITHUB_ENV"\n' +
    '          echo "ANDROID_SDK_ROOT=$ANDROID_SDK_ROOT" >> "$GITHUB_ENV"\n' +
    '          # Locate sdkmanager from cmdline-tools (not obsolete tools/)\n' +
    '          SM=$(find "$ANDROID_HOME/cmdline-tools" -type f -name sdkmanager 2>/dev/null | sort | tail -1 || true)\n' +
    '          if [ -z "$SM" ] && [ -x "$ANDROID_HOME/tools/bin/sdkmanager" ]; then SM="$ANDROID_HOME/tools/bin/sdkmanager"; fi\n' +
    '          if [ -z "$SM" ]; then\n' +
    '            echo "sdkmanager not found; installing cmdline-tools..."\n' +
    '            mkdir -p "$ANDROID_HOME/cmdline-tools"\n' +
    '            curl -fsSL -o /tmp/cmdtools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip\n' +
    '            unzip -q /tmp/cmdtools.zip -d "$ANDROID_HOME/cmdline-tools"\n' +
    '            mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest" || true\n' +
    '            SM="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"\n' +
    '          fi\n' +
    '          echo "Using sdkmanager: $SM"\n' +
    '          yes | "$SM" --sdk_root="$ANDROID_HOME" --licenses >/dev/null || true\n' +
    '          "$SM" --sdk_root="$ANDROID_HOME" "platform-tools" "platforms;android-' + compileSdk + '" "build-tools;34.0.0" || true\n' +
    '\n' +
    '      - name: Setup Gradle 8.7 (AGP 8.x compatible)\n' +
    '        uses: gradle/actions/setup-gradle@v4\n' +
    '        with:\n' +
    '          gradle-version: \'8.7\'\n' +
    '\n' +
    '      - name: Sanitize gradle.properties for CI\n' +
    '        run: |\n' +
    '          # Remove Termux/Acode-only aapt2 paths that break GitHub runners\n' +
    '          for f in gradle.properties */gradle.properties; do\n' +
    '            [ -f "$f" ] || continue\n' +
    '            sed -i \'/aapt2FromMavenOverride/d\' "$f" || true\n' +
    '            sed -i \'/\/public\//d\' "$f" || true\n' +
    '            sed -i \'/\/data\/data\//d\' "$f" || true\n' +
    '          done\n' +
    '\n' +
    '      - name: Grant gradlew\n' +
    '        run: |\n' +
    '          if [ -f gradlew ]; then chmod +x gradlew; fi\n' +
    '\n' +
    '      - name: Build\n' +
    '        env:\n' +
    '          VARIANT: ' + ghVar + '\n' +
    '          FORMAT: ' + ghFmt + '\n' +
    '        run: |\n' +
    '          set -e\n' +
    '          ROOT="."\n' +
    '          if [ ! -f settings.gradle ] && [ ! -f settings.gradle.kts ]; then\n' +
    '            FOUND=$(find . -maxdepth 3 \\( -name settings.gradle -o -name settings.gradle.kts \\) | head -1 || true)\n' +
    '            [ -n "$FOUND" ] && ROOT=$(dirname "$FOUND")\n' +
    '          fi\n' +
    '          cd "$ROOT"\n' +
    '          echo "Project root: $(pwd)"\n' +
    '          if [ -f gradlew ]; then GW="./gradlew"; else GW="gradle"; fi\n' +
    '          echo "Using $($GW --version | head -3 || true)"\n' +
    '          chmod +x gradlew 2>/dev/null || true\n' +
    '          TASK="assembleDebug"\n' +
    '          if [ "$FORMAT" = "aab" ]; then\n' +
    '            if [ "$VARIANT" = "release" ]; then TASK="bundleRelease"; else TASK="bundleDebug"; fi\n' +
    '          else\n' +
    '            if [ "$VARIANT" = "release" ]; then TASK="assembleRelease"; else TASK="assembleDebug"; fi\n' +
    '          fi\n' +
    '          echo "Running $GW $TASK"\n' +
    '          $GW $TASK --no-daemon --stacktrace\n' +
    '          mkdir -p app/build/outputs/xhlp-upload\n' +
    '          if [ "$FORMAT" = "aab" ]; then\n' +
    '            find app/build/outputs/bundle -type f -name "*.aab" -exec cp -v {} app/build/outputs/xhlp-upload/ \\; 2>/dev/null || true\n' +
    '          else\n' +
    '            find app/build/outputs/apk -type f -name "*.apk" -exec cp -v {} app/build/outputs/xhlp-upload/ \\; 2>/dev/null || true\n' +
    '          fi\n' +
    '          ls -lah app/build/outputs/xhlp-upload/ || true\n' +
    '          COUNT=$(find app/build/outputs/xhlp-upload -type f | wc -l)\n' +
    '          if [ "$COUNT" -lt 1 ]; then\n' +
    '            echo "ERROR: no APK/AAB produced"\n' +
    '            find app/build/outputs -type f -name "*.apk" -o -name "*.aab" || true\n' +
    '            exit 1\n' +
    '          fi\n' +
    '\n' +
    '      - uses: actions/upload-artifact@v4\n' +
    '        with:\n' +
    '          name: android-output\n' +
    '          path: app/build/outputs/xhlp-upload/\n' +
    '          if-no-files-found: error\n' +
    '          compression-level: 0\n' +
    '          retention-days: 14\n'
  );
}


function resolveProjectRootFromFile(currentFileUrl) {
  let appIndex = currentFileUrl.indexOf('/app/src/main/java');
  if (appIndex === -1) appIndex = currentFileUrl.indexOf('/src/main/java');
  if (appIndex === -1) appIndex = currentFileUrl.indexOf('/app/src/main/');
  if (appIndex === -1) {
    // fallback: strip to module
    const m = currentFileUrl.match(/^(.*\/app)\//);
    if (m) return m[1].replace(/\/app$/, '');
    return null;
  }
  return currentFileUrl.substring(0, appIndex);
}

export class AndroidGithubBuildManager {
  constructor() {
    this.ui = new BuildUI();
    this._stop = false;
  }

  _log(msg) {
    try {
      if (this.ui && typeof this.ui.appendLog === 'function') {
        this.ui.appendLog(msg);
      } else if (this.ui && typeof this.ui.updateProgress === 'function') {
        this.ui.updateProgress(null, String(msg).split('\n')[0], msg, 'gradle');
      } else {
        console.log('[GitHubBuild]', msg);
      }
    } catch (e) {
      console.log('[GitHubBuild]', msg);
    }
  }

  async startBuild(currentFileUrl, options = { variant: 'debug', format: 'apk' }) {
    const s = getSettings();
    const token = (s.androidGithubToken || '').trim();
    if (!token) {
      window.toast('Set GitHub token in plugin settings (Android build)', 4000);
      return;
    }
    const projectRootUrl = resolveProjectRootFromFile(currentFileUrl);
    if (!projectRootUrl) {
      window.toast('Open a file under app/src/… first', 3000);
      return;
    }

    this._stop = false;
    this._activeRunId = null;
    this._activeRepo = null;
    this.ui.show(async () => {
      this._stop = true;
      window.toast('Stopping GitHub Actions…', 2000);
      try {
        await this._cancelGithubRun();
      } catch (e) {
        this._log(`Cancel note: ${e.message || e}\n`);
      }
      window.toast('GitHub build cancelled', 2500);
    });
    this.ui.setState?.('gradle');
    try { this.ui.updateProgress?.(8, 'Starting GitHub build…', null, 'gradle'); } catch (_) {}
    this._log('GitHub Android build…\n');

    try {
      // Per-project repo (.xhlp-github.json) — not global "last used" repo
      let projCfg =
        options.projectGithub ||
        (await ensureProjectGithubConfig(projectRootUrl));
      let repo = (projCfg.repo || '').trim();
      const forceNew = !!options.forceNewRepo;

      const me = await gh(token, '/user');
      const owner = me.login;
      let leaf = sanitizeRepoName(projectLeafName(projectRootUrl));

      if (forceNew) {
        leaf = leaf + '-' + randomRepoSuffix();
        repo = `${owner}/${leaf}`;
        this._log(`Force new repo → ${repo}\n`);
      } else if (!repo) {
        repo = `${owner}/${leaf}`;
        this._log(`Blank project repo → auto ${repo}\n`);
      } else if (!repo.includes('/')) {
        repo = `${owner}/${sanitizeRepoName(repo)}`;
      }

      projCfg = {
        ...projCfg,
        repo,
        projectId: projCfg.projectId || makeProjectId(),
      };
      await writeProjectGithubConfig(projectRootUrl, projCfg);
      const name = repo.split('/')[1] || sanitizeRepoName(projectLeafName(projectRootUrl));
      const branch =
        (projCfg.branch || s.androidGithubBranch || 'main').trim() || 'main';
      const useCustom = !!s.androidGithubUseCustomWorkflow;
      const autoCreate = s.androidGithubAutoCreateRepo !== false;
      const wfRel = (s.androidGithubWorkflowPath || DEFAULT_WF_PATH).replace(/^\//, '');

      await this._ensureRepo(token, owner, name, autoCreate);
      repo = `${owner}/${name}`;

      // Always full-sync local project → GitHub (replace/add/remove obsolete files)
      this._log('Syncing project to GitHub (full tree replace)…\n');
      await this._pushProjectToGithub(token, repo, branch, projectRootUrl);
      const hasGradle = typeof this._remoteHasGradle === 'function'
        ? await this._remoteHasGradle(token, repo, branch)
        : await AndroidGithubBuildManager.prototype._remoteHasGradle.call(this, token, repo, branch);
      if (!hasGradle) {
        throw new Error(
          `Could not sync project to ${repo}. Check token scopes (repo) and storage access.`
        );
      }
      this._log('Project synced to GitHub.\n');
      await new Promise((r) => setTimeout(r, 1500));

      const hints = await readAndroidBuildHints(projectRootUrl);
      try {
        const sj = (getSettings().androidSdkJava || '').trim();
        if (/^(8|11|17|21)$/.test(sj)) hints.javaVersion = sj;
      } catch (_) {}
      this._log(`Hints: compileSdk=${hints.compileSdk} minSdk=${hints.minSdk} java=${hints.javaVersion}\n`);
      try {
        this.ui.setBuildMeta?.({
          mode: 'github',
          repo,
          branch,
          projectId: projCfg.projectId,
          variant: options.variant || 'debug',
          format: options.format || 'apk',
          compileSdk: hints.compileSdk,
          minSdk: hints.minSdk,
          targetSdk: hints.targetSdk,
          versionName: hints.versionName,
          versionCode: hints.versionCode,
          javaVersion: hints.javaVersion,
        });
      } catch (_) {}

      if (!useCustom) {
        const yml = generateAndroidWorkflowYml(hints);
        await this._ensureLocalWorkflow(projectRootUrl, wfRel, yml);
        this._log(`Wrote local workflow: ${wfRel}\n`);
        await this._putWorkflowFile(token, repo, branch, wfRel, yml);
        this._log('Pushed workflow to GitHub\n');
      } else {
        this._log(`Using custom workflow: ${wfRel}\n`);
      }

      const wfId = await this._findWorkflowId(token, repo, wfRel);
      this._log(`Dispatch workflow id=${wfId}\n`);
      await gh(token, `/repos/${repo}/actions/workflows/${wfId}/dispatches`, {
        method: 'POST',
        body: JSON.stringify({
          ref: branch,
          inputs: {
            variant: options.variant || 'debug',
            format: options.format || 'apk',
          },
        }),
      });

      this._log('Waiting for run…\n');
      const run = await this._waitForRun(token, repo, wfId);
      if (!run) throw new Error('No workflow run found');
      this._log(`Run ${run.id} status=${run.status}\n`);
      this._activeRunId = run.id;
      this._activeRepo = repo;
      this._activeToken = token;
      try {
        this.ui.setBuildMeta?.({ runId: String(run.id), actionsUrl: `https://github.com/${repo}/actions/runs/${run.id}` });
      } catch (_) {}

      const finalRun = await this._pollRun(token, repo, run.id);
      await this._fetchAndShowRunLogs(token, repo, run.id);
      if (finalRun.conclusion !== 'success') {
        this._log(`\nBuild FAILED — full log: https://github.com/${repo}/actions/runs/${run.id}\n`);
        throw new Error(`Build ${finalRun.conclusion || finalRun.status}`);
      }

      this._log('Downloading artifact…\n');
      await this._downloadArtifactToOutputs(
        token,
        repo,
        run.id,
        projectRootUrl,
        options.variant || 'debug',
        options.format || 'apk'
      );

      this.ui.showResult?.(true, {
        message: 'GitHub build OK — saved under app/build/outputs',
      });
      this._log('Done. Check app/build/outputs/\n');
      window.toast('GitHub build complete', 3000);
    } catch (e) {
      console.error(e);
      this._log(`ERROR: ${e.message || e}\n`);
      this.ui.showResult?.(false, { message: String(e.message || e) });
      window.toast('GitHub build failed: ' + (e.message || e), 4000);
    }
  }


  /** Skip build outputs, caches, large binaries */
  _shouldSkipPath(rel) {
    const p = String(rel).replace(/\\/g, '/');
    const skip =
      /(^|\/)(build|\.gradle|\.idea|\.git|node_modules|\.cxx|captures|local\.properties)(\/|$)/i;
    if (skip.test(p)) return true;
    if (/\.(apk|aab|jar|aar|so|o|class|dex|bin|zip|rar|7z|png|jpg|jpeg|webp|gif|mp3|mp4|ttf|otf)$/i.test(p)) {
      // allow xml/svg under res; skip heavy media at root-ish — keep small icons under res/
      if (/\/res\//i.test(p) && /\.(png|webp|jpg|jpeg|xml)$/i.test(p)) return false;
      if (/\.(png|jpg|jpeg|webp|gif|mp3|mp4)$/i.test(p)) return true;
    }
    return false;
  }

  async _listProjectFiles(rootUrl, baseRel = '', out = [], depth = 0) {
    if (depth > 12 || out.length > 400) return out;
    const fsApi = acode.require('fs');
    let entries = [];
    try {
      entries = await fsApi(rootUrl).lsDir();
    } catch (e) {
      this._log(`list fail ${baseRel}: ${e.message}\\n`);
      return out;
    }
    for (const ent of entries || []) {
      const name = ent.name || (ent.url && ent.url.split('/').pop());
      if (!name || name === '.' || name === '..') continue;
      const rel = baseRel ? baseRel + '/' + name : name;
      if (this._shouldSkipPath(rel)) continue;
      const url = ent.url || (String(rootUrl).replace(/\/+$/, '') + '/' + name);
      const isDir = ent.isDirectory || ent.isFolder || (ent.type === 'folder');
      if (isDir) {
        await this._listProjectFiles(url, rel, out, depth + 1);
      } else {
        try {
          // Text + res icons (png/webp under res/)
          const isResIcon =
            /\/res\//i.test(rel) && /\.(png|webp|jpg|jpeg)$/i.test(name);
          const isText =
            /\.(java|kt|kts|xml|gradle|properties|pro|md|txt|json|yml|yaml|toml|gitignore|bat|sh|cmake|cpp|c|h|hpp|cc)$/i.test(name)
            || name === 'gradlew'
            || name === 'gradlew.bat'
            || name.endsWith('.gradle')
            || name.endsWith('.kts');
          if (!isText && !isResIcon) continue;

          let content;
          let encoding = 'utf-8';
          if (isResIcon) {
            // Binary → base64 for Git Data API
            let raw;
            try {
              raw = await fsApi(url).readFile(); // ArrayBuffer preferred
            } catch (_) {
              try {
                raw = await fsApi(url).readFile('base64');
              } catch (e2) {
                this._log('skip icon read ' + rel + ': ' + (e2.message || e2) + '\n');
                continue;
              }
            }
            let u8;
            if (typeof raw === 'string') {
              // already base64 or binary string
              if (/^[A-Za-z0-9+/=\s]+$/.test(raw.slice(0, 80)) && raw.length > 32) {
                content = raw.replace(/\s/g, '');
                encoding = 'base64';
              } else {
                // binary string
                let bin = '';
                for (let i = 0; i < raw.length; i++) bin += String.fromCharCode(raw.charCodeAt(i) & 0xff);
                content = btoa(bin);
                encoding = 'base64';
              }
            } else {
              const buf = raw instanceof ArrayBuffer ? raw : (raw && raw.buffer) ? raw.buffer : null;
              if (!buf) {
                this._log('skip icon bad data ' + rel + '\n');
                continue;
              }
              const bytes = new Uint8Array(buf);
              if (bytes.byteLength > 2_000_000) {
                this._log('skip large icon ' + rel + '\n');
                continue;
              }
              let binary = '';
              const step = 0x8000;
              for (let i = 0; i < bytes.length; i += step) {
                binary += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
              }
              content = btoa(binary);
              encoding = 'base64';
            }
            this._log('icon ' + rel + ' (' + encoding + ')\n');
          } else {
            content = await fsApi(url).readFile('utf-8');
            if (typeof content !== 'string') {
              try { content = new TextDecoder().decode(content); } catch (_) { continue; }
            }
            if (content.length > 500000) {
              this._log('skip large ' + rel + '\n');
              continue;
            }
          }

          if (/gradle\.properties$/i.test(rel)) {
            content = String(content)
              .split('\n')
              .filter((line) => {
                const L = line.trim();
                if (/aapt2FromMavenOverride/i.test(L)) return false;
                if (L.includes('/public/') && /aapt2/i.test(L)) return false;
                if (L.includes('/data/data/') && /aapt2/i.test(L)) return false;
                return true;
              })
              .join('\n');
          }
          out.push({ path: rel.replace(/\\/g, '/'), content, encoding: encoding || 'utf-8' });
        } catch (e) {
          this._log(`skip ${rel}: ${e.message}\\n`);
        }
      }
    }
    return out;
  }

  async _pushProjectToGithub(token, repo, branch, projectRootUrl) {
    const files = await this._listProjectFiles(projectRootUrl);
    this._log(`Collected ${files.length} source files\\n`);
    if (!files.length) {
      throw new Error('No project files found to upload');
    }
    // Ensure workflow included if present locally later steps may add it
    // Git Data API: blobs → tree → commit → update ref
    let parentSha = null;
    let baseTree = null;
    try {
      const ref = await gh(token, `/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
      parentSha = ref.object && ref.object.sha;
      const commit = await gh(token, `/repos/${repo}/git/commits/${parentSha}`);
      baseTree = commit.tree && commit.tree.sha;
    } catch (_) {
      // empty branch / no ref yet — create without parent
      this._log('No existing branch tip (fresh repo)\\n');
    }

    const treeItems = [];
    let i = 0;
    for (const f of files) {
      i++;
      if (i % 25 === 0) this._log(`Uploading blobs ${i}/${files.length}…\\n`);
      const blob = await gh(token, `/repos/${repo}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({
          content: f.content,
          encoding: f.encoding === 'base64' ? 'base64' : 'utf-8',
        }),
      });
      treeItems.push({
        path: f.path,
        mode: f.path.endsWith('gradlew') ? '100755' : '100644',
        type: 'blob',
        sha: blob.sha,
      });
    }

    // NO base_tree → full replace (obsolete remote files disappear)
    const treeBody = { tree: treeItems };
    const tree = await gh(token, `/repos/${repo}/git/trees`, {
      method: 'POST',
      body: JSON.stringify(treeBody),
    });

    const commitBody = {
      message: 'chore: full sync Android project from xhlp',
      tree: tree.sha,
    };
    if (parentSha) commitBody.parents = [parentSha];
    const commit = await gh(token, `/repos/${repo}/git/commits`, {
      method: 'POST',
      body: JSON.stringify(commitBody),
    });

    try {
      await gh(token, `/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
        method: 'PATCH',
        body: JSON.stringify({ sha: commit.sha, force: true }),
      });
    } catch (_) {
      await gh(token, `/repos/${repo}/git/refs`, {
        method: 'POST',
        body: JSON.stringify({
          ref: `refs/heads/${branch}`,
          sha: commit.sha,
        }),
      });
    }
    this._log(`Committed ${files.length} files → ${branch} (${commit.sha.slice(0, 7)})\\n`);
  }

  async _remoteHasGradle(token, repo, branch) {
    const candidates = [
      'settings.gradle',
      'settings.gradle.kts',
      'app/build.gradle',
      'app/build.gradle.kts',
    ];
    for (const path of candidates) {
      try {
        await gh(
          token,
          `/repos/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${encodeURIComponent(branch)}`
        );
        this._log(`Remote OK: found ${path}\n`);
        return true;
      } catch (_) {}
    }
    for (const path of candidates) {
      try {
        await gh(token, `/repos/${repo}/contents/${path}`);
        this._log(`Remote OK: found ${path}\n`);
        return true;
      } catch (_) {}
    }
    return false;
  }

  async _ensureRepo(token, owner, repo, autoCreate) {
    try {
      await gh(token, `/repos/${owner}/${repo}`);
      this._log(`Repo exists: ${owner}/${repo}\n`);
      return;
    } catch (e) {
      if (!autoCreate) {
        throw new Error(
          `Repo ${owner}/${repo} not found. Enable Auto-create private repo or create it on GitHub.`
        );
      }
    }
    this._log(`Creating private repo ${owner}/${repo}…\n`);
    try {
      await gh(token, '/user/repos', {
        method: 'POST',
        body: JSON.stringify({
          name: repo,
          private: true,
          description: 'Auto-created by xhlp Android builder',
          auto_init: true,
        }),
      });
      this._log('Private repo created.\n');
      await new Promise((r) => setTimeout(r, 1500));
    } catch (e) {
      if (!/already exists/i.test(String(e.message || e))) {
        throw new Error('Could not create repo: ' + (e.message || e));
      }
    }
  }

  async _ensureLocalWorkflow(projectRootUrl, wfRel, yml) {
    const parts = wfRel.split('/');
    let cur = projectRootUrl.replace(/\/$/, '');
    for (let i = 0; i < parts.length - 1; i++) {
      const next = `${cur}/${parts[i]}`;
      try {
        if (!(await fs(next).exists())) await fs(cur).createDirectory(parts[i]);
      } catch (_) {}
      cur = next;
    }
    const fileUrl = `${projectRootUrl.replace(/\/$/, '')}/${wfRel}`;
    try {
      if (await fs(fileUrl).exists()) await fs(fileUrl).writeFile(yml);
      else {
        const parent = fileUrl.replace(/\/[^/]+$/, '');
        await fs(parent).createFile(parts[parts.length - 1], yml);
      }
    } catch (e) {
      // SAF may fail create — still push via API
      console.warn('[XHLP] local workflow write', e);
    }
  }

  async _putWorkflowFile(token, repo, branch, wfRel, yml) {
    const path = wfRel;
    let sha;
    try {
      const existing = await gh(token, `/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`);
      sha = existing.sha;
    } catch (_) {}
    const body = {
      message: 'chore: update XHLP Android workflow',
      content: btoa(unescape(encodeURIComponent(yml))),
      branch,
    };
    if (sha) body.sha = sha;
    await gh(token, `/repos/${repo}/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async _findWorkflowId(token, repo, wfRel) {
    const list = await gh(token, `/repos/${repo}/actions/workflows?per_page=100`);
    const name = wfRel.split('/').pop();
    const w = (list.workflows || []).find(
      (x) => x.path === wfRel || x.path.endsWith(name) || x.name === 'XHLP Android Build'
    );
    if (!w) throw new Error('Workflow not found on GitHub — push repo / disable custom workflow once');
    return w.id;
  }

  async _waitForRun(token, repo, workflowId) {
    this._activeRepo = repo;
    this._activeToken = token;
    for (let i = 0; i < 30 && !this._stop; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      if (this._stop) return null;
      const runs = await gh(
        token,
        `/repos/${repo}/actions/workflows/${workflowId}/runs?per_page=5`
      );
      const run = (runs.workflow_runs || [])[0];
      if (run && Date.now() - new Date(run.created_at).getTime() < 10 * 60 * 1000) {
        this._activeRunId = run.id;
        try {
          this.ui.setBuildMeta?.({
            runId: String(run.id),
            actionsUrl: `https://github.com/${repo}/actions/runs/${run.id}`,
            status: run.status,
          });
        } catch (_) {}
        return run;
      }
    }
    return null;
  }

  async _fetchAndShowRunLogs(token, repo, runId) {
    const actionsUrl = `https://github.com/${repo}/actions/runs/${runId}`;
    this._log(`Actions page: ${actionsUrl}\n`);

    // 1) Job + step summary (always works via API, no CORS)
    try {
      const jobs = await gh(token, `/repos/${repo}/actions/runs/${runId}/jobs?per_page=20`);
      for (const job of jobs.jobs || []) {
        this._log(`\n=== Job: ${job.name} [${job.status}/${job.conclusion || ''}] ===\n`);
        for (const s of job.steps || []) {
          const mark =
            s.conclusion === 'success' ? '✓' :
            s.conclusion === 'failure' ? '✗' :
            s.conclusion === 'skipped' ? '·' : '…';
          this._log(`  ${mark} ${s.name} — ${s.status}${s.conclusion ? '/' + s.conclusion : ''}\n`);
        }
        // 2) Per-job log download (may fail in WebView CORS)
        if (job.id) {
          try {
            const logText = await this._downloadJobLogText(token, repo, job.id);
            if (logText) {
              this._log(`\n--- log: ${job.name} (tail) ---\n`);
              const lines = logText.split(/\r?\n/);
              // Prefer error/fail lines + last 80 lines
              const errLines = lines.filter((l) =>
                /error:|FAILURE|FAILED|What went wrong|AAPT|e:\s|FAILED:/i.test(l)
              );
              if (errLines.length) {
                this._log(errLines.slice(-40).join('\n') + '\n');
              }
              this._log(lines.slice(-80).join('\n') + '\n');
              this._log('--- end log ---\n');
            }
          } catch (e) {
            this._log(`(job log download: ${e.message})\n`);
          }
        }
      }
    } catch (e) {
      this._log(`Jobs API: ${e.message}\n`);
    }

    // 3) Full run logs zip (often blocked by CORS in WebView)
    try {
      this._log('Trying full run log archive…\n');
      const texts = await this._downloadRunLogsArchive(token, repo, runId);
      if (texts && texts.length) {
        texts.sort((a, b) => b.content.length - a.content.length);
        const main = texts[0];
        this._log(`\n--- GitHub archive: ${main.name} (tail) ---\n`);
        const lines = main.content.split(/\r?\n/);
        const errLines = lines.filter((l) =>
          /error:|FAILURE|FAILED|What went wrong|AAPT|e:\s/i.test(l)
        );
        if (errLines.length) this._log(errLines.slice(-50).join('\n') + '\n');
        this._log(lines.slice(-100).join('\n') + '\n');
        this._log('--- end archive log ---\n');
      }
    } catch (e) {
      this._log(
        `Full log archive unavailable (${e.message}).\n` +
          `Open in browser for full terminal output:\n${actionsUrl}\n`
      );
    }
  }

  async _downloadJobLogText(token, repo, jobId) {
    // API returns 302 to short-lived zip/text URL
    const url = `https://api.github.com/repos/${repo}/actions/jobs/${jobId}/logs`;
    const res = await fetch(url, {
      headers: ghHeaders(token),
      redirect: 'follow',
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const buf = await res.arrayBuffer();
    if (!buf || buf.byteLength < 10) throw new Error('empty');
    // zip?
    const u8 = new Uint8Array(buf);
    if (u8[0] === 0x50 && u8[1] === 0x4b) {
      const texts = await this._unzipAllText(buf);
      return texts.map((t) => t.content).join('\n\n');
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(u8);
  }

  async _downloadRunLogsArchive(token, repo, runId) {
    const url = `https://api.github.com/repos/${repo}/actions/runs/${runId}/logs`;
    const res = await fetch(url, {
      headers: { ...ghHeaders(token), Accept: 'application/vnd.github+json' },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const buf = await res.arrayBuffer();
    if (!buf || buf.byteLength < 22) throw new Error('empty archive');
    return this._unzipAllText(buf);
  }

  async _unzipAllText(arrayBuffer) {
    const u8 = new Uint8Array(arrayBuffer);
    const view = new DataView(arrayBuffer);
    const out = [];
    let eocd = -1;
    for (let i = u8.length - 22; i >= 0 && i > u8.length - 65557; i--) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) return out;
    const cdSize = view.getUint32(eocd + 12, true);
    const cdOffset = view.getUint32(eocd + 16, true);
    let off = cdOffset;
    const cdEnd = cdOffset + cdSize;
    while (off + 46 <= cdEnd) {
      if (view.getUint32(off, true) !== 0x02014b50) break;
      const method = view.getUint16(off + 10, true);
      const compSize = view.getUint32(off + 20, true);
      const nameLen = view.getUint16(off + 28, true);
      const extraLen = view.getUint16(off + 30, true);
      const commentLen = view.getUint16(off + 32, true);
      const localOff = view.getUint32(off + 42, true);
      const name = new TextDecoder().decode(u8.subarray(off + 46, off + 46 + nameLen));
      if (localOff + 30 <= u8.length && view.getUint32(localOff, true) === 0x04034b50) {
        const lNameLen = view.getUint16(localOff + 26, true);
        const lExtraLen = view.getUint16(localOff + 28, true);
        const dataStart = localOff + 30 + lNameLen + lExtraLen;
        const data = u8.subarray(dataStart, dataStart + compSize);
        let raw = data;
        if (method === 8) {
          try { raw = await this._inflateRaw(data); }
          catch (_) {
            try { raw = await this._inflateZlib(data); } catch (__) { raw = null; }
          }
        }
        if (raw && /\.(txt|log)$/i.test(name)) {
          out.push({ name, content: new TextDecoder('utf-8', { fatal: false }).decode(raw) });
        }
      }
      off += 46 + nameLen + extraLen + commentLen;
    }
    return out;
  }

  async _cancelGithubRun() {
    const token = this._activeToken;
    let repo = this._activeRepo;
    let runId = this._activeRunId;
    this._log('--- Cancel GitHub Actions ---\n');
    this._log(`token: ${token ? 'yes (' + token.slice(0, 6) + '…)' : 'NO'}\n`);
    this._log(`repo: ${repo || 'NO'}\n`);
    this._log(`runId: ${runId || 'not yet (will search)'}\n`);

    if (!token) {
      this._log('Cancel aborted: no token\n');
      return;
    }
    if (!repo) {
      this._log('Cancel aborted: no repo stored\n');
      return;
    }

    // If run not known yet (still Waiting for run…), find latest in-progress / queued
    if (!runId) {
      this._log('Looking up latest workflow run to cancel…\n');
      try {
        const runs = await gh(
          token,
          `/repos/${repo}/actions/runs?per_page=10`
        );
        const list = runs.workflow_runs || [];
        const hit = list.find((r) =>
          r.status === 'in_progress' || r.status === 'queued' || r.status === 'waiting' || r.status === 'pending'
        ) || list[0];
        if (hit) {
          runId = hit.id;
          this._activeRunId = runId;
          this._log(`Found run id=${runId} status=${hit.status}\n`);
        } else {
          this._log('No recent runs found on GitHub\n');
        }
      } catch (e) {
        this._log(`List runs failed: ${e.message || e}\n`);
      }
    }

    if (!runId) {
      this._log('Cancel aborted: no run id\n');
      return;
    }

    const apiPath = `/repos/${repo}/actions/runs/${runId}/cancel`;
    const pageUrl = `https://github.com/${repo}/actions/runs/${runId}`;
    this._log(`POST https://api.github.com${apiPath}\n`);
    this._log(`Page: ${pageUrl}\n`);

    try {
      // Empty body — GitHub expects POST with no JSON body (202 Accepted)
      const res = await fetch(`https://api.github.com${apiPath}`, {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      const text = await res.text().catch(() => '');
      this._log(`Cancel HTTP ${res.status} ${res.statusText}\n`);
      if (text) this._log(`Cancel body: ${text.slice(0, 200)}\n`);
      // 202 = accepted, 409 = already completed
      if (res.status === 202 || res.ok) {
        this._log('✓ Cancel accepted by GitHub\n');
      } else if (res.status === 409) {
        this._log('Run already completed (nothing to cancel)\n');
      } else {
        this._log(`Cancel failed HTTP ${res.status}\n`);
      }
    } catch (e) {
      this._log(`Cancel request error: ${e.message || e}\n`);
    }

    // Verify status
    try {
      await new Promise((r) => setTimeout(r, 1500));
      const run = await gh(token, `/repos/${repo}/actions/runs/${runId}`);
      this._log(`After cancel: status=${run.status} conclusion=${run.conclusion || ''}\n`);
      this.ui.setBuildMeta?.({
        status: run.status,
        conclusion: run.conclusion || 'cancelled',
        runId: String(runId),
        actionsUrl: pageUrl,
      });
    } catch (e) {
      this._log(`Verify status failed: ${e.message || e}\n`);
      try {
        this.ui.setBuildMeta?.({ status: 'cancelled', runId: String(runId), actionsUrl: pageUrl });
      } catch (_) {}
    }
    this._log('--- End cancel ---\n');
  }

  async _pollRun(token, repo, runId) {
    let lastLogLen = 0;
    for (let i = 0; i < 180 && !this._stop; i++) {
      const run = await gh(token, `/repos/${repo}/actions/runs/${runId}`);
      const status = run.status || '';
      const conclusion = run.conclusion || '';

      // Smooth progress: queued → in_progress → near done
      let pct = 15;
      if (status === 'queued' || status === 'pending' || status === 'waiting') pct = 20 + Math.min(i, 10);
      else if (status === 'in_progress') pct = Math.min(85, 35 + i * 2);
      else if (status === 'completed') pct = 95;
      try {
        this.ui.updateProgress?.(pct, `GitHub: ${status}${conclusion ? ' · ' + conclusion : ''}`, null, 'gradle');
        this.ui.setBuildMeta?.({
          status,
          conclusion: conclusion || '',
          progress: pct,
        });
      } catch (_) {}

      // Pull job step logs (best-effort)
      try {
        const jobs = await gh(token, `/repos/${repo}/actions/runs/${runId}/jobs`);
        const job = (jobs.jobs || [])[0];
        if (job) {
          const steps = job.steps || [];
          const active = steps.filter((s) => s.status === 'in_progress' || s.conclusion);
          const line = active
            .map((s) => `${s.name}: ${s.status}${s.conclusion ? '/' + s.conclusion : ''}`)
            .slice(-4)
            .join(' | ');
          if (line) this._log(`${line}\n`);
          // completed step names as progress breadcrumbs
          const done = steps.filter((s) => s.conclusion === 'success').length;
          const total = Math.max(steps.length, 1);
          if (status === 'in_progress') {
            const stepPct = 35 + Math.floor((done / total) * 50);
            this.ui.updateProgress?.(stepPct, `Step ${done}/${total}: ${job.name || 'build'}`, null, 'gradle');
          }
        }
      } catch (_) {}

      this._log(`… ${status} ${conclusion}\n`);
      if (status === 'completed') return run;
      await new Promise((r) => setTimeout(r, 4000));
    }
    throw new Error('Timeout waiting for GitHub Actions');
  }

  async _downloadArtifactToOutputs(token, repo, runId, projectRootUrl, variant, format) {
    const arts = await gh(token, `/repos/${repo}/actions/runs/${runId}/artifacts`);
    const art = (arts.artifacts || []).find((a) => /android-output|apk|aab/i.test(a.name))
      || (arts.artifacts || [])[0];
    if (!art) throw new Error('No artifact on run');

    this._log(`Artifact: ${art.name} (${art.size_in_bytes || '?'} bytes)\n`);
    const res = await fetch(art.archive_download_url, {
      headers: ghHeaders(token),
    });
    if (!res.ok) throw new Error('Artifact download failed HTTP ' + res.status);
    const zipBuf = await res.arrayBuffer();
    if (!zipBuf || zipBuf.byteLength < 22) {
      throw new Error('Artifact zip empty/corrupt');
    }

    // GitHub always wraps artifacts in a zip — extract real .apk / .aab
    const wantExt = format === 'aab' ? '.aab' : '.apk';
    let extracted = await this._unzipFindBinary(zipBuf, wantExt);
    if (!extracted) {
      // try opposite extension once
      extracted = await this._unzipFindBinary(zipBuf, format === 'aab' ? '.apk' : '.aab');
    }
    if (!extracted) {
      // Save artifact zip for manual extract
      try {
        const b64z = this._bytesToBase64(new Uint8Array(zipBuf));
        await this._writeBinaryFile(
          projectRootUrl.replace(/\/$/, '') + '/app/build/outputs',
          `github-artifact-${variant}.zip`,
          b64z,
          new Uint8Array(zipBuf)
        );
        this._log('Saved raw artifact zip under app/build/outputs/ (extract APK manually)\n');
      } catch (e) {
        this._log(`Could not save raw zip: ${e.message}\n`);
      }
      throw new Error(
        'No ' + wantExt + ' inside artifact zip. Open the zip from outputs or GitHub Actions page.'
      );
    }

    const outDirRel =
      format === 'aab'
        ? `app/build/outputs/bundle/${variant}`
        : `app/build/outputs/apk/${variant}`;
    const root = projectRootUrl.replace(/\/$/, '');
    const segments = outDirRel.split('/');
    let cur = root;
    for (const seg of segments) {
      const next = `${cur}/${seg}`;
      try {
        if (!(await fs(next).exists())) await fs(cur).createDirectory(seg);
      } catch (_) {}
      cur = next;
    }

    // Prefer real APK name from zip entry
    let fileName = extracted.name.split('/').pop() || `app-${variant}${wantExt}`;
    if (!fileName.toLowerCase().endsWith(wantExt)) {
      fileName = `app-${variant}${wantExt}`;
    }
    const b64 = this._bytesToBase64(extracted.bytes);

    await this._writeBinaryFile(cur, fileName, b64, extracted.bytes);
    this._log(`Saved APK/AAB → ${outDirRel}/${fileName} (${extracted.bytes.byteLength} bytes)\n`);

    // Also copy to public Downloads for easy install
    try {
      const dlRoot = 'file:///storage/emulated/0/Download';
      await this._writeBinaryFile(dlRoot, fileName, b64, extracted.bytes);
      this._log(`Also copied to Download/${fileName}\n`);
    } catch (e) {
      this._log(`Download folder copy skipped: ${e.message}\n`);
    }
  }

  _bytesToBase64(u8) {
    const bytes = u8 instanceof Uint8Array ? u8 : new Uint8Array(u8);
    let binary = '';
    const step = 0x8000;
    for (let i = 0; i < bytes.length; i += step) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
    }
    return btoa(binary);
  }

  async _writeBinaryFile(dirUrl, fileName, b64, bytes) {
    const fsApi = acode.require('fs');
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    // APK/AAB are ZIP containers — must start with PK\x03\x04
    if (u8.byteLength < 4 || u8[0] !== 0x50 || u8[1] !== 0x4b) {
      const hx = Array.from(u8.subarray(0, 8)).map((b) => b.toString(16).padStart(2, '0')).join(' ');
      this._log(`Bad APK magic: ${hx} (len=${u8.byteLength})\n`);
      throw new Error('Extracted payload is not a valid ZIP/APK (bad magic)');
    }
    const ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
    const target = String(dirUrl).replace(/\/$/, '') + '/' + fileName;

    const verify = async () => {
      try {
        const raw = await fsApi(target).readFile(); // binary preferred
        let head;
        if (raw instanceof ArrayBuffer) head = new Uint8Array(raw);
        else if (raw && raw.buffer) head = new Uint8Array(raw.buffer || raw);
        else if (typeof raw === 'string') {
          // if read as string, first chars should be 'PK'
          if (raw.charCodeAt(0) === 0x50 && raw.charCodeAt(1) === 0x4b) return true;
          // maybe base64 was stored as text — fail
          return false;
        } else return false;
        return head && head.byteLength >= 4 && head[0] === 0x50 && head[1] === 0x4b;
      } catch (_) {
        return false; // cannot verify — assume ok if write didn't throw
      }
    };

    const attempts = [
      // 1) ArrayBuffer (correct for Cordova/Acode binary)
      async () => {
        const f = fsApi(target);
        if (await f.exists()) await f.writeFile(ab);
        else {
          await fsApi(dirUrl).createFile(fileName, ab);
        }
      },
      // 2) Uint8Array
      async () => {
        const f = fsApi(target);
        if (await f.exists()) await f.writeFile(u8);
        else await fsApi(dirUrl).createFile(fileName, u8);
      },
      // 3) base64 with encoding flag (never plain string)
      async () => {
        const f = fsApi(target);
        if (typeof f.writeFile === 'function') {
          await f.writeFile(b64, 'base64');
        } else {
          await fsApi(dirUrl).createFile(fileName, b64, { encoding: 'base64' });
        }
      },
      // 4) Blob
      async () => {
        const blob = new Blob([u8], { type: 'application/vnd.android.package-archive' });
        const f = fsApi(target);
        if (await f.exists()) await f.writeFile(blob);
        else await fsApi(dirUrl).createFile(fileName, blob);
      },
    ];

    let last;
    for (const fn of attempts) {
      try {
        await fn();
        const ok = await verify();
        if (ok === false) {
          // corrupted write — try next method
          last = new Error('verify magic failed after write');
          continue;
        }
        this._log(`Binary write OK (${u8.byteLength} bytes) → ${fileName}\n`);
        return;
      } catch (e) {
        last = e;
      }
    }
    throw last || new Error('binary write failed');
  }

  /**
   * Minimal ZIP reader (STORE + DEFLATE via DecompressionStream).
   * Returns { name, bytes: Uint8Array } for first matching extension.
   */
  /**
   * Robust ZIP extract via End-of-Central-Directory (handles GitHub artifact zips).
   */
  async _unzipFindBinary(arrayBuffer, ext) {
    const u8 = new Uint8Array(arrayBuffer);
    const view = new DataView(arrayBuffer);
    const extLower = String(ext || '').toLowerCase();
    const files = [];

    // Find EOCD signature 0x06054b50 scanning from end
    let eocd = -1;
    for (let i = u8.length - 22; i >= 0 && i > u8.length - 65557; i--) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocd = i;
        break;
      }
    }

    const tryPush = async (name, method, data) => {
      if (!name || name.endsWith('/')) return;
      if (!name.toLowerCase().endsWith(extLower)) return;
      let out = null;
      if (method === 0) out = data;
      else if (method === 8) {
        try {
          out = await this._inflateRaw(data);
        } catch (e1) {
          try {
            out = await this._inflateZlib(data);
          } catch (e2) {
            this._log(`inflate fail ${name}: ${e1.message}\n`);
            return;
          }
        }
      } else {
        this._log(`skip ${name}: compression method ${method}\n`);
        return;
      }
      if (!out || out.byteLength < 4) return;
      // APK must be ZIP
      if (out[0] !== 0x50 || out[1] !== 0x4b) {
        this._log(`skip ${name}: not PK magic (got ${out[0]},${out[1]})\n`);
        return;
      }
      files.push({ name, bytes: out });
      this._log(`extracted ${name} (${out.byteLength} bytes)\n`);
    };

    if (eocd >= 0) {
      const cdSize = view.getUint32(eocd + 12, true);
      const cdOffset = view.getUint32(eocd + 16, true);
      let off = cdOffset;
      const cdEnd = cdOffset + cdSize;
      while (off + 46 <= cdEnd && off + 46 <= u8.length) {
        if (view.getUint32(off, true) !== 0x02014b50) break;
        const method = view.getUint16(off + 10, true);
        const compSize = view.getUint32(off + 20, true);
        const nameLen = view.getUint16(off + 28, true);
        const extraLen = view.getUint16(off + 30, true);
        const commentLen = view.getUint16(off + 32, true);
        const localOff = view.getUint32(off + 42, true);
        const name = new TextDecoder().decode(u8.subarray(off + 46, off + 46 + nameLen));
        // local file header at localOff
        if (localOff + 30 <= u8.length && view.getUint32(localOff, true) === 0x04034b50) {
          const lNameLen = view.getUint16(localOff + 26, true);
          const lExtraLen = view.getUint16(localOff + 28, true);
          const dataStart = localOff + 30 + lNameLen + lExtraLen;
          const dataEnd = dataStart + compSize;
          if (dataEnd <= u8.length) {
            await tryPush(name, method, u8.subarray(dataStart, dataEnd));
          }
        }
        off += 46 + nameLen + extraLen + commentLen;
      }
    }

    // Fallback: sequential local headers
    if (!files.length) {
      let offset = 0;
      while (offset + 30 < u8.length) {
        const sig = view.getUint32(offset, true);
        if (sig !== 0x04034b50) {
          offset++;
          continue;
        }
        const flags = view.getUint16(offset + 6, true);
        const method = view.getUint16(offset + 8, true);
        let compSize = view.getUint32(offset + 18, true);
        const nameLen = view.getUint16(offset + 26, true);
        const extraLen = view.getUint16(offset + 28, true);
        const name = new TextDecoder().decode(u8.subarray(offset + 30, offset + 30 + nameLen));
        const dataStart = offset + 30 + nameLen + extraLen;
        // data descriptor (bit 3): size after data — skip unreliable sequential parse
        if (flags & 0x8) {
          offset = dataStart + 1;
          continue;
        }
        const dataEnd = dataStart + compSize;
        if (dataEnd > u8.length) break;
        await tryPush(name, method, u8.subarray(dataStart, dataEnd));
        offset = dataEnd;
      }
    }

    if (!files.length) return null;
    files.sort((a, b) => b.bytes.byteLength - a.bytes.byteLength);
    return files[0];
  }

  async _inflateRaw(compressed) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('DecompressionStream not available');
    }
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([compressed]).stream().pipeThrough(ds);
    const ab = await new Response(stream).arrayBuffer();
    return new Uint8Array(ab);
  }

  async _inflateZlib(compressed) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('DecompressionStream not available');
    }
    const ds = new DecompressionStream('deflate');
    const stream = new Blob([compressed]).stream().pipeThrough(ds);
    const ab = await new Response(stream).arrayBuffer();
    return new Uint8Array(ab);
  }

}


export const androidGithubBuildManager = new AndroidGithubBuildManager();
