/**
 * Flutter APK build via GitHub Actions.
 * Supports: auto-create private repo → push project → workflow → live logs → APK artifact hint/download.
 */
import { flutterStyles } from '../../styles/flutter.js';
import flutterPng from '../../assets/icons/png/flutter.png';
import flutterTitlePng from '../../assets/icons/png/flutter_title.png';
import { saveFlutterSetting } from './flutterEnvCheck.js';
import { executeCommand, writeShared } from '../../services/terminalManager.js';

const WORKFLOW_YML = "name: Flutter APK\n\non:\n  workflow_dispatch:\n    inputs:\n      build_mode:\n        description: release, debug, or profile\n        required: false\n        default: release\n      target_abi:\n        description: arm64, arm, split, or all\n        required: false\n        default: arm64\n      tree_shake:\n        description: \"true or false\"\n        required: false\n        default: \"true\"\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n\n      - uses: subosito/flutter-action@v2\n        with:\n          channel: stable\n          flutter-version: \"3.24.5\"\n\n      - name: Prepare Android platform\n        run: |\n          set -e\n          if [ ! -f pubspec.yaml ]; then\n            FOUND=$(find . -maxdepth 4 -name pubspec.yaml | head -1 || true)\n            [ -n \"$FOUND\" ] && cd \"$(dirname \"$FOUND\")\"\n          fi\n          test -f pubspec.yaml\n          echo \"Project: $(pwd)\"\n          rm -rf android\n          PN=$(grep -E '^name:' pubspec.yaml | head -1 | awk '{print $2}' | tr -d '\\r\"')\n          flutter create . --platforms=android --org com.example --project-name \"${PN:-app}\" || flutter create . --platforms=android\n          test -f android/app/build.gradle || test -f android/app/build.gradle.kts\n\n      - name: Build APK\n        env:\n          GH_MODE: ${{ github.event.inputs.build_mode || 'release' }}\n          GH_ABI: ${{ github.event.inputs.target_abi || 'arm64' }}\n          GH_TREE: ${{ github.event.inputs.tree_shake || 'true' }}\n        run: |\n          set -e\n          if [ ! -f pubspec.yaml ]; then\n            FOUND=$(find . -maxdepth 4 -name pubspec.yaml | head -1 || true)\n            [ -n \"$FOUND\" ] && cd \"$(dirname \"$FOUND\")\"\n          fi\n          flutter pub get\n          MODE=\"$GH_MODE\"\n          ABI=\"$GH_ABI\"\n          TREE=\"$GH_TREE\"\n          EXTRA=\"\"\n          if [ \"$TREE\" = \"true\" ] && [ \"$MODE\" = \"release\" ]; then\n            EXTRA=\"$EXTRA --tree-shake-icons\"\n          fi\n          case \"$ABI\" in\n            arm64) EXTRA=\"$EXTRA --target-platform android-arm64\" ;;\n            arm)   EXTRA=\"$EXTRA --target-platform android-arm\" ;;\n            x64)   EXTRA=\"$EXTRA --target-platform android-x64\" ;;\n            split) EXTRA=\"$EXTRA --split-per-abi\" ;;\n            all)   ;;\n          esac\n          echo \"Building MODE=$MODE ABI=$ABI EXTRA=$EXTRA\"\n          flutter build apk --$MODE $EXTRA\n          find build/app/outputs -name \"*.apk\" -type f 2>/dev/null | head -20\n          ls -lah build/app/outputs/flutter-apk/ 2>/dev/null || true\n\n      - uses: actions/upload-artifact@v4\n        with:\n          name: app-apk\n          path: build/app/outputs/flutter-apk/*.apk\n          if-no-files-found: error\n          retention-days: 14\n";

export class FlutterBuildManager {
  constructor() {
    this.tabId = 'flutter.build';
    this.$container = null;
    this._timer = null;
    this._cancelled = false;
    this._lastRunId = null;
    this._lastArtifactId = null;
    this._cfg = null;
    this._projectPath = null;
  }

  _historyKey() {
    return 'xhlp_flutter_build_history';
  }

