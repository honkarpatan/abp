
## v1.1.6 

- New : SVG Studio , Edit svg from svg store OR select svg from local and Use in Your Android Project App
  
  ![svg_studio](https://i.postimg.cc/7HMJfhk2/Android-builder-pro-SVG-Studio.jpg)

- Fixed : Git Build Error after using custom icon
- Fixed : Other minor bugs
- Enhanched Ui (minor)

## v1.1.5

### Icon Studio (Upgrade)

- Live preview: square / round / home mock, scale, padding, shape, bg, offset
- Icon Store
- fix : Mipmap icon not using on git build

  ![Image_Icon_Add](https://i.postimg.cc/cL37p23c/Screenshot-2026-10-31-11-44-53-53-e3c1f266f17b29c7b40472751f031275.jpg)

### Splash Studio (new)
- Light/Dark bg, gradient, logo, Android 12+ theme, duration, exit animation

  ![Splash_Studio](https://i.postimg.cc/zv32K7c6/Screenshot-2026-10-31-12-01-40-55-e3c1f266f17b29c7b40472751f031275.jpg)

### More 
- fix : GitHub / Build (earlier) - binary (PNG) push
- Preview Host Update
- Other Ui Update and Fixes 

## v1.1.4

### Build & GitHub Actions
- Full project sync to GitHub on every build (add / update / remove obsolete files)
- Cancel Stop calls GitHub Actions cancel API
- Real job/step status in build logs; Actions URL in build page
- Progress bar animation

![workflow_build](https://i.postimg.cc/ncDTRzJY/Screenshot-2026-10-29-21-08-22-06-e3c1f266f17b29c7b40472751f031275.jpg)

### Project templates & SDK
- Fixed missing launcher icons (`drawable/ic_launcher`) — AAPT `mipmap/ic_launcher` not found : Effect on new created Project
- Restored SDK/version save to `build.gradle` (Java 11/17/21, compileSdk, etc.)
- GitHub defaults: compileSdk 36, minSdk 26 (remember user overrides)

### Build Settings UI
- New **App & build features**: applicationId, namespace, viewBinding, dataBinding, multiDex, release minify
- Flutter settings: default build mode, ABI, tree-shake icons

![build_features_settings](https://i.postimg.cc/bwMtK09r/Screenshot-2026-10-29-21-52-53-46-40deb401b9ffe8e1df2f1cc5ba480b12.jpg)

### Artifacts
- Safer handling when artifact download/CORS fails


## v1.1.3

### Layout Preview Host (APK)

Install the companion app for **real on-device XML layout preview**:

**Download:** [Layout.Preview.Host.apk](https://github.com/Sou6900/XHLP_Engine/releases/download/v0.0.1/Layout.Preview.Host.apk)

  ![Xml layout preview](https://i.postimg.cc/yxS19ZJf/Screenshot-2026-09-23-18-27-56-66-99c04817c0de5652397fc8b56c3b3817.jpg)


Check description to `Layout Preview Host (APK)` for more details

### GitHub native Android build
* Build mode: **Terminal (offline)** or **GitHub Actions** (default preference can be set in settings)
* **Per-project repo** binding via `.xhlp-github.json` (new project starts blank; no stale global repo)
* **Auto-create private repo** + optional **Force create new repo** (random suffix)
* Auto **upload project sources** when the remote repo is empty
* **SDK / version card** on Build config: compileSdk, minSdk, targetSdk, versionCode, versionName, Java (CI)
* GitHub defaults: **compileSdk 36**, **minSdk 26** (user changes are remembered)
* Terminal: warning if compileSdk **> 34** (device SDK often limited)
* CI uses **Gradle 8.7**-compatible workflow; strips device-only `aapt2` paths
* Build progress page: **Build details** card (repo, SDK, project id…) + smoother progress while Actions runs
* **Real GitHub Actions logs** pulled into the build log panel
* Artifact download: extract **real `.apk`** (not a corrupt zip-as-apk)

### Project creation
* Min SDK list includes **API 35 / 36** with **GitHub build** badge
* Selecting API updates **minSdk / compileSdk / targetSdk** in generated `app/build.gradle`
* Auto-writes `.github/workflows/xhlp-android-build.yml` so templates can build on CI without hand-editing workflow

### Editor extras
* Kotlin / Java / Dart **auto-import** (setting)
* **Dart snippets**; Kotlin snippet fixes

## v1.1.2
 ### compressed file
## v1.1.1
 ### fix ⋮ pubspec.yaml not found
 ### fix ⋮ flutter apk download
## v1.1.0
 ### Changelog — Android Builder Pro

**Added**
- Flutter: home, preview, logs, GitHub APK build, build history, download
- Build options in settings (release / debug, ABI, tree-shake icons)
- XML live preview (XHLP) in the same plugin
- Customizable paths & tool settings (beyond original Android Builder)

**Improved**
- Java/Kotlin APK & AAB build + setup wizard
- Feature Store, project templates, app icon generator
- Snippets & formatting for Java / Kotlin / XML
- Build page opens ready — starts only when you tap **Start Build**

**Notes**
- Prefer **Terminal storage** for projects (builds & Flutter tools)
- Flutter: use **release + arm64** for smaller APKs
- One plugin replaces separate Android Builder + XML-only packages
## v1.0.13
 - Minor Bug Fixed
## v1.0.12
 - Add : 
   * Increased XML Snippets Suggestions
 - Fixed :
   * Some UI bugs Fixed
 - Release :
   * Next Update : Premium Release
## v1.0.11
 - Fixed :
   * Path issue
## v1.0.10
 - Some Bug Fixed
 - UI fixed
## v1.0.9
 - Add :
   * Added 40+ new Data
   * Some Bugs fixed
   * Ui fixed
   * Improve Stability
## v1.0.8
 - Add :
   * New : Snippets in Features Store (beta)

<img src="https://i.postimg.cc/VNCy214W/Screenshot-2026-01-23-15-53-44-15-a2cf8efcdd42a8e6f7906303f104fb67.jpg" alt="Android Builder Demo 3" style="width:180px;border-radius:5px;">
  


## v1.0.7
 - Fixed Multiple Marks issue
## v1.0.6
 - Add :
   * Features Store (beta)
 - Improve Stabilty
 - Other Bugs Fixed
## v1.0.5
 - Add : 
   * New Templates
   * More
 - Improved functionalities 
 - Some bug fixed
## v1.0.4
 - Add :
   * App icon generate and auto set in one click
   * New Template : Map
 - Fixed :
   * Ui
   * Some Bugs
## v1.0.3
 - Add : 
   * Build signed apk
 - Fix :
   * Ui
   * Some Unknown Bugs
## v1.0.2
 - Justified plugin size 
## v1.0.1
 - Add : 
   * Download/Logs bundle button
   * Snippets & Custom Snippets - XML , Java , Kotlin
   * Formatter
 - Fix :
   * Some Bugs
## v1.0.0
 - initial beta release