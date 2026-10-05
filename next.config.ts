import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // better-sqlite3 is a native module; keep it external to the server bundle.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
