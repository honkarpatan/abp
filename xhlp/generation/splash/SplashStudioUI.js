import { pageStyles } from '../../styles/styles.js';
import { assets } from '../../assets/assets.js';
import { createFolder, createFile, writeBinaryFile } from '../../operations/fileOperations.js';
import { findLauncherIconUrl } from '../icon/loadProjectIcon.js';

/**
 * Splash Screen Studio — Android 12+ SplashScreen API + legacy windowBackground.
 * Path-aware writes under app/src/main/res + gradle + optional MainActivity hook.
 */
export class SplashStudioUI {
  constructor() {
    this.tabId = 'android.splash.studio';
    this.editorFile = null;
    this.projectRoot = '';
    this._logoImg = null;
    this._opts = {
      bgLight: '#FFFFFF',
      bgDark: '#121212',
      useGradient: false,
      gradFrom: '#1A237E',
      gradTo: '#4FC3F7',
      gradAngle: 160,
      iconBg: '#3DDC84',
      iconBgTransparent: false,
      logoScale: 100,
      logoPadding: 18,
      durationMs: 2000,
      exitAnim: 'fade', // fade | none
      previewDark: false,
      writeCode: true,
      writeGradle: true,
    };
    this._warnings = [];
  }

  resolveProjectRoot(path) {
    const parts = String(path || '').split('/');
    const srcIndex = parts.indexOf('src');
    if (srcIndex !== -1) return parts.slice(0, srcIndex).join('/');
    return String(path).substring(0, String(path).lastIndexOf('/'));
  }

  /** Prefer module with res/; try …/app */
  async resolveModuleRoot(start) {
    const fs = acode.require('fs') || acode.require('fsOperation');
    const base = String(start || '').replace(/\/+$/, '');
    const candidates = [base];
    if (/\/app$/i.test(base)) candidates.push(base.replace(/\/app$/i, ''));
    else candidates.push(`${base}/app`);
    for (const c of candidates) {
      try {
        if (await fs(`${c}/src/main`).exists()) return c;
      } catch (_) {}
    }
    return base;
  }

