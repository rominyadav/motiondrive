"use server";

import { db } from "@/db";
import { sharedLinks } from "@/db/schema";
import { requireApprovedUser } from "@/lib/auth-server";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";

export async function createSharedLink(params: {
  assetId?: string | null;
  physicalKey?: string | null;
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
