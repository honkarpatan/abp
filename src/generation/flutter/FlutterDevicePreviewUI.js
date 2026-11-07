/**
 * Flutter external (device) preview — runs `flutter run` on a physical/local
 * Android device so plugins & hardware work (unlike web-server preview).
 *
 * Same phone is fine: flutter run installs+launches the app on this device.
 * Requires Android toolchain + `flutter devices` listing an android target.
 */
import { flutterStyles } from '../../styles/flutter.js';
import flutterPng from '../../assets/icons/png/flutter.png';
import { getFlutterSettings, getFlutterBinPath } from './flutterEnvCheck.js';
import { executeCommand, writeShared } from '../../services/terminalManager.js';

export class FlutterDevicePreviewUI {
  constructor() {
    this.tabId = 'flutter.device.preview';
    this.$container = null;
    this.projectPath = null;
    this.logs = [];
    this._started = false;
    this._deviceId = null;
    this._poll = null;
  }

  _pushLog(level, text) {
    this.logs.push({
      t: new Date().toLocaleTimeString(),
      level: level || 'info',
      text: String(text || ''),
    });
    if (this.logs.length > 300) this.logs.shift();
    this._renderLogs();
  }

  _esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  _shellProjectRoot(projectPath) {
    let shellRoot = projectPath || '';
    if (shellRoot.startsWith('file://')) shellRoot = shellRoot.replace('file://', '');
    if (shellRoot.includes('content://')) return '';
    return shellRoot;
  }

  setStatus(msg, level = 'info') {
    if (this.$status) this.$status.textContent = msg;
    this._pushLog(level, msg);
  }

  async show(projectPath) {
    this.projectPath = projectPath;
    const openFolder = acode.require('openFolder');
    const existing = openFolder.find(this.tabId);
    if (existing) existing.remove();

    this.$container = document.createElement('div');
    this.$container.className = 'flutter-preview flutter-page';
    this.$container.innerHTML = `
      <div class="flutter-header" style="padding:12px 14px;">
        <img class="flutter-logo" src="${flutterPng}" alt="" />
        <div style="flex:1;min-width:0;">
          <h2 style="margin:0;font-size:1rem;">Flutter Device Preview</h2>
          <div class="flutter-sub" id="dev-sub">External · native app on device</div>
        </div>
      </div>
      <div class="flutter-body" style="padding:12px 14px;">
        <div class="flutter-card" style="text-align:left;">
          <div class="flutter-card-title">What this does</div>
          <p class="flutter-hint" style="margin:0;">
            Runs <code>flutter run</code> on a real Android target (often <strong>this phone</strong>).
            Camera, sensors, plugins work. Not the web iframe preview.
          </p>
          <p class="flutter-hint" style="margin:8px 0 0;">
            Needs Android SDK / adb so the device shows up in <code>flutter devices</code>.
            First launch compiles (slow on phone); then use <strong>Hot reload</strong>.
          </p>
        </div>

        <div class="flutter-card" style="text-align:left;margin-top:12px;">
          <div class="flutter-card-title">Device</div>
          <pre class="flutter-hint" id="dev-list" style="white-space:pre-wrap;max-height:120px;overflow:auto;margin:0;">Detecting…</pre>
          <label class="flutter-label" style="margin-top:10px;">Device id (optional override)</label>
          <input class="flutter-input" id="dev-id" placeholder="auto: first android device" />
        </div>

        <div class="flutter-actions" style="margin-top:12px;flex-wrap:wrap;gap:8px;">
          <button type="button" class="flutter-btn" id="btn-start">Start on device</button>
          <button type="button" class="flutter-btn flutter-btn-secondary" id="btn-reload">Hot reload (r)</button>
          <button type="button" class="flutter-btn flutter-btn-secondary" id="btn-restart">Hot restart (R)</button>
          <button type="button" class="flutter-btn flutter-btn-secondary" id="btn-stop">Stop</button>
          <button type="button" class="flutter-btn flutter-btn-secondary" id="btn-refresh-dev">Refresh devices</button>
        </div>

        <div class="flutter-card" style="text-align:left;margin-top:12px;">
          <div class="flutter-card-title">Status</div>
          <div id="dev-status" class="flutter-hint" style="margin:0;font-weight:600;">Idle</div>
        </div>

        <div class="flutter-card" style="text-align:left;margin-top:12px;">
          <div class="flutter-card-title">Logs</div>
          <div id="dev-logs" style="max-height:220px;overflow:auto;font-size:12px;font-family:monospace;"></div>
        </div>
      </div>
    `;

    const EditorFile = acode.require('editorFile');
    new EditorFile('Flutter Device Preview', {
      type: 'page',
      content: this.$container,
      id: this.tabId,
      tabIcon: 'icon play_circle_filled',
      stylesheets: [flutterStyles],
    });

    this.$status = this.$container.querySelector('#dev-status');
    this.$list = this.$container.querySelector('#dev-list');
    this.$idInput = this.$container.querySelector('#dev-id');

    this.$container.querySelector('#btn-start').onclick = () => this.start();
    this.$container.querySelector('#btn-reload').onclick = () => this.hotReload();
    this.$container.querySelector('#btn-restart').onclick = () => this.hotRestart();
    this.$container.querySelector('#btn-stop').onclick = () => this.stop();
    this.$container.querySelector('#btn-refresh-dev').onclick = () => this.refreshDevices();

    await this.refreshDevices();
  }

