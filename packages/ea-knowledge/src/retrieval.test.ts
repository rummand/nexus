import { describe, expect, it } from "vitest";
import { Bm25Index, diversify } from "./bm25";
import { blocks, chunkDocument, citationLabel } from "./chunk";
import { markdownToText, normalise } from "./fetchers";
import { attributionLine, LICENSES } from "./licenses";
import { retrieve } from "./retrieve";
import { buildKnowledgeBase } from "./corpus";
import { SOURCES } from "./sources";
import { stem, tokenize } from "./tokenize";
import type { Chunk, Corpus, Document } from "./types";

const doc = (sourceId: string, title: string, text: string): Document => ({
  sourceId,
  title,
  url: `https://example.org/${sourceId}`,
  license: "CC-BY-SA-4.0",
  attribution: "Contributors",
  topics: ["test"],
  fetchedAt: "2026-09-06",
  hash: "abc",
  text,
});

const CAPABILITY = doc(
  "t:capability",
  "Business capability",
  `A business capability is what an organisation does, stated independently of who does it or how.

== Capability versus process ==
A capability is stable: an organisation still needs to bill customers whether it does so monthly by post or continuously by API. A process is the ordered way the capability is currently carried out, and changes far more often than the capability itself.

== Common mistakes ==
The most common error in a capability model is to name the department rather than the capability, which produces a picture of the organisation chart with different colours.

== See also ==
Nothing here should be indexed.`,
);

const PORTFOLIO = doc(
  "t:portfolio",
  "Application portfolio management",
  `Application portfolio management is the practice of holding an inventory of the applications an organisation runs and deciding, deliberately, which to invest in, keep, replace or retire.

== Rationalisation ==
Rationalisation compares applications supporting the same capability. Two systems doing the same work are only visible as duplication once both are mapped to that capability, which is why the capability model comes first.`,
);

const kb = buildKnowledgeBase({ builtAt: "2026-09-06", documents: [CAPABILITY, PORTFOLIO], sources: [] } as Corpus);

describe("tokenising", () => {
  it("stems plurals without mangling terms of art", () => {
    expect(stem("capabilities")).toBe("capability");
    expect(stem("processes")).toBe("process"); // and "process" is left alone, so the two agree
    expect(stem("business")).toBe("business");
    expect(stem("analysis")).toBe("analysis");
  });

  it("reads British and American spelling as the same word", () => {
    expect(stem("organisation")).toBe(stem("organization"));
    expect(stem("rationalise")).toBe(stem("rationalization"));
    expect(stem("modelling")).toBe(stem("modeling"));
    expect(stem("analyse")).toBe(stem("analyze"));
    // …without mangling words that merely end the same way
    expect(stem("promise")).toBe("promise");
    expect(stem("precise")).toBe("precise");
    expect(stem("size")).toBe("size");
  });

  it("drops noise but keeps architecture words that look like stopwords", () => {
    const terms = tokenize("the as-is and to-be state of the estate");
    expect(terms).toContain("estate");
    expect(terms).not.toContain("the");
  });
});

describe("chunking", () => {
  it("carries the heading path and drops navigation sections", () => {
    const chunks = chunkDocument(CAPABILITY);
    const sections = chunks.map((c) => c.section.join("/"));
    expect(sections).toContain("Capability versus process");
    expect(sections.join(" ")).not.toContain("See also");
    expect(chunks.every((c) => !c.text.includes("Nothing here should be indexed"))).toBe(true);
  });

  it("labels a passage the way a citation needs", () => {
    const chunk = chunkDocument(CAPABILITY).find((c) => c.section[0] === "Capability versus process")!;
    expect(citationLabel(chunk)).toBe("Business capability § Capability versus process");
  });

  it("never splits inside a paragraph", () => {
    const long = doc("t:long", "Long", Array.from({ length: 12 }, (_, i) => `Paragraph number ${i} with enough words in it to matter for the purposes of this test of the chunker.`).join("\n\n"));
    for (const chunk of chunkDocument(long)) {
      for (const para of chunk.text.split("\n\n")) expect(para.endsWith(".")).toBe(true);
    }
  });

  it("reads markdown headings as sections", () => {
    const md = markdownToText("# Config\n\nStore config in the environment.\n\n## Rationale\n\nSeparate config from code.");
    expect(blocks(md).map((b) => b.section.join("/"))).toEqual(["Config", "Config/Rationale"]);
  });
});

