import plugin from '../../../plugin.json';
import { svgs } from '../../assets/icons/svg/svg.js';
import { assets } from '../../assets/assets.js';
import { pageStyles } from '../../styles/styles.js';
import { buildManager } from './buildManager.js';
import { keystoreManager } from './keystoreManager.js';
import { IconGenerationUI } from '../icon/IconGenerationUI.js';
import { SplashStudioUI } from '../splash/SplashStudioUI.js';
import { SvgStudioUI } from '../svg/SvgStudioUI.js';
import { findLauncherIconUrl } from '../icon/loadProjectIcon.js';
import { FeatureStoreUI } from '../../features/FeatureStoreUI.js';
import { getSettings } from '../../services/settings.js';
import {
  readAndroidBuildHints,
  applyAndroidBuildHints,
  readAndroidFeatureHints,
  applyAndroidFeatureHints,
} from './AndroidGithubBuild.js';
import {
  ensureProjectGithubConfig,
  writeProjectGithubConfig,
  projectLeafName,
  sanitizeRepoName,
  randomRepoSuffix,
  makeProjectId,
} from './projectGithubConfig.js';


const fs = acode.require('fs');

export class BuildSettingsUI {
  constructor() {
    this.tabId = 'android.build.settings';
    this.editorFile = null;
    this.projectPath = '';
    this.gradlePropsData = []; 
    this.originalContent = ""; 
    
    // Suggestions Database
    this.knownProps = {
        "android.aapt2FromMavenOverride": [
            { val: `-/data/user/0/${window.ACODE_ID}/files/alpine/home/${plugin.id}/build-tools/34.0.0/aapt2`, desc: "Arm64 aapt2" },
        ],
        "org.gradle.jvmargs": [
        { val: "-Xmx2048m -Dfile.encoding=UTF-8", desc: "Boost (High RAM)" },
        { val: "-Xmx1536m -Dfile.encoding=UTF-8", desc: "Balanced (4GB RAM)" },
        { val: "-Xmx768m -Dfile.encoding=UTF-8", desc: "Save Memory (Low End)" },
        { val: "-Xmx768m -Dfile.encoding=UTF-8 -Dorg.gradle.native=false -Dorg.gradle.vfs.watch=false -Dorg.gradle.daemon=false -Dkotlin.compiler.execution.strategy=in-process", desc: "Save Memory (Safer Version)" }
        ],
        "org.gradle.parallel": [
            { val: "true", desc: "Enable Parallel Build" },
            { val: "false", desc: "Disable" }
        ],
        "org.gradle.daemon": [
            { val: "true", desc: "Keep Daemon Alive (Fast)" },
            { val: "false", desc: "Kill after build (Battery)" }
        ],
        "org.gradle.vfs.watch": [
            { val: "true", desc: "Watch File Changes" },
            { val: "false", desc: "Disable Watching" }
        ],
        "org.gradle.native": [
            { val: "false", desc: "Disable Native (Fix Crashes)" }
        ],
        "android.useAndroidX": [
            { val: "true", desc: "Use AndroidX Libs" }
        ],
        "android.enableJetifier": [
            { val: "true", desc: "Migrate 3rd party libs" }
        ],
        "kotlin.code.style": [
            { val: "official", desc: "Official Kotlin Style" }
        ]
    };
  }

