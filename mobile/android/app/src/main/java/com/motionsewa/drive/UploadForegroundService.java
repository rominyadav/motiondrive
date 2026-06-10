package com.motionsewa.drive;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Binder;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class UploadForegroundService extends Service {
    private static final String CHANNEL_ID = "upload_service_channel_v1";
    private static final int NOTIFICATION_ID = 2002;

    private final IBinder binder = new LocalBinder();
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Map<String, UploadTask> activeUploads = new ConcurrentHashMap<>();
    private NotificationManager notificationManager;

    public interface UploadProgressListener {
        void onProgress(long bytesSent, int partNumber);
        void onPartComplete(int partNumber, String etag);
        void onComplete(JSArray completedParts);
        void onFailure(String error);
    }

    public class LocalBinder extends Binder {
        public UploadForegroundService getService() {
            return UploadForegroundService.this;
        }
    }

    private static class UploadTask {
        final String filePath;
        final long totalSize;
        final long chunkSize;
        final List<PartInfo> parts;
        final UploadProgressListener listener;
        volatile boolean isCancelled = false;

        UploadTask(String filePath, long totalSize, long chunkSize, List<PartInfo> parts, UploadProgressListener listener) {
            this.filePath = filePath;
            this.totalSize = totalSize;
            this.chunkSize = chunkSize;
            this.parts = parts;
            this.listener = listener;
        }
    }

    public static class PartInfo {
        public final int partNumber;
        public final String url;

        public PartInfo(int partNumber, String url) {
            this.partNumber = partNumber;
            this.url = url;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        createNotificationChannel();
        startForeground(NOTIFICATION_ID, createNotification("Starting upload...", 0, 100));
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Upload Service",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shows background file upload progress");
            channel.setSound(null, null);
            channel.enableVibration(false);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    private Notification createNotification(String text, int progress, int max) {
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Motion Drive Upload")
                .setContentText(text)
                .setSmallIcon(android.R.drawable.stat_sys_upload)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setProgress(max, progress, max <= 0);

        return builder.build();
    }

    private void updateNotification(String text, int progress, int max) {
        notificationManager.notify(NOTIFICATION_ID, createNotification(text, progress, max));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    public void cancelUpload(String filePath) {
        UploadTask task = activeUploads.get(filePath);
        if (task != null) {
            task.isCancelled = true;
        }
    }

    public void startUpload(String filePath, long totalSize, long chunkSize, List<PartInfo> parts, UploadProgressListener listener) {
        UploadTask task = new UploadTask(filePath, totalSize, chunkSize, parts, listener);
        activeUploads.put(filePath, task);
        
        executor.execute(() -> runUpload(task));
    }

    private void runUpload(UploadTask task) {
        InputStream rawInput = null;
        BufferedInputStream bis = null;
        JSArray completedPartsResult = new JSArray();

        try {
            updateNotification("Reading " + getFilenameFromPath(task.filePath) + "...", 0, 100);

            // Open stream (handles file paths or content:// URIs gracefully)
            if (task.filePath.startsWith("content://") || task.filePath.startsWith("file://")) {
                rawInput = getContentResolver().openInputStream(Uri.parse(task.filePath));
            } else {
                java.io.File file = new java.io.File(task.filePath);
                rawInput = new java.io.FileInputStream(file);
            }

            if (rawInput == null) {
                throw new Exception("Unable to open file input stream.");
            }

            bis = new BufferedInputStream(rawInput, 1024 * 1024); // 1MB read buffer
            long totalBytesUploaded = 0;

            for (PartInfo part : task.parts) {
                if (task.isCancelled) {
                    throw new Exception("Upload cancelled by user.");
                }

                // Determine precise chunk size to read
                long remainingFileBytes = task.totalSize - totalBytesUploaded;
                int currentChunkSize = (int) Math.min(task.chunkSize, remainingFileBytes);
                if (currentChunkSize <= 0) break;

                // Read exact chunk into memory
                byte[] chunkBuffer = new byte[currentChunkSize];
                int totalBytesRead = 0;
                while (totalBytesRead < currentChunkSize) {
                    int read = bis.read(chunkBuffer, totalBytesRead, currentChunkSize - totalBytesRead);
                    if (read < 0) {
                        break; // EOF
                    }
                    totalBytesRead += read;
                }

                // Upload chunk to presigned PUT URL
                String etag = uploadChunkToS3(part.url, chunkBuffer, totalBytesRead, part.partNumber, new ChunkProgressListener() {
                    private long lastUpdate = 0;
                    @Override
                    public void onProgress(int bytesSent) {
                        long now = System.currentTimeMillis();
                        if (now - lastUpdate > 300) {
                            task.listener.onProgress(bytesSent, part.partNumber);
                            lastUpdate = now;
                        }
                    }
                });

                totalBytesUploaded += totalBytesRead;
                int overallPercent = (int) (totalBytesUploaded * 100 / task.totalSize);
                updateNotification("Uploading " + getFilenameFromPath(task.filePath) + "... " + overallPercent + "%", overallPercent, 100);

                // Add part response to JS completion object
                JSObject partObj = new JSObject();
                partObj.put("PartNumber", part.partNumber);
                partObj.put("ETag", etag);
                completedPartsResult.put(partObj);

                task.listener.onPartComplete(part.partNumber, etag);
            }

            task.listener.onComplete(completedPartsResult);

        } catch (Exception e) {
            if (task.isCancelled) {
                task.listener.onFailure("Upload aborted");
            } else {
                task.listener.onFailure(e.getMessage());
            }
        } finally {
            try {
                if (bis != null) bis.close();
                if (rawInput != null) rawInput.close();
            } catch (Exception ignore) {}
            
            activeUploads.remove(task.filePath);
            if (activeUploads.isEmpty()) {
                stopForeground(true);
                stopSelf();
            }
        }
    }

    private interface ChunkProgressListener {
        void onProgress(int bytesSent);
    }

    private String uploadChunkToS3(String urlString, byte[] buffer, int len, int partNumber, ChunkProgressListener progressListener) throws Exception {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(urlString);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("PUT");
            conn.setDoOutput(true);
            conn.setFixedLengthStreamingMode(len);
            conn.setRequestProperty("Content-Type", ""); // Match standard PUT behavior
            conn.connect();

            try (OutputStream out = conn.getOutputStream()) {
                int offset = 0;
                int writeChunk = 32768; // 32KB write chunks
                while (offset < len) {
                    int writeLen = Math.min(writeChunk, len - offset);
                    out.write(buffer, offset, writeLen);
                    offset += writeLen;
                    progressListener.onProgress(writeLen);
                }
                out.flush();
            }

            int responseCode = conn.getResponseCode();
            if (responseCode >= 200 && responseCode < 300) {
                String etag = conn.getHeaderField("ETag");
                if (etag != null) {
                    // S3 returns etags wrapped in quotes e.g. "etag-value", keep them intact
                    return etag;
                }
                return "";
            } else {
                throw new Exception("S3 chunk upload failed with HTTP response code: " + responseCode);
            }
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private String getFilenameFromPath(String path) {
        if (path == null) return "file";
        int lastSlash = path.lastIndexOf('/');
        if (lastSlash >= 0 && lastSlash < path.length() - 1) {
            return path.substring(lastSlash + 1);
        }
        return path;
    }
}
