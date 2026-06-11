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