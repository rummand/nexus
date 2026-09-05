import type { Candidate, CandidateRelation, Confidence, Mention, Passage, Viewpoint, ViewpointType } from "./types";

/**
 * Reading meaning out of passages.
 *
 * Deterministic and explainable on purpose. docs/BRIEF.md §2.2 puts an LLM here eventually, but
 * the interesting half of the design is not the classifier — it is that everything extracted
 * carries the quote that produced it, so a human can accept, correct or reject with the evidence
 * in front of them. A model swaps in behind the same shapes; the review workflow does not change.
 *
 * Three ways a candidate is recognised, in falling confidence:
 *
 *   known    — the name is already an entity in this workspace. The meeting is talking about
 *              something the graph knows, which is the most valuable link there is.
 *   typed    — a phrase names its own type ("the Maximo application", "billing capability").
 *   emergent — a proper noun nobody has ever declared, said more than once. This is the
 *              meta-model growing from what people actually say.
 */

export interface Vocabulary {
  /** Entities already in the graph, so a mention links instead of duplicating. */
  entities: Array<{ id: string; name: string; kind: string }>;
  /** Kind names the workspace already uses, declared or observed. */
  kinds: string[];
  /** Relation kinds the workspace already uses; a match reuses the existing wording. */
  relationKinds: string[];
}

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
const keyOf = (kind: string, name: string) => `${norm(kind)}|${norm(name)}`;

/** Words that follow a name and say what it is. Extended by the workspace's own kinds. */
const KIND_WORDS: Array<[RegExp, string]> = [
  [/applications?/, "Application"],
  [/systems?/, "System"],
  [/platforms?/, "Platform"],
  [/services?/, "Service"],
  [/databases?/, "Database"],
  [/capabilit(?:y|ies)/, "Business Capability"],
  [/processes|process/, "Process"],
  [/integrations?/, "Integration"],
  [/interfaces?/, "Interface"],
  [/portals?/, "Portal"],
  [/teams?/, "Team"],
  [/vendors?|suppliers?/, "Vendor"],
  [/projects?|programmes?|programs?/, "Project"],
  [/initiatives?/, "Initiative"],
  [/components?/, "IT Component"],
  [/data\s+objects?/, "Data Object"],
];

const RELATION_PATTERNS: Array<[RegExp, string]> = [
  [/\bdepends?\s+(?:up)?on\b|\bis\s+dependent\s+on\b/i, "depends on"],
  [/\bintegrat(?:es|ed|ing)\s+with\b/i, "integrates with"],
  [/\b(?:will\s+)?replac(?:es?|ed|ing)\b|\bsupersedes?\b/i, "replaces"],
  [/\bsends?\s+data\s+to\b|\bpushes?\s+(?:data\s+)?to\b|\bfeeds?\b/i, "sends data to"],
  [/\bconsumes?\b|\breads?\s+from\b|\bpulls?\s+from\b/i, "consumes"],
  [/\bis\s+part\s+of\b|\bbelongs?\s+to\b/i, "part of"],
  [/\bsupports?\b|\benables?\b/i, "supports"],
  [/\bruns?\s+on\b|\bhosted\s+(?:on|in)\b/i, "runs on"],
  [/\bconnect(?:s|ed|ing)?\s+to\b/i, "connects to"],
  [/\bowns?\b|\bis\s+the\s+owner\s+of\b/i, "owns"],
  [/\bcalls?\b|\binvokes?\b/i, "calls"],
  [/\buses?\b|\busing\b/i, "uses"],
];

/**
 * Subjects, as opposed to things.
 *
 * A meeting is rarely only about the systems it names — it is about the target architecture, the
 * application portfolio, data governance. Those are what make one meeting relevant to another
 * six months later, so they are recognised as their own kind and the source is joined to them
 * with "about" rather than "mentions".
 */
