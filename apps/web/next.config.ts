import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /**
   * Ship only what the server actually needs (§5.80).
   *
   * The production image used to be the whole workspace — every devDependency, the TypeScript
   * compiler, Playwright, the test runner, the sources — because the runtime stage copied `/app`
   * wholesale and started the app with `next start`. That is about 1.4 GB, and Railway pays for
   * it twice on every deploy: once pushing the image, once pulling it.
   *
   * `standalone` makes Next trace what each route really imports and emit a tree with a minimal
   * `node_modules` and its own `server.js`. `scripts/standalone.mjs` then adds the four things
   * tracing cannot know about — the static assets, `public`, the migration folders the client
   * reads at runtime, and the EA corpus.
   */
  output: "standalone",
  /*
   * Tracing defaults to the project directory, which in a workspace would silently drop the
   * hoisted `node_modules` at the root and the `@nexus/ea-knowledge` package. `next build` is
   * always run from `apps/web`, so the root is two up.
   */
  outputFileTracingRoot: path.join(process.cwd(), "..", ".."),
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
