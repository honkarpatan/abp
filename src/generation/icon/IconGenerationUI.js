import { svgs } from '../../assets/icons/svg/svg.js';
import { pageStyles } from '../../styles/styles.js';
import { assets } from '../../assets/assets.js';
import { createFolder, createFile, writeBinaryFile } from '../../operations/fileOperations.js';
import { findLauncherIconUrl, notifyIconUpdated } from './loadProjectIcon.js';
import { SvgStudioUI } from '../svg/SvgStudioUI.js';

/**
 * Ultimate Android launcher icon studio:
 * live square + round previews, scale, padding, shape, bg color, offset.
 */
export class IconGenerationUI {
  constructor() {
    this.tabId = 'android.icon.gen';
    this.editorFile = null;
    this.projectRoot = '';
    this.selectedFile = null;
    this._sourceImg = null;
    this._opts = {
      scale: 100,
      padding: 10,
      shape: 'squircle',
      bgColor: '#3DDC84',
      bgTransparent: false,
      offsetX: 0,
      offsetY: 0,
      roundOnlyCircle: true,
      targetApp: true,
      targetSplash: false,
      targetNotify: false,
    };
  }

  async show(currentFilePath) {
    this.projectRoot = this.resolveProjectRoot(currentFilePath);
    const appDetails = await this.getAppDetails(this.projectRoot);
    const EditorFile = acode.require('editorFile');

    const $container = document.createElement('div');
    $container.className = 'andro-build-page';
    this._$ = $container;

    const imageIcon =
      svgs?.image ||
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
    const largeLogo = assets?.androidCamera || assets?.head || '';
    const packageDisplay = appDetails.packageName
      ? `<div class="package-id-text">Target: <span class="id-code">${appDetails.packageName}</span></div>`
      : '';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    fileInput.id = 'hidden-file-input';

    $container.innerHTML = `
      <div class="andro-build-header-sec">
        <div class="build-app-name">
          <img style="width:20px;" src="${assets.yellow || ''}" class="icon">
          <span>${appDetails.projectName || 'App'}</span>
        </div>
      </div>

      <div class="andro-build-body">
        <img src="${largeLogo}" class="camera-logo-large" style="max-height:48px;opacity:0.85;">
        <div class="build-main-status" style="font-size:1.15rem;">Icon Studio</div>
        <div class="build-sub-status">
          Live preview · mipmap densities · auto manifest
          ${packageDisplay}
        </div>

        <div class="icon-config-card icon-studio-card">
          <!-- Live previews -->
          <div class="icon-live-row icon-live-sticky">
            <div class="icon-live-item">
              <canvas id="prev-square" width="144" height="144" class="icon-live-canvas"></canvas>
              <div class="icon-live-label">Launcher</div>
            </div>
            <div class="icon-live-item">
              <canvas id="prev-round" width="144" height="144" class="icon-live-canvas icon-live-round-frame"></canvas>
              <div class="icon-live-label">Round</div>
            </div>
            <div class="icon-live-item icon-live-phone">
              <div class="icon-phone-mock">
                <canvas id="prev-home" width="72" height="72" class="icon-home-canvas"></canvas>
                <span class="icon-home-name">${(appDetails.projectName || 'App').slice(0, 10)}</span>
              </div>
              <div class="icon-live-label">Home</div>
            </div>
          </div>

          <div class="icon-target-list">
            <label class="icon-target-row">
              <div class="feature-checkbox-wrapper">
                <input type="checkbox" class="feature-main-cb" id="tgt-app" checked>
              </div>
              <span class="icon-target-text">
                <strong>App icon</strong>
                <small>mipmap ic_launcher / round</small>
              </span>
            </label>
            <label class="icon-target-row">
              <div class="feature-checkbox-wrapper">
                <input type="checkbox" class="feature-main-cb" id="tgt-splash">
              </div>
              <span class="icon-target-text">
                <strong>Splash screen</strong>
                <small>drawable/ic_splash.png</small>
              </span>
            </label>
            <label class="icon-target-row">
              <div class="feature-checkbox-wrapper">
                <input type="checkbox" class="feature-main-cb" id="tgt-notify">
              </div>
              <span class="icon-target-text">
                <strong>Notification icon</strong>
                <small>drawable/ic_notification.png (mono)</small>
              </span>
            </label>
          </div>

          <div class="card-divider"></div>

          <!-- Source -->
          <label class="config-label" style="margin-top:0;">Source</label>
          <div class="icon-source-actions">
            <button type="button" class="icon-src-btn" id="btn-pick-img">${imageIcon || ''} Local file</button>
            <button type="button" class="icon-src-btn icon-src-store" id="btn-icon-store">Icon Store</button>
            <button type="button" class="icon-src-btn" id="btn-svg-studio">SVG Studio</button>
          </div>
          <div class="input-row" style="margin-top:8px;">
            <input type="text" id="img-path" class="andro-input input-path-field" placeholder="No image selected" readonly>
          </div>
          <div id="meta-info" class="icon-meta-info">
            <span id="meta-dim" class="meta-tag meta-dim">0×0</span>
            <span id="meta-size" class="meta-tag meta-size">0 KB</span>
            <span id="meta-src" class="meta-tag meta-dim" style="display:none;"></span>
          </div>

          <!-- Icon Store panel -->
          <div id="icon-store-panel" class="icon-store-panel" style="display:none;">
            <div class="icon-store-search-row">
              <input type="search" id="store-q" class="andro-input" placeholder="Search icons (home, wifi, music…)" style="flex:1;">
              <button type="button" class="btn-prop" id="store-go">Search</button>
            </div>
            <p class="icon-store-hint">Open-source icons via Iconify · tap one to use</p>
            <div id="store-grid" class="icon-store-grid"></div>
            <div id="store-status" class="icon-store-status"></div>
          </div>

          <div class="card-divider"></div>

          <!-- Controls -->
          <div class="icon-ctrl-grid">
            <label class="icon-ctrl">
              <span>Image size <b id="val-scale">100%</b></span>
              <input type="range" id="opt-scale" min="40" max="140" value="100">
            </label>
            <label class="icon-ctrl">
              <span>Padding <b id="val-pad">10%</b></span>
              <input type="range" id="opt-pad" min="0" max="35" value="10">
            </label>
            <label class="icon-ctrl">
              <span>Offset X <b id="val-ox">0</b></span>
              <input type="range" id="opt-ox" min="-40" max="40" value="0">
            </label>
            <label class="icon-ctrl">
              <span>Offset Y <b id="val-oy">0</b></span>
              <input type="range" id="opt-oy" min="-40" max="40" value="0">
            </label>
          </div>

          <label class="config-label">Shape (square icon)</label>
          <div class="icon-shape-row" id="shape-row">
            <button type="button" class="icon-shape-btn active" data-shape="square">Square</button>
            <button type="button" class="icon-shape-btn" data-shape="rounded">Rounded</button>
            <button type="button" class="icon-shape-btn" data-shape="squircle">Squircle</button>
            <button type="button" class="icon-shape-btn" data-shape="circle">Circle</button>
          </div>

          <label class="config-label">Background</label>
          <div class="icon-bg-row">
            <input type="color" id="opt-bg" value="#3DDC84" title="Background color">
            <input type="text" id="opt-bg-hex" class="andro-input" value="#3DDC84" style="width:96px;font-family:monospace;">
            <label class="icon-check">
              <input type="checkbox" id="opt-bg-clear"> Transparent
            </label>
          </div>

          <label class="icon-check" style="margin-top:10px;display:flex;gap:8px;align-items:center;font-size:0.82rem;">
            <input type="checkbox" id="opt-round-circle" checked>
            Round icon always circular (Android adaptive style)
          </label>

          <div class="info-text" style="margin-top:12px;">
            ℹ️ Recommended source: <strong>512×512px</strong>.<br>
            <span style="color:#FFB74D;">⚠️</span> Generates
            <code>mipmap-*/ic_launcher.png</code> &amp;
            <code>ic_launcher_round.png</code>,
            removes adaptive conflicts, rewrites layouts/manifest to <code>@mipmap</code>, adds drawable aliases.
          </div>

          <div id="gen-file-list" class="gen-file-list"></div>
          <div id="progress-wrapper" class="gen-progress-wrapper">
            <div class="gen-progress-track">
              <div id="gen-progress-bar" class="gen-progress-bar"></div>
            </div>
            <div id="gen-status" class="gen-status-text">Initializing…</div>
          </div>
        </div>

        <div class="config-actions" style="margin-top:20px;">
          <button class="btn-build-cancel" id="btn-cancel">Close</button>
          <button class="btn-build-start" id="btn-gen" style="background-color:#FBC02D;color:#000;">Set Icon</button>
        </div>
      </div>
    `;

    $container.appendChild(fileInput);

    const existing = acode.require('openFolder').find(this.tabId);
    if (existing) existing.remove();

    this.editorFile = new EditorFile('Icon Studio', {
      type: 'page',
      content: $container,
      id: this.tabId,
      tabIcon: 'icon aid-camera-icon',
      stylesheets: [pageStyles],
    });

    this._bindControls($container, fileInput);
    this._paintPreviews();
    this._loadCurrentProjectIcon();
  }

