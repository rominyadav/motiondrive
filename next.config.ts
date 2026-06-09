import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-auth", "kysely", "@better-auth/kysely-adapter"],
  allowedDevOrigins: ["192.168.10.120", "localhost:3000", "192.168.10.120:3000"]
};

export default nextConfig;
