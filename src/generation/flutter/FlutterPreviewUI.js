/**
 * Flutter web preview — no top bar; chrome in footer + floating ⋮ when hidden.
 */
import { flutterStyles } from '../../styles/flutter.js';
import flutterPng from '../../assets/icons/png/flutter.png';
import { getFlutterSettings, getFlutterBinPath, saveFlutterSetting } from './flutterEnvCheck.js';
import { executeCommand, writeShared } from '../../services/terminalManager.js';

const DEVICE_PRESETS = [
  { id: 'responsive', name: 'Responsive (fill)', w: 0, h: 0 },
  { id: 'iphone14', name: 'iPhone 14', w: 390, h: 844 },
  { id: 'iphone14pro', name: 'iPhone 14 Pro Max', w: 430, h: 932 },
  { id: 'pixel7', name: 'Pixel 7', w: 412, h: 915 },
  { id: 'galaxy_s21', name: 'Galaxy S21', w: 360, h: 800 },
  { id: 'ipad', name: 'iPad (10th)', w: 820, h: 1180 },
  { id: 'ipad_land', name: 'iPad landscape', w: 1180, h: 820 },
  { id: 'desktop', name: 'Desktop HD', w: 1280, h: 720 },
  { id: 'custom', name: 'Custom size…', w: -1, h: -1 },
];

export class FlutterPreviewUI {
  constructor() {
    this.tabId = 'flutter.preview';
    this.$container = null;
    this._poll = null;
    this._started = false;
    this._iconTimer = null;
    this._statusTimer = null;
    this.projectPath = null;
    this.port = '8080';
    this.baseUrl = 'http://127.0.0.1:8080';
    this.logs = [];
    this.prefs = {
      deviceId: 'responsive',
      width: 0,
      height: 0,
      scale: 100,
      orientation: 'portrait',
      showDeviceChrome: true,
      hideFooter: false,
      rotateIcon: true,
    };
  }

  _loadPrefs() {
    try {
      const raw = localStorage.getItem('xhlp_flutter_preview_prefs');
      if (raw) Object.assign(this.prefs, JSON.parse(raw));
    } catch (_) {}
  }

  _savePrefs() {
    try {
      localStorage.setItem('xhlp_flutter_preview_prefs', JSON.stringify(this.prefs));
    } catch (_) {}
  }

  _pushLog(level, text) {
    const entry = {
      t: new Date().toLocaleTimeString(),
      level: level || 'info',
      text: String(text || ''),
    };
    this.logs.push(entry);
    if (this.logs.length > 200) this.logs.shift();
    this._renderLogPanelIfOpen();
  }

