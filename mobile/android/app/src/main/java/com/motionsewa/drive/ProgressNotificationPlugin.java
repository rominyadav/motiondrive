package com.motionsewa.drive;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(
    name = "ProgressNotification",
    permissions = {
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
    }
)
public class ProgressNotificationPlugin extends Plugin {
    private static final String CHANNEL_ID = "transfer_progress_v6";
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private final ExecutorService executor = Executors.newCachedThreadPool();

    private final Map<Long, PluginCall> activeDownloads = new ConcurrentHashMap<>();
    private final Map<Long, String> downloadFilenames = new ConcurrentHashMap<>();
    private DownloadManager downloadManager;

    private final BroadcastReceiver downloadReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            long downloadId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
            PluginCall call = activeDownloads.remove(downloadId);
            String filename = downloadFilenames.remove(downloadId);
            if (call != null && filename != null) {
                DownloadManager.Query query = new DownloadManager.Query();
                query.setFilterById(downloadId);
                try (Cursor cursor = downloadManager.query(query)) {
                    if (cursor != null && cursor.moveToFirst()) {
                        int statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
                        int status = cursor.getInt(statusIndex);
                        if (status == DownloadManager.STATUS_SUCCESSFUL) {
                            File motionDriveDir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "Motion Drive");
                            File destinationFile = new File(motionDriveDir, filename);
                            JSObject ret = new JSObject();
                            ret.put("path", destinationFile.getAbsolutePath());
                            call.resolve(ret);
                        } else {
                            int reasonIndex = cursor.getColumnIndex(DownloadManager.COLUMN_REASON);
                            int reason = cursor.getInt(reasonIndex);
                            call.reject("Download failed with DownloadManager error code: " + reason);
                        }
                    } else {
                        call.reject("Download completed but query was empty");
                    }
                } catch (Exception e) {
                    call.reject("Error verifying download status: " + e.getMessage());
                }
            }
        }
    };

    @Override
    public void load() {
        createNotificationChannel();
        downloadManager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(downloadReceiver, filter, Context.RECEIVER_EXPORTED);
        } else {
            getContext().registerReceiver(downloadReceiver, filter);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "Transfer Progress";
            String description = "Shows active upload and download progress";
            int importance = NotificationManager.IMPORTANCE_DEFAULT;
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            channel.setSound(null, null);
            channel.enableVibration(false);
            channel.setShowBadge(false);
            
            NotificationManager notificationManager = getContext().getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    @PluginMethod
    public void checkStatus(PluginCall call) {
        JSObject res = new JSObject();
        res.put("status", "implemented");
        call.resolve(res);
    }

    /**
     * DEPRECATED - Use NativeDownload plugin instead
     * This method is disabled to prevent accidental use of DownloadManager
     */
    @PluginMethod
    public void downloadFile(PluginCall call) {
        call.reject("This method is deprecated. Use NativeDownload plugin instead.");
    }

    private void updateNotificationInternal(String title, String text, int progress, int max, int id) {
        // Create intent to open the app when notification is clicked
        Intent intent = new Intent(getContext(), MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(getContext(), id, intent, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_download)
                .setContentTitle(title)
                .setContentText(text)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setContentIntent(pendingIntent)
                .setAutoCancel(false)
                .setProgress(max, progress, (max <= 0));

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                getContext().checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                return;
            }
            NotificationManagerCompat.from(getContext()).notify(id, builder.build());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @PluginMethod
    public void showProgress(PluginCall call) {
        String title = call.getString("title", "Transferring...");
        String text = call.getString("text", "");
        int progress = call.getInt("progress", 0);
        int max = call.getInt("max", 100);
        int id = call.getInt("id", 1001);
        
        updateNotificationInternal(title, text, progress, max, id);
        call.resolve();
    }

    @PluginMethod
    public void hideProgress(PluginCall call) {
        int id = call.getInt("id", 1001);
        NotificationManagerCompat.from(getContext()).cancel(id);
        releaseLocks();
        call.resolve();
    }

    private void acquireLocks() {
        try {
            if (wakeLock == null) {
                PowerManager powerManager = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
                wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MotionsewaDrive:TransferWakeLock");
                wakeLock.acquire(10 * 60 * 1000L);
            }
            if (wifiLock == null) {
                WifiManager wifiManager = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                wifiLock = wifiManager.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "MotionsewaDrive:WifiLock");
                wifiLock.acquire();
            }
        } catch (Exception e) { e.printStackTrace(); }
    }

    private void releaseLocks() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
            wakeLock = null;
            if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
            wifiLock = null;
        } catch (Exception e) { e.printStackTrace(); }
    }
}
