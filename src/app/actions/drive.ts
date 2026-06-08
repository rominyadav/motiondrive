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

async function getCacheVersion(userId: string): Promise<string> {
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

async function incrementCacheVersion(userId: string) {
  try {
    const { redis } = await import("@/lib/kv-cache");
    if (redis) {
      await redis.incr(`user:${userId}:drive_version`);
    }
  } catch (err) {
    console.error("[Cache] Failed to increment cache version:", err);
  }
}

async function getGlobalProjectsVersion(): Promise<string> {
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

async function incrementGlobalProjectsVersion() {
  try {
    const { redis } = await import("@/lib/kv-cache");
    if (redis) {
      await redis.incr("global:projects_version");
    }
  } catch (err) {
    console.error("[Cache] Failed to increment global projects version:", err);
  }
}

// ==========================================
// PROJECT MANAGEMENT ACTIONS
// ==========================================

export async function createProject(name: string, clientName?: string, sharedWith?: string) {
  const session = await requireApprovedUser();

  const id = crypto.randomUUID();
  await db.insert(projects).values({
    id,
    name,
    clientName,
    userId: session.user.id,
    sharedWith: sharedWith || "all",
  });

  await incrementGlobalProjectsVersion();
  await incrementCacheVersion(session.user.id);

  return { success: true, id };
}

export async function listProjects() {
  const session = await requireApprovedUser();
  const currentUser = session.user as any;
  const currentUserId = currentUser.id;
  const currentUserRole = currentUser.role;

  const projVersion = await getGlobalProjectsVersion();
  const cacheKey = `user:${currentUserId}:role:${currentUserRole}:projects:v:${projVersion}`;

  const { kvCache } = await import("@/lib/kv-cache");

  return kvCache.getOrSet(cacheKey, async () => {
    // Retrieve all projects from the database
    const allProjects = await db.select().from(projects).orderBy(desc(projects.createdAt));

    // If the user is an admin, they can see ALL projects
    if (currentUserRole === "admin") {
      return allProjects;
    }

    // Otherwise, filter projects based on ownership and sharing permissions
    return allProjects.filter((proj) => {
      // 1. Owner can always see their own projects
      if (proj.userId === currentUserId) return true;

      // 2. Legacy projects without owner are visible to all
      if (!proj.userId) return true;

      // 3. Shared Drive projects (containing 'shared' keyword) are visible to all
      const nameLower = (proj.name || "").toLowerCase();
      const clientLower = (proj.clientName || "").toLowerCase();
      if (nameLower.includes("shared") || clientLower.includes("shared")) return true;

      // 4. Projects shared with "all" are visible to all
      if (proj.sharedWith === "all" || !proj.sharedWith) return true;

      // 5. Projects shared with specific users (comma-separated user IDs)
      const shares = proj.sharedWith.split(",").map((s) => s.trim()).filter(Boolean);
      if (shares.includes(currentUserId)) return true;

      return false;
    });
  }, 3600);
}

export async function listApprovedUsers() {
  await requireApprovedUser();
  return await db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role })
    .from(user)
    .where(eq(user.status, "approved"));
}

export async function renameProject(projectId: string, newName: string, newClientName?: string, sharedWith?: string) {
  const session = await requireApprovedUser();
  await db
    .update(projects)
    .set({ 
      name: newName, 
      clientName: newClientName || null,
      sharedWith: sharedWith || "all"
    })
    .where(eq(projects.id, projectId));

  await incrementGlobalProjectsVersion();
  await incrementCacheVersion(session.user.id);

  return { success: true };
}

export async function deleteProject(projectId: string) {
  const session = await requireAdmin();

  // Retrieve all files (assets) mapped to this project
  const allAssets = await db
    .select({ id: assets.id, r2Key: assets.r2Key })
    .from(assets)
    .where(eq(assets.projectId, projectId));

  // Delete all identified files from Cloudflare R2
  for (const asset of allAssets) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: asset.r2Key,
      });
      await r2Client.send(command);
    } catch (error) {
      console.error(`Failed to delete asset ${asset.id} from R2 during project deletion:`, error);
    }
  }

  // Delete project from DB
  // folders and assets tables use foreign keys with `onDelete: "cascade"`, so they are cleaned up automatically in DB
  await db.delete(projects).where(eq(projects.id, projectId));

  await incrementGlobalProjectsVersion();
  await incrementCacheVersion(session.user.id);

  return { success: true };
}

