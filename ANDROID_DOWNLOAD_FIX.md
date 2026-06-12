# Android Download Fix - Rebuild Instructions

## Changes Made

### 1. Created NativeDownloadPlugin.java
- Custom streaming downloader with real-time progress
- Saves to Downloads/Motion Drive folder
- Emits progress events on main thread
- Supports cancellation

### 2. Disabled ProgressNotificationPlugin.downloadFile()
- Old DownloadManager method now returns error
- Forces app to use new NativeDownload plugin

### 3. Updated MainActivity.java
- Registered NativeDownloadPlugin

### 4. Updated native-bridge.ts
- Android downloads now use NativeDownload plugin
- Added progress listener and cancellation support
- Added debug logging

## How to Rebuild and Test

### Step 1: Clean Build
```bash
cd mobile
# Clean old build artifacts
rm -rf android/app/build
rm -rf android/.gradle/caches

# Sync Capacitor
npx cap sync android
```

### Step 2: Rebuild APK
```bash
cd android
./gradlew clean
./gradlew assembleDebug
```

### Step 3: Install Fresh APK
```bash
# Uninstall old app first to clear cache
adb uninstall com.motionsewa.drive

# Install new APK
adb install app/build/outputs/apk/debug/app-debug.apk
```

### Step 4: Test Download
1. Open app and navigate to a file
2. Click download
3. Check Android Logcat for debug messages:
   - "Using NativeDownload plugin for Android"
   - "Starting download for: [filename]"
   - "Progress: X/Y"
4. Verify progress bar updates in real-time
5. Check file saved to: /storage/emulated/0/Download/Motion Drive/

### Step 5: Verify No DownloadManager
- You should NOT see Android's system download notification (0%)
- You should see your app's custom progress UI with speed/ETA
- Progress should update smoothly from 0% to 100%

## Troubleshooting

### If still using DownloadManager:
1. Check logcat - you should see "Using NativeDownload plugin"
2. If not, verify Capacitor sync: `npx cap sync android`
3. Do a full clean rebuild (steps above)
4. Make sure to uninstall old app before installing new one

### If progress stuck at 0%:
1. Check logcat for "Progress: X/Y" messages
2. If you see progress in logs but not UI, it's a React state issue
3. Progress events are being emitted every 150ms on main thread

### If download fails:
1. Check logcat for error messages
2. Verify internet permission in AndroidManifest.xml
3. Check if Motion Drive folder creation succeeded
