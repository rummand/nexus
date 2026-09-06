import { describe, expect, it } from "vitest";
import { loadCorpus } from "./corpus";
import { allLessons, groundingFor, rankLessons } from "./lessons";
import type { Document } from "./types";

/**
 * The test that keeps the doctrine honest.
 *
 * `lesson-data.ts` is the only place in this repository where a person writes down what is true
 * about enterprise architecture. That is exactly the kind of file that fills up with plausible
 * folklore, so every rule in it has to quote a passage that is really in the corpus, verbatim —
 * and this fails if it does not. It is the same discipline intake applies to a model's claims
 * about a transcript, turned on ourselves.
 */

const corpus = loadCorpus();
const docs = new Map(corpus.documents.map((d: Document) => [d.sourceId, d]));
const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

describe("doctrine", () => {
  it("has a corpus to check against", () => {
    // Not a tautology: without this the checks below would pass vacuously on a machine that has
    // never run the ingest, which is precisely when a bad quote would slip through.
    expect(corpus.documents.length, "no corpus on disk — run `pnpm --filter @nexus/ea-knowledge ingest`").toBeGreaterThan(0);
  });

  it("quotes a source that is actually in the corpus", () => {
    for (const lesson of allLessons()) {
      expect(docs.has(lesson.citation.sourceId), `${lesson.id} cites ${lesson.citation.sourceId}, which is not in the corpus`).toBe(true);
    }
  });

  it("quotes it verbatim", () => {
    for (const lesson of allLessons()) {
      const doc = docs.get(lesson.citation.sourceId);
      if (!doc) continue;
      expect(
        norm(doc.text).includes(norm(lesson.citation.quote)),
        `${lesson.id}: the quote is not in ${lesson.citation.sourceId}\n  “${lesson.citation.quote}”`,
      ).toBe(true);
    }
  });

  it("says something an agent can act on", () => {
    for (const lesson of allLessons()) {
      expect(lesson.statement.length, `${lesson.id} states nothing`).toBeGreaterThan(25);
      expect(lesson.detail.length, `${lesson.id} explains nothing`).toBeGreaterThan(60);
      expect(lesson.applies.length, `${lesson.id} applies to no agent`).toBeGreaterThan(0);
      expect(lesson.citation.quote.length, `${lesson.id} quotes too little to check`).toBeGreaterThan(40);
    }
  });

  it("has unique ids", () => {
    const ids = allLessons().map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("grounds every agent that asks for grounding", () => {
    for (const scope of ["compose", "intake", "modelling", "metamodel", "health"] as const) {
      expect(rankLessons(scope, "", 4).length, `nothing to teach ${scope}`).toBeGreaterThan(0);
    }
  });

  it("ranks the relevant lesson first for a task that mentions it", () => {
    const [top] = rankLessons("compose", "group the applications by business capability", 1);
    expect(top?.tags.some((t) => ["capability", "application", "grouping"].includes(t))).toBe(true);
  });

  it("builds a grounding block that carries its citations", () => {
    const block = groundingFor("compose", "group applications by capability", 2);
    expect(block).toContain("Source:");
    expect(block.split("\n\n").length).toBeGreaterThan(1);
  });

  it("tags every health lesson with the measure it speaks to", () => {
    const measures = new Set(["provenance", "duplicates", "untyped", "orphans", "ownership", "lifecycle"]);
    for (const lesson of allLessons()) {
      if (!lesson.applies.includes("health")) continue;
      expect(
        lesson.tags.some((t) => measures.has(t)),
        `${lesson.id} applies to health but names no measure`,
      ).toBe(true);
    }
  });
});