// ==========================================
// FOLDER MANAGEMENT ACTIONS
// ==========================================

export async function createFolder(name: string, projectId?: string, parentId?: string | null) {
  const session = await requireApprovedUser();
  const userId = session.user.id;

  const id = crypto.randomUUID();
  await db.insert(folders).values({
    id,
    projectId: projectId || null,
    parentId: parentId || null,
    userId: userId, // Record owner for per-user My Drive isolation
    name,
  });

  await incrementCacheVersion(userId);

  return { success: true, id };
}

export async function deleteFolder(folderId: string) {
  const session = await requireAdmin();

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

  await incrementCacheVersion(session.user.id);

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

    const currentUsed = sizeQuery?.totalSize ?? 0;
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

  await incrementCacheVersion(session.user.id);

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

  // Cascade delete any corresponding shared links in DB
  await db.delete(sharedLinks).where(
    and(
      eq(sharedLinks.physicalKey, key),
      eq(sharedLinks.physicalBucket, "shared")
    )
  );

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

      // Cascade delete shared links for nested files
      await db.delete(sharedLinks).where(
        and(
          eq(sharedLinks.physicalKey, obj.Key),
          eq(sharedLinks.physicalBucket, "shared")
        )
      );
    }
  }

  // Cascade delete shared link for the folder itself or any subfolder under it
  await db.delete(sharedLinks).where(
    and(
      or(
        eq(sharedLinks.physicalPrefix, prefix),
        ilike(sharedLinks.physicalPrefix, `${prefix}%`),
        ilike(sharedLinks.physicalKey, `${prefix}%`)
      ),
      eq(sharedLinks.physicalBucket, "shared")
    )
  );

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

