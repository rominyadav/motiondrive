"use server";

import { db } from "@/db";
import { invitations, user } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";

/**
 * Validates a pending invitation token.
 */
export async function validateInviteToken(token: string) {
  if (!token) return { valid: false, error: "No token provided" };

  const [invite] = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.token, token),
        gt(invitations.expiresAt, new Date())
      )
    );

  if (!invite) {
    return { valid: false, error: "Invalid or expired token" };
  }

  return { valid: true, email: invite.email, role: invite.role };
}

/**
 * Claims an invitation, approving the user and deleting the token.
 */
export async function claimInviteToken(token: string, email: string) {
  const validation = await validateInviteToken(token);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  if (validation.email?.toLowerCase() !== email.toLowerCase()) {
    return { success: false, error: "Email address does not match invitation" };
  }

  // Find the user with this email
  const [registeredUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, email.toLowerCase()));

  if (!registeredUser) {
    return { success: false, error: "User is not registered yet" };
  }

  // Update user status and role
  await db
    .update(user)
    .set({
      role: validation.role || "staff",
      status: "approved",
    })
    .where(eq(user.id, registeredUser.id));

  // Remove invitation
  await db.delete(invitations).where(eq(invitations.token, token));

  return { success: true };
}
