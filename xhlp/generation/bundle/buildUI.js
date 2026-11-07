import { assets } from '../../assets/assets.js';
import { pageStyles } from '../../styles/styles.js';

import cupReady from '../../assets/icons/png/cup.png'; 
import cupMaking from '../../assets/icons/png/cup.gif'; 


export class BuildUI {
  constructor() {
    this.$container = null;
    this.tabId = 'android.build.output';
    this.editorFile = null;
  }

  show(onCancel) {
    const openFolder = acode.require('openFolder');
    const existing = openFolder.find(this.tabId);
    if(existing) {
        existing.remove();
    }
    
    // Create Container
    this.$container = document.createElement('div');
    this.$container.className = 'andro-build-page';
    
    // ✅ Change 1: Added ID 'status-icon' and used cupMaking variable
    this.$container.innerHTML = `
      <div class="andro-build-header-sec">
         <div class="build-app-name">
            <span class="icon android"></span> <span id="header-app-name">Android Builder</span>
         </div>
         <button class="thin-download-btn" id="btn-main-action" style="display:none;">Action</button>
      </div>
      
      <div class="andro-build-body">
         <img src="${assets.text}" class="build-logo-large">
         
         <img src="${cupMaking}" class="build-logo-gif" id="status-icon">
         
         <div class="build-main-status" id="main-status">Starting...</div>

         <div id="build-meta-card" class="build-meta-card" style="
           margin: 12px auto 0; max-width: 420px; text-align: left;
           border: 1px solid rgba(255,255,255,0.12); border-radius: 10px;
           background: rgba(0,0,0,0.25); overflow: hidden;
         ">
           <button type="button" id="build-meta-toggle" style="
             width: 100%; display: flex; align-items: center; gap: 8px;
             padding: 10px 12px; background: transparent; border: 0;
             color: inherit; cursor: pointer; font-size: 0.85rem;
           ">
             <span id="build-meta-chevron" style="opacity:0.7;font-size:0.75rem;">▸</span>
             <span style="font-weight:600;">Build details</span>
             <span id="build-meta-summary" style="margin-left:auto;opacity:0.65;font-size:0.75rem;max-width:55%;overflow-y:scroll;text-overflow:ellipsis;white-space:nowrap;"></span>
           </button>
           <div id="build-meta-body" style="display:none;padding:0 12px 12px;font-size:0.78rem;line-height:1.45;opacity:0.92;max-height:min(40vh,280px);overflow-y:auto;-webkit-overflow-scrolling:touch;"></div>
         </div>
         
         <div class="build-progress-wrapper">
             <div class="build-sub-status" id="sub-status">Initializing...</div>
             <div class="andro-build-track">
                <div class="andro-build-bar is-active" id="prog-bar"></div>
             </div>
         </div>

         <div style="margin-top: 15px; display: flex; gap: 10px;">
             <button class="btn-show-details" id="btn-details">Show Logs</button>
             <button class="btn-show-details" id="btn-stop" style="border-color: #F44336; color: #F44336;">Stop Build</button>
         </div>

         <div class="build-details-box" id="log-box"></div>
      </div>

      <div class="build-path-info" id="footer-info">
         Please wait while Gradle compiles your project.
      </div>
    `;

    const EditorFile = acode.require('editorFile');
    this.editorFile = new EditorFile('Build Output', {
        type: 'page',
        content: this.$container,
        id: this.tabId,
        tabIcon: 'icon aid-gradle-icon',
        stylesheets: [pageStyles]
    });

    const logBox = this.$container.querySelector('#log-box');
    const btnDetails = this.$container.querySelector('#btn-details');
    btnDetails.onclick = () => {
        if (logBox.style.display === 'block') {
            logBox.style.display = 'none';
            btnDetails.innerText = 'Show Logs';
        } else {
            logBox.style.display = 'block';
            btnDetails.innerText = 'Hide Logs';
        }
    };

    if (this._pendingMeta) {
      this.setBuildMeta(this._pendingMeta);
      this._pendingMeta = null;
    }

    const btnStop = this.$container.querySelector('#btn-stop');
    btnStop.onclick = async () => {
        btnStop.disabled = true;
        btnStop.innerText = "Stopping…";
        this._setBarAnimating(false);
        try {
          if (typeof onCancel === 'function') await onCancel();
        } catch (e) {
          console.warn('cancel', e);
        }
        this.updateProgress(null, "Build Cancelled by User", null, 'error');
        const statusIcon = this.$container.querySelector('#status-icon');
        if (statusIcon) statusIcon.src = cupReady;
        btnStop.innerText = "Stopped";
    };
  }