  async _loadCurrentProjectIcon() {
    try {
      const hit = await findLauncherIconUrl(this.projectRoot);
      if (!hit || !hit.dataUrl) return;
      const img = new Image();
      img.onload = () => {
        this._sourceImg = img;
        this.selectedFile = { name: hit.name || 'ic_launcher.png', size: 0, _fromProject: true };
        const pathInput = this._$?.querySelector('#img-path');
        const metaInfo = this._$?.querySelector('#meta-info');
        const dimTag = this._$?.querySelector('#meta-dim');
        const sizeTag = this._$?.querySelector('#meta-size');
        const srcTag = this._$?.querySelector('#meta-src');
        if (pathInput) pathInput.value = 'Current: ' + (hit.name || 'ic_launcher');
        if (dimTag) dimTag.innerText = `${img.width}×${img.height}`;
        if (sizeTag) sizeTag.innerText = 'project';
        if (srcTag) {
          srcTag.style.display = 'inline';
          srcTag.innerText = 'current';
        }
        if (metaInfo) metaInfo.style.display = 'block';
        this._paintPreviews();
      };
      img.src = hit.dataUrl;
    } catch (e) {
      console.warn('load current icon', e);
    }
  }

  _bindControls($container, fileInput) {
    const pathInput = $container.querySelector('#img-path');
    const genBtn = $container.querySelector('#btn-gen');
    const syncTargets = () => {
      this._opts.targetApp = !!$container.querySelector('#tgt-app')?.checked;
      this._opts.targetSplash = !!$container.querySelector('#tgt-splash')?.checked;
      this._opts.targetNotify = !!$container.querySelector('#tgt-notify')?.checked;
    };
    ['#tgt-app', '#tgt-splash', '#tgt-notify'].forEach((sel) => {
      $container.querySelector(sel)?.addEventListener('change', syncTargets);
    });
    syncTargets();
    const metaInfo = $container.querySelector('#meta-info');
    const dimTag = $container.querySelector('#meta-dim');
    const sizeTag = $container.querySelector('#meta-size');
    const fileListDiv = $container.querySelector('#gen-file-list');

    $container.querySelector('#btn-pick-img').onclick = (e) => {
      e.preventDefault();
      fileInput.click();
    };

    const storePanel = $container.querySelector('#icon-store-panel');
    $container.querySelector('#btn-icon-store').onclick = () => {
      const open = storePanel.style.display === 'none';
      storePanel.style.display = open ? 'block' : 'none';
      if (open) this._searchIconStore($container, 'android');
    };
    $container.querySelector('#btn-svg-studio').onclick = () => {
      new SvgStudioUI().show(this.projectRoot || '');
    };
    $container.querySelector('#store-go').onclick = () => {
      const q = $container.querySelector('#store-q')?.value?.trim() || 'app';
      this._searchIconStore($container, q);
    };
    $container.querySelector('#store-q').addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        $container.querySelector('#store-go')?.click();
      }
    });

    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      this.selectedFile = file;
      pathInput.value = file.name;
      sizeTag.innerText = this.formatBytes(file.size);
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        this._sourceImg = img;
        dimTag.innerText = `${img.width}×${img.height}`;
        metaInfo.style.display = 'block';
        this._paintPreviews();
      };
      img.onerror = () => window.toast('Could not load image', 2500);
      img.src = url;
    };

    const bindRange = (id, key, labelId, fmt) => {
      const el = $container.querySelector(id);
      const lab = $container.querySelector(labelId);
      el.oninput = () => {
        this._opts[key] = Number(el.value);
        if (lab) lab.textContent = fmt(this._opts[key]);
        this._paintPreviews();
      };
    };
    bindRange('#opt-scale', 'scale', '#val-scale', (v) => v + '%');
    bindRange('#opt-pad', 'padding', '#val-pad', (v) => v + '%');
    bindRange('#opt-ox', 'offsetX', '#val-ox', (v) => String(v));
    bindRange('#opt-oy', 'offsetY', '#val-oy', (v) => String(v));

    $container.querySelectorAll('.icon-shape-btn').forEach((btn) => {
      btn.onclick = () => {
        $container.querySelectorAll('.icon-shape-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this._opts.shape = btn.getAttribute('data-shape') || 'squircle';
        this._paintPreviews();
      };
    });

    const bg = $container.querySelector('#opt-bg');
    const bgHex = $container.querySelector('#opt-bg-hex');
    const bgClear = $container.querySelector('#opt-bg-clear');
    bg.oninput = () => {
      this._opts.bgColor = bg.value;
      bgHex.value = bg.value;
      this._paintPreviews();
    };
    bgHex.onchange = () => {
      let v = bgHex.value.trim();
      if (!v.startsWith('#')) v = '#' + v;
      if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
        this._opts.bgColor = v;
        bg.value = v;
        this._paintPreviews();
      }
    };
    bgClear.onchange = () => {
      this._opts.bgTransparent = !!bgClear.checked;
      bg.disabled = bgClear.checked;
      bgHex.disabled = bgClear.checked;
      this._paintPreviews();
    };
    $container.querySelector('#opt-round-circle').onchange = (e) => {
      this._opts.roundOnlyCircle = !!e.target.checked;
      this._paintPreviews();
    };

    genBtn.onclick = async () => {
      if (!this.selectedFile || !this._sourceImg) {
        window.toast('Please select an image first', 3000);
        return;
      }
      syncTargets();
      if (!this._opts.targetApp && !this._opts.targetSplash && !this._opts.targetNotify) {
        window.toast('Tick at least one: App / Splash / Notification', 3500);
        return;
      }
      genBtn.disabled = true;
      genBtn.classList.add('btn-disabled-processing');
      genBtn.innerText = 'Generating…';
      this.showGenerationTree(fileListDiv);
      const progressWrapper = $container.querySelector('#progress-wrapper');
      const progressBar = $container.querySelector('#gen-progress-bar');
      const statusText = $container.querySelector('#gen-status');
      progressWrapper.style.display = 'block';
      try {
        const result = await this.processAndSaveIcons((percent, status) => {
          progressBar.style.width = `${percent}%`;
          statusText.innerText = status;
        });
        const removed = (result && result.removed) || [];
        if (removed.length) {
          window.toast('Icons OK. ⚠️ Removed: ' + removed.join(', '), 5000);
        } else {
          window.toast('Icons updated successfully!', 3000);
        }
        try { notifyIconUpdated(this.projectRoot); } catch (_) {}
        // Keep Icon Studio open so user can tweak / re-export without reopening
        genBtn.innerText = 'Set Icon';
        genBtn.disabled = false;
        genBtn.classList.remove('btn-disabled-processing');
        // leave progress visible briefly then soft-reset
        setTimeout(() => {
          try {
            progressWrapper.style.display = 'none';
            progressBar.style.width = '0%';
            statusText.innerText = 'Ready — change options and Set Icon again anytime';
          } catch (_) {}
        }, 1800);
      } catch (err) {
        console.error('Icon Gen Error:', err);
        window.alert('Error: ' + (err.message || err));
        genBtn.innerText = 'Set Icon';
        genBtn.disabled = false;
        genBtn.classList.remove('btn-disabled-processing');
        progressWrapper.style.display = 'none';
      }
    };

    $container.querySelector('#btn-cancel').onclick = () => this.editorFile.remove();
  }

  /** Paint live canvases from current options + source image */
  _paintPreviews() {
    const sq = this._$?.querySelector('#prev-square');
    const rd = this._$?.querySelector('#prev-round');
    const hm = this._$?.querySelector('#prev-home');
    if (!sq || !rd) return;
    this._renderIconToCanvas(sq, this._opts.shape, 144);
    this._renderIconToCanvas(
      rd,
      this._opts.roundOnlyCircle ? 'circle' : this._opts.shape,
      144
    );
    if (hm) this._renderIconToCanvas(hm, 'circle', 72);
  }

  /**
   * Shared renderer used for live preview and mipmap export.
   * @param {HTMLCanvasElement} canvas
   * @param {'square'|'rounded'|'squircle'|'circle'} shape
   * @param {number} size
   */
  _renderIconToCanvas(canvas, shape, size) {
    const ctx = canvas.getContext('2d');
    const s = size;
    canvas.width = s;
    canvas.height = s;
    ctx.clearRect(0, 0, s, s);

    // Clip path
    ctx.save();
    this._applyShapePath(ctx, s, shape);
    ctx.clip();

    // Background
    if (!this._opts.bgTransparent) {
      ctx.fillStyle = this._opts.bgColor || '#3DDC84';
      ctx.fillRect(0, 0, s, s);
    }

    // Image
    if (this._sourceImg) {
      const pad = (Math.max(0, Math.min(40, this._opts.padding)) / 100) * s;
      const scale = Math.max(0.3, Math.min(1.5, this._opts.scale / 100));
      const ox = (this._opts.offsetX / 100) * s;
      const oy = (this._opts.offsetY / 100) * s;
      const box = s - pad * 2;
      const draw = box * scale;
      const img = this._sourceImg;
      // cover-fit inside draw box
      const ir = img.width / img.height;
      let dw = draw;
      let dh = draw;
      if (ir > 1) {
        dh = draw / ir;
      } else {
        dw = draw * ir;
      }
      // actually use contain within draw square
      if (img.width >= img.height) {
        dw = draw;
        dh = draw * (img.height / img.width);
      } else {
        dh = draw;
        dw = draw * (img.width / img.height);
      }
      const dx = (s - dw) / 2 + ox;
      const dy = (s - dh) / 2 + oy;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, dx, dy, dw, dh);
    } else {
      // placeholder glyph
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = `${Math.floor(s * 0.18)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ICON', s / 2, s / 2);
    }

    ctx.restore();

    // Subtle border for preview clarity
    ctx.save();
    this._applyShapePath(ctx, s, shape);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = Math.max(1, s / 72);
    ctx.stroke();
    ctx.restore();
  }

  _applyShapePath(ctx, s, shape) {
    ctx.beginPath();
    if (shape === 'circle') {
      ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
    } else if (shape === 'rounded') {
      const r = s * 0.18;
      this._roundRect(ctx, 0, 0, s, s, r);
    } else if (shape === 'squircle') {
      const r = s * 0.28;
      this._roundRect(ctx, 0, 0, s, s, r);
    } else {
      ctx.rect(0, 0, s, s);
    }
    ctx.closePath();
  }

  _roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
  }

  showGenerationTree(container) {
    const densities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
    let html = `<div class="tree-root">/src/main/res/</div>`;
    densities.forEach((d) => {
      html += `<div class="tree-parent"><span style="width:12px;" class="icon">${svgs.openedFolder || ''} </span> mipmap-${d}</div>`;
      html += `<span class="tree-child"><span style="width:12px;" class="icon">${svgs.imageFile || ''}</span> ic_launcher.png</span>`;
      html += `<span class="tree-child"><span style="width:12px;" class="icon">${svgs.imageFile || ''}</span> ic_launcher_round.png</span>`;
    });
    container.innerHTML = html;
    container.style.display = 'block';
  }

  resolveProjectRoot(path) {
    const parts = String(path || '').split('/');
    const srcIndex = parts.indexOf('src');
    if (srcIndex !== -1) return parts.slice(0, srcIndex).join('/');
    return path.substring(0, path.lastIndexOf('/'));
  }

  async getAppDetails(moduleRoot) {
    let projectName = 'App';
    let packageName = '';
    try {
      const fs = acode.require('fs');
      const parts = String(moduleRoot || '').split('/').filter(Boolean);
      const folderName = parts[parts.length - 1] || 'App';
      if (folderName === 'app' && parts.length >= 2) {
        const parentFolder = parts[parts.length - 2];
        projectName = parentFolder.charAt(0).toUpperCase() + parentFolder.slice(1);
      } else {
        projectName = folderName.charAt(0).toUpperCase() + folderName.slice(1);
      }
      const manifestPath = `${moduleRoot}/src/main/AndroidManifest.xml`;
      if (await fs(manifestPath).exists()) {
        const content = await fs(manifestPath).readFile('utf-8');
        const match = String(content).match(/package=["']([^"']+)["']/);
        if (match) packageName = match[1];
        if (!packageName) {
          // namespace often in build.gradle only — leave empty
        }
      }
    } catch (e) {
      console.warn('getAppDetails', e);
    }
    return { projectName, packageName };
  }

  formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }



  /** Build a data: SVG URL WebView can paint (no external img / blob). */
  _svgToDataUrl(body, width = 24, height = 24, color = '#ffffff') {
    const w = width || 24;
    const h = height || 24;
    // Many packs use fill=currentColor or stroke-only paths
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
      `<g fill="${color}" stroke="${color}">${body}</g></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  async _fetchIconifyBodies(prefix, names) {
    const uniq = [...new Set(names)].slice(0, 64);
    if (!uniq.length) return {};
    const url =
      `https://api.iconify.design/${encodeURIComponent(prefix)}.json?icons=` +
      uniq.map(encodeURIComponent).join(',');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Iconify ${prefix} HTTP ${res.status}`);
    const data = await res.json();
    return data.icons || {};
  }

  _loadImg(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('image decode failed'));
      img.src = dataUrl;
    });
  }

  async _searchIconStore($container, query) {
    const grid = $container.querySelector('#store-grid');
    const status = $container.querySelector('#store-status');
    if (!grid) return;
    grid.innerHTML = '';
    status.textContent = 'Searching…';
    try {
      const q = encodeURIComponent(String(query || 'app').slice(0, 64));
      const res = await fetch(`https://api.iconify.design/search?query=${q}&limit=48`);
      if (!res.ok) throw new Error('Search HTTP ' + res.status);
      const data = await res.json();
      const icons = data.icons || [];
      if (!icons.length) {
        status.textContent = 'No icons found — try another word';
        return;
      }
      status.textContent = `Loading ${icons.length} previews…`;

      // Group by prefix → one JSON request per pack (reliable in WebView)
      const byPrefix = {};
      for (const id of icons) {
        const [prefix, name] = String(id).split(':');
        if (!prefix || !name) continue;
        if (!byPrefix[prefix]) byPrefix[prefix] = [];
        byPrefix[prefix].push(name);
      }

      const resolved = []; // { id, prefix, name, dataUrl }
      for (const [prefix, names] of Object.entries(byPrefix)) {
        try {
          const bodies = await this._fetchIconifyBodies(prefix, names);
          for (const name of names) {
            const icon = bodies[name];
            if (!icon || !icon.body) continue;
            const w = icon.width || 24;
            const h = icon.height || 24;
            const dataUrl = this._svgToDataUrl(icon.body, w, h, '#eeeeee');
            resolved.push({ id: `${prefix}:${name}`, prefix, name, dataUrl, body: icon.body, w, h });
          }
        } catch (e) {
          console.warn('prefix fetch', prefix, e);
        }
      }

      if (!resolved.length) {
        status.textContent = 'Previews failed — check network / try again';
        return;
      }

      grid.innerHTML = '';
      for (const item of resolved) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'icon-store-item';
        btn.title = item.id;
        const img = document.createElement('img');
        img.alt = item.name;
        img.src = item.dataUrl;
        const cap = document.createElement('span');
        cap.textContent = item.name;
        btn.appendChild(img);
        btn.appendChild(cap);
        btn.onclick = () => this._useStoreIcon($container, item);
        grid.appendChild(btn);
      }
      status.textContent = `${resolved.length} icons · tap to use`;
    } catch (e) {
      status.textContent = 'Store error: ' + (e.message || e) + ' (need network)';
    }
  }

  async _useStoreIcon($container, item) {
    const status = $container.querySelector('#store-status');
    try {
      const id = item.id || `${item.prefix}:${item.name}`;
      status.textContent = `Loading ${id}…`;

      let body = item.body;
      let w = item.w || 24;
      let h = item.h || 24;
      if (!body) {
        const bodies = await this._fetchIconifyBodies(item.prefix, [item.name]);
        const icon = bodies[item.name];
        if (!icon || !icon.body) throw new Error('icon body missing');
        body = icon.body;
        w = icon.width || 24;
        h = icon.height || 24;
      }

      // High-res SVG data URL (white glyph for dark/colored bg)
      const svgUrl = this._svgToDataUrl(body, w, h, '#ffffff');
      const img = await this._loadImg(svgUrl);

      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 512;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, 512, 512);
      // contain with margin
      const scale = Math.min(512 / img.width, 512 / img.height) * 0.72;
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, (512 - dw) / 2, (512 - dh) / 2, dw, dh);

      const dataUrl = c.toDataURL('image/png');
      const out = await this._loadImg(dataUrl);

      this._sourceImg = out;
      this.selectedFile = { name: `${item.name || 'icon'}.png`, size: 0, _fromStore: id };
      this._opts.bgTransparent = false;
      const pathInput = $container.querySelector('#img-path');
      const metaInfo = $container.querySelector('#meta-info');
      const dimTag = $container.querySelector('#meta-dim');
      const sizeTag = $container.querySelector('#meta-size');
      const srcTag = $container.querySelector('#meta-src');
      if (pathInput) pathInput.value = `Store: ${id}`;
      if (dimTag) dimTag.innerText = '512×512';
      if (sizeTag) sizeTag.innerText = 'store';
      if (srcTag) {
        srcTag.style.display = 'inline';
        srcTag.innerText = 'store';
      }
      if (metaInfo) metaInfo.style.display = 'block';
      this._paintPreviews();
      status.textContent = `Selected ${id} — adjust & Set Icon`;
      window.toast(`Icon: ${id}`, 2000);
    } catch (e) {
      console.error('store icon', e);
      status.textContent = 'Failed: ' + (e.message || e);
      window.toast('Could not load icon from store', 3000);
    }
  }



  async _pngWrite(folderUrl, fileName, arrayBuffer) {
    const u8 =
      arrayBuffer instanceof Uint8Array
        ? arrayBuffer
        : new Uint8Array(arrayBuffer);
    if (!u8 || !u8.byteLength) throw new Error('empty PNG buffer: ' + fileName);

    // Must be real PNG bytes from canvas — never write without magic
    if (!(u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47)) {
      console.warn('[icon] buffer missing PNG magic for', fileName, u8[0], u8[1], u8[2], u8[3]);
      throw new Error('Invalid PNG buffer (bad magic): ' + fileName);
    }

    // Acode FS corrupts binary if written as UTF-8 — always base64 + verify
    const res = await writeBinaryFile(folderUrl, fileName, u8, { overwrite: true });
    if (!res || !res.success) {
      throw new Error((res && res.message) || 'Failed to write PNG: ' + fileName);
    }
    console.log('[icon] wrote OK', fileName, res.url);
  }

  async processAndSaveIcons(onProgress) {
    const densities = [
      { name: 'mipmap-mdpi', size: 48 },
      { name: 'mipmap-hdpi', size: 72 },
      { name: 'mipmap-xhdpi', size: 96 },
      { name: 'mipmap-xxhdpi', size: 144 },
      { name: 'mipmap-xxxhdpi', size: 192 },
    ];
    const drawableDensities = [
      { name: 'drawable-mdpi', size: 48 },
      { name: 'drawable-hdpi', size: 72 },
      { name: 'drawable-xhdpi', size: 96 },
      { name: 'drawable-xxhdpi', size: 144 },
      { name: 'drawable-xxxhdpi', size: 192 },
    ];
    const notifySizes = [
      { name: 'drawable-mdpi', size: 24 },
      { name: 'drawable-hdpi', size: 36 },
      { name: 'drawable-xhdpi', size: 48 },
      { name: 'drawable-xxhdpi', size: 72 },
      { name: 'drawable-xxxhdpi', size: 96 },
    ];
    const folderOpts = { overwrite: true };
    const fileOpts = { overwrite: true };

    onProgress(8, 'Preparing workspace…');
    const srcRes = await createFolder(this.projectRoot, 'src', folderOpts);
    const mainRes = await createFolder(srcRes.url, 'main', folderOpts);
    const resRes = await createFolder(mainRes.url, 'res', folderOpts);

    const removed = [];
    const toBuf = (canvas) =>
      new Promise((resolve, reject) => {
        canvas.toBlob(async (blob) => {
          if (!blob) return reject(new Error('toBlob failed'));
          resolve(await blob.arrayBuffer());
        }, 'image/png');
      });

    let step = 0;
    const totalSteps =
      (this._opts.targetApp ? densities.length : 0) +
      (this._opts.targetSplash ? drawableDensities.length : 0) +
      (this._opts.targetNotify ? notifySizes.length : 0) || 1;

    const tick = (msg) => {
      step++;
      onProgress(12 + (step / totalSteps) * 78, msg);
    };

    // —— App launcher ——
    if (this._opts.targetApp) {
      onProgress(12, 'Cleaning adaptive mipmap conflicts…');
      try {
        const fs = acode.require('fs') || acode.require('fsOperation');
        const resList = await fs(resRes.url).lsDir();
        for (const item of resList || []) {
          const n = item.name || '';
          if (n === 'mipmap-anydpi-v26' || n === 'mipmap-anydpi') {
            try {
              await fs(item.url).delete();
              removed.push(n);
            } catch (_) {}
          }
        }
      } catch (_) {}

      for (const density of densities) {
        const targetFolder = await createFolder(resRes.url, density.name, folderOpts);
        const square = document.createElement('canvas');
        const round = document.createElement('canvas');
        this._renderIconToCanvas(square, this._opts.shape, density.size);
        this._renderIconToCanvas(
          round,
          this._opts.roundOnlyCircle ? 'circle' : this._opts.shape,
          density.size
        );
        await this._pngWrite(targetFolder.url, 'ic_launcher.png', await toBuf(square));
        await this._pngWrite(targetFolder.url, 'ic_launcher_round.png', await toBuf(round));
        tick(`App icon ${density.name}`);
      }

      onProgress(88, 'Auto-linking layouts + manifest → @mipmap…');
      try {
        const more = await this.ensureManifestUsesMipmapIcons(mainRes.url, resRes.url);
        if (more && more.removed) removed.push(...more.removed);
        if (more && more.manifestUpdated) removed.push('manifest→@mipmap');
        if (more && more.rewritten && more.rewritten.length) {
          removed.push('refs:' + more.rewritten.slice(0, 4).join(','));
        }
      } catch (e) {
        console.warn('Manifest/layout icon link', e);
      }
    }

    // —— Splash (full-color, larger safe area) ——
    if (this._opts.targetSplash) {
      const saved = { ...this._opts };
      // splash logo often needs more padding
      this._opts.padding = Math.max(this._opts.padding, 12);
      for (const d of drawableDensities) {
        const folder = await createFolder(resRes.url, d.name, folderOpts);
        const c = document.createElement('canvas');
        this._renderIconToCanvas(c, 'square', d.size * 2); // 2x for sharper splash logo
        await this._pngWrite(folder.url, 'ic_splash.png', await toBuf(c));
        tick(`Splash ${d.name}`);
      }
      // default drawable alias
      try {
        const dr = await createFolder(resRes.url, 'drawable', folderOpts);
        const c = document.createElement('canvas');
        this._renderIconToCanvas(c, 'square', 192);
        await this._pngWrite(dr.url, 'ic_splash.png', await toBuf(c));
      } catch (_) {}
      Object.assign(this._opts, saved);
    }

    // —— Notification (white alpha silhouette) ——
    if (this._opts.targetNotify) {
      for (const d of notifySizes) {
        const folder = await createFolder(resRes.url, d.name, folderOpts);
        const c = document.createElement('canvas');
        this._renderNotificationIcon(c, d.size);
        await this._pngWrite(folder.url, 'ic_notification.png', await toBuf(c));
        tick(`Notification ${d.name}`);
      }
      try {
        const dr = await createFolder(resRes.url, 'drawable', folderOpts);
        const c = document.createElement('canvas');
        this._renderNotificationIcon(c, 48);
        await this._pngWrite(dr.url, 'ic_notification.png', await toBuf(c));
      } catch (_) {}
    }

    if (removed.length) {
      try {
        window.toast('⚠️ Removed: ' + removed.join(', '), 4500);
      } catch (_) {}
    }
    onProgress(100, 'Done!');
    return { removed };
  }

  /** White-on-transparent glyph for status bar notifications */
  _renderNotificationIcon(canvas, size) {
    const s = size;
    canvas.width = s;
    canvas.height = s;
    const tmp = document.createElement('canvas');
    // render full-color first without bg
    const prevBg = this._opts.bgTransparent;
    const prevPad = this._opts.padding;
    this._opts.bgTransparent = true;
    this._opts.padding = Math.max(8, this._opts.padding);
    this._renderIconToCanvas(tmp, 'square', s);
    this._opts.bgTransparent = prevBg;
    this._opts.padding = prevPad;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, s, s);
    ctx.drawImage(tmp, 0, 0);
    const img = ctx.getImageData(0, 0, s, s);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3];
      if (a < 12) {
        d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0;
        continue;
      }
      // luminance → white with alpha
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const alpha = Math.min(255, Math.round((a / 255) * (lum > 8 ? 255 : lum * 4)));
      d[i] = 255;
      d[i + 1] = 255;
      d[i + 2] = 255;
      d[i + 3] = alpha;
    }
    ctx.putImageData(img, 0, 0);
  }

  async ensureManifestUsesMipmapIcons(mainUrl, resUrl) {
    const fsApi = acode.require('fs') || acode.require('fsOperation');
    const candidates = [`${mainUrl}/AndroidManifest.xml`];
    try {
      candidates.push(`${this.projectRoot}/src/main/AndroidManifest.xml`);
      // also common when projectRoot is repo root
      candidates.push(`${this.projectRoot}/app/src/main/AndroidManifest.xml`);
    } catch (_) {}

    let updated = false;
    const removed = [];
    const rewritten = [];

    const rewriteLauncherRefs = (content) => {
      let c = String(content);
      const before = c;
      // @drawable/ic_launcher_round → @mipmap/ic_launcher_round
      c = c.replace(/@drawable\/ic_launcher_round\b/g, '@mipmap/ic_launcher_round');
      // @drawable/ic_launcher (not _background/_foreground)
      c = c.replace(/@drawable\/ic_launcher\b(?!_)/g, '@mipmap/ic_launcher');
      // attribute forms that still point at drawable launcher
      c = c.replace(
        /android:icon\s*=\s*["']@drawable\/ic_launcher["']/g,
        'android:icon="@mipmap/ic_launcher"'
      );
      c = c.replace(
        /android:roundIcon\s*=\s*["']@drawable\/ic_launcher_round["']/g,
        'android:roundIcon="@mipmap/ic_launcher_round"'
      );
      return { content: c, changed: c !== before };
    };

    // 1) Manifest
    for (const manifestPath of candidates) {
      try {
        if (!(await fsApi(manifestPath).exists())) continue;
        let content = String(await fsApi(manifestPath).readFile('utf-8'));
        let { content: next, changed } = rewriteLauncherRefs(content);
        // force mipmap if still not pointing there
        if (!/@mipmap\/ic_launcher\b/.test(next) && /android:icon\s*=/.test(next)) {
          next = next.replace(
            /android:icon\s*=\s*["'][^"']+["']/,
            'android:icon="@mipmap/ic_launcher"'
          );
          next = next.replace(
            /android:roundIcon\s*=\s*["'][^"']+["']/,
            'android:roundIcon="@mipmap/ic_launcher_round"'
          );
          changed = true;
        }
        if (changed) {
          await fsApi(manifestPath).writeFile(next);
          updated = true;
          rewritten.push('AndroidManifest.xml');
        }
        break;
      } catch (e) {
        console.warn('manifest path', manifestPath, e);
      }
    }

    // 2) All layout / menu / values / xml under res — auto-fix @drawable/ic_launcher*
    const scanDirs = ['layout', 'menu', 'xml', 'drawable', 'values', 'values-night'];
    const walkAndRewrite = async (dirUrl, label) => {
      try {
        if (!(await fsApi(dirUrl).exists())) return;
        const entries = await fsApi(dirUrl).lsDir();
        for (const item of entries || []) {
          const name = item.name || '';
          if (item.isDirectory) {
            await walkAndRewrite(item.url, label + '/' + name);
            continue;
          }
          if (!/\.xml$/i.test(name)) continue;
          // skip vector drawables that are NOT launcher aliases
          if (/^ic_menu_/i.test(name) || /^ic_splash/i.test(name) || /^ic_notification/i.test(name)) {
            continue;
          }
          try {
            const raw = String(await fsApi(item.url).readFile('utf-8'));
            const { content: next, changed } = rewriteLauncherRefs(raw);
            if (changed) {
              await fsApi(item.url).writeFile(next);
              rewritten.push((label ? label + '/' : '') + name);
            }
          } catch (e) {
            console.warn('rewrite xml', item.url, e);
          }
        }
      } catch (_) {}
    };

    for (const d of scanDirs) {
      await walkAndRewrite(`${resUrl}/${d}`, d);
    }
    // also scan res root for stray xml
    try {
      const resEntries = await fsApi(resUrl).lsDir();
      for (const item of resEntries || []) {
        if (item.isFile && /\.xml$/i.test(item.name || '')) {
          try {
            const raw = String(await fsApi(item.url).readFile('utf-8'));
            const { content: next, changed } = rewriteLauncherRefs(raw);
            if (changed) {
              await fsApi(item.url).writeFile(next);
              rewritten.push(item.name);
            }
          } catch (_) {}
        }
      }
    } catch (_) {}

    // 3) Remove conflicting adaptive / drawable launcher XML so only mipmap PNG wins
    try {
      const drawableUrl = `${resUrl}/drawable`;
      if (await fsApi(drawableUrl).exists()) {
        for (const name of [
          'ic_launcher.xml',
          'ic_launcher_round.xml',
          'ic_launcher_background.xml',
          'ic_launcher_foreground.xml',
        ]) {
          const u = `${drawableUrl}/${name}`;
          try {
            if (await fsApi(u).exists()) {
              // keep background/foreground only if still referenced by remaining adaptive — we deleted anydpi
              await fsApi(u).delete();
              removed.push('drawable/' + name);
            }
          } catch (_) {}
        }
      }
    } catch (_) {}

    // 4) Safety: if something still expects @drawable/ic_launcher_round, drop a thin alias
    // that points at mipmap (works when a 3rd-party snippet hardcodes drawable)
    try {
      const drawableUrl = `${resUrl}/drawable`;
      await this._ensureDrawableAlias(drawableUrl, 'ic_launcher_round', '@mipmap/ic_launcher_round');
      await this._ensureDrawableAlias(drawableUrl, 'ic_launcher', '@mipmap/ic_launcher');
    } catch (e) {
      console.warn('drawable alias', e);
    }

    if (rewritten.length) {
      console.log('[icon] auto-rewrote refs in:', rewritten.join(', '));
    }

    return { removed, manifestUpdated: updated, rewritten };
  }

  /**
   * Create drawable/NAME.xml as <bitmap> or <item> alias → @mipmap/...
   * so any leftover @drawable/NAME still resolves after Icon Studio.
   */
  async _ensureDrawableAlias(drawableUrl, name, mipmapRef) {
    const fsApi = acode.require('fs') || acode.require('fsOperation');
    if (!drawableUrl) return;
    try {
      // ensure folder
      try {
        if (!(await fsApi(drawableUrl).exists())) {
          const parent = drawableUrl.replace(/\/[^/]+\/?$/, '');
          const folder = drawableUrl.split('/').pop();
          await fsApi(parent).createDirectory(folder);
        }
      } catch (_) {}

      const file = `${drawableUrl}/${name}.xml`;
      // only create if missing (we may have just deleted adaptive versions)
      let exists = false;
      try {
        exists = await fsApi(file).exists();
      } catch (_) {}
      if (exists) return;

      const xml =
        `<?xml version="1.0" encoding="utf-8"?>\n` +
        `<bitmap xmlns:android="http://schemas.android.com/apk/res/android"\n` +
        `    android:src="${mipmapRef}" />\n`;
      try {
        await fsApi(drawableUrl).createFile(`${name}.xml`, xml);
      } catch (_) {
        try {
          await fsApi(file).writeFile(xml);
        } catch (e2) {
          console.warn('alias write', name, e2);
        }
      }
    } catch (e) {
      console.warn('_ensureDrawableAlias', name, e);
    }
  }
}
