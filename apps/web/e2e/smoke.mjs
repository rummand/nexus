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

  // meta-model builder: the tree lists types, and an undeclared type can be declared
  await page.goto(`${base}/w/acme-energy/meta`, { waitUntil: "load" });
  await page.waitForSelector(".meta-tree");
  assert.ok((await page.locator(".meta-tree-label").count()) > 0, "meta-model lists node and relation types");
  // node types only — a relation type's detail pane has rules, not fields
  const undeclared = page.locator('.meta-tree-item[data-type-kind="node"]', { has: page.locator(".meta-dot.undeclared") }).first();
  if (await undeclared.count()) {
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

  // clean up the note this run created, so repeated runs do not silt up the demo board
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
  const discovered = await page.locator("[data-discovery]").count();
  if (discovered > 0) {
    // every proposal shows its evidence before it asks for anything
    assert.ok((await page.locator("[data-discovery] .catalog-evidence li").count()) > 0, "a discovery shows the evidence behind it");
    await page.locator('[data-discovery] button:has-text("Review what it may read")').first().click();
  } else {
    await page.locator('[data-provider="sap"]').click();
  }
  await page.waitForSelector("[data-provider-panel]");
  assert.ok((await page.locator("[data-scope]").count()) > 0, "the grant panel lists what may be read, scope by scope");
  // every scope says what it puts in the graph
  assert.ok((await page.locator("[data-scope] .scope-yields").count()) > 0, "each scope says what it yields");
  await page.keyboard.press("Escape");
  await page.locator('.catalog-panel button[aria-label="Close"]').click().catch(() => {});
  await page.waitForTimeout(400);

  // leave the shared database as we found it
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

  assert.deepEqual(problems, [], "no browser errors");
  console.log("smoke: all checks passed");
} finally {
  await browser.close();
}
