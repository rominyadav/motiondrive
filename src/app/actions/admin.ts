"use server";

import { db } from "@/db";
import { invitations, user } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-server";
import { eq, desc } from "drizzle-orm";
import { resend } from "@/lib/resend";
import crypto from "crypto";

/**
 * Invites a new staff member or admin via email.
 */
export async function inviteUser(email: string, role: "admin" | "staff" = "staff") {
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
      await resend.emails.send({
        from: "Motionsewa Drive <onboarding@resend.dev>", // Replace with your domain once verified
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
    } catch (error) {
      console.error("Failed to send email via Resend", error);
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
