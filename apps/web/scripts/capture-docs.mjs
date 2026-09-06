/**
 * Screenshots for the documentation.
 *
 * The docs picture the product, so the pictures have to come *from* the product or they rot. This
 * drives the seeded demo workspace in a real browser and writes PNGs into `public/docs`, which are
 * committed: a reader on a train should see the screen, and a reviewer should be able to tell from
 * the diff when a screenshot changed.
 *
 * It brings its own server and database, exactly as the e2e runner does, so a capture can never
 * disturb the development workspace — an earlier version of this idea silted the demo up with
 * screenshot leftovers, which is how that lesson was learned.
 *
 *   node scripts/capture-docs.mjs            # all of them
 *   node scripts/capture-docs.mjs roadmap    # only shots whose name contains "roadmap"
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import path from "node:path";

const OUT = path.resolve("public/docs");
const only = process.argv[2] ?? "";
/*
 * Wide enough that cropping the workspace navigation out still leaves a content column bigger
 * than the ~900px the documentation renders at.
 */
const VIEWPORT = { width: 1720, height: 1000 };

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

const dir = mkdtempSync(path.join(tmpdir(), "nexus-docs-"));
const port = await freePort();
// localhost, not 127.0.0.1: the numeric form has its dev-server chunks intercepted here.
const base = `http://localhost:${port}`;
mkdirSync(OUT, { recursive: true });

