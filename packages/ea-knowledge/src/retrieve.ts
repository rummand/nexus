/**
 * Retrieval: the question in, cited passages out.
 *
 * The contract this module keeps is that **every returned passage is quotable and attributable**.
 * A retrieval layer that hands an agent unattributed text is how a model ends up asserting
 * something the corpus never said, and nobody can tell which. So a hit always carries the source,
 * the section it came from, the licence and the link.
 */

import { citationLabel } from "./chunk";
import { diversify } from "./bm25";
import { attributionLine } from "./licenses";
import type { Hit } from "./types";
import { knowledgeBase, type KnowledgeBase } from "./corpus";

export interface RetrieveOptions {
  limit?: number;
  /** At most this many passages from any one document. */
  perSource?: number;
  /** Restrict to sources whose topics include one of these. */
  topics?: string[];
  kb?: KnowledgeBase;
}

export interface Citation {
  sourceId: string;
  label: string;
  url: string;
  license: string;
  attribution: string;
}

export interface Answer {
  query: string;
  hits: Hit[];
  citations: Citation[];
  /** Words in the query that appear nowhere in the corpus — the usual reason for a thin answer. */
  unknownTerms: string[];
  /** True when there is no corpus at all, as opposed to no match. The difference matters. */
  empty: boolean;
}

export function retrieve(query: string, options: RetrieveOptions = {}): Answer {
  const kb = options.kb ?? knowledgeBase();
  const limit = options.limit ?? 6;
  if (kb.empty) return { query, hits: [], citations: [], unknownTerms: [], empty: true };

  // Over-fetch, then thin by source: the top ten hits are often ten passages of one article.
  let hits = kb.index.search(query, Math.max(limit * 5, 30));
  if (options.topics?.length) {
    const wanted = new Set(options.topics.map((t) => t.toLowerCase()));
    const byId = new Map(kb.corpus.documents.map((d) => [d.sourceId, d]));
    hits = hits.filter((h) => byId.get(h.chunk.sourceId)?.topics.some((t) => wanted.has(t.toLowerCase())));
  }
  const chosen = diversify(hits, limit, options.perSource ?? 2);

  const byId = new Map(kb.corpus.documents.map((d) => [d.sourceId, d]));
  const citations: Citation[] = [];
  const seen = new Set<string>();
  for (const hit of chosen) {
    if (seen.has(hit.chunk.sourceId)) continue;
    seen.add(hit.chunk.sourceId);
    const doc = byId.get(hit.chunk.sourceId);
    citations.push({
      sourceId: hit.chunk.sourceId,
      label: hit.chunk.title,
      url: hit.chunk.url,
      license: hit.chunk.license,
      attribution: doc?.attribution ?? "",
    });
  }

  return {
    query,
    hits: chosen,
    citations,
    unknownTerms: kb.index.unknownTerms(query),
    empty: false,
  };
}

/** One passage, formatted for a prompt or a terminal: label, text, attribution. */
export function formatHit(hit: Hit, attribution: string): string {
  return [
    `— ${citationLabel(hit.chunk)}`,
    hit.chunk.text,
    `  (${attributionLine(hit.chunk.title, attribution, hit.chunk.url, hit.chunk.license)})`,
  ].join("\n");
}

/**
 * The block handed to a model as grounding.
 *
 * Passages are numbered so the model can cite them back as [1], [2] — which is the only way to
 * check afterwards whether what it said is in the corpus or in its weights.
 */
export function groundingBlock(answer: Answer, attributions: Map<string, string> = new Map()): string {
  if (!answer.hits.length) return "";
  const lines = answer.hits.map((hit, i) => {
    const label = citationLabel(hit.chunk);
    const attribution = attributions.get(hit.chunk.sourceId) ?? "";
    return `[${i + 1}] ${label}\n${hit.chunk.text}\n(${attributionLine(hit.chunk.title, attribution, hit.chunk.url, hit.chunk.license)})`;
  });
  return lines.join("\n\n");
}
