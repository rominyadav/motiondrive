"use server";

import { db } from "@/db";
import { invitations, user, sharedLinks, assets } from "@/db/schema";
import { requireAdmin, getSession } from "@/lib/auth-server";
import { eq, desc } from "drizzle-orm";
import { resend } from "@/lib/resend";
import { r2Client, R2_SHARED_BUCKET_NAME } from "@/lib/r2";
import { b2Client, B2_BUCKET_NAME } from "@/lib/b2";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import crypto from "crypto";

/**
 * Invites a new staff member or admin via email.
 */
export async function inviteUser(email: string, role: "admin" | "manager" | "staff" = "staff") {
  await requireAdmin();

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days expiration

  // Store in database, overwriting any previous invites for this email
  await db
    .insert(invitations)
    .values({
      id: crypto.randomUUID(),
      email: email.toLowerCase(),
      role,
      token,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: invitations.email,
      set: { role, token, expiresAt, createdAt: new Date() },
    });

  // Construct invite link
  const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/signup?token=${token}`;

  // Send email if Resend is configured, otherwise log the link
  if (resend) {
    try {
      const { data, error } = await resend.emails.send({
        from: process.env.FROM_EMAIL || "Motionsewa Drive <onboarding@resend.dev>",
        to: email.toLowerCase(),
        subject: "Invitation to join Motionsewa Web Drive",
        html: `
          <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 12px; background: #fafafa;">
            <h2 style="color: #111; margin-top: 0;">You've been invited!</h2>
            <p style="color: #444; font-size: 16px; line-height: 1.5;">
              You have been invited to join the <strong>Motionsewa Web Drive</strong> as a <strong>${role}</strong>.
            </p>
            <div style="margin: 24px 0;">
              <a href="${inviteLink}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Accept Invitation
              </a>
            </div>
            <p style="color: #666; font-size: 12px;">
              Or copy and paste this link in your browser:<br/>
              <a href="${inviteLink}" style="color: #0066cc;">${inviteLink}</a>
            </p>
            <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 20px 0;"/>
            <p style="color: #999; font-size: 12px; text-align: center;">
              This invitation will expire in 7 days.
            </p>
          </div>
        `,
      });

      if (error) {
        console.error("[Resend Error Payload]:", error);
        throw new Error(error.message || "Resend returned an API error");
      }

      console.log(`[Resend Success]: Invitation successfully sent to ${email}. Message ID: ${data?.id}`);
    } catch (error: any) {
      console.error("Failed to send email via Resend", error);
      throw new Error(error.message || "Failed to send email via Resend");
    }
  } else {
    console.log("\n========================================");
    console.log(`[LOCAL DEV] RESEND NOT CONFIGURED`);
    console.log(`Email Invitation to: ${email}`);
    console.log(`Invite link: ${inviteLink}`);
    console.log("========================================\n");
  }

  return { success: true, inviteLink };
}

/**
 * Updates user approval or roles (Admin-only).
 */
export async function updateUserStatus(userId: string, status: "approved" | "pending" | "suspended") {
  await requireAdmin();

  await db
    .update(user)
    .set({ status })
    .where(eq(user.id, userId));

  return { success: true };
}

/**
 * Lists all registered users.
 */
export async function listUsers() {
  await requireAdmin();

  return await db
    .select()
    .from(user)
    .orderBy(desc(user.createdAt));
}

/**
 * Lists all invitations.
 */
export async function listInvitations() {
  await requireAdmin();

  return await db
    .select()
    .from(invitations)
    .orderBy(desc(invitations.createdAt));
}

/**
 * Revokes / deletes a pending invitation.
 */
export async function revokeInvitation(invitationId: string) {
  await requireAdmin();

  await db
    .delete(invitations)
    .where(eq(invitations.id, invitationId));

  return { success: true };
}

/**
 * Updates a user's personal storage limit (Admin-only).
 */
export async function updateUserStorageLimit(userId: string, limitBytes: number) {
  await requireAdmin();

  await db
    .update(user)
    .set({ storageLimit: limitBytes })
    .where(eq(user.id, userId));

  return { success: true };
}

/**
 * Updates a user's role (Strictly Admin-only, Managers are forbidden).
 */
export async function updateUserRole(userId: string, role: "admin" | "manager" | "staff") {
  const session = await getSession();

  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }

  const currentUser = session.user as any;
  if (currentUser.role !== "admin") {
    throw new Error("Forbidden: Only administrators can modify user roles.");
  }

  await db
    .update(user)
    .set({ role })
    .where(eq(user.id, userId));

  return { success: true };
}

/**
 * Lists all shared links on the platform (Admin-only).
 */
export async function listAllSharedLinks() {
  const session = await getSession();
  if (!session || !session.user || (session.user as any).role !== "admin") {
    throw new Error("Forbidden");
  }

  return await db
    .select()
    .from(sharedLinks)
    .orderBy(desc(sharedLinks.createdAt));
}

/**
 * Revokes a shared link (Admin-only).
 */
export async function adminRevokeSharedLink(id: string) {
  const session = await getSession();
  if (!session || !session.user || (session.user as any).role !== "admin") {
    throw new Error("Forbidden");
  }

  await db
    .update(sharedLinks)
    .set({ isRevoked: true })
    .where(eq(sharedLinks.id, id));

  return { success: true };
}

/**
 * Extends a shared link by additional hours (Admin-only).
 */
export async function adminExtendSharedLink(id: string, additionalHours: number) {
  const session = await getSession();
  if (!session || !session.user || (session.user as any).role !== "admin") {
    throw new Error("Forbidden");
  }

  const [link] = await db
    .select()
    .from(sharedLinks)
    .where(eq(sharedLinks.id, id));

  if (!link) {
    throw new Error("Shared link not found");
  }

  const currentExpiration = link.expiresAt.getTime();
  const baseTime = currentExpiration > Date.now() ? currentExpiration : Date.now();
  const newExpiration = new Date(baseTime + additionalHours * 60 * 60 * 1000);

  await db
    .update(sharedLinks)
    .set({ 
      expiresAt: newExpiration,
      isRevoked: false 
    })
    .where(eq(sharedLinks.id, id));

  return { success: true, newExpiresAt: newExpiration };
}

/**
 * Helper to fetch all items recursively in an S3/R2/B2 bucket and sum their size and count.
 */
async function getBucketUsage(client: any, bucketName: string) {
  let totalSize = 0;
  let totalItems = 0;
  let continuationToken: string | undefined = undefined;

  try {
    do {
      const command: ListObjectsV2Command = new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
      });
      const response = await client.send(command);
      const contents = response.Contents || [];
      
      for (const item of contents) {
        // Skip directory placeholder files
        if (item.Key && !item.Key.endsWith("/")) {
          totalSize += item.Size || 0;
          totalItems++;
        }
      }
      
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);
  } catch (error) {
    console.error(`Failed to get usage for bucket ${bucketName}:`, error);
  }

  return { totalSize, totalItems };
}

export interface UserUsage {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  storageLimit: number;
  sizeUsed: number;
  itemsCount: number;
}

export interface PlatformUsageStats {
  personal: {
    totalSize: number;
    totalItems: number;
    perUser: UserUsage[];
  };
  shared: {
    totalSize: number;
    totalItems: number;
  };
  archive: {
    totalSize: number;
    totalItems: number;
  };
}

/**
 * Fetches platform-wide storage usage stats across Personal, Shared, and Archive drives.
 */
export async function getPlatformUsageStats(): Promise<PlatformUsageStats> {
  await requireAdmin();

  // 1. Personal Drive (DB tracked assets in completed status)
  const completedAssets = await db
    .select({
      id: assets.id,
      size: assets.size,
      uploadedBy: assets.uploadedBy,
    })
    .from(assets)
    .where(eq(assets.status, "completed"));

  let personalTotalSize = 0;
  let personalTotalItems = 0;
  const userUsageMap: Record<string, { size: number; items: number }> = {};

  for (const asset of completedAssets) {
    personalTotalSize += asset.size;
    personalTotalItems++;

    if (asset.uploadedBy) {
      if (!userUsageMap[asset.uploadedBy]) {
        userUsageMap[asset.uploadedBy] = { size: 0, items: 0 };
      }
      userUsageMap[asset.uploadedBy].size += asset.size;
      userUsageMap[asset.uploadedBy].items += 1;
    }
  }

  const allUsers = await db.select().from(user);
  const perUserUsage: UserUsage[] = allUsers.map((u) => {
    const usage = userUsageMap[u.id] || { size: 0, items: 0 };
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      storageLimit: u.storageLimit,
      sizeUsed: usage.size,
      itemsCount: usage.items,
    };
  });

  // 2. Shared Drive Usage (R2 Bucket direct)
  const sharedUsage = await getBucketUsage(r2Client, R2_SHARED_BUCKET_NAME);

  // 3. Archive Drive Usage (B2 Bucket direct)
  const archiveUsage = await getBucketUsage(b2Client, B2_BUCKET_NAME);

  return {
    personal: {
      totalSize: personalTotalSize,
      totalItems: personalTotalItems,
      perUser: perUserUsage,
    },
    shared: {
      totalSize: sharedUsage.totalSize,
      totalItems: sharedUsage.totalItems,
    },
    archive: {
      totalSize: archiveUsage.totalSize,
      totalItems: archiveUsage.totalItems,
    },
  };
}

