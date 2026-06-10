package com.motionsewa.drive;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
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

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
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

    @Override
    public void load() {
        createNotificationChannel();
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
     * NATIVE DOWNLOAD METHOD
     * This runs in a background thread and is immune to app minimization.
     */
    @PluginMethod
    public void downloadFile(PluginCall call) {
        String urlString = call.getString("url");
        String filename = call.getString("filename");

        if (urlString == null || filename == null) {
            call.reject("URL and filename are required");
            return;
        }

        executor.execute(() -> {
            HttpURLConnection connection = null;
            try {
                acquireLocks();
                URL url = new URL(urlString);
                connection = (HttpURLConnection) url.openConnection();
                connection.connect();

                int fileLength = connection.getContentLength();
                File file = new File(getContext().getExternalFilesDir(null), filename);
                
                try (InputStream input = new BufferedInputStream(connection.getInputStream(), 8192);
                     FileOutputStream output = new FileOutputStream(file)) {

                    byte[] data = new byte[8192];
                    long total = 0;
                    int count;
                    long lastUpdate = 0;

                    while ((count = input.read(data)) != -1) {
                        total += count;
                        output.write(data, 0, count);

                        // Update notification every 300ms
                        if (System.currentTimeMillis() - lastUpdate > 300) {
                            int progress = (fileLength > 0) ? (int) (total * 100 / fileLength) : 0;
                            updateNotificationInternal(filename, "Downloading...", progress, 100, 1001);
                            lastUpdate = System.currentTimeMillis();
                        }
                    }
                }
                
                NotificationManagerCompat.from(getContext()).cancel(1001);
                JSObject ret = new JSObject();
                ret.put("path", file.getAbsolutePath());
                call.resolve(ret);

            } catch (Exception e) {
                call.reject(e.getMessage());
            } finally {
                if (connection != null) connection.disconnect();
                releaseLocks();
            }
        });
    }

    private void updateNotificationInternal(String title, String text, int progress, int max, int id) {
        NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_download)
                .setContentTitle(title)
                .setContentText(text)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setSilent(true)
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
