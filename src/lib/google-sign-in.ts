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
};

type NativeGoogleAuthPlugin = {
  signIn(options: { serverClientId: string }): Promise<NativeGoogleAuthResult>;
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
  return err?.message || "Failed to sign in with Google.";
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
  const serverClientId = await getNativeGoogleServerClientId();

  if (!serverClientId) {
    throw new Error(
      "Missing Google Web OAuth Client ID. Configure GOOGLE_CLIENT_ID on the backend or NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID for the client."
    );
  }

  const { registerPlugin } = await import("@capacitor/core");
  const NativeGoogleAuth =
    nativeGoogleAuthPlugin ?? (nativeGoogleAuthPlugin = registerPlugin<NativeGoogleAuthPlugin>("NativeGoogleAuth"));

  const nativeResult = await NativeGoogleAuth.signIn({ serverClientId });

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

async function getNativeGoogleServerClientId() {
  if (process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID) {
    return process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  }

  const response = await fetch(`${getAppBaseURL()}/api/auth/google/native-config`, {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    return "";
  }

  const data = (await response.json()) as { serverClientId?: string };
  return data.serverClientId || "";
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