  async show(currentFilePath) {
    this.projectRoot = await this.resolveModuleRoot(
      this.resolveProjectRoot(currentFilePath)
    );
    const EditorFile = acode.require('editorFile');
    const $c = document.createElement('div');
    $c.className = 'andro-build-page splash-studio-page';
    this._$ = $c;

    $c.innerHTML = `
      <div class="andro-build-header-sec">
        <div class="build-app-name">
          <span class="icon android"></span>
          <span>Splash Studio</span>
        </div>
      </div>
      <div class="andro-build-body">
        <div class="build-main-status" style="font-size:1.1rem;">Splash Screen</div>
        <div class="build-sub-status">Android 12+ API · themes · live preview<br>
          <code style="font-size:0.72rem;opacity:0.75;">${this._escape(this.projectRoot)}</code>
        </div>

        <div class="icon-config-card splash-studio-card">
          <!-- sticky live preview -->
          <div class="splash-live-sticky">
            <div class="splash-phone" id="splash-phone">
              <div class="splash-phone-notch"></div>
              <canvas id="splash-canvas" width="auto" height="480"></canvas>
              <div class="splash-phone-label" id="splash-mode-label">Light preview</div>
            </div>
            <div class="splash-preview-actions">
              <button type="button" class="icon-shape-btn" id="btn-prev-light">Light</button>
              <button type="button" class="icon-shape-btn" id="btn-prev-dark">Dark</button>
              <button type="button" class="icon-shape-btn" id="btn-prev-play">▶ Play</button>
            </div>
          </div>

          <div class="card-divider"></div>

          <label class="config-label">Logo</label>
          <div class="icon-source-actions">
            <button type="button" class="icon-src-btn" id="btn-logo-local">Local file</button>
            <button type="button" class="icon-src-btn" id="btn-logo-launcher">Use app icon</button>
          </div>
          <input type="file" id="splash-file" accept="image/*" style="display:none;">
          <div id="splash-logo-meta" class="icon-meta-info" style="display:none;">
            <span id="splash-logo-name" class="meta-tag meta-dim">—</span>
          </div>

          <div class="card-divider"></div>

          <div class="icon-ctrl-grid">
            <label class="icon-ctrl">
              <span>Logo size <b id="sp-val-scale">100%</b></span>
              <input type="range" id="sp-scale" min="40" max="140" value="100">
            </label>
            <label class="icon-ctrl">
              <span>Padding <b id="sp-val-pad">18%</b></span>
              <input type="range" id="sp-pad" min="0" max="40" value="18">
            </label>
          </div>

          <label class="config-label">Background (light)</label>
          <div class="icon-bg-row">
            <input type="color" id="sp-bg-light" value="#FFFFFF">
            <input type="text" id="sp-bg-light-hex" class="andro-input" value="#FFFFFF" style="width:96px;font-family:monospace;">
          </div>
          <label class="config-label">Background (dark)</label>
          <div class="icon-bg-row">
            <input type="color" id="sp-bg-dark" value="#121212">
            <input type="text" id="sp-bg-dark-hex" class="andro-input" value="#121212" style="width:96px;font-family:monospace;">
          </div>

          <label class="icon-check" style="display:flex;gap:8px;align-items:center;margin:10px 0;font-size:0.82rem;">
            <input type="checkbox" id="sp-grad"> Gradient background (light)
          </label>
          <div id="sp-grad-fields" style="display:none;">
            <div class="icon-bg-row">
              <input type="color" id="sp-grad-from" value="#1A237E">
              <span style="opacity:0.6;font-size:0.75rem;">→</span>
              <input type="color" id="sp-grad-to" value="#4FC3F7">
              <label class="icon-ctrl" style="flex:1;margin:0;">
                <span>Angle <b id="sp-val-angle">160°</b></span>
                <input type="range" id="sp-grad-angle" min="0" max="360" value="160">
              </label>
            </div>
          </div>

          <label class="config-label">Android 12+ icon background</label>
          <div class="icon-bg-row">
            <input type="color" id="sp-icon-bg" value="#3DDC84">
            <input type="text" id="sp-icon-bg-hex" class="andro-input" value="#3DDC84" style="width:96px;font-family:monospace;">
            <label class="icon-check" style="display:flex;gap:6px;align-items:center;font-size:0.8rem;">
              <input type="checkbox" id="sp-icon-bg-clear"> Transparent
            </label>
          </div>

          <label class="config-label">Duration</label>
          <label class="icon-ctrl">
            <span><b id="sp-val-dur">2.0s</b> keep splash visible</span>
            <input type="range" id="sp-dur" min="500" max="5000" step="100" value="2000">
          </label>

          <label class="config-label">Exit animation</label>
          <div class="icon-shape-row">
            <button type="button" class="icon-shape-btn active" data-exit="fade">Fade out</button>
            <button type="button" class="icon-shape-btn" data-exit="none">None</button>
          </div>

          <label class="icon-check" style="display:flex;gap:8px;align-items:center;margin:8px 0;font-size:0.82rem;">
            <input type="checkbox" id="sp-gradle" checked>
            Add <code>androidx.core:core-splashscreen</code> to gradle
          </label>
          <label class="icon-check" style="display:flex;gap:8px;align-items:center;margin:8px 0;font-size:0.82rem;">
            <input type="checkbox" id="sp-code" checked>
            Inject <code>installSplashScreen()</code> into MainActivity
          </label>

          <div id="splash-warnings" class="splash-warnings" style="display:none;"></div>
          <div id="splash-progress" class="gen-progress-wrapper" style="display:none;">
            <div class="gen-progress-track"><div id="splash-bar" class="gen-progress-bar"></div></div>
            <div id="splash-status" class="gen-status-text"></div>
          </div>
        </div>

        <div class="config-actions" style="margin-top:20px;">
          <button class="btn-build-cancel" id="btn-cancel">Close</button>
          <button class="btn-build-start" id="btn-apply" style="background:#26C6DA;color:#000;">Apply Splash</button>
        </div>
      </div>
    `;

    const existing = acode.require('openFolder').find(this.tabId);
    if (existing) existing.remove();

    this.editorFile = new EditorFile('Splash Studio', {
      type: 'page',
      content: $c,
      id: this.tabId,
      tabIcon: 'icon aid-gradle-icon',
      stylesheets: [pageStyles],
    });

    this._bind($c);
    this._paint();
    this._loadDefaultLogo();
    this._runPathChecks();
  }

