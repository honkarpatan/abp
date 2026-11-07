/**
 * Flutter SDK setup — agree → download ARM64 zip with progress → tick → Next → preview
 */
import { flutterStyles } from '../../styles/flutter.js';
import {
  getMissingFlutterComponents,
  saveFlutterSetting,
  checkFlutterPreviewReady,
  isFlutterSdkInstalled,
  FLUTTER_SDK_DOWNLOAD_URL,
  FLUTTER_DEFAULT_HOME,
} from './flutterEnvCheck.js';
import { executeCommand, writeShared } from '../../services/terminalManager.js';

import flutterPng from '../../assets/icons/png/flutter.png';
import flutterTitlePng from '../../assets/icons/png/flutter_title.png';

export class FlutterSetupUI {
  constructor() {
    this.tabId = 'flutter.setup';
    this.$container = null;
    this._poll = null;
    this._onReady = null;
  }

  async show(onReady) {
    this._onReady = onReady;
    const openFolder = acode.require('openFolder');
    const existing = openFolder.find(this.tabId);
    if (existing) existing.remove();

    this.$container = document.createElement('div');
    this.$container.className = 'flutter-setup flutter-page';

    const EditorFile = acode.require('editorFile');
    new EditorFile('Flutter Setup', {
      type: 'page',
      content: this.$container,
      id: this.tabId,
      tabIcon: 'icon play_circle_filled',
      stylesheets: [flutterStyles],
      hideQuickTools: true,
    });

    await this.renderConsent();
  }

  _header(sub) {
    return `
      <div class="flutter-header">
        <img class="flutter-logo" src="${flutterPng}" alt="Flutter" />
        <div style="flex:1;min-width:0;">
          <img class="flutter-title-img" src="${flutterTitlePng}" alt="Flutter" onerror="this.style.display='none';this.nextElementSibling.style.display='block';" />
          <h2 style="display:none;">Flutter Setup</h2>
          <div class="flutter-sub">${sub || ''}</div>
        </div>
      </div>`;
  }

  async renderConsent() {
    const missing = await getMissingFlutterComponents();
    const flutterOk = await isFlutterSdkInstalled();

    const rows = missing.length
      ? missing
          .map(
            (m) => `
        <li>
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="flutter-check miss">!</span>
            <div>
              <div>${m.name}</div>
              <div class="flutter-hint">${m.hint || ''}</div>
            </div>
          </div>
          <span class="flutter-status-miss">${m.size}</span>
        </li>`
          )
          .join('')
      : `
        <li>
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="flutter-check ok">✓</span>
            <div>Flutter SDK</div>
          </div>
          <span class="flutter-status-ok">Ready</span>
        </li>`;

    this.$container.innerHTML = `
      ${this._header('SDK install for web preview')}
      <div class="flutter-body">
        <div class="flutter-hero">
          <img src="${flutterPng}" alt="" />
          <p>Install the <strong>Flutter SDK (ARM64)</strong> to run web preview on this device.</p>
        </div>

        <div class="flutter-card">
          <div class="flutter-card-title">Components</div>
          <ul class="flutter-list">${rows}</ul>
        </div>

        <div class="flutter-card">
          <div class="flutter-card-title">Download source</div>
          <p class="flutter-hint" style="margin:0;word-break:break-all;">
            ${FLUTTER_SDK_DOWNLOAD_URL}
          </p>
          <p class="flutter-hint">
            Install path: <code>${FLUTTER_DEFAULT_HOME}</code> (Alpine: <code>/public/flutter</code>)
          </p>
          <div class="flutter-agree-box">
            <input type="checkbox" id="fl-agree" ${flutterOk ? 'checked' : ''} />
            <label for="fl-agree">
              I agree to download the Flutter SDK (ARM64) and finish automatic setup under
              <code>$HOME/flutter</code> (~1 GB+ storage & data). First bootstrap may take
              <strong>30 minutes to 1 hour+</strong> (CPU-dependent). Please do not cancel.
            </label>
          </div>
        </div>

        <div class="flutter-actions">
          <button class="flutter-btn flutter-btn-secondary" id="btn-recheck">Recheck</button>
          <button class="flutter-btn" id="btn-primary">
            ${flutterOk ? 'Next → Preview' : 'Download & Install'}
          </button>
        </div>
      </div>
      <div class="flutter-footer">Flutter-themed setup · ARM64 SDK</div>
    `;

    this.$container.querySelector('#btn-recheck').onclick = () => this.renderConsent();

    this.$container.querySelector('#btn-primary').onclick = async () => {
      if (flutterOk) {
        if (typeof this._onReady === 'function') this._onReady();
        return;
      }
      const agree = this.$container.querySelector('#fl-agree');
      if (!agree.checked) {
        window.toast('Please agree to download Flutter SDK', 3000);
        return;
      }
      await this.startInstall();
    };
  }