export async function listArchiveDriveContents(prefix: string = "") {
  await requireApprovedUser();

  const command = new ListObjectsV2Command({
    Bucket: B2_BUCKET_NAME,
    Prefix: prefix,
    Delimiter: "/",
  });

  const response = await b2Client.send(command);

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

export async function getArchiveDownloadUrl(key: string) {
  await requireApprovedUser();

  const filename = key.split("/").pop() || "download";
  const command = new GetObjectCommand({
    Bucket: B2_BUCKET_NAME,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"`,
  });

  const downloadUrl = await getSignedUrl(b2Client, command, { expiresIn: 3600 });
  return { downloadUrl, filename };
}


// ==========================================
// FILE AND FOLDER RENAMING ACTIONS
// ==========================================

export async function renameAsset(assetId: string, newFilename: string) {
  const session = await requireApprovedUser();
  await db
    .update(assets)
    .set({ filename: newFilename })
    .where(eq(assets.id, assetId));

  await incrementCacheVersion(session.user.id);

  return { success: true };
}

export async function renameFolder(folderId: string, newName: string) {
  const session = await requireApprovedUser();
  await db
    .update(folders)
    .set({ name: newName })
    .where(eq(folders.id, folderId));

  await incrementCacheVersion(session.user.id);

  return { success: true };
}

export async function renameSharedAsset(oldKey: string, newKey: string) {
  await requireApprovedUser();

  const copyCommand = new CopyObjectCommand({
    Bucket: R2_SHARED_BUCKET_NAME,
    CopySource: `${R2_SHARED_BUCKET_NAME}/${encodeURIComponent(oldKey)}`,
    Key: newKey,
  });
  await r2Client.send(copyCommand);

  const deleteCommand = new DeleteObjectCommand({
    Bucket: R2_SHARED_BUCKET_NAME,
    Key: oldKey,
  });
  await r2Client.send(deleteCommand);

  return { success: true };
}

export async function renameSharedFolder(oldPrefix: string, newPrefix: string) {
  await requireApprovedUser();

  // List all objects under the old folder prefix recursively
  const listCommand = new ListObjectsV2Command({
    Bucket: R2_SHARED_BUCKET_NAME,
    Prefix: oldPrefix,
  });

  const response = await r2Client.send(listCommand);
  const objects = response.Contents || [];

  for (const obj of objects) {
    if (obj.Key) {
      const relativePart = obj.Key.substring(oldPrefix.length);
      const targetKey = `${newPrefix}${relativePart}`;

      // Copy to new key
      const copyCommand = new CopyObjectCommand({
        Bucket: R2_SHARED_BUCKET_NAME,
        CopySource: `${R2_SHARED_BUCKET_NAME}/${encodeURIComponent(obj.Key)}`,
        Key: targetKey,
      });
      await r2Client.send(copyCommand);

      // Delete old key
      const deleteCommand = new DeleteObjectCommand({
        Bucket: R2_SHARED_BUCKET_NAME,
        Key: obj.Key,
      });
      await r2Client.send(deleteCommand);
    }
  }

  return { success: true };
}

// ==========================================
// BULK / MULTI-SELECT DRIVE OPERATIONS
// ==========================================

export async function bulkDeleteItems(params: {
  assetIds: string[];
  folderIds: string[];
  isSharedDrive?: boolean;
}) {
  const session = await requireApprovedUser();

  if (params.isSharedDrive) {
    // Shared Drive deletion (direct S3 physical paths)
    // 1. Delete files
    for (const key of params.assetIds) {
      const command = new DeleteObjectCommand({
        Bucket: R2_SHARED_BUCKET_NAME,
        Key: key,
      });
      await r2Client.send(command);

      // Cascade delete shared links
      await db.delete(sharedLinks).where(
        and(
          eq(sharedLinks.physicalKey, key),
          eq(sharedLinks.physicalBucket, "shared")
        )
      );
    }
    // 2. Delete folders recursively (by prefix)
    for (const prefix of params.folderIds) {
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

          // Cascade delete shared links for nested files
          await db.delete(sharedLinks).where(
            and(
              eq(sharedLinks.physicalKey, obj.Key),
              eq(sharedLinks.physicalBucket, "shared")
            )
          );
        }
      }

      // Cascade delete shared link for the folder itself or any subfolder under it
      await db.delete(sharedLinks).where(
        and(
          or(
            eq(sharedLinks.physicalPrefix, prefix),
            ilike(sharedLinks.physicalPrefix, `${prefix}%`),
            ilike(sharedLinks.physicalKey, `${prefix}%`)
          ),
          eq(sharedLinks.physicalBucket, "shared")
        )
      );
    }
    return { success: true };
  }

  // Personal Drive deletion (Database index cascading)
  const allFolderIdsToDelete = [...params.folderIds];

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

  for (const fId of params.folderIds) {
    const nested = await getAllSubfolderIds(fId);
    allFolderIdsToDelete.push(...nested);
  }

  // Remove duplicates
  const uniqueFolderIds = Array.from(new Set(allFolderIdsToDelete));

  // Gather all assets belonging to these folders, plus individual assetIds
  let assetsToDelete: { id: string; r2Key: string }[] = [];

  if (uniqueFolderIds.length > 0) {
    const folderAssets = await db
      .select({ id: assets.id, r2Key: assets.r2Key })
      .from(assets)
      .where(inArray(assets.folderId, uniqueFolderIds));
    assetsToDelete = assetsToDelete.concat(folderAssets);
  }

  if (params.assetIds.length > 0) {
    const individualAssets = await db
      .select({ id: assets.id, r2Key: assets.r2Key })
      .from(assets)
      .where(inArray(assets.id, params.assetIds));
    assetsToDelete = assetsToDelete.concat(individualAssets);
  }

  // Remove duplicate asset records to prevent double R2 deletes
  const seenAssetIds = new Set<string>();
  const uniqueAssetsToDelete = assetsToDelete.filter((item) => {
    if (seenAssetIds.has(item.id)) return false;
    seenAssetIds.add(item.id);
    return true;
  });

  // Delete all identified assets from Cloudflare R2
  for (const asset of uniqueAssetsToDelete) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: asset.r2Key,
      });
      await r2Client.send(command);
    } catch (error) {
      console.error(`Failed to delete asset ${asset.id} from R2 during bulk delete:`, error);
    }
  }

  // Delete from DB: assets records cascade delete automatically with folders,
  // but we delete individual assets explicitly too
  if (params.assetIds.length > 0) {
    await db.delete(assets).where(inArray(assets.id, params.assetIds));
  }
  if (uniqueFolderIds.length > 0) {
    await db.delete(folders).where(inArray(folders.id, uniqueFolderIds));
  }

  await incrementCacheVersion(session.user.id);

  return { success: true };
}

