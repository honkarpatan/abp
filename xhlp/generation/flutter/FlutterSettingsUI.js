/**
 * Flutter settings page — opened from blue play icon on lib/main.dart
 * Preview + GitHub build settings
 */
import { flutterStyles } from '../../styles/flutter.js';
import {
  getFlutterSettings,
  saveFlutterSetting,
  checkFlutterPreviewReady,
} from './flutterEnvCheck.js';
import { FlutterSetupUI } from './flutterSetupUI.js';
import { FlutterPreviewUI } from './FlutterPreviewUI.js';
import { FlutterBuildManager } from './FlutterBuildManager.js';
import flutterPng from '../../assets/icons/png/flutter.png';
import flutterTitlePng from '../../assets/icons/png/flutter_title.png';

export class FlutterSettingsUI {
  constructor() {
    this.tabId = 'flutter.settings';
    this.projectPath = null;
    this.$container = null;
  }

  /** Resolve Flutter project root from any file under it (lib/main.dart etc.) */
  resolveProjectRoot(rawPath) {
    if (!rawPath) return null;
    let p = String(rawPath);
    const markers = ['/lib/', '/android/', '/pubspec.yaml', '/test/'];
    for (const m of markers) {
      const i = p.indexOf(m);
      if (i !== -1) return p.substring(0, i);
    }
    // already root?
    if (p.endsWith('/pubspec.yaml')) return p.replace(/\/pubspec\.yaml$/, '');
    return p.replace(/\/[^/]+$/, '');
  }