  _escape(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  async _runPathChecks() {
    const fs = acode.require('fs') || acode.require('fsOperation');
    const w = [];
    try {
      if (!(await fs(`${this.projectRoot}/src/main`).exists())) {
        w.push('src/main not found under module — path may be wrong.');
      }
    } catch (_) {
      w.push('Cannot access project filesystem.');
    }
    try {
      const g1 = `${this.projectRoot}/build.gradle`;
      const g2 = `${this.projectRoot}/build.gradle.kts`;
      const ok = (await fs(g1).exists()) || (await fs(g2).exists());
      if (!ok) w.push('app/build.gradle not found — gradle dependency step will be skipped.');
    } catch (_) {}
    this._setWarnings(w);
  }

  _setWarnings(list) {
    this._warnings = list || [];
    const box = this._$?.querySelector('#splash-warnings');
    if (!box) return;
    if (!this._warnings.length) {
      box.style.display = 'none';
      box.innerHTML = '';
      return;
    }
    box.style.display = 'block';
    box.innerHTML =
      '<strong>⚠️ Warnings</strong><ul style="margin:6px 0 0;padding-left:18px;">' +
      this._warnings.map((x) => `<li>${this._escape(x)}</li>`).join('') +
      '</ul>';
  }

  _bind($c) {
    const fileInput = $c.querySelector('#splash-file');
    $c.querySelector('#btn-logo-local').onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        this._logoImg = img;
        const meta = $c.querySelector('#splash-logo-meta');
        const name = $c.querySelector('#splash-logo-name');
        if (meta) meta.style.display = 'block';
        if (name) name.textContent = `${f.name} · ${img.width}×${img.height}`;
        this._paint();
      };
      img.src = url;
    };
    $c.querySelector('#btn-logo-launcher').onclick = () => this._loadDefaultLogo();

    const bindRange = (id, key, lab, fmt) => {
      const el = $c.querySelector(id);
      const lb = $c.querySelector(lab);
      el.oninput = () => {
        this._opts[key] = Number(el.value);
        if (lb) lb.textContent = fmt(this._opts[key]);
        this._paint();
      };
    };
    bindRange('#sp-scale', 'logoScale', '#sp-val-scale', (v) => v + '%');
    bindRange('#sp-pad', 'logoPadding', '#sp-val-pad', (v) => v + '%');
    bindRange('#sp-dur', 'durationMs', '#sp-val-dur', (v) => (v / 1000).toFixed(1) + 's');
    bindRange('#sp-grad-angle', 'gradAngle', '#sp-val-angle', (v) => v + '°');

