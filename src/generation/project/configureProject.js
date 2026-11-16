import { svgs } from '../../assets/icons/svg/svg.js';
import { createCustomSelect } from './uiComponents.js';
import plugin from '../../../plugin.json';
import { generateProject } from './projectGenerator.js'; 
import { assets } from '../../assets/assets.js'; 

export function renderConfigureScreen($container, template, onPrevious, onCancel) {
  const fileBrowser = acode.require('fileBrowser');
  
  // Default save base: last browsed folder only.
  // Do NOT use alpine/home — that path is gone after native/no-proot setup
  // and caused FileError "Path not found" on project create.
  // Prefer SAF content:// from fileBrowser, or a public file:// path the user picks.
  let storedBase = localStorage.getItem('android_builder_last_path') || '';
  // Drop stale alpine/proot paths that no longer exist
  if (storedBase.includes('/alpine/') || storedBase.includes('alpine/home')) {
    localStorage.removeItem('android_builder_last_path');
    storedBase = '';
  }
  let baseDir = storedBase;
  
  const isFlutter = template.id === 'flutter_app' || template.kind === 'flutter';
  const defaultAppName = isFlutter ? 'My Flutter App' : 'My Application';
  const defaultFolderName = defaultAppName.replace(/\s+/g, ''); 
  const defaultPkg = isFlutter ? 'com.example.my_flutter_app' : 'com.example.myapplication';

  $container.innerHTML = `
    <div class="andro-config-page">
      <div class="andro-config-header" style="margin-bottom: 25px;">
        <h2 class="andro-heading" style="text-align: left; margin-bottom: 5px;">New Project</h2>
        <p style="opacity: 0.8; font-size: 0.9rem;">
          Template: <strong>${template.name}</strong>
          ${isFlutter ? ' <span style="opacity:0.7;">(Dart · create only)</span>' : ''}
        </p>
      </div>

      <div class="andro-form-group">
        <label class="andro-label">Name</label>
        <input type="text" class="andro-input" id="appName" value="${defaultAppName}">
      </div>

      <div class="andro-form-group">
        <label class="andro-label">${isFlutter ? 'Package name (Android applicationId)' : 'Package name'}</label>
        <input type="text" class="andro-input" id="pkgName" value="${defaultPkg}">
      </div>

      <div class="andro-form-group">
        <label class="andro-label">Save location</label>
        <div class="andro-input-row">
          <input type="text" class="andro-input" id="saveLocation" value="${baseDir ? baseDir + '/' + defaultFolderName : ''}" placeholder="Tap folder icon to choose location">
          <button class="andro-icon-btn" id="btnBrowse" title="Browse">
             ${svgs.folder}
          </button>
        </div>
        <p style="opacity:0.65;font-size:0.8rem;margin-top:6px;">
          Choose an folder from Acode Terminal eg : file:///data/user/0/com.foxdebug.acodefree/files/public/Android_project.
        </p>
      </div>

      <div class="andro-form-group" id="langGroup">
        <label class="andro-label">Language</label>
      </div>

      <div class="andro-form-group" id="sdkGroup">
        <label class="andro-label">${isFlutter ? 'Minimum SDK (Android)' : 'Minimum SDK'}</label>
      </div>

      ${isFlutter ? `
      <p style="opacity:0.7;font-size:0.85rem;margin:-8px 0 16px;">
        Creates full Flutter skeleton (lib, pubspec, android). Flutter run will come in a later update.
      </p>` : ''}

      <div class="andro-action-bar">
        <button class="andro-btn andro-btn-secondary" id="btnCancel">Cancel</button>
        <button class="andro-btn andro-btn-secondary" id="btnPrev">Previous</button>
        <button class="andro-btn" id="btnFinish">Finish</button>
      </div>
    </div>
  `;

  // --- inject custom dropdowns ---
  const langSelect = createCustomSelect(
    isFlutter
      ? [{ value: 'Dart', label: 'Dart' }]
      : [
          { value: 'Java', label: 'Java' },
          { value: 'Kotlin', label: 'Kotlin' }
        ],
    isFlutter ? 'Dart' : 'Java'
  );
  $container.querySelector('#langGroup').appendChild(langSelect);

  const sdkSelect = createCustomSelect([
    { value: '21', label: 'API 21: Android 5.0 (Lollipop)' },
    { value: '24', label: 'API 24: Android 7.0 (Nougat)' },
    { value: '26', label: 'API 26: Android 8.0 (Oreo)' },
    { value: '29', label: 'API 29: Android 10' },
    { value: '31', label: 'API 31: Android 12' },
    { value: '33', label: 'API 33: Android 13' },
    { value: '34', label: 'API 34: Android 14' },
    { value: '35', label: 'API 35: Android 15', badge: 'GitHub build' },
    { value: '36', label: 'API 36: Android 16', badge: 'GitHub build' },
  ], '24');
  $container.querySelector('#sdkGroup').appendChild(sdkSelect);

  // --- Logic Implementations ---

  const $name = $container.querySelector('#appName');
  const $pkg = $container.querySelector('#pkgName');
  const $location = $container.querySelector('#saveLocation');

  // Helper: only update location when a base folder was chosen
  const updateLocation = (appName) => {
    if (!baseDir) {
      $location.value = '';
      return;
    }
    const folderName = (appName || 'MyApplication').replace(/\s+/g, '') || 'MyApplication';
    const sep = baseDir.endsWith('/') ? '' : '/';
    $location.value = `${baseDir}${sep}${folderName}`;
  };

  // name Input Change Logic
  $name.addEventListener('input', (e) => {
    const rawName = e.target.value;
    
    // Package Name Update
    const pkgPart = rawName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'app';
    $pkg.value = isFlutter
      ? `com.example.${pkgPart.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()}`
      : `com.example.${pkgPart}`;

    // Location Path Update
    updateLocation(rawName);
  });

  //  Browse Button Logic (With Save Feature)
  $container.querySelector('#btnBrowse').onclick = async () => {
    try {
      const result = await fileBrowser('folder', 'Select Project Location');
      if (result && result.url) {
        // new base directory set 
        baseDir = result.url;
        
        // save to local storage
        localStorage.setItem('android_builder_last_path', baseDir);
        
        updateLocation($name.value);
      }
    } catch (e) {
      // cancelled
    }
  };
  
  
  const renderResultScreen = (isSuccess, config, errorMessage = "") => {
    $container.innerHTML = `
      <div class="andro-result-page">
        
        <img src="${assets.head}" class="andro-logo" style="width: 80px; height: 80px; margin-bottom: 10px;">
        
        <h2 class="andro-heading" style="margin-bottom: 10px;">
          ${isSuccess ? 'Project Created!' : 'Build Failed'}
        </h2>

        <div class="andro-build-info">
          <div class="andro-info-row">
            <span class="andro-info-label">Name:</span>
            <span class="andro-info-val">${config.appName}</span>
          </div>
          <div class="andro-info-row">
            <span class="andro-info-label">Package:</span>
            <span class="andro-info-val">${config.packageName}</span>
          </div>
          <div class="andro-info-row">
            <span class="andro-info-label">Template:</span>
            <span class="andro-info-val">${template.name}</span>
          </div>
           ${!isSuccess ? `<div style="color: #F44336; margin-top:10px; white-space:pre-wrap;">Error: ${errorMessage}</div>` : ''}
        </div>

        <div class="andro-result-icon">
          ${isSuccess ? svgs.success : svgs.error}
        </div>

        <div class="andro-result-msg">
          ${isSuccess 
            ? (isFlutter
                ? 'Flutter project created — check Acode sidebar. Run/build coming later.'
                : 'Your android project is finished check acode sidebar')
            : 'Something went wrong during project creation.'}
        </div>

        <p class="andro-close-msg">Please close the current page</p>
      </div>
    `;
  };

  // Buttons Logic
  $container.querySelector('#btnCancel').onclick = onCancel;
  $container.querySelector('#btnPrev').onclick = onPrevious;

  // Finish Button Logic
  $container.querySelector('#btnFinish').onclick = async () => {
    const btn = $container.querySelector('#btnFinish');

    // Must have a browsed parent (content:// or valid file://)
    if (!baseDir || !$location.value.trim()) {
      window.toast('Choose a save location first (folder icon)', 3000);
      try {
        const result = await fileBrowser('folder', 'Select Project Location');
        if (result && result.url) {
          baseDir = result.url;
          localStorage.setItem('android_builder_last_path', baseDir);
          updateLocation($name.value);
        } else {
          return;
        }
      } catch (e) {
        return;
      }
    }

    btn.textContent = "Creating...";
    btn.disabled = true;

    const config = {
      templateId: template.id,
      appName: $name.value,
      packageName: $pkg.value,
      path: $location.value.trim(),
      language: langSelect.getValue(),
      minSdk: sdkSelect.getValue()
    };

    try {
      const success = await generateProject(config);
      renderResultScreen(
        success,
        config,
        success ? '' : 'Generation failed — check console (Path not found / FS)'
      );
    } catch (error) {
      renderResultScreen(false, config, error.message || String(error));
    } finally {
      btn.textContent = "Finish";
      btn.disabled = false;
    }
  };
}