  async show(rawPath) {
    this.projectPath = this.resolveProjectRoot(rawPath);
    console.log("Resolved Project Root:", this.projectPath);

    // 🔥 NEW: Fetch Project Details (Name & Package)
    const appDetails = await this.getAppDetails(this.projectPath);

    // Check if triggered from gradle.properties
    const isPropFile = rawPath.endsWith('gradle.properties');
    const hideStyle = isPropFile ? 'display: none !important;' : '';

    const EditorFile = acode.require('editorFile');
    
    // UI Container
    const $container = document.createElement('div');
    $container.className = 'andro-config-container';
    this._configContainer = $container;

    // 🔥 UPDATED UI HEADER: Show Project Name & Package instead of generic title
    const packageDisplay = appDetails.packageName 
        ? `<div style="font-size: 0.85rem; color: rgb(76, 175, 80); margin-top: 5px; font-family: monospace; top: -120px; position: relative;">${appDetails.packageName}</div>` 
        : `<div style="font-size:0.85rem; color:#FF9800; margin-top:5px;top: -120px; position: relative;">⚠️ Package not found</div>`;
        

    $container.innerHTML = `
      <div style="text-align:center; margin-bottom:20px;" id="config-header-block">
          <div id="config-app-icon-wrap" style="margin:0 auto 8px;width:72px;height:72px;border-radius:16px;overflow:hidden;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;">
            <img id="config-app-icon" alt="" style="width:100%;height:100%;object-fit:cover;display:none;">
            <span id="config-app-icon-ph" style="font-size:0.65rem;opacity:0.45;">icon</span>
          </div>
          <img src="${assets.text}" class="config-logo" style="width:180px; height:auto; opacity:0.9;">
          <div class="config-title" style="margin-top: 10px; font-size: 1.2rem; top: -50px; position: relative;">${appDetails.projectName}</div>
          ${packageDisplay}
      </div>

      <div class="config-card">
         <div class="config-group" id="build-via-banner">
            <label class="config-label">Build via</label>
            <div style="font-size:0.85rem;opacity:0.9;margin-bottom:8px;" id="build-via-label">…</div>
            <div id="github-build-fields" style="display:none;text-align:left;">
              <div class="input-group">
                <label>GitHub repo (owner/repo) — per project</label>
                <input type="text" id="gh-repo" placeholder="blank = auto-create for this project">
                <p style="font-size:0.7rem;opacity:0.65;margin:4px 0 0;">
                  Saved in <code>.xhlp-github.json</code>. New project starts blank.
                </p>
              </div>
              <div class="input-group">
                <label>GitHub token</label>
                <input type="password" id="gh-token" placeholder="ghp_…">
              </div>
              <label style="display:flex;align-items:flex-start;gap:8px;font-size:0.8rem;margin:8px 0;">
                <input type="checkbox" id="gh-auto-repo" style="margin-top:3px;" checked>
                <span><strong>Auto-create private repo</strong> if missing<br>
                <span style="opacity:0.7">Token needs repo + workflow scopes.</span></span>
              </label>
              <label style="display:flex;align-items:flex-start;gap:8px;font-size:0.8rem;margin:8px 0;">
                <input type="checkbox" id="gh-force-new" style="margin-top:3px;">
                <span><strong>Force create new repo</strong><br>
                <span style="opacity:0.7">Adds random suffix to project name (always starts unchecked).</span></span>
              </label>
              <label style="display:flex;align-items:center;gap:8px;font-size:0.8rem;margin:8px 0;">
                <input type="checkbox" id="gh-custom-wf"> Use custom workflow file
              </label>
              <div class="input-group">
                <label>Workflow path</label>
                <input type="text" id="gh-wf-path" placeholder=".github/workflows/xhlp-android-build.yml">
              </div>
            </div>
         </div>
         <div class="config-group">
            <label class="config-label">Build Variant</label>
            <div class="radio-grid">
               <label class="radio-item">
                  <input type="radio" name="variant" value="debug" checked id="radio-debug">
                  <div class="aid-radio-build">
                     <div style="font-weight:bold;">Debug</div>
                     <div style="font-size:0.75rem; opacity:0.7;">Auto Signed (Test)</div>
                  </div>
               </label>
               <label class="radio-item">
                  <input type="radio" name="variant" value="release" id="radio-release">
                  <div class="aid-radio-build">
                     <div style="font-weight:bold;">Release</div>
                     <div style="font-size:0.75rem; opacity:0.7;">Requires Keystore</div>
                  </div>
               </label>
            </div>
         </div>
         
         <div class="signing-section" id="signing-config">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <label class="config-label" style="margin:0;">Keystore Details</label>
                <button class="btn-create-ks" id="btn-create-ks">Create New</button>
            </div>
            
            <div class="input-group">
                <label>Keystore Path</label>
                <div style="display:flex; gap:5px;">
                    <input type="text" id="ks-path" placeholder="/sdcard/my-key.jks">
                    <button class="btn-create-ks" style="margin:0;" id="btn-pick-ks">${svgs.folder}</button>
                </div>
            </div>
            <div class="input-group">
                <label>Keystore Password</label>
                <input type="password" id="ks-pass" placeholder="Store Password">
            </div>
            <div class="input-group">
                <label>Key Alias</label>
                <input type="text" id="ks-alias" placeholder="e.g. key0">
            </div>
            <div class="input-group">
                <label>Key Password</label>
                <input type="password" id="ks-key-pass" placeholder="Alias Password">
            </div>
         </div>

         <div class="config-group">
            <label class="config-label">Output Format</label>
            <div class="radio-grid">
               <label class="radio-item">
                  <input type="radio" name="format" value="apk" checked>
                  <div class="aid-radio-build">
                     <div style="font-weight:bold;">APK</div>
                     <div style="font-size:0.75rem; opacity:0.7;">Installable</div>
                  </div>
               </label>
               <label class="radio-item">
                  <input type="radio" name="format" value="aab">
                  <div class="aid-radio-build">
                     <div style="font-weight:bold;">AAB</div>
                     <div style="font-size:0.75rem; opacity:0.7;">Play Store</div>
                  </div>
               </label>
            </div>
         </div>
      </div>

      <div class="section-header">
         <div class="config-title" style="margin:0;">SDK &amp; version</div>
         <div class="header-actions">
            <button class="btn-prop" id="btn-reload-sdk" title="Reload from project">↺</button>
            <button class="btn-prop" id="btn-save-sdk">Save to project</button>
         </div>
      </div>
      <div class="gradle-card" id="sdk-card-root">
         <div id="sdk-fields" style="padding:4px 0;">Loading…</div>
         <p style="font-size:0.72rem;opacity:0.6;margin:8px 4px 0;">
           From <code>app/build.gradle</code>. <strong>Terminal</strong>: compileSdk ≤ 34 recommended.
           <strong>GitHub</strong>: can use 35+.
         </p>
      </div>

      <div class="section-header" id="gradle-props-header" style="${hideStyle}">
         <div class="config-title" style="margin:0;">Gradle Properties</div>
         <div class="header-actions">
            <button class="btn-prop" id="btn-reset-gradle" title="Reset to Original">↺</button>
            <button class="btn-prop" id="btn-save-gradle">Save Changes</button>
         </div>
      </div>
      
      <div class="gradle-card" id="gradle-card-root" style="${hideStyle}">
         <div id="props-list-container">Loading properties...</div>
         <div id="suggestion-box" class="suggestion-box"></div>
      </div>

      <div class="section-header">
         <div class="config-title" style="margin:0;">App &amp; build features</div>
         <div class="header-actions">
            <button class="btn-prop" id="btn-reload-feat" title="Reload">↺</button>
            <button class="btn-prop" id="btn-save-feat">Save</button>
         </div>
      </div>
      <div class="gradle-card" id="feat-card-root">
         <div id="feat-fields" style="padding:4px 0;">Loading…</div>
         <p style="font-size:0.72rem;opacity:0.6;margin:8px 4px 0;">
           Writes to <code>app/build.gradle</code> — viewBinding, multiDex, release minify, applicationId.
         </p>
      </div>

      <div class="section-header">
         <div class="config-title" style="margin:0;">Project Tools</div>
      </div>
      <div class="config-card">
         <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #333;">
             <div>
                 <div style="font-weight:bold;">App Icon</div>
                 <div style="font-size:0.75rem; opacity:0.7;">Set icon for your project</div>
             </div>
             <button class="btn-prop" id="btn-tool-icon">Set Icon</button>
         </div>
         <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #333;">
             <div>
                 <div style="font-weight:bold;">Splash Screen</div>
                 <div style="font-size:0.75rem; opacity:0.7;">Android 12+ splash · themes · logo</div>
             </div>
             <button class="btn-prop" id="btn-tool-splash">Add Splash</button>
         </div>
         <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #333;">
             <div>
                 <div style="font-weight:bold;">SVG Studio</div>
                 <div style="font-size:0.75rem; opacity:0.7;">Edit colors · popup editor · SVG → Vector</div>
             </div>
             <button class="btn-prop" id="btn-tool-svg">Open SVG</button>
         </div>
         <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0;">
             <div>
                 <div style="font-weight:bold;">Feature Store</div>
                 <div style="font-size:0.75rem; opacity:0.7;">Inject code snippets & features</div>
             </div>
             <button class="btn-prop" id="btn-tool-store">Open Store</button>
         </div>
      </div>

      <div class="config-actions">
         <button class="btn-build-cancel" id="btn-cancel">Cancel</button>
         <button class="btn-build-start" id="btn-start">Start Build</button>
      </div>
    `;

    // Open Tab
    const existing = acode.require('openFolder').find(this.tabId);
    if(existing) existing.remove();

    this.editorFile = new EditorFile('Build Settings', {
        type: 'page',
        content: $container,
        id: this.tabId,
        tabIcon: 'icon aid-gradle-icon',
        stylesheets: [pageStyles]
    });

    // --- Logic ---
    const s = getSettings();
    const via = (s.androidBuildVia || 'github').toLowerCase();
    const viaLabel = $container.querySelector('#build-via-label');
    const ghFields = $container.querySelector('#github-build-fields');
    if (viaLabel) {
      viaLabel.textContent =
        via === 'terminal'
          ? 'Terminal (offline Gradle) — change in plugin Settings'
          : 'GitHub Actions — same Debug/Release + APK/AAB';
    }
    if (ghFields) {
      ghFields.style.display = via === 'github' ? 'block' : 'none';
      const r = $container.querySelector('#gh-repo');
      const tok = $container.querySelector('#gh-token');
      const custom = $container.querySelector('#gh-custom-wf');
      const wfp = $container.querySelector('#gh-wf-path');
      const autoR = $container.querySelector('#gh-auto-repo');
      const forceNew = $container.querySelector('#gh-force-new');
      // Token stays global; repo is per-project (.xhlp-github.json)
      if (tok) tok.value = s.androidGithubToken || '';
      if (custom) custom.checked = !!s.androidGithubUseCustomWorkflow;
      if (wfp) wfp.value = s.androidGithubWorkflowPath || '.github/workflows/xhlp-android-build.yml';
      if (autoR) autoR.checked = s.androidGithubAutoCreateRepo !== false;
      if (forceNew) forceNew.checked = false; // always start unchecked
      this._ghProjectCfg = await ensureProjectGithubConfig(this.projectPath);
      if (r) r.value = (this._ghProjectCfg && this._ghProjectCfg.repo) || '';
      const persistGh = async () => {
        try {
          const st = getSettings();
          st.androidGithubToken = $container.querySelector('#gh-token')?.value?.trim() || '';
          st.androidGithubUseCustomWorkflow = !!$container.querySelector('#gh-custom-wf')?.checked;
          st.androidGithubAutoCreateRepo = !!$container.querySelector('#gh-auto-repo')?.checked;
          const wp = $container.querySelector('#gh-wf-path')?.value?.trim();
          if (wp) st.androidGithubWorkflowPath = wp;
          acode.require('settings').update(false);
          const repoVal = $container.querySelector('#gh-repo')?.value?.trim() || '';
          const cfg = {
            ...(this._ghProjectCfg || {}),
            repo: repoVal,
            projectId: (this._ghProjectCfg && this._ghProjectCfg.projectId) || makeProjectId(),
          };
          this._ghProjectCfg = cfg;
          await writeProjectGithubConfig(this.projectPath, cfg);
        } catch (_) {}
      };
      ['#gh-repo', '#gh-token', '#gh-wf-path'].forEach((sel) => {
        const el = $container.querySelector(sel);
        if (el) {
          el.addEventListener('change', persistGh);
          el.addEventListener('blur', persistGh);
        }
      });
      $container.querySelector('#gh-custom-wf')?.addEventListener('change', persistGh);
      $container.querySelector('#gh-auto-repo')?.addEventListener('change', persistGh);
    }

    const signingSection = $container.querySelector('#signing-config');
    const radioDebug = $container.querySelector('#radio-debug');
    const radioRelease = $container.querySelector('#radio-release');
    
    radioDebug.onchange = () => signingSection.style.display = 'none';
    radioRelease.onchange = () => signingSection.style.display = 'block';

    $container.querySelector('#btn-pick-ks').onclick = async () => {
        const file = await acode.fileBrowser('file', 'Select Keystore');
        if (file) $container.querySelector('#ks-path').value = file.url;
    };

    $container.querySelector('#btn-create-ks').onclick = () => {
        this.showKeystoreGenerator($container);
    };

    // Tool Buttons Logic
    const refreshConfigIcon = async () => {
      try {
        const img = $container.querySelector('#config-app-icon');
        const ph = $container.querySelector('#config-app-icon-ph');
        if (!img) return;
        // Try module path and parent project path
        let hit = await findLauncherIconUrl(this.projectPath);
        if (!hit) {
          const base = String(this.projectPath || '').replace(/\/+$/, '');
          if (!/\/app$/i.test(base)) {
            hit = await findLauncherIconUrl(base + '/app');
          } else {
            hit = await findLauncherIconUrl(base.replace(/\/app$/i, ''));
          }
        }
        if (hit && hit.dataUrl && hit.dataUrl.indexOf('base64,iVBOR') > 0) {
          img.onload = () => {
            img.style.display = 'block';
            if (ph) ph.style.display = 'none';
          };
          img.onerror = () => {
            console.warn('[config-icon] decode failed');
            img.removeAttribute('src');
            img.style.display = 'none';
            if (ph) {
              ph.style.display = 'block';
              ph.textContent = 'no icon';
            }
          };
          img.style.display = 'none';
          img.src = hit.dataUrl;
        } else if (ph) {
          ph.textContent = 'no icon';
          ph.style.display = 'block';
          img.removeAttribute('src');
          img.style.display = 'none';
        }
      } catch (e) {
        console.warn('config icon', e);
      }
    };
    refreshConfigIcon();
    const onIconUp = (ev) => {
      if (!ev.detail || !this.projectPath) return;
      refreshConfigIcon();
    };
    window.addEventListener('xhlp-icon-updated', onIconUp);
    // cleanup when tab closes if possible
    try {
      this.editorFile?.onclose?.(() => window.removeEventListener('xhlp-icon-updated', onIconUp));
    } catch (_) {}

    $container.querySelector('#btn-tool-icon').onclick = () => {
        new IconGenerationUI().show(rawPath);
    };

    $container.querySelector('#btn-tool-splash').onclick = () => {
        new SplashStudioUI().show(rawPath);
    };

    $container.querySelector('#btn-tool-svg').onclick = () => {
        new SvgStudioUI().show(rawPath);
    };

    $container.querySelector('#btn-tool-store').onclick = () => {
        new FeatureStoreUI(this.projectPath).show();
    };

    $container.querySelector('#btn-cancel').onclick = () => this.editorFile.remove();

    $container.querySelector('#btn-start').onclick = async () => {
        const variant = $container.querySelector('input[name="variant"]:checked').value;
        const format = $container.querySelector('input[name="format"]:checked').value;

        try { await this._saveSdkFields($container); } catch (e) { console.warn('sdk save', e); }
        try { await this._saveFeatureFields($container); } catch (e) { console.warn('feat save', e); }

        let forceNewRepo = false;
        try {
          const st = getSettings();
          if ((st.androidBuildVia || 'github') === 'github') {
            const tok = $container.querySelector('#gh-token')?.value?.trim();
            const custom = !!$container.querySelector('#gh-custom-wf')?.checked;
            const wfp = $container.querySelector('#gh-wf-path')?.value?.trim();
            if (tok != null) st.androidGithubToken = tok;
            st.androidGithubUseCustomWorkflow = custom;
            if (wfp) st.androidGithubWorkflowPath = wfp;
            st.androidGithubAutoCreateRepo = !!$container.querySelector('#gh-auto-repo')?.checked;
            forceNewRepo = !!$container.querySelector('#gh-force-new')?.checked;
            acode.require('settings').update(false);

            let repoVal = $container.querySelector('#gh-repo')?.value?.trim() || '';
            if (forceNewRepo) {
              const leaf = sanitizeRepoName(projectLeafName(this.projectPath));
              const suffix = randomRepoSuffix();
              // owner filled at build time if only name
              repoVal = repoVal.includes('/')
                ? repoVal.split('/')[0] + '/' + leaf + '-' + suffix
                : leaf + '-' + suffix;
              const rin = $container.querySelector('#gh-repo');
              if (rin) rin.value = repoVal;
            }
            const cfg = {
              ...(this._ghProjectCfg || {}),
              repo: repoVal,
              projectId: (this._ghProjectCfg && this._ghProjectCfg.projectId) || makeProjectId(),
            };
            this._ghProjectCfg = cfg;
            await writeProjectGithubConfig(this.projectPath, cfg);
          }
        } catch (_) {}
        
        let signingInfo = null;
        if (variant === 'release') {
            const path = $container.querySelector('#ks-path').value;
            const password = $container.querySelector('#ks-pass').value;
            const alias = $container.querySelector('#ks-alias').value;
            const aliasPass = $container.querySelector('#ks-key-pass').value;

            if ((getSettings().androidBuildVia || 'github') === 'terminal') {
              if (!path || !password || !alias || !aliasPass) {
                  window.toast("Please fill all Keystore details for Release build", 4000);
                  return;
              }
              signingInfo = { path, password, alias, aliasPass };
            } else {
              window.toast('GitHub release: unsigned unless signing secrets in workflow', 3500);
            }
        }
        
        this.editorFile.remove();
        const viaNow = (getSettings().androidBuildVia || 'github').toLowerCase();
        const cs = parseInt($container.querySelector('#sdk-compile')?.value || this._sdkHints?.compileSdk || '34', 10);
        if (viaNow === 'terminal' && cs > 34) {
          window.toast('Terminal: compileSdk ' + cs + ' may fail (device SDK often ≤34). Use GitHub for API 35+.', 4500);
        }
        buildManager.startBuild(rawPath, { variant, format, signingInfo, forceNewRepo, projectGithub: this._ghProjectCfg });
    };

    if (via === 'github') {
      const gh = $container.querySelector('#gradle-props-header');
      const gc = $container.querySelector('#gradle-card-root');
      if (gh) gh.style.display = 'none';
      if (gc) gc.style.display = 'none';
    } else {
      try { this.initGradleEditor($container); } catch (e) { console.warn('gradle editor', e); }
    }
    try {
      if (typeof this.initSdkVersionEditor === 'function') {
        await this.initSdkVersionEditor($container);
      } else if (typeof BuildSettingsUI.prototype.initSdkVersionEditor === 'function') {
        await BuildSettingsUI.prototype.initSdkVersionEditor.call(this, $container);
      } else {
        console.error('[BuildSettingsUI] initSdkVersionEditor missing on instance');
        const box = $container.querySelector('#sdk-fields');
        if (box) box.innerHTML = '<div style="color:#FF9800;font-size:0.8rem;">SDK fields unavailable — reload plugin</div>';
      }
    } catch (e) {
      console.warn('sdk editor', e);
    }
    try {
      await this.initFeatureEditor($container);
    } catch (e) {
      console.warn('feat editor', e);
    }
  }

// Multi-Path Search Strategy
  async getAppDetails(moduleRoot) {
      const fsApi = acode.require('fs');
      let packageName = null;
      let projectName = 'Android Project';

      if (!moduleRoot) return { projectName, packageName };

      try {
          const base = String(moduleRoot).replace(/\/+$/, '');
          const display = base.replace(/^file:\/\//, '').replace(/\/+$/, '');
          const leaf = display.split('/').filter(Boolean).pop() || 'Project';
          projectName = leaf.charAt(0).toUpperCase() + leaf.slice(1);

          const roots = [base];
          if (/\/app$/i.test(base)) roots.push(base.replace(/\/app$/i, ''));
          else roots.push(this._joinUri(base, 'app'));

          const tryRead = async (url) => {
              try {
                  const f = fsApi(url);
                  if (f && typeof f.exists === 'function' && (await f.exists())) {
                      return String(await f.readFile('utf-8'));
                  }
              } catch (_) {}
              return null;
          };

          for (const root of roots) {
              // AGP 8+: package often only in namespace / applicationId
              for (const g of [
                  'app/build.gradle',
                  'app/build.gradle.kts',
                  'build.gradle',
                  'build.gradle.kts',
              ]) {
                  const text = await tryRead(this._joinUri(root, g));
                  if (!text) continue;
                  let mm = text.match(/namespace\s*[=:]?\s*['"]([^'"]+)['"]/);
                  if (mm) {
                      packageName = mm[1];
                      break;
                  }
                  mm = text.match(/applicationId\s*[=:]?\s*['"]([^'"]+)['"]/);
                  if (mm) {
                      packageName = mm[1];
                      break;
                  }
              }
              if (packageName) break;

              for (const mpath of [
                  'app/src/main/AndroidManifest.xml',
                  'src/main/AndroidManifest.xml',
                  'AndroidManifest.xml',
              ]) {
                  const text = await tryRead(this._joinUri(root, mpath));
                  if (!text) continue;
                  const mm = text.match(/package\s*=\s*["']([^"']+)["']/);
                  if (mm) {
                      packageName = mm[1];
                      break;
                  }
              }
              if (packageName) break;
          }
      } catch (e) {
          console.error('[AppDetails]', e);
      }
      return { projectName, packageName };
  }
  

  async initFeatureEditor($container) {
      const box = $container.querySelector('#feat-fields');
      if (!box) return;
      let feats = {
        applicationId: '',
        namespace: '',
        viewBinding: false,
        dataBinding: false,
        multiDexEnabled: false,
        minifyEnabled: false,
      };
      try {
        feats = await readAndroidFeatureHints(this.projectPath);
      } catch (e) {
        console.warn('[Feat] read', e);
      }
      this._featHints = feats;
      const esc = (v) => String(v != null ? v : '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      const chk = (id, label, on, hint) =>
        `<label style="display:flex;align-items:flex-start;gap:8px;font-size:0.82rem;margin:8px 0;">` +
        `<input type="checkbox" id="${id}" ${on ? 'checked' : ''} style="margin-top:3px;">` +
        `<span><strong>${label}</strong>` +
        (hint ? `<br><span style="opacity:0.65;font-size:0.72rem;">${hint}</span>` : '') +
        `</span></label>`;
      box.innerHTML = [
        `<div class="input-group" style="margin-bottom:10px;">` +
          `<label style="font-size:0.8rem;opacity:0.85;">applicationId</label>` +
          `<input type="text" id="feat-appid" value="${esc(feats.applicationId)}" placeholder="com.example.app" style="width:100%;">` +
        `</div>`,
        `<div class="input-group" style="margin-bottom:10px;">` +
          `<label style="font-size:0.8rem;opacity:0.85;">namespace</label>` +
          `<input type="text" id="feat-ns" value="${esc(feats.namespace)}" placeholder="com.example.app" style="width:100%;">` +
        `</div>`,
        chk('feat-vb', 'View Binding', feats.viewBinding, 'buildFeatures.viewBinding — type-safe view access'),
        chk('feat-db', 'Data Binding', feats.dataBinding, 'buildFeatures.dataBinding — layout expressions'),
        chk('feat-md', 'MultiDex', feats.multiDexEnabled, 'defaultConfig.multiDexEnabled — large apps'),
        chk('feat-min', 'Release minify (R8)', feats.minifyEnabled, 'buildTypes.release.minifyEnabled'),
      ].join('');

      const reload = $container.querySelector('#btn-reload-feat');
      const save = $container.querySelector('#btn-save-feat');
      if (reload) {
        reload.onclick = async () => {
          window.toast('Reloading features…', 1200);
          await this.initFeatureEditor($container);
        };
      }
      if (save) {
        save.onclick = async () => {
          const ok = await this._saveFeatureFields($container);
          window.toast(ok ? 'Features saved to build.gradle' : 'Could not write build.gradle', 2500);
        };
      }
  }

  async _saveFeatureFields($container) {
      const feats = {
        ...(this._featHints || {}),
        applicationId: $container.querySelector('#feat-appid')?.value?.trim() || '',
        namespace: $container.querySelector('#feat-ns')?.value?.trim() || '',
        viewBinding: !!$container.querySelector('#feat-vb')?.checked,
        dataBinding: !!$container.querySelector('#feat-db')?.checked,
        multiDexEnabled: !!$container.querySelector('#feat-md')?.checked,
        minifyEnabled: !!$container.querySelector('#feat-min')?.checked,
      };
      this._featHints = feats;
      try {
        const ok = await applyAndroidFeatureHints(this.projectPath, feats);
        if (ok) this._refreshPackageBanner(feats.applicationId || feats.namespace);
        return ok;
      } catch (e) {
        console.warn('[Feat] apply', e);
        return false;
      }
  }

  _refreshPackageBanner(pkg) {
    if (!pkg || !this._configContainer) return;
    // green package line under title
    const nodes = this._configContainer.querySelectorAll('div');
    for (const el of nodes) {
      const st = el.getAttribute('style') || '';
      if (st.includes('monospace') && (st.includes('76, 175, 80') || st.includes('#4CAF50') || st.includes('color:#FF9800'))) {
        el.textContent = pkg;
        el.style.color = 'rgb(76, 175, 80)';
        return;
      }
    }
  }

  async initSdkVersionEditor($container) {
      const box = $container.querySelector('#sdk-fields');
      if (!box) return;
      const via = (getSettings().androidBuildVia || 'github').toLowerCase();
      const s = getSettings();
      let hints = {
        compileSdk: via === 'github' ? (s.androidSdkCompile || '36') : (s.androidSdkCompile || '34'),
        minSdk: via === 'github' ? (s.androidSdkMin || '26') : (s.androidSdkMin || '24'),
        targetSdk: via === 'github' ? (s.androidSdkTarget || '36') : (s.androidSdkTarget || '34'),
        versionCode: '1',
        versionName: '1.0',
        javaVersion: s.androidSdkJava || '17',
      };
      try {
        const fileHints = await readAndroidBuildHints(this.projectPath);
        hints = { ...hints, ...fileHints };
      } catch (e) {
        console.warn('[SDK] read hints', e);
      }
      // GitHub mode + template still 34 + user never customized → prefer 36 / 26
      if (via === 'github' && !s.androidSdkUserSet && String(hints.compileSdk) === '34') {
        hints.compileSdk = s.androidSdkCompile || '36';
        hints.minSdk = s.androidSdkMin || '26';
        hints.targetSdk = s.androidSdkTarget || hints.compileSdk;
      }
      this._sdkHints = hints;
      const esc = (v) => String(v != null ? v : '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      const row = (id, label, val, hint) =>
        '<div class="input-group" style="margin-bottom:10px;">' +
        '<label style="font-size:0.8rem;opacity:0.85;">' + label + '</label>' +
        '<input type="text" id="' + id + '" value="' + esc(val) + '" placeholder="' + (hint || '') + '" style="width:100%;">' +
        '</div>';
      box.innerHTML = [
        row('sdk-compile', 'compileSdk', hints.compileSdk, via === 'github' ? '36' : '34'),
        row('sdk-min', 'minSdk', hints.minSdk, via === 'github' ? '26' : '24'),
        row('sdk-target', 'targetSdk', hints.targetSdk, via === 'github' ? '36' : '34'),
        row('sdk-vcode', 'versionCode', hints.versionCode, '1'),
        row('sdk-vname', 'versionName', hints.versionName, '1.0'),
        row('sdk-java', 'Java version (CI)', hints.javaVersion, '17'),
      ].join('');

      const reload = $container.querySelector('#btn-reload-sdk');
      const save = $container.querySelector('#btn-save-sdk');
      if (reload) {
        reload.onclick = async () => {
          window.toast('Reloading SDK fields…', 1200);
          await this.initSdkVersionEditor($container);
        };
      }
      if (save) {
        save.onclick = async () => {
          const ok = await this._saveSdkFields($container);
          window.toast(ok ? 'Saved to build.gradle' : 'Could not write build.gradle', 2500);
        };
      }
  }

  async _saveSdkFields($container) {
      const get = (id) => $container.querySelector('#' + id)?.value?.trim();
      const hints = {
        ...(this._sdkHints || {}),
        compileSdk: get('sdk-compile'),
        minSdk: get('sdk-min'),
        targetSdk: get('sdk-target'),
        versionCode: get('sdk-vcode'),
        versionName: get('sdk-vname'),
        javaVersion: get('sdk-java'),
      };
      this._sdkHints = hints;
      try {
        const st = getSettings();
        st.androidSdkCompile = hints.compileSdk;
        st.androidSdkMin = hints.minSdk;
        st.androidSdkTarget = hints.targetSdk;
        st.androidSdkJava = hints.javaVersion;
        st.androidSdkUserSet = true;
        acode.require('settings').update(false);
      } catch (_) {}
      const via = (getSettings().androidBuildVia || 'github').toLowerCase();
      if (via === 'terminal' && parseInt(hints.compileSdk, 10) > 34) {
        window.toast(
          'Warning: Terminal build may fail with compileSdk ' + hints.compileSdk + ' (SDK often ≤34). Prefer GitHub for API 35+.',
          5000
        );
      }
      try {
        return await applyAndroidBuildHints(this.projectPath, hints);
      } catch (e) {
        console.warn('[SDK] apply', e);
        return false;
      }
  }

  async initGradleEditor($container) {
      const propsPath = `${this.projectPath}/gradle.properties`;
      const $list = $container.querySelector('#props-list-container');
      const $btnSave = $container.querySelector('#btn-save-gradle');
      const $btnReset = $container.querySelector('#btn-reset-gradle');

      // DEFAULT PROPERTIES (Fallback)
      const defaultProps = `# Optimized by Android Builder
org.gradle.jvmargs=-Xmx768m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.enableJetifier=true
android.nonTransitiveRClass=true
org.gradle.vfs.watch=false
org.gradle.native=false
`;

      try {
          const fsInterface = fs(propsPath);
          const fileExists = await fsInterface.exists();
          
          if (!fileExists) {
            await fsInterface.writeFile(defaultProps);
          }

          let content = await fsInterface.readFile('utf-8');
          
          if (typeof content !== 'string') throw new Error("File content is not text");

          // Detect Empty File and Populate Default
          if (!content.trim()) {
              content = defaultProps;
          }

          this.originalContent = content; // Store for Reset
          this.parseGradleContent(content);
          this.renderGradleList($list, $container);

      } catch (e) {
          $list.innerHTML = `<div style="color:red; font-size:0.8rem;">Error: ${e.message}</div>`;
      }

      // SAVE LOGIC: Filters out blank props
      $btnSave.onclick = async () => {
          const content = this.gradlePropsData.map(item => {
              if (item.type === 'comment') return item.value;
              
              // Remove if key or value is blank
              if (!item.key.trim() || !item.value.trim()) return null;

              return `${item.key}=${item.value}`;
          })
          .filter(line => line !== null) // Remove nulls
          .join('\n');

          try {
              await fs(propsPath).writeFile(content);
              this.originalContent = content; 
              window.toast("Gradle Settings Saved!");
              this.parseGradleContent(content); 
              this.renderGradleList($list, $container);
          } catch (e) {
              window.toast("Failed to save settings: " + e.message);
          }
      };

      // RESET LOGIC
      $btnReset.onclick = () => {
          this.parseGradleContent(this.originalContent);
          this.renderGradleList($list, $container);
          window.toast("Reset to original state");
      };
  }

  parseGradleContent(content) {
      if(!content) return; 
      this.gradlePropsData = content.split('\n').map((line, index) => {
          const trimmed = line.trim();
          // Detect Comment OR Blank line
          if (!trimmed || trimmed.startsWith('#')) {
              return { type: 'comment', value: trimmed, id: index };
          }
          const splitIdx = line.indexOf('=');
          if (splitIdx === -1) return { type: 'comment', value: line, id: index };
          
          return {
              type: 'property',
              key: line.substring(0, splitIdx).trim(),
              value: line.substring(splitIdx + 1).trim(),
              id: index
          };
      });
  }

  renderGradleList($list, $container) {
      $list.innerHTML = '';
      
      this.gradlePropsData.forEach((item, index) => {
          const row = document.createElement('div');
          
          if (item.type === 'comment') {
              if (!item.value.trim()) {
                  row.className = 'prop-row blank';
              } else {
                  row.className = 'prop-row comment';
                  row.innerHTML = `<input class="prop-comment-text" value="${item.value}" readonly>`;
              }
          } else {
              row.className = 'prop-row';
              row.innerHTML = `
                  <input class="prop-key" value="${item.key}" data-index="${index}" placeholder="Property">
                  <span class="prop-equals">=</span>
                  <input class="prop-value" value="${item.value}" data-index="${index}" placeholder="Value">
                  <button class="btn-prop-del" title="Delete Line">
                      <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                  </button>
              `;

              const keyInput = row.querySelector('.prop-key');
              const valInput = row.querySelector('.prop-value');
              const delBtn = row.querySelector('.btn-prop-del');

              keyInput.oninput = (e) => {
                  this.gradlePropsData[index].key = e.target.value;
                  this.showSuggestions(e.target, 'key', $container);
              };
              keyInput.onfocus = (e) => this.showSuggestions(e.target, 'key', $container);

              valInput.oninput = (e) => {
                  this.gradlePropsData[index].value = e.target.value;
                  this.showSuggestions(e.target, 'value', $container, this.gradlePropsData[index].key);
              };
              valInput.onfocus = (e) => this.showSuggestions(e.target, 'value', $container, this.gradlePropsData[index].key);

              delBtn.onclick = () => {
                  this.gradlePropsData.splice(index, 1);
                  this.renderGradleList($list, $container);
              };
          }
          $list.appendChild(row);
      });

      const addRow = document.createElement('div');
      addRow.className = 'add-row';
      addRow.innerHTML = `<button class="btn-add-prop" title="Add Property">+</button>`;
      
      addRow.querySelector('.btn-add-prop').onclick = () => {
          this.gradlePropsData.push({ type: 'property', key: '', value: '', id: Date.now() });
          this.renderGradleList($list, $container);
          
          setTimeout(() => {
              const inputs = $list.querySelectorAll('.prop-key');
              if(inputs.length > 0) inputs[inputs.length - 1].focus();
          }, 50);
      };
      
      $list.appendChild(addRow);

      document.addEventListener('click', (e) => {
          if (!e.target.closest('.prop-row') && !e.target.closest('.suggestion-box')) {
              this.hideSuggestions($container);
          }
      });
  }

  showSuggestions(input, type, $container, parentKey = null) {
      const box = $container.querySelector('#suggestion-box');
      const val = input.value.toLowerCase();
      let matches = [];

      if (type === 'key') {
          const keys = Object.keys(this.knownProps);
          matches = keys.filter(k => k.toLowerCase().includes(val)).map(k => ({ val: k, desc: '' }));
      } else if (type === 'value' && parentKey && this.knownProps[parentKey]) {
          matches = this.knownProps[parentKey].filter(v => v.val.toLowerCase().includes(val));
      }

      if (matches.length === 0) {
          this.hideSuggestions($container);
          return;
      }

      box.innerHTML = '';
      matches.forEach(item => {
          const div = document.createElement('div');
          div.className = 'suggestion-item';
          div.innerHTML = `<span class="sugg-main">${item.val}</span> <span class="sugg-desc">${item.desc}</span>`;
          
          div.onclick = () => {
              input.value = item.val;
              input.dispatchEvent(new Event('input'));
              this.hideSuggestions($container);
              
              if (type === 'key') {
                  const sibling = input.parentElement.querySelector('.prop-value');
                  if (sibling) sibling.focus();
              }
          };
          box.appendChild(div);
      });

      const rect = input.getBoundingClientRect();
      const card = $container.querySelector('.gradle-card');
      const cardRect = card.getBoundingClientRect();

      box.style.top = (rect.bottom - cardRect.top + card.scrollTop) + 'px';
      box.style.left = (rect.left - cardRect.left) + 'px';
      box.style.display = 'block';
  }

  hideSuggestions($container) {
      const box = $container.querySelector('#suggestion-box');
      if(box) box.style.display = 'none';
  }

  showKeystoreGenerator(parentContainer) {
      const $modal = document.createElement('div');
      $modal.className = 'andro-ks-modal';
      $modal.innerHTML = `
        <div class="andro-ks-content">
            <h3 style="margin-top:0; color:#fff;">Generate Keystore</h3>
            <div class="ks-form">
                <input id="gen-filename" placeholder="Filename (e.g. release_1.jks)" value="release_1.jks">
                <input id="gen-pass" type="password" placeholder="Password (min 6 chars)" value="123456">
                <input id="gen-alias" placeholder="Alias (e.g. key0)" value="key0">
                <input id="gen-cn" placeholder="Full Name (CN)" value="Android Dev">
                <input id="gen-o" placeholder="Organization (O)" value="World Organization">
            </div>
            <div class="ks-actions" style="margin-top:15px; text-align:right;">
                <button id="btn-ks-cancel">Cancel</button>
                <button id="btn-ks-gen">Generate</button>
            </div>
            <p style="font-size:0.75rem; color:#888; margin-top:10px;">Location: Project Root</p>
        </div>
      `;

      Object.assign($modal.style, {
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
      });
      
      const contentStyle = $modal.querySelector('.andro-ks-content').style;
      Object.assign(contentStyle, {
          background: '#252526', padding: '20px', 
          borderRadius: '2px', width: '85%', maxWidth: '350px', 
          boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
      });

      $modal.querySelectorAll('input').forEach(el => {
          Object.assign(el.style, {
              width: '100%', padding: '8px', margin: '5px 0',
              background: '#333', border: '1px solid #444', color: '#fff', 
              outline:'none', height : '33px', borderRadius: '2px'
          });
      });

      const btnCancel = $modal.querySelector('#btn-ks-cancel');
      const btnGen = $modal.querySelector('#btn-ks-gen');
      
      Object.assign(btnCancel.style, { 
          padding: '8px 15px', border: 'none', background: '#555', color: '#fff', 
          marginRight: '10px', borderRadius: '2px'
      });
      
      Object.assign(btnGen.style, { 
          padding: '8px 15px', border: 'none', background: '#2196F3', color: '#fff', 
          borderRadius: '2px'
      });

      document.body.appendChild($modal);

      btnCancel.onclick = () => $modal.remove();

      btnGen.onclick = () => {
          const filename = document.getElementById('gen-filename').value || 'release.jks';
          const password = document.getElementById('gen-pass').value || '123456';
          const alias = document.getElementById('gen-alias').value || 'key0';
          const cn = document.getElementById('gen-cn').value || 'Android Dev';
          const o = document.getElementById('gen-o').value || 'Indie';

          $modal.remove();

          keystoreManager.createKeystore({
              path: this.projectPath.replace('file://', ''),
              filename, password, alias, aliasPass: password,
              dname: { cn, ou: 'Dev', o, l: 'City', st: 'State', c: 'US' }
          }, (fullPath) => {
              if(parentContainer && parentContainer.isConnected) {
                  const pathInput = parentContainer.querySelector('#ks-path');
                  const passInput = parentContainer.querySelector('#ks-pass');
                  const aliasInput = parentContainer.querySelector('#ks-alias');
                  const keyPassInput = parentContainer.querySelector('#ks-key-pass');

                  if(pathInput) pathInput.value = "file://" + fullPath;
                  if(passInput) passInput.value = password;
                  if(aliasInput) aliasInput.value = alias;
                  if(keyPassInput) keyPassInput.value = password;
              }
          });
      };
  }

  resolveProjectRoot(path) {
      if (!path) return '';
      let p = String(path);
      if (p.includes('/app/src')) return p.split('/app/src')[0];
      if (p.includes('/src/main')) return p.split('/src/main')[0];
      if (/\.(java|kt|kts|xml)$/i.test(p)) return p.substring(0, p.lastIndexOf('/'));
      return p.replace(/\/+$/, '');
  }

  _joinUri(base, rel) {
      const b = String(base || '').replace(/\/+$/, '');
      const r = String(rel || '').replace(/^\/+/, '');
      if (!r) return b;
      return b + '/' + r;
  }

}