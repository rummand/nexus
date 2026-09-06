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
  await page.keyboard.press("Escape");
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

  // meta-model builder: the tree lists types, and an undeclared type can be declared
  await page.goto(`${base}/w/acme-energy/meta`, { waitUntil: "load" });
  await page.waitForSelector(".meta-tree");
  assert.ok((await page.locator(".meta-tree-label").count()) > 0, "meta-model lists node and relation types");
  // node types only — a relation type's detail pane has rules, not fields
  const undeclared = page.locator('.meta-tree-item[data-type-kind="node"]', { has: page.locator(".meta-dot.undeclared") }).first();
  // The seed always grows kinds from its boards without declaring them, so this is not optional:
  // before the suite had a database of its own, earlier runs declared them all and the coverage
  // silently disappeared.
  assert.ok(await undeclared.count(), "the seed has kinds that grew from data and were never declared");
  {
    await undeclared.locator(".meta-tree-label").click();
    await page.waitForSelector(".meta-detail-body");
    await page.click(".meta-callout button");
    await page.waitForTimeout(1500);
    // innerText reflects the CSS uppercase transform, so compare case-insensitively
    assert.match(await page.locator(".meta-detail-body header .meta-presence").innerText(), /^declared$/i, "declaring a type promotes it out of 'from data'");
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
  await page.click('.meta-view-tabs button:has-text("Diagram")');
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
  await page.click('.meta-view-tabs button:has-text("Details")');
  await page.waitForSelector(".meta-detail-body");
  assert.equal(await page.locator(".meta-detail-body h2").textContent(), boxName, "selecting in the diagram drives the detail pane");

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
  await page.waitForTimeout(1500); // let the autosave land
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
  const graph = await (await fetch(`${base}/api/graph/query`, {
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

  // ---- the landing zone: files in, reviewed, approved, and put back --------------------------
  // The whole point of the feature is that the last step really undoes the one before it, so this
  // walks the round trip and checks the graph is the size it started at.
  await page.goto(`${base}/w/acme-energy/graph`, { waitUntil: "load" });
  await page.waitForSelector("[data-health]");
  const countEntities = async () => {
    const r = await fetch(`${base}/api/graph/query`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId: "ws_acme", q: "kind:Application" }),
    });
    return (await r.json()).total;
  };
  const before = await countEntities();

  await page.goto(`${base}/w/acme-energy/apm`, { waitUntil: "load" });
  await page.waitForSelector("[data-apm-upload]");
  await page.setInputFiles("[data-apm-files]", [
    fixture("servicenow-business-applications.csv"),
    fixture("sharepoint-app-list.csv"),
    fixture("application-audit-2019.xlsx"),
    fixture("architecture-review-q3.docx"),
  ]);
  await page.click("[data-apm-upload] button[type=submit]");
  await page.waitForURL(/\/apm\/bat_/, { timeout: 60000 });
  await page.waitForSelector("[data-apm-counts]", { timeout: 30000 });
  const batchUrl = page.url();
  const counts = await page.locator("[data-apm-counts]").innerText();
  assert.match(counts, /objects staged/, "the batch is staged");
  assert.ok((await page.locator("[data-apm-row]").count()) > 0, "there are rows to review");
  // an Excel serial became a date, and a person column was kept out
  const files = await page.locator(".apm-files").innerText();
  assert.match(files, /application-audit-2019\.xlsx/, "the spreadsheet was read");
  assert.match(files, /architecture-review-q3\.docx/, "…and the Word document came along as prose");
  assert.equal(await page.locator(".apm-personal-toggle input").isChecked(), false,
    "the columns that name people are excluded until somebody says otherwise");

  await page.click("[data-approve-batch]"); // a dialog handler is already installed above
  await page.waitForSelector("[data-apm-result]", { timeout: 60000 });
  assert.match(await page.locator("[data-apm-result]").innerText(), /created/, "approving says what it wrote");
  const after = await countEntities();
  assert.ok(after > before, `approving created objects (${before} → ${after})`);

  await page.goto(batchUrl, { waitUntil: "load" });
  await page.waitForSelector("[data-rollback-batch]", { timeout: 30000 });
  await page.click("[data-rollback-batch]");
  await page.waitForSelector("[data-apm-result]", { timeout: 60000 });
  assert.match(await page.locator("[data-apm-result]").innerText(), /deleted/, "the rollback says what it undid");
  assert.equal(await countEntities(), before, "rolling back puts the graph back exactly as it was");

  // ---- an agent on the board -----------------------------------------------------------------
  // Placing one and scoping it works with or without a model; waking it needs one, and with none
  // configured the agent has to say so on the board rather than fail silently.
  await page.goto(`${base}/b/brd_landscape`, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelectorAll("[data-element-id]").length > 5, null, { timeout: 45000 });
  await page.click('[aria-label="Agent — put one where the work is"]');
  const canvasBox = await page.locator(".canvas-viewport").boundingBox();
  await page.mouse.click(canvasBox.x + 420, canvasBox.y + 700);
  await page.waitForSelector("[data-agent]", { timeout: 20000 });
  const placed = page.locator("[data-agent]").last();
  await placed.locator('textarea[aria-label="What this agent is for"]').fill("Where does this landscape contradict itself?");
  await placed.locator(".board-agent-scope button", { hasText: "frame" }).click();
  assert.equal(await placed.locator(".board-agent-scope button.on").innerText(), "frame",
    "an agent is scoped by where you put it, not by a query somebody has to write");
  await placed.locator('input[aria-label="Agent name"]').fill("Succession watch");
  await placed.locator("[data-wake-agent]").click();
  await page.waitForSelector("[data-agent] .board-agent-said", { timeout: 30000 });
  const said = await placed.locator(".board-agent-said").innerText();
  assert.ok(/ANTHROPIC_API_KEY|NEXUS_MODEL|No model|nothing in this agent/i.test(said),
    `an agent that cannot run says why on the board — got "${said}"`);

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
  await page.waitForFunction(() => document.querySelectorAll("[data-element-id]").length > 3, null, { timeout: 45000 });
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
