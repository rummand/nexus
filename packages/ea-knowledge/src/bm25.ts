/**
 * BM25 over the corpus.
 *
 * BM25 rather than embeddings, because the module has to work with no model API key at all: a
 * knowledge base that silently returns nothing when the key is missing is not a knowledge base.
 * It is also explainable — every hit can say which of your words matched — which matters here,
 * since the whole point of the citation is that a human can check it.
 */

import { tokenize } from "./tokenize";
import type { Chunk, Hit } from "./types";

const K1 = 1.4;
const B = 0.72;
/** A chunk whose heading path matches the query is usually the right one; a small nudge, not a rule. */
const SECTION_BOOST = 1.25;
/** A chunk containing the query as a phrase is almost always better than one with the words apart. */
const PHRASE_BOOST = 1.6;
/** Title matches: "TOGAF" should find the TOGAF article before an aside in another one. */
const TITLE_BOOST = 1.35;
/**
 * How hard to favour a passage that matches *more of the question*.
 *
 * Without this, "capability versus process" is won by whichever long passage says "capability"
 * most often — and a section heading full of the word makes that worse. Coverage says: a passage
 * that answers both halves of the question beats one that answers half of it loudly.
 */
const COVERAGE_POWER = 1.5;
/**
 * The opening passage of an article is its definition.
 *
 * Reference writing puts the answer to "what is this" first, so when somebody asks what a thing
 * is, the lead is usually the passage they wanted and a subsection three screens down is not.
 */
const LEAD_BOOST = 1.3;

interface Posting {
  /** index into `chunks` */
  doc: number;
  tf: number;
}

export class Bm25Index {
  private readonly postings = new Map<string, Posting[]>();
  private readonly lengths: number[] = [];
  private readonly haystack: string[] = [];
  private readonly titleTerms: Set<string>[] = [];
  private readonly sectionTerms: Set<string>[] = [];
  private avgLength = 0;

  constructor(readonly chunks: Chunk[]) {
    for (const chunk of chunks) {
      const terms = tokenize(chunk.text);
      const counts = new Map<string, number>();
      for (const t of terms) counts.set(t, (counts.get(t) ?? 0) + 1);
      const doc = this.lengths.length;
      for (const [term, tf] of counts) {
        let list = this.postings.get(term);
        if (!list) this.postings.set(term, (list = []));
        list.push({ doc, tf });
      }
      this.lengths.push(terms.length || 1);
      this.haystack.push(chunk.text.toLowerCase());
      this.titleTerms.push(new Set(tokenize(chunk.title)));
      this.sectionTerms.push(new Set(tokenize(chunk.section.join(" "))));
    }
    this.avgLength = this.lengths.reduce((a, b) => a + b, 0) / Math.max(1, this.lengths.length);
  }

  get size(): number {
    return this.chunks.length;
  }

  /** Terms the index has never seen — useful for telling a user why they got nothing. */
  unknownTerms(query: string): string[] {
    return [...new Set(tokenize(query))].filter((t) => !this.postings.has(t));
  }

  search(query: string, limit = 8): Hit[] {
    const terms = [...new Set(tokenize(query))];
    if (!terms.length) return [];
    const phrase = query.trim().toLowerCase();
    const N = this.chunks.length;
    const scores = new Map<number, number>();
    const matched = new Map<number, Set<string>>();

    for (const term of terms) {
      const list = this.postings.get(term);
      if (!list) continue;
      // The +0.5/+0.5 form keeps the idf of a term in most documents small but never negative,
      // which a plain log(N/df) does not: "architecture" is in nearly every chunk here.
      const idf = Math.log(1 + (N - list.length + 0.5) / (list.length + 0.5));
      for (const { doc, tf } of list) {
        const norm = 1 - B + (B * this.lengths[doc]!) / this.avgLength;
        let add = idf * ((tf * (K1 + 1)) / (tf + K1 * norm));
        if (this.titleTerms[doc]!.has(term)) add *= TITLE_BOOST;
        if (this.sectionTerms[doc]!.has(term)) add *= SECTION_BOOST;
        scores.set(doc, (scores.get(doc) ?? 0) + add);
        let seen = matched.get(doc);
        if (!seen) matched.set(doc, (seen = new Set()));
        seen.add(term);
      }
    }

    // Reward breadth of match before anything else: score × (terms matched / terms asked)^p.
    const asked = terms.filter((t) => this.postings.has(t)).length || 1;
    for (const [doc, score] of scores) {
      const coverage = (matched.get(doc)?.size ?? 0) / asked;
      scores.set(doc, score * Math.pow(coverage, COVERAGE_POWER));
    }

    for (const [doc, score] of scores) {
      if (this.chunks[doc]!.ordinal === 0) scores.set(doc, score * LEAD_BOOST);
    }

    if (phrase.length > 6) {
      for (const [doc, score] of scores) {
        if (this.haystack[doc]!.includes(phrase)) scores.set(doc, score * PHRASE_BOOST);
      }
    }

    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([doc, score]) => ({ chunk: this.chunks[doc]!, score, matched: [...(matched.get(doc) ?? [])] }));
  }
}

/**
 * At most `perSource` hits from any one document.
 *
 * Without this, a long article on exactly the query subject fills every slot and the answer has
 * one source — which reads as authority and is actually a single point of failure.
 */
export function diversify(hits: Hit[], limit: number, perSource = 2): Hit[] {
  const taken = new Map<string, number>();
  const out: Hit[] = [];
  for (const hit of hits) {
    const n = taken.get(hit.chunk.sourceId) ?? 0;
    if (n >= perSource) continue;
    taken.set(hit.chunk.sourceId, n + 1);
    out.push(hit);
    if (out.length >= limit) break;
  }
  return out;
}
