/**
 * Export a LeanIX workspace to files (§5.62).
 *
 *   LEANIX_HOST=energinet.leanix.net LEANIX_API_TOKEN=… pnpm leanix:export
 *
 * The token comes from the environment and never from an argument: a secret in `argv` is a secret
 * in the shell history and in every `ps` on the machine. Nothing here writes it anywhere.
 *
 * Writes into `leanix-export/` (git-ignored) — a raw dump, a Nexus import file, and a summary:
 *
 *   raw.json            everything as it came back, so nothing has to be fetched twice
 *   nexus-import.json   entities + relations, ready for the Import page
 *   dropped.json        relations whose other end was outside the export, if any
 *   summary.md          what was found, by kind
 *
 * `--dry-run` authenticates and reads one page, then stops. Run that first: it proves the token,
 * the host and the network in about a second, and tells you how many fact sheets are coming.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fetchAll, LeanIxError, type LeanIxOptions } from "../src/lib/leanix/client";
import { mapExport, summarise } from "../src/lib/leanix/map";

const host = (process.env.LEANIX_HOST ?? "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
const token = (process.env.LEANIX_API_TOKEN ?? "").trim();
const dryRun = process.argv.includes("--dry-run");
const out = path.resolve(process.cwd(), process.env.LEANIX_OUT ?? "leanix-export");

function fail(message: string): never {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

if (!host) fail("Set LEANIX_HOST, e.g. LEANIX_HOST=acme.leanix.net (the host, not the graphiql URL).");
if (!token) fail("Set LEANIX_API_TOKEN. Administration → API tokens in LeanIX; it needs read access.");

const options: LeanIxOptions = {
  host,
  token,
  baseUrl: process.env.LEANIX_BASE_URL?.trim() || undefined,
  pageSize: Number(process.env.LEANIX_PAGE_SIZE ?? 100),
  log: (line) => console.log(`  ${line}`),
};

/* Wrapped rather than top-level await: tsx compiles this package as CJS. */
async function main() {
  try {
    console.log(`\n  LeanIX export — ${host}${dryRun ? " (dry run)" : ""}\n`);
    const dump = await fetchAll(dryRun ? { ...options, maxPages: 1 } : options);

    if (dryRun) {
      console.log(`\n  Token and host are good. ${dump.factSheets.length} fact sheets in the first page.`);
      console.log(`  Types seen so far: ${dump.types.map((t) => `${t.type} (${t.count})`).join(", ") || "none"}`);
      console.log("\n  Run again without --dry-run to write the files.\n");
      process.exit(0);
    }

    const mapped = mapExport(dump);
    mkdirSync(out, { recursive: true });
    writeFileSync(path.join(out, "raw.json"), JSON.stringify(dump, null, 2));
    writeFileSync(path.join(out, "nexus-import.json"), JSON.stringify({ entities: mapped.entities, relations: mapped.relations }, null, 2));
    if (mapped.dropped.length) writeFileSync(path.join(out, "dropped.json"), JSON.stringify(mapped.dropped, null, 2));
    writeFileSync(path.join(out, "summary.md"), summarise(dump, mapped));

    console.log(`\n  ${dump.factSheets.length} fact sheets, ${mapped.relations.length} relations → ${out}`);
    for (const k of mapped.byKind) console.log(`    ${String(k.count).padStart(6)}  ${k.kind}`);
    if (mapped.dropped.length) console.log(`\n  ${mapped.dropped.length} relations dropped — see dropped.json.`);
    console.log(`\n  Load nexus-import.json from the Import page, or keep raw.json and re-map later.\n`);
  } catch (e) {
    if (e instanceof LeanIxError) {
      console.error(`\n  ${e.message}`);
      if (e.detail) console.error(`\n  ${typeof e.detail === "string" ? e.detail : JSON.stringify(e.detail, null, 2)}`);
      console.error("");
      process.exit(1);
    }
    throw e;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
