<div style="display:flex;align-items:center;background: linear-gradient(to right, #0d1b2a, #1b4332, #3d348b);padding:10px;height:40px;margin:0 ; font-size:10px;"><img src="https://i.postimg.cc/J7vwsh47/Android-icon.png" alt="Android Builder Pro" style="width:40px;margin-right:10px;"><h1><span style="background: linear-gradient(135deg, #c7f3ff, #a8e6cf);
    -webkit-background-clip: text;   -webkit-text-fill-color: transparent;font-weight: bold;">Android Builder Pro</span><sup style="font-size:0.55rem;font-weight:300;color:#B8B870;padding:0 0 0 5px;">XML · APK · AAB · Flutter · Sdk36</sup></h1><div style="margin-left:auto;display:flex;flex-direction:column;gap:5px;"><small style="font-size:0.6em;color:#00e676;">Pro</small><small style="font-size:0.6em;color:#fdd835;">Beta</small>  </div></div>

---

<p align="center">

  <img src="https://img.shields.io/badge/Platform-Acode-blue?style=for-the-badge">

  <img src="https://img.shields.io/badge/Android_XML_Preview-purple?style=for-the-badge">

  <img src="https://img.shields.io/badge/Version-1.1.3-black?style=for-the-badge">

  <img src="https://img.shields.io/badge/Java_Kotlin_flutter_APK-darkgreen?style=for-the-badge">

  <img src="https://img.shields.io/badge/Flutter_Preview_&_Build_sdk_36-02569B?style=for-the-badge">

  <img src="https://img.shields.io/badge/Feature_Store-orange?style=for-the-badge">

  <img src="https://img.shields.io/badge/Customizable_Settings-teal?style=for-the-badge">

</p>

---

## Overview

**Android Builder Pro** is an all-in-one plugin for **Acode Editor**. It turns your phone into a portable Android & Flutter studio — layout preview, Java/Kotlin APK build, Flutter run & GitHub APK build, feature store, icons, snippets, and fully customizable settings — in one place.

⚠️ **Beta note:** You may still hit small bugs while the engine improves. Feedback is welcome.

---

## What’s new (recent)

### Layout Preview Host (APK)

Install the companion app for **real on-device XML layout preview**:

