import plugin from '../../plugin.json';
import { selectCustomSnippetPath } from './customSnippets.js';
import { clearSnippetCache } from './completer.js';
import { selectAndroHome, showManualPathModal, resetPathSettings, defaultPathConfig , defaultDownloadConfig } from './pathManager.js';
// নতুন এক্সপোর্টার ইম্পোর্ট করুন
import { exportPluginToZip } from './pluginExporter.js'; 

const appSettings = acode.require('settings');

const defaultCustomConfig = `{
  "BasedOnStyle": "Google",
  "IndentWidth": 4,
  "ColumnLimit": 100,
  "AllowShortFunctionsOnASingleLine": "None",
  "BreakBeforeBraces": "Attach"
}`;

const defaultSettings = {
  pluginEnabled: true,
  customAndroHome: null, 
  componentPaths: JSON.stringify(defaultPathConfig, null, 4), 
  downloadUrls: JSON.stringify(defaultDownloadConfig, null, 4), 
  // Preview mode: 'html' = legacy in-plugin XML→HTML, 'external' = Android Builder Pro External Previewer app
  xmlPreviewMode: 'html',
  externalPreviewHost: '127.0.0.1',
  externalPreviewPort: 38471,
  externalPreviewToken: '',
  /** terminal = offline gradle in Alpine; github = Actions (default) */
  androidBuildVia: 'github',
  androidGithubToken: '',
  androidGithubRepo: '',
  androidGithubBranch: 'main',
  androidGithubUseCustomWorkflow: false,
  androidGithubWorkflowPath: '.github/workflows/xhlp-android-build.yml',
  androidGithubAutoCreateRepo: true,
  enableJavaCompletion: true,
  enableKotlinCompletion: true,
  enableXmlCompletion: true,
  enableDartCompletion: true,
  enableAutoImport: true,
  enableSnippets: true,
  enableCustomSnippets: false,
  customSnippetPath: '',
  clangFormatStyle: 'Google', 
  clangFormatCustom: defaultCustomConfig,
};

function getSettings() {
  let pluginSettings = appSettings.value[plugin.id];
  if (!pluginSettings) {
    pluginSettings = { ...defaultSettings };
    appSettings.value[plugin.id] = pluginSettings;
    appSettings.update(false);
    return pluginSettings;
  }
  
  // Migration logic
  let changed = false;
  for (const key in defaultSettings) {
    if (!Object.prototype.hasOwnProperty.call(pluginSettings, key)) {
      pluginSettings[key] = defaultSettings[key];
      changed = true;
    }
  }
  if (changed) appSettings.update(false);
  return pluginSettings;
}

