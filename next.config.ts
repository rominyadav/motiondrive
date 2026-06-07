import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-auth", "kysely", "@better-auth/kysely-adapter"]
};

export default nextConfig;
