import { generateAndroidWorkflowYml } from '../bundle/AndroidGithubBuild.js';
import { ensureProjectGithubConfig, makeProjectId } from '../bundle/projectGithubConfig.js';
import { createFolder, createFile, replaceProjectFolder } from '../../operations/fileOperations.js';
import { commonFiles } from '../../templates/commonFiles.js';
import { emptyActivityFiles } from '../../templates/empty_activity/files.js';
import { basicActivityFiles } from '../../templates/basic_activity/files.js';
import { bottomNavFiles } from '../../templates/bottom_nav/files.js';
import { navDrawerFiles } from '../../templates/navigation_drawer/files.js';
import { tabbedActivityFiles } from '../../templates/tabbed_activity/files.js';
import { composeEmptyFiles } from '../../templates/compose_empty/files.js';
import { nativeCppFiles } from '../../templates/native_cpp/files.js';
import { mapActivityFiles } from '../../templates/map_activity/files.js';
import { settingsViewsFiles } from '../../templates/settings_views_activity/files.js';
import { loginViewsFiles } from '../../templates/login_views_activity/files.js';
import { scrollActivityFiles } from '../../templates/scroll_activity/files.js';
import { fullscreenViewsFiles } from '../../templates/fullscreen_views_activity/files.js';
import { flutterFiles, toFlutterProjectName } from '../../templates/flutter_app/files.js';
import { getAapt2GradlePropertyLine } from '../../services/pathManager.js';

/**
 * Ensure a directory URL exists, creating missing parents when possible.
 * Acode fs.exists() returns boolean — it does NOT throw on missing paths.
 * (Old code assumed throw → parents were never created → "Path not found")
 */
async function ensurePathExists(fs, targetUrl) {
    if (!targetUrl) return false;

    try {
        const exists = await fs(targetUrl).exists();
        if (exists) return true;
    } catch (e) {
        // exists() itself failed (invalid URL) — still try create chain below
    }

    // content:// tree roots often cannot be "created"; only children under a
    // granted tree can. Stop recursion at scheme root / empty segment.
    const cleanUrl = targetUrl.endsWith('/') ? targetUrl.slice(0, -1) : targetUrl;
    const lastSlash = cleanUrl.lastIndexOf('/');
    if (lastSlash <= 0) return false;

    const parentUrl = cleanUrl.substring(0, lastSlash);
    const folderName = cleanUrl.substring(lastSlash + 1);
    if (!folderName || folderName.includes('://')) return false;

    const parentOk = await ensurePathExists(fs, parentUrl);
    if (!parentOk) return false;

    try {
        await fs(parentUrl).createDirectory(folderName);
        return true;
    } catch (createErr) {
        // Race: another call may have created it
        try {
            return !!(await fs(targetUrl).exists());
        } catch (_) {
            console.error('ensurePathExists create failed:', targetUrl, createErr);
            return false;
        }
    }
}

/** Split full project path into { parentPath, projectFolderName } */
function splitProjectPath(path) {
    const cleanPath = path.endsWith('/') ? path.slice(0, -1) : path;
    const lastSlashIndex = cleanPath.lastIndexOf('/');
    if (lastSlashIndex < 0) {
        return { parentPath: '', projectFolderName: cleanPath };
    }
    return {
        parentPath: cleanPath.substring(0, lastSlashIndex),
        projectFolderName: cleanPath.substring(lastSlashIndex + 1)
    };
}

/**
 * Create a full Flutter app skeleton (lib, pubspec, android embedding, test).
 * Flutter run / build is not wired yet — create only.
 */