// Settings UI List
const settingsList = [
  {
    key: 'pluginEnabled',
    text: 'Enable Android Builder',
    checkbox: getSettings().pluginEnabled,
    info: 'Globally enable or disable all features of this plugin.'
  },
  
  // --- EXPORT SECTION (NEW) ---
  // {
  //     index: 1, // High priority
  //     text: "Transfer Purchase",
  //     info: "If you bought this on Play Store but need to use it on F-Droid version."
  // },
  {
      key: 'btnExportPlugin',
      text: 'Export Plugin (Save as ZIP)',
      info: 'Creates "aidpro.zip" in Download folder. Install this zip in Acode (F-Droid).',
      checkbox: false // Button behaviour
  },
  
  // --- PATH CONFIGURATION SECTION ---
  // {
  //     index: 2,
  //     text: "Environment Configuration",
  //     info: "Setup paths for Android SDK, Gradle and Java"
  // },
  {
    key: 'androHomeMethod', 
    text: 'Change Android Home',
    value: '', 
    select: [
      ["select_folder", "Select Folder (File Browser)"],
      ["manual_input", "Manual Input (Type Path)"]
    ],
    info: 'Choose how you want to set the Android Home directory.'
  },
  {
    key: 'componentPaths',
    text: 'Component Paths (JSON)',
    prompt: 'Edit Component Paths',
    promptType: 'textarea',
    value: getSettings().componentPaths,
    info: 'Edit paths for Java, Gradle, etc. using variables ${ANDRO_HOME} and ${TERM_HOME}.'
  },
  {
    key: 'downloadUrls',
    text: 'Download URLs (JSON)',
    prompt: 'Edit Download Links',
    promptType: 'textarea',
    value: getSettings().downloadUrls,
    info: 'Customize direct download links for SDK, Gradle, and AAPT2.'
  },
  {
    key: 'btnResetPaths',
    text: 'Reset Paths & URLs to Default',
    info: 'Click to reset Android Home, Paths and Download URLs to original settings.',
    checkbox: false 
  },
  // --- XML / Layout Preview Mode ---
  {
    key: 'xmlPreviewMode',
    text: 'XHLP Preview as',
    value: getSettings().xmlPreviewMode || 'html',
    select: [
      ['html', 'HTML (Legacy in-plugin)'],
      ['external', 'Android Builder Pro External Previewer']
    ],
    info: 'HTML = current XML→HTML preview inside Acode. External = push to companion Layout Preview Host app (accurate native inflate).'
  },
  {
    key: 'externalPreviewHost',
    text: 'External Preview Host',
    value: getSettings().externalPreviewHost || '127.0.0.1',
    prompt: 'Host (loopback)',
    promptType: 'text',
    info: 'Almost always 127.0.0.1. Must match Layout Preview Host bind address.'
  },
  {
    key: 'externalPreviewPort',
    text: 'External Preview Port',
    value: String(getSettings().externalPreviewPort || 38471),
    prompt: 'Port number',
    promptType: 'number',
    info: 'Default 38471. Must match Host listen port (WebSocket).'
  },
  {
    key: 'externalPreviewToken',
    text: 'External Preview Token',
    value: getSettings().externalPreviewToken || '',
    prompt: 'Auth token (optional)',
    promptType: 'text',
    info: 'If Host has a token set, paste it here. Leave empty when Host allows open localhost.'
  },
  // --- Android native build ---
  {
    key: 'androidBuildVia',
    text: 'Android native build via',
    value: getSettings().androidBuildVia || 'github',
    select: [
      ['github', 'GitHub (online Actions)'],
      ['terminal', 'Terminal (offline)'],
    ],
    info: 'GitHub = build on Actions (no local SDK). Terminal = local Gradle in Alpine (requires setup). Default: GitHub.',
  },
  {
    key: 'androidGithubToken',
    text: 'Android GitHub token',
    value: getSettings().androidGithubToken || '',
    prompt: 'ghp_… (repo + workflow)',
    promptType: 'text',
    info: 'PAT with repo + workflow scopes for Android GitHub builds.',
  },
  {
    key: 'androidGithubRepo',
    text: 'Android GitHub repo',
    value: getSettings().androidGithubRepo || '',
    prompt: 'owner/repo',
    promptType: 'text',
    info: 'Repository that contains this Android project (or will receive the workflow).',
  },
  {
    key: 'androidGithubBranch',
    text: 'Android GitHub branch',
    value: getSettings().androidGithubBranch || 'main',
    prompt: 'Branch',
    promptType: 'text',
    info: 'Branch used for workflow_dispatch (usually main).',
  },
  {
    key: 'androidGithubUseCustomWorkflow',
    text: 'Use custom GitHub workflow file',
    checkbox: !!getSettings().androidGithubUseCustomWorkflow,
    info: 'On: use your workflow path as-is. Off: XHLP auto-writes workflow from project SDK/variant settings.',
  },
  {
    key: 'androidGithubWorkflowPath',
    text: 'GitHub workflow path',
    value: getSettings().androidGithubWorkflowPath || '.github/workflows/xhlp-android-build.yml',
    prompt: 'Path in repo',
    promptType: 'text',
    info: 'Default .github/workflows/xhlp-android-build.yml',
  },
  {
    key: 'androidGithubAutoCreateRepo',
    text: 'Auto-create private repo',
    checkbox: getSettings().androidGithubAutoCreateRepo !== false,
    info: 'If repo is empty or missing, xhlp creates a private repo under your account, pushes the project (git), adds the workflow, then builds. Token needs repo + workflow scopes.',
  },
  // ... Completion & Formatter settings ...
  {
    key: 'enableJavaCompletion',
    text: 'Enable Java Completion',
    checkbox: getSettings().enableJavaCompletion,
    info: 'Suggest completions for .java files.'
  },
  {
    key: 'enableKotlinCompletion',
    text: 'Enable Kotlin Completion',
    checkbox: getSettings().enableKotlinCompletion,
    info: 'Suggest completions for .kt / .kts files.'
  },
  {
    key: 'enableDartCompletion',
    text: 'Enable Dart Completion',
    checkbox: getSettings().enableDartCompletion !== false,
    info: 'Keywords + snippets for .dart (Flutter) files.'
  },
  {
    key: 'enableAutoImport',
    text: 'Auto-import (Java / Kotlin / Dart)',
    checkbox: getSettings().enableAutoImport !== false,
    info: 'On save or command: add missing common imports for Java, Kotlin, and Dart.',
  },
  {
    key: 'enableXmlCompletion',
    text: 'Enable XML Completion',
    checkbox: getSettings().enableXmlCompletion,
    info: 'Suggest completions for .xml files.'
  },
  {
    key: 'enableSnippets',
    text: 'Enable Default Snippets',
    checkbox: getSettings().enableSnippets,
    info: 'Suggest built-in code snippets (e.g. sout, psvm, fun).'
  },
  {
    key: 'enableCustomSnippets',
    text: 'Enable Custom Snippets',
    checkbox: getSettings().enableCustomSnippets,
    info: 'Load snippets from your custom folder.'
  },
  {
    key: 'runSnippetPathSelector',
    text: 'Set Custom Snippet Folder',
    value: (() => {
      const path = getSettings().customSnippetPath;
      if (!path) return 'Click to select folder';
      const short = path.includes('::') ? path.split('::').pop() : path.split('/').pop();
      return `::${short}`;
    })(),
    info: 'Select a folder to store and load your custom snippets.'
  },
  {
    key: 'clangFormatStyle',
    text: 'Formatter Style Preset',
    value: getSettings().clangFormatStyle,
    select: [
      ["Google", "Google (Standard Android)"],
      ["LLVM", "LLVM"],
      ["Mozilla", "Mozilla"],
      ["Chromium", "Chromium"],
      ["Microsoft", "Microsoft"]
    ],
    info: "Choose a built-in formatting style."
  },
  {
    key: 'clangFormatCustom',
    text: 'Custom Format Style (JSON/YAML)',
    value: getSettings().clangFormatCustom,
    prompt: 'Edit Custom Format Style',
    promptType: 'textarea',
    info: "Edit the values below to customize your code style."
  }
];

