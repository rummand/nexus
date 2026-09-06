/**
 * Building the corpus.
 *
 * The output is two files, both committed: `corpus/documents.jsonl` (one document per line) and
 * `corpus/manifest.json` (what was fetched, when, under which licence, and what failed). Shipping
 * the text rather than a built index means the module works with no network and no build step,
 * and that a human can read exactly what the agents are being grounded in — which is the whole
 * argument for a curated corpus over a crawl.
 *
 * The run is resumable and incremental: a source whose text has not changed keeps its existing
 * entry and its fetch date, so a re-ingest produces a small diff instead of rewriting everything.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { readSource } from "./fetchers";
import { LICENSES } from "./licenses";
import { SOURCES } from "./sources";
import type { Document, Source } from "./types";

export interface IngestReport {
  fetched: string[];
  unchanged: string[];
  failed: Array<{ id: string; error: string }>;
  skipped: Array<{ id: string; reason: string }>;
  documents: number;
  characters: number;
}

export interface Manifest {
  builtAt: string;
  documents: number;
  characters: number;
  sources: Array<{
    id: string;
    title: string;
    url: string;
    license: string;
    licenseName: string;
    attribution: string;
    topics: string[];
    why: string;
    fetchedAt: string;
    characters: number;
    hash: string;
  }>;
  unreachable: Array<{ id: string; title: string; error: string }>;
}

export function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

export function corpusDir(root = process.cwd()): string {
  return path.resolve(root, "corpus");
}

export function readDocuments(dir: string): Document[] {
  const file = path.join(dir, "documents.jsonl");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Document);
}

function writeDocuments(dir: string, docs: Document[]) {
  mkdirSync(dir, { recursive: true });
  // Sorted by id so the committed file has a stable order and a readable diff.
  const sorted = [...docs].sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  writeFileSync(path.join(dir, "documents.jsonl"), `${sorted.map((d) => JSON.stringify(d)).join("\n")}\n`);
}

/**
 * Fetch every source that is allowed and out of date, and write the corpus.
 *
 * `only` narrows the run to matching ids or titles, which is how a single article is refreshed
 * without hammering the API for the other hundred.
 */
export async function ingest(options: {
  dir?: string;
  only?: string;
  delayMs?: number;
  log?: (line: string) => void;
  sources?: Source[];
} = {}): Promise<IngestReport> {
  const dir = options.dir ?? corpusDir();
  const log = options.log ?? (() => {});
  const all = options.sources ?? SOURCES;
  const wanted = options.only
    ? all.filter((s) => s.id.toLowerCase().includes(options.only!.toLowerCase()) || s.title.toLowerCase().includes(options.only!.toLowerCase()))
    : all;

  const existing = new Map(readDocuments(dir).map((d) => [d.sourceId, d]));
  const report: IngestReport = { fetched: [], unchanged: [], failed: [], skipped: [], documents: 0, characters: 0 };
  const unreachable: Manifest["unreachable"] = [];

  let n = 0;
  for (const source of wanted) {
    n++;
    if (!LICENSES[source.license]) {
      // The registry is the gate, but a typo should not smuggle something in.
      report.skipped.push({ id: source.id, reason: `licence ${source.license} is not on the redistributable list` });
      continue;
    }
    log(`[${n}/${wanted.length}] ${source.title}`);
    try {
      const text = await readSource(source, { delayMs: options.delayMs ?? 1200, log });
      const hash = hashText(text);
      const prior = existing.get(source.id);
      if (prior && prior.hash === hash) {
        report.unchanged.push(source.id);
        // Keep the original fetch date: nothing changed, so claiming a fresh one would be a lie.
        existing.set(source.id, { ...prior, title: source.title, url: source.url, topics: source.topics });
        continue;
      }
      existing.set(source.id, {
        sourceId: source.id,
        title: source.title,
        url: source.url,
        license: source.license,
        attribution: source.attribution,
        topics: source.topics,
        fetchedAt: new Date().toISOString().slice(0, 10),
        hash,
        text,
      });
      report.fetched.push(source.id);
      log(`  ✓ ${text.length.toLocaleString()} characters`);
      // Flush after every fetch. A polite run over a hundred sources takes an hour against a
      // rate-limited API, and losing all of it to a crash at source ninety is not acceptable —
      // the run is resumable precisely because the file on disk is always current.
      writeDocuments(dir, [...existing.values()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      report.failed.push({ id: source.id, error: message });
      unreachable.push({ id: source.id, title: source.title, error: message });
      log(`  ✗ ${message}`);
    }
  }

  const docs = [...existing.values()];
  writeDocuments(dir, docs);

  const byId = new Map(all.map((s) => [s.id, s]));
  const manifest: Manifest = {
    builtAt: new Date().toISOString().slice(0, 10),
    documents: docs.length,
    characters: docs.reduce((n2, d) => n2 + d.text.length, 0),
    sources: docs
      .map((d) => {
        const s = byId.get(d.sourceId);
        return {
          id: d.sourceId,
          title: d.title,
          url: d.url,
          license: d.license,
          licenseName: LICENSES[d.license]?.name ?? d.license,
          attribution: d.attribution,
          topics: d.topics,
          why: s?.why ?? "",
          fetchedAt: d.fetchedAt,
          characters: d.text.length,
          hash: d.hash,
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id)),
    // Only the failures from this run; a source fixed later simply stops appearing.
    unreachable: unreachable.sort((a, b) => a.id.localeCompare(b.id)),
  };
  writeFileSync(path.join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  report.documents = docs.length;
  report.characters = manifest.characters;
  return report;
}
