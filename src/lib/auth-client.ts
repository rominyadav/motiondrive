import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "./auth";
import { isCapacitorApp } from "./platform";

const getBaseURL = () => {
  if (typeof window !== "undefined") {
    const origin = window.location.origin;

    // Capacitor production builds run from capacitor://localhost.
    // Configure NEXT_PUBLIC_APP_URL to your HTTPS backend, e.g. https://your-domain.com.
    if (isCapacitorApp() && origin.startsWith("capacitor://")) {
      return process.env.NEXT_PUBLIC_APP_URL || origin;
    }

    // Capacitor dev builds using server.url keep the real dev server origin, e.g. http://10.0.2.2:3000.
    return origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
};

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
  plugins: [
    inferAdditionalFields<typeof auth>()
  ]
});
