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
import { getMimeType } from "./utils";

import { incrementCacheVersion } from './cache';

// ==========================================
// BULK / MULTI-SELECT DRIVE OPERATIONS
// ==========================================

export async function bulkDeleteItems(params: {
  assetIds: string[];
  folderIds: string[];
  isSharedDrive?: boolean;
}) {
  const session = await requireApprovedUser();
  const userRole = (session.user as any).role;
  const currentUserId = session.user.id;

  if (!params.isSharedDrive && userRole !== "admin" && userRole !== "manager") {
    // Verify folders ownership
    if (params.folderIds.length > 0) {
      const ownedFolders = await db
        .select({ id: folders.id })
        .from(folders)
        .where(
          and(
            inArray(folders.id, params.folderIds),
            eq(folders.userId, currentUserId)
          )
        );
      if (ownedFolders.length !== params.folderIds.length) {
        throw new Error("Forbidden: You do not own all selected folders");
      }
    }

    // Verify assets ownership
    if (params.assetIds.length > 0) {
      const ownedAssets = await db
        .select({ id: assets.id })
        .from(assets)
        .where(
          and(
            inArray(assets.id, params.assetIds),
            eq(assets.uploadedBy, currentUserId)
          )
        );
      if (ownedAssets.length !== params.assetIds.length) {
        throw new Error("Forbidden: You do not own all selected files");
      }
    }
  }

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