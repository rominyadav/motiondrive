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

// ==========================================
// DIRECT R2 SHARED DRIVE ACTIONS (NAS SYNC)
// ==========================================


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