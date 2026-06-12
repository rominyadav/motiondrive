"use client";

import { authClient } from "@/lib/auth-client";
import { isCapacitorApp } from "@/lib/platform";

type NativeGoogleAuthResult = {
  idToken?: string;
  email?: string;
  displayName?: string;
  givenName?: string;
  familyName?: string;
  profilePictureUri?: string;
  packageName?: string;
  buildType?: string;
  serverClientId?: string;
};

type NativeGoogleAuthPlugin = {
  signIn(options: { serverClientId: string }): Promise<NativeGoogleAuthResult>;
  signOut(): Promise<void>;
  cancel(): Promise<void>;
};

export type GoogleSignInOptions = {
  callbackURL?: string;
  requestSignUp?: boolean;
};

export type GoogleSignInResult = {
  completedInApp: boolean;
};

const GOOGLE_CANCEL_CODES = new Set([
  "GOOGLE_SIGN_IN_CANCELLED",
  "Google sign-in was cancelled.",
  "androidx.credentials.exceptions.GetCredentialCancellationException",
]);

let nativeGoogleAuthPlugin: NativeGoogleAuthPlugin | null = null;

export function isGoogleSignInCancelled(error: unknown) {
  const err = error as { code?: string; message?: string };
  return GOOGLE_CANCEL_CODES.has(err?.code || "") || GOOGLE_CANCEL_CODES.has(err?.message || "");
}

export function getGoogleSignInErrorMessage(error: unknown) {
  if (isGoogleSignInCancelled(error)) {
    return "Google sign-in was cancelled.";
  }

  const err = error as { message?: string };
  const message = err?.message || "Failed to sign in with Google.";

  if (
    message.includes("DEVELOPER_ERROR") ||
    message.includes("12500") ||
    message.includes("package name") ||
    message.includes("fingerprint")
  ) {
    return (
      "Google sign-in is not configured for this Android build. Check that Google Cloud Console has an Android OAuth " +
      "client for package com.motionsewa.drive with this build's SHA-1 and SHA-256 fingerprints."
    );
  }

  return message;
}

export async function signInWithGoogle(options: GoogleSignInOptions = {}): Promise<GoogleSignInResult> {
  if (isCapacitorApp()) {
    return signInWithNativeGoogle(options);
  }

  await authClient.signIn.social({
    provider: "google",
    callbackURL: options.callbackURL || "/",
    requestSignUp: options.requestSignUp,
  });

  return { completedInApp: false };
}

async function signInWithNativeGoogle(options: GoogleSignInOptions): Promise<GoogleSignInResult> {
  const nativeConfig = await getNativeGoogleConfig();
  const serverClientId = nativeConfig.serverClientId;

  if (!serverClientId) {
    throw new Error(
      "Missing Google Web OAuth Client ID. Configure GOOGLE_CLIENT_ID on the backend or NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID for the client."
    );
  }

  const { registerPlugin } = await import("@capacitor/core");
  const NativeGoogleAuth =
    nativeGoogleAuthPlugin ?? (nativeGoogleAuthPlugin = registerPlugin<NativeGoogleAuthPlugin>("NativeGoogleAuth"));

  const nativeResult = await NativeGoogleAuth.signIn({ serverClientId });

  if (process.env.NODE_ENV !== "production") {
    console.info("[GoogleSignIn] Native Android config", {
      expectedPackageName: nativeConfig.androidPackageName,
      packageName: nativeResult.packageName,
      buildType: nativeResult.buildType,
      serverClientId: nativeResult.serverClientId || serverClientId,
      androidClientId: nativeConfig.androidClientId,
    });
  }

  if (!nativeResult.idToken) {
    throw new Error("Google did not return an ID token.");
  }

  const authResult = await authClient.signIn.social({
    provider: "google",
    callbackURL: options.callbackURL || "/",
    disableRedirect: true,
    requestSignUp: options.requestSignUp,
    idToken: {
      token: nativeResult.idToken,
    },
  });

  if (authResult?.error) {
    throw new Error(authResult.error.message || "Google token verification failed.");
  }

  return { completedInApp: true };
}

export async function signOutFromNativeGoogle() {
  if (!isCapacitorApp()) {
    return;
  }

  const { registerPlugin } = await import("@capacitor/core");
  const NativeGoogleAuth =
    nativeGoogleAuthPlugin ?? (nativeGoogleAuthPlugin = registerPlugin<NativeGoogleAuthPlugin>("NativeGoogleAuth"));

  await NativeGoogleAuth.signOut();
}

async function getNativeGoogleConfig() {
  const response = await fetch(`${getAppBaseURL()}/api/auth/google/native-config`, {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    return { serverClientId: "", androidClientId: "", androidPackageName: "com.motionsewa.drive" };
  }

  const data = (await response.json()) as {
    serverClientId?: string;
    androidClientId?: string;
    androidPackageName?: string;
  };
  return {
    serverClientId: data.serverClientId || "",
    androidClientId: data.androidClientId || "",
    androidPackageName: data.androidPackageName || "com.motionsewa.drive",
  };
}

function getAppBaseURL() {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_APP_URL || "";
  }

  const origin = window.location.origin;
  if (origin.startsWith("capacitor://")) {
    return process.env.NEXT_PUBLIC_APP_URL || origin;
  }

  return origin;
}
