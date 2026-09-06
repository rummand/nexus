/**
 * Loading the shipped corpus.
 *
 * The corpus is plain files in this package, not a database and not a build artefact, so loading
 * it is reading two files. The index is built once per process and cached on `globalThis` — a few
 * hundred milliseconds over a few thousand passages, paid on the first question and never again.
 *
 * Resolution order for the directory is deliberately dumb: an explicit environment variable, then
 * the places the package can be run from (its own root, the repo root, `apps/web`). Anything
 * cleverer breaks under a bundler, which rewrites `import.meta.url` out from under you.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Bm25Index } from "./bm25";
import { chunkDocument } from "./chunk";
import { SOURCES } from "./sources";
import type { Chunk, Corpus, Document } from "./types";
import type { Manifest } from "./ingest";

const CANDIDATES = [
  "corpus",
  "packages/ea-knowledge/corpus",
  "../../packages/ea-knowledge/corpus",
  "../packages/ea-knowledge/corpus",
];

export function resolveCorpusDir(): string | null {
  const fromEnv = process.env.EA_CORPUS_DIR;
  if (fromEnv && existsSync(path.join(fromEnv, "documents.jsonl"))) return fromEnv;
  for (const candidate of CANDIDATES) {
    const dir = path.resolve(process.cwd(), candidate);
    if (existsSync(path.join(dir, "documents.jsonl"))) return dir;
  }
  return null;
}

export function loadDocuments(dir = resolveCorpusDir()): Document[] {
  if (!dir) return [];
  const file = path.join(dir, "documents.jsonl");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Document);
}

export function loadManifest(dir = resolveCorpusDir()): Manifest | null {
  if (!dir) return null;
  const file = path.join(dir, "manifest.json");
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as Manifest;
}

export function loadCorpus(dir = resolveCorpusDir()): Corpus {
  return { builtAt: loadManifest(dir)?.builtAt ?? "", documents: loadDocuments(dir), sources: SOURCES };
}

export interface KnowledgeBase {
  corpus: Corpus;
  chunks: Chunk[];
  index: Bm25Index;
  /** True when there is no corpus on disk — the caller should say so rather than pretend. */
  empty: boolean;
}

export function buildKnowledgeBase(corpus: Corpus): KnowledgeBase {
  const chunks = corpus.documents.flatMap((doc) => chunkDocument(doc));
  return { corpus, chunks, index: new Bm25Index(chunks), empty: chunks.length === 0 };
}

const globalForKb = globalThis as unknown as { __eaKnowledgeBase?: KnowledgeBase };

/** The shipped knowledge base, built once per process. */
export function knowledgeBase(): KnowledgeBase {
  if (!globalForKb.__eaKnowledgeBase) globalForKb.__eaKnowledgeBase = buildKnowledgeBase(loadCorpus());
  return globalForKb.__eaKnowledgeBase;
}
