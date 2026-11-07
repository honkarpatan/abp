/**
 * Flutter preview / tooling environment checks.
 */
import plugin from '../../../plugin.json';
import { executeCommand } from '../../services/terminalManager.js';
import { getSettings } from '../../services/settings.js';

/** Official ARM64 Flutter SDK zip used by in-app installer */
export const FLUTTER_SDK_DOWNLOAD_URL =
  'https://github.com/zhzhzhy/Flutter-SDK-ARM64/releases/download/Flutter-SDK-2026-08-28/Flutter-SDK-ARM64.zip';

/** Default install root inside Alpine ($HOME expands to /public) */
export const FLUTTER_DEFAULT_HOME = '$HOME/flutter';

export function getFlutterSettings() {
  const s = getSettings() || {};
  return {
    flutterSdk: s.flutterSdk || '',
    webPort: s.flutterWebPort || '8080',
    githubToken: s.flutterGithubToken || '',
    githubRepo: s.flutterGithubRepo || '',
    githubBranch: s.flutterGithubBranch || 'main',
    autoCreateRepo: s.flutterGithubAutoRepo !== false,
    buildMode: s.flutterBuildMode || 'release',
    targetAbi: s.flutterTargetAbi || 'arm64',
    treeShakeIcons: s.flutterTreeShakeIcons !== false,
  };
}

async function shellExists(pathOrCmd) {
  if (!pathOrCmd) return false;
  try {
    const p = String(pathOrCmd).replace(/^file:\/\//, '');
    const out = await executeCommand(
      `sh -c 'TARGET=${JSON.stringify(p)}; TARGET=$(eval echo "$TARGET"); ` +
        `if [ -e "$TARGET" ] || [ -x "$TARGET" ]; then echo EXISTS; ` +
        `elif command -v "$TARGET" >/dev/null 2>&1; then echo EXISTS; ` +
        `else echo MISSING; fi'`,
      true
    );
    return (out || '').includes('EXISTS');
  } catch (_) {
    return false;
  }
}

/** Resolve likely flutter binary paths from settings + defaults */
export function getFlutterCandidatePaths() {
  const cfg = getFlutterSettings();
  const list = [];
  if (cfg.flutterSdk) {
    list.push(cfg.flutterSdk);
    if (!cfg.flutterSdk.endsWith('/flutter') && !cfg.flutterSdk.endsWith('bin/flutter')) {
      list.push(`${cfg.flutterSdk.replace(/\/$/, '')}/bin/flutter`);
    }
  }
  list.push(`${FLUTTER_DEFAULT_HOME}/bin/flutter`);
  list.push('/public/flutter/bin/flutter');
  list.push('flutter');
  return [...new Set(list.filter(Boolean))];
}

export async function isFlutterSdkInstalled() {
  for (const c of getFlutterCandidatePaths()) {
    if (await shellExists(c)) return true;
  }
  return false;
}

/**
 * @returns {Promise<Array<{ id: string, name: string, size: string, required: boolean, ok?: boolean, hint?: string }>>}
 */
export async function getMissingFlutterComponents() {
  const missing = [];
  const flutterOk = await isFlutterSdkInstalled();

  if (!flutterOk) {
    missing.push({
      id: 'flutter_sdk',
      name: 'Flutter SDK (ARM64)',
      size: '~800 MB–1.2 GB',
      required: true,
      ok: false,
      hint: 'Download from GitHub release (ARM64 zip)',
    });
  }

  if (!(await shellExists('curl')) && !(await shellExists('wget'))) {
    missing.push({
      id: 'downloader',
      name: 'wget or curl',
      size: '~1 MB',
      required: true,
      ok: false,
      hint: 'Needed to download the SDK zip',
    });
  }

  if (!(await shellExists('unzip'))) {
    missing.push({
      id: 'unzip',
      name: 'unzip',
      size: '~1 MB',
      required: true,
      ok: false,
      hint: 'Extract Flutter-SDK-ARM64.zip',
    });
  }

  return missing;
}


/** Absolute-ish shell path to flutter binary (prefers settings, then $HOME/flutter). */
export async function getFlutterBinPath() {
  for (const c of getFlutterCandidatePaths()) {
    if (c === 'flutter') continue;
    if (await shellExists(c)) {
      // Prefer path ending with bin/flutter
      if (c.endsWith('/bin/flutter') || c.endsWith('bin/flutter')) return c;
      if (await shellExists(`${c.replace(/\/$/, '')}/bin/flutter`)) {
        return `${c.replace(/\/$/, '')}/bin/flutter`;
      }
      return c;
    }
  }
  if (await shellExists('flutter')) return 'flutter';
  return `${FLUTTER_DEFAULT_HOME}/bin/flutter`;
}

export async function isDartSdkReady() {
  const bin = await getFlutterBinPath();
  try {
    const out = await executeCommand(
      `sh -c 'FB=$(eval echo ${JSON.stringify(bin)}); ROOT=$(dirname "$(dirname "$FB")"); ` +
        `if [ -x "$ROOT/bin/cache/dart-sdk/bin/dart" ]; then echo OK; else echo NO; fi'`,
      true
    );
    return (out || '').includes('OK');
  } catch (_) {
    return false;
  }
}

export async function checkFlutterPreviewReady() {
  return isFlutterSdkInstalled();
}

export function saveFlutterSetting(key, value) {
  const settings = acode.require('settings');
  if (!settings.value[plugin.id]) settings.value[plugin.id] = {};
  settings.value[plugin.id][key] = value;
  settings.update();
}
