package com.motionsewa.drive;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ProgressNotificationPlugin.class);
        registerPlugin(NativeUploadPlugin.class);
        registerPlugin(NativeDownloadPlugin.class);
        registerPlugin(NativeGoogleAuthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
