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


import { incrementCacheVersion } from './cache';

// ==========================================
// STORAGE & R2 MULTIPART UPLOAD FLOW
// ==========================================

/**
 * 1. Initiates a Multipart Upload session with Cloudflare R2
 */
export async function initiateMultipartUpload(params: {
  filename: string;
  mimeType: string;
  size: number;
  folderId?: string | null;
  projectId?: string | null;
  isSharedDrive?: boolean;
  prefix?: string | null;
  existingR2Key?: string | null;
  existingAssetId?: string | null;
}) {
  const session = await requireApprovedUser();
  const userId = session.user.id;
  const sanitizedFilename = params.filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  
  // Decide Bucket & Key structure
  const bucketName = params.isSharedDrive ? R2_SHARED_BUCKET_NAME : R2_BUCKET_NAME;
  const r2Key = params.existingR2Key || (params.isSharedDrive 
    ? `${params.prefix || ""}${sanitizedFilename}`
    : `video-archive/${crypto.randomUUID()}-${sanitizedFilename}`);

  // Enforce storage limit check on personal "My Drive" uploads
  if (!params.isSharedDrive) {
    const [userRecord] = await db
      .select({ storageLimit: user.storageLimit })
      .from(user)
      .where(eq(user.id, userId));

    const limit = userRecord?.storageLimit ?? 107374182400; // 100 GB default

    const [sizeQuery] = await db
      .select({ totalSize: sql<number>`COALESCE(SUM(${assets.size}), 0)` })
      .from(assets)
      .where(
        and(
          eq(assets.uploadedBy, userId),
          eq(assets.status, "completed")
        )
      );

    const currentUsed = Number(sizeQuery?.totalSize ?? 0);
    if (currentUsed + params.size > limit) {
      const limitGb = (limit / (1024 * 1024 * 1024)).toFixed(1);
      const usedGb = (currentUsed / (1024 * 1024 * 1024)).toFixed(1);
      const fileGb = (params.size / (1024 * 1024 * 1024)).toFixed(2);
      throw new Error(
        `Storage limit exceeded. You have used ${usedGb} GB of your ${limitGb} GB limit. This file is ${fileGb} GB. Please contact an administrator to request more space.`
      );
    }
  }

  // Initiate multipart with R2
  const command = new CreateMultipartUploadCommand({
    Bucket: bucketName,
    Key: r2Key,
    ContentType: params.mimeType,
  });

  const response = await r2Client.send(command);
  const uploadId = response.UploadId;

  if (!uploadId) {
    throw new Error("Failed to initiate multipart upload with Cloudflare R2.");
  }

  // If it's the Shared Drive, we bypass DB index mapping entirely to let NAS sync purely
  const assetId = params.isSharedDrive 
    ? "shared-drive-asset" 
    : (params.existingAssetId || crypto.randomUUID());

  if (!params.isSharedDrive) {
    if (params.existingAssetId) {
      await db.update(assets)
        .set({
          size: params.size,
          status: "pending",
          uploadedAt: new Date(),
        })
        .where(eq(assets.id, params.existingAssetId));
    } else {
      await db.insert(assets).values({
        id: assetId,
        folderId: params.folderId || null,
        projectId: params.projectId || null,
        r2Key,
        filename: params.filename,
        size: params.size,
        mimeType: params.mimeType,
        uploadedBy: userId,
        status: "pending",
      });
    }
  }

  return { uploadId, r2Key, assetId };
}

/**
 * 2. Generates presigned PUT URLs for specific parts of the multipart upload
 */
export async function getPresignedPartUrls(params: {
  uploadId: string;
  r2Key: string;
  partNumbers: number[];
  isSharedDrive?: boolean;
}) {
  await requireApprovedUser();

  const bucketName = params.isSharedDrive ? R2_SHARED_BUCKET_NAME : R2_BUCKET_NAME;

  const partUrls = await Promise.all(
    params.partNumbers.map(async (partNumber) => {
      const command = new UploadPartCommand({
        Bucket: bucketName,
        Key: params.r2Key,
        UploadId: params.uploadId,
        PartNumber: partNumber,
      });

      const url = await getSignedUrl(r2Client, command, { expiresIn: 3600 }); // 1 Hour expiry
      return { partNumber, url };
    })
  );

  return { partUrls };
}

/**
 * 3. Completes the Multipart Upload with Cloudflare R2 & updates DB status (if personal)
 */
export async function completeMultipartUpload(params: {
  uploadId: string;
  r2Key: string;
  parts: { PartNumber: number; ETag: string }[];
  assetId: string;
  isSharedDrive?: boolean;
}) {
  const session = await requireApprovedUser();

  const bucketName = params.isSharedDrive ? R2_SHARED_BUCKET_NAME : R2_BUCKET_NAME;

  const command = new CompleteMultipartUploadCommand({
    Bucket: bucketName,
    Key: params.r2Key,
    UploadId: params.uploadId,
    MultipartUpload: {
      Parts: params.parts.sort((a, b) => a.PartNumber - b.PartNumber),
    },
  });

  await r2Client.send(command);

  // Skip DB update if Shared Drive (zero-database file explorer)
  if (!params.isSharedDrive) {
    await db
      .update(assets)
      .set({ status: "completed" })
      .where(eq(assets.id, params.assetId));
    await incrementCacheVersion(session.user.id);
  }

  return { success: true };
}

/**
 * 4. Aborts/Cancels an active Multipart Upload with Cloudflare R2 & cleans up DB record (if personal)
 */
export async function abortMultipartUpload(params: {
  uploadId: string;
  r2Key: string;
  assetId: string;
  isSharedDrive?: boolean;
}) {
  const session = await requireApprovedUser();

  const bucketName = params.isSharedDrive ? R2_SHARED_BUCKET_NAME : R2_BUCKET_NAME;

  try {
    const command = new AbortMultipartUploadCommand({
      Bucket: bucketName,
      Key: params.r2Key,
      UploadId: params.uploadId,
    });
    await r2Client.send(command);
  } catch (err) {
    console.error("Failed to abort multipart upload in R2:", err);
  }

  // Delete the pending asset record from DB if it is NOT a Shared Drive upload
  if (!params.isSharedDrive) {
    try {
      await db
        .delete(assets)
        .where(
          and(
            eq(assets.id, params.assetId),
            eq(assets.status, "pending")
          )
        );
      await incrementCacheVersion(session.user.id);
    } catch (err) {
      console.error("Failed to delete pending asset from DB:", err);
    }
  }

  return { success: true };
}