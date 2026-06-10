package com.motionsewa.drive;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.pm.PackageManager;
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
    private static final String CHANNEL_ID = "transfer_progress_channel";

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
        
        Integer progressVal = call.getInt("progress");
        int progress = (progressVal != null) ? progressVal : 0;
        
        Integer maxVal = call.getInt("max");
        int max = (maxVal != null) ? maxVal : 100;
        
        Integer idVal = call.getInt("id");
        int id = (idVal != null) ? idVal : 1001;
        
        Boolean indeterminateVal = call.getBoolean("indeterminate");
        boolean indeterminate = (indeterminateVal != null) ? indeterminateVal : false;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), CHANNEL_ID)
                .setSmallIcon(getContext().getApplicationInfo().icon)
                .setContentTitle(title)
                .setContentText(text)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setAutoCancel(false)
                .setProgress(max, progress, indeterminate);

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

    @PluginMethod
    public void hideProgress(PluginCall call) {
        Integer idVal = call.getInt("id");
        int id = (idVal != null) ? idVal : 1001;
        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(getContext());
        notificationManager.cancel(id);
        call.resolve();
    }
}
