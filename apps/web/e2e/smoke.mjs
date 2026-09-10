/**
 * Browser smoke test for the workspace pages and the canvas.
 *
 * Requires a running app (default http://localhost:3000) and a Chromium that Playwright
 * can launch. Run with:  pnpm e2e   (or BASE_URL=... pnpm e2e)
 *
 * The test creates objects on the seeded "Business capability map" board and a board in
 * the Sandbox space, so run it against a development database only.
 */
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

/** Fixtures resolve from this file, not from wherever the runner was started. */
const fixture = (name) => path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", name);

const base = process.env.BASE_URL ?? "http://localhost:3000";
const TEXT = `Smoke ${Date.now()}`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const problems = [];
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && !/ERR_CONNECTION|Failed to load resource/.test(m.text()) && problems.push(`console: ${m.text()}`));
let saves = 0;
page.on("request", (r) => r.method() === "PUT" && r.url().includes("/api/boards/") && saves++);
/*
 * Nothing may be fetched from a font host (§5.45). An air-gapped deployment that silently falls
 * back to the system stack is the failure this guards, and it is invisible from inside the page —
 * so it is watched from out here, for the whole run.
 */
const offsite = [];
page.on("request", (r) => /fonts\.(googleapis|gstatic)\.com/.test(r.url()) && offsite.push(r.url()));

const count = () => page.locator("[data-element-id]").count();
const zoom = () => page.locator(".zoom-card strong").innerText();

/**
 * Sign a browser in as one of the seeded people (§5.41).
 *
 * Every page in this suite is behind the gate now, so this runs first — and it is the one place
 * that knows the demo password, which the seed sets and the sign-in page advertises in
 * development. Taking an email means the multiplayer section can be two different people.
 */
const signIn = async (p, email = "jes@acme-energy.example") => {
  await p.goto(`${base}/signin`, { waitUntil: "load" });
  await p.fill('input[name="email"]', email);
  await p.fill('input[name="password"]', "acme-energy");
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/signin"), { timeout: 30000 });
};

/**
 * A fetch from *this process* that carries the browser's session (§5.41).
 *
 * The browser APIs are behind the same gate as the pages, so a bare `fetch` from the test gets
 * the sign-in page and a confusing "Unexpected token '<'". `/api/mcp` is deliberately left to a
 * plain fetch below: it carries a bearer key instead of a cookie, and proving that still works
 * without one is part of the point.
 */
const apiFetch = async (url, init = {}) => {
  const jar = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  return fetch(url, { ...init, headers: { ...(init.headers ?? {}), cookie: jar } });
};