export async function bulkMoveItems(params: {
  assetIds: string[];
  folderIds: string[];
  targetFolderId: string | null;
  targetProjectId?: string | null;
  isSharedDrive?: boolean;
  sourceIsSharedDrive?: boolean;
  targetIsSharedDrive?: boolean;
}) {
  const session = await requireApprovedUser();

  const sourceIsShared = params.sourceIsSharedDrive !== undefined ? params.sourceIsSharedDrive : !!params.isSharedDrive;
  const targetIsShared = params.targetIsSharedDrive !== undefined ? params.targetIsSharedDrive : !!params.isSharedDrive;

  // Check if this is a cross-drive move (moving between personal bucket & shared bucket)
  if (sourceIsShared !== targetIsShared) {
    // Cross-drive moves are implemented via copy then delete to prevent partial failure/corruption
    await bulkCopyItems({
      assetIds: params.assetIds,
      folderIds: params.folderIds,
      targetFolderId: params.targetFolderId,
      targetProjectId: params.targetProjectId,
      sourceIsSharedDrive: sourceIsShared,
      targetIsSharedDrive: targetIsShared,
    });

    // Delete source items
    await bulkDeleteItems({
      assetIds: params.assetIds,
      folderIds: params.folderIds,
      isSharedDrive: sourceIsShared,
    });

    return { success: true };
  }

  // Case 1: Intra-Shared Drive Move
  if (sourceIsShared && targetIsShared) {
    // S3 moving (copy to targetPrefix + name, delete from source)
    const targetPrefix = params.targetFolderId || "";

    // 1. Move files
    for (const key of params.assetIds) {
      const parts = key.split("/");
      const filename = parts[parts.length - 1] || "";
      const targetKey = `${targetPrefix}${filename}`;

      if (key === targetKey) continue;

      const copyCommand = new CopyObjectCommand({
        Bucket: R2_SHARED_BUCKET_NAME,
        CopySource: `${R2_SHARED_BUCKET_NAME}/${encodeURIComponent(key)}`,
        Key: targetKey,
      });
      await r2Client.send(copyCommand);

      const deleteCommand = new DeleteObjectCommand({
        Bucket: R2_SHARED_BUCKET_NAME,
        Key: key,
      });
      await r2Client.send(deleteCommand);
    }

    // 2. Move folders (prefix list, copy, and delete)
    for (const prefix of params.folderIds) {
      const listCommand = new ListObjectsV2Command({
        Bucket: R2_SHARED_BUCKET_NAME,
        Prefix: prefix,
      });
      const response = await r2Client.send(listCommand);
      const objects = response.Contents || [];

      const parts = prefix.split("/").filter(Boolean);
      const folderName = parts[parts.length - 1] || "";
      const newFolderPrefix = `${targetPrefix}${folderName}/`;

      if (prefix === newFolderPrefix) continue;

      for (const obj of objects) {
        if (obj.Key) {
          const relativePart = obj.Key.substring(prefix.length);
          const targetKey = `${newFolderPrefix}${relativePart}`;

          const copyCommand = new CopyObjectCommand({
            Bucket: R2_SHARED_BUCKET_NAME,
            CopySource: `${R2_SHARED_BUCKET_NAME}/${encodeURIComponent(obj.Key)}`,
            Key: targetKey,
          });
          await r2Client.send(copyCommand);

          const deleteCommand = new DeleteObjectCommand({
            Bucket: R2_SHARED_BUCKET_NAME,
            Key: obj.Key,
          });
          await r2Client.send(deleteCommand);
        }
      }
    }
    return { success: true };
  }

  // Case 2: Intra-Personal Drive Move (Update foreign key parent pointers)
  const targetParentId = params.targetFolderId;
  const targetProjId = params.targetProjectId || null;

  // Move files (Assets)
  if (params.assetIds.length > 0) {
    await db
      .update(assets)
      .set({
        folderId: targetParentId,
        projectId: targetProjId,
      })
      .where(inArray(assets.id, params.assetIds));
  }

  // Move folders
  if (params.folderIds.length > 0) {
    await db
      .update(folders)
      .set({
        parentId: targetParentId,
        projectId: targetProjId,
      })
      .where(inArray(folders.id, params.folderIds));

    // Propagate projectId to any subdirectories inside moved folders
    async function updateNestedFoldersProjectId(fId: string, projId: string | null) {
      const subfolders = await db
        .select({ id: folders.id })
        .from(folders)
        .where(eq(folders.parentId, fId));

      for (const sf of subfolders) {
        await db.update(folders).set({ projectId: projId }).where(eq(folders.id, sf.id));
        await db.update(assets).set({ projectId: projId }).where(eq(assets.folderId, sf.id));
        await updateNestedFoldersProjectId(sf.id, projId);
      }
    }

    for (const fId of params.folderIds) {
      await updateNestedFoldersProjectId(fId, targetProjId);
    }
  }

  await incrementCacheVersion(session.user.id);

  return { success: true };
}

