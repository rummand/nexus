/**
 * Finish the standalone build (§5.80).
 *
 * `output: "standalone"` traces the JavaScript each route imports and writes a tree that runs
 * with plain `node server.js` and a fraction of the dependencies. Four things it cannot know
 * about, because nothing imports them:
 *
 * - `.next/static` and `public` — Next expects a CDN to serve these and leaves them out. Nexus
 *   serves its own assets (the fonts are vendored, §5.45), so they have to be in the tree.
 * - `drizzle/` and `drizzle-pg/` — the database client runs the migrations itself at first use,
 *   reading the folder from `process.cwd()`. A missing folder is an empty database.
 * - The EA corpus — read from disk at runtime, pointed at by `EA_CORPUS_DIR`.
 *
 * It also takes four things *out*. Standalone copies the project's own files alongside the
 * modules it traced, and a developer's checkout has a `data/` directory with the development
 * database in it — 26 MB of somebody's workspace, and a real leak if an image were ever built
 * without `.dockerignore` in front of it. `outputFileTracingExcludes` does not cover this: it
 * filters the *traced* files, not the project copy. So the pruning is done here, where it can be
 * seen and tested.
 *
 * Run after `next build`; `pnpm build` does it for you.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const dist = process.env.NEXT_DIST_DIR || ".next";
const web = path.resolve(".");
const root = path.resolve("..", "..");
/* Tracing is rooted at the workspace, so the tree mirrors it: standalone/apps/web is the app. */
const out = path.join(web, dist, "standalone");
const outWeb = path.join(out, "apps", "web");

if (!existsSync(outWeb)) {
  console.error(`standalone: ${outWeb} does not exist — did next build run with output: "standalone"?`);
  process.exit(1);
}

const copy = (from, to) => {
  if (!existsSync(from)) return false;
  rmSync(to, { recursive: true, force: true });
  mkdirSync(path.dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
  return true;
};

const copied = [];
if (copy(path.join(web, dist, "static"), path.join(outWeb, dist, "static"))) copied.push(`${dist}/static`);
if (copy(path.join(web, "public"), path.join(outWeb, "public"))) copied.push("public");
for (const folder of ["drizzle", "drizzle-pg"]) {
  if (copy(path.join(web, folder), path.join(outWeb, folder))) copied.push(folder);
}
const corpus = path.join(root, "packages", "ea-knowledge", "corpus");
if (copy(corpus, path.join(out, "packages", "ea-knowledge", "corpus"))) copied.push("ea-knowledge/corpus");

/*
 * Never in a deployment: a database, the end-to-end suite, or the compiler's own bookkeeping.
 */
const pruned = [];
for (const junk of ["data", "e2e", "tsconfig.tsbuildinfo"]) {
  const at = path.join(outWeb, junk);
  if (existsSync(at)) { rmSync(at, { recursive: true, force: true }); pruned.push(junk); }
}

console.log(`standalone: ${copied.join(", ")} → ${path.relative(web, out)}`);
if (pruned.length) console.log(`standalone: pruned ${pruned.join(", ")}`);

