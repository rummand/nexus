import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@libsql/client"],
  /**
   * The knowledge base is a workspace package that ships TypeScript source and reads its corpus
   * from disk, so Next has to compile it rather than treat it as a built dependency.
   */
  transpilePackages: ["@nexus/ea-knowledge"],
  /**
   * The e2e runner starts a second dev server with a database of its own. Next refuses to run two
   * dev servers over one build directory, so the runner gives its server a directory of its own.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