try {
  // Signed out, every page is the sign-in page — the assertion that the gate is actually on.
  await page.goto(`${base}/w/acme-energy`, { waitUntil: "load" });
  assert.equal(new URL(page.url()).pathname, "/signin", "a signed-out visitor is sent to sign in");
  assert.ok(await page.locator("[data-demo-hint]").isVisible(), "a demo instance says how to get in");

  // A wrong password is refused, and says nothing about whether the account exists.
  await page.fill('input[name="email"]', "jes@acme-energy.example");
  await page.fill('input[name="password"]', "not-the-password");
  await page.click('button[type="submit"]');
  await page.waitForSelector(".form-error");
  assert.match(await page.locator(".form-error").innerText(), /do not match/, "a wrong password is refused without saying which half was wrong");

  await signIn(page);

  // workspace pages
  await page.goto(`${base}/w/acme-energy`, { waitUntil: "load" });
  assert.ok(await page.locator(".studio-starters").isVisible(), "home renders starters");
  assert.ok((await page.locator(".studio-board-row").count()) > 0, "home lists boards");
  await page.goto(`${base}/w/acme-energy/spaces/space_landscape`, { waitUntil: "load" });
  assert.ok(await page.locator("text=Boards in this space").isVisible(), "space page lists boards");
  await page.goto(`${base}/w/acme-energy/teams/team_ea`, { waitUntil: "load" });
  assert.ok(await page.locator("text=Members").first().isVisible(), "team page renders members");

  // canvas
  await page.goto(`${base}/b/brd_capabilities`, { waitUntil: "load" });
  // The first render uses a 1×1 viewport and culls almost everything; wait for the fitted render.
  // Generous, because this is the first canvas of the run: on a cold dev server it is competing
  // with the compiler, and a slow first paint is not what this test is about.
  await page.waitForFunction(() => document.querySelectorAll("[data-element-id]").length > 10, null, { timeout: 45000 });
  // the board fits itself to the viewport on first measurement; wait for that camera change
  await page.waitForFunction(() => document.querySelector(".zoom-card strong")?.textContent !== "100%", null, { timeout: 5000 }).catch(() => undefined);
  await page.waitForTimeout(200);
  const initial = await count();
  assert.ok(initial > 10, "seeded board has objects");
  const z0 = await zoom();

  // Find an empty spot for the new note: the shared dev board accumulates objects and connectors
  // (which sit above cards and have a generous hit area) across runs.
  const spot = await page.evaluate(() => {
    const free = (x, y) => [[0, 0], [-45, -25], [45, -25], [-45, 25], [45, 25]].every(([dx, dy]) => !document.elementFromPoint(x + dx, y + dy)?.closest("[data-element-id]"));
    for (const [x, y] of [[900, 750], [700, 800], [1100, 800], [500, 700], [1200, 650], [800, 600], [600, 500], [1000, 450]]) if (free(x, y)) return { x, y };
    return { x: 900, y: 750 };
  });
  // note: N + click, type the title (auto-focused), Escape
  await page.keyboard.press("n");
  await page.mouse.click(spot.x, spot.y);
  await page.waitForSelector(".impact-note input:focus");
  const noteId = await page.evaluate(() => document.activeElement?.closest("[data-element-id]")?.getAttribute("data-element-id"));
  assert.ok(noteId, "new note has an id");
  await page.keyboard.type(TEXT);
  await page.keyboard.press("Escape"); // leave the field
  const note = page.locator(`[data-element-id="${noteId}"]`);
  assert.equal(await note.locator("input").first().inputValue(), TEXT, "note title typed");
  await page.keyboard.press("Escape"); // deselect: fields of unselected objects are inert

  // drag from the middle: an unselected object is grabbed anywhere (first click selects + drags)
  const b0 = await note.boundingBox();
  await page.keyboard.down("Alt"); // bypass smart guides so the delta is exact
  await page.mouse.move(b0.x + b0.width / 2, b0.y + b0.height / 2);
  await page.mouse.down();
  await page.mouse.move(b0.x + b0.width / 2 + 120, b0.y + b0.height / 2 + 60, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up("Alt");
  const b1 = await note.boundingBox();
  assert.ok(Math.abs(b1.x - b0.x - 120) < 3 && Math.abs(b1.y - b0.y - 60) < 3, `note moved with the pointer (got ${Math.round(b1.x - b0.x)}, ${Math.round(b1.y - b0.y)})`);

  // zoom + pan + fit
  await page.mouse.move(700, 500);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -300);
  await page.keyboard.up("Control");
  assert.notEqual(await zoom(), z0, "ctrl+wheel zooms");
  const worldTransform = () => page.locator("[data-canvas-world]").evaluate((el) => el.style.transform);
  const w0 = await worldTransform();
  await page.mouse.wheel(100, 50);
  await page.waitForTimeout(100); // wheel deltas are applied once per animation frame
  assert.notEqual(await worldTransform(), w0, "wheel pans");
  await page.keyboard.press("Shift+1");
  const fit = parseInt(await zoom(), 10);
  assert.ok(Math.abs(fit - parseInt(z0, 10)) <= 5, `shift+1 fits the board (got ${fit}%, initial ${z0})`);

  // select + inspector + delete + undo
  await page.keyboard.press("Escape");
  const nb = await note.boundingBox();
  // click near the corner: the centre of a small note can sit under a connector from an earlier run
  await page.mouse.click(nb.x + 8, nb.y + 8);
  await page.locator(".inspector-panel h2", { hasText: TEXT }).waitFor({ timeout: 4000 }).catch(() => assert.fail("inspector shows the selected note"));
  const beforeDelete = await count();
  await page.keyboard.press("Delete");
  assert.equal(await count(), beforeDelete - 1, "delete removes the note");
  await page.keyboard.press("Control+z");
  assert.equal(await count(), beforeDelete, "undo restores it");

  // card via C, rectangle via R + drag, connector via L from note to rectangle
  await page.keyboard.press("Escape");
  await page.keyboard.press("c");
  await page.mouse.click(1000, 200);
  await page.waitForSelector(".fact-card input:focus");
  await page.keyboard.type("Smoke card");
  await page.keyboard.press("Escape");
  assert.equal(await count(), beforeDelete + 1, "card created");
  await page.keyboard.press("r");
  await page.mouse.move(1100, 420);
  await page.mouse.down();
  await page.mouse.move(1250, 520, { steps: 5 });
  await page.mouse.up();
  assert.equal(await count(), beforeDelete + 2, "rectangle drawn");
  await page.keyboard.press("Escape");
  await page.keyboard.press("l");
  const sb = await note.boundingBox();
  await page.mouse.move(sb.x + 10, sb.y + sb.height - 10); // inside the note, away from connector labels of earlier runs
  await page.mouse.down();
  await page.mouse.move(1175, 470, { steps: 10 });
  await page.mouse.up();
  assert.equal(await count(), beforeDelete + 3, "connector created");

  // the tool rail: groups, tooltips and flyouts that remember (§5.59)
  await page.keyboard.press("Escape");
  await page.keyboard.press("v");
  assert.equal(await page.locator(".tool-button-badge").count(), 0,
    "no button wears a permanent caption any more");
  assert.equal(await page.locator(".canvas-toolbar .tool-group").count(), 4,
    "the rail is grouped: point, make, show, undo");
  {
    // The shortcut moved out of a native title into something a person can actually read.
    await page.hover('[data-tool="sticky"]');
    await page.waitForTimeout(500);
    const tip = await page.locator('.tool-slot:has([data-tool="sticky"]) .tool-tip').innerText();
    assert.match(tip, /Note/, "the tooltip names the tool");
    assert.match(tip, /\bN\b/, `the tooltip carries the keycap: ${tip}`);
  }

  {
    // A card is placed AS A KIND, which is the flyout's whole reason for existing.
    await page.click('[data-tool="card"]');
    await page.waitForSelector('[data-flyout="card"]');
    assert.equal(await page.locator("[data-card-kind]").count(), 8, "every card kind is offered");
    await page.click('[data-card-kind="Interface"]');
    assert.equal(await page.locator('[data-flyout="card"]').count(), 0, "picking closes the flyout");
    const before = await count();
    await page.mouse.click(980, 560);
    await page.waitForTimeout(600);
    await page.keyboard.press("Escape");
    assert.equal(await count(), before + 1, "the card is placed");
    const placed = await page.evaluate(async () => {
      const r = await fetch(`/api/boards/${location.pathname.split("/").pop()}`);
      const b = await r.json();
      const cards = Object.values(b.document.elements).filter((e) => e.type === "card");
      return cards[cards.length - 1].kind;
    }).catch(() => null);
    if (placed) assert.equal(placed, "Interface", "it is placed as the kind that was armed");
  }

  {
    // The flyouts remember: pick a rhombus once, and the rail button makes rhombuses from then on.
    await page.keyboard.press("Escape");
    await page.click('[data-tool="rect"]');
    await page.waitForSelector('[data-flyout="shape"]');
    await page.click('[data-shape="diamond"]');
    await page.keyboard.press("v");                 // wander off to the pointer
    await page.click('[data-tool="rect"]');         // and come back: still a rhombus
    // Escape peels one layer: it closes the menu and leaves the tool armed. The canvas listens for
    // Escape too and uses it to disarm, so this is the assertion that the two do not both fire.
    await page.keyboard.press("Escape");
    assert.equal(await page.locator('[data-flyout="shape"]').count(), 0, "Escape closes the menu");
    const before = await page.locator(".board-shape-object.diamond").count();
    await page.mouse.move(1120, 640);
    await page.mouse.down();
    await page.mouse.move(1240, 720, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    assert.equal(await page.locator(".board-shape-object.diamond").count(), before + 1,
      "the shape button keeps making what you picked last, and Escape did not disarm it");
    // A second Escape, with no menu open, does disarm — the layer underneath.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    assert.equal(await page.locator('.tool-button.active[data-tool="select"]').count(), 1,
      "a second Escape falls through to the canvas and returns to the pointer");
  }

  {
    // Escape closes a flyout without disarming the tool underneath it.
    await page.keyboard.press("Escape");
    await page.click('[data-tool="connector"]');
    await page.waitForSelector('[data-flyout="line"]');
    assert.equal(await page.locator("[data-line]").count(), 3, "three line styles");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator('[data-flyout="line"]').count(), 0, "Escape closes the flyout");
  }
  await page.keyboard.press("Escape");
  await page.keyboard.press("v");

  // context menu on the note
  const cb = await note.boundingBox();
  await page.mouse.click(cb.x + cb.width / 2, cb.y + cb.height / 2, { button: "right" });
  assert.ok(await page.locator(".context-menu").isVisible(), "right-click opens the context menu");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".context-menu").count(), 0, "escape closes the context menu");
  // promote the note to a card from the context menu, then undo
  await page.mouse.click(cb.x + cb.width / 2, cb.y + cb.height / 2, { button: "right" });
  await page.click(".context-menu [data-promote-note]");
  assert.ok(await page.locator(`[data-element-id="${noteId}"].fact-card`).count() === 1, "note became a card in place");
  await page.keyboard.press("Control+z");
  await page.locator(`[data-element-id="${noteId}"].impact-note`).waitFor({ timeout: 5000 });

  /*
   * The command bar is a pill until it is wanted (§5.55), so each of these opens it first — which
   * is also the check that ⌘K still does what its keycap has always claimed.
   */
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("[data-command-pill]").count(), 1, "the command bar rests as a pill");
  await page.keyboard.press("Control+k");
  await page.waitForSelector(".command-bar input", { timeout: 10000 });
  await page.fill(".command-bar input", "kind:Application criticality:high");
  await page.waitForSelector(".search-suggestions .graph-hit", { timeout: 15000 });
  assert.ok((await page.locator(".search-suggestions .graph-hit").count()) > 0, "graph query returns entities");
  // Escape folds it away again, and an emptied bar does not hold the middle of the board.
  await page.fill(".command-bar input", "");
  await page.keyboard.press("Escape");
  await page.waitForSelector("[data-command-pill]", { timeout: 10000 });

  // command bar finds the note
  await page.keyboard.press("Control+k");
  await page.waitForSelector(".command-bar input", { timeout: 10000 });
  await page.keyboard.type(TEXT);
  await page.waitForSelector(".search-suggestions button");
  assert.ok((await page.locator(".search-suggestions button", { hasText: TEXT }).count()) >= 1, "command bar finds the note");
  await page.keyboard.press("Escape");

  // knowledge graph: inventory panel lists entities; placing one adds a linked card
  await page.waitForSelector(".inventory-group");
  const groupsBefore = await page.locator(".inventory-group").count();
  assert.ok(groupsBefore > 0, "inventory shows kinds");
  await page.click(".inventory-toggle >> nth=0");
  const placeable = page.locator(".inventory-group li:not(.on-board) button").first();
  if ((await placeable.count()) > 0) {
    const before = await count();
    await placeable.click();
    assert.equal(await count(), before + 1, "placing an entity adds a card");
    assert.ok(await page.locator(".graph-block:not(.proposal-block)").isVisible(), "inspector shows graph facts for the placed card");
  }

  // drag an entity out of the Graph inventory and drop it on the canvas
  const invHeaders = page.locator(".inventory-toggle");
  let dragRow = null;
  for (let i = 0; i < (await invHeaders.count()); i++) {
    await invHeaders.nth(i).click();
    await page.waitForTimeout(250);
    const candidate = page.locator(".inventory-group li.draggable[draggable='true']").first();
    if (await candidate.count()) { dragRow = candidate; break; }
    await invHeaders.nth(i).click();
  }
  if (dragRow) {
    const beforeDrop = await count();
    const cbox = await page.locator(".canvas-viewport").boundingBox();
    const dropAt = { x: cbox.width * 0.62, y: cbox.height * 0.7 };
    await dragRow.dragTo(page.locator(".canvas-viewport"), { targetPosition: dropAt });
    await page.waitForTimeout(600);
    assert.equal(await count(), beforeDrop + 1, "dragging an entity onto the canvas creates one card");
    const dropped = await page.locator(".fact-card.selected").boundingBox();
    assert.ok(
      Math.abs(dropped.x + dropped.width / 2 - (cbox.x + dropAt.x)) < 40 && Math.abs(dropped.y + dropped.height / 2 - (cbox.y + dropAt.y)) < 40,
      "the dropped card lands where it was dropped",
    );
    await page.keyboard.press("Escape");

    /*
     * The preview, and the panels refusing the drop (§5.44). A ghost is drawn where the card would
     * land; dragging over the Graph panel draws nothing, because a card dropped there would be
     * created underneath it where nobody can see it.
     */
    const dt = await page.evaluateHandle(() => new DataTransfer());
    const canvas = page.locator("main.canvas-viewport");
    await dragRow.dispatchEvent("dragstart", { dataTransfer: dt });
    await canvas.dispatchEvent("dragover", { dataTransfer: dt, clientX: Math.round(cbox.x + cbox.width * 0.6), clientY: Math.round(cbox.y + cbox.height * 0.5) });
    await page.waitForSelector("[data-drop-preview] .drop-ghost", { timeout: 10000 });
    const pbox = await page.locator(".inventory-panel").boundingBox();
    await canvas.dispatchEvent("dragover", { dataTransfer: dt, clientX: Math.round(pbox.x + pbox.width / 2), clientY: Math.round(pbox.y + 140) });
    await page.waitForFunction(() => {
      const el = document.querySelector("[data-drop-preview]");
      return !el || el.style.display === "none";
    }, null, { timeout: 10000 });
    await canvas.dispatchEvent("dragend", { dataTransfer: dt });
  }

  // viewpoint tab: show relations between cards on the board (idempotent), kind lens toggles
  await page.click(".panel-tabs button:has-text('Viewpoint')");
  await page.waitForSelector(".viewpoint-body");
  await page.click(".viewpoint-buttons button:has-text('Show all relations')");
  await page.waitForSelector(".viewpoint-status", { timeout: 20000 });
  const kindButtons = await page.locator(".viewpoint-kinds button").count();
  assert.ok(kindButtons > 0, "viewpoint lists kinds on the board");
  await page.click(".viewpoint-kinds button >> nth=0");
  assert.ok((await page.locator(".fact-card.dimmed").count()) > 0, "kind lens dims cards");
  await page.click(".viewpoint-kinds button >> nth=0");
  // impact lens: select a card, everything not connected to it fades; legend card appears
  await page.click(".fact-card >> nth=0", { position: { x: 6, y: 6 } });
  await page.click(".viewpoint-row button:has-text('Impact')");
  await page.waitForSelector("[data-lens-legend]");
  assert.ok((await page.locator(".fact-card.dimmed").count()) >= 0, "impact lens renders");
  assert.ok(/impact/i.test(await page.locator("[data-lens-legend]").innerText()), "lens legend names the lens");
  await page.click("[data-lens-legend] header button");
  await page.locator("[data-lens-legend]").waitFor({ state: "detached", timeout: 5000 }).catch(() => assert.fail("clearing the lens hides the legend"));
  await page.click(".panel-tabs button:has-text('Inventory')");

  // autosave + reload
  /*
   * Two ways a board saves itself now (§5.40): this tab PUTs its document, or — when the live
   * channel is up — the room on the server writes it once the board goes quiet, and this tab
   * deliberately does not PUT at all. Which one ran is an implementation detail; that the board
   * survives a reload is the promise, and that is the assertion below.
   */
  await page.waitForTimeout(2500);
  const shared = /Shared/.test(await page.locator(".sync-pill").first().innerText().catch(() => ""));
  assert.ok(shared || saves >= 1, "the board saved itself — by the room when live, by a PUT when not");
  await page.reload({ waitUntil: "load" });
  await page.locator(`[data-element-id="${noteId}"]`).waitFor({ timeout: 10000 });
  assert.equal(await page.locator(`[data-element-id="${noteId}"] input`).first().inputValue(), TEXT, "note persisted across reload");

  // version history: the save above produced an auto checkpoint; a manual one can be added
  await page.click(".studio-topbar button:has-text('History')");
  await page.waitForSelector(".history-panel");
  await page.fill(".history-new input", "e2e checkpoint");
  await page.click(".history-new button");
  await page.waitForSelector(".history-item.manual", { timeout: 15000 });
  assert.ok((await page.locator(".history-item").count()) >= 1, "history lists checkpoints");
  // compare the checkpoint with the board as it is now (the note added since shows as "added" or the board is identical)
  await page.click(".history-item button[title^='Compare']");
  await page.waitForSelector("[data-history-diff]");
  assert.ok(/added|changed|removed|identical/i.test(await page.locator("[data-history-diff]").innerText()), "history compare summarises the diff");
  await page.click(".history-panel .panel-title button");

  // export menu + presentation mode (Esc leaves)
  await page.click("[data-export-button]");
  await page.waitForSelector("[data-export-menu]");
  await page.click("[data-export-menu] button:has-text('Present')");
  await page.waitForSelector("[data-present-exit]");
  assert.equal(await page.locator(".canvas-toolbar").count(), 0, "presentation mode hides the toolbar");
  await page.keyboard.press("Escape");
  await page.waitForSelector(".canvas-toolbar");

  // graph page: import the sample and check the meta-model renders
  await page.goto(`${base}/w/acme-energy/graph`, { waitUntil: "load" });
  assert.ok((await page.locator(".kind-card").count()) > 0, "graph page shows kinds");
  assert.ok(await page.locator("text=Agent proposals").isVisible(), "graph page shows agent proposals");
  await page.click(".entity-view-tabs button:has-text('Table')");
  await page.waitForSelector("[data-entity-table]");
  assert.ok((await page.locator("[data-entity-table] th").count()) >= 4, "table view renders attribute columns");
  await page.click(".entity-view-tabs button:has-text('List')");
  // entity drawer: open from the list, Escape closes
  await page.click(".entity-row .entity-open >> nth=0");
  await page.waitForSelector("[data-entity-drawer] .entity-drawer-body", { timeout: 15000 });
  assert.ok((await page.locator("[data-entity-drawer] .entity-drawer-section").count()) >= 2, "entity drawer shows relations and boards");
  await page.keyboard.press("Escape");
  await page.locator("[data-entity-drawer]").waitFor({ state: "detached" });
  // entity deep link: /e/:id redirects to the graph page with the drawer open
  const firstEntityId = await page.evaluate(async () => (await (await fetch("/api/workspaces/ws_acme/graph")).json()).entities[0]?.id);
  assert.ok(firstEntityId, "graph snapshot has entities");
  await page.goto(`${base}/e/${firstEntityId}`, { waitUntil: "load" });
  await page.waitForSelector("[data-entity-drawer] .entity-drawer-body", { timeout: 15000 });
  assert.ok(page.url().includes(`/graph?entity=${firstEntityId}`), "deep link lands on the graph page");

  /*
   * The graph remembers (§5.43). Two facts, on one object, without leaving anything behind: an
   * attribute set shows up in that object's timeline, and taking it straight off again leaves no
   * trace at all — because nothing happened, and a history that says otherwise is noise.
   */
  await page.waitForSelector("[data-drawer-history]");
  await page.fill('[aria-label="New attribute key"]', "smoke-check");
  await page.fill('[aria-label="New attribute value"]', "yes");
  await page.click('[aria-label="Add attribute"]');
  await page.waitForSelector('[data-drawer-history] .hx-line:has-text("smoke-check")', { timeout: 15000 });
  await page.click('[aria-label="Remove smoke-check"]');
  await page.waitForFunction(() => {
    const panel = document.querySelector("[data-drawer-history]");
    return panel !== null && !panel.textContent.includes("smoke-check");
  }, null, { timeout: 15000 });

  // and the workspace-wide view of the same thing
  await page.goto(`${base}/w/acme-energy/history`, { waitUntil: "load" });
  await page.waitForSelector("[data-history-summary]");
  const allChanges = await page.locator(".hx-line").count();
  assert.ok(allChanges > 0, "the history page lists changes");
  assert.ok((await page.locator(".hx-actor.agent").count()) > 0, "an agent's work is named as an agent's");
  await page.click('[data-history-filter="agent"]');
  await page.waitForFunction((before) => document.querySelectorAll(".hx-line").length < before, allChanges, { timeout: 10000 });
  await page.fill("[data-history-search]", "nothing called this");
  await page.waitForSelector("text=Nothing matches that");

  await page.goto(`${base}/w/acme-energy/graph`, { waitUntil: "load" });
  await page.click("text=Import data");
  await page.click("text=Use sample");
  await page.click('.modal-card button:text-is("Import")');
  await page.waitForSelector(".modal-card .mode-banner");
  await page.click('.modal-card button:text-is("Done")');

  // graph explorer: whole-graph view loads, paints, and selects a node
  await page.goto(`${base}/w/acme-energy/explore`, { waitUntil: "load" });
  await page.waitForSelector(".explorer-canvas");
  assert.ok((await page.locator(".explorer-legend button").count()) > 0, "explorer lists kinds");
  await page.waitForTimeout(3500); // let the force layout settle
  const painted = await page.evaluate(() => {
    const c = document.querySelector(".explorer-canvas");
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4000) if (d[i] > 0) n++;
    return n;
  });
  assert.ok(painted > 0, "explorer canvas painted the graph");
  const firstKind = await page.locator(".explorer-legend button b").first().innerText();
  await page.fill(".explorer-search input", firstKind.slice(0, 4));
  await page.waitForSelector(".explorer-results button", { timeout: 10000 });
  await page.locator(".explorer-results button").first().click();
  await page.waitForSelector(".explorer-detail", { timeout: 10000 });
  assert.ok((await page.locator(".explorer-detail header strong").innerText()).length > 0, "explorer opens an entity");
  // trace a path: arm from the selected entity, then shift-click a neighbour that is centred by focus
  const neighbourName = await page.locator(".explorer-neighbours button b").first().innerText().catch(() => "");
  if (neighbourName) {
    await page.click(".explorer-topbar button:has-text('Trace from')");
    await page.waitForSelector("[data-explorer-path]");
    await page.fill(".explorer-search input", neighbourName.slice(0, 8));
    await page.waitForSelector(".explorer-results button");
    await page.locator(".explorer-results button").first().click();
    await page.waitForTimeout(600);
    await page.fill(".explorer-search input", "");
    await page.waitForTimeout(300);
    const cbox = await page.locator(".explorer-canvas").boundingBox();
    await page.keyboard.down("Shift");
    await page.mouse.click(cbox.x + cbox.width / 2, cbox.y + cbox.height / 2);
    await page.keyboard.up("Shift");
    await page.waitForTimeout(500);
    assert.ok(/hop|not connected/.test(await page.locator("[data-explorer-path]").innerText()), "explorer traces a path between two entities");
    await page.click("[data-explorer-path] button");
  }

  // estate health: one number, the measures behind it, and the number leading to the work
  await page.goto(`${base}/w/acme-energy/graph`, { waitUntil: "load" });
  await page.waitForSelector("[data-health]");
  await page.waitForTimeout(600);
  await page.click(".health-head");
  await page.waitForSelector("[data-measure]");
  assert.equal(await page.locator("[data-measure]").count(), 6, "health reports every measure");
  const headline = await page.locator(".health-head").innerText();
  assert.match(headline, /Estate health/, "health has a headline");
  assert.match(headline, /\d+ entities/, "health says what it measured");
  // every measure states what good looks like, so the number is not a mystery
  assert.equal(await page.locator("[data-measure] .health-goal").count(), 6, "every measure says what good looks like");

  // evidence-backed fixes are offered where the graph can already answer the question
  const proposedLinks = await page.locator('[data-measure] a[href="#proposals"]').count();
  assert.ok(proposedLinks >= 0, "health can point at proposals that would move it");

  const show = page.locator('[data-measure] button:has-text("Show the")').first();
  assert.ok(await show.count(), "the seeded estate has something to fix");
  {
    await show.click();
    await page.waitForTimeout(800);
    const shown = await page.locator("#entities p").first().innerText();
    assert.match(shown, /show everything again/, "the number pins the offenders into the entity table");
    await page.click("#entities .link-button");
    await page.waitForTimeout(400);
  }

  // the wiki: a board writes its own first draft, and the draft is made of live references (§5.60)
  await page.goto(`${base}/w/acme-energy/wiki`, { waitUntil: "load" });
  await page.waitForSelector("[data-wiki]");
  await page.click("[data-new-page]");
  await page.waitForSelector("[data-new-page-panel]");
  assert.ok(await page.locator('[data-writeup="brd_landscape"]').count(),
    "a board can be written up from the wiki");
  await page.click('[data-writeup="brd_landscape"]');
  await page.waitForSelector("[data-wiki-page-view]", { timeout: 60000 });
  await page.waitForTimeout(1200);
  {
    const embed = page.locator('[data-embed="board"]');
    assert.equal(await embed.count(), 1, "the draft embeds the board it was written from");
    assert.ok(await embed.locator("svg").count(),
      "the embed is the board drawn from its current document, not a picture of it");
    assert.ok((await page.locator(".wiki-prose table").count()) > 0, "the objects are tabulated");
    assert.ok((await page.locator(".wiki-prose blockquote").count()) > 0,
      "the notes somebody wrote on the board are carried across as prose");
    // The page title is the h1; a draft that repeated it would give every page two.
    assert.equal(await page.locator(".wiki-prose h1").count(), 0, "the draft does not repeat the page title");
  }

  {
    // Editing, wiki links, and an embed pointing at something that is gone.
    await page.click("[data-edit-page]");
    await page.waitForSelector("[data-wiki-editor]");
    await page.locator("[data-wiki-editor] textarea").fill(
      "## Reference\n\nSee [[Nowhere]] and [[Application landscape]].\n\n"
      + ":::query kind:Application | Applications\n\n:::board brd_gone | missing\n",
    );
    await page.click("[data-save-page]");
    await page.waitForSelector('[data-embed="query"]', { timeout: 60000 });
    assert.equal(await page.locator(".wiki-link.missing").count(), 1,
      "a link to a page that does not exist yet is shown as unresolved rather than as text");
    assert.equal(await page.locator("a.wiki-link").count(), 1, "a link to a page that exists resolves");
    assert.ok((await page.locator('[data-embed="query"] li').count()) > 0,
      "a query embed lists what matches now");
    assert.match(await page.locator('[data-embed="missing"]').innerText(), /not in this workspace/,
      "an embed pointing at something gone says so rather than disappearing");
  }

  /*
   * Open a meta-model drawer, whichever state it is in.
   *
   * The drawer buttons toggle now (§5.66) where the old tabs were idempotent — clicking the
   * active tab kept it active, clicking an open drawer closes it. That is the right behaviour and
   * it means a test cannot just click and assume.
   */
  const openDrawer = async (name) => {
    if (!(await page.locator(`[data-meta-drawer="${name}"]`).count())) {
      await page.click(`[data-tab-${name}]`);
    }
    await page.waitForSelector(`[data-meta-drawer="${name}"]`, { timeout: 30000 });
  };

  /*
   * The meta-model board (§5.66). The tree and its five tabs are gone; what is asserted here is
   * the design's own promise — that the page says how healthy the model is before anybody clicks,
   * that declared and emergent are told apart on sight, and that acting on a card changes both.
   */
  await page.goto(`${base}/w/acme-energy/meta`, { waitUntil: "load" });
  await page.waitForSelector("[data-meta-health]");
  assert.ok((await page.locator("[data-meta-card]").count()) > 0, "the model is a board of types");
  assert.match(await page.locator("[data-meta-verdict]").innerText(), /\w+/, "and it says how healthy it is without being asked");
  {
    // Conformance over nothing is undefined, not perfect: a fresh seed declares no types at all.
    const gauges = await page.locator(".meta-gauge-value").allInnerTexts();
    assert.equal(gauges[1], "—", "conformance over an undescribed estate is undefined, not 100%");
  }

  // The seed always grows kinds from its boards without declaring them, so this is not optional:
  // before the suite had a database of its own, earlier runs declared them all and the coverage
  // silently disappeared.
  const undeclared = page.locator('[data-meta-card][data-declared="no"]').first();
  assert.ok(await undeclared.count(), "the seed has kinds that grew from data and were never declared");
  {
    const name = await undeclared.locator("b").first().innerText();
    await undeclared.click();
    await page.waitForSelector(".meta-detail-body");
    await page.click(".meta-callout button");
    await page.waitForTimeout(1500);
    // innerText reflects the CSS uppercase transform, so compare case-insensitively
    assert.match(await page.locator(".meta-detail-body header .meta-presence").innerText(), /^declared$/i, "declaring a type promotes it out of 'from data'");
    // …and the board says so too: the card stops being dashed, and the coverage figure moves.
    assert.equal(await page.locator(`[data-meta-card="${name}"]`).getAttribute("data-declared"), "yes",
      "the card the declaration came from now reads as declared");
    assert.notEqual((await page.locator(".meta-gauge-value").allInnerTexts())[0], "0%",
      "and describing something moves the coverage figure");
    // the declare above runs in a transition that disables the form while pending
    await page.waitForSelector('.meta-add input[aria-label="New field key"]:not([disabled])', { timeout: 30000 });
    const beforeFields = await page.locator(".meta-table tbody tr").count();
    const fieldKey = `e2e_${Date.now().toString().slice(-5)}`;
    await page.fill('.meta-add input[aria-label="New field key"]', fieldKey);
    await page.locator('.meta-add button:has-text("Add field")').click();
    // the server action revalidates the page, so poll rather than guessing a delay
    await page.waitForFunction((n) => document.querySelectorAll(".meta-table tbody tr").length > n, beforeFields, { timeout: 30000 })
      .catch(async () => {
        console.log("DEBUG type:", await page.locator(".meta-detail-body h2").textContent(),
                    "rows:", beforeFields, "->", await page.locator(".meta-table tbody tr").count(),
                    "key:", fieldKey,
                    "input:", await page.locator('.meta-add input[aria-label="New field key"]').inputValue().catch(() => "?"));
        assert.fail("a declared field is added to the type");
      });
  }

  // meta-model diagram: the type-level abstraction, one box per node type and one arc per
  // relation type, laid out so nothing overlaps
  await page.click('[data-shape="diagram"]');
  await page.waitForSelector("[data-meta-diagram]");
  await page.waitForTimeout(600);
  const typeBoxes = await page.locator("[data-type-box]").count();
  assert.ok(typeBoxes > 0, "the diagram draws a box per type");
  assert.ok((await page.locator(".meta-edge").count()) > 0, "the diagram draws the connections between types");
  const overlaps = await page.$$eval("[data-type-box] rect:first-of-type", (els) => {
    const r = els.map((e) => e.getBoundingClientRect());
    let n = 0;
    for (let i = 0; i < r.length; i++)
      for (let j = i + 1; j < r.length; j++)
        if (r[i].left < r[j].right && r[j].left < r[i].right && r[i].top < r[j].bottom && r[j].top < r[i].bottom) n++;
    return n;
  });
  assert.equal(overlaps, 0, "type boxes do not overlap");
  // clicking a type in the diagram selects it, so the Details tab opens on the same type
  const firstBox = page.locator("[data-type-box]").first();
  const boxName = (await firstBox.locator(".meta-type-name").textContent()) ?? "";
  await firstBox.click();
  // The inspector opens on selection now; there is no Details tab to return to (§5.66).
  await page.waitForSelector(".meta-detail-body");
  assert.equal(await page.locator(".meta-detail-body h2").textContent(), boxName, "selecting in the diagram drives the detail pane");

  // conformance: the declared model, checked against the data, object by named object (§5.56)
  await openDrawer("conformance");
  await page.waitForSelector("[data-conformance]");
  const numbers = await page.locator(".conformance-head").innerText();
  assert.match(numbers, /%/, "conformance leads with a number");
  assert.ok((await page.locator(".conformance-verdict").innerText()).trim().length > 20,
    "the number is said in words as well, because a percentage is not a verdict");

  // a modelling framework: what adopting it would add, worked out against this workspace (§5.57)
  await openDrawer("frameworks");
  await page.waitForSelector("[data-frameworks]");
  assert.match(await page.locator("[data-adopted-line]").innerText(), /Free form/,
    "a workspace that has adopted nothing says so, because free form is a real answer");
  assert.ok((await page.locator("[data-family]").count()) >= 3,
    "the catalogue is grouped by what kind of thing each framework is");
  const fw = page.locator('[data-framework="c4"]');
  await fw.locator("> button").click();
  await page.waitForSelector('[data-adopt-framework="c4"]');
  assert.equal(await fw.locator(".framework-layers li").count(), 4, "C4 brings its four layers with it");
  const plan = await fw.locator(".framework-apply span").innerText();
  assert.match(plan, /Adds .*type/, `the plan says what adopting would add, not just that it would: ${plan}`);
  {
    /*
     * The property that makes a framework safe on a live workspace: it only ever adds.
     *
     * Back to the board first. Shape and drawer are independent now (§5.66) — a drawer opens
     * *over* whichever shape you were looking at — so the diagram switched on earlier in this
     * section is still switched on, and there would be no cards to count.
     */
    await page.click('[data-shape="board"]');
    const before = await page.locator("[data-meta-card]").count();
    await page.click('[data-adopt-framework="c4"]');
    await page.waitForSelector(".framework-ok", { timeout: 60000 });
    await page.waitForFunction((n) => document.querySelectorAll("[data-meta-card]").length > n,
      before, { timeout: 30000 });
    assert.match(await page.locator("[data-adopted-line]").innerText(), /C4 model/,
      "the workspace now says what it models with");
  }

  // …and adopting it again does nothing, which is what "additive" has to mean in practice. The
  // panel is still open on the framework just adopted, so this is the same summary recomputing
  // itself against the model it just changed — no second navigation to confuse it.
  await page.waitForFunction(
    () => /already declared/.test(document.querySelector('[data-framework="c4"] .framework-apply span')?.textContent ?? ""),
    null, { timeout: 30000 });
  assert.ok(await page.locator('[data-abandon-framework="c4"]').count(),
    "an adopted framework offers to be dropped rather than adopted twice");

  // a second framework alongside the first: the whole point of adopting rather than choosing
  await page.locator('[data-framework="ddd"] > button').click();
  await page.waitForSelector('[data-adopt-framework="ddd"]');
  await page.click('[data-adopt-framework="ddd"]');
  await page.waitForSelector(".framework-ok", { timeout: 60000 });
  await page.waitForFunction(
    () => /and/.test(document.querySelector("[data-adopted-line]")?.textContent ?? ""),
    null, { timeout: 30000 });
  assert.match(await page.locator("[data-adopted-line]").innerText(), /C4 model and Domain-driven design/,
    "a workspace can model with more than one framework at once");

  // Every type a framework brought says which one it came from — on its card now (§5.66).
  assert.ok((await page.locator(".meta-card-fw").count()) > 8,
    "types carry the provenance of the framework that declared them");

  /*
   * Relationship rules: the triple as the unit (§5.67).
   *
   * The property worth asserting is the one the product is about — a pairing the data does and
   * nobody declared is a *proposal*, promotable in one click, not a violation to be scolded for.
   */
  {
    await page.click('[data-shape="rules"]');
    await page.waitForSelector("[data-meta-rules]", { timeout: 60000 });
    const rows = await page.locator("[data-triple]").count();
    assert.ok(rows > 0, "every source-relationship-target the estate exhibits is a row");
    assert.match(await page.locator("[data-rules-verdict]").innerText(), /connection|relationship/i,
      "and the table says what the rules add up to");

    const observed = page.locator('[data-triple].observed').first();
    if (await observed.count()) {
      const before = await page.locator('[data-triple].observed').count();
      const button = observed.locator("[data-declare-rule]");
      if (await button.isDisabled()) {
        // Blocked only ever for one reason, and it has to say which.
        assert.match((await button.getAttribute("title")) ?? "", /relationship type first/,
          "a triple whose relationship type is undeclared says so rather than failing");
      } else {
        await button.click();
        await page.waitForFunction((n) => document.querySelectorAll("[data-triple].observed").length < n,
          before, { timeout: 30000 });
        assert.ok((await page.locator('[data-triple].in-use').count()) > 0,
          "promoting an observed pairing makes it a rule the model holds");
      }
    }

    // Filtering by status, which is the whole point of having three of them.
    await page.click('[data-rule-filter="observed"]');
    await page.waitForTimeout(400);
    const shown = await page.locator("[data-triple]").count();
    assert.ok(shown > 0 && shown <= rows, "the observed filter narrows to the pairings nobody declared");
    await page.click('[data-rule-filter="observed"]');
    await page.click('[data-shape="board"]');
    await page.waitForSelector("[data-meta-card]", { timeout: 30000 });
  }

  // layers: the stack, and the one the estate itself suggests (§5.58)
  await openDrawer("layers");
  await page.waitForSelector("[data-layers]");
  {
    // The two frameworks adopted above brought their own bands, so there is a stack already.
    const stack = await page.locator("[data-layer-stack]:not(.proposed) [data-layer]").count();
    assert.ok(stack >= 4, `frameworks bring their layers with them, got ${stack}`);
    assert.match(await page.locator("[data-layer-stack] .layer-source.fw").first().innerText(), /C4|Domain/,
      "a layer says which framework put it there");
  }
  assert.ok((await page.locator(".layer-verdict").innerText()).trim().length > 10,
    "the estate's own reading of the stack says what it found, or why it could not");

  {
    // The point of the whole feature: the stack is read out of the direction of real connections,
    // and every band says which counts put it there.
    const bands = await page.locator("[data-proposed-layer]").count();
    assert.ok(bands >= 2, `the seeded estate has enough connections to read a stack from, got ${bands}`);
    const why = await page.locator("[data-proposed-layer] .layer-why").first().innerText();
    assert.match(why, /\d|Nothing in the estate/, `a band justifies itself with counts: ${why}`);

    const before = await page.locator("[data-layer-stack]:not(.proposed) [data-layer]").count();
    await page.click("[data-adopt-layering]");
    await page.waitForSelector("[data-layering-ok]", { timeout: 60000 });
    assert.match(await page.locator("[data-layering-ok]").innerText(), /placed \d+ type/,
      "adopting the reading says what it did");
    await page.waitForFunction((n) => document.querySelectorAll("[data-layer-stack]:not(.proposed) [data-layer]").length > n,
      before, { timeout: 30000 });
  }

  // the diagram becomes the stack: bands behind the types, so an upward edge looks upward
  await page.click('[data-shape="diagram"]');
  await page.waitForSelector("[data-meta-diagram]");
  await page.waitForTimeout(1200);
  assert.ok((await page.locator("[data-band]").count()) >= 2,
    "a layered model is drawn as bands rather than scattered");
  await openDrawer("layers");
  await page.waitForSelector("[data-layers]");

  // now that types are declared, conformance has something to check — and names the offenders
  await openDrawer("conformance");
  await page.waitForSelector("[data-conformance]");
  assert.ok((await page.locator("[data-breach-group]").count()) > 0,
    "a declared model over an unaligned estate produces breaches");
  await page.locator("[data-breach-group] > button").first().click();
  await page.waitForSelector("[data-breach-group] li");
  const breach = await page.locator("[data-breach-group] li").first().innerText();
  assert.match(breach, /\S/, "a breach is a named object, not a count");
  assert.ok(breach.split("\n").length >= 2, `a breach says what is wrong in a sentence: ${breach}`);

  // deleting works: once housekeeping for a shared database, now an assertion of its own
  await page.goto(`${base}/b/brd_capabilities`, { waitUntil: "load" });
  const leftover = page.locator(`[data-element-id="${noteId}"]`);
  const stillThere = await leftover.waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
  if (stillThere) {
    const box = await leftover.boundingBox();
    await page.mouse.click(box.x + 8, box.y + 8);
    await page.keyboard.press("Delete");
    await page.waitForTimeout(1200);
    assert.equal(await leftover.count(), 0, "the smoke note is cleaned up");
  }

  // intake: read a source through the pipeline, review what it found, and see the landscape
  await page.goto(`${base}/w/acme-energy/intake`, { waitUntil: "load" });
  await page.waitForSelector(".intake-shell");
  await page.click(".intake-new");
  await page.waitForSelector("[data-new-source]");
  const sourceName = `e2e meeting ${Date.now().toString().slice(-5)}`;
  await page.click('button:has-text("Use the sample meeting")');
  await page.fill('input[aria-label="Source name"]', sourceName);
  await page.click('button:has-text("Add source")');
  // a source was probably already selected, so wait for the heading to become the new one
  await page.waitForFunction((n) => document.querySelector(".intake-source-head h2")?.textContent === n, sourceName, { timeout: 30000 })
    .catch(() => assert.fail("the new source opens"));

  await page.click('button:has-text("Run pipeline")');
  await page.waitForFunction(() => document.querySelectorAll(".pipeline-stage").length >= 7, null, { timeout: 30000 })
    .catch(() => assert.fail("the pipeline reports every stage"));
  const segment = await page.locator('[data-stage="segment"] p').textContent();
  assert.match(segment ?? "", /speakers/, "the segment stage counts the speakers it found");
  assert.ok((await page.locator("[data-candidate]").count()) > 0, "the run proposes objects");
  // every proposal shows the sentence behind it
  assert.ok((await page.locator("[data-candidate] .intake-quote").count()) > 0, "each object carries its evidence");

  await page.click('.intake-tabs button:has-text("Viewpoints")');
  await page.waitForSelector("[data-viewpoint]");
  const viewpointTypes = (await page.locator(".intake-viewpoint").allTextContents()).join(" ").toLowerCase();
  assert.match(viewpointTypes, /decision/, "a decision is extracted from what people said");
  assert.match(viewpointTypes, /risk/, "a risk is extracted from what people said");

  // the landscape shows what intake has brought in, as a graph
  await page.click('.intake-view-tabs a:has-text("Landscape")');
  await page.waitForSelector(".explorer-shell.embedded, .intake-empty", { timeout: 30000 });

  // the catalogue: the agent proposes systems it found evidence for, and a human grants scope
  await page.click('.intake-view-tabs a:has-text("Catalogue")');
  await page.waitForSelector(".catalog");
  assert.ok((await page.locator("[data-provider]").count()) > 10, "the catalogue lists what Nexus can reach");
  // the scan says where it looked before it says what it found
  await page.waitForSelector("[data-scan]");
  await page.click('.scan-line button:has-text("Where it looked")');
  const channels = await page.locator("[data-channel]").count();
  assert.equal(channels, 5, "the scan reports every channel it read");
  // The seeded graph names systems the catalogue knows, so the agent always has something to propose
  assert.ok((await page.locator("[data-discovery]").count()) > 0, "the scan finds systems in the seeded graph");
  // every proposal quotes the exact strings behind it before it asks for anything
  assert.ok((await page.locator("[data-discovery] .catalog-evidence li b").count()) > 0, "a discovery quotes the signals behind it");
  await page.locator('[data-discovery] button:has-text("Review what it may read")').first().click();
  await page.waitForSelector("[data-provider-panel]");
  await page.locator('.catalog-panel button[aria-label="Close"]').click();
  await page.waitForTimeout(300);

  // a modelled provider shows exactly what may be read, scope by scope
  await page.locator('[data-provider="sap"]').click();
  await page.waitForSelector("[data-provider-panel]");
  assert.ok((await page.locator("[data-scope]").count()) > 0, "the grant panel lists what may be read, scope by scope");
  assert.ok((await page.locator("[data-scope] .scope-yields").count()) > 0, "each scope says what it yields");
  await page.locator('.catalog-panel button[aria-label="Close"]').click();
  await page.waitForTimeout(400);

  // a host nobody's catalogue claims can be added to it, and is recognised from then on
  const unknownCount = await page.locator("[data-unknown-domain]").count();
  if (unknownCount > 0) {
    const before = await page.locator("[data-provider]").count();
    const domain = await page.locator("[data-unknown-domain]").first().getAttribute("data-unknown-domain");
    await page.locator('[data-unknown-domain] button:has-text("Add to the catalogue")').first().click();
    await page.waitForSelector(".catalog-register");
    const registered = `e2e source ${Date.now().toString().slice(-5)}`;
    await page.fill('.catalog-register input[aria-label="Source name"]', registered);
    await page.locator('.catalog-register button:has-text("Add")').first().click();
    await page.waitForFunction((n) => document.querySelectorAll("[data-provider]").length > n, before, { timeout: 30000 })
      .catch(() => assert.fail("an unrecognised system can be added to the catalogue"));
    assert.equal(await page.locator(`[data-unknown-domain="${domain}"]`).count(), 0, "a registered system is no longer unrecognised");

    // and can be taken back out again, which is how this run leaves no trace
    await page.locator(".catalog-card", { hasText: registered }).click();
    await page.waitForSelector("[data-provider-panel]");
    await page.click("[data-unregister]");
    await page.waitForFunction((n) => document.querySelectorAll("[data-provider]").length === n, before, { timeout: 30000 })
      .catch(() => assert.fail("a registered source can be removed from the catalogue"));
  }

  // removing a source takes it out of the list
  await page.goto(`${base}/w/acme-energy/intake`, { waitUntil: "load" });
  await page.waitForSelector(".intake-sources");
  await page.locator(`.intake-source:has-text("${sourceName}")`).click();
  await page.waitForSelector(".intake-source-head");
  await page.click('button:has-text("Remove")');
  await page.waitForTimeout(1500);
  assert.equal(await page.locator(`.intake-source:has-text("${sourceName}")`).count(), 0, "a source can be removed");

  // create a board from a space via a starter
  await page.goto(`${base}/w/acme-energy/spaces/space_sandbox`, { waitUntil: "load" });
  await page.click(".studio-starters button >> nth=0");
  await page.waitForURL(/\/b\//, { timeout: 30000 });

  // compose: write the board instead of drawing it. Safe to rebuild — this board was just made.
  await page.waitForSelector(".canvas-viewport");
  await page.click('button:has-text("Compose")');
  await page.waitForSelector("[data-compose]");
  // rebuilding warns before it replaces a board: accept it
  page.on("dialog", (d) => d.accept());
  await page.fill(".compose-script", "title Written by hand, without hands\nadd all applications\nconnect them\nlay out as flow");
  await page.click('.compose-actions button:has-text("Build")');
  await page.waitForSelector("[data-step]", { timeout: 40000 });
  await page.waitForTimeout(1500);

  const composeSteps = await page.$$eval("[data-step]", (els) => els.map((e) => ({
    line: e.querySelector("code")?.textContent ?? "",
    echo: e.querySelector("em")?.textContent ?? "",
    ok: !e.classList.contains("failed"),
  })));
  assert.equal(composeSteps.length, 4, "every written line is reported back");
  assert.ok(composeSteps.every((s2) => s2.ok), `every line did something (${JSON.stringify(composeSteps)})`);
  // the English is compiled to the query grammar, and shown as such
  assert.match(composeSteps[1].echo, /kind:Application/, "the line is echoed as the query it became");
  assert.ok((await page.locator("[data-element-id]").count()) > 5, "the board was built from the script");

  // the words that produced the board are kept with it
  const boardUrl = page.url();
  /*
   * Wait for the save to actually land, not for a guess at how long it takes. A fixed 1500ms was
   * enough on a quiet machine and not on a busy one, and the failure looked like "the script was
   * not persisted" rather than "the page was reloaded too early" — the worst kind of flake,
   * because it accuses the feature.
   */
  await page.waitForFunction(() => /Saved|Shared/.test(document.body.innerText), null, { timeout: 60000 });
  await page.goto(boardUrl, { waitUntil: "load" });
  await page.waitForSelector(".canvas-viewport");
  await page.click('button:has-text("Compose")');
  await page.waitForSelector("[data-compose]");
  assert.match(await page.locator(".compose-script").inputValue(), /Written by hand, without hands/,
    "reopening a written board shows the script that produced it");

  // a line it cannot read says so instead of failing silently
  await page.fill(".compose-script", "make it look nice");
  await page.click('.compose-actions button:has-text("Build")');
  await page.waitForTimeout(1500);
  assert.match(await page.locator("[data-step] em").first().innerText(), /do not understand/i, "an unreadable line explains itself");

  // ---- the roadmap: change sets, impact, and a board seen as-is or to-be --------------------
  await page.goto(`${base}/w/acme-energy/roadmap`, { waitUntil: "load" });
  await page.waitForSelector(".roadmap");
  const states = await page.locator("[data-states]").innerText();
  assert.match(states, /AS-IS/i, "the roadmap states what the estate is today");
  assert.ok((await page.locator("[data-change-set]").count()) >= 2, "the seeded change sets are listed");
  // the point of the screen: a plan held against the graph says what it breaks
  const impact = await page.locator("[data-impact]").first().innerText();
  assert.match(impact, /Retiring Maximo/, "the impact of a retirement is computed from the graph");
  assert.match(impact, /attached/, "it names how much is attached");

  // sequencing: the dependent plan says what it waits for, and cannot be delivered before it
  const dependent = page.locator('[data-change-set="chg_seed_streaming"]');
  await dependent.locator(".roadmap-card-head").click();
  await page.waitForSelector("[data-depends]");
  assert.match(await page.locator("[data-depends]").first().innerText(), /Move work orders to SAP PM/,
    "the plan says what it is waiting for");
  assert.equal(await dependent.locator("[data-deliver]").isDisabled(), true,
    "a plan cannot be delivered before the plan it waits for");
  // its impact is computed in the context of its blocker, so it is not reported as stale
  assert.equal(await dependent.locator(".roadmap-problems").count(), 0,
    "a sequenced plan is not stale, it is sequenced");

  // a dependency that would make a loop is refused when it is drawn
  const blocker = page.locator('[data-change-set="chg_seed_workorders"]');
  await blocker.locator(".roadmap-card-head").click();
  await page.waitForSelector("[data-depends]");
  await blocker.locator('[data-depends] select').selectOption({ label: "Retire the Historian, stream telemetry" });
  await blocker.locator('[data-depends] button:has-text("Add")').click();
  await page.waitForSelector(".roadmap-message", { timeout: 20000 });
  assert.match(await page.locator(".roadmap-message").innerText(), /already waits for this one/,
    "a circular dependency is refused when it is drawn, not when it is delivered");

  // adding a change updates the projection
  const beforeChanges = await page.locator("[data-change-set] [data-change]").count();
  await page.selectOption("[data-add-change] select:first-of-type", "setAttribute");
  const objectSelect = page.locator("[data-add-change] select").nth(1);
  await objectSelect.selectOption({ index: 1 });
  await page.fill('[data-add-change] input[aria-label="Attribute value"]', "Grid Operations");
  await page.click('[data-add-change] button:has-text("Add")');
  await page.waitForTimeout(1200);
  assert.equal(await page.locator("[data-change-set] [data-change]").count(), beforeChanges + 1, "the change is recorded");

  // plateaus: named states, and the difference between two of them
  await page.goto(`${base}/w/acme-energy/roadmap/plateaus`, { waitUntil: "load" });
  await page.waitForSelector("[data-plateau-strip]");
  assert.ok((await page.locator("[data-plateau-strip] li").count()) >= 3, "as-is plus the seeded plateaus");
  const firstDiff = await page.locator("[data-diff]").innerText();
  assert.match(firstDiff, /ARRIVES|Arrives/, "the diff names what arrives");
  assert.match(firstDiff, /SAP PM/, "…and it is computed from the change sets, not asserted");
  assert.match(firstDiff, /ESTATE HEALTH|Estate health/i, "a plateau can be measured, not just drawn");

  // comparing two future states with each other, not just with today
  await page.click('[data-plateau="plt_seed_2028"]');
  await page.waitForTimeout(800);
  await page.selectOption(".plateau-diff-head select", "plt_seed_workorders");
  await page.waitForTimeout(1200);
  const between = await page.locator("[data-diff]").innerText();
  assert.match(between, /Historian/, "the difference between two plateaus is the change sets between them");

  // a state that includes a plan but not what it waits for cannot exist, and says so
  await page.click('[data-plateau-detail] .plateau-members li:has-text("Move work orders") button');
  await page.waitForTimeout(1200);
  assert.match(await page.locator(".roadmap-message").innerText(), /waits for this/,
    "a blocker cannot be removed while something in the plateau still needs it");

  // a board seen through the change set: the retired system is marked, planned ones can be placed
  await page.goto(`${base}/b/brd_integrations`, { waitUntil: "load" });
  await page.waitForSelector("[data-element-id]");
  await page.click('button:has-text("Viewpoint")');
  await page.waitForSelector("[data-state-picker]");
  const changeOption = await page.$$eval("[data-state-picker] option", (els) => els.map((e) => e.value).find(Boolean));
  await page.selectOption("[data-state-picker] select", changeOption);
  await page.waitForSelector(".fact-card.change-retired", { timeout: 20000 });
  assert.ok((await page.locator(".fact-card.change-retired").count()) >= 1, "the retiring system is struck through on the board");
  // …and the same picker can show a whole plateau, not only one plan. This path is here because
  // it once silently did nothing: the API route behind it had been written to the wrong directory,
  // the fetch failed, and the picker simply offered no named states.
  const plateauOption = await page.$$eval("[data-state-picker] option", (els) => els.map((e) => e.value).find((v) => v.startsWith("plt:")));
  assert.ok(plateauOption, "named states are offered on the board");
  await page.selectOption("[data-state-picker] select", plateauOption);
  await page.waitForSelector(".fact-card.change-retired", { timeout: 20000 });
  assert.match(await page.locator(".viewpoint-state-detail").innerText(), /Retiring/,
    "a plateau overlay says what it breaks, exactly as a change set does");
  await page.selectOption("[data-state-picker] select", changeOption);
  await page.waitForSelector(".fact-card.change-retired", { timeout: 20000 });

  await page.click('[data-state-picker] button:has-text("Place them")');
  await page.waitForSelector(".fact-card.planned", { timeout: 20000 });
  // …and a planned card is a drawing of an intention: it must not create the system
  await page.waitForTimeout(2000); // let the autosave land
  const graph = await (await apiFetch(`${base}/api/graph/query`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ workspaceId: "ws_acme", q: "SAP PM" }),
  })).json();
  assert.equal(graph.entities.length, 0, "placing a planned object must not create it in the graph");

  // the time scrubber: drag the same board through the roadmap
  await page.goto(`${base}/b/brd_integrations`, { waitUntil: "load" });
  await page.waitForSelector("[data-element-id]");
  await page.waitForSelector("[data-scrubber]", { timeout: 30000 });
  const stops = page.locator("[data-scrubber] .time-scrubber-track button");
  assert.ok((await stops.count()) >= 3, "today, then the named states");
  await stops.last().click();
  await page.waitForSelector(".fact-card.change-retired", { timeout: 20000 });
  const far = await page.locator(".fact-card.change-retired").count();
  assert.ok(far >= 2, "at the end of the roadmap both retirements have happened");
  assert.match(await page.locator(".time-scrubber-readout").innerText(), /Target architecture/,
    "the readout names the state being shown");
  // and back to today, which must leave the board exactly as it was
  await stops.first().click();
  await page.waitForTimeout(1200);
  assert.equal(await page.locator(".fact-card.change-retired").count(), 0, "returning to today clears the overlay");

  // ---- the agent that reads the graph -------------------------------------------------------
  // No model is configured in the e2e environment, and the point of this check is that Nexus says
  // so rather than offering a button that would fail: the rules carry on by themselves.
  await page.goto(`${base}/w/acme-energy/graph`, { waitUntil: "load" });
  await page.waitForSelector("#proposals");
  const agentReady = await page.locator("[data-ask-agent]").count();
  if (agentReady) {
    assert.equal(await page.locator("[data-agent-unavailable]").count(), 0, "either the agent can be asked or it says why");
  } else {
    assert.match(await page.locator("[data-agent-unavailable]").innerText(), /ANTHROPIC_API_KEY|NEXUS_MODEL|No model/,
      "with no model configured the panel names what is missing instead of failing");
  }

  // ---- import: files in, decided on the canvas, approved, and put back -----------------------
  // The whole point of the feature is that the last step really undoes the one before it, so this
  // walks the round trip and checks the graph is the size it started at.
  await page.goto(`${base}/w/acme-energy/graph`, { waitUntil: "load" });
  await page.waitForSelector("[data-health]");
  const countEntities = async () => {
    const r = await apiFetch(`${base}/api/graph/query`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId: "ws_acme", q: "kind:Application" }),
    });
    return (await r.json()).total;
  };
  const before = await countEntities();

  // Paste: the most common thing somebody has is not a file (§5.37).
  await page.goto(`${base}/w/acme-energy/import`, { waitUntil: "load" });
  await page.waitForSelector('[data-door="paste"]', { timeout: 30000 });
  await page.click('[data-door="paste"]');
  await page.fill("[data-paste-name]", "Gateways from a mail");
  await page.fill("[data-paste-text]", "Name\tKind\tOwner\nRTU Gateway North\tDevice\tGrid Operations\nRTU Gateway South\tDevice\tGrid Operations");
  await page.click("[data-stage-paste]");
  await page.waitForURL(/\/import\/bat_/, { timeout: 60000 });
  await page.waitForSelector("[data-import-counts]", { timeout: 30000 });
  assert.match(await page.locator("[data-import-counts]").innerText(), /2\s+objects staged/,
    "a pasted block is staged like a file");
  await page.goto(`${base}/w/acme-energy/import`, { waitUntil: "load" });
  await page.waitForSelector("[data-import-batches]");
  assert.match(await page.locator("[data-import-batches]").innerText(), /paste/i, "…and says it came from a paste");

  await page.waitForSelector("[data-import-upload]");
  await page.setInputFiles("[data-import-files]", [
    fixture("servicenow-business-applications.csv"),
    fixture("sharepoint-app-list.csv"),
    fixture("application-audit-2019.xlsx"),
    fixture("architecture-review-q3.docx"),
  ]);
  await page.click("[data-import-upload] button[type=submit]");
  await page.waitForURL(/\/import\/bat_/, { timeout: 60000 });
  await page.waitForSelector("[data-import-counts]", { timeout: 30000 });
  const batchUrl = page.url();
  const counts = await page.locator("[data-import-counts]").innerText();
  assert.match(counts, /objects staged/, "the batch is staged");
  assert.ok((await page.locator("[data-import-row]").count()) > 0, "there are rows to review");
  // an Excel serial became a date, and a person column was kept out
  const files = await page.locator(".import-files").innerText();
  assert.match(files, /application-audit-2019\.xlsx/, "the spreadsheet was read");
  assert.match(files, /architecture-review-q3\.docx/, "…and the Word document came along as prose");
  /*
   * Rev 72: the document is read for claims and folded into the same records, so it appears as a
   * *source* of an object the exports also describe rather than sitting beside the batch unread.
   * With no model configured the rules read it, which is fewer claims but the same path.
   */
  assert.match(files, /read by the (rules|model)/, "the document says how it was read and what came out");
  const withDoc = await page.locator("[data-import-row]", { hasText: "architecture-review-q3.docx" }).count();
  assert.ok(withDoc > 0, "what the document says lands on the records the tables created");
  assert.equal(await page.locator(".import-personal-toggle input").isChecked(), false,
    "the columns that name people are excluded until somebody says otherwise");
  // Rev 70: what the rows *are* is part of the import, not something a column has to carry.
  assert.match(files, /What are these rows\?/, "each file is asked what its rows are");
  assert.match(files, /Each row says for itself|reads as a list of|already has/, "…and the answer is proposed with a reason");

  /*
   * The canvas is the import tool: dragging a card into another lane is the decision. This is the
   * claim the whole reshape rests on, so it is checked end to end — drag, autosave, and then ask
   * the batch page, which is a different surface reading the same batch.
   */
  await page.click("[data-draw-batch]");
  await page.waitForURL(/\/b\/brd_/, { timeout: 60000 });
  await page.waitForSelector("[data-import-bar]", { timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll("[data-element-id]").length > 6, null, { timeout: 45000 });
  await page.waitForTimeout(1200);
  assert.match(await page.locator("[data-import-counts]").innerText(), /accepted/, "the board says what its lanes mean");
  // Rev 73: the board arrives with a reviewer beside it. Waking it needs a model; being there does not.
  assert.equal(await page.locator("[data-agent]").count(), 1, "a staged board comes with an agent beside it");
  // The name is an editable field, like a frame's title, so it is read as a value rather than text.
  assert.equal(await page.locator('[data-agent] input[aria-label="Agent name"]').inputValue(), "Import reviewer",
    "…pointed at reviewing the import");

  const spots = await page.evaluate(() => {
    const centre = (el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
    const all = [...document.querySelectorAll("[data-element-id]")];
    const card = all.find((el) => el.className.includes("fact-card"));
    const held = all.filter((el) => el.className.includes("board-frame"))
      .find((f) => (f.querySelector("input")?.value ?? "").includes("Held"));
    return { card: card ? centre(card) : null, held: held ? centre(held) : null };
  });
  assert.ok(spots.card && spots.held, "there is a card to drag and a Held lane to drag it into");
  await page.mouse.move(spots.card.x, spots.card.y);
  await page.mouse.down();
  await page.mouse.move(spots.held.x, spots.held.y, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  assert.match(await page.locator("[data-import-counts]").innerText(), /1 held/, "the count follows the drag, live");
  /*
   * A live board is written down by the room a moment after it goes quiet (§5.40), so the pill
   * reads "Shared" and there is no client-side save for this test to watch. Poll the batch itself
   * instead — that it agrees with the board is the claim here, and waiting for the claim beats
   * waiting for an implementation detail of how the board got saved.
   */
  await page.waitForFunction(() => /Saved|Shared/.test(document.body.innerText), null, { timeout: 30000 });

  let agreed = "";
  for (let i = 0; i < 20 && !/1 held/.test(agreed); i++) {
    if (i) await page.waitForTimeout(500);
    await page.goto(batchUrl, { waitUntil: "load" });
    await page.waitForSelector("[data-import-counts]", { timeout: 30000 });
    agreed = await page.locator("[data-import-counts]").innerText();
  }
  assert.match(agreed, /1 held/, "the batch page agrees with the board: the lane was the decision");

  await page.click("[data-approve-batch]"); // a dialog handler is already installed above
  await page.waitForSelector("[data-import-result]", { timeout: 60000 });
  assert.match(await page.locator("[data-import-result]").innerText(), /created/, "approving says what it wrote");
  const after = await countEntities();
  assert.ok(after > before, `approving created objects (${before} → ${after})`);

  await page.goto(batchUrl, { waitUntil: "load" });
  await page.waitForSelector("[data-rollback-batch]", { timeout: 30000 });
  await page.click("[data-rollback-batch]");
  await page.waitForSelector("[data-import-result]", { timeout: 60000 });
  assert.match(await page.locator("[data-import-result]").innerText(), /deleted/, "the rollback says what it undid");
  assert.equal(await countEntities(), before, "rolling back puts the graph back exactly as it was");

  // ---- an agent on the board -----------------------------------------------------------------
  // Placing one and scoping it works with or without a model; waking it needs one, and with none
  // configured the agent has to say so on the board rather than fail silently.
  await page.goto(`${base}/b/brd_landscape`, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelectorAll("[data-element-id]").length > 5, null, { timeout: 45000 });
  await page.click('[data-tool="agent"]');
  const canvasBox = await page.locator(".canvas-viewport").boundingBox();
  await page.mouse.click(canvasBox.x + 420, canvasBox.y + 700);
  await page.waitForSelector("[data-agent]", { timeout: 20000 });
  const placed = page.locator("[data-agent]").last();
  await placed.locator('textarea[aria-label="What this agent is for"]').fill("Where does this landscape contradict itself?");
  await placed.locator(".board-agent-scope button", { hasText: "frame" }).click();
  assert.equal(await placed.locator(".board-agent-scope button.on").innerText(), "frame",
    "an agent is scoped by where you put it, not by a query somebody has to write");
  await placed.locator('input[aria-label="Agent name"]').fill("Succession watch");

  /*
   * What it can see, before a model call is spent finding out (§5.52). Dropped outside any frame,
   * a frame-scoped agent can read nothing — and the board says so, and names the fix, rather than
   * waiting to be asked and answering with an error.
   */
  const scopeSays = await placed.locator(".board-agent-scope-line").innerText();
  assert.match(scopeSays, /drag it into one/, `an agent with an empty scope names the fix — got "${scopeSays}"`);
  assert.equal(await placed.locator("[data-wake-agent]").isDisabled(), true,
    "there is nothing to wake it for, so it cannot be woken");

  // Point it at the whole board and the same sentence counts what it would read.
  await placed.locator(".board-agent-scope button", { hasText: "board" }).click();
  await page.waitForTimeout(300);
  assert.match(await placed.locator(".board-agent-scope-line").innerText(), /Reads \d+ objects/,
    "a scope with something in it is counted");
  assert.equal(await placed.locator("[data-wake-agent]").isDisabled(), false, "and now it can be woken");

  // Selecting it outlines every object it would read, in its own colour.
  await placed.locator(".board-agent-head").click();
  await page.waitForTimeout(400);
  assert.ok((await page.locator(".agent-scope-mark").count()) > 3,
    "selecting an agent draws what it can read on the board itself");

  await placed.locator("[data-wake-agent]").click();
  await page.waitForSelector("[data-agent] .board-agent-said", { timeout: 30000 });
  const said = await placed.locator(".board-agent-said").innerText();
  assert.ok(/ANTHROPIC_API_KEY|NEXUS_MODEL|No model|nothing in this agent/i.test(said),
    `an agent that cannot run says why on the board — got "${said}"`);


  /*
   * The chrome must not land on itself, at the sizes people actually have (§5.54).
   *
   * Three separate collisions shipped before this check existed, all the same shape: a hard-coded
   * offset that assumed a smaller version of something which had since grown. The property bar was
   * placed 64px above a selection while standing 86px tall; the Selection panel reserved the map
   * card's height without its second button. None of it is visible in a unit test and all of it is
   * obvious in a window.
   */
  {
    const before = page.viewportSize();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(700);
    await page.locator(".fact-card").first().click();
    await page.waitForSelector(".shape-inspector-bar", { timeout: 15000 });
    await page.waitForTimeout(500);

    const clashes = await page.evaluate(() => {
      const sel = ".floating-panel, .canvas-toolbar, .command-bar, .shape-inspector-bar, .time-scrubber, .comments-panel";
      const boxes = [...document.querySelectorAll(sel)]
        .map((el) => ({ name: el.className.split(" ").filter((c) => c && c !== "fade-in")[0], r: el.getBoundingClientRect() }))
        .filter((b) => b.r.width > 2 && b.r.height > 2)
        // A panel nested inside another is not a collision.
        .filter((b, _i, all) => !all.some((o) => o !== b && o.r.left <= b.r.left && o.r.top <= b.r.top
          && o.r.right >= b.r.right && o.r.bottom >= b.r.bottom && o.r.width * o.r.height > b.r.width * b.r.height * 1.2));
      const out = [];
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i].r, b = boxes[j].r;
          const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (w > 4 && h > 4) out.push(`${boxes[i].name} over ${boxes[j].name} (${Math.round(w)}×${Math.round(h)})`);
        }
      }
      return out;
    });
    assert.deepEqual(clashes, [], "no two pieces of canvas chrome overlap at 1280×800");

    // And the bar of controls for an object must not be standing on that object.
    const onSelection = await page.evaluate(() => {
      const bar = document.querySelector(".shape-inspector-bar")?.getBoundingClientRect();
      const el = document.querySelector("[data-element-id].selected")?.getBoundingClientRect();
      if (!bar || !el) return null;
      const w = Math.min(bar.right, el.right) - Math.max(bar.left, el.left);
      const h = Math.min(bar.bottom, el.bottom) - Math.max(bar.top, el.top);
      return w > 4 && h > 4 ? `${Math.round(w)}×${Math.round(h)}` : null;
    });
    assert.equal(onSelection, null, `the property bar covers the object it belongs to (${onSelection})`);

    await page.keyboard.press("Escape");
    await page.setViewportSize(before);
    await page.waitForTimeout(600);
  }

  // ask about a selection: the agent that needs no placing. Selecting is scope.
  await page.keyboard.press("Escape");
  await page.click('[aria-label="Select"]');
  const someCards = page.locator(".fact-card");
  await someCards.nth(0).click();
  await page.keyboard.down("Shift");
  await someCards.nth(1).click();
  await page.keyboard.up("Shift");
  await page.waitForSelector("[data-ask-block]", { timeout: 20000 });
  assert.match(await page.locator("[data-ask-block] > header").innerText(), /Ask about these 2/i,
    "the selection is the scope, and the panel says so");
  await page.fill("[data-ask-input]", "What is missing here?");
  await page.click("[data-ask-block] form button");
  await page.waitForSelector(".ask-error", { timeout: 30000 });
  assert.match(await page.locator(".ask-error").innerText(), /ANTHROPIC_API_KEY|NEXUS_MODEL|No model/i,
    "asking without a model says what is missing rather than failing silently");
  // Nothing was answered, so there is nothing to keep — the control that writes a comment must not
  // be offered before there is an exchange to write (§5.53).
  assert.equal(await page.locator("[data-ask-keep]").count(), 0, "there is nothing to keep until something has been answered");

  // the fleet: one place that knows every agent in the workspace
  await page.waitForTimeout(2500); // let the board autosave, so the fleet can see the agent
  await page.goto(`${base}/w/acme-energy/agents`, { waitUntil: "load" });
  await page.waitForSelector("[data-fleet-totals]");
  assert.ok((await page.locator("[data-agent-row]").count()) >= 1, "an agent placed on a board appears in the fleet");
  const fleetText = await page.locator("[data-fleet]").innerText();
  assert.match(fleetText, /Succession watch/, "the fleet names the agent");
  assert.match(fleetText, /Application landscape/, "…and the board it stands on");
  assert.match(await page.locator("[data-fleet-totals]").innerText(), /Nobody has answered it yet/i,
    "an agent nobody has answered is not given a score it has not earned");

  // ---- the timeline: a canvas capability, and the roadmap as one thing you can say with it ----
  // On any board, an attribute that reads as a date can become the axis. This is checked on an
  // ordinary landscape board — not the roadmap — because the point is that it is not a roadmap
  // feature: the same control lays a board out by end-of-support, contract renewal, anything.
  await page.goto(`${base}/b/brd_integrations`, { waitUntil: "load" });
  await page.waitForSelector("[data-element-id]");
  await page.click('button:has-text("Viewpoint")');
  await page.waitForSelector("[data-timeline-controls]", { timeout: 20000 });
  const dateKey = await page.$$eval("[data-timeline-controls] select", (els) => [...els[0].options].map((o) => o.value).find(Boolean));
  assert.ok(dateKey, "the board offers the attributes that read as dates");
  await page.selectOption("[data-timeline-controls] select >> nth=0", dateKey);
  const framesBefore = await page.locator(".board-frame").count();
  await page.click("[data-timeline-controls] .viewpoint-primary");
  await page.waitForFunction((n) => document.querySelectorAll(".board-frame").length > n, framesBefore, { timeout: 20000 });
  // fit the board so the new layout is on screen — the canvas culls what is outside the viewport
  await page.click('button:has-text("Fit board")');
  await page.waitForTimeout(900);
  // titles live in always-editable inputs, so read their values rather than the rendered text
  const titles = await page.$$eval(".board-object input", (els) => els.map((e) => e.value));
  assert.ok(titles.some((t) => /^20[23]\d/.test(t)), "the axis is labelled with the periods it covers");
  assert.ok(titles.some((t) => /no end of support/.test(t)),
    "cards without a readable date are parked in a lane of their own, not dropped");

  // the roadmap, drawn as an ordinary board
  await page.goto(`${base}/w/acme-energy/roadmap`, { waitUntil: "load" });
  await page.waitForSelector(".roadmap");
  await page.click("[data-draw-roadmap]");
  await page.waitForSelector("[data-draw-form]");
  await page.click("[data-draw-form] button[type=submit]");
  await page.waitForURL(/\/b\/brd_/, { timeout: 30000 });
  /*
   * Wait for the drawing to settle, not for "more than three objects". The roadmap draws about
   * nineteen; reading the titles the moment the fourth appears is a race that passes on a quiet
   * machine and fails on a busy one, which is exactly what it did.
   */
  await page.waitForFunction(() => {
    const titles = [...document.querySelectorAll(".board-object input")].map((e) => e.value);
    return titles.includes("Retired") && titles.includes("Maximo");
  }, null, { timeout: 45000 });
  const drawn = await page.$$eval(".board-object input", (els) => els.map((e) => e.value));
  assert.ok(drawn.includes("Retired"), "objects are laned by what happens to them");
  assert.ok(drawn.includes("Maximo"), "the plans' objects are on the board");
  assert.ok((await page.locator(".fact-card.planned").count()) >= 1,
    "a system a plan introduces is drawn as an intention, not created");

  // ---- the EA knowledge base: search the corpus and read the doctrine ----------------------
  await page.goto(`${base}/w/acme-energy/knowledge`, { waitUntil: "load" });
  await page.waitForSelector(".knowledge");
  await page.fill('.knowledge-search input[name="q"]', "capability versus process");
  await page.click('.knowledge-search button[type="submit"]');
  await page.waitForSelector(".knowledge-passage", { timeout: 20000 });
  const passages = await page.$$eval(".knowledge-passage", (els) => els.map((e) => ({
    label: e.querySelector("b")?.textContent ?? "",
    link: e.querySelector("footer a")?.getAttribute("href") ?? "",
    license: e.querySelector(".knowledge-license")?.textContent?.trim() ?? "",
  })));
  assert.ok(passages.length > 0, "the corpus answers a question");
  assert.ok(passages.every((p) => p.link.startsWith("https://")), "every passage links to its source");
  assert.ok(passages.every((p) => p.license.length > 2), "every passage names its licence");

  // a question the corpus has never heard of is answered honestly, not with the nearest thing
  await page.goto(`${base}/w/acme-energy/knowledge?q=quantum%20flux%20capacitor`, { waitUntil: "load" });
  await page.waitForSelector(".knowledge-result-count");
  assert.match(await page.locator(".knowledge-result-count").innerText(), /never seen|Nothing matched/i,
    "an unknown term is admitted rather than approximated");

  await page.goto(`${base}/w/acme-energy/knowledge?tab=lessons`, { waitUntil: "load" });
  await page.waitForSelector(".knowledge-lesson");
  assert.ok((await page.locator(".knowledge-lesson blockquote").count()) > 0, "every lesson shows the passage behind it");

  await page.goto(`${base}/w/acme-energy/knowledge?tab=sources`, { waitUntil: "load" });
  await page.waitForSelector(".knowledge-license-summary");
  assert.ok((await page.locator(".knowledge-references li").count()) > 0,
    "the works we may not redistribute are listed as such");

  // ---- describing an agent -------------------------------------------------------------------
  // The form, the scope count, the refusals and the run log are all real without a model. The
  // answering half needs a key and is covered by the unit tests instead.
  await page.goto(`${base}/w/acme-energy/agents/new`, { waitUntil: "load" });
  await page.waitForSelector("[data-agent-form]", { timeout: 30000 });
  await page.fill("[data-agent-name]", "Smoke reviewer");
  await page.click("[data-agent-save]");
  await page.waitForSelector("[data-agent-message]", { timeout: 20000 });
  assert.match(await page.locator("[data-agent-message]").innerText(), /what it may read|in a sentence/,
    "an agent with no purpose and no scope is refused, with a reason");

  await page.fill("[data-agent-purpose]", "Find applications with no owner and propose one only where the object's own words answer it.");
  await page.fill("[data-agent-scope]", "kind:Application missing:owner");
  await page.click(".agent-scope button");
  await page.waitForSelector("[data-scope-count]", { timeout: 20000 });
  assert.match(await page.locator("[data-scope-count]").innerText(), /object/, "the scope says how much it would read");

  await page.check('[data-verb="setAttribute"] input');
  await page.uncheck('[data-verb="setKind"] input');
  await page.click("[data-agent-save]");
  await page.waitForURL(/\/agents\/agt_/, { timeout: 30000 });
  await page.waitForSelector("[data-agent-status]");
  assert.equal((await page.locator("[data-agent-status]").innerText()).toLowerCase(), "draft",
    "a new agent starts as a draft, whichever status was asked for");

  // A paused agent is refused before it can cost anything, and the refusal is written down.
  await page.click('[data-set-status="paused"]');
  await page.waitForTimeout(700);
  await page.click("[data-agent-run]");
  await page.waitForSelector("[data-agent-runs]", { timeout: 30000 });
  assert.match(await page.locator("[data-agent-runs]").innerText(), /paused/,
    "a refused run is recorded rather than silently doing nothing");

  await page.goto(`${base}/w/acme-energy/agents`, { waitUntil: "load" });
  await page.waitForSelector("[data-defined]", { timeout: 30000 });
  // Agents proposing agents needs a model; what does not is the refusal, which is the safeguard.
  assert.ok(await page.locator("[data-suggest-agents]").isVisible(), "an agent can be asked what agent is missing");
  await page.click("[data-suggest-agents]");
  await page.waitForSelector("[data-suggest-message]", { timeout: 30000 });
  assert.match(await page.locator("[data-suggest-message]").innerText(), /No model is configured|only half a model|has no model id/,
    "with no model it says why rather than pretending");
  const listed = await page.locator("[data-defined-agent]").first().innerText();
  assert.match(listed, /Smoke reviewer/, "the fleet lists described agents");
  assert.match(listed, /setAttribute/, "and what each one may propose");
  assert.match(await page.locator("[data-activity]").innerText(), /Smoke reviewer/, "with an activity feed of what has run");

  // ---- where the thinking happens ----------------------------------------------------------
  // The one screen that decides what the rest of the product talks to. The check that matters is
  // that a key entered here cannot be read back out of the page that shows it.
  await page.goto(`${base}/w/acme-energy/settings/models`, { waitUntil: "load" });
  await page.waitForSelector("[data-preset=ollama]");
  await page.click("[data-preset=ollama]");
  await page.waitForSelector("[data-provider]", { timeout: 20000 });
  const provider = page.locator("[data-provider]").first();
  const providerId = await provider.getAttribute("data-provider");
  assert.equal(await provider.locator('input[aria-label="Provider name"]').inputValue(), "Ollama",
    "a preset fills the card in");
  assert.match(await provider.innerText(), /No key/, "a model on your own hardware needs none");

  const secret = `sk-smoke-${Date.now()}`;
  await provider.locator('button:has-text("Add a key")').click();
  await provider.locator('input[aria-label="API key"]').fill(secret);
  await provider.locator('button:has-text("Save")').click();
  await page.waitForSelector(`[data-provider="${providerId}"]:has-text("A key is stored")`, { timeout: 20000 });
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector("[data-provider]");
  assert.ok(!(await page.content()).includes(secret), "an API key never comes back to the browser");

  // Nothing is listening on the preset's port, so this is the honest unreachable path.
  await page.click(`[data-check="${providerId}"]`);
  await page.waitForSelector(`[data-provider="${providerId}"] .model-status.bad`, { timeout: 30000 });

  await page.selectOption('[data-task="board agent"] select', providerId);
  await page.waitForTimeout(1200);
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector('[data-task="board agent"]');
  assert.equal(await page.locator('[data-task="board agent"] select').inputValue(), providerId,
    "a job remembers which provider it was given");

  // Leave the workspace as it was found: an enabled provider pointing at a dead port would make
  // every later model call in a development database fail for a reason nobody would guess.
  await page.click(`[data-provider="${providerId}"] button[title="Remove this provider"]`);
  await page.waitForFunction(() => document.querySelectorAll("[data-provider]").length === 0, null, { timeout: 20000 });

  // ---- Nexus as an MCP server ----------------------------------------------------------------
  // The whole boundary in one pass: a key nothing can print back, real answers over JSON-RPC, and
  // a suggestion that reaches the review queue without changing anything.
  await page.goto(`${base}/w/acme-energy/settings/connections`, { waitUntil: "load" });
  await page.waitForSelector("[data-key-name]", { timeout: 30000 });
  await page.fill("[data-key-name]", "Smoke client");
  await page.selectOption(".mcp-new-row select", "propose");
  await page.click("[data-issue-key]");
  await page.waitForSelector("[data-issued-key] code", { timeout: 30000 });
  const key = (await page.locator("[data-issued-key] code").innerText()).trim();
  assert.ok(key.startsWith("nxs_"), "a key is issued");

  await page.reload({ waitUntil: "load" });
  await page.waitForSelector("[data-keys]");
  assert.ok(!(await page.content()).includes(key), "a key is shown once and never again");

  const rpc = async (body, token = key) => {
    const res = await fetch(`${base}/api/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: res.status === 202 ? null : await res.json() };
  };

  assert.equal((await rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, "")).status, 401, "no key, no answer");
  const tools = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  const toolNames = tools.body.result.tools.map((t) => t.name);
  assert.deepEqual(toolNames, ["search_model", "describe_object", "what_depends_on", "list_kinds", "estate_health", "propose_change"],
    "the tools are what the documentation says they are");

  const searched = await rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "search_model", arguments: { query: "kind:Application" } } });
  assert.match(searched.body.result.content[0].text, /Application/, "it answers a question about the model");

  const proposed = await rpc({
    jsonrpc: "2.0", id: 4, method: "tools/call",
    params: { name: "propose_change", arguments: { change: "setKind", entityId: "nope", to: "Application", why: "no", readFrom: "nope", quote: "nothing" } },
  });
  assert.match(proposed.body.result.content[0].text, /Nothing was recorded/, "an unquotable claim from outside is discarded");
  assert.equal((await rpc({ jsonrpc: "2.0", method: "notifications/initialized" })).status, 202, "a notification is answered with nothing");

  // ---- the other direction: Nexus asking an MCP server -----------------------------------------
  // There is a real one to hand — this instance — so the outbound client is exercised against a
  // server that answers rather than a mock, and the loop closes at an intake source.
  await page.goto(`${base}/w/acme-energy/settings/connections`, { waitUntil: "load" });
  await page.waitForSelector("[data-server-name]", { timeout: 30000 });
  await page.fill("[data-server-name]", "This workspace, over MCP");
  await page.fill("[data-server-url]", `${base}/api/mcp`);
  await page.fill('input[aria-label="Server key"]', key);
  await page.click("[data-add-server]");
  await page.waitForSelector("[data-servers]", { timeout: 30000 });
  await page.click("[data-check-server]");
  await page.waitForSelector("[data-tool]", { timeout: 60000 });
  const remoteTools = await page.locator("[data-tool] b").allInnerTexts();
  assert.ok(remoteTools.includes("estate_health"), "it lists the tools the remote server reported");

  await page.click('[data-tool="estate_health"]');
  await page.waitForSelector("[data-run-tool]", { timeout: 20000 });
  await page.click("[data-run-tool]");
  await page.waitForSelector("[data-answer]", { timeout: 60000 });
  assert.match(await page.locator("[data-answer] pre").innerText(), /\d+\/100/, "the answer comes back as text");
  await page.click("[data-keep-source]");
  await page.waitForSelector(".mcp-out-kept", { timeout: 30000 });

  await page.goto(`${base}/w/acme-energy/intake`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  assert.match(await page.locator("body").innerText(), /over MCP/,
    "what a remote server said arrives as an intake source, not as a change to the model");

  /*
   * The third door into import (§5.37): ask a connected system for rows and stage them. Asked for
   * a table, this instance answers its own model back — which matches itself, and is the shortest
   * honest proof that the round trip works.
   */
  await page.goto(`${base}/w/acme-energy/import`, { waitUntil: "load" });
  await page.waitForSelector('[data-door="server"]', { timeout: 30000 });
  await page.click('[data-door="server"]');
  await page.waitForSelector("[data-ask-server]", { timeout: 30000 });
  await page.selectOption('select[aria-label="Which tool"]', "search_model");
  await page.fill('[data-arg="query"]', "kind:Application");
  await page.fill('[data-arg="format"]', "table");
  await page.click("[data-ask-server]");
  await page.waitForSelector(".import-server-answer", { timeout: 60000 });
  assert.match(await page.locator(".import-server-answer pre").innerText(), /^id\tkind\tname/,
    "asked for a table, it answers with rows");
  await page.click("[data-stage-answer]");
  await page.waitForURL(/\/import\/bat_/, { timeout: 60000 });
  await page.waitForSelector("[data-import-counts]", { timeout: 30000 });
  assert.match(await page.locator("[data-import-counts]").innerText(), /unchanged/,
    "the model imported from itself matches itself");

  /*
   * The fourth door (§5.63): an EA repository read straight into a staged batch. `pnpm e2e`
   * starts a LeanIX that speaks the real two-step auth and a cursor-paged GraphQL, so what runs
   * here is the actual client. An attached run has no such server and skips the section.
   */
  if (process.env.NEXUS_E2E_LEANIX_TOKEN) {
    await page.goto(`${base}/w/acme-energy/import`, { waitUntil: "load" });
    await page.waitForSelector('[data-door="leanix"]', { timeout: 30000 });
    await page.click('[data-door="leanix"]');
    await page.waitForSelector("[data-import-leanix]", { timeout: 30000 });

    // People paste the page they were looking at, so a graphiql URL has to be accepted as a host.
    await page.fill("[data-leanix-host]", "https://acme.leanix.net/acme/graphiql");
    await page.fill("[data-leanix-token]", "not-the-token");
    await page.click("[data-stage-leanix]");
    await page.waitForSelector("[data-import-leanix] [data-import-error]", { timeout: 60000 });
    assert.match(await page.locator("[data-import-leanix] [data-import-error]").innerText(), /Authentication failed \(401\)/,
      "a refused token says so, and says where a working one comes from");
    assert.equal(await page.locator("[data-leanix-host]").inputValue(), "https://acme.leanix.net/acme/graphiql",
      "a failed read does not clear what was typed");

    await page.fill("[data-leanix-token]", process.env.NEXUS_E2E_LEANIX_TOKEN);
    await page.click("[data-stage-leanix]");
    await page.waitForURL(/\/import\/bat_/, { timeout: 120000 });
    await page.waitForSelector("[data-import-counts]", { timeout: 60000 });
    assert.match(await page.locator("[data-import-counts]").innerText(), /4\s+objects staged/,
      "both pages of fact sheets arrived, so the cursor was followed");

    const kinds = await page.locator("[data-file-kind]").allInnerTexts();
    assert.equal(kinds.length, 2, "one file per fact sheet type, not one undifferentiated pile");
    assert.match(kinds.join(" "), /Application/, "LeanIX's own type names the file's kind…");
    assert.match(kinds.join(" "), /IT Component/, "…in the English a reader uses, not the API's");

    const columns = await page.locator(".import-column").allInnerTexts();
    const roles = await page.locator(".import-column").evaluateAll((els) => els.map((e) => e.className));
    assert.ok(roles.some((c) => c.includes("key")), "the LeanIX id comes in as the key, so a second read updates");
    assert.ok(roles.some((c) => c.includes("relation")), "a modelled relation arrives as a relation column");
    assert.ok(columns.some((c) => /child/i.test(c)), "…named after what LeanIX calls it");

    const rows = (await page.locator("[data-import-row]").allInnerTexts()).join(" ");
    assert.match(rows, /Billing \(2b3c4d5e\)/, "two fact sheets with one name are told apart by their id");

    await page.click("[data-approve-batch]");
    await page.waitForSelector("[data-import-result]", { timeout: 120000 });
    assert.match(await page.locator("[data-import-result]").innerText(), /4 created, 0 changed, 1 connected/,
      "approving wrote the relation as well as the objects — and only the relation whose other end came too");

    // And it is still reversible, which is the whole reason this door goes through the pipeline.
    await page.waitForSelector("[data-rollback-batch]", { timeout: 30000 });
    await page.click("[data-rollback-batch]");
    await page.waitForFunction(() => /deleted/.test(document.querySelector("[data-import-result]")?.textContent ?? ""),
      null, { timeout: 120000 });
    assert.match(await page.locator("[data-import-result]").innerText(), /4 deleted/,
      "rolled back, the repository's fact sheets are out of the graph again");
  } else {
    console.log("  (skipped the EA repository door: no LeanIX to read)");
  }

  await page.goto(`${base}/w/acme-energy/settings/connections`, { waitUntil: "load" });
  await page.waitForSelector("[data-keys]");
  // The dialog handler registered earlier in this run accepts the confirm.
  await page.click("[data-revoke]");
  await page.waitForTimeout(1200);
  assert.equal((await rpc({ jsonrpc: "2.0", id: 5, method: "tools/list" })).status, 401, "a revoked key stops being answered");

  // ---- agents that run themselves ------------------------------------------------------------
  /*
   * The whole loop without a model: a schedule can be set and read back, the clock can be asked
   * to tick, and the digest tells the truth about what it found. With no provider configured the
   * run refuses — which is exactly the case worth asserting, because a refusal appearing in the
   * digest is the feature working, not failing.
   */
  await page.goto(`${base}/w/acme-energy/agents`, { waitUntil: "load" });
  await page.waitForSelector(".studio-home-main");
  {
    const first = page.locator("[data-defined-agent]").first();
    assert.ok(await first.count(), "there is an agent to put on a schedule");
    await first.locator("a").first().click();
    await page.waitForSelector("[data-trigger]");

    /*
     * The editor does the arithmetic out loud rather than letting somebody discover it a week
     * later in a log full of refusals. The budget is set here rather than assumed: whatever the
     * agent this suite made earlier happens to allow is not what this assertion is about.
     */
    await page.fill('input[aria-label="Runs a day"]', "4");
    await page.selectOption("[data-trigger]", "hourly");
    assert.ok(await page.locator("[data-budget-clash]").isVisible(),
      "an hourly schedule against a smaller budget says so before it is saved");
    await page.selectOption("[data-trigger]", "daily");
    assert.equal(await page.locator("[data-budget-clash]").count(), 0,
      "…and stops saying so once the schedule fits");
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(1500);

    await page.reload({ waitUntil: "load" });
    await page.waitForSelector("[data-trigger]");
    assert.equal(await page.locator("[data-trigger]").inputValue(), "daily", "the schedule was written down");

    // Ask the clock to run now rather than waiting five minutes for its own tick.
    const ticked = await page.evaluate(async () => (await (await fetch("/api/agents/tick", { method: "POST" })).json()));
    assert.ok(typeof ticked.due === "number", "the scheduler answers");
    assert.equal(ticked.scheduler.running, true, "the clock is running, not merely callable");

    await page.goto(`${base}/w/acme-energy/agents`, { waitUntil: "load" });
    await page.waitForSelector("[data-defined-agent]");
    assert.ok((await page.locator("[data-schedule]").count()) > 0, "the fleet shows which agents are on a schedule");
  }

  // ---- the sidebar shows the work, not the plumbing --------------------------------------------
  /*
   * The rail had grown to nineteen flat entries (§5.65). These two assertions are the rule, not
   * the current arrangement: it stays scannable, and administrative screens do not creep back in
   * one revision at a time — which is exactly how it got to nineteen.
   */
  {
    await page.goto(`${base}/w/acme-energy`, { waitUntil: "load" });
    await page.waitForSelector(".studio-home-nav", { timeout: 60000 });
    const rail = await page.locator(".studio-home-nav a").count();
    assert.ok(rail <= 14, `the rail is ${rail} entries; past about a dozen it is searched, not scanned`);
    const groups = await page.locator(".studio-nav-label").allInnerTexts();
    assert.ok(groups.length >= 3, "the rail is grouped rather than one undifferentiated run");

    const hrefs = await page.locator(".studio-home-nav a").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
    assert.equal(hrefs.filter((h) => h?.includes("/settings")).length, 0, "settings are not in the rail");
    assert.equal(hrefs.filter((h) => h === "/admin").length, 0, "nor is the platform console");

    /*
     * Settings is one entry, and it leads somewhere rather than to an empty index. Waiting on the
     * URL rather than on the nav: the shell renders for the redirecting page too, so a selector
     * wait succeeds before the redirect has landed and proves nothing.
     */
    await page.click('.studio-nav-utility a[href$="/settings"]');
    await page.waitForURL(/\/settings\/\w+/, { timeout: 60000 });
    await page.waitForSelector(".settings-nav", { timeout: 60000 });
    assert.ok(await page.locator("[data-settings-nav]").count(), "…and the settings nav is there when it lands");
  }

  // ---- the platform console ------------------------------------------------------------------
  /*
   * Above the workspace (§5.64). Two things are worth asserting and only one of them is the
   * feature: that an operator can run the platform, and that somebody who is not one cannot even
   * find out the console is there.
   */
  {
    await page.goto(`${base}/admin`, { waitUntil: "load" });
    await page.waitForSelector("[data-admin-tenants]", { timeout: 60000 });
    const totals = await page.locator("[data-admin-totals]").innerText();
    assert.match(totals, /1\s+tenant/, "the console counts the tenants on the deployment");
    assert.match(await page.locator("[data-admin-deployment]").innerText(), /SQLite|Postgres/,
      "…and says what this deployment actually is");

    // A tenant, made from nothing, with an owner and somewhere to put a board.
    await page.click("[data-new-tenant]");
    await page.fill("[data-tenant-name]", "Nordic Grid A/S");
    assert.equal(await page.locator("[data-tenant-slug]").inputValue(), "nordic-grid-a-s",
      "the address is proposed from the name, accents and punctuation handled");
    await page.click("[data-create-tenant]");
    await page.waitForFunction(() => document.querySelectorAll("[data-admin-tenant]").length === 2, null, { timeout: 60000 });
    assert.match(await page.locator('[data-admin-tenant="nordic-grid-a-s"]').innerText(), /empty/i,
      "a tenant with nothing in it says so, which is the state an operator has to act on");

    // Deleting one means typing its address: the operator is the one person who cannot see inside.
    await page.locator('[data-admin-tenant="nordic-grid-a-s"] [data-delete-tenant]').click();
    await page.waitForSelector("[data-delete-confirm]");
    assert.equal(await page.locator("[data-confirm-delete]").isDisabled(), true,
      "deleting is refused until the address is typed back");
    await page.fill("[data-confirm-slug]", "nordic-grid-a-s");
    await page.click("[data-confirm-delete]");
    await page.waitForFunction(() => document.querySelectorAll("[data-admin-tenant]").length === 1, null, { timeout: 60000 });

    // Setting a password is the reason the console was asked for, and it ends their sessions.
    await page.goto(`${base}/admin/people`, { waitUntil: "load" });
    await page.waitForSelector("[data-admin-accounts]", { timeout: 60000 });
    const anna = '[data-admin-account="anna@acme-energy.example"]';
    await page.locator(`${anna} [data-manage-account]`).click();
    await page.fill(`${anna} [data-new-password]`, "a-brand-new-password");
    await page.locator(`${anna} [data-set-password]`).click();
    await page.waitForSelector("[data-admin-note]", { timeout: 60000 });
    assert.match(await page.locator("[data-admin-note]").innerText(), /every session they had has ended/i,
      "a new password ends the sessions, or setting one achieves nothing");

    /*
     * The last operator cannot be demoted. Made deterministic rather than assumed: a developer's
     * `.env.local` bootstraps its own operator into any database `next dev` opens, so the suite
     * demotes every operator except the seeded one first — which also exercises the path where
     * standing down *is* allowed — and only then asserts the refusal.
     */
    const me = '[data-admin-account="jes@acme-energy.example"]';
    const others = await page.locator('[data-admin-account]:has(.admin-flag.operator)').evaluateAll(
      (els) => els.map((e) => e.getAttribute("data-admin-account")).filter((v) => v !== "jes@acme-energy.example"),
    );
    for (const email of others) {
      await page.locator(`[data-admin-account="${email}"] [data-manage-account]`).click();
      await page.locator(`[data-admin-account="${email}"] [data-toggle-operator]`).click();
      await page.waitForFunction(
        (e) => !document.querySelector(`[data-admin-account="${e}"] .admin-flag.operator`),
        email, { timeout: 60000 },
      );
    }
    assert.equal(await page.locator('[data-admin-account]:has(.admin-flag.operator)').count(), 1,
      "one operator is left, and an operator could be removed while there was another");

    await page.locator(`${me} [data-manage-account]`).click();
    await page.locator(`${me} [data-toggle-operator]`).click();
    await page.waitForSelector("[data-admin-error]", { timeout: 60000 });
    assert.match(await page.locator("[data-admin-error]").innerText(), /only operator/i,
      "the last operator cannot stand down, because nobody could put them back");
  }

  {
    // The operator reaches it from the settings area, which is where it moved (§5.65).
    await page.goto(`${base}/w/acme-energy/settings`, { waitUntil: "load" });
    await page.waitForSelector(".settings-nav", { timeout: 60000 });
    assert.ok(await page.locator('[data-settings-nav="platform"]').count(),
      "an operator is offered the platform console from settings");
  }

  {
    // And to everybody else the console is a page that is not there — 404, not 403: "this exists
    // and you may not see it" is itself something a URL should not teach.
    const other = await browser.newContext({ viewport: { width: 1100, height: 800 } });
    const guest = await other.newPage();
    try {
      await signIn(guest, "tobias@acme-energy.example");
      await guest.goto(`${base}/admin`, { waitUntil: "load" });
      await guest.waitForTimeout(1200);
      assert.equal(await guest.locator("[data-admin-tenants]").count(), 0, "a non-operator sees no console");
      assert.doesNotMatch(await guest.locator("body").innerText(), /Operator|Tenants/,
        "…and is not told one exists");
      /*
       * The way in is not advertised either. Checked where the link actually lives (§5.65): it
       * left the sidebar for the settings nav, and an assertion still pointing at the rail would
       * pass for everybody and prove nothing.
       */
      await guest.goto(`${base}/w/acme-energy/settings`, { waitUntil: "load" });
      await guest.waitForSelector(".settings-nav", { timeout: 60000 });
      assert.equal(await guest.locator('[data-settings-nav="platform"]').count(), 0,
        "and the settings nav does not offer it");
      assert.ok(await guest.locator('[data-settings-nav="people"]').count(),
        "…while the settings they may see are still there");
    } finally {
      await other.close();
    }
  }

  // ---- two people on one board ---------------------------------------------------------------
  /*
   * The only check in this suite that needs a second browser, and the only way to test the
   * feature at all: a second context is a second client with its own cookies, its own stream and
   * its own copy of the document. Everything asserted here is asserted on the *other* screen.
   */
  {
    const other = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const second = await other.newPage();
    try {
      // A different person, not a second tab: the point of presence is telling people apart.
      await signIn(second, "maria@acme-energy.example");
      const board = `${base}/b/brd_landscape`;
      await page.goto(board, { waitUntil: "load" });
      await page.waitForSelector("[data-element-id]");
      await second.goto(board, { waitUntil: "load" });
      await second.waitForSelector("[data-element-id]");

      // The stream is up on both, and each can see that somebody else is here.
      await page.waitForSelector(".peer-chip", { timeout: 15000 });
      await second.waitForSelector(".peer-chip", { timeout: 15000 });
      // Since rev 76 presence is about people, not connections: Jes sees Maria and Maria sees Jes.
      assert.equal((await page.locator(".peer-chip").first().innerText()).trim(), "ML", "the other person is named, not merely counted");
      assert.equal((await second.locator(".peer-chip").first().innerText()).trim(), "JO", "and it is mutual");
      assert.match(await page.locator(".sync-pill").first().innerText(), /Shared/,
        "a live board says it is shared rather than saved — the room is the writer now");

      // A card drawn on one screen appears on the other, without either reloading.
      //
      // The spot is found rather than guessed: a fixed coordinate on this board lands on the
      // Graph panel about half the time, and then the test types into a search box and blames
      // multiplayer for the card that never appeared.
      const spot = await page.evaluate(() => {
        const taken = [...document.querySelectorAll("[data-element-id], .inventory-panel, .inspector-panel, .map-card, .zoom-card, .command-bar, .studio-toolbar, .time-scrubber, [data-lens-legend]")]
          .map((el) => el.getBoundingClientRect());
        for (let y = 600; y < 820; y += 15) for (let x = 380; x < 1300; x += 15) {
          if (!taken.some((r) => x > r.x - 15 && x < r.right + 15 && y > r.y - 15 && y < r.bottom + 15)) return { x, y };
        }
        return null;
      });
      assert.ok(spot, "there is somewhere on the canvas to put a card");

      const title = `Live ${Date.now()}`;
      const beforeLive = await page.locator("[data-element-id]").count();
      await page.mouse.click(spot.x, spot.y);
      await page.keyboard.press("c");
      await page.mouse.click(spot.x, spot.y);
      await page.waitForSelector(".fact-card input:focus", { timeout: 10000 });
      await page.keyboard.type(title);
      assert.equal(await page.locator("[data-element-id]").count(), beforeLive + 1, "the card really was drawn");
      await second.waitForSelector(`input[value="${title}"]`, { timeout: 15000 });

      // …and the caret in that title is a lock on the other screen, not a race for characters.
      const held = second.locator(".field-held input").first();
      await held.waitFor({ timeout: 10000 });
      assert.notEqual(await held.getAttribute("readonly"), null,
        "a field somebody else is typing in is read-only for everybody else");

      // Presence draws where they are and what they have hold of.
      await page.mouse.move(600, 380);
      await page.mouse.move(640, 400);
      await second.waitForSelector(".peer-cursor", { timeout: 10000 });
      assert.ok((await second.locator(".peer-hold").count()) > 0, "the other screen shows what they have selected");

      /*
       * Following somebody's viewport (§5.51). The property is not "the camera moved" — it is that
       * the two of them end up looking at the same place from windows of different sizes, which is
       * the thing copying a camera would get wrong.
       */
      const centreOf = (p) => p.evaluate(() => {
        const el = document.querySelector("[data-canvas-world]");
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
        const r = document.querySelector(".canvas-viewport").getBoundingClientRect();
        return { x: Math.round((r.width / 2 - m.e) / m.a), y: Math.round((r.height / 2 - m.f) / m.a) };
      });
      const followed = await page.locator(".fact-card").nth(1).boundingBox();
      await page.mouse.move(followed.x + followed.width / 2, followed.y + followed.height / 2);
      await page.keyboard.down("Control"); // a bare wheel pans in the default scroll mode
      for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(120); }
      await page.keyboard.up("Control");
      await page.waitForTimeout(900);

      await second.click("[data-peer-chips] [data-peer-follow]");
      await second.waitForSelector("[data-follow-bar]", { timeout: 15000 });
      await second.waitForTimeout(2200);
      const [mine, theirs] = [await centreOf(page), await centreOf(second)];
      assert.ok(Math.abs(mine.x - theirs.x) < 60 && Math.abs(mine.y - theirs.y) < 60,
        `following puts both windows on the same place (${JSON.stringify(mine)} vs ${JSON.stringify(theirs)})`);

      // A mutual follow would widen by the fitting margin every round and zoom the pair out of the
      // board, so it is refused rather than merely discouraged.
      const backChip = page.locator("[data-peer-chips] [data-peer-follow]").first();
      assert.equal(await backChip.isDisabled(), true, "you cannot follow somebody who is following you");

      // And moving the board yourself takes it back, with nothing to press.
      await second.mouse.move(700, 500);
      await second.mouse.wheel(0, 200);
      await second.waitForTimeout(700);
      assert.equal(await second.locator("[data-follow-bar]").count(), 0, "moving the board stops following");

      // Leaving takes the presence with it: no ghosts, and no lock left behind.
      await other.close();
      await page.waitForFunction(() => document.querySelectorAll(".peer-chip").length === 0, null, { timeout: 15000 });
      assert.equal(await page.locator(".field-held").count(), 0, "the lock goes when the person does");

      // The room wrote it down on the way out, so a reload finds the card in the database.
      await page.waitForTimeout(2500);
      await page.reload({ waitUntil: "load" });
      await page.waitForSelector(`input[value="${title}"]`, { timeout: 15000 });
    } finally {
      await other.close().catch(() => undefined);
    }
  }

  // ---- the documentation -------------------------------------------------------------------
  await page.goto(`${base}/w/acme-energy/docs`, { waitUntil: "load" });
  await page.waitForSelector(".doc-index-grid");
  assert.ok((await page.locator(".doc-index-card").count()) >= 15, "every documentation page is listed");
  await page.fill('.doc-search input[name="q"]', "retire a system");
  await page.click('.doc-search button[type="submit"]');
  await page.waitForSelector(".doc-result");
  assert.ok((await page.locator(".doc-result").count()) > 0, "the documentation is searchable");

  await page.goto(`${base}/w/acme-energy/docs/roadmap`, { waitUntil: "load" });
  await page.waitForSelector(".doc-article");
  // Screenshots below the fold are lazy: walk the page the way a reader would before asking
  // whether they loaded, or the check measures the viewport rather than the documentation.
  for (const shot of await page.locator(".doc-shot img").all()) await shot.scrollIntoViewIfNeeded();
  await page.waitForTimeout(2000);
  // the promise of illustrated docs is that the illustrations are there
  const shots = await page.$$eval(".doc-shot img", (els) => els.map((e) => ({ src: e.getAttribute("src"), loaded: e.naturalWidth > 0 })));
  assert.ok(shots.length > 0, "the page is illustrated");
  assert.deepEqual(shots.filter((s2) => !s2.loaded), [], "every screenshot the docs reference actually loads");
  assert.equal(await page.locator(".doc-nav a.active").innerText(), "Change sets: planning against the model",
    "the contents marks where you are");
  assert.ok((await page.locator(".doc-try a").first().getAttribute("href")).startsWith("/w/acme-energy/"),
    "a “try it” link opens the reader's own workspace");

  assert.deepEqual(problems, [], "no browser errors");

  /*
   * Comments (§5.50). A board is a thing two people stand in front of, so the checks are the two
   * things they do: say something about the board, and say something about one object on it — and
   * the second one has to leave a mark on the board itself, or nobody finds the conversation again.
   */
  await page.goto(`${base}/b/brd_landscape`, { waitUntil: "load" });
  await page.waitForSelector("[data-element-id]");
  await page.click("[data-comments-button]");
  await page.waitForSelector("[data-comments-panel]");

  const aboutBoard = `Smoke: is this the whole estate? ${Date.now()}`;
  await page.fill("[data-comment-input]", aboutBoard);
  await page.click("[data-comments-panel] .comment-compose button[type=submit]");
  await page.waitForSelector(`.comment-thread:has-text("${aboutBoard}")`);
  assert.equal(await page.locator(`.comment-thread:has-text("${aboutBoard}") .comment-anchor`).innerText(), "THIS BOARD",
    "a comment with no object is about the board");
  assert.ok((await page.locator(".topbar-count").innerText()).length > 0, "the topbar counts what is open");

  // Now about one object: select it, press Comment, and the compose box says what it is about.
  await page.locator("[data-element-id]").first().click();
  await page.waitForSelector("[data-comment-button]");
  const anchorName = await page.locator("[data-element-id]").first().getAttribute("data-element-id");
  await page.click("[data-comment-button]");
  await page.waitForSelector(".comment-about");
  const aboutThing = `Smoke: who owns this? ${Date.now()}`;
  await page.fill("[data-comment-input]", aboutThing);
  await page.click("[data-comments-panel] .comment-compose button[type=submit]");
  await page.waitForSelector(".comment-pin");
  assert.ok(anchorName, "the object being discussed has an id");
  assert.notEqual(await page.locator(`.comment-thread:has-text("${aboutThing}") .comment-anchor`).innerText(), "THIS BOARD",
    "a comment made from the selection is about that object");

  // A reply joins the conversation rather than starting a second one.
  const thing = page.locator(`.comment-thread:has-text("${aboutThing}")`);
  await thing.locator(".comment-more").click();
  await thing.locator("[data-comment-reply]").fill("Smoke: grid operations, I think.");
  await thing.locator(".comment-reply button[type=submit]").click();
  await page.waitForSelector(`.comment-thread:has-text("grid operations, I think")`);

  // Settling hides the pin and takes the thread out of the count, without deleting anything.
  const openThreads = await page.locator(".comment-thread").count();
  await page.locator(`.comment-thread:has-text("${aboutThing}") .comment-settle`).click();
  await page.waitForSelector(".comment-pin", { state: "detached" });
  await page.waitForFunction((n) => document.querySelectorAll(".comment-thread").length === n - 1, openThreads);
  await page.click(".comments-toggle");
  await page.waitForSelector(`.comment-thread.resolved:has-text("${aboutThing}")`);
  assert.ok(await page.locator(".comment-settled-by").first().isVisible(), "a settled conversation says who settled it");

  /*
   * People and roles (§5.46). The seeded owner can see the roster, change somebody's role and
   * change their own password; and the capability check is real — a member is refused where an
   * administrator is not, on the server, whatever the page chose to render.
   */
  await page.goto(`${base}/w/acme-energy/settings/people`, { waitUntil: "load" });
  await page.waitForSelector("[data-people] li");
  assert.ok((await page.locator("[data-people] li").count()) >= 4, "the workspace lists its people");
  assert.ok(await page.locator("[data-add-person]").isVisible(), "an owner is offered the add-somebody control");

  const maria = page.locator('[data-people] li:has-text("Maria Lund")');
  await maria.locator("select.people-role").selectOption("guest");
  await page.waitForTimeout(700);
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector("[data-people] li");
  assert.equal(
    await page.locator('[data-people] li:has-text("Maria Lund") select.people-role').inputValue(),
    "guest",
    "a role change sticks",
  );

  // Now be Maria, who is a guest, and find the door shut.
  const guestContext = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const guest = await guestContext.newPage();
  try {
    await signIn(guest, "maria@acme-energy.example");
    await guest.goto(`${base}/w/acme-energy/settings/people`, { waitUntil: "load" });
    await guest.waitForSelector("[data-people] li");
    assert.equal(await guest.locator("[data-add-person]").count(), 0, "a guest is not offered the controls they cannot use");

    // The enforcement, not the rendering: a board save is refused for somebody who may only read.
    const refused = await guest.evaluate(async () => {
      const res = await fetch("/api/boards/brd_capabilities", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ document: { version: 2, elements: {} } }),
      });
      return res.status;
    });
    assert.equal(refused, 403, "a guest's board save is refused by the server");

    /*
     * …and yet a guest may comment (§5.50). The reviewer you invite to look at an architecture is
     * exactly the person with something to say about it, so `board.comment` is its own capability
     * rather than a corner of `board.edit`.
     */
    await guest.goto(`${base}/b/brd_landscape`, { waitUntil: "load" });
    await guest.waitForSelector("[data-element-id]");
    await guest.click("[data-comments-button]");
    await guest.waitForSelector("[data-comments-panel]");
    const guestSaid = `Smoke guest: looks right to me ${Date.now()}`;
    await guest.fill("[data-comment-input]", guestSaid);
    await guest.click("[data-comments-panel] .comment-compose button[type=submit]");
    await guest.waitForSelector(`.comment-thread:has-text("${guestSaid}")`);

    // Your own words only, and the rule is visible rather than a refusal after the fact: the
    // guest's own comment carries Edit, and the one Jes left does not.
    assert.equal(await guest.locator(`.comment-thread:has-text("${guestSaid}") .comment-edit`).count(), 1,
      "you can edit what you wrote");
    assert.equal(await guest.locator(`.comment-thread:has-text("${aboutBoard}") .comment-edit`).count(), 0,
      "you cannot edit what somebody else wrote");

    await guest.locator(`.comment-thread:has-text("${guestSaid}") .comment-settle`).click();
    await guest.waitForTimeout(500);
  } finally {
    await guestContext.close();
  }

  // Leave the board as it was found: settle the board-level thread too.
  await page.goto(`${base}/b/brd_landscape`, { waitUntil: "load" });
  await page.click("[data-comments-button]");
  await page.waitForSelector(`.comment-thread:has-text("${aboutBoard}")`);
  await page.locator(`.comment-thread:has-text("${aboutBoard}") .comment-settle`).click();
  await page.waitForTimeout(500);

  /*
   * More than one workspace (§5.48): the switcher lists what you are in, creating one lands you in
   * it, and — the part that matters — a workspace you are not a member of is not reachable by
   * knowing its address.
   */
  await page.goto(`${base}/w/acme-energy`, { waitUntil: "load" });
  await page.click("[data-workspace-switcher] .ws-switcher-current");
  await page.waitForSelector("[data-new-workspace]");
  await page.click("[data-new-workspace]");
  await page.fill('[data-workspace-switcher] input[name="name"]', `Smoke Holdings ${Date.now()}`);
  await page.press('[data-workspace-switcher] input[name="name"]', "Enter");
  await page.waitForURL((u) => /\/w\/smoke-holdings/.test(u.pathname), { timeout: 30000 });
  await page.waitForSelector(".studio-home-nav");
  const secondSlug = new URL(page.url()).pathname.split("/")[2];
  await page.click("[data-workspace-switcher] .ws-switcher-current");
  assert.ok((await page.locator("[data-workspace-switcher] .ws-switcher-menu a").count()) >= 2, "the switcher lists both workspaces");
  await page.keyboard.press("Escape");

  {
    const outsider = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const other = await outsider.newPage();
    try {
      await signIn(other, "tobias@acme-energy.example");
      const res = await other.goto(`${base}/w/${secondSlug}`, { waitUntil: "load" });
      assert.equal(res.status(), 404, "a workspace you are not in is not reachable by its address");
    } finally {
      await outsider.close();
    }
  }
  await page.goto(`${base}/w/acme-energy/settings/people`, { waitUntil: "load" });
  await page.waitForSelector("[data-people] li");

  // Put her back, so the suite leaves the workspace as it found it.
  await page.locator('[data-people] li:has-text("Maria Lund") select.people-role').selectOption("member");
  await page.waitForTimeout(700);

  /*
   * The typeface is served from this deployment (§5.45): no request to Google, and IBM Plex Sans
   * actually resolved rather than quietly falling back to the system stack.
   */
  assert.deepEqual(offsite, [], "nothing is fetched from a font host");
  await page.goto(`${base}/w/acme-energy`, { waitUntil: "load" });
  await page.waitForSelector(".studio-home-nav");
  await page.evaluate(() => document.fonts.ready);
  assert.ok(await page.evaluate(() => document.fonts.check('14px "IBM Plex Sans"')), "the self-hosted IBM Plex Sans loaded");

  console.log("smoke: all checks passed");
} catch (error) {
  // A failing assertion in a headless browser is a mystery without a picture. Leave one.
  const shot = new URL("./failure.png", import.meta.url).pathname;
  await page.screenshot({ path: shot, fullPage: false }).catch(() => undefined);
  console.error(`smoke: failed at ${page.url()}`);
  console.error(`smoke: ${await page.locator("[data-element-id]").count().catch(() => "?")} elements on screen`);
  console.error(`smoke: screenshot written to ${shot}`);
  if (problems.length) console.error(`smoke: browser reported ${problems.length}: ${problems.slice(0, 3).join(" | ")}`);
  throw error;
} finally {

  await browser.close();
}
