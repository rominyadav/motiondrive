import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import { resend } from "./resend";

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
    },
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: false, // Don't auto sign-in until verified
    requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url, token }) => {
      if (!resend) {
        console.warn("Resend client not initialized. Cannot send verification email.");
        return;
      }
      try {
        await resend.emails.send({
          from: process.env.FROM_EMAIL || "Motionsewa Drive <onboarding@resend.dev>",
          to: user.email,
          subject: "Verify your email - Motionsewa Drive",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #0b0d16; color: #ffffff; border-radius: 12px; border: 1px solid #1e2238; text-align: center;">
              <h2 style="color: #6366f1; margin-bottom: 24px;">Welcome to Motionsewa Drive</h2>
              <p style="font-size: 16px; color: #e2e8f0; line-height: 1.6; text-align: left;">Hi ${user.name},</p>
              <p style="font-size: 16px; color: #94a3b8; line-height: 1.6; text-align: left;">Thank you for registering. Please click the button below to verify your email address and activate your account:</p>
              <div style="margin: 36px 0;">
                <a href="${url}" style="background-color: #6366f1; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);">Verify Email Address</a>
              </div>
              <p style="font-size: 13px; color: #64748b; line-height: 1.5;">If the button doesn't work, you can copy and paste this link in your browser: <br/><a href="${url}" style="color: #6366f1; word-break: break-all;">${url}</a></p>
              <hr style="border: 0; border-top: 1px solid #1e2238; margin: 32px 0;" />
              <p style="font-size: 12px; color: #475569;">If you did not request this registration, please ignore this email.</p>
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
