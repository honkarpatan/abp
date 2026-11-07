import plugin from '../../plugin.json';
import { getSettings } from './settings.js';
const fs = acode.require('fs');
const fileBrowser = acode.require('fileBrowser');

// Helper to ensure leading slash/valid string for variables
const cleanVar = (val) => {
    if (!val) return '';
    return val;
};

//: Path Converter Helper (Content URI -> Filesystem Path)
function convertToFsPath(rawPath) {
    if (!rawPath) return '';
    
    let path = rawPath;

    // 1. Handle Content URI
    if (path.includes('content://')) {
        try {
            const decoded = decodeURIComponent(path);
            
            // Case A: Primary Storage (Internal SD Card)
            if (decoded.includes('primary:')) {
                // Example: .../primary:Android/data -> /sdcard/Android/data
                const id = decoded.split('primary:').pop();
                return '/sdcard/' + (id.startsWith('/') ? id.substring(1) : id);
            } 
            // Case B: Document Tree (Standard Acode format)
            else if (decoded.includes('document/')) {
                 // Fallback logic usually required here, but primary is most common.
                 // If using specific SD Card ID (e.g. 1234-5678), handling gets complex.
                 // For now, assuming user selects Internal Storage mainly.
            }
        } catch (e) {
            console.error("Path conversion error:", e);
        }
    }

    // 2. Handle File URI
    if (path.startsWith('file://')) {
        path = path.replace('file://', '');
    }

    return path;
}

/**
 * Expand shell-style paths for use inside Gradle / Java.
 * Gradle does NOT expand $HOME — leaving it literal causes:
 *   Specified AAPT2 executable does not exist:
 *   .../app/$HOME/acode.plugin.xhlp/build-tools/34.0.0/aapt2
 *
 * In Acode Alpine, plugin home is visible as /public/<plugin.id>
 * (see build logs: Using Gradle: /public/acode.plugin.xhlp/gradle).
 */
