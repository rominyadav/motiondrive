"use server";

import { db } from "@/db";
import { sharedLinks, assets, folders } from "@/db/schema";
import { requireApprovedUser } from "@/lib/auth-server";
import { eq, and, desc, isNull } from "drizzle-orm";
import crypto from "crypto";
import { r2Client, R2_BUCKET_NAME, R2_SHARED_BUCKET_NAME } from "@/lib/r2";
import { b2Client, B2_BUCKET_NAME } from "@/lib/b2";
import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function createSharedLink(params: {
  assetId?: string | null;
  physicalKey?: string | null;
  folderId?: string | null;
  physicalPrefix?: string | null;
  physicalBucket?: string | null;
  filename: string;
}) {
  const session = await requireApprovedUser();
  const userId = session.user.id;

  const id = crypto.randomUUID();
  // Links expire after 24 hours by default
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.insert(sharedLinks).values({
    id,
    assetId: params.assetId || null,
    physicalKey: params.physicalKey || null,
    folderId: params.folderId || null,
    physicalPrefix: params.physicalPrefix || null,
    physicalBucket: params.physicalBucket || null,
    filename: params.filename,
    userId,
    expiresAt,
  });

  // Construct absolute dynamic proxy link
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const shareUrl = `${appUrl}/share/${id}`;

  return { success: true, shareUrl, id };
}

export async function listMySharedLinks() {
  const session = await requireApprovedUser();
  const userId = session.user.id;

  // Retrieve shared links created by this user
  const links = await db
    .select()
    .from(sharedLinks)
    .where(eq(sharedLinks.userId, userId))
    .orderBy(desc(sharedLinks.createdAt));

  return links;
}

export async function revokeSharedLink(id: string) {
  const session = await requireApprovedUser();
  const userId = session.user.id;

  // Mark the link as revoked
  await db
    .update(sharedLinks)
    .set({ isRevoked: true })
    .where(and(eq(sharedLinks.id, id), eq(sharedLinks.userId, userId)));

  return { success: true };
}

export async function extendSharedLink(id: string, additionalHours: number) {
  const session = await requireApprovedUser();
  const userId = session.user.id;

  // Fetch the existing link to get its current expiresAt or start from now
  const [link] = await db
    .select()
    .from(sharedLinks)
    .where(and(eq(sharedLinks.id, id), eq(sharedLinks.userId, userId)));

  if (!link) {
    throw new Error("Shared link not found or access denied");
  }

  // Calculate new expiration time
  const currentExpiration = link.expiresAt.getTime();
  const baseTime = currentExpiration > Date.now() ? currentExpiration : Date.now();
  const newExpiration = new Date(baseTime + additionalHours * 60 * 60 * 1000);

  await db
    .update(sharedLinks)
    .set({ 
      expiresAt: newExpiration,
      isRevoked: false // Re-activate if it was marked revoked
    })
    .where(and(eq(sharedLinks.id, id), eq(sharedLinks.userId, userId)));

  return { success: true, newExpiresAt: newExpiration };
}

// ========================================================
// PUBLIC VISITOR ACCESS ACTIONS (NO LOGIN REQUIRED)
// ========================================================

/**
 * Verifies and fetches details for a shared link (whether file or folder)
 */
export async function getPublicSharedFolderDetails(id: string) {
  const [link] = await db
    .select()
    .from(sharedLinks)
    .where(eq(sharedLinks.id, id));

  if (!link) {
    return { success: false, error: "Link not found" };
  }

  const isExpired = new Date() > link.expiresAt;
  if (link.isRevoked || isExpired) {
    return { 
      success: false, 
      error: link.isRevoked ? "Link has been revoked" : "Link has expired",
      filename: link.filename,
      isExpired,
      isRevoked: link.isRevoked
    };
  }

  return {
    success: true,
    id: link.id,
    filename: link.filename,
    isFolder: !!(link.folderId || link.physicalPrefix),
    expiresAt: link.expiresAt,
  };
}

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
    case "pdf": return "application/pdf";
    case "zip": return "application/zip";
    default: return "application/octet-stream";
  }
}

