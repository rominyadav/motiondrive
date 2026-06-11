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
  const session = await requireApprovedUser();
  const userRole = (session.user as any).role;
  const currentUserId = session.user.id;

  const [folder] = await db
    .select()
    .from(folders)
    .where(eq(folders.id, folderId));

  if (!folder) {
    throw new Error("Folder not found");
  }

  if (userRole !== "admin" && userRole !== "manager" && folder.userId !== currentUserId) {
    throw new Error("Forbidden");
  }

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

export async function renameFolder(folderId: string, newName: string) {
  const session = await requireApprovedUser();
  await db
    .update(folders)
    .set({ name: newName })
    .where(eq(folders.id, folderId));

  await incrementCacheVersion(session.user.id);

  return { success: true };
}