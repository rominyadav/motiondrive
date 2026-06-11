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


import { getCacheVersion, incrementCacheVersion } from './cache';

// ==========================================
// DOWNLOAD / GET ACTION
// ==========================================

/**
 * Generates a high-speed secure download link for an asset
 */
export async function getDownloadUrl(assetId: string) {
  await requireApprovedUser();

  const [asset] = await db
    .select()
    .from(assets)
    .where(eq(assets.id, assetId));

  if (!asset) {
    throw new Error("Asset not found");
  }

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: asset.r2Key,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(asset.filename)}"`,
  });

  const downloadUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 }); // 1 Hour expiry

  return { downloadUrl, filename: asset.filename };
}

// ==========================================
// FILE EXPLORATION & MANAGEMENT
// ==========================================

export async function listDriveContents(params: {
  projectId?: string | null;
  folderId?: string | null;
}) {
  const session = await requireApprovedUser();
  const currentUserId = session.user.id;

  const version = await getCacheVersion(currentUserId);
  const cacheKey = `user:${currentUserId}:drive:v:${version}:proj:${params.projectId || "root"}:fold:${params.folderId || "root"}`;

  const { kvCache } = await import("@/lib/kv-cache");

  return kvCache.getOrSet(cacheKey, async () => {
    // Retrieve folders in this current view
    const folderConditions = [
      params.projectId ? eq(folders.projectId, params.projectId) : isNull(folders.projectId),
      params.folderId ? eq(folders.parentId, params.folderId) : isNull(folders.parentId),
    ];
    if (!params.projectId) {
      const folderOr = or(eq(folders.userId, currentUserId), isNull(folders.userId));
      if (folderOr) {
        folderConditions.push(folderOr);
      }
    }

    const currentFolders = await db
      .select()
      .from(folders)
      .where(and(...folderConditions));

    // Retrieve completed files in this current view
    const assetConditions = [
      params.projectId ? eq(assets.projectId, params.projectId) : isNull(assets.projectId),
      params.folderId ? eq(assets.folderId, params.folderId) : isNull(assets.folderId),
      eq(assets.status, "completed"),
    ];
    if (!params.projectId) {
      const assetOr = or(eq(assets.uploadedBy, currentUserId), isNull(assets.uploadedBy));
      if (assetOr) {
        assetConditions.push(assetOr);
      }
    }

    const currentAssets = await db
       .select({
         id: assets.id,
         filename: assets.filename,
         size: assets.size,
         mimeType: assets.mimeType,
         uploadedAt: assets.uploadedAt,
         uploadedBy: user.name,
         uploadedById: assets.uploadedBy,
         status: assets.status,
       })
      .from(assets)
      .leftJoin(user, eq(assets.uploadedBy, user.id))
      .where(and(...assetConditions))
      .orderBy(desc(assets.uploadedAt));

    return { folders: currentFolders, assets: currentAssets };
  }, 3600);
}

export async function deleteAsset(assetId: string) {
  const session = await requireApprovedUser();
  const userRole = (session.user as any).role;
  const currentUserId = session.user.id;

  // Find asset key
  const [asset] = await db
    .select()
    .from(assets)
    .where(eq(assets.id, assetId));

  if (!asset) {
    throw new Error("Asset not found");
  }

  if (userRole !== "admin" && userRole !== "manager" && asset.uploadedBy !== currentUserId) {
    throw new Error("Forbidden");
  }

  // Delete from R2 S3 bucket
  try {
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: asset.r2Key,
    });
    await r2Client.send(command);
  } catch (error) {
    console.error("Failed to delete asset from R2", error);
  }

  // Delete from DB index
  await db.delete(assets).where(eq(assets.id, assetId));

  await incrementCacheVersion(session.user.id);

  return { success: true };
}

export async function renameAsset(assetId: string, newFilename: string) {
  const session = await requireApprovedUser();
  await db
    .update(assets)
    .set({ filename: newFilename })
    .where(eq(assets.id, assetId));

  await incrementCacheVersion(session.user.id);

  return { success: true };
}