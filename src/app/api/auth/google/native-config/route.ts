import { NextResponse } from "next/server";

export function GET() {
  // Native Google Sign-In needs the Web OAuth Client ID as serverClientId.
  // Configure GOOGLE_CLIENT_ID in .env, and configure Android package com.motionsewa.drive
  // plus debug/release SHA-1 and SHA-256 fingerprints in Google Cloud Console.
  const serverClientId = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "";

  if (!serverClientId) {
    return NextResponse.json({ error: "Google Web OAuth Client ID is not configured." }, { status: 500 });
  }

  return NextResponse.json({ serverClientId });
}