  _renderLogs() {
    const el = this.$container?.querySelector('#dev-logs');
    if (!el) return;
    el.innerHTML = this.logs
      .slice()
      .reverse()
      .slice(0, 80)
      .map(
        (e) =>
          `<div class="flutter-log-line level-${e.level}"><span class="t">${e.t}</span> ${this._esc(e.text)}</div>`
      )
      .join('');
  }

  async refreshDevices() {
    this.setStatus('Listing flutter devices…', 'info');
    try {
      const flutterBin = await getFlutterBinPath();
      const out = await executeCommand(
        `sh -c 'FB=$(eval echo ${JSON.stringify(flutterBin)}); $FB devices 2>&1'`,
        true
      );
      const text = (out || '').toString().trim() || '(no output)';
      if (this.$list) this.$list.textContent = text;
      this._pushLog('info', 'flutter devices:\n' + text);

      // Prefer android / emulator lines with an id
      const lines = text.split('\n');
      let picked = null;
      for (const line of lines) {
        const low = line.toLowerCase();
        if (low.includes('chrome') || low.includes('web-server') || low.includes('linux')) continue;
        if (low.includes('android') || low.includes('emulator') || low.includes('sdk')) {
          const m = line.match(/^([a-zA-Z0-9_:.-]+)\s+/);
          if (m) {
            picked = m[1];
            break;
          }
        }
      }
      // Fallback: any id that looks like a serial
      if (!picked) {
        for (const line of lines) {
          if (/chrome|web-server|linux|macos|windows|No devices/i.test(line)) continue;
          const m = line.match(/^([a-zA-Z0-9_]{4,})\s{2,}/);
          if (m && m[1] !== 'Id') {
            picked = m[1];
            break;
          }
        }
      }
      this._deviceId = picked;
      if (picked && this.$idInput && !this.$idInput.value) {
        this.$idInput.value = picked;
      }
      if (picked) {
        this.setStatus(`Device candidate: ${picked}`, 'info');
      } else {
        this.setStatus(
          'No Android device in list — enable USB debugging / adb, or install Android toolchain',
          'warn'
        );
      }
    } catch (e) {
      if (this.$list) this.$list.textContent = String(e.message || e);
      this.setStatus('flutter devices failed: ' + (e.message || e), 'error');
    }
  }

  async start() {
    if (this._started) {
      window.toast('Already starting/running — Stop first or use Hot reload', 2500);
      return;
    }
    this._started = true;
    try {
      const flutterBin = await getFlutterBinPath();
      const shellRoot = this._shellProjectRoot(this.projectPath);
      if (!shellRoot) {
        this.setStatus('Project path not usable (content://). Open project from file path.', 'error');
        this._started = false;
        return;
      }

      const device =
        (this.$idInput && this.$idInput.value.trim()) || this._deviceId || '';
      if (!device) {
        await this.refreshDevices();
      }
      const id =
        (this.$idInput && this.$idInput.value.trim()) || this._deviceId || '';
      if (!id) {
        this.setStatus(
          'No device id — run adb devices / flutter doctor. Web preview still available.',
          'error'
        );
        this._started = false;
        return;
      }

      this.setStatus(`Starting flutter run -d ${id}… (first build can take minutes)`, 'info');
      window.toast('Device preview: compiling… watch terminal', 3000);

      const cdPart = `cd ${JSON.stringify(shellRoot)} 2>/dev/null || cd "$(eval echo ${JSON.stringify(shellRoot)})" 2>/dev/null || true; `;
      const launch =
        `export PATH="$(dirname $(eval echo ${JSON.stringify(flutterBin)})):$PATH"; ` +
        cdPart +
        `FB=$(eval echo ${JSON.stringify(flutterBin)}); ` +
        `echo "[xhlp] Flutter device preview"; echo "Flutter: $FB"; echo "Device: ${id}"; ` +
        `$FB pub get; ` +
        `$FB run -d ${JSON.stringify(id)}`;

      try {
        await writeShared('\x03');
      } catch (_) {}
      await writeShared(launch + '\r');

      this.setStatus(
        `Running on ${id} — app should open on device. Use Hot reload after edits.`,
        'info'
      );
      this._pushLog(
        'info',
        'Tip: keep the shared terminal visible for compile logs. Hot reload sends "r" to that session.'
      );
    } catch (e) {
      this.setStatus('Start failed: ' + (e.message || e), 'error');
      this._started = false;
    }
  }

  async hotReload() {
    this.setStatus('Sending hot reload (r)…', 'info');
    try {
      await writeShared('r\r');
      window.toast('Hot reload sent', 1500);
    } catch (e) {
      this.setStatus('Hot reload failed: ' + (e.message || e), 'error');
    }
  }

  async hotRestart() {
    this.setStatus('Sending hot restart (R)…', 'info');
    try {
      await writeShared('R\r');
      window.toast('Hot restart sent', 1500);
    } catch (e) {
      this.setStatus('Hot restart failed: ' + (e.message || e), 'error');
    }
  }

  async stop() {
    this.setStatus('Stopping flutter run…', 'info');
    try {
      await writeShared('q\r');
      await executeCommand(
        `sh -c 'pkill -f "flutter run" 2>/dev/null; true'`,
        true
      );
      this._started = false;
      this.setStatus('Stopped', 'info');
    } catch (e) {
      this._started = false;
      this.setStatus('Stop: ' + (e.message || e), 'warn');
    }
  }
}