describe("retrieval", () => {
  it("finds the passage that answers the question, not just the article", () => {
    const answer = retrieve("capability versus process", { kb });
    expect(answer.hits[0]!.chunk.section[0]).toBe("Capability versus process");
  });

  it("returns citations, always", () => {
    const answer = retrieve("application rationalisation", { kb });
    expect(answer.hits.length).toBeGreaterThan(0);
    for (const hit of answer.hits) {
      expect(hit.chunk.url).toMatch(/^https:\/\//);
      expect(LICENSES[hit.chunk.license]).toBeTruthy();
    }
    expect(answer.citations[0]!.label).toBeTruthy();
  });

  it("says which words it has never seen rather than silently returning nothing", () => {
    const answer = retrieve("quantum flux capacitor", { kb });
    expect(answer.hits).toHaveLength(0);
    expect(answer.unknownTerms).toContain("capacitor");
  });

  it("does not let one document fill every slot", () => {
    const many: Chunk[] = Array.from({ length: 10 }, (_, i) => ({
      id: `x#${i}`, sourceId: i < 8 ? "a" : "b", title: "T", url: "https://e.org", license: "CC-BY-SA-4.0" as const, section: [], ordinal: i, text: "capability capability",
    }));
    const hits = many.map((chunk, i) => ({ chunk, score: 10 - i, matched: ["capability"] }));
    expect(diversify(hits, 4, 2).filter((h) => h.chunk.sourceId === "a")).toHaveLength(2);
  });

  it("prefers a phrase over the same words scattered", () => {
    const index = new Bm25Index([
      { id: "1", sourceId: "s", title: "A", url: "https://e.org", license: "CC-BY-SA-4.0", section: [], ordinal: 0, text: "The master data management discipline gives one identity to a thing." },
      { id: "2", sourceId: "s", title: "B", url: "https://e.org", license: "CC-BY-SA-4.0", section: [], ordinal: 1, text: "A master craftsman manages data about management of the estate." },
    ]);
    expect(index.search("master data management")[0]!.chunk.id).toBe("1");
  });

  it("distinguishes an empty corpus from a query that matched nothing", () => {
    const none = buildKnowledgeBase({ builtAt: "", documents: [], sources: [] } as Corpus);
    expect(retrieve("anything", { kb: none }).empty).toBe(true);
    expect(retrieve("quantum flux", { kb }).empty).toBe(false);
  });
});

describe("licensing", () => {
  it("only registers sources under a licence that permits redistribution", () => {
    for (const source of SOURCES) expect(LICENSES[source.license], `${source.id} has an unknown licence`).toBeTruthy();
  });

  it("gives every registered source a reason to be in the corpus", () => {
    for (const source of SOURCES) {
      expect(source.why.length, `${source.id} has no stated reason`).toBeGreaterThan(20);
      expect(source.topics.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate source ids", () => {
    const ids = SOURCES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("credits share-alike sources by author and link", () => {
    const line = attributionLine("Business capability", "Wikipedia contributors", "https://en.wikipedia.org/wiki/X", "CC-BY-SA-4.0");
    expect(line).toContain("Wikipedia contributors");
    expect(line).toContain("ShareAlike");
  });
});

describe("normalising", () => {
  it("makes whitespace stable so a re-ingest diff means something", () => {
    expect(normalise("a\r\n\n\n\nb  \nc")).toBe("a\n\nb\nc");
  });
});