  async startInstall() {
    const workDir = FLUTTER_DEFAULT_HOME; // $HOME/flutter parent is $HOME
    const homeShell = '$HOME';
    const zipPath = `${homeShell}/Flutter-SDK-ARM64.zip`;
    const statusPath = `${homeShell}/flutter_setup_status.txt`;
    const logPath = `${homeShell}/flutter_setup_log.txt`;
    const url = FLUTTER_SDK_DOWNLOAD_URL;

    this.$container.innerHTML = `
      ${this._header('Downloading Flutter SDK…')}
      <div class="flutter-body">
        <div class="flutter-card">
          <div class="flutter-progress-area">
            <div class="flutter-progress-label" id="prog-title">Preparing…</div>
            <div class="flutter-progress-sub" id="prog-sub">Keep Acode open — later steps may take 30–60+ min on phone CPU</div>
            <div class="flutter-progress-track" id="prog-track">
              <div class="flutter-progress-fill indeterminate" id="prog-bar"></div>
              <img class="flutter-progress-icon" id="prog-icon" src="${flutterPng}" alt="" />
            </div>
          </div>
          <button class="flutter-btn flutter-btn-secondary" id="btn-details" style="font-size:0.8rem;padding:6px 12px;">
            Show Logs
          </button>
          <div class="flutter-log-box" id="log-box">Initializing…\n</div>
        </div>
        <div class="flutter-actions">
          <button class="flutter-btn" id="btn-done" disabled>Next → Preview</button>
        </div>
      </div>
      <div class="flutter-footer" id="prog-footer">Installing to $HOME/flutter</div>
    `;

    const $bar = this.$container.querySelector('#prog-bar');
    const $icon = this.$container.querySelector('#prog-icon');
    const $title = this.$container.querySelector('#prog-title');
    const $sub = this.$container.querySelector('#prog-sub');
    const $log = this.$container.querySelector('#log-box');
    const $done = this.$container.querySelector('#btn-done');
    const $footer = this.$container.querySelector('#prog-footer');

    this.$container.querySelector('#btn-details').onclick = (e) => {
      $log.classList.toggle('visible');
      e.target.textContent = $log.classList.contains('visible') ? 'Hide Logs' : 'Show Logs';
    };

    const setProgress = (pct, title, sub) => {
      const n = Math.max(0, Math.min(100, pct));
      if ($bar) {
        $bar.classList.remove('indeterminate');
        $bar.style.width = n + '%';
      }
      if ($icon) $icon.style.left = n + '%';
      if (title != null && $title) $title.textContent = title;
      if (sub != null && $sub) $sub.textContent = sub;
    };

    const appendLog = (t) => {
      if (!$log) return;
      $log.textContent += t;
      $log.scrollTop = $log.scrollHeight;
    };

    // Shell installer: download + unzip + chmod
    const script = `
set -e
STATUS="${statusPath}"
LOG="${logPath}"
URL="${url}"
ZIP="${zipPath}"
DEST="${workDir}"
log() { echo "$1" | tee -a "$LOG"; }
status() { echo "$1" > "$STATUS"; }

status "2:Preparing folders"
echo "" > "$LOG"
log "Flutter SDK install started"
mkdir -p "$HOME"
status "3:Installing system packages…"
log "apk: wget curl unzip + gcompat (glibc compat for Dart on Alpine)"
apk add --quiet wget curl unzip ca-certificates gcompat libstdc++ libgcc 2>>"$LOG" || true

status "8:Downloading Flutter-SDK-ARM64.zip"
log "URL: $URL"
# Prefer wget with progress piped roughly; fallback curl
if command -v wget >/dev/null 2>&1; then
  wget --no-check-certificate -O "$ZIP" "$URL" >>"$LOG" 2>&1 &
  WPID=$!
  while kill -0 $WPID 2>/dev/null; do
    if [ -f "$ZIP" ]; then
      SZ=$(wc -c < "$ZIP" 2>/dev/null || echo 0)
      # rough % assuming ~900MB
      PCT=$(( SZ * 70 / 900000000 ))
      if [ "$PCT" -gt 70 ]; then PCT=70; fi
      if [ "$PCT" -lt 8 ]; then PCT=8; fi
      status "$PCT:Downloading… $(echo $SZ | awk '{printf "%.1f MB",$1/1024/1024}')"
    fi
    sleep 2
  done
  wait $WPID || { status "Error: wget failed"; exit 1; }
elif command -v curl >/dev/null 2>&1; then
  status "15:Downloading (curl)…"
  curl -L --progress-bar -o "$ZIP" "$URL" >>"$LOG" 2>&1 || { status "Error: curl failed"; exit 1; }
else
  status "Error: need wget or curl"
  exit 1
fi

status "72:Download complete — extracting"
log "Extracting Flutter SDK"
rm -rf "$DEST" "$HOME/flutter_extract_tmp"
mkdir -p "$HOME/flutter_extract_tmp"
unzip -q -o "$ZIP" -d "$HOME/flutter_extract_tmp" >>"$LOG" 2>&1 || {
  status "Error: unzip failed"
  exit 1
}

# Zip layout is usually flutter_extract_tmp/flutter/bin/flutter
# IMPORTANT: do NOT mkdir $DEST before mv — if $DEST exists as a dir,
# "mv ROOT DEST" nests as DEST/flutter (this caused the previous failure).
FOUND=$(find "$HOME/flutter_extract_tmp" -type f -path "*/bin/flutter" 2>/dev/null | head -1)
if [ -z "$FOUND" ]; then
  FOUND=$(find "$HOME/flutter_extract_tmp" -type f -name flutter 2>/dev/null | head -1)
fi
log "Found binary candidate: $FOUND"

if [ -n "$FOUND" ]; then
  # .../bin/flutter → SDK root is parent of bin
  SDK_ROOT=$(dirname "$(dirname "$FOUND")")
  log "SDK root: $SDK_ROOT"
  rm -rf "$DEST"
  mv "$SDK_ROOT" "$DEST"
else
  status "Error: no flutter binary inside zip"
  log "Extract tree:"; find "$HOME/flutter_extract_tmp" -maxdepth 3 >>"$LOG" 2>&1 || true
  exit 1
fi

rm -rf "$HOME/flutter_extract_tmp"

# Flatten accidental double nest: $HOME/flutter/flutter/bin/flutter
if [ ! -f "$DEST/bin/flutter" ] && [ -f "$DEST/flutter/bin/flutter" ]; then
  log "Flattening nested flutter/flutter → flutter"
  mv "$DEST/flutter" "$HOME/flutter_sdk_flat_tmp"
  rm -rf "$DEST"
  mv "$HOME/flutter_sdk_flat_tmp" "$DEST"
fi

chmod -R a+rX "$DEST" 2>/dev/null || true
if [ -f "$DEST/bin/flutter" ]; then
  chmod +x "$DEST/bin/flutter" 2>/dev/null || true
fi
chmod +x "$DEST/bin/cache/dart-sdk/bin/"* 2>/dev/null || true

status "88:Verifying flutter binary"
if [ -x "$DEST/bin/flutter" ] || [ -f "$DEST/bin/flutter" ]; then
  log "OK: $DEST/bin/flutter"
  export PATH="$DEST/bin:$PATH"
  export FLUTTER_ROOT="$DEST"
  if ! grep -q 'flutter/bin' "$HOME/.profile" 2>/dev/null; then
    echo '' >> "$HOME/.profile"
    echo '# Flutter SDK (xhlp)' >> "$HOME/.profile"
    echo 'export PATH="$HOME/flutter/bin:$PATH"' >> "$HOME/.profile"
    log "Added PATH to ~/.profile"
  fi
  ln -sf "$DEST/bin/flutter" /usr/local/bin/flutter 2>/dev/null || true
  mkdir -p "$HOME/bin" 2>/dev/null || true
  ln -sf "$DEST/bin/flutter" "$HOME/bin/flutter" 2>/dev/null || true

  # --- Long phase: do NOT cancel (30–60+ min on slow CPU) ---
  status "90:First-time Flutter bootstrap (long)…"
  log "NOTICE: First bootstrap can take 30–60+ minutes depending on CPU."
  log "NOTICE: Uses network for Dart SDK + packages. Do NOT cancel."
  log "NOTICE: Keep Acode open and screen on if possible."

  status "91:Downloading Dart SDK if needed…"
  log "flutter --version (auto Dart SDK + build flutter tool)"
  # This single command: Dart SDK download + "Building flutter tool" + pub get
  "$DEST/bin/flutter" --version >>"$LOG" 2>&1 || {
    log "flutter --version non-zero; retrying once after gcompat ensure"
    apk add --quiet gcompat libstdc++ libgcc 2>>"$LOG" || true
    "$DEST/bin/flutter" --version >>"$LOG" 2>&1 || log "version still non-zero — check logs"
  }

  status "96:Precache web (automatic)…"
  log "flutter precache --web"
  "$DEST/bin/flutter" precache --web >>"$LOG" 2>&1 || log "precache --web soft-fail"

  status "98:Cleaning zip"
  rm -f "$ZIP"
  status "100:Flutter SDK ready"
  log "Done. SDK at $DEST — fully bootstrapped for this device"
else
  status "Error: flutter binary not found after extract"
  log "Listing $DEST:"; ls -la "$DEST" >>"$LOG" 2>&1 || true
  log "find bin:"; find "$DEST" -path "*/bin/flutter" 2>/dev/null >>"$LOG" || true
  exit 1
fi
`;

    try {
      const b64 = btoa(unescape(encodeURIComponent(script)));
      const cmd =
        `echo "${b64}" | base64 -d > "$HOME/flutter_install.sh" && ` +
        `chmod +x "$HOME/flutter_install.sh" && ` +
        `sh "$HOME/flutter_install.sh"`;
      await writeShared(cmd + '\r');
      appendLog('Installer started in Alpine terminal…\n');
    } catch (e) {
      appendLog('Failed to start: ' + (e.message || e) + '\n');
      window.toast('Could not start install', 3000);
      return;
    }

    let finished = false;
    let lastPct = 0;

    const readFile = async (p) => {
      try {
        const out = await executeCommand(
          `sh -c 'if [ -f "${p}" ]; then cat "${p}"; else echo ""; fi'`,
          true
        );
        return (out || '').toString();
      } catch {
        return '';
      }
    };

    if (this._poll) clearInterval(this._poll);
    this._poll = setInterval(async () => {
      if (finished) return;
      try {
        const status = await readFile(statusPath);
        const log = await readFile(logPath);
        if (log) {
          $log.textContent = log;
          $log.scrollTop = $log.scrollHeight;
        }
        if (!status.trim()) return;
        const line = status.trim().split('\n').filter(Boolean).pop() || '';
        if (line.startsWith('Error:')) {
          finished = true;
          clearInterval(this._poll);
          setProgress(lastPct, 'Install failed', line);
          $footer.textContent = line;
          $done.disabled = false;
          $done.textContent = 'Back';
          $done.onclick = () => this.renderConsent();
          return;
        }
        const colon = line.indexOf(':');
        let pct = lastPct;
        let msg = line;
        if (colon >= 0) {
          pct = parseInt(line.slice(0, colon), 10);
          msg = line.slice(colon + 1).trim();
        }
        if (!Number.isNaN(pct)) {
          lastPct = Math.max(lastPct, pct);
          let sub = lastPct + '%';
          if (lastPct >= 88) {
            sub = 'First bootstrap can take 30 min–1 hour+ (depends on CPU). Uses internet. Please do NOT cancel. Keep Acode open.';
          }
          setProgress(lastPct, msg, sub);
          if (lastPct >= 88 && $footer) {
            $footer.textContent = 'First bootstrap can take 30 min–1 hour+ (depends on CPU). Uses internet. Please do NOT cancel. Keep Acode open.';
          }
        }
        if (lastPct >= 100 || /ready/i.test(msg) || /installed/i.test(msg)) {
          finished = true;
          clearInterval(this._poll);
          setProgress(100, 'Flutter SDK ready', 'All automatic steps finished');
          saveFlutterSetting('flutterSdk', FLUTTER_DEFAULT_HOME);
          $footer.textContent = 'SDK: $HOME/flutter · path saved';
          $done.disabled = false;
          $done.textContent = 'Next → Preview';
          $done.onclick = async () => {
            const ok = await checkFlutterPreviewReady();
            if (!ok) {
              window.toast('SDK still not detected — try Recheck', 3000);
              await this.renderConsent();
              return;
            }
            if (typeof this._onReady === 'function') this._onReady();
          };
          window.toast('Flutter installed!', 2500);
        }
      } catch (e) {
        appendLog('Poll: ' + e.message + '\n');
      }
    }, 2000);
  }
}
