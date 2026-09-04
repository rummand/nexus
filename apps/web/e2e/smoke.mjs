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

  // note: N + click, type the title (auto-focused), Escape
  await page.keyboard.press("n");
  await page.mouse.click(900, 750);
  await page.waitForSelector(".impact-note input:focus");
  const noteId = await page.evaluate(() => document.activeElement?.closest("[data-element-id]")?.getAttribute("data-element-id"));
  assert.ok(noteId, "new note has an id");
  await page.keyboard.type(TEXT);
  await page.keyboard.press("Escape");
  const note = page.locator(`[data-element-id="${noteId}"]`);
  assert.equal(await note.locator("input").first().inputValue(), TEXT, "note title typed");

  // drag by the note surface (not the inputs)
  const b0 = await note.boundingBox();
  await page.mouse.move(b0.x + 6, b0.y + b0.height / 2);
  await page.mouse.down();
  await page.mouse.move(b0.x + 6 + 120, b0.y + b0.height / 2 + 60, { steps: 8 });
  await page.mouse.up();
  const b1 = await note.boundingBox();
  assert.ok(Math.abs(b1.x - b0.x - 120) < 2 && Math.abs(b1.y - b0.y - 60) < 2, "note moved with the pointer");

  // zoom + pan + fit
  await page.mouse.move(700, 500);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -300);
  await page.keyboard.up("Control");
  assert.notEqual(await zoom(), z0, "ctrl+wheel zooms");
  const bg0 = await page.locator(".canvas-viewport").evaluate((el) => el.style.backgroundPosition);
  await page.mouse.wheel(100, 50);
  assert.notEqual(await page.locator(".canvas-viewport").evaluate((el) => el.style.backgroundPosition), bg0, "wheel pans");
  await page.keyboard.press("Shift+1");
  const fit = parseInt(await zoom(), 10);
  assert.ok(Math.abs(fit - parseInt(z0, 10)) <= 5, `shift+1 fits the board (got ${fit}%, initial ${z0})`);

  // select + inspector + delete + undo
  const nb = await note.boundingBox();
  await page.mouse.click(nb.x + 6, nb.y + nb.height / 2);
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
  await page.mouse.move(sb.x + 6, sb.y + sb.height / 2);
  await page.mouse.down();
  await page.mouse.move(1175, 470, { steps: 10 });
  await page.mouse.up();
  assert.equal(await count(), beforeDelete + 3, "connector created");

  // command bar finds the note
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+k");
  await page.keyboard.type(TEXT.slice(0, 9));
  await page.waitForSelector(".search-suggestions button");
  assert.ok((await page.locator(".search-suggestions button", { hasText: TEXT }).count()) >= 1, "command bar finds the note");
  await page.keyboard.press("Escape");

  // autosave + reload
  await page.waitForTimeout(1500);
  assert.ok(saves >= 1, "autosave issued a PUT");
  await page.reload({ waitUntil: "load" });
  await page.locator(`[data-element-id="${noteId}"]`).waitFor({ timeout: 10000 });
  assert.equal(await page.locator(`[data-element-id="${noteId}"] input`).first().inputValue(), TEXT, "note persisted across reload");

  // create a board from a space via a starter
  await page.goto(`${base}/w/acme-energy/spaces/space_sandbox`, { waitUntil: "load" });
  await page.click(".studio-starters button >> nth=0");
  await page.waitForURL(/\/b\//, { timeout: 30000 });

  assert.deepEqual(problems, [], "no browser errors");
  console.log("smoke: all checks passed");
} finally {
  await browser.close();
}