    const pair = (colorId, hexId, key) => {
      const c = $c.querySelector(colorId);
      const h = $c.querySelector(hexId);
      c.oninput = () => {
        this._opts[key] = c.value;
        h.value = c.value;
        this._paint();
      };
      h.onchange = () => {
        let v = h.value.trim();
        if (!v.startsWith('#')) v = '#' + v;
        if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
          this._opts[key] = v;
          c.value = v;
          this._paint();
        }
      };
    };
    pair('#sp-bg-light', '#sp-bg-light-hex', 'bgLight');
    pair('#sp-bg-dark', '#sp-bg-dark-hex', 'bgDark');
    pair('#sp-icon-bg', '#sp-icon-bg-hex', 'iconBg');
    const iconClear = $c.querySelector('#sp-icon-bg-clear');
    if (iconClear) {
      iconClear.onchange = () => {
        this._opts.iconBgTransparent = !!iconClear.checked;
        const c = $c.querySelector('#sp-icon-bg');
        const h = $c.querySelector('#sp-icon-bg-hex');
        if (c) c.disabled = iconClear.checked;
        if (h) h.disabled = iconClear.checked;
        this._paint();
      };
    }
    $c.querySelector('#sp-grad-from').oninput = (e) => {
      this._opts.gradFrom = e.target.value;
      this._paint();
    };
    $c.querySelector('#sp-grad-to').oninput = (e) => {
      this._opts.gradTo = e.target.value;
      this._paint();
    };

    const gradCb = $c.querySelector('#sp-grad');
    gradCb.onchange = () => {
      this._opts.useGradient = !!gradCb.checked;
      $c.querySelector('#sp-grad-fields').style.display = gradCb.checked ? 'block' : 'none';
      this._paint();
    };

    $c.querySelector('#btn-prev-light').onclick = () => {
      this._opts.previewDark = false;
      $c.querySelector('#splash-mode-label').textContent = 'Light preview';
      this._paint();
    };
    $c.querySelector('#btn-prev-dark').onclick = () => {
      this._opts.previewDark = true;
      $c.querySelector('#splash-mode-label').textContent = 'Dark preview';
      this._paint();
    };
    $c.querySelector('#btn-prev-play').onclick = () => this._playPreview();

    $c.querySelectorAll('[data-exit]').forEach((btn) => {
      btn.onclick = () => {
        $c.querySelectorAll('[data-exit]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this._opts.exitAnim = btn.getAttribute('data-exit') || 'fade';
      };
    });

    $c.querySelector('#sp-gradle').onchange = (e) => {
      this._opts.writeGradle = !!e.target.checked;
    };
    $c.querySelector('#sp-code').onchange = (e) => {
      this._opts.writeCode = !!e.target.checked;
    };

    $c.querySelector('#btn-cancel').onclick = () => this.editorFile.remove();
    $c.querySelector('#btn-apply').onclick = () => this._apply();
  }

  async _loadDefaultLogo() {
    try {
      const hit = await findLauncherIconUrl(this.projectRoot);
      if (!hit?.dataUrl) {
        window.toast('No app icon found — pick a local logo', 2500);
        return;
      }
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = hit.dataUrl;
      });
      this._logoImg = img;
      const meta = this._$?.querySelector('#splash-logo-meta');
      const name = this._$?.querySelector('#splash-logo-name');
      if (meta) meta.style.display = 'block';
      if (name) name.textContent = `App icon · ${img.width}×${img.height}`;
      this._paint();
    } catch (e) {
      console.warn(e);
    }
  }

  _paint() {
    const canvas = this._$?.querySelector('#splash-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const dark = this._opts.previewDark;
    if (!dark && this._opts.useGradient) {
      const ang = ((this._opts.gradAngle || 0) * Math.PI) / 180;
      const x2 = w / 2 + Math.cos(ang) * w;
      const y2 = h / 2 + Math.sin(ang) * h;
      const g = ctx.createLinearGradient(w / 2, h / 2, x2, y2);
      g.addColorStop(0, this._opts.gradFrom);
      g.addColorStop(1, this._opts.gradTo);
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = dark ? this._opts.bgDark : this._opts.bgLight;
    }
    ctx.fillRect(0, 0, w, h);

    // Android 12 style icon circle (optional solid brand disc)
    const cx = w / 2;
    const cy = h * 0.42;
    const R = Math.min(w, h) * 0.16;
    if (!this._opts.iconBgTransparent) {
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.15, 0, Math.PI * 2);
      ctx.fillStyle = this._opts.iconBg;
      ctx.fill();
    }

    if (this._logoImg) {
      const pad = (this._opts.logoPadding / 100) * R * 2;
      const scale = this._opts.logoScale / 100;
      const box = (R * 2 - pad) * scale;
      const img = this._logoImg;
      let dw = box;
      let dh = box;
      if (img.width >= img.height) {
        dh = box * (img.height / img.width);
      } else {
        dw = box * (img.width / img.height);
      }
      ctx.save();
      if (!this._opts.iconBgTransparent) {
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.clip();
      }
      ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LOGO', cx, cy + 4);
    }
  }

  async _playPreview() {
    const phone = this._$?.querySelector('#splash-phone');
    if (!phone) return;
    phone.classList.remove('splash-exit-fade');
    void phone.offsetWidth;
    await new Promise((r) => setTimeout(r, Math.min(this._opts.durationMs, 2500)));
    if (this._opts.exitAnim === 'fade') {
      phone.classList.add('splash-exit-fade');
      await new Promise((r) => setTimeout(r, 450));
      phone.classList.remove('splash-exit-fade');
    }
    this._paint();
  }

  _progress(pct, msg) {
    const wrap = this._$?.querySelector('#splash-progress');
    const bar = this._$?.querySelector('#splash-bar');
    const st = this._$?.querySelector('#splash-status');
    if (wrap) wrap.style.display = 'block';
    if (bar) bar.style.width = `${pct}%`;
    if (st) st.textContent = msg || '';
  }

  async _apply() {
    const btn = this._$?.querySelector('#btn-apply');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Applying…';
    }
    const warnings = [...this._warnings];
    try {
      this._progress(5, 'Resolving paths…');
      const fs = acode.require('fs') || acode.require('fsOperation');
      const folderOpts = { overwrite: true };
      const fileOpts = { overwrite: true };

      const src = await createFolder(this.projectRoot, 'src', folderOpts);
      const main = await createFolder(src.url, 'main', folderOpts);
      const res = await createFolder(main.url, 'res', folderOpts);

      this._progress(15, 'Writing logo densities…');
      if (this._logoImg) {
        const dens = [
          { name: 'drawable-mdpi', size: 48 },
          { name: 'drawable-hdpi', size: 72 },
          { name: 'drawable-xhdpi', size: 96 },
          { name: 'drawable-xxhdpi', size: 144 },
          { name: 'drawable-xxxhdpi', size: 192 },
        ];
        for (const d of dens) {
          const folder = await createFolder(res.url, d.name, folderOpts);
          const buf = await this._logoPngBuffer(d.size);
          const wr = await writeBinaryFile(folder.url, 'ic_splash_logo.png', buf, { overwrite: true });
          if (!wr.success) throw new Error(wr.message || 'splash logo write failed');
        }
        const dr = await createFolder(res.url, 'drawable', folderOpts);
        {
          const wr = await writeBinaryFile(
            dr.url,
            'ic_splash_logo.png',
            await this._logoPngBuffer(192),
            { overwrite: true }
          );
          if (!wr.success) throw new Error(wr.message || 'splash logo write failed');
        }
      } else {
        warnings.push('No logo set — theme uses @mipmap/ic_launcher if present.');
      }

      this._progress(35, 'Writing colors & drawables…');
      const values = await createFolder(res.url, 'values', folderOpts);
      const valuesNight = await createFolder(res.url, 'values-night', folderOpts);
      const valuesV31 = await createFolder(res.url, 'values-v31', folderOpts);

      const colorsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="splash_background">${this._opts.bgLight}</color>
    <color name="splash_icon_background">${this._opts.iconBgTransparent ? '#00000000' : this._opts.iconBg}</color>
</resources>
`;
      const colorsNight = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="splash_background">${this._opts.bgDark}</color>
</resources>
`;
      await createFile(values.url, 'colors_splash.xml', colorsXml, fileOpts);
      await createFile(valuesNight.url, 'colors_splash.xml', colorsNight, fileOpts);

      const drawable = await createFolder(res.url, 'drawable', folderOpts);
      if (this._opts.useGradient) {
        const grad = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <gradient
        android:type="linear"
        android:angle="${Math.round(this._opts.gradAngle)}"
        android:startColor="${this._opts.gradFrom}"
        android:endColor="${this._opts.gradTo}" />
</shape>
`;
        await createFile(drawable.url, 'splash_background.xml', grad, fileOpts);
      } else {
        const solid = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <solid android:color="@color/splash_background" />
</shape>
`;
        await createFile(drawable.url, 'splash_background.xml', solid, fileOpts);
      }

      // Animated exit optional — keep simple layer for pre-12
      const brandLogo = this._logoImg
        ? '@drawable/ic_splash_logo'
        : '@mipmap/ic_launcher';

      this._progress(55, 'Writing themes (SplashScreen API)…');
      const themeSplash = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- Pre-31 + library attrs -->
    <style name="Theme.App.Starting" parent="Theme.SplashScreen">
        <item name="windowSplashScreenBackground">@drawable/splash_background</item>
        <item name="windowSplashScreenAnimatedIcon">${brandLogo}</item>
        <item name="windowSplashScreenAnimationDuration">${Math.min(1000, this._opts.durationMs)}</item>
        <item name="postSplashScreenTheme">@style/Theme.App</item>
    </style>
</resources>
`;
      await createFile(values.url, 'themes_splash.xml', themeSplash, fileOpts);

      const themeV31 = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.App.Starting" parent="Theme.SplashScreen">
        <item name="windowSplashScreenBackground">@drawable/splash_background</item>
        <item name="windowSplashScreenAnimatedIcon">${brandLogo}</item>
        <item name="windowSplashScreenAnimationDuration">${Math.min(1000, this._opts.durationMs)}</item>
        <item name="android:windowSplashScreenBackground">@drawable/splash_background</item>
        <item name="android:windowSplashScreenAnimatedIcon">${brandLogo}</item>
        <item name="android:windowSplashScreenIconBackgroundColor">@color/splash_icon_background</item>
        <item name="postSplashScreenTheme">@style/Theme.App</item>
    </style>
</resources>
`;
      await createFile(valuesV31.url, 'themes_splash.xml', themeV31, fileOpts);

      this._progress(70, 'Updating AndroidManifest theme…');
      await this._patchManifest(main.url, warnings);

      if (this._opts.writeGradle) {
        this._progress(80, 'Adding splashscreen dependency…');
        await this._patchGradle(warnings);
      }

      if (this._opts.writeCode) {
        this._progress(90, 'Injecting installSplashScreen()…');
        await this._patchMainActivity(warnings);
      }

      // Keep duration helper for optional custom delay
      const keep = `package placeholder;

// Duration configured in Splash Studio: ${this._opts.durationMs}ms, exit=${this._opts.exitAnim}
// Use SplashScreen.setKeepOnScreenCondition { … } if you need longer than system default.
`;
      void keep;

      this._progress(100, 'Done');
      this._setWarnings(warnings);
      if (warnings.length) {
        window.toast('Splash applied with warnings — see list', 4000);
      } else {
        window.toast('Splash screen applied', 3000);
      }
      setTimeout(() => this.editorFile?.remove(), 600);
    } catch (e) {
      console.error(e);
      warnings.push(String(e.message || e));
      this._setWarnings(warnings);
      window.alert('Splash apply failed: ' + (e.message || e));
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Apply Splash';
      }
    }
  }

  async _logoPngBuffer(size) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    if (!this._logoImg) {
      ctx.fillStyle = this._opts.iconBg;
      ctx.fillRect(0, 0, size, size);
    } else {
      const img = this._logoImg;
      const pad = (this._opts.logoPadding / 100) * size;
      const scale = this._opts.logoScale / 100;
      const box = (size - pad * 2) * scale;
      let dw = box;
      let dh = box;
      if (img.width >= img.height) dh = box * (img.height / img.width);
      else dw = box * (img.width / img.height);
      ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
    }
    return new Promise((resolve, reject) => {
      c.toBlob(async (blob) => {
        if (!blob) return reject(new Error('PNG encode failed'));
        resolve(await blob.arrayBuffer());
      }, 'image/png');
    });
  }

  async _patchManifest(mainUrl, warnings) {
    const fs = acode.require('fs') || acode.require('fsOperation');
    const path = `${mainUrl}/AndroidManifest.xml`;
    try {
      if (!(await fs(path).exists())) {
        warnings.push('AndroidManifest.xml missing — set android:theme manually to @style/Theme.App.Starting');
        return;
      }
      let xml = String(await fs(path).readFile('utf-8'));
      const before = xml;
      // application android:theme
      if (/android:theme\s*=\s*["'][^"']+["']/.test(xml)) {
        // Only change application-level theme if it's Theme.App or generic
        xml = xml.replace(
          /(<application\b[^>]*android:theme\s*=\s*["'])([^"']+)(["'])/,
          (m, a, theme, c) => {
            if (/Theme\.App\.Starting/i.test(theme)) return m;
            return `${a}Theme.App.Starting${c}`;
          }
        );
      } else if (/<application\b/.test(xml)) {
        xml = xml.replace(/<application\b/, '<application android:theme="@style/Theme.App.Starting"');
      }
      // Fix missing @style/
      xml = xml.replace(
        /android:theme\s*=\s*["']Theme\.App\.Starting["']/,
        'android:theme="@style/Theme.App.Starting"'
      );
      if (xml !== before) await fs(path).writeFile(xml);
      else warnings.push('Manifest theme unchanged — verify application android:theme="@style/Theme.App.Starting"');
    } catch (e) {
      warnings.push('Manifest patch failed: ' + (e.message || e));
    }
  }

  async _patchGradle(warnings) {
    const fs = acode.require('fs') || acode.require('fsOperation');
    const candidates = [
      `${this.projectRoot}/build.gradle`,
      `${this.projectRoot}/build.gradle.kts`,
    ];
    let path = null;
    for (const c of candidates) {
      try {
        if (await fs(c).exists()) {
          path = c;
          break;
        }
      } catch (_) {}
    }
    if (!path) {
      warnings.push('No app build.gradle — add implementation "androidx.core:core-splashscreen:2.0.1" yourself');
      return;
    }
    try {
      let text = String(await fs(path).readFile('utf-8'));
      if (/core-splashscreen/i.test(text)) return;
      const dep = path.endsWith('.kts')
        ? '    implementation("androidx.core:core-splashscreen:2.0.1")\n'
        : "    implementation 'androidx.core:core-splashscreen:2.0.1'\n";
      if (/dependencies\s*\{/.test(text)) {
        text = text.replace(/dependencies\s*\{/, (m) => m + '\n' + dep);
      } else {
        text += `\ndependencies {\n${dep}}\n`;
      }
      await fs(path).writeFile(text);
    } catch (e) {
      warnings.push('Gradle patch failed: ' + (e.message || e));
    }
  }

  async _patchMainActivity(warnings) {
    const fs = acode.require('fs') || acode.require('fsOperation');
    const javaRoot = `${this.projectRoot}/src/main/java`;
    const ktRoot = `${this.projectRoot}/src/main/kotlin`;
    const found = [];
    const walk = async (url, depth = 0) => {
      if (depth > 8 || found.length) return;
      let entries = [];
      try {
        entries = await fs(url).lsDir();
      } catch (_) {
        return;
      }
      for (const e of entries || []) {
        const name = e.name || '';
        if (/MainActivity\.(java|kt)$/i.test(name)) {
          found.push(e.url);
          return;
        }
        const isDir = e.isDirectory || e.isFolder || e.type === 'folder';
        if (isDir) await walk(e.url, depth + 1);
      }
    };
    try {
      if (await fs(javaRoot).exists()) await walk(javaRoot);
      if (!found.length && (await fs(ktRoot).exists())) await walk(ktRoot);
    } catch (_) {}

    if (!found.length) {
      warnings.push(
        'MainActivity not found — add: SplashScreen.installSplashScreen(this) before super.onCreate'
      );
      return;
    }

    const path = found[0];
    try {
      let code = String(await fs(path).readFile('utf-8'));
      if (/installSplashScreen/i.test(code)) return;

      const isKt = /\.kt$/i.test(path);
      if (isKt) {
        if (!/androidx\.core\.splashscreen\.SplashScreen/i.test(code)) {
          code = code.replace(
            /(package [^\n]+\n)/,
            '$1\nimport androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen\n'
          );
        }
        // install before super.onCreate
        if (/override\s+fun\s+onCreate\s*\([^\)]*\)\s*\{/.test(code)) {
          code = code.replace(
            /(override\s+fun\s+onCreate\s*\([^\)]*\)\s*\{)/,
            `$1\n        installSplashScreen()\n` +
              (this._opts.durationMs > 0
                ? `        // Splash Studio duration ${this._opts.durationMs}ms — use setKeepOnScreenCondition if needed\n`
                : '')
          );
        } else {
          warnings.push('Kotlin onCreate not matched — inject installSplashScreen() manually');
          return;
        }
      } else {
        if (!/androidx\.core\.splashscreen\.SplashScreen/i.test(code)) {
          code = code.replace(
            /(package [^\n]+;\n)/,
            '$1\nimport androidx.core.splashscreen.SplashScreen;\n'
          );
        }
        if (/void\s+onCreate\s*\(\s*Bundle/.test(code)) {
          code = code.replace(
            /(void\s+onCreate\s*\(\s*Bundle[^\)]*\)\s*\{)/,
            `$1\n        SplashScreen.installSplashScreen(this);\n`
          );
        } else {
          warnings.push('Java onCreate not matched — inject SplashScreen.installSplashScreen(this) manually');
          return;
        }
      }
      await fs(path).writeFile(code);
    } catch (e) {
      warnings.push('MainActivity patch failed: ' + (e.message || e));
    }
  }
}
