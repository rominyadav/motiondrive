package com.motionsewa.drive;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.provider.OpenableColumns;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Queue;
import java.util.concurrent.ConcurrentLinkedQueue;

@CapacitorPlugin(name = "NativeUpload")
public class NativeUploadPlugin extends Plugin {
    private UploadForegroundService uploadService;
    private boolean isBound = false;
    private final Queue<UploadRequest> pendingQueue = new ConcurrentLinkedQueue<>();

    private static class UploadRequest {
        final PluginCall call;
        final String filePath;
        final long chunkSize;
        final JSArray parts;

        UploadRequest(PluginCall call, String filePath, long chunkSize, JSArray parts) {
            this.call = call;
            this.filePath = filePath;
            this.chunkSize = chunkSize;
            this.parts = parts;
        }
    }

    private final ServiceConnection serviceConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            UploadForegroundService.LocalBinder binder = (UploadForegroundService.LocalBinder) service;
            uploadService = binder.getService();
            isBound = true;
            processPendingQueue();
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            uploadService = null;
            isBound = false;
        }
    };

    @Override
    public void load() {
        super.load();
        Intent intent = new Intent(getContext(), UploadForegroundService.class);
        getContext().bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE);
    }

    private void processPendingQueue() {
        if (!isBound || uploadService == null) return;
        
        while (!pendingQueue.isEmpty()) {
            UploadRequest req = pendingQueue.poll();
            if (req != null) {
                executeUploadInternal(req.call, req.filePath, req.chunkSize, req.parts);
            }
        }
    }

    @PluginMethod
    public void uploadFile(PluginCall call) {
        String filePath = call.getString("filePath");
        Long chunkSize = call.getLong("chunkSize");
        JSArray parts = call.getArray("parts");

        if (filePath == null || chunkSize == null || parts == null) {
            call.reject("filePath, chunkSize, and parts are required");
            return;
        }

        if (!isBound || uploadService == null) {
            // Queue it up and bind service
            pendingQueue.add(new UploadRequest(call, filePath, chunkSize, parts));
            Intent intent = new Intent(getContext(), UploadForegroundService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }
            getContext().bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE);
        } else {
            // Ensure service is running as foreground
            Intent intent = new Intent(getContext(), UploadForegroundService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }
            executeUploadInternal(call, filePath, chunkSize, parts);
        }
    }

    private void executeUploadInternal(PluginCall call, String filePath, long chunkSize, JSArray partsArray) {
        try {
            // Determine file size
            long totalSize = 0;
            if (filePath.startsWith("content://") || filePath.startsWith("file://")) {
                try (Cursor cursor = getContext().getContentResolver().query(Uri.parse(filePath), null, null, null, null)) {
                    if (cursor != null && cursor.moveToFirst()) {
                        int sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE);
                        if (sizeIndex != -1) {
                            totalSize = cursor.getLong(sizeIndex);
                        }
                    }
                } catch (Exception ignore) {}
            } else {
                File file = new File(filePath);
                if (file.exists()) {
                    totalSize = file.length();
                }
            }

            if (totalSize == 0) {
                call.reject("File does not exist or has size 0");
                return;
            }

            // Map JSArray parts to List<PartInfo>
            List<UploadForegroundService.PartInfo> partsList = new ArrayList<>();
            for (int i = 0; i < partsArray.length(); i++) {
                JSONObject partObj = partsArray.getJSONObject(i);
                int partNumber = partObj.getInt("partNumber");
                String url = partObj.getString("url");
                partsList.add(new UploadForegroundService.PartInfo(partNumber, url));
            }

            uploadService.startUpload(filePath, totalSize, chunkSize, partsList, new UploadForegroundService.UploadProgressListener() {
                @Override
                public void onProgress(long bytesSent, int partNumber) {
                    JSObject progressData = new JSObject();
                    progressData.put("bytesSent", bytesSent);
                    progressData.put("partNumber", partNumber);
                    notifyListeners("progress", progressData);
                }

                @Override
                public void onPartComplete(int partNumber, String etag) {
                    // Optional listener update for chunk success
                }

                @Override
                public void onComplete(JSArray completedParts) {
                    JSObject response = new JSObject();
                    response.put("parts", completedParts);
                    call.resolve(response);
                }

                @Override
                public void onFailure(String error) {
                    call.reject(error);
                }
            });

        } catch (Exception e) {
            call.reject("Failed to parse S3 part parameters: " + e.getMessage());
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (isBound) {
            getContext().unbindService(serviceConnection);
            isBound = false;
        }
        super.handleOnDestroy();
    }
}
