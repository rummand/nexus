/**
 * Import a LeanIX workspace into the graph from a terminal (§5.74).
 *
 * The in-app door — Import → An EA repository — is the one almost everybody should use: it takes
 * the token in the browser, uses it for one request and never stores it, and the review happens
 * where the reviewer is. This exists for the case that door cannot serve: a first import of a real
 * estate on a deployed server, where the person doing it has a shell and not a session, and the
 * pull is four hundred objects and several minutes rather than a spinner in a tab.
 *
 * It is the *same* import. `stageBatch` and `applyBatch` are the functions the button calls
 * (§5.74) — one implementation, so the terminal and the browser cannot disagree about what an
 * approved batch does to the graph. What this adds is only the two things a request would have
 * answered: which database, and who is answerable for the result.
 *
 *   NEXUS_LEANIX_HOST=example.leanix.net NEXUS_LEANIX_TOKEN=… pnpm leanix:into-graph --approve
 *
 * **The token is read from the environment and never from argv**: a command line ends up in shell
 * history, in `ps` output for every user on the box, and in the container platform's process
 * listing. `DATABASE_URL` says which graph, exactly as it does for the server.
 *
 * Without `--approve` it stages and stops, which is the honest default: the batch is then waiting
 * on the import page for a person to look through before anything is written. With it, the same
 * approval the button performs runs here, and it is as rollback-able as any other.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { fetchAll, LeanIxError } from "@/lib/leanix/client";
import { toBatchFiles } from "@/lib/leanix/batch";
import { applyBatch, stageBatch } from "@/lib/import/run";

/** `.env.local` is not loaded for a bare tsx run the way it is for `next dev`. */
function loadEnvLocal() {
  let text: string;
  try {
    text = readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq_ = trimmed.indexOf("=");
    if (eq_ < 1) continue;
    const key = trimmed.slice(0, eq_).trim();
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq_ + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

/** Never the value: enough to tell two tokens apart in a log, useless to anybody who reads it. */
const fingerprint = (token: string) => `${token.slice(0, 4)}…${token.length} chars`;

/** Whatever LeanIX put in the error, as something a person can read. */
function describeDetail(detail: unknown): string {
  if (typeof detail === "string") return detail.trim().slice(0, 800);
  if (Array.isArray(detail)) {
    return detail
      .map((e) => {
        const m = e as { message?: unknown; path?: unknown };
        const message = typeof m?.message === "string" ? m.message : JSON.stringify(e);
        return `${message}${Array.isArray(m?.path) ? ` (at ${m.path.join(".")})` : ""}`;
      })
      .join("\n            ")
      .slice(0, 1500);
  }
  return JSON.stringify(detail).slice(0, 800);
}

async function main() {
  loadEnvLocal();

  const argv = process.argv.slice(2);
  const approve = argv.includes("--approve");
  const wanted = (argv.find((a) => a.startsWith("--workspace="))?.split("=")[1] ?? "").trim();

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
        `  host:  ${host || "(not set)"}`,
        `  token: ${token ? fingerprint(token) : "(not set)"}`,
      ].join("\n"),
    );
    process.exitCode = 1;
    return;
  }

  const db = await getDb();

  /*
   * Which graph, and whose import. A deployment has one workspace far more often than several, so
   * naming it is only required when the answer is ambiguous — and an import into the wrong tenant
   * is not something to let a default decide.
   */
  const workspaces = await db.select().from(s.workspaces);
  const workspace = wanted
    ? workspaces.find((w) => w.slug === wanted || w.id === wanted)
    : workspaces.length === 1
      ? workspaces[0]
      : undefined;
  if (!workspace) {
    console.error(
      wanted
        ? `No workspace called “${wanted}”. This database has: ${workspaces.map((w) => w.slug).join(", ") || "none"}.`
        : `This database has ${workspaces.length} workspaces — say which with --workspace=<slug>: ${workspaces.map((w) => w.slug).join(", ")}.`,
    );
    process.exitCode = 1;
    return;
  }

  /*
   * Somebody has to be answerable for four hundred objects appearing in the estate. The owner is
   * the honest attribution for an import run on the server: the history will say the import did
   * it, on their account, rather than attributing it to nobody.
   */
  const email = (process.env.NEXUS_OWNER_EMAIL ?? "").trim().toLowerCase();
  const owner = email
    ? await db.query.users.findFirst({ where: eq(s.users.email, email) })
    : (await db.select().from(s.users))[0];
  if (!owner) {
    console.error("No user to attribute the import to. Set NEXUS_OWNER_EMAIL to somebody in this workspace.");
    process.exitCode = 1;
    return;
  }

  console.log(`Reading ${host} with ${fingerprint(token)} → ${workspace.name} (${workspace.slug}), as ${owner.email}.\n`);

  const started = Date.now();
  let dump;
  try {
    dump = await fetchAll({ host, baseUrl, token });
  } catch (error) {
    if (error instanceof LeanIxError) {
      console.error(`LeanIX refused: ${error.message}${error.detail ? `\n  It said: ${describeDetail(error.detail)}` : ""}`);
    } else {
      console.error(
        `Could not reach ${host}: ${error instanceof Error ? error.message : "unknown error"}\n`
          + "  This runs where the database is, so it is that machine's network that has to reach LeanIX.",
      );
    }
    process.exitCode = 1;
    return;
  }
  if (!dump.factSheets.length) {
    console.error("That workspace answered, but with no fact sheets the token can see.");
    process.exitCode = 1;
    return;
  }
  console.log(`${dump.factSheets.length} fact sheets, ${dump.relations.length} relations  (${((Date.now() - started) / 1000).toFixed(1)}s)`);

  const staged = await stageBatch(db, {
    workspaceId: workspace.id,
    files: toBatchFiles(dump),
    origin: "EA repository",
    name: `LeanIX · ${dump.workspace}`,
    createdById: owner.id,
  });
  if ("error" in staged) {
    console.error(`Could not stage it: ${staged.error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Staged as ${staged.id} — /w/${workspace.slug}/import/${staged.id}`);

  if (!approve) {
    console.log("\nNothing written. Look through it on the import page, or re-run with --approve.");
    return;
  }

  const written = await applyBatch(db, staged.id, owner.id);
  if ("error" in written) {
    console.error(`Could not approve it: ${written.error}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `Written: ${written.created} created, ${written.updated} changed, ${written.connected} connected, `
      + `${written.nested} placed in the hierarchy.\nRoll it back on the batch page if it was wrong.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
