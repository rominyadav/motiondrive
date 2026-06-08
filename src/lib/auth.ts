import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import { resend } from "./resend";
import { generateAndStoreOTP } from "@/app/actions/auth";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "staff",
      },
      status: {
        type: "string",
        required: false,
        defaultValue: "pending",
      },
      storageLimit: {
        type: "number",
        required: false,
        defaultValue: 107374182400,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: false, // Don't auto sign-in until verified
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url, token }) => {
      if (!resend) {
        console.warn("Resend client not initialized. Cannot send password reset email.");
        return;
      }
      try {
        const otp = await generateAndStoreOTP(user.email, "reset", token);
        await resend.emails.send({
          from: process.env.FROM_EMAIL || "Motionsewa Drive <onboarding@resend.dev>",
          to: user.email,
          subject: "Reset your password - Motionsewa Drive",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #0b0d16; color: #ffffff; border-radius: 12px; border: 1px solid #1e2238; text-align: center;">
              <h2 style="color: #e11d48; margin-bottom: 24px;">Reset Your Password</h2>
              <p style="font-size: 16px; color: #e2e8f0; line-height: 1.6; text-align: left;">Hi ${user.name || "User"},</p>
              <p style="font-size: 16px; color: #94a3b8; line-height: 1.6; text-align: left;">We received a request to reset your password. You can reset your password using either method below:</p>
              
              <div style="margin: 32px 0; background: #121424; padding: 20px; border-radius: 8px; border: 1px dashed #e11d48;">
                <span style="font-size: 13px; color: #94a3b8; display: block; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Option A: Enter OTP Code</span>
                <span style="font-size: 32px; font-weight: bold; color: #e11d48; letter-spacing: 6px;">${otp}</span>
              </div>

              <div style="margin: 24px 0;">
                <span style="font-size: 13px; color: #94a3b8; display: block; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px;">Option B: Click Link</span>
                <a href="${url}" style="background-color: #e11d48; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(225, 29, 72, 0.3);">Reset Password Link</a>
              </div>

              <p style="font-size: 12px; color: #475569; margin-top: 32px;">This reset option is valid for 15 minutes. If you did not request this, please ignore this email.</p>
            </div>
          `,
        });
        console.log(`Password reset email sent to ${user.email}`);
      } catch (err) {
        console.error("Failed to send password reset email:", err);
      }
    }
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url, token }) => {
      if (!resend) {
        console.warn("Resend client not initialized. Cannot send verification email.");
        return;
      }
      try {
        const otp = await generateAndStoreOTP(user.email, "verify", token);
        await resend.emails.send({
          from: process.env.FROM_EMAIL || "Motionsewa Drive <onboarding@resend.dev>",
          to: user.email,
          subject: "Verify your email - Motionsewa Drive",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #0b0d16; color: #ffffff; border-radius: 12px; border: 1px solid #1e2238; text-align: center;">
              <h2 style="color: #6366f1; margin-bottom: 24px;">Welcome to Motionsewa Drive</h2>
              <p style="font-size: 16px; color: #e2e8f0; line-height: 1.6; text-align: left;">Hi ${user.name},</p>
              <p style="font-size: 16px; color: #94a3b8; line-height: 1.6; text-align: left;">Thank you for registering. Please verify your email using either option below:</p>
              
              <div style="margin: 32px 0; background: #121424; padding: 20px; border-radius: 8px; border: 1px dashed #6366f1;">
                <span style="font-size: 13px; color: #94a3b8; display: block; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Option A: Enter OTP Code</span>
                <span style="font-size: 32px; font-weight: bold; color: #6366f1; letter-spacing: 6px;">${otp}</span>
              </div>

              <div style="margin: 24px 0;">
                <span style="font-size: 13px; color: #94a3b8; display: block; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px;">Option B: Click Link</span>
                <a href="${url}" style="background-color: #6366f1; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);">Verify Email Link</a>
              </div>

              <p style="font-size: 12px; color: #475569; margin-top: 32px;">This code and link are valid for 15 minutes.</p>
            </div>
          `,
        });
        console.log(`Verification email sent to ${user.email}`);
      } catch (err) {
        console.error("Failed to send verification email:", err);
      }
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
  },
  // Use database hooks to bootstrap the Super Admin and apply the Access Gate
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
          const isSuperAdmin = 
            superAdminEmail && 
            user.email.toLowerCase() === superAdminEmail.toLowerCase();
          
          return {
            data: {
              ...user,
              role: isSuperAdmin ? "admin" : "staff",
              status: isSuperAdmin ? "approved" : "pending",
            },
          };
        },
      },
    },
  },
});
