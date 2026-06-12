package com.motionsewa.drive;

import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "NativeDownload")
public class NativeDownloadPlugin extends Plugin {
    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final Map<String, Boolean> cancelledDownloads = new ConcurrentHashMap<>();

    @PluginMethod
    public void downloadFile(PluginCall call) {
        String urlString = call.getString("url");
        String filename = call.getString("filename");

        if (urlString == null || filename == null) {
            call.reject("URL and filename are required");
            return;
        }

        android.util.Log.d("NativeDownload", "Starting download for: " + filename);
        call.setKeepAlive(true);
        cancelledDownloads.remove(filename);

        executor.execute(() -> {
            HttpURLConnection connection = null;
            BufferedInputStream input = null;
            OutputStream output = null;
            File destinationFile = null;
            Uri contentUri = null;

            try {
                // For Android 10+ (API 29+), use MediaStore for proper scoped storage access
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    android.util.Log.d("NativeDownload", "Using MediaStore for Android 10+");
                    
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
                    values.put(MediaStore.Downloads.MIME_TYPE, "application/octet-stream");
                    values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Motion Drive");
                    values.put(MediaStore.Downloads.IS_PENDING, 1);

                    contentUri = getContext().getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (contentUri == null) {
                        call.reject("Failed to create MediaStore entry");
                        return;
                    }

                    output = getContext().getContentResolver().openOutputStream(contentUri);
                } else {
                    // For older Android versions, use traditional file path
                    android.util.Log.d("NativeDownload", "Using File API for Android 9 and below");
                    
                    File motionDriveDir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "Motion Drive");
                    if (!motionDriveDir.exists()) {
                        motionDriveDir.mkdirs();
                    }

                    destinationFile = new File(motionDriveDir, filename);
                    if (destinationFile.exists()) {
                        destinationFile.delete();
                    }

                    output = new FileOutputStream(destinationFile);
                }

                URL url = new URL(urlString);
                connection = (HttpURLConnection) url.openConnection();
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(15000);
                connection.connect();

                if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                    call.reject("Server returned HTTP " + connection.getResponseCode());
                    return;
                }

                int fileLength = connection.getContentLength();
                android.util.Log.d("NativeDownload", "File size: " + fileLength + " bytes");
                input = new BufferedInputStream(connection.getInputStream(), 8192);

                byte[] buffer = new byte[8192];
                long totalBytesRead = 0;
                int bytesRead;
                long lastProgressUpdate = 0;

                while ((bytesRead = input.read(buffer)) != -1) {
                    if (cancelledDownloads.containsKey(filename)) {
                        // Clean up based on Android version
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && contentUri != null) {
                            getContext().getContentResolver().delete(contentUri, null, null);
                        } else if (destinationFile != null && destinationFile.exists()) {
                            destinationFile.delete();
                        }
                        call.reject("Download cancelled");
                        return;
                    }

                    totalBytesRead += bytesRead;
                    output.write(buffer, 0, bytesRead);

                    long now = System.currentTimeMillis();
                    if (now - lastProgressUpdate > 150 || totalBytesRead == fileLength) {
                        final long finalBytesRead = totalBytesRead;
                        final int finalFileLength = fileLength;
                        
                        android.util.Log.d("NativeDownload", "Progress: " + finalBytesRead + "/" + finalFileLength);
                        
                        getBridge().executeOnMainThread(() -> {
                            JSObject progressData = new JSObject();
                            progressData.put("bytesDownloaded", finalBytesRead);
                            progressData.put("totalBytes", finalFileLength);
                            progressData.put("filename", filename);
                            notifyListeners("progress", progressData);
                        });
                        
                        lastProgressUpdate = now;
                    }
                }

                output.flush();
                output.close();
                input.close();
                connection.disconnect();

                // For Android 10+, mark file as completed
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && contentUri != null) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.IS_PENDING, 0);
                    getContext().getContentResolver().update(contentUri, values, null, null);
                    
                    android.util.Log.d("NativeDownload", "File saved via MediaStore: " + contentUri.toString());
                    
                    JSObject ret = new JSObject();
                    ret.put("path", contentUri.toString());
                    call.resolve(ret);
                } else if (destinationFile != null) {
                    // For older Android, notify media scanner so file appears in file managers
                    Intent scanIntent = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
                    scanIntent.setData(Uri.fromFile(destinationFile));
                    getContext().sendBroadcast(scanIntent);
                    
                    android.util.Log.d("NativeDownload", "File saved: " + destinationFile.getAbsolutePath());
                    
                    JSObject ret = new JSObject();
                    ret.put("path", destinationFile.getAbsolutePath());
                    call.resolve(ret);
                } else {
                    call.reject("Unknown error: destination file is null");
                }

            } catch (Exception e) {
                call.reject("Download failed: " + e.getMessage(), e);
            } finally {
                cancelledDownloads.remove(filename);
                try {
                    if (output != null) output.close();
                    if (input != null) input.close();
                    if (connection != null) connection.disconnect();
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        });
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        String filename = call.getString("filename");
        if (filename == null) {
            call.reject("Filename is required");
            return;
        }
        
        cancelledDownloads.put(filename, true);
        call.resolve();
    }
}
