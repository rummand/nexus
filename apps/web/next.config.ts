import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@libsql/client"],
  /**
   * The e2e runner starts a second dev server with a database of its own. Next refuses to run two
   * dev servers over one build directory, so the runner gives its server a directory of its own.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
