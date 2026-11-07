import plugin from '../../plugin.json';
import { getResolvedPaths } from '../services/pathManager.js';
import { executeCommand } from '../services/terminalManager.js';

const fs = acode.require('fs');

/**
 * Check if a tool exists inside Alpine (or Acode FS for real host paths).
 * Paths like file://$HOME/... are NOT readable via Acode fs — must use shell.
 */
async function checkExists(path) {
  if (!path) return false;

  let p = String(path).replace(/^file:\/\//, '').trim();
  if (!p) return false;

  // Alpine / proot paths — always verify via shell
  const needsAlpine =
    p.includes('$HOME') ||
    p.startsWith('/usr/') ||
    p.startsWith('/root') ||
    p.startsWith('/public') ||
    p.includes('acode.plugin') ||
    p.includes('/lib/jvm/') ||
    p.includes('gradle') ||
    p.includes('cmdline-tools') ||
    p.includes('build-tools') ||
    p.includes('/platforms/');

  if (needsAlpine) {
    try {
      // Expand $HOME etc, then test -e / -x
      const out = await executeCommand(
        `sh -c 'TARGET=${JSON.stringify(p)}; TARGET=$(eval echo "$TARGET"); ` +
          `if [ -e "$TARGET" ] || [ -x "$TARGET" ]; then echo EXISTS; ` +
          `elif command -v java >/dev/null 2>&1 && echo "$TARGET" | grep -q java; then echo EXISTS; ` +
          `else echo MISSING; fi'`,
        true
      );
      return (out || '').includes('EXISTS');
    } catch (e) {
      console.warn('[envCheck] Alpine check failed', p, e);
      return false;
    }
  }

  try {
    if (await fs(path).exists()) return true;
    if (await fs(p).exists()) return true;
  } catch (_) {}
  return false;
}

export async function getMissingComponents() {
  const missing = [];
  const components = getResolvedPaths();

  console.log('Environment Check Paths:', JSON.stringify(components, null, 2));

  const formatName = (name, version) => {
    if (!version) return name;
    let displayVer = version;
    if (displayVer.includes('-')) displayVer = displayVer.split('-').pop();
    return `${name} ${displayVer}`;
  };

  const addItem = (itemKey, dlLabel, dlVal, installVal) => {
    const item = components[itemKey];
    if (!item) return;
    missing.push({
      name: formatName(item.name, item.version),
      size: dlLabel,
      rawSize: dlVal,
      installSize: installVal
    });
  };

  try {
    if (!(await checkExists(components.java?.path))) {
      console.warn('Java NOT found at:', components.java?.path);
      addItem('java', '~108 MB', 108.0, 239.0);
    }

    if (!(await checkExists(components.gradle?.path))) {
      console.warn('Gradle NOT found at:', components.gradle?.path);
      addItem('gradle', '~134 MB', 134.0, 151.0);
    }

    if (!(await checkExists(components.sdkmanager?.path))) {
      console.warn('SDK Tools NOT found at:', components.sdkmanager?.path);
      addItem('sdkmanager', '~146 MB', 146.0, 425.0);
    }

    if (!(await checkExists(components.buildTools?.path))) {
      console.warn('Build Tools NOT found at:', components.buildTools?.path);
      addItem('buildTools', '~100 MB', 100.0, 300.0);
    }

    if (!(await checkExists(components.platform?.path))) {
      console.warn('Platform NOT found at:', components.platform?.path);
      addItem('platform', '~51 MB', 51.0, 130.0);
      missing.push({
        name: 'Others (AAPT2 & Libs)',
        size: '5.9 MB',
        rawSize: 5.9,
        installSize: 6.0
      });
    }
  } catch (e) {
    console.error('Env Check Critical Error:', e);
    return [{ name: 'Environment Setup Error', size: 'Check Logs', rawSize: 0, installSize: 0 }];
  }

  return missing;
}

export async function checkEnvironment() {
  const missing = await getMissingComponents();
  return missing.length === 0;
}

export function setSetupComplete() {
  localStorage.setItem('android_builder_setup_complete', 'true');
}