const TOPIC_PATTERNS: RegExp[] = [
  /\b(?:target|current|future|reference|solution|enterprise|integration|data|security|information|business|application)\s+architecture\b/giu,
  /\b(?:application|project|product|technology|service|investment)\s+portfolio\b/giu,
  /\b(?:data|information|it|security|architecture|model)\s+governance\b/giu,
  /\bmaster\s+data(?:\s+management)?\b|\bdata\s+(?:quality|lineage|privacy|mesh|platform|migration)\b/giu,
  /\b(?:technical\s+debt|business\s+continuity|disaster\s+recovery|cloud\s+migration|capability\s+map|operating\s+model|change\s+management|life\s?cycle\s+management|vendor\s+lock-?in|licence\s+model|licensing|compliance|gdpr|nis2|cyber\s?security|information\s+security|sustainability|interoperability)\b/giu,
  /\b([\p{L}]{3,})\s+(?:roadmap|strategy|standard|principle|guideline)s?\b/giu,
];

/** Cues that mark a sentence as worth keeping, most specific first. */
const VIEWPOINT_CUES: Array<[RegExp, ViewpointType, Confidence]> = [
  [/\b(?:we|they)\s+(?:have\s+)?(?:decided|agreed|concluded)\b|\bthe\s+decision\s+is\b|\bwe(?:'ll| will)\s+go\s+with\b|\bdecision:/i, "decision", "high"],
  [/\b(?:risk|blocker|concern|worried|out\s+of\s+support|end\s+of\s+life|technical\s+debt)\b|\bthe\s+problem\s+is\b/i, "risk", "high"],
  [/\baction:|\baction\s+point\b|\b(?:I|we|you)(?:'ll|\s+will)\s+(?:take|pick|follow|send|set|book|write|check|prepare|update|map|draft)\b|\btakes?\s+that\s+away\b/i, "action", "high"],
  [/\bopen\s+question\b|\bwe\s+don't\s+know\b|\bunclear\b/i, "question", "medium"],
  [/\bwe\s+(?:need|must|should|have)\s+to\b|\brequirement\b|\bmust\s+have\b|\bwe\s+need\b/i, "need", "medium"],
];

const COMMON = new Set([
  "i", "we", "you", "he", "she", "they", "it", "the", "a", "an", "and", "but", "or", "so", "if",
  "then", "that", "this", "these", "those", "there", "here", "what", "when", "where", "who",
  "why", "how", "yes", "no", "ok", "okay", "right", "well", "just", "let", "let's", "sure",
  "thanks", "thank", "hi", "hello", "good", "morning", "afternoon", "monday", "tuesday",
  "wednesday", "thursday", "friday", "saturday", "sunday", "january", "february", "march",
  "april", "may", "june", "july", "august", "september", "october", "november", "december",
  "next", "last", "first", "second", "third", "one", "two", "three", "now", "today", "tomorrow",
  "yesterday", "our", "their", "my", "your", "his", "her", "its", "not", "do", "does", "did",
  "can", "could", "would", "should", "will", "shall", "must", "have", "has", "had", "be", "is",
  "are", "was", "were", "been", "get", "got", "go", "going", "want", "need", "think", "know",
  "see", "look", "make", "take", "come", "say", "said", "all", "some", "any", "every", "both",
  "because", "before", "after", "about", "with", "without", "from", "into", "over", "under",
  // adjectives that turn "the X capability" into a phrase rather than a name
  "same", "new", "old", "current", "existing", "main", "other", "entire", "whole", "only",
  "real", "best", "worst", "big", "small", "little", "own", "such", "very", "much", "many",
]);

/** A quote short enough to read in a review list, cut on a word boundary. */
function quote(text: string, limit = 220): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= limit) return t;
  return t.slice(0, t.lastIndexOf(" ", limit) > 0 ? t.lastIndexOf(" ", limit) : limit) + "…";
}

const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);

/** Case-insensitive whole-phrase search; returns every start offset. */
function occurrences(haystack: string, needle: string): number[] {
  if (needle.length < 2) return [];
  const out: number[] = [];
  const re = new RegExp(`(?<![\\p{L}\\d])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\d])`, "giu");
  for (let m = re.exec(haystack); m; m = re.exec(haystack)) out.push(m.index);
  return out;
}

export function extractCandidates(passages: Passage[], vocab: Vocabulary): Candidate[] {
  const byKey = new Map<string, Candidate>();
  const add = (c: Omit<Candidate, "mentions">, mention: Mention) => {
    const existing = byKey.get(c.key);
    if (existing) {
      if (!existing.mentions.some((m) => m.passageId === mention.passageId)) existing.mentions.push(mention);
      return;
    }
    byKey.set(c.key, { ...c, mentions: [mention] });
  };

  // Speakers are people, and people belong in the graph: an action needs an owner.
  for (const p of passages) {
    if (!p.speaker) continue;
    add({
      key: keyOf("Person", p.speaker),
      kind: "Person",
      name: p.speaker,
      description: "",
      attributes: {},
      confidence: "high",
      reason: "spoke in this source",
    }, { passageId: p.id, speaker: p.speaker, quote: quote(p.text) });
  }

  const kindWords: Array<[RegExp, string]> = [
    ...vocab.kinds.filter(Boolean).map((k): [RegExp, string] => [new RegExp(`${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?`, "i"), k]),
    ...KIND_WORDS,
  ];

  for (const p of passages) {
    const mention = (q: string): Mention => ({ passageId: p.id, speaker: p.speaker, quote: q });

    // 1. known — an entity the graph already holds
    for (const e of vocab.entities) {
      // A whole sentence stored as a name (a decision, a risk) is a record, not a thing to find.
      if (e.name.trim().length < 3 || e.name.length > 60) continue;
      const hits = occurrences(p.text, e.name.trim());
      if (hits.length === 0) continue;
      add({
        key: keyOf(e.kind, e.name),
        kind: e.kind,
        name: e.name,
        description: "",
        attributes: {},
        confidence: "high",
        reason: "already in the graph",
        existingEntityId: e.id,
      }, mention(quote(sentenceAround(p.text, hits[0]!))));
    }

    // 2. typed — "the Maximo application", "billing capability"
    for (const [word, kind] of kindWords) {
      const re = new RegExp(`\\b((?:[\\p{Lu}][\\p{L}\\d.&/-]*)(?:\\s+[\\p{Lu}][\\p{L}\\d.&/-]*){0,3})\\s+${word.source}\\b`, "gu");
      for (let m = re.exec(p.text); m; m = re.exec(p.text)) {
        const name = withoutDeterminer(m[1]!);
        if (!name || COMMON.has(norm(name)) || name.length < 2) continue;
        add({
          key: keyOf(kind, name),
          kind,
          name,
          description: "",
          attributes: {},
          confidence: "medium",
          reason: `called a ${kind.toLowerCase()} in the source`,
        }, mention(quote(sentenceAround(p.text, m.index))));
      }
      const reverse = new RegExp(`\\b(?:the|our|their)\\s+${word.source}\\s+([\\p{Lu}][\\p{L}\\d.&/-]*(?:\\s+[\\p{Lu}][\\p{L}\\d.&/-]*){0,3})`, "gu");
      for (let m = reverse.exec(p.text); m; m = reverse.exec(p.text)) {
        const name = m[1]!.trim();
        if (COMMON.has(norm(name)) || name.length < 2) continue;
        add({
          key: keyOf(kind, name),
          kind,
          name,
          description: "",
          attributes: {},
          confidence: "medium",
          reason: `called a ${kind.toLowerCase()} in the source`,
        }, mention(quote(sentenceAround(p.text, m.index))));
      }

      // Spoken language does not capitalise: "who owns the billing capability?" names a
      // capability as surely as "the Maximo application" does. A determiner is required, so
      // that a bare adjective before the kind word cannot become a node.
      const spoken = new RegExp(`\\b(?:the|our|their|a|an)\\s+([\\p{Ll}][\\p{L}\\d.&/-]*(?:\\s+[\\p{Ll}][\\p{L}\\d.&/-]*){0,2})\\s+${word.source}\\b`, "gu");
      for (let m = spoken.exec(p.text); m; m = spoken.exec(p.text)) {
        const said = m[1]!.trim();
        if (said.split(/\s+/).some((w) => COMMON.has(norm(w)))) continue;
        const name = titleCase(said);
        add({
          key: keyOf(kind, name),
          kind,
          name,
          description: "",
          attributes: {},
          confidence: "medium",
          reason: `called a ${kind.toLowerCase()} in the source`,
        }, mention(quote(sentenceAround(p.text, m.index))));
      }
    }
  }

  // 2b. topics — what the source is *about*, not what it names
  for (const p of passages) {
    for (const pattern of TOPIC_PATTERNS) {
      const re = new RegExp(pattern.source, pattern.flags);
      for (let m = re.exec(p.text); m; m = re.exec(p.text)) {
        const phrase = m[0].replace(/\s+/g, " ").trim();
        if (phrase.split(" ").every((w) => COMMON.has(norm(w)))) continue;
        const name = titleCase(phrase.toLowerCase());
        add({
          key: keyOf("Topic", name),
          kind: "Topic",
          name,
          description: "",
          attributes: {},
          confidence: "medium",
          reason: "the source discusses this subject",
        }, { passageId: p.id, speaker: p.speaker, quote: quote(sentenceAround(p.text, m.index)) });
      }
    }
  }

  // 3. emergent — proper nouns and acronyms nobody has declared, said more than once
  const proper = new Map<string, { name: string; passages: Set<string>; first: Mention }>();
  for (const p of passages) {
    const re = /\b([\p{Lu}][\p{Ll}\d.&/-]{2,}(?:\s+[\p{Lu}][\p{Ll}\d.&/-]{2,}){0,2}|[\p{Lu}\d]{2,6})\b/gu;
    for (let m = re.exec(p.text); m; m = re.exec(p.text)) {
      const name = m[1]!.trim();
      const n = norm(name);
      if (COMMON.has(n) || n.length < 3) continue;
      if (n.split(" ").every((w) => COMMON.has(w))) continue;
      const seen = proper.get(n) ?? { name, passages: new Set<string>(), first: { passageId: p.id, speaker: p.speaker, quote: quote(sentenceAround(p.text, m.index)) } };
      seen.passages.add(p.id);
      proper.set(n, seen);
    }
  }
  const claimed = new Set([...byKey.values()].map((c) => norm(c.name)));
  for (const [n, found] of proper) {
    if (claimed.has(n) || found.passages.size < 2) continue;
    add({
      key: keyOf("", found.name),
      kind: "",
      name: found.name,
      description: "",
      attributes: {},
      confidence: "low",
      reason: `said in ${found.passages.size} passages, never declared`,
    }, found.first);
  }

  return [...byKey.values()].sort(
    (a, b) => rank(b.confidence) - rank(a.confidence) || b.mentions.length - a.mentions.length || a.name.localeCompare(b.name),
  );
}

export function extractRelations(passages: Passage[], candidates: Candidate[], vocab: Vocabulary): CandidateRelation[] {
  const byKey = new Map<string, CandidateRelation>();
  // People are related to the source, not to each other by a verb in the middle of a sentence.
  const things = candidates.filter((c) => c.kind !== "Person");
  const existingKinds = new Map(vocab.relationKinds.map((k) => [norm(k), k]));

  for (const p of passages) {
    for (const sentence of sentences(p.text)) {
      const hits: Array<{ candidate: Candidate; at: number; end: number }> = [];
      for (const c of things) {
        for (const at of occurrences(sentence, c.name)) hits.push({ candidate: c, at, end: at + c.name.length });
      }
      hits.sort((a, b) => a.at - b.at);
      for (let i = 0; i < hits.length - 1; i++) {
        const a = hits[i]!;
        const b = hits[i + 1]!;
        if (a.candidate.key === b.candidate.key) continue;
        const between = sentence.slice(a.end, b.at);
        // A verb far from either end is a different clause, not a relation.
        if (between.length > 64) continue;
        const matched = RELATION_PATTERNS.find(([re]) => re.test(between));
        if (!matched) continue;
        const kind = existingKinds.get(norm(matched[1])) ?? matched[1];
        const key = `${a.candidate.key}>${norm(kind)}>${b.candidate.key}`;
        const mention: Mention = { passageId: p.id, speaker: p.speaker, quote: quote(sentence) };
        const existing = byKey.get(key);
        if (existing) {
          if (!existing.mentions.some((m) => m.passageId === p.id)) existing.mentions.push(mention);
          continue;
        }
        byKey.set(key, {
          key,
          from: a.candidate.key,
          to: b.candidate.key,
          kind,
          confidence: a.candidate.confidence === "high" && b.candidate.confidence === "high" ? "high" : "medium",
          reason: `“${between.trim()}” between the two`,
          mentions: [mention],
        });
      }
    }
  }
  return [...byKey.values()].sort((a, b) => rank(b.confidence) - rank(a.confidence) || b.mentions.length - a.mentions.length);
}

export function extractViewpoints(passages: Passage[], candidates: Candidate[]): Viewpoint[] {
  const out: Viewpoint[] = [];
  const seen = new Set<string>();
  const aboutByPassage = new Map<string, string[]>();
  for (const c of candidates) {
    if (c.kind === "Person") continue;
    for (const m of c.mentions) aboutByPassage.set(m.passageId, [...(aboutByPassage.get(m.passageId) ?? []), c.key]);
  }

  for (const p of passages) {
    for (const sentence of sentences(p.text)) {
      if (sentence.length < 12) continue;
      const cue = VIEWPOINT_CUES.find(([re]) => re.test(sentence));
      const type: ViewpointType | null = cue ? cue[1] : sentence.endsWith("?") ? "question" : null;
      if (!type) continue;
      const text = quote(sentence, 260);
      const key = `${type}:${norm(text).slice(0, 80)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        key,
        type,
        speaker: p.speaker,
        text,
        passageId: p.id,
        about: aboutByPassage.get(p.id) ?? [],
        confidence: cue ? cue[2] : "low",
      });
    }
  }
  return out;
}

function rank(c: Confidence): number {
  return c === "high" ? 3 : c === "medium" ? 2 : 1;
}

/**
 * A sentence starting "The Kamstrup platform…" capitalises its determiner, which would otherwise
 * be swept into the name and give the graph both "Kamstrup" and "The Kamstrup".
 */
function withoutDeterminer(raw: string): string {
  return raw.trim().replace(/^(?:the|a|an|our|their|its|this|that|these|those)\s+/i, "").trim();
}

/** "billing" said out loud is the Billing capability; a node named "billing" reads as a slip. */
function titleCase(v: string): string {
  return v.replace(/(^|[\s-])(\p{Ll})/gu, (_, lead: string, c: string) => lead + c.toUpperCase());
}

/** The sentence containing an offset, so a quote reads as a thought rather than a fragment. */
function sentenceAround(text: string, at: number): string {
  const start = Math.max(text.lastIndexOf(". ", at), text.lastIndexOf("! ", at), text.lastIndexOf("? ", at));
  const from = start === -1 ? 0 : start + 2;
  const rest = text.slice(from);
  const end = rest.search(/[.!?](\s|$)/);
  return end === -1 ? rest : rest.slice(0, end + 1);
}