  async show(rawPath) {
    this.projectPath = this.resolveProjectRoot(rawPath);
    const cfg = getFlutterSettings();

    const openFolder = acode.require('openFolder');
    const existing = openFolder.find(this.tabId);
    if (existing) existing.remove();

    this.$container = document.createElement('div');
    this.$container.className = 'flutter-settings flutter-page';

    const projectLabel = this.projectPath
      ? this.projectPath.split('/').filter(Boolean).pop()
      : 'Flutter project';

    this.$container.innerHTML = `
      <div class="flutter-header">
        <img class="flutter-logo" src="${flutterPng}" alt="Flutter" />
        <div style="flex:1;min-width:0;">
          <img class="flutter-title-img" src="${flutterTitlePng}" alt="Flutter" onerror="this.style.display='none';this.nextElementSibling.style.display='block';" />
          <h2 style="display:none;">Flutter Settings</h2>
          <div class="flutter-sub">${projectLabel} · web + GitHub</div>
        </div>
      </div>
      <div class="flutter-body">
        <div class="flutter-card">
          <div class="flutter-card-title">Actions</div>
          <div class="flutter-actions">
            <button class="flutter-btn" id="btn-preview">Preview (Web)</button>
            <button class="flutter-btn flutter-btn-secondary" id="btn-build">Build APK (GitHub)</button>
          </div>
          <p class="flutter-hint">
            Preview runs as web on a local port. APK builds run on GitHub Actions (device terminal cannot build Flutter reliably).
          </p>
        </div>

        <div class="flutter-card">
          <div class="flutter-card-title">Flutter SDK</div>
          <label class="flutter-label">SDK path</label>
          <input class="flutter-input" id="cfg-sdk" value="${cfg.flutterSdk || ''}" placeholder="$HOME/flutter" />
          <label class="flutter-label" style="margin-top:10px;">Web preview port</label>
          <input class="flutter-input" id="cfg-port" value="${cfg.webPort || '8080'}" placeholder="8080" />
        </div>

        <div class="flutter-card">
          <div class="flutter-card-title">GitHub Actions (APK build)</div>
          <label class="flutter-label">Personal access token</label>
          <input class="flutter-input" id="cfg-token" type="password" value="${cfg.githubToken || ''}" placeholder="ghp_…" />
          <label class="flutter-label" style="margin-top:10px;">Repository (owner/repo) — optional</label>
          <input class="flutter-input" id="cfg-repo" value="${cfg.githubRepo || ''}" placeholder="auto: username/project-name" />
          <label class="flutter-label" style="margin-top:10px;">Branch</label>
          <input class="flutter-input" id="cfg-branch" value="${cfg.githubBranch || 'main'}" placeholder="main" />
          <label class="flutter-check-row" style="margin-top:12px;display:flex;align-items:flex-start;gap:10px;">
            <input type="checkbox" id="cfg-auto-repo" ${cfg.autoCreateRepo !== false ? 'checked' : ''} style="margin-top:3px;" />
            <span>
              <strong>Auto-create private repo</strong><br/>
              <span class="flutter-hint" style="margin:0;">
                If repo is empty or missing, xhlp creates a <em>private</em> repo under your account,
                pushes the project (git), adds the workflow, then builds. Token needs
                <code>repo</code> + <code>workflow</code> scopes.
              </span>
            </span>
          </label>
        </div>

        <div class="flutter-card">
          <div class="flutter-card-title">Default APK build options</div>
          <p class="flutter-hint" style="margin-top:0;">Used when you open Build APK — same as build page defaults.</p>
          <label class="flutter-label">Build mode</label>
          <select class="flutter-input" id="cfg-mode">
            <option value="release">release (smaller)</option>
            <option value="debug">debug (large)</option>
            <option value="profile">profile</option>
          </select>
          <label class="flutter-label" style="margin-top:8px;">Target CPU (ABI)</label>
          <select class="flutter-input" id="cfg-abi">
            <option value="arm64">arm64 only (recommended)</option>
            <option value="arm">armeabi-v7a only</option>
            <option value="split">split per ABI</option>
            <option value="all">all ABIs (largest)</option>
          </select>
          <label class="flutter-check-row" style="margin-top:10px;display:flex;align-items:center;gap:8px;">
            <input type="checkbox" id="cfg-tree" style="margin-top:3px;" />
            <span><strong>Tree-shake icons</strong> <span class="flutter-hint">(release)</span></span>
          </label>
        </div>

        <button class="flutter-btn flutter-btn-block" id="btn-save">Save settings</button>
      </div>
      <div class="flutter-footer">Opened from lib/main.dart · Blue play icon</div>
    `;

    const EditorFile = acode.require('editorFile');
    new EditorFile('Flutter Settings', {
      type: 'page',
      content: this.$container,
      id: this.tabId,
      tabIcon: 'icon play_circle_filled',
      stylesheets: [flutterStyles],
    });

    // Default build options from settings
    const $mode = this.$container.querySelector('#cfg-mode');
    const $abi = this.$container.querySelector('#cfg-abi');
    const $tree = this.$container.querySelector('#cfg-tree');
    if ($mode) $mode.value = cfg.buildMode || cfg.flutterBuildMode || 'release';
    if ($abi) $abi.value = cfg.targetAbi || cfg.flutterTargetAbi || 'arm64';
    if ($tree) $tree.checked = cfg.treeShakeIcons !== false && cfg.flutterTreeShakeIcons !== false;

    this.$container.querySelector('#btn-save').onclick = () => this._saveFromForm();

    this.$container.querySelector('#btn-preview').onclick = async () => {
      this._saveFromForm();
      const ready = await checkFlutterPreviewReady();
      if (!ready) {
        window.toast('Flutter dependencies missing — open setup', 3000);
        new FlutterSetupUI().show(async () => {
          const ok = await checkFlutterPreviewReady();
          if (ok) new FlutterPreviewUI().show(this.projectPath);
          else window.toast('Still missing required tools', 3000);
        });
        return;
      }
      new FlutterPreviewUI().show(this.projectPath);
    };

    this.$container.querySelector('#btn-build').onclick = () => {
      this._saveFromForm();
      const c = getFlutterSettings();
      if (!c.githubToken) {
        window.toast('Set GitHub personal access token first', 3500);
        return;
      }
      // Repo optional when auto-create is on
      if (!c.githubRepo && c.autoCreateRepo === false) {
        window.toast('Set owner/repo or enable Auto-create private repo', 3500);
        return;
      }
      new FlutterBuildManager().startBuild(this.projectPath, {
        ...c,
        autoCreateRepo: c.autoCreateRepo !== false,
      });
    };
  }

  _saveFromForm() {
    const sdk = this.$container.querySelector('#cfg-sdk').value.trim();
    const port = this.$container.querySelector('#cfg-port').value.trim() || '8080';
    const token = this.$container.querySelector('#cfg-token').value.trim();
    const repo = this.$container.querySelector('#cfg-repo').value.trim();
    const branch = this.$container.querySelector('#cfg-branch').value.trim() || 'main';
    const autoRepo = !!this.$container.querySelector('#cfg-auto-repo')?.checked;
    saveFlutterSetting('flutterSdk', sdk);
    saveFlutterSetting('flutterWebPort', port);
    saveFlutterSetting('flutterGithubToken', token);
    saveFlutterSetting('flutterGithubRepo', repo);
    saveFlutterSetting('flutterGithubBranch', branch);
    saveFlutterSetting('flutterGithubAutoRepo', autoRepo);
    const mode = this.$container.querySelector('#cfg-mode')?.value || 'release';
    const abi = this.$container.querySelector('#cfg-abi')?.value || 'arm64';
    const tree = !!this.$container.querySelector('#cfg-tree')?.checked;
    saveFlutterSetting('flutterBuildMode', mode);
    saveFlutterSetting('flutterTargetAbi', abi);
    saveFlutterSetting('flutterTreeShakeIcons', tree);
    window.toast('Flutter settings saved', 1500);
  }
}
