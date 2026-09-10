/**
 * Read a whole LeanIX workspace from the command line and say what is in it (§5.73).
 *
 * The in-app door (Import → An EA repository) is the one most people should use: it takes the
 * token in the browser, uses it for one request and never stores it. This exists for the case
 * that door cannot serve — an operator running against a server, or a pull big enough to want a
 * terminal rather than a spinner in a tab.
 *
 * **The token is read from the environment and never from argv.** A command line ends up in
 * shell history, in `ps` output for every user on the box, and in whatever process listing the
 * container platform keeps. None of those is a place for an API credential.
 *
 *   NEXUS_LEANIX_HOST=example.leanix.net NEXUS_LEANIX_TOKEN=… pnpm leanix:read
 *
 * Better still, put both in `apps/web/.env.local`, which is gitignored, and run it with nothing
 * on the line at all.
 *
 * It **never writes to the graph**, and deliberately does not stage a batch either: staging is
 * `stageBatch`, which re-maps every column against the names the workspace already knows, reads
 * the prose for claims and builds the review record. Reimplementing a fraction of that here
 * would produce a batch the app could not review — worse than no batch. So this reports, and
 * `--save` writes the export to `leanix-export/` as CSVs that go in through Import → Files,
 * which is the same reviewed pipeline everything else uses.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fetchAll, LeanIxError } from "@/lib/leanix/client";
import { mapExport, summarise } from "@/lib/leanix/map";
import { toBatchFiles } from "@/lib/leanix/batch";

/** `.env.local` is not loaded for a bare tsx run the way it is for `next dev`. */
function loadEnvLocal() {
  const file = path.resolve(process.cwd(), ".env.local");
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

/** Never the value: enough to tell two tokens apart in a log, useless to anybody who reads it. */
const fingerprint = (token: string) => `${token.slice(0, 4)}…${token.length} chars`;

async function main() {
  loadEnvLocal();

  const argv = process.argv.slice(2);
  const save = argv.includes("--save");

  const host = (process.env.NEXUS_LEANIX_HOST ?? "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const token = (process.env.NEXUS_LEANIX_TOKEN ?? "").trim();
  const baseUrl = process.env.NEXUS_LEANIX_BASE_URL?.trim() || undefined;

  if (!host || !token) {
    console.error(
      [
        "Two things are needed, both from the environment and never from the command line:",
        "",
        "  NEXUS_LEANIX_HOST    the workspace host, e.g. example.leanix.net",
        "  NEXUS_LEANIX_TOKEN   an API token from LeanIX → Administration → API tokens",
        "",
        "Put them in apps/web/.env.local (gitignored) and run again.",
        "",
        `  host:  ${host || "(not set)"}`,
        `  token: ${token ? fingerprint(token) : "(not set)"}`,
      ].join("\n"),
    );
    process.exitCode = 1;
    return;
  }

  console.log(`Reading ${host} with ${fingerprint(token)} — nothing will be written to the graph.\n`);

  const started = Date.now();
  let dump;
  try {
    dump = await fetchAll({ host, baseUrl, token });
  } catch (error) {
    if (error instanceof LeanIxError) {
      /*
       * A GraphQL 200 with an `errors` array is how this API says no, so the detail is an
       * object far more often than a string. Rendering only strings threw away the one piece
       * of information the reader needs: which field the server did not recognise.
       */
      console.error(`LeanIX refused: ${error.message}${error.detail ? `\n  It said: ${describeDetail(error.detail)}` : ""}`);
    } else {
      console.error(
        `Could not reach ${host}: ${error instanceof Error ? error.message : "unknown error"}\n`
          + "  This runs on the server, so it is the server's network that has to reach LeanIX.",
      );
    }
    process.exitCode = 1;
    return;
  }

  const mapped = mapExport(dump);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`${summarise(dump, mapped)}  (${seconds}s)\n`);

  const byType = new Map<string, number>();
  for (const sheet of dump.factSheets) byType.set(sheet.type, (byType.get(sheet.type) ?? 0) + 1);
  console.log("Fact sheet types:");
  for (const [type, n] of [...byType.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(6)}  ${type}`);
  }

  const byRelation = new Map<string, number>();
  for (const r of dump.relations) byRelation.set(r.type, (byRelation.get(r.type) ?? 0) + 1);
  if (byRelation.size) {
    console.log("\nRelation types:");
    for (const [type, n] of [...byRelation.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(6)}  ${type}`);
    }
  }

  if (mapped.dropped.length) {
    /*
     * A relation whose other end is not in the export is a fact about the token's scope, not a
     * glitch to swallow: it almost always means a fact sheet type this token cannot see, and an
     * import that quietly loses those edges is an import that under-reports the estate.
     */
    console.log(
      `\n${mapped.dropped.length} relation${mapped.dropped.length === 1 ? "" : "s"} point at a fact sheet this token cannot see`
        + " — usually a type the token has no permission for.",
    );
  }

  if (!save) {
    console.log("\nNothing written. Re-run with --save to write the export to leanix-export/.");
    return;
  }

  const dir = path.resolve(process.cwd(), "..", "..", "leanix-export");
  mkdirSync(dir, { recursive: true });
  const files = toBatchFiles(dump);
  for (const file of files) {
    const csv = [file.headers, ...file.rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const name = `${file.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
    writeFileSync(path.join(dir, name), `${csv}\n`, "utf8");
    console.log(`  ${String(file.rows.length).padStart(6)} rows → leanix-export/${name}`);
  }
  writeFileSync(path.join(dir, "SUMMARY.md"), `${summarise(dump, mapped)}\n`, "utf8");
  console.log(
    `\n${files.length} file${files.length === 1 ? "" : "s"} in leanix-export/ (gitignored).`
      + "\nImport them through the app: Import → Files, which stages them for review before anything reaches the graph.",
  );
}


/** Whatever LeanIX put in the error, as something a person can read. */
function describeDetail(detail: unknown): string {
  if (typeof detail === "string") return detail.trim().slice(0, 800);
  if (Array.isArray(detail)) {
    return detail
      .map((e) => {
        const m = e as { message?: unknown; path?: unknown };
        const message = typeof m?.message === "string" ? m.message : JSON.stringify(e);
        const at = Array.isArray(m?.path) ? ` (at ${m.path.join(".")})` : "";
        return `${message}${at}`;
      })
      .join("\n            ")
      .slice(0, 1500);
  }
  return JSON.stringify(detail).slice(0, 800);
}

/** RFC 4180 enough: quote when the value contains a comma, a quote or a newline. */
function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