async function generateFlutterProject(config, parentPath, projectFolderName) {
  const { appName, packageName, minSdk } = config;
  const projectName = toFlutterProjectName(appName);
  // Prefer folder name already chosen by user; still normalize for pubspec name
  const pkgName = (packageName || 'com.example.' + projectName)
    .replace(/[^a-zA-Z0-9._]/g, '')
    .toLowerCase();

  const projectDir = await createFolder(parentPath, projectFolderName);
  if (!projectDir.success) {
    throw new Error(
      (projectDir.message || 'Path not found') +
      '\nParent: ' + parentPath +
      '\nFolder: ' + projectFolderName
    );
  }
  const rootUrl = projectDir.url;

  // --- Root ---
  await createFile(rootUrl, '.gitignore', flutterFiles.gitignore);
  await createFile(rootUrl, '.metadata', flutterFiles.metadata(projectName));
  await createFile(rootUrl, 'analysis_options.yaml', flutterFiles.analysisOptions);
  await createFile(rootUrl, 'pubspec.yaml', flutterFiles.pubspec(projectName, appName));
  await createFile(rootUrl, 'README.md', flutterFiles.readme(appName, projectName));

  // --- lib/ ---
  const libDir = await createFolder(rootUrl, 'lib');
  await createFile(libDir.url, 'main.dart', flutterFiles.mainDart(appName));

  // --- test/ ---
  const testDir = await createFolder(rootUrl, 'test');
  await createFile(testDir.url, 'widget_test.dart', flutterFiles.widgetTest(projectName));

  // --- android/ ---
  const androidDir = await createFolder(rootUrl, 'android');
  await createFile(androidDir.url, '.gitignore', flutterFiles.androidGitignore);
  await createFile(androidDir.url, 'build.gradle', flutterFiles.androidBuildGradle);
  await createFile(androidDir.url, 'settings.gradle', flutterFiles.androidSettingsGradle);
  await createFile(androidDir.url, 'gradle.properties', flutterFiles.androidGradleProperties);
  await createFile(androidDir.url, 'local.properties', flutterFiles.localPropertiesTemplate);

  // android/app
  const appDir = await createFolder(androidDir.url, 'app');
  await createFile(appDir.url, 'build.gradle', flutterFiles.appBuildGradle(pkgName, minSdk || '21'));

  const srcDir = await createFolder(appDir.url, 'src');
  const mainDir = await createFolder(srcDir.url, 'main');
  await createFile(mainDir.url, 'AndroidManifest.xml', flutterFiles.androidManifest(appName));

  // Kotlin MainActivity under package path
  const kotlinDir = await createFolder(mainDir.url, 'kotlin');
  const parts = pkgName.split('.');
  let currentUrl = kotlinDir.url;
  for (const part of parts) {
    const folder = await createFolder(currentUrl, part);
    currentUrl = folder.url;
  }
  await createFile(currentUrl, 'MainActivity.kt', flutterFiles.mainActivityKt(pkgName));

  // res
  const resDir = await createFolder(mainDir.url, 'res');
  const drawableDir = await createFolder(resDir.url, 'drawable');
  await createFile(drawableDir.url, 'launch_background.xml', flutterFiles.launchBackground);
  await createFile(drawableDir.url, 'ic_launcher_background.xml', flutterFiles.icLauncherBackground);
  await createFile(drawableDir.url, 'ic_launcher_foreground.xml', flutterFiles.icLauncherForeground);
  try {
    const layer = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@drawable/ic_launcher_background" />
    <item android:drawable="@drawable/ic_launcher_foreground" />
</layer-list>`;
    await createFile(drawableDir.url, 'ic_launcher.xml', layer);
    await createFile(drawableDir.url, 'ic_launcher_round.xml', layer);
  } catch (_) {}

  const drawableV21 = await createFolder(resDir.url, 'drawable-v21');
  await createFile(drawableV21.url, 'launch_background.xml', flutterFiles.launchBackground);

  const drawableNight = await createFolder(resDir.url, 'drawable-night');
  await createFile(drawableNight.url, 'launch_background.xml', flutterFiles.launchBackgroundNight);

  const valuesDir = await createFolder(resDir.url, 'values');
  await createFile(valuesDir.url, 'styles.xml', flutterFiles.stylesXml);

  const valuesNight = await createFolder(resDir.url, 'values-night');
  await createFile(valuesNight.url, 'styles.xml', flutterFiles.stylesNightXml);

  const mipmapDir = await createFolder(resDir.url, 'mipmap-anydpi-v26');
  await createFile(mipmapDir.url, 'ic_launcher.xml', flutterFiles.icLauncherXml);

  const openResult = await replaceProjectFolder(rootUrl, { name: appName });
  if (openResult.success) {
    window.toast(`Flutter project '${appName}' created!`, 3000);
    return true;
  }
  window.toast('Created but failed to open.', 3000);
  return false;
}

export async function generateProject(config) {
  const { appName, packageName, path, language, minSdk, templateId } = config;
  const fs = acode.require('fs'); 
  
  try {
    if (!path || typeof path !== 'string' || !path.trim()) {
      throw new Error('Save location is empty. Tap the folder icon and choose a directory.');
    }

    const { parentPath, projectFolderName } = splitProjectPath(path.trim());

    if (!parentPath || !projectFolderName) {
      throw new Error('Invalid save location. Choose a parent folder, then set the project name.');
    }

    // Parent must exist (or be creatable) before createFolder
    const parentReady = await ensurePathExists(fs, parentPath);
    if (!parentReady) {
      // One more direct check for clearer diagnostics
      let parentExists = false;
      try { parentExists = await fs(parentPath).exists(); } catch (_) {}
      if (!parentExists) {
        throw new Error(
          'Parent folder not found:\n' + parentPath +
          '\n\nTap the folder icon and pick an existing location ' +
          '(e.g. Internal storage → Download or Documents). ' +
          'Alpine/proot paths are no longer used by default.'
        );
      }
    }

    // Flutter project (create only — no run/build yet)
    if (templateId === 'flutter_app') {
      return await generateFlutterProject(config, parentPath, projectFolderName);
    }

    const projectDir = await createFolder(parentPath, projectFolderName);
    if (!projectDir.success) {
      throw new Error(
        (projectDir.message || 'Path not found') +
        '\nParent: ' + parentPath +
        '\nFolder: ' + projectFolderName
      );
    }
    const rootUrl = projectDir.url;
    // Root files
    await createFile(rootUrl, '.gitignore', commonFiles.gitignore);
    await createFile(rootUrl, 'build.gradle', commonFiles.rootBuildGradle);
    await createFile(rootUrl, 'settings.gradle', commonFiles.settingsGradle(appName));
    try {
      const gradleDir = await createFolder(rootUrl, 'gradle');
      const wrapperDir = await createFolder(gradleDir.url, 'wrapper');
      await createFile(
        wrapperDir.url,
        'gradle-wrapper.properties',
        `# Generated for GitHub CI (Gradle 8.7 + AGP 8.5)
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\://services.gradle.org/distributions/gradle-8.7-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`
      );
    } catch (e) {
      console.warn('wrapper props', e);
    }

    // Gradle does not expand $HOME — use absolute Alpine path (/public/...) so aapt2 works on first build
    const gradlePropsWithAapt2 =
      commonFiles.gradleProperties.trimEnd() +
      '\n\n# AAPT2 (absolute path — do not use $HOME)\n' +
      getAapt2GradlePropertyLine() +
      '\n';
    await createFile(rootUrl, 'gradle.properties', gradlePropsWithAapt2);
    // App directory
    const appDir = await createFolder(rootUrl, 'app');
    
    // Use template-specific build.gradle
    if (templateId === 'compose_empty') {
        await createFile(appDir.url, 'build.gradle', composeEmptyFiles.appBuildGradle(packageName, minSdk || '21'));
    } else if (templateId === 'native_cpp') {
        await createFile(appDir.url, 'build.gradle', nativeCppFiles.appBuildGradle(packageName, minSdk || '21'));
    } else if (templateId === 'map_activity') {
        await createFile(appDir.url, 'build.gradle', mapActivityFiles.appBuildGradle(packageName, minSdk || '21'));
    } else if (templateId === 'settings_views_activity') {
        await createFile(appDir.url, 'build.gradle', settingsViewsFiles.appBuildGradle(packageName, minSdk || '21'));
    } else {
        await createFile(appDir.url, 'build.gradle', commonFiles.appBuildGradle(packageName, minSdk || '21'));
    }
    
    
    // GitHub Actions workflow so templates build on CI without manual rewrite
    try {
      const min = parseInt(minSdk, 10) || 21;
      const compile = Math.max(min, 34);
      const yml = generateAndroidWorkflowYml({
        compileSdk: String(compile),
        minSdk: String(min),
        targetSdk: String(compile),
        javaVersion: '17',
      });
      const ghDir = await createFolder(rootUrl, '.github');
      const wfDir = await createFolder(ghDir.url, 'workflows');
      await createFile(wfDir.url, 'xhlp-android-build.yml', yml);
      await ensureProjectGithubConfig(rootUrl, { repo: '', projectId: makeProjectId() });

    } catch (wfErr) {
      console.warn('[generateProject] workflow write', wfErr);
    }

    await createFile(appDir.url, 'proguard-rules.pro', '# Proguard rules\n');

    // Source directory structure
    const srcDir = await createFolder(appDir.url, 'src');
    const mainDir = await createFolder(srcDir.url, 'main');

    // Manifest Logic
    if (templateId === 'no_activity') {
        await createFile(mainDir.url, 'AndroidManifest.xml', commonFiles.androidManifestNoActivity(packageName));
    } else if (templateId === 'map_activity') {
        await createFile(mainDir.url, 'AndroidManifest.xml', mapActivityFiles.androidManifest(packageName));
    } else if (templateId === 'login_views_activity') {
        await createFile(mainDir.url, 'AndroidManifest.xml', loginViewsFiles.androidManifest(packageName));
    } else if (templateId === 'fullscreen_views_activity') {
        await createFile(mainDir.url, 'AndroidManifest.xml', fullscreenViewsFiles.androidManifest(packageName));
    } else {
        await createFile(mainDir.url, 'AndroidManifest.xml', commonFiles.androidManifest(packageName));
    }

    // Package structure
    const javaDir = await createFolder(mainDir.url, 'java');
    const parts = packageName.split('.');
    let currentUrl = javaDir.url;
    for (const part of parts) {
        const folder = await createFolder(currentUrl, part);
        currentUrl = folder.url;
    }
    const packageUrl = currentUrl;
    // Resources
    const resDir = await createFolder(mainDir.url, 'res');
    
    // Drawable
    const drawableDir = await createFolder(resDir.url, 'drawable');
    await createFile(drawableDir.url, 'ic_launcher_background.xml', commonFiles.icLauncherBackground);
    await createFile(drawableDir.url, 'ic_launcher_foreground.xml', commonFiles.icLauncherForeground);
    await createFile(drawableDir.url, 'ic_launcher.xml', commonFiles.icLauncherDrawable || commonFiles.icLauncherXml);
    await createFile(drawableDir.url, 'ic_launcher_round.xml', commonFiles.icLauncherDrawable || commonFiles.icLauncherXml);
    // Layout (skip for Compose - it doesn't use XML layouts)
    let layoutDir;
    if (templateId !== 'compose_empty') {
        layoutDir = await createFolder(resDir.url, 'layout');
    }
    
    // Mipmap
    const mipmapDir = await createFolder(resDir.url, 'mipmap-anydpi-v26');
    await createFile(mipmapDir.url, 'ic_launcher.xml', commonFiles.icLauncherXml);
    await createFile(mipmapDir.url, 'ic_launcher_round.xml', commonFiles.icLauncherXml);
    
    // Values
    const valuesDir = await createFolder(resDir.url, 'values');
    await createFile(valuesDir.url, 'strings.xml', commonFiles.stringsXml(appName));
    await createFile(valuesDir.url, 'colors.xml', commonFiles.colorsXml);
    
    // Use Compose-specific themes for Compose template
    if (templateId === 'compose_empty') {
        await createFile(valuesDir.url, 'themes.xml', composeEmptyFiles.themesXml);
    } else {
        await createFile(valuesDir.url, 'themes.xml', commonFiles.themesXml);
    }

    // XML
    const xmlDir = await createFolder(resDir.url, 'xml');
    await createFile(xmlDir.url, 'data_extraction_rules.xml', commonFiles.dataExtractionRules);
    await createFile(xmlDir.url, 'backup_rules.xml', commonFiles.backupRules);

    // TEMPLATE SPECIFIC LOGIC
    // 1. EMPTY ACTIVITY
    if (templateId === 'empty_activity') {
      console.log("Creating Empty Activity...");
      await createFile(layoutDir.url, 'activity_main.xml', emptyActivityFiles.layoutXml);
      
      if (language === 'Kotlin') {
        const result = await createFile(packageUrl, 'MainActivity.kt', emptyActivityFiles.mainActivityKt(packageName));
      } else {
        const result = await createFile(packageUrl, 'MainActivity.java', emptyActivityFiles.mainActivityJava(packageName));
      }
    }
    
    // 2. BASIC ACTIVITY
    else if (templateId === 'basic_activity') {
      await createFile(layoutDir.url, 'activity_main.xml', basicActivityFiles.layoutXml);
      await createFile(layoutDir.url, 'content_main.xml', basicActivityFiles.contentXml);
      
      if (language === 'Kotlin') {
        const result = await createFile(packageUrl, 'MainActivity.kt', basicActivityFiles.mainActivityKt(packageName));
      } else {
        const result = await createFile(packageUrl, 'MainActivity.java', basicActivityFiles.mainActivityJava(packageName));
      }
    }

    // 3. BOTTOM NAV
    else if (templateId === 'bottom_nav') {
      const menuDir = await createFolder(resDir.url, 'menu');
      await createFile(menuDir.url, 'bottom_nav_menu.xml', bottomNavFiles.menuXml);
      await createFile(drawableDir.url, 'ic_home.xml', bottomNavFiles.icHome);
      await createFile(drawableDir.url, 'ic_dashboard.xml', bottomNavFiles.icDashboard);
      await createFile(drawableDir.url, 'ic_notifications.xml', bottomNavFiles.icNotifications);
      await createFile(layoutDir.url, 'activity_main.xml', bottomNavFiles.layoutXml);
      
      if (language === 'Kotlin') {
        const result = await createFile(packageUrl, 'MainActivity.kt', bottomNavFiles.mainActivityKt(packageName));
      } else {
        const result = await createFile(packageUrl, 'MainActivity.java', bottomNavFiles.mainActivityJava(packageName));
      }
    }

    // 4. NAVIGATION DRAWER - SUPPORTS BOTH 'navigation_drawer' AND 'nav_drawer'
    else if (templateId === 'navigation_drawer' || templateId === 'nav_drawer') {
        
        // Menu directory and file
        const menuDir = await createFolder(resDir.url, 'menu');
        
        const drawerMenuResult = await createFile(menuDir.url, 'activity_main_drawer.xml', navDrawerFiles.drawerMenu);
        
        // Icons
        await createFile(drawableDir.url, 'ic_menu_camera.xml', navDrawerFiles.icMenuCamera);
        await createFile(drawableDir.url, 'ic_menu_gallery.xml', navDrawerFiles.icMenuGallery);
        await createFile(drawableDir.url, 'ic_menu_slideshow.xml', navDrawerFiles.icMenuSlideshow);

        // Layouts (4 files!)
        
        const activityMainResult = await createFile(layoutDir.url, 'activity_main.xml', navDrawerFiles.activityMain);
        
        const appBarResult = await createFile(layoutDir.url, 'app_bar_main.xml', navDrawerFiles.appBarMain);
        
        const contentResult = await createFile(layoutDir.url, 'content_main.xml', navDrawerFiles.contentMain);
        
        const navHeaderResult = await createFile(layoutDir.url, 'nav_header_main.xml', navDrawerFiles.navHeaderMain);

        if (language === 'Kotlin') {
            const result = await createFile(packageUrl, 'MainActivity.kt', navDrawerFiles.mainActivityKt(packageName));
            
            if (!result.success) {
                console.error("❌ Failed to create MainActivity.kt:", result.message);
            }
        } else {
            const result = await createFile(packageUrl, 'MainActivity.java', navDrawerFiles.mainActivityJava(packageName));
            
            if (!result.success) {
                console.error("❌ Failed to create MainActivity.java:", result.message);
            }
        }
    }

    // 5. TABBED ACTIVITY
    else if (templateId === 'tabbed_activity') {
        
        // Fragment Layouts
        await createFile(layoutDir.url, 'fragment_tab1.xml', tabbedActivityFiles.fragmentTab1);
        await createFile(layoutDir.url, 'fragment_tab2.xml', tabbedActivityFiles.fragmentTab2);
        await createFile(layoutDir.url, 'fragment_tab3.xml', tabbedActivityFiles.fragmentTab3);
        
        // Main Activity Layout
        await createFile(layoutDir.url, 'activity_main.xml', tabbedActivityFiles.activityMain);
        
        // Fragments and Adapter
        if (language === 'Kotlin') {
            // Fragment classes
            await createFile(packageUrl, 'Tab1Fragment.kt', tabbedActivityFiles.tab1FragmentKt(packageName));
            await createFile(packageUrl, 'Tab2Fragment.kt', tabbedActivityFiles.tab2FragmentKt(packageName));
            await createFile(packageUrl, 'Tab3Fragment.kt', tabbedActivityFiles.tab3FragmentKt(packageName));
            // ViewPager Adapter
            await createFile(packageUrl, 'ViewPagerAdapter.kt', tabbedActivityFiles.viewPagerAdapterKt(packageName));
            // MainActivity
            const result = await createFile(packageUrl, 'MainActivity.kt', tabbedActivityFiles.mainActivityKt(packageName));
        } else {
            // Fragment classes
            await createFile(packageUrl, 'Tab1Fragment.java', tabbedActivityFiles.tab1FragmentJava(packageName));
            await createFile(packageUrl, 'Tab2Fragment.java', tabbedActivityFiles.tab2FragmentJava(packageName));
            await createFile(packageUrl, 'Tab3Fragment.java', tabbedActivityFiles.tab3FragmentJava(packageName));
            // ViewPager Adapter
            await createFile(packageUrl, 'ViewPagerAdapter.java', tabbedActivityFiles.viewPagerAdapterJava(packageName));
            // MainActivity
            const result = await createFile(packageUrl, 'MainActivity.java', tabbedActivityFiles.mainActivityJava(packageName));
        }
  }

    // 6. COMPOSE EMPTY (Kotlin only)
    else if (templateId === 'compose_empty') {
        // Compose doesn't use XML layouts - everything is code
        // Create ui.theme package
        const uiDir = await createFolder(packageUrl, 'ui');
        const themeDir = await createFolder(uiDir.url, 'theme');
        // Theme files
        await createFile(themeDir.url, 'Color.kt', composeEmptyFiles.colorKt(packageName));
        await createFile(themeDir.url, 'Type.kt', composeEmptyFiles.typeKt(packageName));
        await createFile(themeDir.url, 'Theme.kt', composeEmptyFiles.themeKt(packageName));
        // MainActivity (Compose - Kotlin only)
        if (language === 'Java') {
            console.warn("⚠️ Compose requires Kotlin - creating Kotlin files");
        }
        
        const result = await createFile(packageUrl, 'MainActivity.kt', composeEmptyFiles.mainActivityKt(packageName));
        if (!result.success) {
            console.error("❌ Failed to create MainActivity.kt:", result.message);
        }
        
    }
    
    // 7. GOOGLE MAPS ACTIVITY
    else if (templateId === 'map_activity') {
        // Create values folder for API key if not exists (already created above)
        // Create google_maps_api.xml with API key placeholder
        await createFile(valuesDir.url, 'google_maps_api.xml', mapActivityFiles.googleMapsApiXml);
        
        // Layout with MapFragment
        await createFile(layoutDir.url, 'activity_main.xml', mapActivityFiles.layoutXml);
        
        // MainActivity with GoogleMap implementation
        if (language === 'Kotlin') {
            await createFile(packageUrl, 'MainActivity.kt', mapActivityFiles.mainActivityKt(packageName));
        } else {
            await createFile(packageUrl, 'MainActivity.java', mapActivityFiles.mainActivityJava(packageName));
        }
    }
    
    // 8. ✅ NATIVE C++ TEMPLATE
    else if (templateId === 'native_cpp') {
        // Create CPP directory
        const cppDir = await createFolder(mainDir.url, 'cpp');
        
        // Write CMakeLists.txt
        await createFile(cppDir.url, 'CMakeLists.txt', nativeCppFiles.cmakeLists);
        
        // Write native-lib.cpp (passing package name for JNI function name)
        await createFile(cppDir.url, 'native-lib.cpp', nativeCppFiles.nativeLibCpp(packageName));
        
        // Layout file with TextView
        await createFile(layoutDir.url, 'activity_main.xml', nativeCppFiles.layoutXml);
        
        // MainActivity (Loads library)
        if (language === 'Kotlin') {
            await createFile(packageUrl, 'MainActivity.kt', nativeCppFiles.mainActivityKt(packageName));
        } else {
            await createFile(packageUrl, 'MainActivity.java', nativeCppFiles.mainActivityJava(packageName));
        }
    }
    
    // 9. SETTINGS VIEWS ACTIVITY
    else if (templateId === 'settings_views_activity') {
        await createFile(xmlDir.url, 'root_preferences.xml', settingsViewsFiles.rootPreferences);
        
        // Create arrays.xml for ListPreference
        await createFile(valuesDir.url, 'arrays.xml', settingsViewsFiles.arraysXml);
        
        // Main layout
        await createFile(layoutDir.url, 'activity_main.xml', settingsViewsFiles.activityMain);
        
        // MainActivity and SettingsFragment
        if (language === 'Kotlin') {
            await createFile(packageUrl, 'MainActivity.kt', settingsViewsFiles.mainActivityKt(packageName));
            await createFile(packageUrl, 'SettingsFragment.kt', settingsViewsFiles.settingsFragmentKt(packageName));
        } else {
            await createFile(packageUrl, 'MainActivity.java', settingsViewsFiles.mainActivityJava(packageName));
            await createFile(packageUrl, 'SettingsFragment.java', settingsViewsFiles.settingsFragmentJava(packageName));
        }
    }
    
    // 10. LOGIN VIEWS ACTIVITY
    else if (templateId === 'login_views_activity') {
        // Login layout
        await createFile(layoutDir.url, 'activity_login.xml', loginViewsFiles.activityLogin);
        
        // Main (Home) layout
        await createFile(layoutDir.url, 'activity_main.xml', loginViewsFiles.activityMain);
        
        // Activities
        if (language === 'Kotlin') {
            await createFile(packageUrl, 'LoginActivity.kt', loginViewsFiles.loginActivityKt(packageName));
            await createFile(packageUrl, 'MainActivity.kt', loginViewsFiles.mainActivityKt(packageName));
        } else {
            await createFile(packageUrl, 'LoginActivity.java', loginViewsFiles.loginActivityJava(packageName));
            await createFile(packageUrl, 'MainActivity.java', loginViewsFiles.mainActivityJava(packageName));
        }
    }
    
    // 11. SCROLL ACTIVITY
    else if (templateId === 'scroll_activity') {
        // Header image drawable
        await createFile(drawableDir.url, 'header_image.xml', scrollActivityFiles.headerImageXml);
        
        // Main layout with CollapsingToolbarLayout
        await createFile(layoutDir.url, 'activity_main.xml', scrollActivityFiles.activityMain);
        
        // MainActivity
        if (language === 'Kotlin') {
            await createFile(packageUrl, 'MainActivity.kt', scrollActivityFiles.mainActivityKt(packageName));
        } else {
            await createFile(packageUrl, 'MainActivity.java', scrollActivityFiles.mainActivityJava(packageName));
        }
    }
    
    // 12. FULLSCREEN VIEWS ACTIVITY
    else if (templateId === 'fullscreen_views_activity') {
        // Controls background drawable
        await createFile(drawableDir.url, 'fullscreen_controls_bg.xml', fullscreenViewsFiles.fullscreenControlsBg);
        
        await createFile(valuesDir.url, 'themes_fullscreen.xml', fullscreenViewsFiles.fullscreenTheme);
        
        // Fullscreen layout
        await createFile(layoutDir.url, 'activity_fullscreen.xml', fullscreenViewsFiles.activityFullscreen);
        
        // FullscreenActivity
        if (language === 'Kotlin') {
            await createFile(packageUrl, 'FullscreenActivity.kt', fullscreenViewsFiles.fullscreenActivityKt(packageName));
        } else {
            await createFile(packageUrl, 'FullscreenActivity.java', fullscreenViewsFiles.fullscreenActivityJava(packageName));
        }
    }

    const openResult = await replaceProjectFolder(rootUrl, { name: appName });
    
    if (openResult.success) {
      window.toast(`Project '${appName}' created!`, 3000);
      return true;
    } else {
      window.toast("Created but failed to open.", 3000);
      return false;
    }

  } catch (err) {
    console.error("❌ Generation Failed:", err);
    console.error("   Error name:", err.name);
    console.error("   Error message:", err.message);
    console.error("   Error stack:", err.stack);
    
    const msg = err.message || err.toString();
    window.toast("Gen Failed: " + msg, 4000);
    return false;
  }
}