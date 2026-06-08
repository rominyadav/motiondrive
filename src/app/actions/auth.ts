"use server";

import { db } from "@/db";
import { invitations, user, verification } from "@/db/schema";
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

/**
 * Generates a 6-digit OTP and maps it to a Better Auth long token.
 */
export async function generateAndStoreOTP(email: string, type: "verify" | "reset", longToken: string) {
  // Generate cryptographically strong random 6-digit number
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const identifier = `otp_${type}_${email.toLowerCase()}`;
  
  // Clean up existing OTPs of this type for this email
  await db.delete(verification).where(eq(verification.identifier, identifier));
  
  // Store new mapping
  await db.insert(verification).values({
    id: `otp_${Math.random().toString(36).slice(2, 11)}`,
    identifier,
    value: `${otp}:${longToken}`,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins expiry
  });
  
  return otp;
}

/**
 * Verifies email via 6-digit OTP code manually.
 */
export async function verifyEmailOTP(email: string, otp: string) {
  const identifier = `otp_verify_${email.toLowerCase()}`;
  
  const [record] = await db
    .select()
    .from(verification)
    .where(eq(verification.identifier, identifier));
    
  if (!record || record.expiresAt < new Date()) {
    return { success: false, error: "OTP has expired or is invalid." };
  }
  
  const [storedOtp, longToken] = record.value.split(":");
  if (storedOtp !== otp) {
    return { success: false, error: "Incorrect OTP code." };
  }
  
  // Find standard user
  const [registeredUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, email.toLowerCase()));
    
  if (!registeredUser) {
    return { success: false, error: "User not found." };
  }
  
  // Update status: check if they are the super admin
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  const isSuperAdmin = superAdminEmail && email.toLowerCase() === superAdminEmail.toLowerCase();
  
  await db
    .update(user)
    .set({
      emailVerified: true,
      role: isSuperAdmin ? "admin" : registeredUser.role,
      status: isSuperAdmin ? "approved" : registeredUser.status,
    })
    .where(eq(user.id, registeredUser.id));
    
  // Clean up OTP record
  await db.delete(verification).where(eq(verification.identifier, identifier));
  
  // Also clean up Better Auth's standard verification record
  await db.delete(verification).where(
    and(
      eq(verification.identifier, email.toLowerCase()),
      eq(verification.value, longToken)
    )
  );
  
  return { success: true };
}

/**
 * Resets user password using 6-digit reset OTP.
 */
export async function resetPasswordOTP(email: string, otp: string, newPassword: string) {
  const identifier = `otp_reset_${email.toLowerCase()}`;
  
  const [record] = await db
    .select()
    .from(verification)
    .where(eq(verification.identifier, identifier));
    
  if (!record || record.expiresAt < new Date()) {
    return { success: false, error: "OTP has expired or is invalid." };
  }
  
  const [storedOtp, longToken] = record.value.split(":");
  if (storedOtp !== otp) {
    return { success: false, error: "Incorrect OTP code." };
  }
  
  try {
    const { auth } = await import("@/lib/auth");
    
    // Reset password using Better Auth server API
    await auth.api.resetPassword({
      body: {
        newPassword,
        token: longToken,
      },
    });
    
    // Clean up OTP record
    await db.delete(verification).where(eq(verification.identifier, identifier));
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to reset password." };
  }
}
