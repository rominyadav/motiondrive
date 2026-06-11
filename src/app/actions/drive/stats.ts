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


import { getCacheVersion } from './cache';

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

    const used = Number(sizeQuery?.totalSize ?? 0);

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