  async show(projectPath) {
    this.projectPath = projectPath;
    this._loadPrefs();
    const cfg = getFlutterSettings();
    this.port = String(cfg.webPort || '8080');
    this.baseUrl = `http://127.0.0.1:${this.port}`;

    const openFolder = acode.require('openFolder');
    const existing = openFolder.find(this.tabId);
    if (existing) existing.remove();

    this.$container = document.createElement('div');
    this.$container.className = 'flutter-preview flutter-page';

    this.$container.innerHTML = `
      <div class="flutter-preview-stage" id="preview-stage">
        <div class="flutter-device-shell" id="device-shell">
          <div class="flutter-device-notch" id="device-notch"></div>
          <iframe class="flutter-preview-iframe" id="preview-frame" src="about:blank" allow="fullscreen"></iframe>
          <div class="flutter-device-home" id="device-home"></div>
        </div>
      </div>

      <div class="flutter-footer flutter-preview-bar" id="preview-footer">
        <img class="flutter-preview-mark" id="preview-flutter-icon" src="${flutterPng}" alt="" />
        <div class="flutter-footer-status" id="footer-status">Starting…</div>
        <button type="button" class="flutter-footer-icon-btn" id="btn-logs" title="Logs & info">💬</button>
        <button type="button" class="flutter-footer-icon-btn" id="btn-more" title="Settings">⋮</button>
        <div class="flutter-menu flutter-menu-up" id="preview-menu" hidden></div>
      </div>

      <button type="button" class="flutter-fab-more" id="btn-fab-more" title="Settings" hidden>⋮</button>

      <div class="flutter-log-panel" id="log-panel" hidden>
        <div class="flutter-log-panel-head">
          <span>Info · Logs · Errors</span>
          <button type="button" class="flutter-footer-icon-btn" id="btn-logs-close">✕</button>
        </div>
        <div class="flutter-log-panel-tabs">
          <button type="button" class="flutter-log-tab is-active" data-tab="all">All</button>
          <button type="button" class="flutter-log-tab" data-tab="info">Info</button>
          <button type="button" class="flutter-log-tab" data-tab="error">Errors</button>
        </div>
        <div class="flutter-log-panel-body" id="log-panel-body"></div>
      </div>

      <div class="flutter-modal-root" id="modal-root" hidden></div>
    `;

    const EditorFile = acode.require('editorFile');
    new EditorFile('Flutter Preview', {
      type: 'page',
      content: this.$container,
      id: this.tabId,
      tabIcon: 'icon play_circle_filled',
      stylesheets: [flutterStyles],
      hideQuickTools: true,
    });

    this.$frame = this.$container.querySelector('#preview-frame');
    this.$footer = this.$container.querySelector('#preview-footer');
    this.$status = this.$container.querySelector('#footer-status');
    this.$menu = this.$container.querySelector('#preview-menu');
    this.$modalRoot = this.$container.querySelector('#modal-root');
    this.$shell = this.$container.querySelector('#device-shell');
    this.$stage = this.$container.querySelector('#preview-stage');
    this.$fab = this.$container.querySelector('#btn-fab-more');
    this.$logPanel = this.$container.querySelector('#log-panel');
    this._logTab = 'all';

    this.$container.querySelector('#btn-more').onclick = (e) => {
      e.stopPropagation();
      this.toggleMenu(this.$container.querySelector('#btn-more'));
    };
    this.$fab.onclick = (e) => {
      e.stopPropagation();
      // show footer menu anchored via fab — temporarily show footer menu near fab
      this.prefs.hideFooter = false;
      this.applyFooterVisibility();
      this.toggleMenu(this.$fab);
    };
    this.$container.querySelector('#btn-logs').onclick = (e) => {
      e.stopPropagation();
      this.toggleLogPanel();
    };
    this.$container.querySelector('#btn-logs-close').onclick = () => {
      this.$logPanel.hidden = true;
    };
    this.$container.querySelectorAll('.flutter-log-tab').forEach((tab) => {
      tab.onclick = () => {
        this.$container.querySelectorAll('.flutter-log-tab').forEach((t) => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        this._logTab = tab.getAttribute('data-tab');
        this._renderLogPanelIfOpen();
      };
    });

    this.$container.addEventListener('click', () => this.closeMenu());

    this._buildMenu();
    this.applyDeviceChrome();
    this.applyFooterVisibility();
    this.setStatus(`Starting… ${this.baseUrl}`, 'info');

    if (this.prefs.rotateIcon) this._startIconPulse();

    this._autoStart(projectPath, this.port, this.baseUrl, this.$frame, null, this.$status);
  }

  /** Temporary status in footer text (not an editable URL). */
  setStatus(msg, level = 'info', sticky = false) {
    if (this.$status) this.$status.textContent = msg;
    this._pushLog(level, msg);
    if (this._statusTimer) clearTimeout(this._statusTimer);
    if (!sticky && level !== 'error') {
      this._statusTimer = setTimeout(() => {
        if (this.$status) {
          this.$status.textContent = `Preview live — ${this.baseUrl}`;
        }
      }, 5000);
    }
  }

  reloadFrame() {
    const u = this.baseUrl;
    if (this.$frame) this.$frame.src = u;
    this.setStatus(`Reloading ${u}…`, 'info');
  }

  toggleLogPanel() {
    if (!this.$logPanel) return;
    this.$logPanel.hidden = !this.$logPanel.hidden;
    if (!this.$logPanel.hidden) this._renderLogPanelIfOpen();
  }

  _renderLogPanelIfOpen() {
    if (!this.$logPanel || this.$logPanel.hidden) return;
    const body = this.$container.querySelector('#log-panel-body');
    if (!body) return;
    const rows = this.logs.filter((e) => {
      if (this._logTab === 'all') return true;
      if (this._logTab === 'error') return e.level === 'error';
      return e.level === 'info' || e.level === 'warn';
    });
    body.innerHTML = rows.length
      ? rows
          .slice()
          .reverse()
          .map(
            (e) =>
              `<div class="flutter-log-line level-${e.level}"><span class="t">${e.t}</span> ${this._esc(e.text)}</div>`
          )
          .join('')
      : `<div class="flutter-log-line">No entries yet.</div>`;
  }

  _esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  toggleMenu(anchor) {
    if (!this.$menu) return;
    if (this.$menu.hidden) {
      this._buildMenu();
      this.$menu.hidden = false;
    } else {
      this.$menu.hidden = true;
    }
  }

  closeMenu() {
    if (this.$menu) this.$menu.hidden = true;
  }

  _buildMenu() {
    if (!this.$menu) return;
    const p = this.prefs;
    const item = (action, label, hint = '', checked = null) => {
      const check =
        checked === null
          ? ''
          : `<span class="flutter-menu-check">${checked ? '✓' : ''}</span>`;
      return `<button type="button" class="flutter-menu-item" data-action="${action}">
        <span class="flutter-menu-label">${label}</span>
        ${hint ? `<span class="flutter-menu-hint">${hint}</span>` : ''}
        ${check}
      </button>`;
    };

    const preset = DEVICE_PRESETS.find((d) => d.id === p.deviceId);
    this.$menu.innerHTML = `
      <div class="flutter-menu-section">Preview</div>
      ${item('reload', 'Refresh preview')}
      ${item('restart', 'Restart web-server')}
      <div class="flutter-menu-sep"></div>
      <div class="flutter-menu-section">Device</div>
      ${item('device_picker', 'Device frame', preset ? preset.name : 'Responsive')}
      ${item('custom_size', 'Custom width × height', p.width && p.height ? `${p.width}×${p.height}` : '—')}
      ${item('orientation', 'Orientation', p.orientation === 'landscape' ? 'Landscape' : 'Portrait')}
      ${item('scale', 'Zoom / scale', p.scale + '%')}
      <div class="flutter-menu-sep"></div>
      <div class="flutter-menu-section">Display</div>
      ${item('chrome', 'Device chrome (notch)', '', p.showDeviceChrome)}
      ${item('footer', 'Status bar', '', !p.hideFooter)}
      ${item('icon_spin', 'Icon spin every 60s', '', p.rotateIcon)}
      <div class="flutter-menu-sep"></div>
      <div class="flutter-menu-section">Server</div>
      ${item('port', 'Web port', this.port)}
      ${item('open_ext', 'Open URL externally')}
      <div class="flutter-menu-sep"></div>
      ${item('logs', 'Open logs panel')}
      ${item('reset', 'Reset preview settings')}
    `;

    this.$menu.onclick = (e) => {
      e.stopPropagation();
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      this.closeMenu();
      this._onMenuAction(btn.getAttribute('data-action'));
    };
  }

  _onMenuAction(action) {
    switch (action) {
      case 'reload':
        this.reloadFrame();
        break;
      case 'logs':
        this.$logPanel.hidden = false;
        this._renderLogPanelIfOpen();
        break;
      case 'device_picker':
        this._modalDevicePicker();
        break;
      case 'custom_size':
        this._modalCustomSize();
        break;
      case 'orientation':
        this.prefs.orientation =
          this.prefs.orientation === 'portrait' ? 'landscape' : 'portrait';
        this._savePrefs();
        this.applyDeviceChrome();
        this.setStatus(`Orientation: ${this.prefs.orientation}`);
        break;
      case 'scale':
        this._modalScale();
        break;
      case 'chrome':
        this.prefs.showDeviceChrome = !this.prefs.showDeviceChrome;
        this._savePrefs();
        this.applyDeviceChrome();
        break;
      case 'footer':
        this.prefs.hideFooter = !this.prefs.hideFooter;
        this._savePrefs();
        this.applyFooterVisibility();
        this.setStatus(this.prefs.hideFooter ? 'Status bar hidden' : 'Status bar visible');
        break;
      case 'icon_spin':
        this.prefs.rotateIcon = !this.prefs.rotateIcon;
        this._savePrefs();
        if (this.prefs.rotateIcon) this._startIconPulse();
        else if (this._iconTimer) {
          clearInterval(this._iconTimer);
          this._iconTimer = null;
        }
        break;
      case 'port':
        this._modalPort();
        break;
      case 'restart':
        this._started = false;
        this.setStatus('Restarting web-server…', 'info', true);
        this._autoStart(this.projectPath, this.port, this.baseUrl, this.$frame, null, this.$status);
        break;
      case 'open_ext':
        try {
          const u = this.baseUrl;
          const system = acode.require('system');
          if (system?.openInBrowser) system.openInBrowser(u);
          else window.open(u, '_blank');
        } catch (_) {
          this.setStatus('Could not open externally', 'error', true);
        }
        break;
      case 'reset':
        this.prefs = {
          deviceId: 'responsive',
          width: 0,
          height: 0,
          scale: 100,
          orientation: 'portrait',
          showDeviceChrome: true,
          hideFooter: false,
          rotateIcon: true,
        };
        this._savePrefs();
        this.applyDeviceChrome();
        this.applyFooterVisibility();
        this._startIconPulse();
        this.setStatus('Preview settings reset');
        break;
      default:
        break;
    }
  }

  applyFooterVisibility() {
    if (!this.$footer || !this.$fab) return;
    if (this.prefs.hideFooter) {
      this.$footer.style.display = 'none';
      this.$fab.hidden = false;
      this.closeMenu();
    } else {
      this.$footer.style.display = '';
      this.$fab.hidden = true;
    }
  }

  applyDeviceChrome() {
    if (!this.$shell || !this.$frame || !this.$stage) return;
    let w = this.prefs.width;
    let h = this.prefs.height;
    const preset = DEVICE_PRESETS.find((d) => d.id === this.prefs.deviceId);

    if (this.prefs.deviceId === 'responsive' || (!w && !h && preset?.w === 0)) {
      this.$stage.classList.remove('is-framed');
      this.$shell.classList.remove('has-chrome');
      this.$shell.style.width = '';
      this.$shell.style.height = '';
      this.$shell.style.transform = '';
      this.$frame.style.width = '100%';
      this.$frame.style.height = '100%';
      return;
    }

    if (preset && preset.w > 0 && this.prefs.deviceId !== 'custom') {
      w = preset.w;
      h = preset.h;
      this.prefs.width = w;
      this.prefs.height = h;
    }

    if (this.prefs.orientation === 'landscape' && w && h && w < h) {
      const t = w;
      w = h;
      h = t;
    } else if (this.prefs.orientation === 'portrait' && w && h && w > h) {
      const t = w;
      w = h;
      h = t;
    }

    const scale = Math.max(40, Math.min(150, this.prefs.scale || 100)) / 100;
    this.$stage.classList.add('is-framed');
    this.$shell.classList.toggle('has-chrome', !!this.prefs.showDeviceChrome);
    this.$shell.style.width = w ? w + 'px' : '100%';
    this.$shell.style.height = h ? h + 'px' : '100%';
    this.$shell.style.transform = `scale(${scale})`;
    this.$frame.style.width = '100%';
    this.$frame.style.height = '100%';
  }

  _openModal(title, bodyHtml, onSave) {
    const root = this.$modalRoot;
    if (!root) return;
    root.hidden = false;
    root.innerHTML = `
      <div class="flutter-modal-backdrop" data-close="1"></div>
      <div class="flutter-modal-card" role="dialog">
        <div class="flutter-modal-title">${title}</div>
        <div class="flutter-modal-body">${bodyHtml}</div>
        <div class="flutter-modal-actions">
          <button type="button" class="flutter-btn flutter-btn-secondary" data-close="1">Cancel</button>
          <button type="button" class="flutter-btn" id="modal-save">Apply</button>
        </div>
      </div>
    `;
    const close = () => {
      root.hidden = true;
      root.innerHTML = '';
    };
    root.querySelectorAll('[data-close]').forEach((el) => {
      el.onclick = close;
    });
    root.querySelector('#modal-save').onclick = () => {
      if (onSave) onSave(root);
      close();
    };
  }

  _modalDevicePicker() {
    const options = DEVICE_PRESETS.map(
      (d) =>
        `<label class="flutter-radio-row">
          <input type="radio" name="dev" value="${d.id}" ${
          this.prefs.deviceId === d.id ? 'checked' : ''
        }/>
          <span>${d.name}${d.w > 0 ? ` <small>${d.w}×${d.h}</small>` : ''}</span>
        </label>`
    ).join('');
    this._openModal('Device frame', options, (root) => {
      const sel = root.querySelector('input[name="dev"]:checked');
      if (!sel) return;
      const id = sel.value;
      this.prefs.deviceId = id;
      const preset = DEVICE_PRESETS.find((d) => d.id === id);
      if (preset && preset.w > 0) {
        this.prefs.width = preset.w;
        this.prefs.height = preset.h;
      } else if (id === 'responsive') {
        this.prefs.width = 0;
        this.prefs.height = 0;
      } else if (id === 'custom') {
        this._savePrefs();
        this._modalCustomSize();
        return;
      }
      this._savePrefs();
      this.applyDeviceChrome();
      this.setStatus(preset?.name || 'Device updated');
    });
  }

  _modalCustomSize() {
    this._openModal(
      'Custom size',
      `<label class="flutter-label">Width (px)</label>
       <input class="flutter-input" id="m-w" type="number" min="200" max="4000" value="${
         this.prefs.width || 390
       }" />
       <label class="flutter-label" style="margin-top:10px">Height (px)</label>
       <input class="flutter-input" id="m-h" type="number" min="200" max="4000" value="${
         this.prefs.height || 844
       }" />`,
      (root) => {
        const w = parseInt(root.querySelector('#m-w').value, 10);
        const h = parseInt(root.querySelector('#m-h').value, 10);
        if (!w || !h) {
          this.setStatus('Enter valid width & height', 'error');
          return;
        }
        this.prefs.deviceId = 'custom';
        this.prefs.width = w;
        this.prefs.height = h;
        this._savePrefs();
        this.applyDeviceChrome();
        this.setStatus(`Size ${w}×${h}`);
      }
    );
  }

  _modalScale() {
    this._openModal(
      'Zoom / scale',
      `<label class="flutter-label">Scale (%): <span id="m-sc-val">${this.prefs.scale}</span></label>
       <input class="flutter-range" id="m-sc" type="range" min="40" max="150" step="5" value="${this.prefs.scale}" />
       <p class="flutter-hint">Only applies when a fixed device frame is selected.</p>`,
      (root) => {
        const v = parseInt(root.querySelector('#m-sc').value, 10) || 100;
        this.prefs.scale = v;
        this._savePrefs();
        this.applyDeviceChrome();
        this.setStatus(`Scale ${v}%`);
      }
    );
    const root = this.$modalRoot;
    const range = root.querySelector('#m-sc');
    const val = root.querySelector('#m-sc-val');
    if (range && val) range.oninput = () => (val.textContent = range.value);
  }

  _modalPort() {
    this._openModal(
      'Web server port',
      `<label class="flutter-label">Port</label>
       <input class="flutter-input" id="m-port" type="number" min="1024" max="65535" value="${this.port}" />
       <p class="flutter-hint">Saved for next preview. Use Restart after changing.</p>`,
      (root) => {
        const port = String(root.querySelector('#m-port').value || '8080');
        this.port = port;
        this.baseUrl = `http://127.0.0.1:${port}`;
        saveFlutterSetting('flutterWebPort', port);
        this.setStatus(`Port ${port} saved — Restart server`);
      }
    );
  }

  _startIconPulse() {
    const icon = this.$container?.querySelector('#preview-flutter-icon');
    if (!icon) return;
    if (this._iconTimer) clearInterval(this._iconTimer);

    const spinOnce = () => {
      icon.classList.remove('is-spinning');
      void icon.offsetWidth;
      icon.classList.add('is-spinning');
      const onEnd = () => {
        icon.classList.remove('is-spinning');
        icon.removeEventListener('animationend', onEnd);
      };
      icon.addEventListener('animationend', onEnd);
    };

    setTimeout(spinOnce, 1200);
    this._iconTimer = setInterval(spinOnce, 60000);
  }

  _shellProjectRoot(projectPath) {
    let shellRoot = projectPath || '';
    if (shellRoot.startsWith('file://')) shellRoot = shellRoot.replace('file://', '');
    if (shellRoot.includes('content://')) return '';
    return shellRoot;
  }

  async _ensureDartReady(flutterBin, footerEl) {
    this.setStatus('Checking Dart SDK cache…', 'info', true);
    try {
      const check = await executeCommand(
        `sh -c 'FB=$(eval echo ${JSON.stringify(flutterBin)}); ` +
          `if [ -x "$FB" ] || [ -f "$FB" ]; then ` +
          `  ROOT=$(dirname "$(dirname "$FB")"); ` +
          `  if [ -x "$ROOT/bin/cache/dart-sdk/bin/dart" ]; then echo DART_OK; else echo DART_MISS; fi; ` +
          `else echo NO_FLUTTER; fi'`,
        true
      );
      const out = (check || '').toString();
      if (out.includes('DART_OK')) return true;
      if (out.includes('NO_FLUTTER')) {
        this.setStatus('Flutter binary not found — open Flutter Setup', 'error', true);
        return false;
      }
    } catch (_) {}

    this.setStatus('Downloading Dart SDK automatically (~250MB)…', 'info', true);
    try {
      await writeShared(
        `export PATH="$(dirname $(eval echo ${JSON.stringify(flutterBin)})):$PATH"; ` +
          `eval echo ${JSON.stringify(flutterBin)} | xargs -I{} sh -c '{} --version'; {} precache --web'\r`
      );
      for (let i = 0; i < 90; i++) {
        await new Promise((r) => setTimeout(r, 4000));
        try {
          const again = await executeCommand(
            `sh -c 'FB=$(eval echo ${JSON.stringify(flutterBin)}); ROOT=$(dirname "$(dirname "$FB")"); ` +
              `if [ -x "$ROOT/bin/cache/dart-sdk/bin/dart" ]; then echo DART_OK; else echo WAIT; fi'`,
            true
          );
          if ((again || '').includes('DART_OK')) {
            this.setStatus('Dart SDK ready');
            return true;
          }
          this.setStatus(`Downloading Dart SDK… (${i + 1}/90)`, 'info', true);
        } catch (_) {}
      }
    } catch (e) {
      this.setStatus('Dart SDK download issue: ' + (e.message || e), 'error', true);
    }
    return false;
  }

  async _waitForPort(port, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const out = await executeCommand(
          `sh -c 'command -v nc >/dev/null && nc -z 127.0.0.1 ${port} && echo UP || ` +
            `(command -v wget >/dev/null && wget -q -O /dev/null --timeout=1 http://127.0.0.1:${port}/ && echo UP) || ` +
            `(command -v curl >/dev/null && curl -s -o /dev/null --max-time 1 http://127.0.0.1:${port}/ && echo UP) || echo DOWN'`,
          true
        );
        if ((out || '').includes('UP')) return true;
      } catch (_) {}
      this.setStatus(`Waiting for web-server :${port}… (${i + 1}/${maxAttempts})`, 'info', true);
      await new Promise((r) => setTimeout(r, 3000));
    }
    return false;
  }

  async _autoStart(projectPath, port, url, frame, _urlInput, _footerEl) {
    if (this._started) return;
    this._started = true;

    try {
      const flutterBin = await getFlutterBinPath();
      this.setStatus(`Using ${flutterBin}`, 'info', true);

      const dartOk = await this._ensureDartReady(flutterBin);
      if (!dartOk) {
        this.setStatus('Dart SDK not ready — ⋮ → Restart', 'error', true);
        this._started = false;
        return;
      }

      const shellRoot = this._shellProjectRoot(projectPath);
      this.setStatus('Starting flutter web-server…', 'info', true);

      try {
        await executeCommand(
          `sh -c 'fuser -k ${port}/tcp 2>/dev/null; pkill -f "flutter run.*web-server" 2>/dev/null; true'`,
          true
        );
      } catch (_) {}

      const cdPart = shellRoot
        ? `cd ${JSON.stringify(shellRoot)} 2>/dev/null || cd "$(eval echo ${JSON.stringify(shellRoot)})" 2>/dev/null || true; `
        : '';

      const launch =
        `export PATH="$(dirname $(eval echo ${JSON.stringify(flutterBin)})):$PATH"; ` +
        cdPart +
        `FB=$(eval echo ${JSON.stringify(flutterBin)}); ` +
        `echo "Flutter: $FB"; ` +
        `$FB pub get; ` +
        `$FB run -d web-server --web-hostname=127.0.0.1 --web-port=${port}`;

      try {
        await writeShared('\x03');
      } catch (_) {}
      await writeShared(launch + '\r');

      this.setStatus('Web-server launching…', 'info', true);

      const up = await this._waitForPort(port);
      if (up) {
        if (frame) frame.src = url;
        this.setStatus(`Preview live — ${url}`);
      } else {
        if (frame) frame.src = url;
        this.setStatus(`Still compiling — try ⋮ Refresh · ${url}`, 'warn', true);
      }
    } catch (e) {
      this.setStatus('Auto preview failed: ' + (e.message || e), 'error', true);
      this._started = false;
    }
  }
}
