/**
 * Browser smoke test for the workspace pages and the canvas.
 *
 * Requires a running app (default http://localhost:3000) and a Chromium that Playwright
 * can launch. Run with:  pnpm e2e   (or BASE_URL=... pnpm e2e)
 *
 * The test creates elements on the seeded "Business capability map" board and a board in
 * the Sandbox room, so run it against a development database only.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const TEXT = `Smoke ${Date.now()}`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const problems = [];
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
let saves = 0;
page.on("request", (r) => r.method() === "PUT" && r.url().includes("/api/boards/") && saves++);

const count = () => page.locator("[data-element-id]").count();
const zoom = () => page.locator("button[title^='Reset to 100%']").innerText();

try {
  // workspace pages
  await page.goto(`${base}/w/acme-energy`, { waitUntil: "load" });
  assert.ok(await page.locator("text=Rooms").first().isVisible(), "home renders rooms");
  await page.goto(`${base}/w/acme-energy/rooms/room_landscape`, { waitUntil: "load" });
  assert.ok(await page.locator("text=Business capability map").first().isVisible(), "room lists boards");
  await page.goto(`${base}/w/acme-energy/teams/team_ea`, { waitUntil: "load" });
  assert.ok(await page.locator("text=Members").first().isVisible(), "team page renders members");

  // canvas
  await page.goto(`${base}/b/brd_capabilities`, { waitUntil: "load" });
  await page.waitForSelector("[data-element-id]");
  const initial = await count();
  assert.ok(initial > 10, "seeded board has elements");
  const z0 = await zoom();

  // sticky: N + click, type, Escape
  await page.keyboard.press("n");
  await page.mouse.click(900, 700);
  await page.waitForSelector("textarea");
  await page.keyboard.type(TEXT);
  await page.keyboard.press("Escape");
  const sticky = page.locator("[data-element-id]", { hasText: TEXT }).first();
  assert.ok(await sticky.isVisible(), "sticky created with text");

  // drag
  const b0 = await sticky.boundingBox();
  await page.mouse.move(b0.x + b0.width / 2, b0.y + b0.height / 2);
  await page.mouse.down();
  await page.mouse.move(b0.x + b0.width / 2 + 120, b0.y + b0.height / 2 + 60, { steps: 8 });
  await page.mouse.up();
  const b1 = await sticky.boundingBox();
  assert.ok(Math.abs(b1.x - b0.x - 120) < 2 && Math.abs(b1.y - b0.y - 60) < 2, "sticky moved with the pointer");

  // zoom + pan + fit
  await page.mouse.move(700, 450);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -300);
  await page.keyboard.up("Control");
  assert.notEqual(await zoom(), z0, "ctrl+wheel zooms");
  const bg0 = await page.locator(".canvas-root").evaluate((el) => el.style.backgroundPosition);
  await page.mouse.wheel(100, 50);
  assert.notEqual(await page.locator(".canvas-root").evaluate((el) => el.style.backgroundPosition), bg0, "wheel pans");
  await page.keyboard.press("Shift+1");
  assert.equal(await zoom(), z0, "shift+1 zooms to fit");

  // delete + undo
  await sticky.click();
  const beforeDelete = await count();
  await page.keyboard.press("Delete");
  assert.equal(await count(), beforeDelete - 1, "delete removes the sticky");
  await page.keyboard.press("Control+z");
  assert.equal(await count(), beforeDelete, "undo restores it");

  // rectangle + connector
  await page.keyboard.press("r");
  await page.mouse.move(1000, 200);
  await page.mouse.down();
  await page.mouse.move(1150, 300, { steps: 5 });
  await page.mouse.up();
  assert.equal(await count(), beforeDelete + 1, "rectangle drawn");
  await page.keyboard.press("Escape");
  await page.keyboard.press("c");
  const sb = await sticky.boundingBox();
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  await page.mouse.move(1075, 250, { steps: 10 });
  await page.mouse.up();
  assert.equal(await count(), beforeDelete + 2, "connector created");

  // autosave + reload
  await page.waitForTimeout(1500);
  assert.ok(saves >= 1, "autosave issued a PUT");
  await page.reload({ waitUntil: "load" });
  await page.locator("[data-element-id]", { hasText: TEXT }).first().waitFor({ timeout: 10000 });
  assert.equal(await page.locator("[data-element-id]", { hasText: TEXT }).count(), 1, "sticky persisted across reload");

  // create a board from a room
  await page.goto(`${base}/w/acme-energy/rooms/room_sandbox`, { waitUntil: "load" });
  await page.click("button:has-text('New board') >> nth=0");
  await page.waitForURL(/\/b\//, { timeout: 30000 });

  assert.deepEqual(problems, [], "no browser errors");
  console.log("smoke: all checks passed");
} finally {
  await browser.close();
}
