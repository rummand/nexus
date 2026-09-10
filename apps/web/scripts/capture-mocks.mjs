/**
 * Render the design-direction mocks in docs/design/mocks to PNGs (§4b).
 *
 * They are hand-written HTML rather than screenshots of the app because that is the point: they
 * show what the app does not look like yet. Run with:  node scripts/capture-mocks.mjs [outDir]
 */
import { chromium } from "playwright";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
/* Resolve from this file, not from wherever the runner was started. */
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../docs/design/mocks");
const out = process.argv[2] ?? "/tmp";
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const p = await b.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
for (const f of readdirSync(dir).filter((f) => f.endsWith(".html")).sort()) {
  await p.goto(`file://${dir}/${f}`, { waitUntil: "load" });
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/mock-${f.replace(".html", ".png")}` });
  console.log("shot", f);
}
await b.close();
