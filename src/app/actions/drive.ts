"use server";

import { db } from "@/db";
import { assets, folders, projects, user } from "@/db/schema";
import { requireApprovedUser } from "@/lib/auth-server";
import { r2Client, R2_BUCKET_NAME } from "@/lib/r2";
import { 
  CreateMultipartUploadCommand, 
  UploadPartCommand, 
  CompleteMultipartUploadCommand, 
  GetObjectCommand, 
  DeleteObjectCommand 
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { eq, and, isNull, desc } from "drizzle-orm";
import crypto from "crypto";

// ==========================================
// PROJECT MANAGEMENT ACTIONS
// ==========================================

export async function createProject(name: string, clientName?: string) {
  const session = await requireApprovedUser();

  const id = crypto.randomUUID();
  await db.insert(projects).values({
    id,
    name,
    clientName,
  });

  return { success: true, id };
}

export async function listProjects() {
  await requireApprovedUser();
  return await db.select().from(projects).orderBy(desc(projects.createdAt));
}

// ==========================================
// FOLDER MANAGEMENT ACTIONS
// ==========================================

export async function createFolder(name: string, projectId?: string, parentId?: string | null) {
  await requireApprovedUser();

  const id = crypto.randomUUID();
  await db.insert(folders).values({
    id,
    projectId: projectId || null,
    parentId: parentId || null,
    name,
  });

  return { success: true, id };
}

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
}) {
  const session = await requireApprovedUser();
  const userId = session.user.id;

  // Create a clean key path
  const uuid = crypto.randomUUID();
  const sanitizedFilename = params.filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  const r2Key = `video-archive/${uuid}-${sanitizedFilename}`;

  // Initiate multipart with R2
  const command = new CreateMultipartUploadCommand({
    Bucket: R2_BUCKET_NAME,
    Key: r2Key,
    ContentType: params.mimeType,
  });

  const response = await r2Client.send(command);
  const uploadId = response.UploadId;

  if (!uploadId) {
    throw new Error("Failed to initiate multipart upload with Cloudflare R2.");
  }

  // Insert pending metadata in database
  const assetId = crypto.randomUUID();
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

  return { uploadId, r2Key, assetId };
}

/**
 * 2. Generates presigned PUT URLs for specific parts of the multipart upload
 */
export async function getPresignedPartUrls(params: {
  uploadId: string;
  r2Key: string;
  partNumbers: number[];
}) {
  await requireApprovedUser();

  const partUrls = await Promise.all(
    params.partNumbers.map(async (partNumber) => {
      const command = new UploadPartCommand({
        Bucket: R2_BUCKET_NAME,
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
 * 3. Completes the Multipart Upload with Cloudflare R2 & updates DB status
 */
export async function completeMultipartUpload(params: {
  uploadId: string;
  r2Key: string;
  parts: { PartNumber: number; ETag: string }[];
  assetId: string;
}) {
  await requireApprovedUser();

  const command = new CompleteMultipartUploadCommand({
    Bucket: R2_BUCKET_NAME,
    Key: params.r2Key,
    UploadId: params.uploadId,
    MultipartUpload: {
      Parts: params.parts.sort((a, b) => a.PartNumber - b.PartNumber),
    },
  });

  await r2Client.send(command);

  // Update status in DB to completed
  await db
    .update(assets)
    .set({ status: "completed" })
    .where(eq(assets.id, params.assetId));

  return { success: true };
}

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
  await requireApprovedUser();

  // Retrieve folders in this current view
  const currentFolders = await db
    .select()
    .from(folders)
    .where(
      and(
        params.projectId ? eq(folders.projectId, params.projectId) : isNull(folders.projectId),
        params.folderId ? eq(folders.parentId, params.folderId) : isNull(folders.parentId)
      )
    );

  // Retrieve completed files in this current view
  const currentAssets = await db
    .select({
      id: assets.id,
      filename: assets.filename,
      size: assets.size,
      mimeType: assets.mimeType,
      uploadedAt: assets.uploadedAt,
      uploadedBy: user.name,
      status: assets.status,
    })
    .from(assets)
    .leftJoin(user, eq(assets.uploadedBy, user.id))
    .where(
      and(
        params.projectId ? eq(assets.projectId, params.projectId) : isNull(assets.projectId),
        params.folderId ? eq(assets.folderId, params.folderId) : isNull(assets.folderId),
        eq(assets.status, "completed")
      )
    )
    .orderBy(desc(assets.uploadedAt));

  return { folders: currentFolders, assets: currentAssets };
}

export async function deleteAsset(assetId: string) {
  await requireApprovedUser();

  // Find asset key
  const [asset] = await db
    .select()
    .from(assets)
    .where(eq(assets.id, assetId));

  if (!asset) {
    throw new Error("Asset not found");
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

  return { success: true };
}
