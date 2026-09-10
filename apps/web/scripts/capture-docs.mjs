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
    /* An explicit region, for a picture whose subject overflows its own element — a rail with a
       flyout hanging off it has a bounding box 44px wide and a picture 340px wide. */
    if (options.clip) clip = options.clip;
    else if (options.selector) {
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

  /**
   * Sign in first (§5.41): every page below is behind the gate now.
   *
   * The seeded password, which is public by design — this server and this database exist for the
   * length of one capture.
   */
  const signIn = async (p, email = "jes@acme-energy.example") => {
    await p.goto(`${base}/signin`, { waitUntil: "load", timeout: 180_000 });
    await p.fill('input[name="email"]', email);
    await p.fill('input[name="password"]', "acme-energy");
    await p.click('button[type="submit"]');
    await p.waitForURL((u) => !u.pathname.startsWith("/signin"), { timeout: 180_000 });
  };
  await signIn(page);

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
  /* The rail with a flyout open (§5.59): a menu that is shut teaches nobody that it is there. */
  await shot("board-toolbar", async () => {
    await goto("/b/brd_landscape", "[data-element-id]");
    await page.waitForTimeout(1500);
    await page.click('[data-tool="card"]');
    await page.waitForSelector('[data-flyout="card"]');
    await page.waitForTimeout(600);
  }, { clip: { x: 4, y: 58, width: 352, height: 580 }, settle: 200 });

  await shot("board-inspector", async () => {}, { selector: ".inspector-panel", padding: 10 });

  await shot("board-command-bar", async () => {
    await page.keyboard.press("Escape");
    // It rests as a pill now (§5.55); the picture is of it in use.
    await page.click("[data-command-pill]");
    await page.waitForSelector(".command-bar input", { timeout: 30_000 });
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

  /*
   * The one shot that needs two browsers: a screenshot of multiplayer with nobody else on the
   * board would be a screenshot of an ordinary board. A second context is a second person — its
   * own cookies, its own stream — and the picture is taken from the first one's screen, which is
   * where a reader wants to see somebody else's cursor.
   */
  let guestContext = null;
  await shot("board-together", async () => {
    guestContext = await browser.newContext({ viewport: VIEWPORT });
    const guest = await guestContext.newPage();
    /*
     * The guest opens the board *first*, so the room already exists and already has somebody in it
     * when the page being photographed joins: its own `hello` carries the peer list, and the
     * picture does not depend on a broadcast arriving at a stream that is already open.
     */
    // Somebody else, so the picture shows a name and a colour that are not the reader's own.
    await signIn(guest, "maria@acme-energy.example");
    await guest.goto(`${base}/b/brd_landscape`, { waitUntil: "load", timeout: 180_000 });
    await guest.waitForSelector("[data-element-id]", { timeout: 180_000 });
    await guest.waitForTimeout(1500);
    await goto("/b/brd_landscape", "[data-element-id]");
    await page.waitForSelector(".peer-chip", { timeout: 90_000 });
    // The guest takes hold of a card and puts their pointer beside it, so the picture shows what
    // the page is about: their selection, their cursor, and the field they have locked.
    await guest.locator(".fact-card").nth(1).click();
    await guest.locator(".fact-card").nth(1).locator("input.fact-title").click();
    await guest.mouse.move(700, 420);
    await guest.mouse.move(720, 440);
    await page.waitForSelector(".peer-cursor", { timeout: 30_000 });
    // Long enough for the dev server's compile badge to go: this shot opens a second context and
    // a route or two with it, and a "Compiling…" pill in the corner of the documentation is the
    // sort of thing a reader notices and nobody who took the picture does.
    await page.waitForTimeout(4000);
  }, { settle: 1500 });
  if (guestContext) await guestContext.close();

  /*
   * Following (§5.51) needs two browsers for the same reason as the shot above, and one more
   * thing: the two windows are deliberately different sizes, because the picture is of the
   * follower matching what the leader *sees* rather than copying their zoom.
   */
  let leadContext = null;
  await shot("board-following", async () => {
    leadContext = await browser.newContext({ viewport: { width: 1180, height: 820 } });
    const leader = await leadContext.newPage();
    await signIn(leader, "maria@acme-energy.example");
    await leader.goto(`${base}/b/brd_landscape`, { waitUntil: "load", timeout: 180_000 });
    await leader.waitForSelector("[data-element-id]", { timeout: 180_000 });
    await leader.waitForTimeout(1500);

    await goto("/b/brd_landscape", "[data-element-id]");
    await page.waitForSelector("[data-peer-chips] [data-peer-follow]", { timeout: 90_000 });
    await page.waitForTimeout(1200);

    // The leader zooms in on one card — ctrl+wheel, because a bare wheel pans in the default mode.
    const card = await leader.locator(".fact-card").nth(2).boundingBox();
    await leader.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
    await leader.keyboard.down("Control");
    for (let i = 0; i < 5; i++) { await leader.mouse.wheel(0, -120); await leader.waitForTimeout(120); }
    await leader.keyboard.up("Control");
    await leader.mouse.move(card.x + card.width / 2, card.y + card.height / 2 + 40);
    await leader.waitForTimeout(1200);

    await page.click("[data-peer-chips] [data-peer-follow]");
    await page.waitForSelector("[data-follow-bar]", { timeout: 30_000 });
    await page.waitForTimeout(3000);
  }, { settle: 1200 });
  if (leadContext) await leadContext.close();

  /*
   * Comments (§5.50). The picture has to show both kinds at once — one about the board, one about
   * a card, with the card carrying its pin — so it writes them, then clicks empty board so the
   * selection toolbar is not standing on top of the pin it is meant to show.
   */
  await shot("board-comments", async () => {
    await goto("/b/brd_landscape", "[data-element-id]");
    await page.waitForTimeout(1500);
    await page.click("[data-comments-button]");
    await page.waitForSelector("[data-comments-panel]", { timeout: 60_000 });
    await page.fill("[data-comment-input]", "Is this the whole estate, or only what we could get out of the CMDB?");
    await page.click("[data-comments-panel] .comment-compose button[type=submit]");
    await page.waitForSelector(".comment-thread", { timeout: 60_000 });
    await page.locator(".fact-card").first().click();
    await page.waitForSelector("[data-comment-button]", { timeout: 60_000 });
    await page.click("[data-comment-button]");
    await page.waitForSelector(".comment-about", { timeout: 60_000 });
    await page.fill("[data-comment-input]", "Who owns this now that the platform team has been split?");
    await page.click("[data-comments-panel] .comment-compose button[type=submit]");
    await page.waitForSelector(".comment-pin", { timeout: 60_000 });
    await page.mouse.click(700, 880);
    await page.waitForTimeout(800);
  }, { settle: 800 });

  /*
   * What an agent can read (§5.52). The board is seeded without agents, so the picture places one,
   * joins it to two cards and selects it — which is exactly the sequence the page describes.
   */
  await shot("board-agent-scope", async () => {
    await goto("/b/brd_landscape", "[data-element-id]");
    await page.waitForTimeout(1500);
    await page.click('[data-tool="agent"]');
    const box = await page.locator(".canvas-viewport").boundingBox();
    await page.mouse.click(box.x + 1150, box.y + 640); // clear of the cards it will outline
    await page.waitForSelector("[data-agent]", { timeout: 60_000 });
    const agent = page.locator("[data-agent]").last();
    await agent.locator('input[aria-label="Agent name"]').fill("Ownership watch");
    await agent.locator('textarea[aria-label="What this agent is for"]')
      .fill("Tell me where two systems that depend on each other are owned by different teams.");
    // Leave the field before selecting, and click the face rather than the header: the header
    // holds the name input, and an input is not a reliable thing to click "the object" on.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await agent.locator(".board-agent-face").click();
    await page.waitForSelector(".agent-scope-mark", { timeout: 30_000 });
    await page.waitForTimeout(900);
  }, { settle: 800 });

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

  // ---- the graph's own history --------------------------------------------
  await shot("history", () => goto(`${w}/history`, "[data-history-summary]"), { settle: 900 });

  // ---- the wiki (§5.60) ---------------------------------------------------
  // Written from a board, because an empty wiki is a picture of nothing.
  await shot("wiki-page", async () => {
    await goto(`${w}/wiki`, "[data-wiki]");
    await page.click("[data-new-page]");
    await page.waitForSelector("[data-new-page-panel]");
    await page.click('[data-writeup="brd_landscape"]');
    await page.waitForSelector("[data-wiki-page-view]", { timeout: 60_000 });
    await page.waitForTimeout(1800);
  }, { settle: 400 });

  // ---- the meta-model -----------------------------------------------------
  await shot("meta", () => goto(`${w}/meta`, ".meta-tree"), { settle: 1200 });
  await shot("meta-diagram", async () => {
    await page.click('button:has-text("Diagram")');
    await page.waitForTimeout(2500);
  });
  // Standards, then conformance — in that order, because a model nobody declared has nothing to
  // conform to, and a screenshot of "nothing to report" teaches nobody anything (§5.56).
  await shot("meta-layers", async () => {
    await page.click("[data-tab-layers]");
    await page.waitForSelector("[data-layers]");
    await page.waitForTimeout(900);
    // Adopt the reading first: a screenshot of an empty stack teaches nobody what a stack is.
    if (await page.locator("[data-adopt-layering]").count()) {
      await page.click("[data-adopt-layering]");
      await page.waitForSelector("[data-layering-ok]", { timeout: 60_000 });
      await page.waitForTimeout(2500);
    }
  });
  await shot("meta-frameworks", async () => {
    await page.click("[data-tab-frameworks]");
    await page.waitForSelector("[data-frameworks]");
    await page.click('[data-framework="c4"] > button');
    await page.waitForSelector('[data-adopt-framework="c4"]');
    await page.waitForTimeout(500);
  });
  await shot("meta-conformance", async () => {
    await page.click('[data-adopt-framework="c4"]');
    await page.waitForSelector(".framework-ok", { timeout: 60_000 });
    await page.waitForTimeout(2500);
    await page.click("[data-tab-conformance]");
    await page.waitForSelector("[data-breach-group]", { timeout: 30_000 });
    await page.locator("[data-breach-group] > button").first().click();
    await page.waitForSelector("[data-breach-group] li");
    await page.waitForTimeout(400);
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

  // ---- the timeline: a canvas capability, and the roadmap drawn with it ----
  await shot("board-timeline", async () => {
    await goto("/b/brd_integrations", "[data-element-id]");
    await page.waitForTimeout(1800);
    await page.click('button:has-text("Viewpoint")');
    await page.waitForSelector("[data-timeline-controls]", { timeout: 60_000 });
    const key = await page.$$eval("[data-timeline-controls] select", (els) => [...els[0].options].map((o) => o.value).find(Boolean));
    await page.selectOption("[data-timeline-controls] select >> nth=0", key);
    await page.click("[data-timeline-controls] .viewpoint-primary");
    await page.waitForTimeout(1200);
    await page.click('button:has-text("Fit board")');
    await page.waitForTimeout(1500);
  });

  await shot("roadmap-board", async () => {
    await goto(`${w}/roadmap`, ".roadmap");
    await page.click("[data-draw-roadmap]");
    await page.waitForSelector("[data-draw-form]");
    await page.click("[data-draw-form] button[type=submit]");
    await page.waitForURL(/\/b\/brd_/, { timeout: 60_000 });
    await page.waitForFunction(() => document.querySelectorAll("[data-element-id]").length > 3, null, { timeout: 60_000 });
    await page.waitForTimeout(2000);
  });

  // ---- the landing zone -------------------------------------------------------
  // Real files, read by the real pipeline: the fixtures the e2e suite uses.
  const fixtures = path.resolve("e2e/fixtures");
  await shot("import-review", async () => {
    await goto(`${w}/import`, "[data-import-upload]");
    await page.setInputFiles("[data-import-files]", [
      path.join(fixtures, "servicenow-business-applications.csv"),
      path.join(fixtures, "sharepoint-app-list.csv"),
      path.join(fixtures, "application-audit-2019.xlsx"),
      path.join(fixtures, "architecture-review-q3.docx"),
    ]);
    await page.click("[data-import-upload] button[type=submit]");
    await page.waitForURL(/\/import\/bat_/, { timeout: 120_000 });
    await page.waitForSelector("[data-import-counts]", { timeout: 60_000 });
    await page.waitForTimeout(900);
  });

  await shot("import-board", async () => {
    await page.click("[data-draw-batch]");
    await page.waitForURL(/\/b\/brd_/, { timeout: 120_000 });
    await page.waitForFunction(() => document.querySelectorAll("[data-element-id]").length > 3, null, { timeout: 60_000 });
    await page.waitForTimeout(1500);
  });

  // ---- agents ---------------------------------------------------------------
  // Placing an agent and selecting objects need no model, so both of these are the real product.
  // The answering half cannot be photographed honestly without a key, and is described instead.
  await shot("ask-selection", async () => {
    await goto("/b/brd_landscape", "[data-element-id]");
    await page.waitForTimeout(1800);
    const cards = page.locator(".fact-card");
    await cards.nth(0).click();
    await page.keyboard.down("Shift");
    await cards.nth(1).click();
    await page.keyboard.up("Shift");
    await page.waitForSelector("[data-ask-block]", { timeout: 30_000 });
    await page.waitForTimeout(700);
  });

  await shot("agent-fleet", async () => {
    await goto("/b/brd_landscape", "[data-element-id]");
    await page.waitForTimeout(1500);
    await page.click('[data-tool="agent"]');
    const box = await page.locator(".canvas-viewport").boundingBox();
    await page.mouse.click(box.x + 420, box.y + 700);
    await page.waitForSelector("[data-agent]", { timeout: 30_000 });
    const placed = page.locator("[data-agent].selected");
    await placed.locator('input[aria-label="Agent name"]').fill("Succession watch");
    await placed.locator('textarea[aria-label="What this agent is for"]').fill("Tell me where this landscape has no stated successor.");
    await page.waitForTimeout(2500); // let the autosave land, so the fleet can see it
    await goto(`${w}/agents`, "[data-fleet-totals]");
    await page.waitForTimeout(1000);
  });

  /*
   * Describing an agent needs no model — the form, the scope count and the run log are the product.
   * Only the answering half needs a key, and that half is described in words rather than faked.
   */
  await shot("agent-described", async () => {
    await goto(`${w}/agents/new`, "[data-agent-form]");
    await page.fill("[data-agent-name]", "Ownerless applications");
    await page.fill("[data-agent-purpose]", "Every application should say who owns it. Find the ones that do not, and propose an owner only where the object's own words answer it.");
    await page.fill("[data-agent-scope]", "kind:Application missing:owner");
    await page.click(".agent-scope button");
    await page.waitForSelector("[data-scope-count]", { timeout: 30_000 });
    await page.check('[data-verb="setAttribute"] input');
    await page.waitForTimeout(400);
  });

  // ---- settings -------------------------------------------------------------
  /*
   * A provider with no key, because that is the one this capture can show honestly: a local
   * endpoint needs no secret, so the picture is the real screen rather than a mocked one.
   */
  /*
   * A key issued into a throwaway capture database, so the "shown once" panel — the most important
   * thing on this screen — is the real one rather than a mock. The key dies with the database.
   */
  await shot("connections", async () => {
    await goto(`${w}/settings/connections`, "[data-key-name]");
    await page.fill("[data-key-name]", "Claude Code on my laptop");
    await page.selectOption(".mcp-new-row select", "propose");
    await page.click("[data-issue-key]");
    await page.waitForSelector("[data-issued-key]", { timeout: 30_000 });
    await page.waitForTimeout(600);
  });

  await shot("models", async () => {
    await goto(`${w}/settings/models`, "[data-preset=ollama]");
    await page.click("[data-preset=ollama]");
    await page.waitForSelector("[data-provider]", { timeout: 30_000 });
    await page.waitForTimeout(900);
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
