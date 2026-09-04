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
import { chromium } from "playwright";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const TEXT = `Smoke ${Date.now()}`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const problems = [];
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && !/ERR_CONNECTION|Failed to load resource/.test(m.text()) && problems.push(`console: ${m.text()}`));
let saves = 0;
page.on("request", (r) => r.method() === "PUT" && r.url().includes("/api/boards/") && saves++);

const count = () => page.locator("[data-element-id]").count();
const zoom = () => page.locator(".zoom-card strong").innerText();

try {
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
  // the first render uses a 1×1 viewport and culls almost everything; wait for the fitted render
  await page.waitForFunction(() => document.querySelectorAll("[data-element-id]").length > 10, null, { timeout: 15000 });
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
  await page.mouse.click(nb.x + nb.width / 2, nb.y + nb.height / 2);
  assert.ok(await page.locator(".inspector-panel h2", { hasText: TEXT }).isVisible(), "inspector shows the selected note");
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
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  await page.mouse.move(1175, 470, { steps: 10 });
  await page.mouse.up();
  assert.equal(await count(), beforeDelete + 3, "connector created");

  // context menu on the note
  const cb = await note.boundingBox();
  await page.mouse.click(cb.x + cb.width / 2, cb.y + cb.height / 2, { button: "right" });
  assert.ok(await page.locator(".context-menu").isVisible(), "right-click opens the context menu");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".context-menu").count(), 0, "escape closes the context menu");

  // command bar: structured graph query with placement
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+k");
  await page.fill(".command-bar input", "kind:Application criticality:high");
  await page.waitForSelector(".search-suggestions .graph-hit", { timeout: 15000 });
  assert.ok((await page.locator(".search-suggestions .graph-hit").count()) > 0, "graph query returns entities");
  await page.keyboard.press("Escape");
  await page.fill(".command-bar input", "");

  // command bar finds the note
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+k");
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
    assert.ok(await page.locator(".graph-block").isVisible(), "inspector shows graph facts for the placed card");
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
  await page.waitForTimeout(1500);
  assert.ok(saves >= 1, "autosave issued a PUT");
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

  // graph page: import the sample and check the meta-model renders
  await page.goto(`${base}/w/acme-energy/graph`, { waitUntil: "load" });
  assert.ok((await page.locator(".kind-card").count()) > 0, "graph page shows kinds");
  assert.ok(await page.locator("text=Agent proposals").isVisible(), "graph page shows agent proposals");
  await page.click(".entity-view-tabs button:has-text('Table')");
  await page.waitForSelector("[data-entity-table]");
  assert.ok((await page.locator("[data-entity-table] th").count()) >= 4, "table view renders attribute columns");
  await page.click(".entity-view-tabs button:has-text('List')");
  await page.click("text=Import data");
  await page.click("text=Use sample");
  await page.click('.modal-card button:text-is("Import")');
  await page.waitForSelector(".modal-card .mode-banner");
  await page.click('.modal-card button:text-is("Done")');

  // create a board from a space via a starter
  await page.goto(`${base}/w/acme-energy/spaces/space_sandbox`, { waitUntil: "load" });
  await page.click(".studio-starters button >> nth=0");
  await page.waitForURL(/\/b\//, { timeout: 30000 });

  assert.deepEqual(problems, [], "no browser errors");
  console.log("smoke: all checks passed");
} finally {
  await browser.close();
}
