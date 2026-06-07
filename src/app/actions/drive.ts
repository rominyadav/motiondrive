"use server";

import { db } from "@/db";
import { assets, folders, projects, user } from "@/db/schema";
import { requireApprovedUser, requireAdmin } from "@/lib/auth-server";
import { r2Client, R2_BUCKET_NAME, R2_SHARED_BUCKET_NAME } from "@/lib/r2";
import { 
  CreateMultipartUploadCommand, 
  UploadPartCommand, 
  CompleteMultipartUploadCommand, 
  GetObjectCommand, 
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { eq, and, isNull, desc, inArray } from "drizzle-orm";
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

export async function deleteFolder(folderId: string) {
  await requireAdmin();

  // Recursive helper function to find all subfolder IDs
  async function getAllSubfolderIds(fId: string): Promise<string[]> {
    const subfolders = await db
      .select({ id: folders.id })
      .from(folders)
      .where(eq(folders.parentId, fId));

    let ids = subfolders.map((sf) => sf.id);
    for (const subId of ids) {
      const nestedIds = await getAllSubfolderIds(subId);
      ids = ids.concat(nestedIds);
    }
    return ids;
  }

  // Gather all folder IDs to delete (the folder itself and all recursive subfolders)
  const allFolderIds = [folderId, ...(await getAllSubfolderIds(folderId))];

  // Retrieve all files (assets) mapped to any of these folders
  const allAssets = await db
    .select({ id: assets.id, r2Key: assets.r2Key })
    .from(assets)
    .where(inArray(assets.folderId, allFolderIds));

  // Delete all identified files from Cloudflare R2
  for (const asset of allAssets) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: asset.r2Key,
      });
      await r2Client.send(command);
    } catch (error) {
      console.error(`Failed to delete asset ${asset.id} from R2 during folder deletion:`, error);
    }
  }

  // Delete folders from DB
  // assets table uses foreign key with `onDelete: "cascade"`, so its DB records are cleaned up automatically
  await db.delete(folders).where(inArray(folders.id, allFolderIds));

  return { success: true };
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
  isSharedDrive?: boolean;
  prefix?: string | null;
}) {
  const session = await requireApprovedUser();
  const userId = session.user.id;

  const sanitizedFilename = params.filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  
  // Decide Bucket & Key structure
  const bucketName = params.isSharedDrive ? R2_SHARED_BUCKET_NAME : R2_BUCKET_NAME;
  const r2Key = params.isSharedDrive 
    ? `${params.prefix || ""}${sanitizedFilename}`
    : `video-archive/${crypto.randomUUID()}-${sanitizedFilename}`;

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
  const assetId = params.isSharedDrive ? "shared-drive-asset" : crypto.randomUUID();
  if (!params.isSharedDrive) {
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
  await requireApprovedUser();

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
  }

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

// ==========================================
// DIRECT R2 SHARED DRIVE ACTIONS (NAS SYNC)
// ==========================================

function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "mp4": return "video/mp4";
    case "mkv": return "video/x-matroska";
    case "mov": return "video/quicktime";
    case "avi": return "video/x-msvideo";
    case "webm": return "video/webm";
    case "png": return "image/png";
    case "jpg": case "jpeg": return "image/jpeg";
    case "gif": return "image/gif";
    default: return "application/octet-stream";
  }
}

export async function listSharedDriveContents(prefix: string = "") {
  await requireApprovedUser();

  const command = new ListObjectsV2Command({
    Bucket: R2_SHARED_BUCKET_NAME,
    Prefix: prefix,
    Delimiter: "/",
  });

  const response = await r2Client.send(command);

  // Folders are in CommonPrefixes
  const foldersList = (response.CommonPrefixes || []).map((cp) => {
    const fullPath = cp.Prefix || "";
    const parts = fullPath.split("/").filter(Boolean);
    const name = parts[parts.length - 1] || "";
    return {
      id: fullPath,
      name: name,
      isR2Physical: true,
    };
  });

  // Files are in Contents
  const assetsList = (response.Contents || [])
    .filter((obj) => obj.Key !== prefix && obj.Key !== `${prefix}.keep`) // Skip folder placeholders themselves
    .map((obj) => {
      const key = obj.Key || "";
      const parts = key.split("/");
      const filename = parts[parts.length - 1] || "";
      // Skip empty directory marker itself (keys ending with / and size 0)
      if (key.endsWith("/") && obj.Size === 0) return null;
      
      return {
        id: key,
        filename: filename,
        size: obj.Size || 0,
        mimeType: getMimeType(filename),
        uploadedAt: obj.LastModified || new Date(),
        uploadedBy: "NAS / External",
        status: "completed",
        isR2Physical: true,
      };
    })
    .filter((asset): asset is NonNullable<typeof asset> => asset !== null);

  return { folders: foldersList, assets: assetsList };
}

export async function createSharedFolder(prefix: string, name: string) {
  await requireApprovedUser();

  // Standard S3 folder marker is an empty object ending with "/"
  const folderKey = `${prefix}${name}/`;
  const command = new PutObjectCommand({
    Bucket: R2_SHARED_BUCKET_NAME,
    Key: folderKey,
    Body: "",
  });

  await r2Client.send(command);
  return { success: true };
}

export async function deleteSharedAsset(key: string) {
  await requireApprovedUser();

  const command = new DeleteObjectCommand({
    Bucket: R2_SHARED_BUCKET_NAME,
    Key: key,
  });

  await r2Client.send(command);
  return { success: true };
}

export async function deleteSharedFolder(prefix: string) {
  await requireAdmin();

  // List all objects recursively under this folder prefix (without Delimiter)
  const listCommand = new ListObjectsV2Command({
    Bucket: R2_SHARED_BUCKET_NAME,
    Prefix: prefix,
  });

  const response = await r2Client.send(listCommand);
  const objects = response.Contents || [];

  for (const obj of objects) {
    if (obj.Key) {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: R2_SHARED_BUCKET_NAME,
        Key: obj.Key,
      });
      await r2Client.send(deleteCommand);
    }
  }

  return { success: true };
}

export async function getSharedDownloadUrl(key: string) {
  await requireApprovedUser();

  const filename = key.split("/").pop() || "download";
  const command = new GetObjectCommand({
    Bucket: R2_SHARED_BUCKET_NAME,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"`,
  });

  const downloadUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
  return { downloadUrl, filename };
}