  setBuildMeta(meta) {
    if (!this.$container) {
      this._pendingMeta = { ...(this._pendingMeta || {}), ...(meta || {}) };
      return;
    }
    // Merge so later updates (repo, sdk, steps) keep earlier fields
    this._meta = { ...(this._meta || {}), ...(meta || {}) };
    const m = this._meta;
    const body = this.$container.querySelector('#build-meta-body');
    const summary = this.$container.querySelector('#build-meta-summary');
    const toggle = this.$container.querySelector('#build-meta-toggle');
    const chevron = this.$container.querySelector('#build-meta-chevron');
    if (!body) return;

    const rows = [];
    const add = (k, v) => {
      if (v == null || v === '') return;
      rows.push(
        `<div style="display:flex;gap:8px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.06);">` +
          `<span style="opacity:0.55;min-width:110px;">${k}</span>` +
          `<span style="font-family:monospace;word-break:break-all;">${v}</span></div>`
      );
    };
    add('Mode', m.mode);
    add('Repo', m.repo);
    add('Branch', m.branch);
    add('Project ID', m.projectId);
    add('Variant', m.variant);
    add('Format', m.format);
    add('compileSdk', m.compileSdk);
    add('minSdk', m.minSdk);
    add('targetSdk', m.targetSdk);
    add('versionName', m.versionName);
    add('versionCode', m.versionCode);
    add('Java', m.javaVersion);
    add('Status', m.status ? (m.status + (m.conclusion ? ' / ' + m.conclusion : '')) : '');
    add('Progress', m.progress != null ? m.progress + '%' : '');
    add('Run ID', m.runId);
    if (m.actionsUrl) {
      rows.push(
        `<div style="margin-top:6px;">` +
          `<a href="${m.actionsUrl}" id="btn-open-actions" ` +
            `style="color:#64B5F6;word-break:break-all;text-decoration:underline;cursor:pointer;">` +
            `${m.actionsUrl}</a>` +
        `</div>`
      );
    }
    add('Project', m.projectRoot);
    body.innerHTML = rows.join('') || '<div style="opacity:0.6;">No details yet</div>';
    const openBtn = body.querySelector('#btn-open-actions');
    if (openBtn && m.actionsUrl) {
      openBtn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const url = m.actionsUrl;
        try {
          const system = acode.require('system');
          if (system && typeof system.openInBrowser === 'function') {
            system.openInBrowser(url);
            return;
          }
        } catch (_) {}
        try {
          if (window.cordova && cordova.InAppBrowser) {
            cordova.InAppBrowser.open(url, '_system');
            return;
          }
        } catch (_) {}
        try {
          window.open(url, '_blank');
        } catch (_) {
          window.toast(url, 4000);
        }
      };
    }
    if (summary) {
      summary.textContent =
        m.mode === 'github'
          ? (m.repo || 'GitHub') + (m.compileSdk ? ` · SDK ${m.compileSdk}` : '')
          : `Terminal · ${m.variant || 'debug'}`;
    }
    if (toggle && !toggle._xhlpBound) {
      toggle._xhlpBound = true;
      toggle.onclick = () => {
        const open = body.style.display !== 'none';
        body.style.display = open ? 'none' : 'block';
        if (chevron) chevron.textContent = open ? '▸' : '▾';
      };
    }
  }

  /** Append a log line (GitHub + terminal builds) */
  appendLog(text) {
    if (!this.$container) return;
    const logBox = this.$container.querySelector('#log-box');
    if (!logBox) return;
    const span = document.createElement('div');
    span.textContent = String(text == null ? '' : text).replace(/\n$/, '');
    span.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
    logBox.appendChild(span);
    logBox.scrollTop = logBox.scrollHeight;
    // auto-open logs on first line
    if (logBox.style.display !== 'block' && logBox.childNodes.length <= 2) {
      logBox.style.display = 'block';
      const btn = this.$container.querySelector('#btn-details');
      if (btn) btn.innerText = 'Hide Logs';
    }
  }

  setState(state) {
    this.updateProgress(null, null, null, state || 'gradle');
  }

  _setBarAnimating(on) {
    if (!this.$container) return;
    const bar = this.$container.querySelector('#prog-bar');
    if (!bar) return;
    if (on) bar.classList.add('is-active');
    else bar.classList.remove('is-active');
  }

  updateProgress(percent, stepName, logChunk, state) {
    if (!this.$container || !this.$container.isConnected) return;
    
    const bar = this.$container.querySelector('#prog-bar');
    const subStatus = this.$container.querySelector('#sub-status');
    const logBox = this.$container.querySelector('#log-box');
    const mainStatus = this.$container.querySelector('#main-status');
    const btnStop = this.$container.querySelector('#btn-stop');

    if (bar && percent !== null) bar.style.width = `${percent}%`;

    if (state === 'gradle') {
        if (bar) bar.style.backgroundColor = "#4CAF50";
        if (mainStatus) mainStatus.innerText = "Building Project...";
        this._setBarAnimating(true);
    } else if (state === 'error') {
        if (bar) bar.style.backgroundColor = "#F44336";
        if (mainStatus) mainStatus.innerText = "Build Failed";
        this._setBarAnimating(false);
        if (btnStop) btnStop.style.display = 'none';
    } else if (state === 'success') {
        if (bar) bar.style.backgroundColor = "#4CAF50";
        if (mainStatus) mainStatus.innerText = "App Ready!";
        this._setBarAnimating(false);
        if (btnStop) btnStop.style.display = 'none';
    } else {
        if (bar) bar.style.backgroundColor = "#2196F3";
        if (mainStatus) mainStatus.innerText = "Preparing...";
        this._setBarAnimating(true);
    }

    if (logChunk) {
        const span = document.createElement('div');
        span.textContent = logChunk;
        span.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
        logBox.appendChild(span);
        logBox.scrollTop = logBox.scrollHeight;
    }
    
    if(stepName && stepName.trim().length > 0) {
        subStatus.innerText = stepName;
    }
  }

  formatPath(fullUrl) {
      if (!fullUrl) return "Unknown Location";
      let path = fullUrl.replace('file://', '');
      if (path.includes('/storage/emulated/0')) {
          return path.replace('/storage/emulated/0', 'Internal Storage');
      }
      const parts = path.split('/');
      if (parts.length > 6) {
          const shortParts = parts.slice(-5); 
          return '...' + '/' + shortParts.join('/');
      }
      return path;
  }

  showResult(isSuccess, payload) {
    if (!this.$container) return;
    this._setBarAnimating(false);

    const mainStatus = this.$container.querySelector('#main-status');
    const subStatus = this.$container.querySelector('#sub-status');
    const footerInfo = this.$container.querySelector('#footer-info');
    const actionBtn = this.$container.querySelector('#btn-main-action');
    const logBox = this.$container.querySelector('#log-box');
    const btnDetails = this.$container.querySelector('#btn-details');
    const btnStop = this.$container.querySelector('#btn-stop');
    const buildWrapper = this.$container.querySelector('.build-progress-wrapper');
    
    // ✅ Change 3: Switch to Static Image on Result (Success/Fail)
    const statusIcon = this.$container.querySelector('#status-icon');
    if(statusIcon) statusIcon.src = cupReady;

    this.editorFile.filename = isSuccess ? 'Build Success' : 'Build Failed';
    if(btnStop) btnStop.style.display = 'none';

    if (isSuccess) {
        this.updateProgress(100, "Completed", null, 'success');
        subStatus.innerText = "Build completed successfully.";
        
        if (payload && typeof payload.onDownload === 'function') {
          actionBtn.style.display = "inline-block";
          actionBtn.innerText = "Save to Downloads";
          actionBtn.style.backgroundColor = "#4CAF50";
          actionBtn.onclick = payload.onDownload;
        } else {
          actionBtn.style.display = "none";
        }
        
        if (buildWrapper && !buildWrapper.querySelector('.after-build-informmation')) {
            const warningDiv = document.createElement('div');
            warningDiv.className = 'after-build-informmation';
            warningDiv.innerHTML = '⚠️ Close this tab before running a new build';
            buildWrapper.appendChild(warningDiv);
        }
        
        const displayPath = this.formatPath(payload && (payload.originalPath || payload.message));
        footerInfo.innerHTML = `Location: <br> <span style="color:#4CAF50; font-family:monospace;">${displayPath}</span>`;

    } else {
        this.updateProgress(100, "Failed", null, 'error');
        subStatus.innerText = "Check logs for details.";
        
        if (buildWrapper && !buildWrapper.querySelector('.after-build-informmation')) {
            const warningDiv = document.createElement('div');
            warningDiv.className = 'after-build-informmation';
            warningDiv.innerHTML = '⚠️ Close this tab before running a new build';
            buildWrapper.appendChild(warningDiv);
        }

        actionBtn.style.display = "inline-block";
        actionBtn.innerText = "Save Logs";
        actionBtn.style.backgroundColor = "#F44336";
        actionBtn.onclick = payload.onDownload;

        logBox.style.display = 'block';
        btnDetails.innerText = 'Hide Logs';
        
        footerInfo.innerText = "Review the error logs above.";
    }
  }
}

// Soft bind for webpack/runtime instances that miss class methods
if (typeof BuildUI !== 'undefined' && BuildUI.prototype && !BuildUI.prototype._setBarAnimating) {
  BuildUI.prototype._setBarAnimating = function (on) {
    if (!this.$container) return;
    const bar = this.$container.querySelector('#prog-bar');
    if (!bar) return;
    if (on) bar.classList.add('is-active');
    else bar.classList.remove('is-active');
  };
}