  _loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(this._historyKey()) || '[]');
    } catch {
      return [];
    }
  }

  _saveHistoryEntry(entry) {
    const list = this._loadHistory().filter((e) => e.runId !== entry.runId);
    list.unshift(entry);
    localStorage.setItem(this._historyKey(), JSON.stringify(list.slice(0, 40)));
  }

  /** Open build console only — never auto-push / auto-dispatch. */
  openBuildPage(projectPath, cfg) {
    this._cancelled = true; // ensure no leftover poll from previous session
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._cfg = { ...(cfg || {}) };
    this._projectPath = projectPath;
    this._building = false;

    const openFolder = acode.require('openFolder');
    const existing = openFolder.find(this.tabId);
    // Reuse existing tab if already open — do not tear down / restart build
    if (existing && this.$container && this.$container.isConnected) {
      try {
        if (typeof existing.makeActive === 'function') existing.makeActive();
        else if (editorManager?.switchFile) editorManager.switchFile(existing.id || this.tabId);
      } catch (_) {}
      this._projectPath = projectPath || this._projectPath;
      if (cfg) this._cfg = { ...this._cfg, ...cfg };
      this._syncOptionsFromCfg();
      this._renderHistory();
      return;
    }
    if (existing) {
      try { existing.remove(); } catch (_) {}
    }

    this.$container = document.createElement('div');
    this.$container.className = 'flutter-build flutter-page';

    const mode = this._cfg.buildMode || 'release';
    const abi = this._cfg.targetAbi || 'arm64';
    const tree = this._cfg.treeShakeIcons !== false;

    this.$container.innerHTML = `
      <div class="flutter-build-layout">
        <aside class="flutter-build-sidebar" id="fb-sidebar">
          <div class="flutter-build-sidebar-head">
            <strong>History</strong>
            <button type="button" class="flutter-btn flutter-btn-secondary" id="fb-hist-refresh" style="padding:4px 8px;font-size:0.75rem;">↻</button>
          </div>
          <div class="flutter-build-hist-list" id="fb-hist-list"></div>
        </aside>
        <div class="flutter-build-main">
          <div class="flutter-header">
            <button type="button" class="flutter-btn flutter-btn-secondary" id="fb-toggle-hist" title="History">≡</button>
            <img class="flutter-logo" src="${flutterPng}" alt="" />
            <div style="flex:1;min-width:0;">
              <img class="flutter-title-img" src="${flutterTitlePng}" alt="Flutter" onerror="this.style.display='none';this.nextElementSibling.style.display='block';" />
              <h2 style="display:none;">Flutter Build</h2>
              <div class="flutter-sub" id="fb-subhead">GitHub Actions · idle</div>
            </div>
          </div>
          <div class="flutter-body">
            <div class="flutter-build-status">
              <div class="flutter-card" style="text-align:left;margin-bottom:14px;">
                <div class="flutter-card-title">Build options</div>
                <p class="flutter-hint" style="margin-top:0;">Saved in plugin settings — no need to edit the workflow file.</p>
                <label class="flutter-label">Build mode</label>
                <select class="flutter-input" id="fb-opt-mode">
                  <option value="release">release (smaller)</option>
                  <option value="debug">debug (large)</option>
                  <option value="profile">profile</option>
                </select>
                <label class="flutter-label" style="margin-top:8px;">Target CPU (ABI)</label>
                <select class="flutter-input" id="fb-opt-abi">
                  <option value="arm64">arm64 only (recommended)</option>
                  <option value="arm">armeabi-v7a only</option>
                  <option value="split">split per ABI</option>
                  <option value="all">all ABIs (largest)</option>
                </select>
                <label class="flutter-check-row" style="margin-top:10px;display:flex;align-items:center;gap:8px;">
                  <input type="checkbox" id="fb-opt-tree" style="margin-top:3px;" />
                  <span><strong>Tree-shake icons</strong> <span class="flutter-hint">(release)</span></span>
                </label>
              </div>
              <div class="main" id="fb-main">Ready</div>
              <div class="sub" id="fb-sub">Change options if needed, then tap Start Build</div>
              <div class="flutter-progress-track">
                <div class="flutter-progress-bar" id="fb-bar" style="width:0%"></div>
              </div>
              <div class="flutter-actions" style="justify-content:center;flex-wrap:wrap;gap:8px;">
                <button class="flutter-btn" id="fb-start">Start Build</button>
                <button class="flutter-btn flutter-btn-secondary" id="fb-logs">Show Logs</button>
                <button class="flutter-btn" id="fb-dl" hidden>Download APK</button>
                <button class="flutter-btn flutter-btn-danger" id="fb-stop" hidden>Stop polling</button>
              </div>
              <div class="flutter-log-box" id="fb-log"></div>
            </div>
          </div>
          <div class="flutter-footer" id="fb-footer">${this._cfg.githubRepo || 'repo auto'}</div>
        </div>
      </div>
    `;

    const EditorFile = acode.require('editorFile');
    new EditorFile('Flutter Build', {
      type: 'page',
      content: this.$container,
      id: this.tabId,
      tabIcon: 'icon aid-gradle-icon',
      stylesheets: [flutterStyles],
    });

    this._bindBuildUi();
    this._syncOptionsFromCfg();
    this._renderHistory();
  }

  _syncOptionsFromCfg() {
    if (!this.$container) return;
    const mode = this._cfg?.buildMode || 'release';
    const abi = this._cfg?.targetAbi || 'arm64';
    const tree = this._cfg?.treeShakeIcons !== false;
    const $mode = this.$container.querySelector('#fb-opt-mode');
    const $abi = this.$container.querySelector('#fb-opt-abi');
    const $tree = this.$container.querySelector('#fb-opt-tree');
    if ($mode) $mode.value = mode;
    if ($abi) $abi.value = abi;
    if ($tree) $tree.checked = tree;
    const sub = this.$container.querySelector('#fb-subhead');
    if (sub) sub.textContent = `GitHub Actions · ${mode} · ${abi}`;
  }

  _readOptionsToCfg() {
    if (!this.$container) return this._cfg || {};
    const mode = this.$container.querySelector('#fb-opt-mode')?.value || 'release';
    const abi = this.$container.querySelector('#fb-opt-abi')?.value || 'arm64';
    const tree = !!this.$container.querySelector('#fb-opt-tree')?.checked;
    this._cfg = { ...(this._cfg || {}), buildMode: mode, targetAbi: abi, treeShakeIcons: tree };
    try {
      saveFlutterSetting('flutterBuildMode', mode);
      saveFlutterSetting('flutterTargetAbi', abi);
      saveFlutterSetting('flutterTreeShakeIcons', tree);
    } catch (_) {}
    const sub = this.$container.querySelector('#fb-subhead');
    if (sub) sub.textContent = `GitHub Actions · ${mode} · ${abi}`;
    return this._cfg;
  }

  _bindBuildUi() {
    const logBox = this.$container.querySelector('#fb-log');
    this.$container.querySelector('#fb-logs').onclick = () => {
      logBox.classList.toggle('visible');
      this.$container.querySelector('#fb-logs').textContent = logBox.classList.contains('visible')
        ? 'Hide Logs'
        : 'Show Logs';
    };
    this.$container.querySelector('#fb-stop').onclick = () => {
      this._cancelled = true;
      if (this._timer) clearInterval(this._timer);
      this._set(null, 'Stopped', 'Polling cancelled', '—');
    };
    this.$container.querySelector('#fb-dl').onclick = () => this._downloadArtifact();
    this.$container.querySelector('#fb-start').onclick = () => {
      if (this._building) {
        window.toast('Build already running', 2000);
        return;
      }
      const cfg = this._readOptionsToCfg();
      this._runBuild(this._projectPath, cfg);
    };
    // Persist options when user changes selects (no build)
    ['#fb-opt-mode', '#fb-opt-abi', '#fb-opt-tree'].forEach((sel) => {
      const el = this.$container.querySelector(sel);
      if (!el) return;
      el.addEventListener('change', () => this._readOptionsToCfg());
    });
    this.$container.querySelector('#fb-toggle-hist')?.addEventListener('click', () => {
      this.$container.querySelector('#fb-sidebar')?.classList.toggle('open');
    });
    this.$container.querySelector('#fb-hist-refresh')?.addEventListener('click', () => this._renderHistory());
  }

  _renderHistory() {
    const list = this.$container?.querySelector('#fb-hist-list');
    if (!list) return;
    const items = this._loadHistory();
    if (!items.length) {
      list.innerHTML = '<div class="flutter-hist-empty">No builds yet</div>';
      return;
    }
    list.innerHTML = items
      .map(
        (h) => `
      <div class="flutter-hist-item" data-run="${h.runId || ''}" data-art="${h.artifactId || ''}">
        <div class="flutter-hist-title">${h.conclusion || h.status || 'run'} · ${h.mode || ''}</div>
        <div class="flutter-hist-meta">${h.repo || ''} · ${h.when || ''}</div>
        <div class="flutter-hist-actions">
          ${h.runId ? `<button type="button" class="flutter-btn flutter-btn-secondary fb-hist-open" data-url="${h.htmlUrl || ''}">Open</button>` : ''}
          ${h.artifactId || h.runId ? `<button type="button" class="flutter-btn fb-hist-dl" data-run="${h.runId || ''}" data-art="${h.artifactId || ''}">Download</button>` : ''}
        </div>
      </div>`
      )
      .join('');

    list.querySelectorAll('.fb-hist-open').forEach((btn) => {
      btn.onclick = () => {
        const u = btn.getAttribute('data-url');
        if (!u) return;
        const system = acode.require('system');
        if (system?.openInBrowser) system.openInBrowser(u);
        else window.open(u, '_blank');
      };
    });
    list.querySelectorAll('.fb-hist-dl').forEach((btn) => {
      btn.onclick = () => {
        this._lastRunId = btn.getAttribute('data-run') || this._lastRunId;
        this._lastArtifactId = btn.getAttribute('data-art') || null;
        this._downloadArtifact();
      };
    });
  }

  /** Opens page only — does NOT start GitHub push/build. */
  async startBuild(projectPath, cfg) {
    this.openBuildPage(projectPath, cfg);
  }

  async _runBuild(projectPath, cfg) {
    if (this._building) return;
    this._building = true;
    this._cancelled = false;
    this._cfg = { ...cfg };
    const startBtn = this.$container?.querySelector('#fb-start');
    const stopBtn = this.$container?.querySelector('#fb-stop');
    if (startBtn) startBtn.disabled = true;
    if (stopBtn) stopBtn.hidden = false;
    const dl = this.$container?.querySelector('#fb-dl');
    if (dl) dl.hidden = true;

    try {
      if (!cfg.githubToken) throw new Error('GitHub token required');

      this._set(3, 'Checking GitHub user…', 'Validating token', '—');
      const user = await this._gh(cfg, '/user');
      const login = user.login;
      this._appendLog(`Authenticated as @${login}\n`);

      let owner;
      let repo;
      if (cfg.githubRepo && cfg.githubRepo.includes('/')) {
        [owner, repo] = cfg.githubRepo.split('/');
      } else {
        owner = login;
        repo = (cfg.githubRepo || this._defaultRepoName(projectPath)).replace(/[^a-zA-Z0-9._-]/g, '-');
        if (!repo) repo = 'xhlp-flutter-app';
      }

      const full = `${owner}/${repo}`;
      cfg.githubRepo = full;
      this._cfg.githubRepo = full;
      saveFlutterSetting('flutterGithubRepo', full);

      this._set(8, 'Repository…', full, full);
      await this._ensureRepo(cfg, owner, repo, !!cfg.autoCreateRepo);
      this._appendLog(`Using repository: https://github.com/${full}\n`);

      this._appendLog('projectPath raw: ' + String(projectPath || '(empty)') + '\n');
      this._set(12, 'Preparing project…', 'Workflow + push', full);
      await this._ensureWorkflowHint(projectPath);
      await this._pushProject(cfg, projectPath, owner, repo);

      this._set(16, 'Verifying repo…', 'pubspec.yaml must exist', full);
      const hasPub = await this._remoteHasPubspec(cfg, owner, repo, this._branch(cfg));
      if (!hasPub) {
        this._appendLog(
          'ERROR: pubspec.yaml still missing on GitHub after upload/push.\n'
        );
        this._set(100, 'No Flutter project on GitHub', 'pubspec.yaml missing', `https://github.com/${full}`);
        window.toast('GitHub repo has no pubspec.yaml', 4000);
        return;
      }
      this._appendLog('OK: pubspec.yaml found on GitHub.\n');

      this._set(18, 'Waiting for workflow…', 'GitHub indexing', full);
      await new Promise((r) => setTimeout(r, 4000));

      const runId = await this._dispatchWorkflow(cfg);
      if (!runId) {
        this._set(100, 'Dispatch failed', 'Check token, repo, and workflow', '—');
        return;
      }
      this._lastRunId = runId;
      this._appendLog(`Workflow run id: ${runId}\n`);
      this._saveHistoryEntry({
        runId,
        repo: full,
        status: 'queued',
        mode: cfg.buildMode || 'release',
        abi: cfg.targetAbi || 'arm64',
        when: new Date().toISOString().slice(0, 16).replace('T', ' '),
        htmlUrl: `https://github.com/${full}/actions/runs/${runId}`,
      });
      this._renderHistory();
      this._pollRun(cfg, runId);
    } catch (e) {
      this._set(100, 'Error', e.message || String(e), '—');
      this._appendLog(String(e.stack || e) + '\n');
      window.toast(e.message || 'Build error', 4000);
    } finally {
      this._building = false;
      if (startBtn) startBtn.disabled = false;
    }
  }

  _defaultRepoName(projectPath) {
    if (!projectPath) return 'xhlp-flutter-app';
    const parts = String(projectPath).replace(/\/$/, '').split('/').filter(Boolean);
    const name = parts[parts.length - 1] || 'xhlp-flutter-app';
    return name.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase() || 'xhlp-flutter-app';
  }

  _set(percent, main, sub, footer) {
    if (!this.$container || !this.$container.isConnected) return;
    const bar = this.$container.querySelector('#fb-bar');
    if (bar) {
      if (percent == null || Number.isNaN(percent)) {
        // indeterminate feel — keep last width or pulse to 40%
        if (!bar.style.width || bar.style.width === '0%') bar.style.width = '35%';
        bar.classList.add('is-busy');
      } else {
        bar.classList.remove('is-busy');
        bar.style.width = `${Math.min(100, Math.max(2, percent))}%`;
      }
    }
    if (main != null) {
      const el = this.$container.querySelector('#fb-main');
      if (el) el.textContent = main;
    }
    if (sub != null) {
      const el = this.$container.querySelector('#fb-sub');
      if (el) el.textContent = sub;
    }
    if (footer != null) {
      const el = this.$container.querySelector('#fb-footer');
      if (el) el.textContent = footer;
    }
  }

  _appendLog(text) {
    const logBox = this.$container?.querySelector('#fb-log');
    if (!logBox) return;
    logBox.textContent += text;
    logBox.scrollTop = logBox.scrollHeight;
  }

  async _gh(cfg, path, method = 'GET', body = null) {
    const headers = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${cfg.githubToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (body) headers['Content-Type'] = 'application/json';
    const res = await fetch(`https://api.github.com${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      throw new Error(data.message || data.raw || `GitHub HTTP ${res.status}`);
    }
    return data;
  }

  /** Prefer real default branch from GitHub over settings assumption. */
  _branch(cfg) {
    return (
      (this._cfg && this._cfg.defaultBranch) ||
      (cfg && cfg.defaultBranch) ||
      (cfg && cfg.githubBranch) ||
      'main'
    );
  }

  /** Create private repo if missing (when autoCreateRepo). */
  async _ensureRepo(cfg, owner, repo, autoCreate) {
    try {
      const info = await this._gh(cfg, `/repos/${owner}/${repo}`);
      this._appendLog(`Repo exists: ${owner}/${repo}\n`);
      const db = info.default_branch || 'main';
      this._cfg.defaultBranch = db;
      cfg.defaultBranch = db;
      this._appendLog(`Default branch: ${db}\n`);
      return;
    } catch (e) {
      if (!autoCreate && !cfg.autoCreateRepo) {
        if (!cfg.githubRepo) {
          /* fall through */
        } else {
          this._appendLog(`Repo not found (${e.message}). Creating…\n`);
        }
      }
    }

    this._appendLog(`Creating private repo ${owner}/${repo}…\n`);
    try {
      const created = await this._gh(cfg, '/user/repos', 'POST', {
        name: repo,
        private: true,
        description: 'Auto-created by xhlp Flutter builder',
        auto_init: true,
      });
      const db = (created && created.default_branch) || 'main';
      this._cfg.defaultBranch = db;
      cfg.defaultBranch = db;
      this._appendLog(`Private repo created. Default branch: ${db}\n`);
      await new Promise((r) => setTimeout(r, 2000));
    } catch (e) {
      if (/already exists/i.test(e.message || '')) {
        this._appendLog('Repo already exists (race).\n');
        try {
          const info = await this._gh(cfg, `/repos/${owner}/${repo}`);
          const db = info.default_branch || 'main';
          this._cfg.defaultBranch = db;
          cfg.defaultBranch = db;
          this._appendLog(`Default branch: ${db}\n`);
        } catch (_) {}
        return;
      }
      throw new Error('Could not create repo: ' + e.message);
    }
  }

  async _ensureWorkflowHint(projectPath) {
    if (!projectPath || projectPath.includes('content://')) {
      this._appendLog(
        'SAF path — workflow will be pushed via git/API if possible.\n'
      );
      return;
    }
    try {
      const fs = acode.require('fs');
      const gh = `${projectPath}/.github`;
      const wf = `${projectPath}/.github/workflows`;
      try {
        if (!(await fs(gh).exists())) await fs(projectPath).createDirectory('.github');
      } catch (_) {}
      try {
        if (!(await fs(wf).exists())) await fs(gh).createDirectory('workflows');
      } catch (_) {}
      const ymlPath = `${wf}/xhlp-flutter-apk.yml`;
      try {
        const exists = await fs(ymlPath).exists();
        if (!exists) {
          await fs(wf).createFile('xhlp-flutter-apk.yml', WORKFLOW_YML);
          this._appendLog('Wrote .github/workflows/xhlp-flutter-apk.yml\n');
        } else {
          this._appendLog('Workflow file already present.\n');
        }
      } catch (e) {
        this._appendLog('Could not write workflow locally: ' + e.message + '\n');
      }
    } catch (e) {
      this._appendLog('Workflow write skipped: ' + e.message + '\n');
    }
  }

  /**
   * Push project to GitHub: prefer git CLI; fallback Contents API for workflow only.
   */

  /**
   * Resolve a safe local Flutter project root (must contain pubspec.yaml).
   * Rejects Android system roots that made git scan /system for 30min.
   */
  async _resolveLocalProjectRoot(projectPath) {
    const fs = acode.require('fs');
    const rawInput = String(projectPath || '').trim();

    // fs() needs the ORIGINAL scheme (file://, content://) to resolve a
    // path — stripping "file://" (as this used to do) makes fs(path) return
    // undefined instead of a handle, so every .exists()/.lsDir() call below
    // throws "Cannot read properties of undefined". Shell commands need the
    // opposite: a plain path with no scheme prefix. Keep two forms.
    const stripScheme = (u) => String(u || '').replace(/^file:\/\//, '');

    const fsCandidates = [];
    const shellCandidates = [];
    const pushFs = (u) => { if (u && !fsCandidates.includes(u)) fsCandidates.push(u); };
    const pushShell = (u) => {
      const plain = stripScheme(u);
      if (plain && !plain.includes('content://') && !shellCandidates.includes(plain)) {
        shellCandidates.push(plain);
      }
    };

    if (rawInput) {
      pushFs(rawInput);
      pushShell(rawInput);
      if (rawInput.includes('/lib/')) {
        const r = rawInput.split('/lib/')[0];
        pushFs(r);
        pushShell(r);
      }
      if (rawInput.endsWith('/lib')) {
        const r = rawInput.replace(/\/lib$/, '');
        pushFs(r);
        pushShell(r);
      }
    }

    // Also try currently opened folder roots — on Android 10+ this is very
    // often a content:// SAF tree URI, not a plain path, since that's how
    // apps get access to a user-picked folder under /storage/emulated/0
    // without the "all files access" permission.
    try {
      const openFolder = acode.require('openFolder');
      const folders = openFolder?.list?.() || openFolder?.getAll?.() || [];
      const list = Array.isArray(folders) ? folders : [];
      for (const f of list) {
        const u = f?.url || f?.path || f;
        if (typeof u === 'string' && u) {
          pushFs(u);
          pushShell(u); // dropped inside pushShell already if it's content://
        }
      }
    } catch (_) {}

    const banned = (p) => {
      const x = stripScheme(p).replace(/\/$/, '');
      return !x || x === '/' || x === '/data' || x === '/system' || x === '/public';
    };

    this._appendLog(
      'Resolving project root — fs candidates: [' + fsCandidates.join(', ') + ']\n' +
        'shell candidates: [' + shellCandidates.join(', ') + ']\n'
    );

    // 1) Direct child-path check via fs() — keep whatever scheme the
    // candidate came with (file://, content://, or none) since that's what
    // fs() actually needs to resolve it. Works for file:// and plain paths;
    // content:// mostly won't resolve this way (see step 2).
    for (const c of fsCandidates) {
      if (banned(c)) continue;
      const childUrl = String(c).replace(/\/$/, '') + '/pubspec.yaml';
      try {
        const handle = fs(childUrl);
        const ok = handle && (await handle.exists());
        this._appendLog(`  fs exists ${childUrl} -> ${ok ? 'FOUND' : (handle ? 'no' : 'no handle')}\n`);
        if (ok) return c.includes('content://') ? c : stripScheme(c).replace(/\/$/, '');
      } catch (e) {
        this._appendLog(`  fs exists ${childUrl} -> error: ${e.message || e}\n`);
      }
    }

    // 2) Directory-listing check — required for content:// (SAF) URIs. Those
    // are opaque document ids, not hierarchical paths, so string-concatenating
    // "/pubspec.yaml" onto one (step 1) does not resolve to a real child and
    // will always report "no" even when the file is right there. Listing the
    // folder's own children and matching by name works regardless of scheme.
    for (const c of fsCandidates) {
      if (banned(c)) continue;
      try {
        const dir = fs(c);
        if (!dir) {
          this._appendLog(`  ls ${c} -> no handle\n`);
          continue;
        }
        const entries =
          (typeof dir.lsDir === 'function' && (await dir.lsDir())) ||
          (typeof dir.readDir === 'function' && (await dir.readDir())) ||
          (typeof dir.listDir === 'function' && (await dir.listDir())) ||
          null;
        if (Array.isArray(entries)) {
          const names = entries.map((e) => (typeof e === 'string' ? e : e?.name || e?.filename || ''));
          this._appendLog(`  ls ${c} -> ${names.slice(0, 20).join(', ')}${names.length > 20 ? ', …' : ''}\n`);
          if (names.some((n) => String(n).toLowerCase() === 'pubspec.yaml')) {
            return c.includes('content://') ? c : stripScheme(c).replace(/\/$/, '');
          }
        } else {
          this._appendLog(`  ls ${c} -> no listing method on handle\n`);
        }
      } catch (e) {
        this._appendLog(`  ls ${c} -> error: ${e.message || e}\n`);
      }
    }

    // 3) Last resort: shell test — only for real filesystem paths, no scheme.
    // If the project lives under a SAF-only folder with no storage
    // permission, this will legitimately never see it — expected, not a bug.
    for (const c of shellCandidates) {
      if (banned(c)) continue;
      try {
        const out = await executeCommand(
          'test -f ' + JSON.stringify(String(c).replace(/\/$/, '') + '/pubspec.yaml') + ' && echo HAS',
          true
        );
        const found = String(out || '').includes('HAS');
        this._appendLog(`  shell test ${c}/pubspec.yaml -> ${found ? 'FOUND' : 'no'}\n`);
        if (found) return String(c).replace(/\/$/, '');
      } catch (e) {
        this._appendLog(`  shell test ${c}/pubspec.yaml -> error: ${e.message || e}\n`);
      }
    }
    return '';
  }

  async _remoteHasPubspec(cfg, owner, repo, branch) {
    try {
      await this._gh(cfg, `/repos/${owner}/${repo}/contents/pubspec.yaml?ref=${encodeURIComponent(branch || 'main')}`);
      return true;
    } catch (_) {
      // try default branch without ref
      try {
        await this._gh(cfg, `/repos/${owner}/${repo}/contents/pubspec.yaml`);
        return true;
      } catch (e2) {
        this._appendLog('pubspec check: ' + (e2.message || e2) + '\n');
        return false;
      }
    }
  }

  async _pushProject(cfg, projectPath, owner, repo) {
    const branch = this._branch(cfg);
    const token = cfg.githubToken;

    // Always ensure workflow on remote (workflow_dispatch required)
    try {
      await this._putFile(
        cfg,
        owner,
        repo,
        branch,
        '.github/workflows/xhlp-flutter-apk.yml',
        WORKFLOW_YML,
        'Add Flutter APK workflow (xhlp) [skip ci]'
      );
      this._appendLog('Workflow committed on GitHub (workflow_dispatch).\n');
    } catch (e) {
      this._appendLog('Workflow API put: ' + (e.message || e) + '\n');
    }

    const root = await this._resolveLocalProjectRoot(projectPath);
    if (!root) {
      this._appendLog(
        'Local project path invalid or pubspec.yaml not found.\n' +
          'raw projectPath=' + String(projectPath || '') + '\n' +
          'Open Flutter project from a normal folder (e.g. /sdcard/… or $HOME/…),\n' +
          'not Alpine/system root. API upload skipped for safety.\n'
      );
      return;
    }
    this._appendLog('Local project root: ' + root + '\n');

    if (root.includes('content://')) {
      this._appendLog(
        'pubspec.yaml was found, but this folder is only reachable through ' +
          "Android's document picker (SAF), not as a plain filesystem path — " +
          'the shell/git push step cannot read files from it.\n' +
          'Fix: either grant "All files access" to this app in Android ' +
          'Settings > Apps > (this app) > Permissions, or copy/move the ' +
          'project into $HOME so build tools can read it directly.\n' +
          'Skipping source upload for this run (workflow file was still written).\n'
      );
      return;
    }

    // Single-commit API upload from verified root
    await this._uploadProjectViaApi(cfg, root, owner, repo, branch);

    // Optional git push ONLY inside verified project (never device root)
    this._appendLog('Attempting git push (project only)…\n');
    this._set(14, 'Pushing source…', 'git push', `${owner}/${repo}`);
    const remote = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
    const script = [
      'ROOT=' + JSON.stringify(root),
      'test -f "$ROOT/pubspec.yaml" || { echo NO_PUBSPEC; exit 0; }',
      'command -v git >/dev/null 2>&1 || apk add --quiet git 2>/dev/null || true',
      'command -v git >/dev/null 2>&1 || { echo NO_GIT; exit 0; }',
      'cd "$ROOT" || { echo CD_FAIL; exit 0; }',
      'git config --global user.email "xhlp@local" 2>/dev/null || true',
      'git config --global user.name "xhlp" 2>/dev/null || true',
      // # quarantine: never run from /
      'pwd | grep -qE "^/(system|vendor|proc|data/user)" && { echo BAD_PWD; exit 0; } || true',
      '[ -d .git ] || git init',
      'git checkout -b ' + branch + ' 2>/dev/null || git branch -M ' + branch + ' 2>/dev/null || true',
      'printf "%s\\n" .dart_tool/ build/ .flutter-plugins .flutter-plugins-dependencies .packages android/.gradle/ > .gitignore',
      'git add -A',
      'git status --short | head -30 || true',
      'git diff --cached --quiet && echo NO_CHANGES || git commit -m "xhlp: sync Flutter project [skip ci]"',
      'git remote remove origin 2>/dev/null || true',
      'git remote add origin ' + JSON.stringify(remote),
      'git rev-parse HEAD >/dev/null 2>&1 || { echo NO_HEAD; exit 0; }',
      'git push -u origin HEAD:' + branch + ' --force && echo PUSH_OK || echo PUSH_FAIL',
    ].join('; ');

    try {
      const out = await executeCommand(script, true);
      const text = (out || '').toString();
      this._appendLog(text.slice(-1500) + '\n');
      if (text.includes('PUSH_OK')) this._appendLog('Git push succeeded.\n');
      else if (text.includes('NO_GIT')) this._appendLog('git not available — API commit is enough if files uploaded.\n');
      else if (text.includes('NO_PUBSPEC') || text.includes('BAD_PWD'))
        this._appendLog('Skipped unsafe git working directory.\n');
    } catch (e) {
      this._appendLog('git push error: ' + (e.message || e) + '\n');
    }
  }

  async _uploadProjectViaApi(cfg, root, owner, repo, branch) {
    this._appendLog('Uploading project as a single commit (Git Tree API)…\n');
    this._set(13, 'Uploading files…', 'one commit', `${owner}/${repo}`);

    const must = [
      'pubspec.yaml',
      'lib/main.dart',
      'analysis_options.yaml',
      'android/build.gradle',
      'android/settings.gradle',
      'android/gradle.properties',
      'android/app/build.gradle',
      'android/app/src/main/AndroidManifest.xml',
      '.metadata',
      '.gitignore',
    ];

    let files = [];
    try {
      const R = JSON.stringify(root.replace(/\/$/, ''));
      // No `cd` (broken in some Alpine init shells) — list with absolute root, strip prefix
      const simple =
        'find ' +
        R +
        ' -type f ' +
        '! -path "*/.git/*" ! -path "*/build/*" ! -path "*/.dart_tool/*" ' +
        '! -path "*/android/.gradle/*" ! -path "*/android/app/build/*" ' +
        '2>/dev/null | head -200';
      const out2 = await executeCommand(simple, true);
      const prefix = root.replace(/\/$/, '') + '/';
      files = String(out2 || '')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith(prefix) || l.startsWith(root))
        .map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : l.replace(root + '/', '').replace(/^\.\//, '')))
        .filter((l) => l && !l.includes('..'));
    } catch (e) {
      this._appendLog(
        'find failed: ' + (e && e.message ? e.message : String(e)) + ' — using must-have list\n'
      );
    }

    for (const m of must) {
      if (!files.includes(m)) files.unshift(m);
    }
    files = [...new Set(files)].slice(0, 150);
    this._appendLog(`Collecting ${files.length} files…\n`);

    const tree = [];
    let ok = 0;
    let fail = 0;
    for (const rel of files) {
      try {
        const abs = root.replace(/\/$/, '') + '/' + rel;
        const readCmd =
          'base64 -w0 < ' +
          JSON.stringify(abs) +
          ' 2>/dev/null || base64 < ' +
          JSON.stringify(abs) +
          ' | tr -d "\\n"';
        const b64 = String((await executeCommand(`sh -c ${JSON.stringify(readCmd)}`, true)) || '')
          .trim()
          .replace(/\s/g, '');
        if (!b64 || b64.length < 4) {
          fail++;
          continue;
        }
        const blob = await this._gh(cfg, `/repos/${owner}/${repo}/git/blobs`, 'POST', {
          content: b64,
          encoding: 'base64',
        });
        if (!blob.sha) {
          fail++;
          continue;
        }
        tree.push({
          path: rel,
          mode: '100644',
          type: 'blob',
          sha: blob.sha,
        });
        ok++;
      } catch (e) {
        fail++;
        this._appendLog(`  skip ${rel}: ${e.message || e}\n`);
      }
    }

    if (!tree.length) {
      this._appendLog('No blobs created — nothing to commit.\n');
      return;
    }

    // Parent commit (current branch tip)
    let parentSha = null;
    try {
      const ref = await this._gh(cfg, `/repos/${owner}/${repo}/git/ref/heads/${branch}`);
      parentSha = ref.object && ref.object.sha;
    } catch (_) {
      try {
        const ref = await this._gh(cfg, `/repos/${owner}/${repo}/git/ref/heads/master`);
        parentSha = ref.object && ref.object.sha;
      } catch (e2) {
        this._appendLog('No parent ref (empty repo?): ' + (e2.message || e2) + '\n');
      }
    }

    // Base tree from parent so we don't drop unrelated files (optional)
    let baseTree = undefined;
    if (parentSha) {
      try {
        const commit = await this._gh(cfg, `/repos/${owner}/${repo}/git/commits/${parentSha}`);
        baseTree = commit.tree && commit.tree.sha;
      } catch (_) {}
    }

    const treeBody = {
      tree,
      ...(baseTree ? { base_tree: baseTree } : {}),
    };
    const newTree = await this._gh(cfg, `/repos/${owner}/${repo}/git/trees`, 'POST', treeBody);

    const commitBody = {
      message: 'xhlp: sync Flutter project [skip ci]',
      tree: newTree.sha,
      parents: parentSha ? [parentSha] : [],
    };
    const newCommit = await this._gh(cfg, `/repos/${owner}/${repo}/git/commits`, 'POST', commitBody);

    // Update branch ref
    try {
      await this._gh(cfg, `/repos/${owner}/${repo}/git/refs/heads/${branch}`, 'PATCH', {
        sha: newCommit.sha,
        force: true,
      });
    } catch (_) {
      // create branch ref
      await this._gh(cfg, `/repos/${owner}/${repo}/git/refs`, 'POST', {
        ref: `refs/heads/${branch}`,
        sha: newCommit.sha,
      });
    }

    this._appendLog(
      `Single commit ${String(newCommit.sha).slice(0, 7)} — ${ok} files (${fail} skipped)\n`
    );
  }

  async _putFile(cfg, owner, repo, branch, path, content, message) {
    const encoded = btoa(unescape(encodeURIComponent(content)));
    for (let attempt = 0; attempt < 4; attempt++) {
      let sha;
      try {
        const existing = await this._gh(
          cfg,
          `/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`
        );
        sha = existing.sha;
      } catch (_) {}
      const body = {
        message,
        content: encoded,
        branch,
      };
      if (sha) body.sha = sha;
      try {
        return await this._gh(cfg, `/repos/${owner}/${repo}/contents/${path}`, 'PUT', body);
      } catch (e) {
        const msg = String(e.message || e);
        if (/does not match|409|Conflict/i.test(msg) && attempt < 3) {
          this._appendLog('Content conflict, retry ' + (attempt + 1) + '…\n');
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        throw e;
      }
    }
  }

  async _dispatchWorkflow(cfg) {
    this._set(20, 'Dispatching…', 'workflow_dispatch', cfg.githubRepo);
    const [owner, repo] = cfg.githubRepo.split('/');
    if (!owner || !repo) throw new Error('Repo must be owner/repo');
    const branch = this._branch(cfg);
    const wfPath = '.github/workflows/xhlp-flutter-apk.yml';

    // Write/overwrite workflow (retry on sha conflict)
    try {
      await this._putFile(
        cfg,
        owner,
        repo,
        branch,
        wfPath,
        WORKFLOW_YML,
        'xhlp Flutter APK workflow [skip ci]'
      );
      this._appendLog('Wrote ' + wfPath + '\n');
    } catch (e) {
      this._appendLog('Workflow write: ' + (e.message || e) + '\n');
    }

    // Verify content
    try {
      const remote = await this._gh(
        cfg,
        `/repos/${owner}/${repo}/contents/${wfPath}?ref=${encodeURIComponent(branch)}`
      );
      const text = atob((remote.content || '').replace(/\n/g, ''));
      this._appendLog('Remote workflow head: ' + text.slice(0, 160).replace(/\n/g, ' | ') + '\n');
      if (!/workflow_dispatch/.test(text)) {
        throw new Error('Remote YAML missing workflow_dispatch');
      }
    } catch (e) {
      this._appendLog('Workflow verify: ' + (e.message || e) + '\n');
    }

    // Wait for GitHub to index the new workflow file
    await new Promise((r) => setTimeout(r, 8000));

    let workflowId = null;
    for (let i = 0; i < 5; i++) {
      try {
        const wfs = await this._gh(cfg, `/repos/${owner}/${repo}/actions/workflows?per_page=100`);
        const list = wfs.workflows || [];
        this._appendLog(
          'Workflows: ' +
            list.map((w) => `${w.name}|id=${w.id}|${w.path}|${w.state}`).join(' ; ') +
            '\n'
        );
        const match =
          list.find((w) => (w.path || '').endsWith('xhlp-flutter-apk.yml')) ||
          list.find((w) => /Flutter APK/i.test(w.name || '')) ||
          list.find((w) => /flutter/i.test(w.path || ''));
        if (match) {
          workflowId = match.id;
          break;
        }
      } catch (e) {
        this._appendLog('List workflows: ' + (e.message || e) + '\n');
      }
      await new Promise((r) => setTimeout(r, 3000));
    }

    if (!workflowId) {
      // last resort: file name
      workflowId = 'xhlp-flutter-apk.yml';
      this._appendLog('Using workflow file name as id fallback\n');
    }

    let lastErr;
    for (let i = 0; i < 6; i++) {
      try {
        // Always pass build inputs (release+arm64 by default — small APK)
        const body = {
          ref: branch,
          inputs: {
            build_mode: String(cfg.buildMode || 'release'),
            target_abi: String(cfg.targetAbi || 'arm64'),
            tree_shake: cfg.treeShakeIcons === false ? 'false' : 'true',
          },
        };
        await this._gh(
          cfg,
          `/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
          'POST',
          body
        );
        lastErr = null;
        this._appendLog('Dispatch OK (try ' + (i + 1) + ')\n');
        break;
      } catch (e) {
        lastErr = e;
        this._appendLog(`Dispatch try ${i + 1}: ${e.message}\n`);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
    if (lastErr) throw lastErr;

    this._set(25, 'Queued…', 'Waiting for run', cfg.githubRepo);
    await new Promise((r) => setTimeout(r, 5000));
    try {
      const runs = await this._gh(
        cfg,
        `/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs?per_page=5`
      );
      if ((runs.workflow_runs || []).length) return runs.workflow_runs[0].id;
    } catch (_) {}
    const all = await this._gh(cfg, `/repos/${owner}/${repo}/actions/runs?per_page=5`);
    return (all.workflow_runs || [])[0]?.id || null;
  }

  _pollRun(cfg, runId) {
    const [owner, repo] = cfg.githubRepo.split('/');
    let ticks = 0;

    const tick = async () => {
      if (this._cancelled) return;
      ticks++;
      try {
        const run = await this._gh(cfg, `/repos/${owner}/${repo}/actions/runs/${runId}`);
        const status = run.status;
        const conclusion = run.conclusion;
        const pct =
          status === 'queued' ? 30 : status === 'in_progress' ? Math.min(90, 35 + ticks * 2) : 100;

        this._set(
          pct,
          status === 'completed' ? `Finished: ${conclusion || 'done'}` : `Status: ${status}`,
          run.display_title || run.name || 'Flutter APK',
          run.html_url || `https://github.com/${owner}/${repo}`
        );

        try {
          const jobs = await this._gh(cfg, `/repos/${owner}/${repo}/actions/runs/${runId}/jobs`);
          const job = (jobs.jobs || [])[0];
          if (job) {
            this._appendLog(
              `\n[${new Date().toISOString()}] job=${job.name} status=${job.status} conclusion=${job.conclusion || '-'}\n`
            );
            if (job.steps) {
              for (const s of job.steps) {
                this._appendLog(
                  `  • ${s.name}: ${s.status}${s.conclusion ? ' / ' + s.conclusion : ''}\n`
                );
              }
            }
          }
        } catch (le) {
          this._appendLog('Job fetch: ' + le.message + '\n');
        }

        if (status === 'completed') {
          if (this._timer) clearInterval(this._timer);
          const ok = conclusion === 'success';
          this._set(
            100,
            ok ? 'Build success' : `Build ${conclusion}`,
            ok ? 'Tap Download APK or open Artifacts on GitHub' : 'See logs on GitHub',
            run.html_url || ''
          );
          if (ok) {
            const dl = this.$container.querySelector('#fb-dl');
            if (dl) dl.hidden = false;
            this._lastRunId = runId;
            // Resolve artifact id for reliable download later
            try {
              const arts = await this._gh(
                cfg,
                `/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`
              );
              const art = (arts.artifacts || []).find((a) => /apk/i.test(a.name)) || (arts.artifacts || [])[0];
              if (art) this._lastArtifactId = art.id;
              this._saveHistoryEntry({
                runId,
                artifactId: art?.id || null,
                repo: cfg.githubRepo,
                conclusion: 'success',
                status: 'completed',
                mode: cfg.buildMode || 'release',
                abi: cfg.targetAbi || 'arm64',
                when: new Date().toISOString().slice(0, 16).replace('T', ' '),
                htmlUrl: run.html_url || `https://github.com/${owner}/${repo}/actions/runs/${runId}`,
              });
              this._renderHistory();
            } catch (ae) {
              this._appendLog('Artifact list: ' + ae.message + '\n');
            }
          } else {
            this._saveHistoryEntry({
              runId,
              repo: cfg.githubRepo,
              conclusion: conclusion || 'failed',
              status: 'completed',
              mode: cfg.buildMode || 'release',
              when: new Date().toISOString().slice(0, 16).replace('T', ' '),
              htmlUrl: run.html_url || '',
            });
            this._renderHistory();
          }
          window.toast(ok ? 'Flutter APK build OK' : 'Build finished with issues', 4000);
        }
      } catch (e) {
        this._appendLog('Poll error: ' + e.message + '\n');
      }
    };

    tick();
    this._timer = setInterval(tick, 8000);
  }

  async _downloadArtifact() {
    const cfg = this._cfg;
    if (!cfg?.githubToken || !cfg.githubRepo) {
      window.toast('GitHub token / repo required', 2500);
      return;
    }
    if (!this._lastRunId && !this._lastArtifactId) {
      window.toast('No successful run to download', 2500);
      return;
    }
    const [owner, repo] = cfg.githubRepo.split('/');
    try {
      this._set(null, 'Fetching artifact…', 'app-apk', cfg.githubRepo);
      let artId = this._lastArtifactId;
      if (!artId && this._lastRunId) {
        const arts = await this._gh(
          cfg,
          `/repos/${owner}/${repo}/actions/runs/${this._lastRunId}/artifacts`
        );
        const list = arts.artifacts || [];
        const art = list.find((a) => /apk/i.test(a.name)) || list[0];
        if (!art) {
          window.toast('No artifact on this run (expired or empty upload)', 3500);
          this._appendLog('No artifacts. Check workflow path build/app/outputs/flutter-apk/*.apk\n');
          return;
        }
        artId = art.id;
        this._lastArtifactId = artId;
        this._appendLog(`Artifact: ${art.name} id=${artId} size=${art.size_in_bytes}\n`);
        if (art.expired) {
          window.toast('Artifact expired on GitHub — rebuild', 3500);
          return;
        }
      }

      // Step-by-step short commands (Acode Executor truncates long one-liners /
      // multi-line scripts and often returns empty stdout for them).
      // Logic stays in JS; each shell call is small and always echoes a marker.
      const url = `https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${artId}/zip`;
      const destZip = `$HOME/Download/xhlp-app-apk-${artId}.zip`;
      const destDir = `$HOME/Download/xhlp-apk-${artId}`;
      const bodyTmp = `$HOME/Download/.xhlp-body-${artId}`;
      const hdrFile = `$HOME/Download/.xhlp-hdr-${artId}`;
      const token = cfg.githubToken;

      const run = async (cmd) => {
        try {
          return String((await executeCommand(cmd, true)) || '');
        } catch (err) {
          return String(err?.message || err || '');
        }
      };

      this._appendLog('Downloading (step-by-step)…\n');
      await run('mkdir -p "$HOME/Download"');

      // Step 1: request artifact zip URL, save headers + body separately
      const step1 = await run(
        `curl -sS -D "${hdrFile}" -o "${bodyTmp}" ` +
          `-H "Authorization: Bearer ${token}" ` +
          `-H "Accept: application/vnd.github+json" ` +
          `-H "X-GitHub-Api-Version: 2022-11-28" ` +
          `"${url}" ; echo ";CURL_EXIT:$?"`
      );
      this._appendLog('step1: ' + step1.slice(0, 200) + '\n');

      const statusOut = await run(
        `head -1 "${hdrFile}" 2>/dev/null | tr -d "\\r" | awk '{print $2}' ; echo`
      );
      const status = (statusOut || '').trim().split('\n')[0].trim();
      this._appendLog('STEP1_STATUS=' + status + '\n');

      const locOut = await run(
        `grep -i "^location:" "${hdrFile}" 2>/dev/null | tail -1 | sed "s/^[Ll]ocation: *//" | tr -d "\\r\\n" ; echo`
      );
      const loc = (locOut || '').trim().split('\n')[0].trim();

      let zipReady = false;

      if (status === '200') {
        await run(`mv -f "${bodyTmp}" "${destZip}"`);
        zipReady = true;
      } else if (['301', '302', '307', '308'].includes(status)) {
        if (!loc || !/^https?:\/\//i.test(loc)) {
          const bodyPeek = await run(`head -c 300 "${bodyTmp}" 2>/dev/null ; echo`);
          throw new Error(
            'GitHub redirected but no usable Location header. Body: ' + bodyPeek.slice(0, 160)
          );
        }
        this._appendLog('Redirect → downloading blob…\n');
        // No Authorization header on the Azure/pre-signed URL
        const step2 = await run(
          `curl -sS -L -w "\\nHTTP_CODE:%{http_code}" -o "${destZip}" "${loc}"`
        );
        this._appendLog('step2: ' + step2.slice(0, 180) + '\n');
        const codeMatch = step2.match(/HTTP_CODE:(\d+)/);
        const code2 = codeMatch ? codeMatch[1] : '';
        this._appendLog('STEP2_STATUS=' + code2 + '\n');
        if (code2 !== '200') {
          throw new Error(
            `Download link responded with HTTP ${code2 || 'unknown'} (expired or blocked — retry)`
          );
        }
        zipReady = true;
      } else {
        const bodyPeek = await run(`head -c 400 "${bodyTmp}" 2>/dev/null ; echo`);
        throw new Error(
          `GitHub returned HTTP ${status || 'unknown'} — ` + bodyPeek.trim().slice(0, 180)
        );
      }

      await run(`rm -f "${bodyTmp}" "${hdrFile}" 2>/dev/null`);

      if (!zipReady) throw new Error('Zip not downloaded');

      // Unzip + locate APK — no shell variable assignment
      // (Alpine/proot via init-alpine.sh breaks APK=$(...) → "APK=: not found")
      await run(`mkdir -p "${destDir}"`);
      const unzipOut = await run(
        `unzip -o -q "${destZip}" -d "${destDir}" ; echo UNZIP_RC:$?`
      );
      this._appendLog('unzip: ' + String(unzipOut).slice(0, 120) + '\n');

      const zipSizeOut = await run(`wc -c "${destZip}" 2>/dev/null`);
      this._appendLog('zip info: ' + String(zipSizeOut).trim().slice(0, 80) + '\n');

      // Plain find — prints path only
      const found = await run(
        `find "${destDir}" -iname "*.apk" -type f`
      );
      this._appendLog('find: ' + String(found).slice(0, 200) + '\n');
      const apkPath = String(found || '')
        .split('\n')
        .map((l) => l.trim())
        .find((l) => /\.apk$/i.test(l) && !/proot/i.test(l));

      if (apkPath) {
        const base = apkPath.split('/').pop();
        // Alpine/proot $HOME/Download is NOT Android Internal Storage.
        // Copy into real phone Download folder (same pattern as bundle buildManager).
        const androidTargets = [
          `/sdcard/Download/${base}`,
          `/storage/emulated/0/Download/${base}`,
        ];

        await run(`mkdir -p /sdcard/Download /storage/emulated/0/Download "$HOME/Download" 2>/dev/null`);
        // Keep a copy inside Alpine too
        await run(`cp "${apkPath}" "$HOME/Download/${base}" 2>/dev/null`);

        let savedAndroid = null;
        for (const dest of androidTargets) {
          const cpOut = await run(`cp "${apkPath}" "${dest}" ; echo CP_RC:$?`);
          this._appendLog('copy → ' + dest + ' :: ' + String(cpOut).trim().slice(0, 60) + '\n');
          if (/CP_RC:0/.test(cpOut)) {
            const verify = await run(`ls -la "${dest}" 2>/dev/null`);
            if (String(verify).includes(base)) {
              savedAndroid = dest;
              break;
            }
          }
        }

        if (savedAndroid) {
          this._appendLog('DL_APK:' + savedAndroid + '\n');
          this._set(100, 'APK ready', savedAndroid, cfg.githubRepo);
          window.toast('APK saved: Internal Storage/Download/' + base, 4500);
          return;
        }

        // Fallback: Alpine path only
        const alpinePath = `$HOME/Download/${base}`;
        this._appendLog('DL_APK_ALPINE:' + alpinePath + ' (Android copy failed)\n');
        this._set(100, 'APK in Alpine only', alpinePath, cfg.githubRepo);
        window.toast('APK in Alpine ~/Download — Android Download copy failed', 4500);
        return;
      }

      const listing = await run(`ls -la "${destDir}"`);
      this._appendLog('dir listing:\n' + String(listing).slice(0, 400) + '\n');

      const sizeNum = parseInt(String(zipSizeOut).replace(/[^0-9]/g, ''), 10) || 0;
      if (sizeNum > 100) {
        // Try moving the zip itself to Android Download
        const zipName = `xhlp-app-apk-${artId}.zip`;
        await run(`mkdir -p /sdcard/Download 2>/dev/null`);
        const zipCp = await run(
          `cp "${destZip}" "/sdcard/Download/${zipName}" ; echo CP_RC:$?`
        );
        if (/CP_RC:0/.test(zipCp)) {
          this._set(100, 'Zip in Download', `/sdcard/Download/${zipName}`, cfg.githubRepo);
          window.toast('Zip saved: Internal Storage/Download/' + zipName, 4000);
          return;
        }
        this._set(100, 'Artifact zip saved', `~/Download/${zipName}`, cfg.githubRepo);
        window.toast('Zip only in Alpine ~/Download', 4000);
        return;
      }
      throw new Error('Zip downloaded but no APK found inside — check artifact contents');
    } catch (e) {
      this._appendLog('Download error: ' + (e.message || e) + '\n');
      this._set(100, 'Download failed', e.message || String(e), cfg.githubRepo);
      window.toast(e.message || 'Download failed', 4500);
      try {
        const system = acode.require('system');
        const page = this._lastRunId
          ? `https://github.com/${cfg.githubRepo}/actions/runs/${this._lastRunId}`
          : `https://github.com/${cfg.githubRepo}/actions`;
        if (system?.openInBrowser) system.openInBrowser(page);
      } catch (_) {}
    }
  }

}