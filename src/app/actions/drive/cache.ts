"use server";

import { db } from "@/db";
import { assets, folders, projects, user, sharedLinks } from "@/db/schema";
import { requireApprovedUser, requireAdmin } from "@/lib/auth-server";
import { r2Client, R2_BUCKET_NAME, R2_SHARED_BUCKET_NAME } from "@/lib/r2";
import { b2Client, B2_BUCKET_NAME } from "@/lib/b2";
import { 
  CreateMultipartUploadCommand, 
  UploadPartCommand, 
  CompleteMultipartUploadCommand, 
  AbortMultipartUploadCommand,
  GetObjectCommand, 
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { eq, and, or, isNull, desc, inArray, sql, ilike } from "drizzle-orm";
import crypto from "crypto";


// ==========================================
// REDIS CACHE VERSIONING HELPERS
// ==========================================

export async function getCacheVersion(userId: string): Promise<string> {
  try {
    const { redis } = await import("@/lib/kv-cache");
    if (redis) {
      const version = await redis.get(`user:${userId}:drive_version`);
      if (version) return version;
      await redis.set(`user:${userId}:drive_version`, "1");
      return "1";
    }
  } catch (err) {
    console.error("[Cache] Failed to get cache version:", err);
  }
  return "1";
}

export async function incrementCacheVersion(userId: string) {
  try {
    const { redis } = await import("@/lib/kv-cache");
    if (redis) {
      await redis.incr(`user:${userId}:drive_version`);
    }
  } catch (err) {
    console.error("[Cache] Failed to increment cache version:", err);
  }
}

export async function getGlobalProjectsVersion(): Promise<string> {
  try {
    const { redis } = await import("@/lib/kv-cache");
    if (redis) {
      const version = await redis.get("global:projects_version");
      if (version) return version;
      await redis.set("global:projects_version", "1");
      return "1";
    }
  } catch (err) {
    console.error("[Cache] Failed to get global projects version:", err);
  }
  return "1";
}

export async function incrementGlobalProjectsVersion() {
  try {
    const { redis } = await import("@/lib/kv-cache");
    if (redis) {
      await redis.incr("global:projects_version");
    }
  } catch (err) {
    console.error("[Cache] Failed to increment global projects version:", err);
  }
}