**Download:** [Layout.Preview.Host.apk](https://github.com/Sou6900/XHLP_Engine/releases/download/v0.0.1/Layout.Preview.Host.apk)

Scroll Down to `Layout Preview Host (APK)` for more details

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

---

## New / updated settings (summary)

| Setting | Notes |
|--------|--------|
| **Android native build via** | `GitHub` (default) or `Terminal (offline)` |
| **GitHub token** | Local only; needs `repo` + `workflow` scopes |
| **GitHub repo** | Per project (`.xhlp-github.json`); blank = auto-create |
| **Auto-create private repo** | Create missing repo under your account |
| **Force create new repo** | One-shot; adds random suffix (starts unchecked) |
| **Use custom workflow** | Off = auto workflow from project SDK/deps |
| **SDK fields** | compileSdk / minSdk / targetSdk / version* / Java — saved to gradle + remembered |
| **Flutter run via** | Devices (fallback web) | Web (if present in your build) |

---

<div style="background: #1a2e1a; border-left: 4px solid #78afda; padding: 15px; border-radius: 4px; margin: 20px 0;">
  <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
    <svg xmlns="<http://www.w3.org/2000/svg>" viewBox="0 0 24 24" width="24" height="24" fill="#97e183">
      <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
    </svg>
    <h3 style="margin: 0; color: #97e183;">Must use Terminal storage for projects</h3>
  </div>
  
  <p style="margin: 5px 0;">
    For APK build, Flutter tools, and reliable file access, <b>create or keep projects inside Acode Terminal storage</b>
    (Alpine / app home path), not only on SD card or external shared folders.
  </p>

  <ul style="margin-top: 10px; line-height: 1.6;">
    <li>Open Acode Terminal and work under its home / public folder when possible.</li>
    <li>SD card / external paths can be slower and may fail for build servers and SDK tools.</li>
    <li>XML preview still works on normal project folders; heavy builds prefer terminal storage.</li>
  </ul>

  <ul>
    <li>
      <b>Download XML layout previewer.apk:</b> <a src="https://github.com/Sou6900/XHLP_Engine/releases/download/v0.0.1/Layout.Preview.Host.apk"> Layout.Preview.Host.apk</a>
      <br><br>
      <b>Or copy this and paste into browser</b>
      <code style="word-wrap: break-word;">https://github.com/Sou6900/XHLP_Engine/releases/download/v0.0.1/Layout.Preview.Host.apk</code>    
    </>
  </ul>

</div>

---

## Key Features

### Android XML Live Preview

* Open any layout XML (for example `activity_main.xml`) and see a live visual preview on device.

* Works with common widgets, dimensions, colors, strings, and styles from your project resources.

* Switch between the XML file and the preview tab after the first open — no need to click the icon every time.

* Device-style frame for Mobile / Tablet style viewing.

 *Powered by the* *XHLP** preview engine (no separate heavy setup just to preview XML).

### Java / Kotlin APK & AAB Build

 *Compile projects into* *Debug** or **Release** `.apk`.

 *Play Store ready* `.aab`** support.

* One-tap build from the green play control on Java / Kotlin files.

* Guided setup wizard for Java, Gradle, and Android SDK tools.

* Custom paths and download URLs for tools (fully customizable in settings).

* Keystore / signing options for release builds.

### Project tools

* **Project Wizard** — create new apps from templates (Empty Activity, Bottom Navigation, Drawer, and more).

* **Open existing project** and continue from where you left off.

* **Generate App Icon** — pick an image and generate launcher icons in one flow (yellow icon control on layout XML).

* **Clone / configure** helpers for project structure.

### Features Store

* Browse ready packages: Firebase, Maps, Retrofit, permissions, UI helpers, and more.

* One action injects dependencies, permissions, and starter snippets into the current project.

* Snippets for Java and Kotlin (permissions, network, UI patterns, etc.).

### Editor helpers

 *Snippets for* *Java**, **Kotlin**, and **XML**.

* Code formatting for supported Android files.

* Custom snippet folder support from settings.

### Flutter (new)

* **Flutter home** — create a new Flutter project (template picker) or open an existing one.

* **Flutter preview** — run / view your app UI from Acode with logs and controls.

* Preview menu and log popup for quick debug feedback.

* **GitHub Actions APK build** — build Flutter APK in the cloud without a full local Android SDK for Flutter.

 *Build page with* *Start Build** (does not auto-run when you only open the tab).

* Build history sidebar (previous runs + download when available).

* Build options in the UI (saved in plugin settings):

   *Build mode:* *release** (smaller), debug, profile

   *Target CPU:* *arm64 only** (recommended), arm, split per ABI, or all ABIs

  * Tree-shake icons for smaller release APKs

* Blue Flutter play control on `lib/main.dart` (and Flutter project context).

### Settings & customization

* Plugin settings panel for paths, ports, GitHub token / repo, auto-create private repo, build mode, ABI, and more.

 *Unlike the older Android Builder-only plugin,* *paths and build behaviour are user-configurable**.

* Save once — used by local tools and by GitHub workflow inputs (no need to edit workflow files by hand).

---

## Preview gallery

### Android Builder & tools

<center>

<div style="display:flex;overflow:auto; gap:8px;">

  <img src="https://i.postimg.cc/PqZQ66gd/IMG-20260923-182149.jpg" alt="Project / home" style="width:280px;border-radius:5px;">
  
  <img src="https://i.postimg.cc/FRPYqfQ9/Screenshot-2026-01-20-14-11-47-56-a2cf8efcdd42a8e6f7906303f104fb67.jpg" alt="Project / home" style="width:280px;border-radius:5px;">

  <img src="https://i.postimg.cc/pTDcCJmg/Screenshot-2026-08-29-13-11-54-92-e3c1f266f17b29c7b40472751f031275.jpg" alt="Build UI" style="width:280px;border-radius:5px;">

  <img src="https://i.postimg.cc/j5qWZHBD/Screenshot-2026-01-20-14-19-41-01-a2cf8efcdd42a8e6f7906303f104fb67.jpg" alt="Build UI" style="width:280px;border-radius:5px;">
  
  <img src="https://i.postimg.cc/3NRcQtNB/Screenshot-2026-01-22-15-55-37-63-a2cf8efcdd42a8e6f7906303f104fb67.jpg" alt="Android Builder" style="width:280px;border-radius:5px;">

  <img src="https://i.postimg.cc/G23BqF6B/Screenshot-2026-01-20-14-21-42-08-a2cf8efcdd42a8e6f7906303f104fb67.jpg" alt="Features" style="width:280px;border-radius:5px;">

  <img src="https://i.postimg.cc/g0HXVStF/Screenshot-2026-01-20-14-10-03-42-a2cf8efcdd42a8e6f7906303f104fb67.jpg" alt="Setup" style="width:280px;border-radius:5px;">

  <img src="https://i.postimg.cc/02KCYvpt/Screenshot-2026-01-20-14-35-05-31-e3c1f266f17b29c7b40472751f031275.jpg" alt="Store" style="width:280px;border-radius:5px;">

  <img src="https://i.postimg.cc/vTYsBRqK/Screenshot-2026-01-19-12-47-49-83-a2cf8efcdd42a8e6f7906303f104fb67.jpg" alt="More" style="width:280px;border-radius:5px;">
  
  <img src="https://i.postimg.cc/Mp0yVcVH/Screenshot-2026-09-23-18-40-33-09-6e574d2cac5d23d6090531e567e7bf93.jpg" alt="Xml layout host" style="width:280px;border-radius:5px;">

</div>

</center>

### XML layout preview

<center>

<div style="display:flex;overflow:auto; gap:8px;">  

  <img src="https://i.postimg.cc/nhc27tYJ/Screenshot-2026-08-29-13-04-45-85-e3c1f266f17b29c7b40472751f031275.jpg" alt="XML Preview" style="width:300px;border-radius:5px;">  
  
</div>

</center>

<details>

<summary>used xml code</summary>

<?xml version="1.0" encoding="utf-8"?>

<androidx.constraintlayout.widget.ConstraintLayout 

    xmlns:android="<http://schemas.android.com/apk/res/android>"

    xmlns:app="<http://schemas.android.com/apk/res-auto>"

    android:layout_width="match_parent"

    android:layout_height="match_parent"

    android:background="#121212">

    <TextView

        android:layout_width="wrap_content"

        android:layout_height="wrap_content"

        android:text="ANDROID BUILDER PRO"

        android:textColor="#00E676"

        android:textSize="20sp"

        android:textStyle="bold"

        android:letterSpacing="0.15"

        app:layout_constraintTop_toTopOf="parent"

        app:layout_constraintBottom_toBottomOf="parent"

        app:layout_constraintStart_toStartOf="parent"

        app:layout_constraintEnd_toEndOf="parent" />

</androidx.constraintlayout.widget.ConstraintLayout>

</details>

<center>

  <img src="https://i.postimg.cc/6p5cRNVS/Screenshot-2026-08-29-12-59-40-42-e3c1f266f17b29c7b40472751f031275.jpg" alt="XML Preview" style="height:230px;border-radius:5px;">

</center>

<details>

<summary>used xml code</summary>

<?xml version="1.0" encoding="utf-8"?>

<androidx.constraintlayout.widget.ConstraintLayout 

    xmlns:android="<http://schemas.android.com/apk/res/android>"

    xmlns:app="<http://schemas.android.com/apk/res-auto>"

    xmlns:tools="<http://schemas.android.com/tools>"

    android:layout_width="match_parent"

    android:layout_height="match_parent"

    android:background="#121212">

    <!-- Header / Top Bar -->

    <ImageView

        android:id="@+id/btn_down"

        android:layout_width="48dp"

        android:layout_height="48dp"

        android:layout_marginStart="8dp"

        android:layout_marginTop="16dp"

        android:padding="12dp"

        android:src="@android:drawable/arrow_down_float"

        app:layout_constraintStart_toStartOf="parent"

        app:layout_constraintTop_toTopOf="parent"

        app:tint="#FFFFFF" />

    <TextView

        android:id="@+id/tv_header"

        android:layout_width="wrap_content"

        android:layout_height="wrap_content"

        android:text="NOW PLAYING"

        android:textColor="#B3B3B3"

        android:textSize="12sp"

        android:letterSpacing="0.1"

        android:textStyle="bold"

        app:layout_constraintBottom_toBottomOf="@id/btn_down"

        app:layout_constraintEnd_toEndOf="parent"

        app:layout_constraintStart_toStartOf="parent"

        app:layout_constraintTop_toTopOf="@id/btn_down" />

    <ImageView

        android:id="@+id/btn_menu"

        android:layout_width="48dp"

        android:layout_height="48dp"

        android:layout_marginEnd="8dp"

        android:padding="12dp"

        android:src="@android:drawable/ic_menu_more"

        app:layout_constraintBottom_toBottomOf="@id/btn_down"

        app:layout_constraintEnd_toEndOf="parent"

        app:layout_constraintTop_toTopOf="@id/btn_down"

        app:tint="#FFFFFF" />

    <!-- Advanced Curved Album Art Container -->

    <androidx.cardview.widget.CardView

        android:id="@+id/card_album"

        android:layout_width="0dp"

        android:layout_height="0dp"

        android:layout_marginHorizontal="40dp"

        android:layout_marginTop="24dp"

        android:layout_marginBottom="24dp"

        app:cardCornerRadius="20dp"

        app:cardElevation="12dp"

        app:cardBackgroundColor="#2C2C2C"

        app:layout_constraintDimensionRatio="1:1"

        app:layout_constraintEnd_toEndOf="parent"

        app:layout_constraintStart_toStartOf="parent"

        app:layout_constraintTop_toBottomOf="@id/tv_header"

        app:layout_constraintBottom_toTopOf="@id/tv_song_title">

        <ImageView

            android:id="@+id/iv_album_art"

            android:layout_width="match_parent"

            android:layout_height="match_parent"

            android:scaleType="centerCrop"

            tools:src="@tools:sample/backgrounds/scenic" />

    </androidx.cardview.widget.CardView>

    <!-- Song Title & Artist -->

    <TextView

        android:id="@+id/tv_song_title"

        android:layout_width="0dp"

        android:layout_height="wrap_content"

        android:layout_marginHorizontal="32dp"

        android:layout_marginBottom="4dp"

        android:ellipsize="end"

        android:maxLines="1"

        android:text="Shape of You"

        android:textAlignment="center"

        android:textColor="#FFFFFF"

        android:textSize="22sp"

        android:textStyle="bold"

        app:layout_constraintBottom_toTopOf="@id/tv_artist"

        app:layout_constraintEnd_toEndOf="parent"

        app:layout_constraintStart_toStartOf="parent" />

    <TextView

        android:id="@+id/tv_artist"

        android:layout_width="0dp"

        android:layout_height="wrap_content"

        android:layout_marginHorizontal="32dp"

        android:layout_marginBottom="24dp"

        android:ellipsize="end"

        android:maxLines="1"

        android:text="Ed Sheeran"

        android:textAlignment="center"

        android:textColor="#B3B3B3"

        android:textSize="15sp"

        app:layout_constraintBottom_toTopOf="@id/seekbar"

        app:layout_constraintEnd_toEndOf="parent"

        app:layout_constraintStart_toStartOf="parent" />

    <!-- Progress Bar & Time Stamps -->

    <SeekBar

        android:id="@+id/seekbar"

        android:layout_width="0dp"

        android:layout_height="wrap_content"

        android:layout_marginHorizontal="16dp"

        android:layout_marginBottom="6dp"

        android:progress="35"

        android:progressTint="#1DB954"

        android:thumbTint="#1DB954"

        app:layout_constraintBottom_toTopOf="@id/tv_current_time"

        app:layout_constraintEnd_toEndOf="parent"

        app:layout_constraintStart_toStartOf="parent" />

    <TextView

        android:id="@+id/tv_current_time"

        android:layout_width="wrap_content"

        android:layout_height="wrap_content"

        android:layout_marginStart="24dp"

        android:layout_marginBottom="24dp"

        android:text="1:24"

        android:textColor="#B3B3B3"

        android:textSize="12sp"

        app:layout_constraintBottom_toTopOf="@id/btn_play"

        app:layout_constraintStart_toStartOf="parent" />

    <TextView

        android:id="@+id/tv_total_time"

        android:layout_width="wrap_content"

        android:layout_height="wrap_content"

        android:layout_marginEnd="24dp"

        android:text="3:53"

        android:textColor="#B3B3B3"

        android:textSize="12sp"

        app:layout_constraintBottom_toBottomOf="@id/tv_current_time"

        app:layout_constraintEnd_toEndOf="parent"

        app:layout_constraintTop_toTopOf="@id/tv_current_time" />

    <!-- Playback Control Buttons -->

    <ImageView

        android:id="@+id/btn_play"

        android:layout_width="64dp"

        android:layout_height="64dp"

        android:layout_marginBottom="36dp"

        android:background="@android:drawable/btn_default"

        android:backgroundTint="#1DB954"

        android:padding="16dp"

        android:src="@android:drawable/ic_media_play"

        app:layout_constraintBottom_toBottomOf="parent"

        app:layout_constraintEnd_toEndOf="parent"

        app:layout_constraintStart_toStartOf="parent"

        app:tint="#FFFFFF" />

    <ImageView

        android:id="@+id/btn_prev"

        android:layout_width="48dp"

        android:layout_height="48dp"

        android:layout_marginEnd="24dp"

        android:padding="12dp"

        android:src="@android:drawable/ic_media_previous"

        app:layout_constraintBottom_toBottomOf="@id/btn_play"

        app:layout_constraintEnd_toStartOf="@id/btn_play"

        app:layout_constraintTop_toTopOf="@id/btn_play"

        app:tint="#FFFFFF" />

    <ImageView

        android:id="@+id/btn_next"

        android:layout_width="48dp"

        android:layout_height="48dp"

        android:layout_marginStart="24dp"

        android:padding="12dp"

        android:src="@android:drawable/ic_media_next"

        app:layout_constraintBottom_toBottomOf="@id/btn_play"

        app:layout_constraintStart_toEndOf="@id/btn_play"

        app:layout_constraintTop_toTopOf="@id/btn_play"

        app:tint="#FFFFFF" />

    <ImageView

        android:id="@+id/btn_shuffle"

        android:layout_width="40dp"

        android:layout_height="40dp"

        android:padding="8dp"

        android:src="@android:drawable/ic_menu_sort_by_size"

        app:layout_constraintBottom_toBottomOf="@id/btn_play"

        app:layout_constraintEnd_toStartOf="@id/btn_prev"

        app:layout_constraintStart_toStartOf="parent"

        app:layout_constraintTop_toTopOf="@id/btn_play"

        app:tint="#B3B3B3" />

    <ImageView

        android:id="@+id/btn_repeat"

        android:layout_width="40dp"

        android:layout_height="40dp"

        android:padding="8dp"

        android:src="@android:drawable/ic_popup_sync"

        app:layout_constraintBottom_toBottomOf="@id/btn_play"

        app:layout_constraintEnd_toEndOf="parent"

        app:layout_constraintStart_toEndOf="@id/btn_next"

        app:layout_constraintTop_toTopOf="@id/btn_play"

        app:tint="#B3B3B3" />

</androidx.constraintlayout.widget.ConstraintLayout>

</details>

## Layout Preview Host (APK)

Install the companion app for **real on-device XML layout preview**:

**Download:** [Layout.Preview.Host.apk](https://github.com/Sou6900/XHLP_Engine/releases/download/v0.0.1/Layout.Preview.Host.apk)

<img src="https://i.postimg.cc/Mp0yVcVH/Screenshot-2026-09-23-18-40-33-09-6e574d2cac5d23d6090531e567e7bf93.jpg" alt="XML Preview" style="width:300px;border-radius:5px;">  

This is a **debug / early feedback** build. If feedback is good, more features and advanced upgrades will ship within a few days.


### What works well
* **Real** layout inflation preview
* **Fast** feedback while designing XML
* Helps iterate UI quickly without a full APK install each time

![Xml layout preview](https://i.postimg.cc/yxS19ZJf/Screenshot-2026-09-23-18-27-56-66-99c04817c0de5652397fc8b56c3b3817.jpg)

### Known limit
* **Large binary images** (big PNG/JPG drawables) may not load in the previewer yet for faster load but you can see shadow of that image 

### How to use External XML previewer
* **Change setting** to XHLP preview as - `Android Builder Pro External Previewer`
  
![Xml preview_change_setting](https://i.postimg.cc/T3QKTnnm/Screenshot-2026-09-23-18-30-31-57-e3c1f266f17b29c7b40472751f031275.jpg)

* Download & Install **Open Xml layout host app** , Turn on server
* Now **Open An android xml file** from main/res/layout/ folder in your android project
* Click on yellow icon on topbar of Acode
* Congratulations ! You will see live preview of that XML in Layout Host app


### Upcoming (layout previewer)
* More widget / layout support
* **Edit in XML layout preview**
* **Xml layout host previewer design upgrade like html legacy**
* Further advanced upgrades after this feedback cycle

---


### Flutter

<center>

<div style="display:flex;overflow:auto; gap:8px;align-items:flex-start;">

  <img src="https://i.postimg.cc/T3xZxR13/flutter-home-tab-page.jpg" alt="Flutter home" style="width:280px;border-radius:5px;">

  <img src="https://i.postimg.cc/x1QWQ080/Flutter-preview-page.jpg" alt="Flutter preview" style="width:280px;border-radius:5px;">

  <img src="https://i.postimg.cc/QdDRDXCt/Flutter-build-page.jpg" alt="Flutter build" style="width:280px;border-radius:5px;">

</div>

</center>

---

## How to use

### 1) How to preview Android XML file

1. Open an **Android project** in Acode.

2. Go to `res/layout` (or similar) and open a file such as `activity_main.xml`.

3. Tap the **preview icon** on the top bar of the editor.

4. After the first preview, you can **switch** between the XML tab and the Preview tab instead of tapping the icon again.

5. Keep the Preview tab open while you edit XML for a smoother flow. If you fully close the preview tab, open it again from the icon when needed.

---

### 2) How to setup for APK build (Java / Kotlin)

1. Press **Ctrl + Shift + P** to open the **Command Palette**.

2. Search for **Open Android Builder Pro** (or Android Builder) and open it.

3. Prefer creating the project under **Terminal storage** (see note above).

4. Choose **Create Project** or **Open Existing Project**.

5. Complete the **setup wizard** if tools are missing (Java, Gradle, SDK components). Progress and logs show during install.

6. Open a file under `app/src/main/java` (or kotlin), for example `MainActivity.java`.

7. Tap the green **Play (▶)** button in the top header to start the APK / AAB build.

8. Optional:

   * **Feature Store** — Command Palette → search `androidfeaturestore` (or open from a Java/XML context) to add libraries and permissions.

   * **App icon** — open a layout XML, use the yellow control, pick an image (around 500×500 is ideal, any size works).

<img src="https://i.postimg.cc/nL24WMwX/Screenshot-2026-01-18-10-20-36-77-40deb401b9ffe8e1df2f1cc5ba480b12.jpg" alt="Play build" style="width:100px;border-radius:5px;margin-left:20px;">

<img src="https://i.postimg.cc/3RDPkSYy/IMG-20260122-160858.png" alt="Feature store" style="width:280px;border-radius:5px;margin-left:20px;">

<img src="https://i.postimg.cc/mgQ8dc2t/Screenshot-2026-01-19-10-43-29-41-a2cf8efcdd42a8e6f7906303f104fb67.jpg" alt="Icon generator" style="width:100px;border-radius:5px;margin-left:20px;">

---

### 3) How to setup Flutter Environment

1. Press **Ctrl + Shift + P** to open the **Command Palette**.

2. Search for **Open Android Builder Pro** and click it.

3. Open the **Flutter** section / home tab.

4. **Create** a new Flutter project *or* **Open** an existing one.

5. If creating: choose a **Flutter template**, set the project name, and place it under **Terminal storage** when possible.

6. If Flutter tools are missing, follow the **Flutter setup** screen (download / install into terminal home). Wait until setup reports ready.

7. Open `lib/main.dart` — use the **blue Flutter play icon** for settings, preview, and build entry points.

<img src="https://i.postimg.cc/DfWb1GFz/Screenshot-2026-08-29-11-31-30-48-e3c1f266f17b29c7b40472751f031275.jpg" alt="Flutter play" style="width:100px;border-radius:5px;margin-left:20px;">

8. **Preview**

    *From Flutter settings / home, start* *Preview**.

   * Use the preview menu and log popup to inspect output.

![flutter_menu_preview](https://i.postimg.cc/4NVrjKfd/flutter-preview-menu.jpg)

---

<img src="https://i.postimg.cc/3xhPhKNY/flutter-preview-logs-popup.jpg" alt="Flutter logs" style="width:280px;border-radius:5px;">

9. **Build APK via GitHub**

    *In Flutter settings, set your* *GitHub personal access token** (repo + workflow access).

    *Optionally set* `owner/repo`*, or allow* *auto-create private repo**.

   * Choose build options (release + arm64 recommended for a normal-sized APK).

    *Open* *Build APK (GitHub)** — the build page opens in **Ready** state (it does **not** start by itself).

    *Review options → tap* *Start Build**.

    *Use* *≡ History** for past runs and **Download APK** when the run succeeds.

---

## Tips for smaller Flutter APKs

 *Prefer* *release** mode (not debug).

 *Prefer* *arm64 only** unless you need older or multiple CPUs.

 *Keep* *tree-shake icons** on for release.

* Debug / “all ABIs” builds are often much larger (tens of MB extra).


---

## Privacy

* **No data collection** by the plugin or the Layout Preview Host APK
* **GitHub tokens** are stored **only on your device** (plugin settings / local storage)
* Layout Preview Host does **not** upload or transfer your XML or project data
* **No unnecessary permissions** required for XML layout preview beyond what the host app needs to draw UI on device


---


## Important notes

 *Uninstall older separate* *Android Builder** or duplicate XML-only packages if the store asks you to avoid conflicts — **Android Builder Pro** is the single plugin to keep.

* Terminal access in Acode is required for SDK install, APK build, and Flutter tooling.

* GitHub artifact download needs a valid token; browser links without login may show “not found”.

---

## Contact & Community

**Feedback?** [Plugin comments](https://acode.app/plugin/acode.plugin.androidbuilder/comments)  

**Bugs?** Same comments page  

**Telegram:** [Dev. Sou](https://t.me/sourav0chand)

---

<style>

  pre, code {

    background: #1e1e1e;

    color: #eee;

    font-family: 'JetBrains Mono', monospace;

    border-radius: 6px;

    padding: 8px 10px;

    display: block;

    overflow-x: auto;

    line-height: 1.6;

  }

  code {

    display: inline;

    padding: 2px 4px;

    border-radius: 4px;

    background: rgba(0,0,0,0.05);

    color: #117f06;

  }

  .code-block {

    padding: 16px;

    overflow: auto;

    font-size: 85%;

    background-color: #7f7f7f2d;

    border-radius: 6px;

    font-family: monospace;

  }

  .feature {

    background: rgba(255, 220, 100, 0.15);

    padding: 3px 6px;

    border-radius: 4px;

    font-weight: 600;

  }

  .img {

    display: block;

    margin: 12px auto;

    border-radius: 8px;

    box-shadow: 0 0 8px rgba(0,0,0,0.1);

    max-width: 100%;

  }

</style>