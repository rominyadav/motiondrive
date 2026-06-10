package com.motionsewa.drive;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(
    name = "ProgressNotification",
    permissions = {
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
    }
)
public class ProgressNotificationPlugin extends Plugin {
    private static final String CHANNEL_ID = "transfer_progress_v4"; // Incrementing version to force clean settings

    @Override
    public void load() {
        createNotificationChannel();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "Transfer Progress";
            String description = "Shows active upload and download progress";
            // Use IMPORTANCE_DEFAULT to ensure the progress bar is always visible
            int importance = NotificationManager.IMPORTANCE_DEFAULT;
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            // Strictly disable sound and vibration to prevent "popping" noise
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

    @PluginMethod
    public void showProgress(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (getPermissionState("notifications") != PermissionState.GRANTED) {
                call.reject("Permission not granted.");
                return;
            }
        }

        String title = call.getString("title", "Transferring...");
        String text = call.getString("text", "");
        String subText = call.getString("subText");
        
        int progress = call.getInt("progress", 0);
        int max = call.getInt("max", 100);
        int id = call.getInt("id", 1001);
        boolean indeterminate = call.getBoolean("indeterminate", false);

        // 1. Better Icon Handling
        int smallIconId = getContext().getResources().getIdentifier("ic_stat_name", "drawable", getContext().getPackageName());
        if (smallIconId == 0) {
            // Fallback to launcher icon but try to find the standard foreground one
            smallIconId = android.R.drawable.stat_sys_download; // Use system download icon if app icon fails
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), CHANNEL_ID)
                .setSmallIcon(smallIconId)
                .setContentTitle(title)
                .setContentText(text)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT) // Default priority shows the bar
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setAutoCancel(false)
                .setSilent(true) // Ensures no sound/popping on updates
                .setCategory(NotificationCompat.CATEGORY_PROGRESS)
                .setProgress(max, progress, indeterminate);

        // 3. Add Percentage text
        if (subText != null && !subText.isEmpty()) {
            builder.setSubText(subText);
        } else if (!indeterminate && max > 0) {
            int percent = (int) ((progress * 100L) / max);
            builder.setSubText(percent + "%");
        }

        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(getContext());
        try {
            // Check for notification permission (Required for Android 13+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                getContext().checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                call.reject("Notification permission not granted");
                return;
            }
            notificationManager.notify(id, builder.build());
            call.resolve();
        } catch (SecurityException e) {
            call.reject("Permission error: " + e.getLocalizedMessage());
        } catch (Exception e) {
            call.reject(e.getLocalizedMessage());
        }
    }

    private Bitmap getBitmapFromDrawable(int drawableId) {
        try {
            Drawable drawable = getContext().getDrawable(drawableId);
            if (drawable == null) return null;
            if (drawable instanceof BitmapDrawable) return ((BitmapDrawable) drawable).getBitmap();
            Bitmap bitmap = Bitmap.createBitmap(drawable.getIntrinsicWidth(), drawable.getIntrinsicHeight(), Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            drawable.setBounds(0, 0, canvas.getWidth(), canvas.getHeight());
            drawable.draw(canvas);
            return bitmap;
        } catch (Exception e) { return null; }
    }

    @PluginMethod
    public void hideProgress(PluginCall call) {
        int id = call.getInt("id", 1001);
        NotificationManagerCompat.from(getContext()).cancel(id);
        call.resolve();
    }
}
