package com.motionsewa.drive;

import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.net.Uri;
import android.os.CancellationSignal;
import android.util.Log;
import androidx.activity.result.ActivityResult;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;
import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "NativeGoogleAuth")
public class NativeGoogleAuthPlugin extends Plugin {
    private static final String TAG = "NativeGoogleAuth";
    private final Executor executor = Executors.newSingleThreadExecutor();
    private CancellationSignal activeCancellationSignal;
    private String activeServerClientId;

    @PluginMethod
    public void signIn(PluginCall call) {
        String serverClientId = call.getString("serverClientId");

        if (serverClientId == null || serverClientId.trim().isEmpty()) {
            call.reject("Missing serverClientId. Use the Google Web OAuth Client ID configured in Google Cloud Console.");
            return;
        }

        activeServerClientId = serverClientId;
        logGoogleConfig(serverClientId);

        getActivity().runOnUiThread(() -> {
            activeCancellationSignal = new CancellationSignal();

            // Configure this Web Client ID in Google Cloud Console. The Android OAuth client
            // must use package com.motionsewa.drive and the app signing SHA-1/SHA-256 fingerprints.
            GetGoogleIdOption googleIdOption = new GetGoogleIdOption.Builder()
                    .setServerClientId(serverClientId)
                    .setFilterByAuthorizedAccounts(false)
                    .setAutoSelectEnabled(false)
                    .build();

            GetCredentialRequest request = new GetCredentialRequest.Builder()
                    .addCredentialOption(googleIdOption)
                    .build();

            CredentialManager credentialManager = CredentialManager.create(getContext());
            credentialManager.getCredentialAsync(
                    getContext(),
                    request,
                    activeCancellationSignal,
                    executor,
                    new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                        @Override
                        public void onResult(GetCredentialResponse result) {
                            activeCancellationSignal = null;
                            handleCredentialResult(call, result);
                        }

                        @Override
                        public void onError(GetCredentialException e) {
                            activeCancellationSignal = null;

                            if (e instanceof GetCredentialCancellationException) {
                                call.reject("Google sign-in was cancelled.", "GOOGLE_SIGN_IN_CANCELLED", e);
                                return;
                            }

                            if (e instanceof NoCredentialException) {
                                launchLegacyGooglePicker(call, serverClientId);
                                return;
                            }

                            call.reject(e.getMessage() != null ? e.getMessage() : "Google sign-in failed.", e);
                        }
                    }
            );
        });
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        if (activeCancellationSignal != null) {
            activeCancellationSignal.cancel();
            activeCancellationSignal = null;
        }
        call.resolve();
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        if (activeCancellationSignal != null) {
            activeCancellationSignal.cancel();
            activeCancellationSignal = null;
        }

        getActivity().runOnUiThread(() -> {
            GoogleSignInOptions signInOptions = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                    .requestEmail()
                    .build();

            GoogleSignInClient client = GoogleSignIn.getClient(getActivity(), signInOptions);
            client.signOut()
                    .addOnSuccessListener(unused -> call.resolve())
                    .addOnFailureListener(error -> call.reject("Failed to sign out from native Google Sign-In.", error));
        });
    }

    private void launchLegacyGooglePicker(PluginCall call, String serverClientId) {
        getActivity().runOnUiThread(() -> {
            // Fallback for devices/emulators where Credential Manager reports no eligible credential.
            // This still uses the native Google account picker and returns an ID token for backend verification.
            GoogleSignInOptions signInOptions = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                    .requestEmail()
                    .requestProfile()
                    .requestIdToken(serverClientId)
                    .build();

            GoogleSignInClient client = GoogleSignIn.getClient(getActivity(), signInOptions);
            Intent signInIntent = client.getSignInIntent();
            startActivityForResult(call, signInIntent, "handleLegacyGoogleSignInResult");
        });
    }

    @ActivityCallback
    private void handleLegacyGoogleSignInResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }

        if (result == null || result.getData() == null) {
            call.reject("Google sign-in was cancelled.", "GOOGLE_SIGN_IN_CANCELLED");
            return;
        }

        Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(result.getData());

        try {
            GoogleSignInAccount account = task.getResult(ApiException.class);
            JSObject ret = new JSObject();
            ret.put("idToken", account.getIdToken());
            ret.put("email", account.getEmail());
            ret.put("displayName", account.getDisplayName());
            ret.put("givenName", account.getGivenName());
            ret.put("familyName", account.getFamilyName());

            Uri photoUrl = account.getPhotoUrl();
            if (photoUrl != null) {
                ret.put("profilePictureUri", photoUrl.toString());
            }

            addDiagnostics(ret);
            call.resolve(ret);
        } catch (ApiException e) {
            if (e.getStatusCode() == 12501) {
                call.reject("Google sign-in was cancelled.", "GOOGLE_SIGN_IN_CANCELLED", e);
                return;
            }

            call.reject(
                    "Google sign-in failed for package " + getContext().getPackageName() +
                            " (" + getBuildType() + "). Check the Android OAuth client package name and SHA-1/SHA-256 fingerprints. Status code: " +
                            e.getStatusCode(),
                    "GOOGLE_ANDROID_CONFIG_ERROR",
                    e
            );
        }
    }

    private void handleCredentialResult(PluginCall call, GetCredentialResponse result) {
        Credential credential = result.getCredential();

        if (!(credential instanceof CustomCredential)) {
            call.reject("Google did not return a compatible credential.");
            return;
        }

        CustomCredential customCredential = (CustomCredential) credential;
        if (!GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(customCredential.getType())) {
            call.reject("Google did not return an ID token credential.");
            return;
        }

        try {
            GoogleIdTokenCredential googleCredential = GoogleIdTokenCredential.createFrom(customCredential.getData());
            JSObject ret = new JSObject();
            ret.put("idToken", googleCredential.getIdToken());
            ret.put("email", googleCredential.getId());
            ret.put("displayName", googleCredential.getDisplayName());
            ret.put("givenName", googleCredential.getGivenName());
            ret.put("familyName", googleCredential.getFamilyName());

            Uri profilePictureUri = googleCredential.getProfilePictureUri();
            if (profilePictureUri != null) {
                ret.put("profilePictureUri", profilePictureUri.toString());
            }

            addDiagnostics(ret);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to parse Google ID token.", e);
        }
    }

    private void addDiagnostics(JSObject ret) {
        ret.put("packageName", getContext().getPackageName());
        ret.put("buildType", getBuildType());
        ret.put("serverClientId", activeServerClientId);
    }

    private void logGoogleConfig(String serverClientId) {
        if (!isDebugBuild()) {
            return;
        }

        Log.d(TAG, "Google Sign-In config: packageName=" + getContext().getPackageName() +
                ", buildType=" + getBuildType() +
                ", serverClientId=" + serverClientId);
    }

    private String getBuildType() {
        return isDebugBuild() ? "debug" : "release";
    }

    private boolean isDebugBuild() {
        return (getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }
}
