import plugin from '../../plugin.json';
import { pageStyles } from '../styles/styles.js';
import { getSetupScript } from './setupScript.js';
import { setSetupComplete , getMissingComponents} from './envCheck.js';
import { writeShared, executeCommand } from '../services/terminalManager.js'; 
import { showBuilderPage } from '../generation/bundle/builderPage.js';
import { assets } from '../assets/assets.js';
// Updated Import: Added selectAndroHome
import { getResolvedPaths, selectAndroHome } from '../services/pathManager.js'; 

export async function initSetupWizard(rootElement) {
  const fs = acode.require('fs');

  // Alpine cannot mkdir under /data/user/0/... — always use $HOME-based path for shell
  const pluginId = (typeof plugin !== 'undefined' && plugin.id) || 'acode.plugin.xhlp';
  if (!window.ANDRO_HOME || String(window.ANDRO_HOME).includes('/data/user/')) {
    window.ANDRO_HOME = `$HOME/${pluginId}`;
  }
  
  // Paths (shell expands $HOME) — progress polled via Alpine executeCommand
  let workDirShell = window.ANDRO_HOME;
  
  // --- TOOLBAR MANAGEMENT ---
  const quickTools = document.querySelector('#quick-tools');
  const quickToolsToggler = document.querySelector('#quicktools-toggler');

  function updateToolbarVisibility() {
      const file = editorManager.activeFile;
      if (file && (file.uri || file.location)) {
          if (quickTools) quickTools.style.display = '';
          if (quickToolsToggler) quickToolsToggler.style.display = '';
      } else {
          if (quickTools) quickTools.style.display = 'none';
          if (quickToolsToggler) quickToolsToggler.style.display = 'none';
      }
  }

  if (quickTools) quickTools.style.display = 'none';
  if (quickToolsToggler) quickToolsToggler.style.display = 'none';
  editorManager.on('switch-file', updateToolbarVisibility);

  const scriptName = 'setup.sh';
  let scriptPathShell = `${workDirShell}/${scriptName}`;
  let logPathShell = `${workDirShell}/setup_log.txt`;
  let statusPathShell = `${workDirShell}/setup_status.txt`;

  function refreshShellPaths() {
    workDirShell = window.ANDRO_HOME || `$HOME/${pluginId}`;
    scriptPathShell = `${workDirShell}/${scriptName}`;
    logPathShell = `${workDirShell}/setup_log.txt`;
    statusPathShell = `${workDirShell}/setup_status.txt`;
  }
  refreshShellPaths();

  // ---------------- UI RENDERERS ---------------- //

  function renderWelcome() {
    // Check if ANDRO_HOME is set, otherwise show placeholder
    const currentHome = window.ANDRO_HOME || 'Not set';

    rootElement.innerHTML = `
      <div class="andro-wizard-container">
        <div class="andro-wizard-header">
           <img src="${assets.head}" style="width:20px;"> Android Builder Setup Wizard
        </div>
        <div class="andro-wizard-body">
           <div class="andro-wizard-title">Welcome back!</div>
           <div class="andro-wizard-text">
             This setup wizard will validate your current Android SDK and development environment setup. 
           </div>
           
           <div style="margin-top:15px; padding:10px; background:var(--secondary-color); border-radius:4px; font-size:0.8rem;">
              <strong>Installation Location:</strong><br>
              <span style="color:var(--link-color); word-break:break-all; font-weight: bold;">${currentHome}</span>
              
              <div style="margin-top: 8px; margin-bottom: 8px;">
                <span id="wiz-change-path" style="color: var(--link-color); text-decoration: underline; cursor: pointer; opacity: 0.9;">
                    Want to select custom android home?
                </span>
              </div>

              <em style="opacity:0.7;">Make sure this folder exists and is writable.</em>
           </div>
        </div>
        
        <div class="andro-wizard-footer">
           <button class="andro-wiz-btn btn-secondary" id="wiz-cancel">Cancel</button>
           <button class="andro-wiz-btn btn-primary" id="wiz-next">Next</button>
        </div>
      </div>
    `;
    
    // Logic for path selection
    rootElement.querySelector('#wiz-change-path').onclick = async () => {
        await selectAndroHome();
        // Re-render the welcome screen to update the displayed path
        renderWelcome(); 
    };

    rootElement.querySelector('#wiz-cancel').onclick = () => window.toast('Setup is required!', 2000);
    rootElement.querySelector('#wiz-next').onclick = renderVerifySettings;
  }

  // VERIFY SETTINGS 
  async function renderVerifySettings() {
    rootElement.innerHTML = `<div style="color:var(--primary-text-color);text-align:center;padding:50px;">Checking system status...</div>`;

    const missingItems = await getMissingComponents();
    
    let listHtml = '';
    let totalDownloadSize = 0.0;
    let totalInstallSize = 0.0;

    if (missingItems.length === 0) {
        listHtml = `<div class="andro-setup-item" style="color:#4CAF50;"><span>All components are present!</span><span>Verifying...</span></div>`;
    } else {
        missingItems.forEach(item => {
            if (item.rawSize) totalDownloadSize += item.rawSize;
            if (item.installSize) totalInstallSize += item.installSize;

            listHtml += `
              <div class="andro-setup-item">
                <span>${item.name}</span>
                <span class="andro-setup-size">${item.size}</span>
              </div>
            `;
        });
    }

    const fmtDownload = totalDownloadSize.toFixed(1) + " MB";
    let fmtInstall = totalInstallSize > 1000 
        ? "~" + (totalInstallSize / 1024).toFixed(2) + " GB" 
        : "~" + totalInstallSize.toFixed(0) + " MB";

    rootElement.innerHTML = `
      <div class="andro-wizard-container">
        <div class="andro-wizard-header">
           <img src="${assets.head}" style="width:20px;"> Verify Settings
        </div>
        <div class="andro-wizard-body" style="text-align: left;">
           <div style="margin-bottom:10px; font-weight:bold;">The following components will be installed/verified:</div>
           
           <div class="andro-setup-list">
              ${listHtml}
              
              <div class="andro-list-separator"></div>
              
              <div class="andro-setup-item" style="font-weight: bold; color: var(--link-color);">
                 <span>Total Download:</span>
                 <span>${fmtDownload}</span>
              </div>
              <div class="andro-setup-item" style="font-weight: bold; color: var(--secondary-text-color);">
                 <span>Est. Disk Usage:</span>
                 <span>${fmtInstall}</span>
              </div>
           </div>

           <div style="font-size:0.8rem; color:var(--secondary-text-color);">
             Target: ${window.ANDRO_HOME}
           </div>
        </div>
        <div class="andro-wizard-footer">
           <button class="andro-wiz-btn btn-secondary" id="wiz-prev">Previous</button>
           <button class="andro-wiz-btn btn-primary" id="wiz-finish">Install</button>
        </div>
      </div>
    `;

    rootElement.querySelector('#wiz-prev').onclick = renderWelcome;
    rootElement.querySelector('#wiz-finish').onclick = startInstallation;
  }

  // INSTALLATION SCREEN
  function renderInstallScreen() {
    rootElement.innerHTML = `
      <div class="andro-wizard-container">
        <div class="andro-wizard-header">
           <img src="${assets.head}" style="width:20px;"> Implementing Components
        </div>
        <div class="andro-wizard-body" style="text-align: left; justify-content: flex-start;">
           
           <div class="andro-progress-area">
             <div class="andro-progress-label" id="prog-title">Starting setup...</div>
             <div class="andro-progress-sub" id="prog-sub">Initializing...</div>
             <div class="andro-progress-track">
                <div class="andro-progress-fill" id="prog-bar"></div>
             </div>
             
             <button class="andro-wiz-btn btn-secondary" style="font-size:0.8rem; padding:5px 10px;" id="btn-details">Show Details</button>
           </div>

           <div class="andro-details-box" id="details-box">Initializing logs...</div>

        </div>
        <div class="andro-wizard-footer">
           <button class="andro-wiz-btn btn-disabled" id="wiz-done" disabled>Finish</button>
        </div>
      </div>
    `;

    const detailsBox = rootElement.querySelector('#details-box');
    rootElement.querySelector('#btn-details').onclick = (e) => {
        if(detailsBox.style.display === 'none' || !detailsBox.style.display) {
            detailsBox.style.display = 'block';
            e.target.innerText = 'Hide Details';
        } else {
            detailsBox.style.display = 'none';
            e.target.innerText = 'Show Details';
        }
    };
  }

  // 🛠️ FIX: Unicode Safe Base64 Encoding & Folder Creation
  async function startInstallation() {
    refreshShellPaths();
    renderInstallScreen();

    const scriptContent = getSetupScript(logPathShell, statusPathShell);
    const b64Script = btoa(unescape(encodeURIComponent(scriptContent)));

    try {
      const cmd =
        `mkdir -p "${workDirShell}" && ` +
        `echo "${b64Script}" | base64 -d > "${scriptPathShell}" && ` +
        `chmod +x "${scriptPathShell}" && ` +
        `echo "0:Starting..." > "${statusPathShell}" && ` +
        `echo "" > "${logPathShell}" && ` +
        `sh "${scriptPathShell}"`;

      await writeShared(cmd + "\r");
      monitorProgress();
    } catch (err) {
      window.toast('Error: ' + err.message, 4000);
    }
  }

  function monitorProgress() {
    const $bar = rootElement.querySelector('#prog-bar');
    const $title = rootElement.querySelector('#prog-title');
    const $sub = rootElement.querySelector('#prog-sub');
    const $logs = rootElement.querySelector('#details-box');
    const $btnFinish = rootElement.querySelector('#wiz-done');
    const $track = rootElement.querySelector('.andro-progress-track');

    let lastPercent = 0;
    let ticks = 0;
    let finished = false;

    // Indeterminate shimmer while waiting for first status
    if ($bar) {
      $bar.style.width = '8%';
      $bar.classList.add('andro-progress-indeterminate');
    }
    if ($sub) $sub.innerText = 'Working… (reading Alpine status)';

    const readAlpineFile = async (shellPath) => {
      try {
        const out = await executeCommand(
          `sh -c 'if [ -f "${shellPath}" ]; then cat "${shellPath}"; else echo ""; fi'`,
          true
        );
        return (out || '').toString();
      } catch (e) {
        return '';
      }
    };

    const interval = setInterval(async () => {
      if (finished) return;
      ticks += 1;
      try {
        refreshShellPaths();

        // Status from Alpine (Acode fs cannot read $HOME paths)
        const statusContent = await readAlpineFile(statusPathShell);
        const logContent = await readAlpineFile(logPathShell);

        if (logContent && $logs) {
          $logs.innerText = logContent;
          $logs.scrollTop = $logs.scrollHeight;
        }

        if (statusContent && statusContent.trim()) {
          const lines = statusContent.trim().split('\n').filter(Boolean);
          const lastLine = lines[lines.length - 1] || '';
          // format: "25:Downloading Gradle..." or "Error: message"
          const colon = lastLine.indexOf(':');
          let percent = '';
          let msg = lastLine;
          if (colon >= 0) {
            percent = lastLine.slice(0, colon).trim();
            msg = lastLine.slice(colon + 1).trim();
          }

          const n = parseInt(percent, 10);
          if (!Number.isNaN(n) && n >= 0) {
            lastPercent = Math.max(lastPercent, Math.min(100, n));
            if ($bar) {
              $bar.classList.remove('andro-progress-indeterminate');
              $bar.style.width = `${lastPercent}%`;
            }
          } else if ($bar && lastPercent === 0) {
            // pulse while unknown
            const pulse = 8 + (ticks % 12) * 2;
            $bar.style.width = `${pulse}%`;
          }

          if (msg && $sub) $sub.innerText = msg;

          if (lastLine.includes('Error') || /^Error\b/i.test(percent)) {
            if ($title) $title.innerText = 'Installation Failed';
            if ($bar) {
              $bar.classList.remove('andro-progress-indeterminate');
              $bar.style.backgroundColor = '#F44336';
              $bar.style.width = `${Math.max(lastPercent, 5)}%`;
            }
            finished = true;
            clearInterval(interval);
            if ($btnFinish) {
              $btnFinish.disabled = false;
              $btnFinish.classList.remove('btn-disabled');
              $btnFinish.classList.add('btn-primary');
            }
            return;
          }

          if (!Number.isNaN(n) && n >= 100) {
            if ($title) $title.innerText = 'Setup Complete!';
            if ($bar) {
              $bar.classList.remove('andro-progress-indeterminate');
              $bar.style.width = '100%';
              $bar.style.backgroundColor = '#4CAF50';
            }
            finished = true;
            clearInterval(interval);
            if ($btnFinish) {
              $btnFinish.disabled = false;
              $btnFinish.classList.remove('btn-disabled');
              $btnFinish.classList.add('btn-primary');
              setSetupComplete();
              $btnFinish.onclick = () => {
                showBuilderPage();
              };
            }
          }
        } else if ($bar && lastPercent === 0) {
          const pulse = 5 + (ticks % 15) * 2;
          $bar.style.width = `${pulse}%`;
          if ($sub && ticks % 4 === 0) {
            $sub.innerText = 'Downloading / installing… (status file not ready yet)';
          }
        }

        // Safety timeout ~25 min
        if (ticks > 1500) {
          finished = true;
          clearInterval(interval);
          if ($title) $title.innerText = 'Timed out — check terminal logs';
          if ($btnFinish) {
            $btnFinish.disabled = false;
            $btnFinish.classList.remove('btn-disabled');
          }
        }
      } catch (e) {
        console.warn('[Setup] monitor tick', e);
      }
    }, 1000);
  }


  renderWelcome();
}