export function expandAlpinePath(rawPath) {
    if (!rawPath) return '';
    let p = String(rawPath).replace(/^file:\/\//, '');

    // Acode Alpine convention from runtime logs
    const alpineHome = '/public';

    if (p.includes('$HOME')) {
        p = p.split('$HOME').join(alpineHome);
    }
    if (p.includes('${ANDRO_HOME}')) {
        const andro = expandAlpinePath(window.ANDRO_HOME || `$HOME/${plugin.id}`);
        p = p.split('${ANDRO_HOME}').join(andro);
    }
    if (p.includes('${TERM_HOME}')) {
        p = p.split('${TERM_HOME}').join(alpineHome);
    }

    // Collapse accidental double slashes (keep leading // out of scope)
    p = p.replace(/([^:])\/{2,}/g, '$1/');
    return p;
}

/** Absolute aapt2 path for android.aapt2FromMavenOverride (never leave $HOME). */
export function getAapt2AbsolutePath() {
    const paths = getResolvedPaths();
    const buildTools = paths.buildTools && paths.buildTools.path
        ? expandAlpinePath(paths.buildTools.path)
        : expandAlpinePath(`${window.ANDRO_HOME || '$HOME/' + plugin.id}/build-tools/34.0.0`);
    return `${buildTools.replace(/\/$/, '')}/aapt2`;
}

/** Line to inject into project gradle.properties before Gradle runs. */
export function getAapt2GradlePropertyLine() {
    return `android.aapt2FromMavenOverride=${getAapt2AbsolutePath()}`;
}

// 1. Get Variables
export const getVariables = () => ({
    '${ANDRO_HOME}': cleanVar(window.ANDRO_HOME),
    '${TERM_HOME}': cleanVar(window.ACODE_TERMINAL_HOME)
});

// 2. Default Component Paths (Added explicit VERSION key)
export const defaultPathConfig = {
    java: {
        // Alpine openjdk17 installs under /usr — NOT under $HOME
        path: "file:///usr/lib/jvm/java-17-openjdk/bin/java",
        name: "Java (OpenJDK)",
        version: "17"
    },
    gradle: {
        path: "file://${ANDRO_HOME}/gradle/bin/gradle",
        name: "Gradle",
        version: "8.5"
    },
    sdkmanager: {
        path: "file://${ANDRO_HOME}/cmdline-tools/latest/bin/sdkmanager",
        name: "SDK Command Line Tools",
        version: null
    },
    platform: {
        path: "file://${ANDRO_HOME}/platforms/android-34",
        name: "Android SDK Platform",
        version: "android-34"
    },
    buildTools: {
        path: "file://${ANDRO_HOME}/build-tools/34.0.0",
        name: "Build Tools",
        version: "34.0.0"
    }
};

// 3. Default Download URLs
export const defaultDownloadConfig = {
    sdkUrl: "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip",
    gradleUrl: "https://services.gradle.org/distributions/gradle-8.5-bin.zip",
    aapt2Url: "https://github.com/Sou6900/aapt2---linux-arm64/raw/refs/heads/main/arm64-v8/aapt2"
};

// 4. Resolver Logic
export function getResolvedPaths() {
    const settings = getSettings();
    // Merge saved config ON TOP of defaults (keep new keys / fixed java path)
    let config = { ...defaultPathConfig };

    if (settings.componentPaths) {
        try {
            const parsed = JSON.parse(settings.componentPaths);
            if (parsed && typeof parsed === 'object') {
                for (const [key, item] of Object.entries(parsed)) {
                    if (!item) continue;
                    const base = defaultPathConfig[key] || {};
                    config[key] = {
                        ...base,
                        ...(typeof item === 'object' ? item : { path: item })
                    };
                }
            }
        } catch (e) {
            console.error("Path Config Parse Error", e);
        }
    }

    const variables = getVariables();
    const resolved = {};

    for (const [key, item] of Object.entries(config)) {
        let pathTemplate = (typeof item === 'object') ? item.path : item;
        let displayName = (typeof item === 'object') ? item.name : key;
        let version = (typeof item === 'object') ? item.version : null;

        // Force-correct legacy Java templates that used TERM_HOME under $HOME
        if (key === 'java') {
            const bad =
                !pathTemplate ||
                pathTemplate.includes('${TERM_HOME}') ||
                pathTemplate.includes('$HOME/usr') ||
                pathTemplate.includes('$HOME\\usr');
            if (bad) {
                pathTemplate = defaultPathConfig.java.path;
            }
        }

        let finalPath = pathTemplate;
        for (const [varName, varValue] of Object.entries(variables)) {
            if (finalPath.includes(varName)) {
                const safeVal = varValue || '';
                finalPath = finalPath.split(varName).join(safeVal);
            }
        }

        // If ANDRO_HOME was empty, keep $HOME/plugin form for Alpine
        if (key !== 'java' && (!finalPath || finalPath.includes('file:///gradle') || finalPath.includes('file://undefined'))) {
            finalPath = pathTemplate;
        }

        // Expand $HOME so Java/Gradle never see a literal shell variable
        finalPath = expandAlpinePath(finalPath);

        resolved[key] = {
            path: finalPath,
            name: displayName,
            version: version
        };
    }
    return resolved;
}

// 5. Select Logic with Conversion
export async function selectAndroHome() {
    try {
        const result = await fileBrowser('folder', 'Select Android Home Directory');
        if (result && result.url) {
            // 🛠️ HERE IS THE FIX: Convert content:// to /sdcard/...
            const fsPath = convertToFsPath(result.url);
            
            // Validation: Ensure we got a valid path starting with /
            if (fsPath && fsPath.startsWith('/')) {
                 updateAndroHome(fsPath);
            } else {
                 // Fallback if conversion failed (rare but possible for weird URIs)
                 window.toast('Could not resolve real path. Try internal storage.', 4000);
                 console.warn("Path conversion failed for:", result.url);
            }
        }
    } catch (e) {
        console.error(e);
    }
}

export function showManualPathModal() {
    const currentPath = window.ANDRO_HOME || '';
    const overlay = document.createElement('div');
    overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); z-index: 9999; display: flex; justify-content: center; align-items: center;`;

    const modal = document.createElement('div');
    modal.style.cssText = `background-color: var(--secondary-color); color: var(--primary-text-color); width: 85%; max-width: 400px; padding: 20px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; flex-direction: column; gap: 15px;`;

    const title = document.createElement('h3');
    title.innerText = "Set Android Home Path";
    title.style.margin = "0";

    const input = document.createElement('input');
    input.type = "text";
    input.value = currentPath;
    input.placeholder = "/sdcard/AndroidBuilder"; // Updated placeholder
    input.style.cssText = `background: var(--primary-color); color: var(--primary-text-color); border: 1px solid var(--border-color, #444); padding: 10px; border-radius: 4px; outline: none; width: 100%;`;

    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = "display: flex; justify-content: flex-end; gap: 10px;";
    
    const btnSave = document.createElement('button');
    btnSave.innerText = "Save";
    btnSave.style.cssText = `padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; background: var(--button-background-color); color: white;`;
    
    const btnCancel = document.createElement('button');
    btnCancel.innerText = "Cancel";
    btnCancel.style.cssText = `padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; background: transparent; color: var(--secondary-text-color);`;

    const close = () => { if(overlay.parentNode) document.body.removeChild(overlay); };
    btnCancel.onclick = close;
    btnSave.onclick = () => {
        const newPath = input.value.trim();
        if(newPath) { updateAndroHome(newPath); close(); } 
        else { window.toast('Path cannot be empty', 3000); }
    };

    btnContainer.appendChild(btnCancel);
    btnContainer.appendChild(btnSave);
    modal.appendChild(title);
    modal.appendChild(input);
    modal.appendChild(btnContainer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

function updateAndroHome(newPath) {
    const settings = acode.require('settings');
    if (!settings.value[plugin.id]) settings.value[plugin.id] = {};
    settings.value[plugin.id].customAndroHome = newPath;
    settings.update();
    window.ANDRO_HOME = newPath;
    window.toast(`Home set to: ${newPath}`, 3000);
}

export function resetPathSettings() {
    const settings = acode.require('settings');
    if (!settings.value[plugin.id]) settings.value[plugin.id] = {};

    settings.value[plugin.id].componentPaths = JSON.stringify(defaultPathConfig, null, 4);
    settings.value[plugin.id].downloadUrls = JSON.stringify(defaultDownloadConfig, null, 4);
    settings.value[plugin.id].customAndroHome = null;

    settings.update();
    window.ANDRO_HOME = null;
    window.toast('All paths and urls reset to defaults.');
}