const server = spawn("node", [path.resolve("node_modules/next/dist/bin/next"), "dev", "--port", String(port)], {
  env: {
    ...process.env,
    DATABASE_URL: `file:${path.join(dir, "docs.db")}`,
    NEXT_DIST_DIR: ".next-docs",
    // The screenshots must show the same thing on any machine, so the model is off: a planner
    // would answer differently every run and the docs would describe one lucky afternoon.
    ANTHROPIC_API_KEY: "",
    NEXUS_MODEL: "",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
const log = [];
server.stdout.on("data", (d) => log.push(String(d)));
server.stderr.on("data", (d) => log.push(String(d)));

/**
 * The size of every shot, written next to the docs code.
 *
 * Cropped and full-window captures no longer share an aspect ratio, so the renderer cannot assume
 * one — and a wrong intrinsic size means the page jumps as each image loads. Recording the real
 * dimensions here keeps that automatic rather than something an author has to remember.
 */
const sizes = {};
let taken = 0;
try {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`the server exited (code ${server.exitCode})`);
    try {
      const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(5000) });
      if (res.ok && (await res.json()).ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  const { chromium } = await import(path.resolve("node_modules/playwright/index.mjs"));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  /*
   * Device scale 1, not 2. The docs render these about 900px wide, so a 1560px capture is already
   * sharper than the page needs — and doubling it quadrupled the bytes committed to the repository
   * for no visible gain.
   */
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.log(`  ! page error: ${e.message}`));

  /**
   * Take one shot, unless the run is narrowed to a name that does not match.
   *
   * Workspace pages are cropped to their content: the navigation sidebar is identical on every
   * screen, so repeating it in thirty screenshots wastes the width the reader has and buries the
   * thing each picture is actually about. `options.full` keeps the whole window for the one shot
   * where the navigation *is* the subject; `options.selector` clips to a single panel.
   */
  const shot = async (name, prepare, options = {}) => {
    if (only && !name.includes(only)) return;
    process.stdout.write(`  ${name} … `);
    await prepare();
    await page.waitForTimeout(options.settle ?? 700);
    let clip;
    if (options.selector) {
      const box = await page.locator(options.selector).boundingBox();
      if (box) clip = pad(box, options.padding ?? 12);
    } else if (!options.full) {
      clip = await contentClip();
    }
    await page.screenshot({ path: path.join(OUT, `${name}.png`), ...(clip ? { clip } : {}) });
    sizes[name] = clip
      ? { width: Math.round(clip.width), height: Math.round(clip.height) }
      : { width: VIEWPORT.width, height: VIEWPORT.height };
    taken++;
    console.log("ok");
  };

  /**
   * The window minus the workspace navigation, or nothing at all on a board — a board fills the
   * window and has no sidebar to lose.
   */
  const contentClip = async () => {
    const sidebar = await page.locator(".studio-home-sidebar").boundingBox().catch(() => null);
    if (!sidebar) return undefined;
    const x = Math.round(sidebar.x + sidebar.width);
    return { x, y: 0, width: VIEWPORT.width - x, height: VIEWPORT.height };
  };
  const pad = (box, by) => ({
    x: Math.max(0, box.x - by),
    y: Math.max(0, box.y - by),
    width: Math.min(VIEWPORT.width - Math.max(0, box.x - by), box.width + by * 2),
    height: Math.min(VIEWPORT.height - Math.max(0, box.y - by), box.height + by * 2),
  });
  const goto = async (url, ready) => {
    await page.goto(`${base}${url}`, { waitUntil: "load", timeout: 180_000 });
    if (ready) await page.waitForSelector(ready, { timeout: 180_000 });
  };
  const w = "/w/acme-energy";

  // ---- the shell ----------------------------------------------------------
  // The one page where the navigation is the subject, so it keeps the whole window.
  await shot("home", () => goto(w, ".studio-home-nav"), { full: true });

  // ---- a board ------------------------------------------------------------
  await shot("board", () => goto("/b/brd_landscape", "[data-element-id]"), { settle: 2000 });
  await shot("board-card", async () => {
    await goto("/b/brd_landscape", "[data-element-id]");
    await page.waitForTimeout(1500);
    await page.locator(".fact-card").first().click();
    await page.waitForTimeout(600);
  });
  await shot("board-inspector", async () => {}, { selector: ".inspector-panel", padding: 10 });

  await shot("board-command-bar", async () => {
    await page.keyboard.press("Escape");
    await page.click(".command-bar input");
    await page.fill(".command-bar input", "kind:Application criticality:high");
    await page.waitForTimeout(1200);
  });

  await shot("board-graph-panel", async () => {
    await page.keyboard.press("Escape");
    await goto("/b/brd_landscape", "[data-element-id]");
    await page.waitForTimeout(1500);
  }, { selector: ".inventory-panel", padding: 10 });

  await shot("board-viewpoint", async () => {
    await page.click('button:has-text("Viewpoint")');
    await page.waitForTimeout(800);
  }, { selector: ".inventory-panel", padding: 10 });

  await shot("board-lens-impact", async () => {
    await goto("/b/brd_integrations", "[data-element-id]");
    await page.waitForTimeout(1500);
    await page.locator(".fact-card").first().click();
    await page.click('button:has-text("Viewpoint")');
    await page.waitForTimeout(400);
    await page.click('.viewpoint-body button:has-text("Impact")');
    await page.waitForTimeout(900);
  });

  await shot("board-compose", async () => {
    await goto("/b/brd_scratch", ".canvas-viewport");
    await page.click('button:has-text("Compose")');
    await page.waitForSelector("[data-compose]");
    await page.fill(".compose-script", "title Applications by capability\nadd all applications\nconnect them\ngroup by kind\nlay out as flow");
    await page.waitForTimeout(500);
  });

  await shot("board-compose-built", async () => {
    page.once("dialog", (d) => d.accept());
    await page.click('.compose-actions button:has-text("Build")');
    await page.waitForSelector("[data-step]", { timeout: 60_000 });
    await page.waitForTimeout(2500);
  });

  // ---- the graph ----------------------------------------------------------
  await shot("graph", () => goto(`${w}/graph`, "[data-health]"), { settle: 1500 });
  await shot("graph-health", async () => {
    await page.click(".health-head");
    await page.waitForSelector(".health-measures");
    await page.waitForTimeout(600);
  });
  await shot("graph-proposals", async () => {
    await goto(`${w}/graph`, "[data-health]");
    await page.waitForTimeout(1200);
    await page.locator(".proposal-card").first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  });
  await shot("graph-entities", async () => {
    await goto(`${w}/graph`, "[data-health]");
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Table")').catch(() => {});
    await page.waitForTimeout(900);
  });

  await shot("explorer", () => goto(`${w}/explore`, ".explorer-canvas"), { settle: 3000 });

  // ---- the meta-model -----------------------------------------------------
  await shot("meta", () => goto(`${w}/meta`, ".meta-tree"), { settle: 1200 });
  await shot("meta-diagram", async () => {
    await page.click('button:has-text("Diagram")');
    await page.waitForTimeout(2500);
  });

  // ---- intake -------------------------------------------------------------
  await shot("intake-new", async () => {
    await goto(`${w}/intake`, ".intake-shell");
    await page.click(".intake-new");
    await page.waitForSelector("[data-new-source]");
    await page.click('button:has-text("Use the sample meeting")');
    await page.fill('input[aria-label="Source name"]', "Grid data platform sync");
    await page.waitForTimeout(500);
  });
  await shot("intake-run", async () => {
    await page.click('button:has-text("Add source")');
    await page.waitForTimeout(1500);
    await page.click('button:has-text("Run pipeline")');
    await page.waitForFunction(() => document.querySelectorAll(".pipeline-stage").length >= 7, null, { timeout: 60_000 });
    await page.waitForTimeout(1200);
  });
  await shot("intake-review", async () => {
    await page.locator("[data-candidate]").first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
  });
  await shot("intake-viewpoints", async () => {
    await page.click('.intake-tabs button:has-text("Viewpoints")');
    await page.waitForSelector("[data-viewpoint]");
    await page.waitForTimeout(600);
  });
  await shot("intake-catalogue", async () => {
    await goto(`${w}/intake?view=catalog`, ".catalog");
    await page.waitForTimeout(1200);
  });

  // ---- roadmap ------------------------------------------------------------
  await shot("roadmap", async () => {
    await goto(`${w}/roadmap`, ".roadmap");
    await page.waitForTimeout(1200);
  });
  await shot("roadmap-dependencies", async () => {
    await page.locator('[data-change-set="chg_seed_streaming"] .roadmap-card-head').click();
    await page.waitForSelector("[data-depends]");
    await page.waitForTimeout(700);
  });
  await shot("plateaus", async () => {
    await goto(`${w}/roadmap/plateaus`, "[data-plateau-strip]");
    await page.waitForTimeout(1200);
  });
  await shot("plateaus-compare", async () => {
    await page.click('[data-plateau="plt_seed_2028"]');
    await page.waitForTimeout(900);
    await page.selectOption(".plateau-diff-head select", "plt_seed_workorders");
    await page.waitForTimeout(1500);
  });
  await shot("board-to-be", async () => {
    await goto("/b/brd_integrations", "[data-element-id]");
    await page.waitForTimeout(1800);
    await page.click('button:has-text("Viewpoint")');
    await page.waitForSelector("[data-state-picker]");
    await page.selectOption("[data-state-picker] select", "chg:chg_seed_workorders");
    await page.waitForSelector(".fact-card.change-retired", { timeout: 30_000 });
    await page.waitForTimeout(900);
  });

  await shot("board-scrubber", async () => {
    await goto("/b/brd_integrations", "[data-element-id]");
    await page.waitForSelector("[data-scrubber]", { timeout: 60_000 });
    await page.waitForTimeout(1800);
    const stops = page.locator("[data-scrubber] .time-scrubber-track button");
    await stops.nth((await stops.count()) - 1).click();
    await page.waitForSelector(".fact-card.change-retired", { timeout: 30_000 });
    await page.waitForTimeout(1200);
  });

  // ---- knowledge ----------------------------------------------------------
  await shot("knowledge", () => goto(`${w}/knowledge?q=how+do+you+rationalise+an+application+portfolio`, ".knowledge-passage"), { settle: 900 });
  await shot("knowledge-doctrine", () => goto(`${w}/knowledge?tab=lessons`, ".knowledge-lesson"), { settle: 900 });
  await shot("knowledge-sources", () => goto(`${w}/knowledge?tab=sources`, ".knowledge-source-list"), { settle: 900 });

  await browser.close();
  // Merge rather than replace, so a narrowed run does not forget the shots it did not take.
  const manifest = path.resolve("src/lib/docs/shots.json");
  let existing = {};
  try {
    existing = JSON.parse(await import("node:fs").then((fs) => fs.readFileSync(manifest, "utf8")));
  } catch {
    /* first run */
  }
  const merged = Object.fromEntries(Object.entries({ ...existing, ...sizes }).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(manifest, `${JSON.stringify(merged, null, 2)}\n`);
  console.log(`\n${taken} screenshot${taken === 1 ? "" : "s"} written to public/docs`);
} catch (error) {
  console.error(`\ncapture failed: ${error instanceof Error ? error.message : error}`);
  console.error(log.join("").slice(-2000));
  process.exitCode = 1;
} finally {
  server.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 500));
  if (server.exitCode === null) server.kill("SIGKILL");
  rmSync(dir, { recursive: true, force: true });
}
