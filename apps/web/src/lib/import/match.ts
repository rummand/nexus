import type { StagedRecord } from "./stage";

/**
 * Is this thing already in the graph?
 *
 * The question every import has to answer and most answer badly, in one of two directions: match
 * on nothing and the estate doubles every month; match too eagerly and two different systems with
 * similar names quietly become one, which is much harder to undo.
 *
 * So matching is graded and always visible. A source key is a fact. A name plus a kind is strong.
 * A name alone is worth looking at. A near-name is a question, never an answer — it is offered as
 * a candidate and never chosen on its own.
 */

export interface MatchTarget {
  id: string;
  name: string;
  kind: string;
  /** Attributes, so a source key stored on a previous import can be recognised. */
  attributes: Record<string, string>;
}

export type MatchHow = "source key" | "name and kind" | "name" | "near name" | "none";

export interface Match {
  how: MatchHow;
  entityId: string | null;
  name: string;
  kind: string;
  /** Other things it could have been. Shown whenever the answer was not certain. */
  alternatives: Array<{ entityId: string; name: string; kind: string; how: MatchHow }>;
}

/** Where a previous import writes the source's own identifier, so the next one recognises it. */
export const KEY_ATTRIBUTE = "source key";

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
/** Strip the noise that makes two names of one system look different. */
const bare = (v: string) =>
  norm(v)
    .replace(/\b(v|version)\s?\d+(\.\d+)*\b/g, " ")
    .replace(/\b(prod|production|test|dev|uat|qa|sandbox)\b/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function matchRecord(record: StagedRecord, targets: MatchTarget[]): Match {
  const none: Match = { how: "none", entityId: null, name: "", kind: "", alternatives: [] };

  if (record.key) {
    const byKey = targets.find((t) => norm(t.attributes[KEY_ATTRIBUTE] ?? "") === norm(record.key));
    if (byKey) return { how: "source key", entityId: byKey.id, name: byKey.name, kind: byKey.kind, alternatives: [] };
  }
  if (!record.name.trim()) return none;

  const wanted = norm(record.name);
  const sameName = targets.filter((t) => norm(t.name) === wanted);
  const exact = sameName.find((t) => norm(t.kind) === norm(record.kind));
  if (exact) {
    return {
      how: "name and kind",
      entityId: exact.id,
      name: exact.name,
      kind: exact.kind,
      alternatives: sameName.filter((t) => t.id !== exact.id).map((t) => ({ entityId: t.id, name: t.name, kind: t.kind, how: "name" as const })),
    };
  }
  if (sameName.length === 1) {
    const only = sameName[0]!;
    return { how: "name", entityId: only.id, name: only.name, kind: only.kind, alternatives: [] };
  }
  if (sameName.length > 1) {
    // The graph has this name more than once and nothing tells them apart. Choosing would be a
    // guess with consequences; offering both is the honest move.
    return {
      how: "none",
      entityId: null,
      name: "",
      kind: "",
      alternatives: sameName.map((t) => ({ entityId: t.id, name: t.name, kind: t.kind, how: "name" as const })),
    };
  }

  const stripped = bare(record.name);
  const near = targets
    .map((t) => ({ t, score: similarity(stripped, bare(t.name)) }))
    .filter((c) => c.score >= 0.72)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  if (near.length) {
    return {
      how: "near name",
      entityId: null,
      name: "",
      kind: "",
      alternatives: near.map(({ t }) => ({ entityId: t.id, name: t.name, kind: t.kind, how: "near name" as const })),
    };
  }
  return none;
}

/**
 * How alike two names are: shared words, then shared character trigrams.
 *
 * Words carry most of it ("Maximo Asset Management" against "Maximo"); trigrams catch the rest
 * ("PI Historian" against "PI-Historian"). Deliberately not an edit distance — "SAP PM" and "SAP CM"
 * are two characters apart and two different systems.
 */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const wordsA = new Set(a.split(" ").filter(Boolean));
  const wordsB = new Set(b.split(" ").filter(Boolean));
  const shared = [...wordsA].filter((w) => wordsB.has(w));
  // One shared word out of one is only a match if the other name is not much bigger: "SAP" against
  // "SAP PM, SAP FI and SAP HR" is a substring, not the same thing.
  const wordScore = shared.length === 0 ? 0 : (2 * shared.length) / (wordsA.size + wordsB.size);
  const gramScore = jaccard(trigrams(a), trigrams(b));
  return Math.max(wordScore * 0.85 + gramScore * 0.15, gramScore * 0.9);
}

function trigrams(v: string): Set<string> {
  const padded = ` ${v} `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const v of a) if (b.has(v)) shared++;
  return shared / (a.size + b.size - shared);
}

/**
 * What the import would do to a matched object: only the fields that actually change.
 *
 * Rows that change nothing are the majority of any re-import, and showing them is how a review of
 * four hundred rows becomes a review nobody does. They are counted and kept out of the way.
 */
export interface Change {
  key: string;
  from: string;
  to: string;
}

export function changesAgainst(record: StagedRecord, target: MatchTarget | null): Change[] {
  if (!target) return [];
  const out: Change[] = [];
  if (record.kind && norm(record.kind) !== norm(target.kind)) out.push({ key: "kind", from: target.kind, to: record.kind });
  for (const [key, field] of Object.entries(record.attributes)) {
    const before = target.attributes[key] ?? "";
    if (norm(before) !== norm(field.chosen.value)) out.push({ key, from: before, to: field.chosen.value });
  }
  return out;
}
