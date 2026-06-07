import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";

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
    autoSignIn: true,
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