export async function bulkCopyItems(params: {
  assetIds: string[];
  folderIds: string[];
  targetFolderId: string | null;
  targetProjectId?: string | null;
  isSharedDrive?: boolean;
  sourceIsSharedDrive?: boolean;
  targetIsSharedDrive?: boolean;
}) {
  const session = await requireApprovedUser();
  const userId = session.user.id;

  const sourceIsShared = params.sourceIsSharedDrive !== undefined ? params.sourceIsSharedDrive : !!params.isSharedDrive;
  const targetIsShared = params.targetIsSharedDrive !== undefined ? params.targetIsSharedDrive : !!params.isSharedDrive;

  // Case 1: Intra-Shared Drive Copy (Shared -> Shared)
  if (sourceIsShared && targetIsShared) {
    const targetPrefix = params.targetFolderId || "";

    // 1. Copy files
    for (const key of params.assetIds) {
      const parts = key.split("/");
      const filename = parts[parts.length - 1] || "";
      const targetKey = `${targetPrefix}${filename}`;

      if (key === targetKey) continue;

      const copyCommand = new CopyObjectCommand({
        Bucket: R2_SHARED_BUCKET_NAME,
        CopySource: `${R2_SHARED_BUCKET_NAME}/${encodeURIComponent(key)}`,
        Key: targetKey,
      });
      await r2Client.send(copyCommand);
    }

    // 2. Copy folders
    for (const prefix of params.folderIds) {
      const listCommand = new ListObjectsV2Command({
        Bucket: R2_SHARED_BUCKET_NAME,
        Prefix: prefix,
      });
      const response = await r2Client.send(listCommand);
      const objects = response.Contents || [];

      const parts = prefix.split("/").filter(Boolean);
      const folderName = parts[parts.length - 1] || "";
      const newFolderPrefix = `${targetPrefix}${folderName}/`;

      if (prefix === newFolderPrefix) continue;

      for (const obj of objects) {
        if (obj.Key) {
          const relativePart = obj.Key.substring(prefix.length);
          const targetKey = `${newFolderPrefix}${relativePart}`;

          const copyCommand = new CopyObjectCommand({
            Bucket: R2_SHARED_BUCKET_NAME,
            CopySource: `${R2_SHARED_BUCKET_NAME}/${encodeURIComponent(obj.Key)}`,
            Key: targetKey,
          });
          await r2Client.send(copyCommand);
        }
      }
    }
    return { success: true };
  }

  // Case 2: Cross-Drive Copy (Personal My Drive -> Shared Drive)
  if (!sourceIsShared && targetIsShared) {
    const targetPrefix = params.targetFolderId || "";

    // Helper to copy a single personal asset to Shared
    const copyAssetPersonalToShared = async (assetId: string, destPrefix: string) => {
      const [asset] = await db.select().from(assets).where(eq(assets.id, assetId));
      if (!asset) return;

      const sanitizedFilename = asset.filename.replace(/[^a-zA-Z0-9.-]/g, "_");
      const targetKey = `${destPrefix}${sanitizedFilename}`;

      const copyCommand = new CopyObjectCommand({
        Bucket: R2_SHARED_BUCKET_NAME,
        CopySource: `${R2_BUCKET_NAME}/${encodeURIComponent(asset.r2Key)}`,
        Key: targetKey,
      });
      await r2Client.send(copyCommand);
    };

    // Helper to recursively copy personal folder to Shared
    const copyFolderPersonalToShared = async (folderId: string, destPrefix: string) => {
      const [folder] = await db.select().from(folders).where(eq(folders.id, folderId));
      if (!folder) return;

      const newPrefix = `${destPrefix}${folder.name}/`;

      // Create physical folder placeholder in Shared Drive
      const putCommand = new PutObjectCommand({
        Bucket: R2_SHARED_BUCKET_NAME,
        Key: newPrefix,
        Body: "",
      });
      await r2Client.send(putCommand);

      // Copy direct files in this virtual folder
      const directAssets = await db.select().from(assets).where(eq(assets.folderId, folderId));
      for (const asset of directAssets) {
        await copyAssetPersonalToShared(asset.id, newPrefix);
      }

      // Copy child folders recursively
      const subfolders = await db.select().from(folders).where(eq(folders.parentId, folderId));
      for (const sub of subfolders) {
        await copyFolderPersonalToShared(sub.id, newPrefix);
      }
    };

    // Copy selected assets
    for (const assetId of params.assetIds) {
      await copyAssetPersonalToShared(assetId, targetPrefix);
    }

    // Copy selected folders
    for (const folderId of params.folderIds) {
      await copyFolderPersonalToShared(folderId, targetPrefix);
    }

    return { success: true };
  }

  // Case 3: Cross-Drive Copy (Shared Drive -> Personal My Drive)
  if (sourceIsShared && !targetIsShared) {
    const targetParentId = params.targetFolderId;
    const targetProjId = params.targetProjectId || null;

    // Helper to copy a single shared asset to Personal
    const copyAssetSharedToPersonal = async (sourceKey: string, destFolderId: string | null) => {
      const parts = sourceKey.split("/");
      const filename = parts[parts.length - 1] || "";
      if (!filename) return;

      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
      const newR2Key = `video-archive/${crypto.randomUUID()}-${sanitizedFilename}`;

      // Copy S3 physical object
      const copyCommand = new CopyObjectCommand({
        Bucket: R2_BUCKET_NAME,
        CopySource: `${R2_SHARED_BUCKET_NAME}/${encodeURIComponent(sourceKey)}`,
        Key: newR2Key,
      });
      await r2Client.send(copyCommand);

      // Fetch metadata
      let size = 0;
      let mimeType = "application/octet-stream";
      try {
        const headResponse = await r2Client.send(new HeadObjectCommand({
          Bucket: R2_SHARED_BUCKET_NAME,
          Key: sourceKey,
        }));
        size = headResponse.ContentLength || 0;
        mimeType = headResponse.ContentType || "application/octet-stream";
      } catch (err) {
        console.error(`Failed to head object metadata for key ${sourceKey}:`, err);
        mimeType = getMimeType(filename);
      }

      // Insert asset into DB
      const newAssetId = crypto.randomUUID();
      await db.insert(assets).values({
        id: newAssetId,
        folderId: destFolderId,
        projectId: targetProjId,
        r2Key: newR2Key,
        filename: filename,
        size: size,
        mimeType: mimeType,
        uploadedBy: userId,
        status: "completed",
      });
    };

    // Helper to recursively copy shared folder to Personal virtual DB folders
    const copyFolderSharedToPersonal = async (sourcePrefix: string, destFolderId: string | null) => {
      const parts = sourcePrefix.split("/").filter(Boolean);
      const folderName = parts[parts.length - 1] || "Shared Folder";

      // Create the top-level virtual folder
      const topVirtualFolderId = crypto.randomUUID();
      await db.insert(folders).values({
        id: topVirtualFolderId,
        parentId: destFolderId,
        projectId: targetProjId,
        userId: userId, // Keep private to the current user in My Drive
        name: folderName,
      });

      // List all objects recursively under the Shared prefix
      const listCommand = new ListObjectsV2Command({
        Bucket: R2_SHARED_BUCKET_NAME,
        Prefix: sourcePrefix,
      });
      const response = await r2Client.send(listCommand);
      const s3Objects = response.Contents || [];

      // Cache mapping physical prefixes to virtual folder IDs
      const folderIdMap = new Map<string, string>();
      folderIdMap.set(sourcePrefix, topVirtualFolderId);

      // Path parser/resolver to get/create virtual folder path dynamically
      const resolveVirtualFolderId = async (physicalPrefix: string): Promise<string> => {
        if (physicalPrefix === sourcePrefix) {
          return topVirtualFolderId;
        }
        if (folderIdMap.has(physicalPrefix)) {
          return folderIdMap.get(physicalPrefix)!;
        }

        const relative = physicalPrefix.substring(sourcePrefix.length);
        const segments = relative.split("/").filter(Boolean);

        let currentParentId: string = topVirtualFolderId;
        let currentPathPrefix = sourcePrefix;

        for (const segment of segments) {
          currentPathPrefix = `${currentPathPrefix}${segment}/`;
          
          if (folderIdMap.has(currentPathPrefix)) {
            currentParentId = folderIdMap.get(currentPathPrefix)!;
          } else {
            const newFolderId = crypto.randomUUID();
            await db.insert(folders).values({
              id: newFolderId,
              parentId: currentParentId,
              projectId: targetProjId,
              userId: userId, // Keep private to the current user in My Drive
              name: segment,
            });
            folderIdMap.set(currentPathPrefix, newFolderId);
            currentParentId = newFolderId;
          }
        }
        return currentParentId;
      };

      // Loop through all recursively listed S3 objects
      for (const obj of s3Objects) {
        if (!obj.Key) continue;

        if (obj.Key.endsWith("/")) {
          // Resolve subfolder placeholder to pre-create directories
          await resolveVirtualFolderId(obj.Key);
        } else {
          // File
          const lastSlash = obj.Key.lastIndexOf("/");
          const filePrefix = lastSlash !== -1 ? obj.Key.substring(0, lastSlash + 1) : sourcePrefix;

          const targetVirtualFolderId = await resolveVirtualFolderId(filePrefix);
          const filename = obj.Key.substring(lastSlash + 1);
          const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
          const newR2Key = `video-archive/${crypto.randomUUID()}-${sanitizedFilename}`;

          // Copy physical R2 object
          const copyCommand = new CopyObjectCommand({
            Bucket: R2_BUCKET_NAME,
            CopySource: `${R2_SHARED_BUCKET_NAME}/${encodeURIComponent(obj.Key)}`,
            Key: newR2Key,
          });
          await r2Client.send(copyCommand);

          const size = obj.Size || 0;
          const mimeType = getMimeType(filename);

          const newAssetId = crypto.randomUUID();
          await db.insert(assets).values({
            id: newAssetId,
            folderId: targetVirtualFolderId,
            projectId: targetProjId,
            r2Key: newR2Key,
            filename: filename,
            size: size,
            mimeType: mimeType,
            uploadedBy: userId,
            status: "completed",
          });
        }
      }
    };

    // Copy selected assets
    for (const assetId of params.assetIds) {
      await copyAssetSharedToPersonal(assetId, targetParentId);
    }

    // Copy selected folders
    for (const folderId of params.folderIds) {
      await copyFolderSharedToPersonal(folderId, targetParentId);
    }

    return { success: true };
  }

  // Case 4: Intra-Personal Drive Copy (Personal -> Personal)
  const targetParentId = params.targetFolderId;
  const targetProjId = params.targetProjectId || null;

  async function copySingleAsset(assetId: string, newFolderId: string | null) {
    const [asset] = await db.select().from(assets).where(eq(assets.id, assetId));
    if (!asset) return;

    const sanitizedFilename = asset.filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    const newR2Key = `video-archive/${crypto.randomUUID()}-${sanitizedFilename}`;

    const copyCommand = new CopyObjectCommand({
      Bucket: R2_BUCKET_NAME,
      CopySource: `${R2_BUCKET_NAME}/${encodeURIComponent(asset.r2Key)}`,
      Key: newR2Key,
    });
    await r2Client.send(copyCommand);

    const newAssetId = crypto.randomUUID();
    await db.insert(assets).values({
      id: newAssetId,
      folderId: newFolderId,
      projectId: targetProjId,
      r2Key: newR2Key,
      filename: asset.filename,
      size: asset.size,
      mimeType: asset.mimeType,
      uploadedBy: asset.uploadedBy,
      status: "completed",
    });
  }

  async function copyFolderRecursive(sourceFolderId: string, destinationParentId: string | null) {
    const [folder] = await db.select().from(folders).where(eq(folders.id, sourceFolderId));
    if (!folder) return;

    const newFolderId = crypto.randomUUID();
    await db.insert(folders).values({
      id: newFolderId,
      parentId: destinationParentId,
      projectId: targetProjId,
      userId: userId, // Keep private to the current user in My Drive
      name: `${folder.name} (Copy)`,
    });

    const directAssets = await db.select().from(assets).where(eq(assets.folderId, sourceFolderId));
    for (const asset of directAssets) {
      await copySingleAsset(asset.id, newFolderId);
    }

    const subfolders = await db.select().from(folders).where(eq(folders.parentId, sourceFolderId));
    for (const sub of subfolders) {
      await copyFolderRecursive(sub.id, newFolderId);
    }
  }

  // Copy assets
  for (const assetId of params.assetIds) {
    await copySingleAsset(assetId, targetParentId);
  }

  // Copy folders
  for (const folderId of params.folderIds) {
    await copyFolderRecursive(folderId, targetParentId);
  }

  await incrementCacheVersion(session.user.id);

  return { success: true };
}

