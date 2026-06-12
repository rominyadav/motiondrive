import { NextResponse } from "next/server";

const ANDROID_PACKAGE_NAME = "com.motionsewa.drive";

export function GET() {
  // Native Google Sign-In needs the Web OAuth Client ID as serverClientId.
  // Google Cloud Console setup:
  // - Web OAuth client ID: GOOGLE_WEB_CLIENT_ID, used here as serverClientId for backend idToken verification.
  // - Android OAuth client ID: GOOGLE_ANDROID_CLIENT_ID, registered for package com.motionsewa.drive.
  // - Debug fingerprints: ./gradlew signingReport
  // - Release fingerprints: keytool -list -v -keystore path/to/release.keystore -alias your_alias
  // - Google Play App Signing builds may also need the Play Console app-signing SHA-1/SHA-256.
  const serverClientId =
    process.env.GOOGLE_WEB_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    "";
  const androidClientId = process.env.GOOGLE_ANDROID_CLIENT_ID || "";

  if (!serverClientId) {
    return NextResponse.json({ error: "Google Web OAuth Client ID is not configured." }, { status: 500 });
  }

  return NextResponse.json({
    serverClientId,
    androidClientId,
    androidPackageName: ANDROID_PACKAGE_NAME,
  });
}
