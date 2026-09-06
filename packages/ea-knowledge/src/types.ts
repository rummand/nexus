/**
 * The shapes the knowledge base is made of.
 *
 * Everything here is plain data with no dependency on Nexus: the module is meant to be usable on
 * its own (a CLI, another app, a different agent), and the web app is only one of its callers.
 */

/**
 * A licence we are willing to redistribute under.
 *
 * This is not decoration. The corpus is committed to the repository and shipped in a product, so
 * a source whose licence does not permit that cannot be ingested — no matter how good it is. The
 * registry records the licence per source and the ingester refuses anything not on this list.
 */
export type LicenseId =
  | "CC-BY-SA-4.0"
  | "CC-BY-SA-3.0"
  | "CC-BY-4.0"
  | "CC0-1.0"
  | "public-domain-usgov"
  | "GFDL-1.3-or-later"
  | "MIT";

export interface License {
  id: LicenseId;
  name: string;
  url: string;
  /** True when the licence obliges derivative collections to carry the same terms. */
  shareAlike: boolean;
  /** What we must show next to any passage from a source under this licence. */
  attribution: "author-and-link" | "link";
}

/** How a source is fetched. Each kind has a reader in `fetchers.ts`. */
export type SourceKind = "mediawiki" | "text";

/** One thing we ingest: an article, a chapter, a specification. */
export interface Source {
  /** Stable id, used in citations. Never renumber these — lessons cite them. */
  id: string;
  title: string;
  kind: SourceKind;
  /** Where a human can read it. */
  url: string;
  /** Where the machine reads it (API endpoint, raw text). Same as `url` for plain text. */
  fetchUrl: string;
  license: LicenseId;
  /** Who to credit. For Wikipedia: the article's contributors. */
  attribution: string;
  /** What this source is good for — shown in the UI, and used to explain a citation. */
  topics: string[];
  /** A one-line reason this is in the corpus at all. */
  why: string;
}

/** A fetched source, normalised to plain text. */
export interface Document {
  sourceId: string;
  title: string;
  url: string;
  license: LicenseId;
  attribution: string;
  topics: string[];
  /** ISO date the text was fetched. */
  fetchedAt: string;
  /** SHA-256 of `text`, so a re-ingest can say what actually changed. */
  hash: string;
  text: string;
}

/** A retrievable passage: a few paragraphs of one document, with its place in it. */
export interface Chunk {
  id: string;
  sourceId: string;
  title: string;
  url: string;
  license: LicenseId;
  /** Heading path within the document, e.g. ["Architecture Development Method", "Phases"]. */
  section: string[];
  /** Position of this chunk in its document, for ordering and "read on". */
  ordinal: number;
  text: string;
}

/** A retrieval hit. */
export interface Hit {
  chunk: Chunk;
  score: number;
  /** The query terms that actually matched, for showing why this was returned. */
  matched: string[];
}

/**
 * A practice statement the agents are grounded in.
 *
 * Raw encyclopedia text in a prompt does very little. What changes an agent's behaviour is a short
 * rule it can apply — "a capability is what the organisation does, not the team that does it".
 * Each lesson must quote a passage that is actually in the corpus: `lessons.test.ts` fails
 * otherwise, which is what stops this file drifting into folklore.
 */
export interface Lesson {
  id: string;
  /** The rule, in one sentence, addressed to whoever is modelling. */
  statement: string;
  /** Longer form: what it means in practice, and what goes wrong without it. */
  detail: string;
  /** Which agents should be grounded in this. */
  applies: LessonScope[];
  /** Free-text tags used to retrieve lessons for a task. */
  tags: string[];
  citation: {
    sourceId: string;
    /** Verbatim from the source text. Checked by a test. */
    quote: string;
  };
}

/** Where a lesson is injected. */
export type LessonScope = "compose" | "intake" | "modelling" | "health" | "metamodel";

/** The corpus as it is shipped: documents plus what was known about each source. */
export interface Corpus {
  builtAt: string;
  documents: Document[];
  sources: Source[];
}