// Change Handler
async function onSettingsChange(key, value) {
  const settings = getSettings();

  // --- NEW: Handle Export Button ---
  if (key === 'btnExportPlugin') {
      await exportPluginToZip();
      return;
  }

  // --- Handle Android Home Selection Method ---
  if (key === 'androHomeMethod') {
      if (value === 'select_folder') {
          await selectAndroHome();
      } else if (value === 'manual_input') {
          showManualPathModal();
      }
      return; 
  }

  // Handle Reset
  if (key === 'btnResetPaths') {
      resetPathSettings();
      return; 
  }

  if (key === 'runSnippetPathSelector') {
    selectCustomSnippetPath(); 
    return;
  }
  
  // Validation for JSON Fields
  if (key === 'componentPaths' || key === 'downloadUrls') {
      try {
          JSON.parse(value); 
      } catch (e) {
          window.toast('Invalid JSON format! Changes not saved.', 3000);
          return;
      }
  }

  if (key === 'externalPreviewPort') {
      const n = parseInt(value, 10);
      if (!Number.isFinite(n) || n < 1 || n > 65535) {
          window.toast('Port must be 1–65535', 2500);
          return;
      }
      settings[key] = n;
      appSettings.update();
      return;
  }

  // Save regular settings
  settings[key] = value;
  appSettings.update();
  
  // Dynamic Update for globals
  if (key === 'customAndroHome' && value) {
      window.ANDRO_HOME = value;
  }
  
  if (key === 'customSnippetPath' || key === 'enableCustomSnippets') {
    clearSnippetCache();
  }
}

export {
  getSettings,
  settingsList,
  onSettingsChange
};