/**
 * Lists the contents of a publicly shared folder
 */
export async function listSharedFolderContents(id: string) {
  const [link] = await db
    .select()
    .from(sharedLinks)
    .where(eq(sharedLinks.id, id));

  if (!link || link.isRevoked || new Date() > link.expiresAt) {
    throw new Error("Shared link is invalid or expired");
  }

  if (link.folderId) {
    // Database folder: fetch all completed assets inside this folder recursively or flat
    const folderAssets = await db
      .select({
        id: assets.id,
        filename: assets.filename,
        size: assets.size,
        mimeType: assets.mimeType,
        uploadedAt: assets.uploadedAt,
      })
      .from(assets)
      .where(and(eq(assets.folderId, link.folderId), eq(assets.status, "completed")))
      .orderBy(assets.filename);

    return { success: true, assets: folderAssets, isR2Physical: false };
  } else if (link.physicalPrefix && link.physicalBucket) {
    // Physical folder: list direct objects under this prefix in R2 or B2
    const client = link.physicalBucket === "shared" ? r2Client : b2Client;
    const bucket = link.physicalBucket === "shared" ? R2_SHARED_BUCKET_NAME : B2_BUCKET_NAME;

    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: link.physicalPrefix,
    });

    const response = await client.send(command);
    const contents = response.Contents || [];

    const physicalAssets = contents
      .filter((obj) => obj.Key !== link.physicalPrefix && !obj.Key?.endsWith("/") && obj.Size !== 0) // Skip directory marker itself
      .map((obj) => {
        const key = obj.Key || "";
        const filename = key.split("/").pop() || key;
        return {
          id: key, // Use key as ID for downloads
          filename,
          size: obj.Size || 0,
          mimeType: getMimeType(filename),
          uploadedAt: obj.LastModified || new Date(),
        };
      });

    return { success: true, assets: physicalAssets, isR2Physical: true };
  }

  return { success: true, assets: [] };
}

/**
 * Generates a short-lived download URL for a file inside a valid shared folder
 */
export async function getSharedFileDownloadUrl(
  sharedLinkId: string,
  fileIdOrKey: string
) {
  const [link] = await db
    .select()
    .from(sharedLinks)
    .where(eq(sharedLinks.id, sharedLinkId));

  if (!link || link.isRevoked || new Date() > link.expiresAt) {
    throw new Error("Shared link is invalid or expired");
  }

  let bucket: string;
  let key: string;
  let filename: string;
  let client: any;

  if (link.folderId) {
    // Secure validation: verify that the asset actually belongs to the shared folder
    const [asset] = await db
      .select()
      .from(assets)
      .where(and(eq(assets.id, fileIdOrKey), eq(assets.folderId, link.folderId)));

    if (!asset || asset.status !== "completed") {
      throw new Error("File not found in this shared folder");
    }

    bucket = R2_BUCKET_NAME;
    key = asset.r2Key;
    filename = asset.filename;
    client = r2Client;
  } else if (link.physicalPrefix && link.physicalBucket) {
    // Secure validation: verify that the requested physical key is a descendant of the physicalPrefix
    if (!fileIdOrKey.startsWith(link.physicalPrefix)) {
      throw new Error("Access denied: File is outside of shared directory");
    }

    bucket = link.physicalBucket === "shared" ? R2_SHARED_BUCKET_NAME : B2_BUCKET_NAME;
    key = fileIdOrKey;
    filename = fileIdOrKey.split("/").pop() || "download";
    client = link.physicalBucket === "shared" ? r2Client : b2Client;
  } else {
    throw new Error("Invalid link configuration");
  }

  // Generate 60 seconds direct temporary download URL
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"`,
  });

  const downloadUrl = await getSignedUrl(client, command, { expiresIn: 60 });
  return { downloadUrl, filename };
}
