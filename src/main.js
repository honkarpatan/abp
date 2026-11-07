// xhlp main.js
import plugin from '../plugin.json';
import { getSettings, settingsList, onSettingsChange } from './services/settings.js';
import buildExecutor from './initPlugin.js'; 
import { initFormatter, destroyFormatter } from './services/formatter.js';

// 🚀 UPDATE: নতুন হাইব্রিড ফাংশনগুলো ইমপোর্ট করা হলো
import { registerAndroidCompleter, removeCompleter } from './services/completer.js';
import { registerAutoImportCommand } from './services/autoImport.js';

import { CommandManager } from './commands/commands.js';
import './styles/styles.css';

window.ACODE_DIR = '' ;
window.ACODE_ID = '' ;
window.XHLP_PREVIEW_SCREEN = null ;

let baseUrl = '';
// Default internal path
let defaultAndroHome = '';

async function init($page, cacheFile, cacheFileUrl) {
    const settings = getSettings();
    if (!settings.pluginEnabled) return;
    
    // 1. Setup ID and Basic Dirs
    window.ACODE_DIR = PLUGIN_DIR.split("/files/plugins")[0];
    
    if(window.IS_FREE_VERSION){
      window.ACODE_ID =  'com.foxdebug.acodefree' ;
    } else {
      window.ACODE_ID =  'com.foxdebug.acode' ;
    }
    
    // 2. Setup Defaults — Alpine/proot can WRITE under $HOME only.
    // Absolute /data/user/0/... paths cause: mkdir: Permission denied
    // (same class of issue as PHP/C++ plugins on shared storage).
    defaultAndroHome = `$HOME/${plugin.id}`;
    window.ACODE_TERMINAL_HOME = `$HOME`;
    
    // 3. Determine ANDRO_HOME (User Custom or Default)
    // Settings থেকে চেক করবে যদি ইউজার পাথ চেঞ্জ করে থাকে
    if (settings.customAndroHome && !String(settings.customAndroHome).includes('/data/user/')) {
        window.ANDRO_HOME = settings.customAndroHome;
    } else if (settings.customAndroHome && String(settings.customAndroHome).includes('/data/user/')) {
        // Old saved path — force Alpine-writable home
        window.ANDRO_HOME = defaultAndroHome;
        try {
          settings.customAndroHome = defaultAndroHome;
        } catch (_) {}
    } else {
        window.ANDRO_HOME = defaultAndroHome;
    }
    // Host-style path only for display / optional Acode FS (resolved later if needed)
    window.ANDRO_HOME_HOST = `/data/user/0/${window.ACODE_ID}/files/alpine/home/${plugin.id}`;
    
    // Debug Log
    // console.log("Android Home set to:", window.ANDRO_HOME);

    // init Commands
    await CommandManager.init();

    // init build btn & exc
    await buildExecutor.init();

    // init formatter & compiler
    if (baseUrl) initFormatter(baseUrl);
    
    // 🚀 UPDATE: নতুন হাইব্রিড কমপ্লিটার কল করা হলো
    registerAndroidCompleter();
    registerAutoImportCommand();
}

// ❌ পুরনো registerCompleterWithRetry() ফাংশনটি ডিলিট করা হলো 
// কারণ registerAndroidCompleter এর ভেতরেই retry লজিক এবং CM6/Ace চেকিং দেওয়া আছে।

function destroy() {
    // Cleanup Commands
    CommandManager.destroy();
    
    // Cleanup Build Executor
    if (buildExecutor) buildExecutor.destroy();
    
    // Cleanup Formatter & Completer
    destroyFormatter();
    
    // 🚀 UPDATE: হাইব্রিড ক্লিনআপ কল করা হলো (এটি CM6 এবং Ace দুটোর ক্যাশ ক্লিন করবে)
    removeCompleter();
}

if (window.acode) {
    acode.setPluginInit(plugin.id, async (_baseUrl, $page, { cacheFileUrl, cacheFile }) => {
        baseUrl = _baseUrl;
        setTimeout(async () => {
            await init($page, cacheFile, cacheFileUrl);
        }, 500);
    }, {
        list: settingsList,
        cb: onSettingsChange
    });
    acode.setPluginUnmount(plugin.id, () => {
        destroy();
    });
}