package com.motionsewa.drive;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
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
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "ProgressNotification",
    permissions = {
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
    }
)
public class ProgressNotificationPlugin extends Plugin {
    private static final String CHANNEL_ID = "transfer_progress_channel_v2";

    @Override
    public void load() {
        createNotificationChannel();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "Transfer Progress";
            String description = "Shows active upload and download progress";
            // Use IMPORTANCE_LOW for progress notifications to avoid constant alert sounds
            int importance = NotificationManager.IMPORTANCE_LOW;
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
    public void requestPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            JSObject res = new JSObject();
            res.put("notifications", "granted");
            call.resolve(res);
        } else {
            super.requestPermissions(call);
        }
    }

    @PluginMethod
    public void showProgress(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (getPermissionState("notifications") != PermissionState.GRANTED) {
                call.reject("Permission not granted. Call requestPermissions first.");
                return;
            }
        }

        String title = call.getString("title", "Transferring...");
        String text = call.getString("text", "");
        String subText = call.getString("subText"); // Allow passing subText from JS
        
        Integer progressVal = call.getInt("progress");
        int progress = (progressVal != null) ? progressVal : 0;
        
        Integer maxVal = call.getInt("max");
        int max = (maxVal != null) ? maxVal : 100;
        
        Integer idVal = call.getInt("id");
        int id = (idVal != null) ? idVal : 1001;
        
        Boolean indeterminateVal = call.getBoolean("indeterminate");
        boolean indeterminate = (indeterminateVal != null) ? indeterminateVal : false;

        // Try to find a specific notification icon, fallback to app icon
        int smallIconId = getContext().getResources().getIdentifier("ic_stat_name", "drawable", getContext().getPackageName());
        if (smallIconId == 0) {
            smallIconId = getContext().getApplicationInfo().icon;
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), CHANNEL_ID)
                .setSmallIcon(smallIconId)
                .setContentTitle(title)
                .setContentText(text)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setAutoCancel(false)
                .setCategory(NotificationCompat.CATEGORY_PROGRESS)
                .setProgress(max, progress, indeterminate);

        // Try to set a Large Icon (App Icon) for better UI/UX
        Bitmap largeIcon = getBitmapFromDrawable(getContext().getApplicationInfo().icon);
        if (largeIcon != null) {
            builder.setLargeIcon(largeIcon);
        }

        // Show percentage in the subtext if not indeterminate, or use provided subText
        if (subText != null && !subText.isEmpty()) {
            builder.setSubText(subText);
        } else if (!indeterminate && max > 0) {
            int percent = (int) ((progress * 100L) / max);
            builder.setSubText(percent + "%");
        }

        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(getContext());
        try {
            notificationManager.notify(id, builder.build());
            call.resolve();
        } catch (SecurityException e) {
            call.reject("Security exception (missing permissions): " + e.getLocalizedMessage());
        } catch (Exception e) {
            call.reject("Failed to show notification: " + e.getLocalizedMessage());
        }
    }

    private Bitmap getBitmapFromDrawable(int drawableId) {
        try {
            Drawable drawable = getContext().getDrawable(drawableId);
            if (drawable == null) return null;
            
            if (drawable instanceof BitmapDrawable) {
                return ((BitmapDrawable) drawable).getBitmap();
            }
            
            int width = drawable.getIntrinsicWidth();
            int height = drawable.getIntrinsicHeight();
            if (width <= 0 || height <= 0) {
                width = 512; // Fallback size
                height = 512;
            }
            
            Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            drawable.setBounds(0, 0, canvas.getWidth(), canvas.getHeight());
            drawable.draw(canvas);
            return bitmap;
        } catch (Exception e) {
            return null;
        }
    }

    @PluginMethod
    public void hideProgress(PluginCall call) {
        Integer idVal = call.getInt("id");
        int id = (idVal != null) ? idVal : 1001;
        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(getContext());
        notificationManager.cancel(id);
        call.resolve();
    }
}
