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


import { getGlobalProjectsVersion, incrementGlobalProjectsVersion, incrementCacheVersion } from './cache';

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
  const session = await requireApprovedUser();
  const userRole = (session.user as any).role;
  const currentUserId = session.user.id;

  // Retrieve the project
  const [proj] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId));

  if (!proj) {
    throw new Error("Project not found");
  }

  // Admin/manager can delete any project. Staff/users can only delete their own.
  if (userRole !== "admin" && userRole !== "manager" && proj.userId !== currentUserId) {
    throw new Error("Forbidden");
  }

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