/**
 * Calculates current used space, total allowed limit, and remaining bytes for personal drive
 */
export async function getUserStorageStats() {
  const session = await requireApprovedUser();
  const userId = session.user.id;

  const version = await getCacheVersion(userId);
  const cacheKey = `user:${userId}:storage_stats:v:${version}`;

  const { kvCache } = await import("@/lib/kv-cache");

  return kvCache.getOrSet(cacheKey, async () => {
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

    const used = sizeQuery?.totalSize ?? 0;

    return {
      used,
      limit,
      available: Math.max(0, limit - used),
    };
  }, 3600);
}

/**
 * Calculates in-depth personal usage metrics including folder counts, projects created, and per-project storage footprints.
 */
export async function getUserDetailedUsageStats() {
  const session = await requireApprovedUser();
  const userId = session.user.id;

  const version = await getCacheVersion(userId);
  const cacheKey = `user:${userId}:detailed_usage_stats:v:${version}`;

  const { kvCache } = await import("@/lib/kv-cache");

  return kvCache.getOrSet(cacheKey, async () => {
    const [userRecord] = await db
      .select({ storageLimit: user.storageLimit })
      .from(user)
      .where(eq(user.id, userId));

    const limit = userRecord?.storageLimit ?? 107374182400; // 100 GB default

    // Fetch all user's completed assets
    const userAssets = await db
      .select({
        id: assets.id,
        size: assets.size,
        projectId: assets.projectId,
        folderId: assets.folderId,
      })
      .from(assets)
      .where(
        and(
          eq(assets.uploadedBy, userId),
          eq(assets.status, "completed")
        )
      );

    const used = userAssets.reduce((sum, asset) => sum + asset.size, 0);
    const totalFiles = userAssets.length;

    // Count user-owned folders
    const userFolders = await db
      .select()
      .from(folders)
      .where(eq(folders.userId, userId));
    const totalFolders = userFolders.length;

    // Count user-created projects
    const userProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId));
    const totalProjects = userProjects.length;

    // Aggregate assets size and counts by projectId
    const projectStatsMap: Record<string, { size: number; count: number }> = {};
    for (const asset of userAssets) {
      if (asset.projectId) {
        if (!projectStatsMap[asset.projectId]) {
          projectStatsMap[asset.projectId] = { size: 0, count: 0 };
        }
        projectStatsMap[asset.projectId].size += asset.size;
        projectStatsMap[asset.projectId].count += 1;
      }
    }

    const projectBreakdown = userProjects.map((proj) => {
      const stats = projectStatsMap[proj.id] || { size: 0, count: 0 };
      return {
        id: proj.id,
        name: proj.name,
        clientName: proj.clientName,
        sizeUsed: stats.size,
        filesCount: stats.count,
      };
    });

    return {
      used,
      limit,
      available: Math.max(0, limit - used),
      totalFiles,
      totalFolders,
      totalProjects,
      projectBreakdown,
    };
  }, 3600);
}
