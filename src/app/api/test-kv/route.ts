import { NextResponse } from "next/server";
import { kvCache } from "@/lib/kv-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const testKey = "motiondrive:test_connection";
    const timestamp = new Date().toISOString();

    // 1. Attempt to set a value in Redis with a 60-second expiration
    await kvCache.set(testKey, { status: "success", timestamp }, 60);

    // 2. Retrieve the value
    const retrieved = await kvCache.get<{ status: string; timestamp: string }>(testKey);

    if (retrieved && retrieved.status === "success") {
      return NextResponse.json({
        success: true,
        message: "Successfully connected to Vercel KV Redis!",
        data: retrieved,
      });
    } else {
      return NextResponse.json({
        success: false,
        message: "No connection error thrown, but retrieved data did not match.",
        retrieved,
      }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: "Failed to connect to Vercel KV Redis.",
      error: error.message || error,
    }, { status: 500 });
  }
}
