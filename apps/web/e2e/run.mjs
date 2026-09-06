/**
 * Run the smoke test against a database of its own.
 *
 * The tests used to run against the development database. That was wrong in both directions: the
 * suite mutated the demo workspace (it silted the seeded board up with a note per run, and one
 * careless rebuild emptied it), and the demo's drift broke the suite — three false failures in one
 * afternoon, and coverage quietly lost as the seeded types it declares ran out.
 *
 * So: a temporary SQLite file, a server of its own on a free port, migrations and seed on the
 * first request, the suite, then the file is deleted. Every run starts from the same known
 * workspace, which is what lets the tests assert instead of guarding.
 *
 *   pnpm e2e                 — isolated: spawns its own server and database
 *   BASE_URL=… pnpm e2e      — against a server that is already running (the fast local loop)
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import path from "node:path";

const READY_TIMEOUT_MS = 120_000;

/** A port nothing else is on, asked for by binding to 0 and reading back what we got. */
function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForHealth(base, child) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`the server exited before it was ready (code ${child.exitCode})`);
    try {
      const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const body = await res.json();
        if (body.ok) return body;
      }
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`the server never became healthy at ${base}`);
}

const attached = Boolean(process.env.BASE_URL);
let dir = null;
let server = null;
let base = process.env.BASE_URL;

try {
  if (!attached) {
    dir = mkdtempSync(path.join(tmpdir(), "nexus-e2e-"));
    const port = await freePort();
    // localhost, not 127.0.0.1: a browser here treats the two differently for proxying, and the
    // numeric form had its dev-server chunks and HMR socket intercepted — the canvas then never
    // loaded at all, which looked exactly like a slow test.
    base = `http://localhost:${port}`;
    console.log(`e2e: starting a server on ${port} with a database in ${dir}`);
    server = spawn("node", [path.resolve("node_modules/next/dist/bin/next"), "dev", "--port", String(port)], {
      env: {
        ...process.env,
        DATABASE_URL: `file:${path.join(dir, "e2e.db")}`,
        // Next refuses two dev servers over one build directory; this one gets its own.
        NEXT_DIST_DIR: ".next-e2e",
        // the suite asserts on the rule compiler's echo; a planner would answer differently
        ANTHROPIC_API_KEY: "",
        NEXUS_MODEL: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const log = [];
    server.stdout.on("data", (d) => log.push(String(d)));
    server.stderr.on("data", (d) => log.push(String(d)));
    try {
      const health = await waitForHealth(base, server);
      console.log(`e2e: seeded — ${health.workspaces} workspace(s)`);
    } catch (error) {
      console.error(log.join("").slice(-2000));
      throw error;
    }
  }

  if (!attached) {
    /**
     * A dev server compiles a route on its first request, which takes longer than any sensible
     * assertion timeout. Warming with fetch is not enough: that compiles the server route, while
     * the *client* bundle is only built when a browser asks for it. So warm in a browser, and let
     * the suite measure the app rather than the compiler.
     */
    const routes = [
      { path: "/w/acme-energy", ready: ".studio-home-nav" },
      { path: "/w/acme-energy/graph", ready: "[data-health]" },
      { path: "/w/acme-energy/explore", ready: ".explorer-canvas" },
      { path: "/w/acme-energy/meta", ready: ".meta-tree" },
      { path: "/w/acme-energy/intake", ready: ".intake-shell" },
      { path: "/w/acme-energy/intake?view=catalog", ready: ".catalog" },
      { path: "/w/acme-energy/knowledge", ready: ".knowledge" },
      { path: "/w/acme-energy/roadmap", ready: ".roadmap" },
      { path: "/w/acme-energy/teams", ready: ".studio-home-main" },
      { path: "/w/acme-energy/spaces/space_sandbox", ready: ".studio-starters" },
      // last and slowest: the canvas is client-only, so "load" fires long before it is usable
      { path: "/b/brd_capabilities", ready: "[data-element-id]" },
    ];
    const started = Date.now();
    const { chromium } = await import("playwright");
    const warm = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
    const page = await warm.newPage({ viewport: { width: 1600, height: 1000 } });
    for (const route of routes) {
      await page.goto(`${base}${route.path}`, { waitUntil: "load", timeout: 120_000 }).catch(() => undefined);
      // Waiting for something the page only shows once it works is the whole point: "load" fires
      // while Turbopack is still building the client chunks.
      await page.waitForSelector(route.ready, { timeout: 120_000 }).catch(() => undefined);
    }
    await warm.close();
    console.log(`e2e: warmed ${routes.length} routes in ${Math.round((Date.now() - started) / 1000)}s`);
  }

  const smoke = spawn("node", [path.resolve("e2e/smoke.mjs")], {
    env: { ...process.env, BASE_URL: base },
    stdio: "inherit",
  });
  const code = await new Promise((resolve) => smoke.on("exit", resolve));
  if (code !== 0) process.exitCode = code ?? 1;
} finally {
  if (server) {
    server.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 500));
    if (server.exitCode === null) server.kill("SIGKILL");
  }
  // The database is the point of the exercise: it never outlives the run.
  if (dir) rmSync(dir, { recursive: true, force: true });
}
