import { auth } from "./auth";
import { headers } from "next/headers";

/**
 * Retrieve the current session on the server side (Server Components, Route Handlers, Server Actions).
 */
export async function getSession() {
  return await auth.api.getSession({
    headers: await headers(),
  });
}

/**
 * Ensures the user is authenticated AND approved.
 * Throws an error otherwise.
 */
export async function requireApprovedUser() {
  const session = await getSession();
  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }

  const user = session.user as any;
  if (user.status !== "approved") {
    throw new Error("Awaiting Approval");
  }

  return session;
}

/**
 * Ensures the user is authenticated, approved, AND has the admin role.
 * Throws an error otherwise.
 */
export async function requireAdmin() {
  const session = await requireApprovedUser();
  const user = session.user as any;
  if (user.role !== "admin") {
    throw new Error("Forbidden");
  }

  return session;
}
