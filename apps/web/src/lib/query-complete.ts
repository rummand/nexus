import type { GraphSnapshot } from "./graph-types";

/**
 * Autocomplete for the graph query language: given the text typed so far and the workspace
 * vocabulary (kinds, attribute keys / values, relation types, entity names), propose completions
 * for the *last* token. Pure, so the command bar and tests share it.
 */

const CLAUSES = ["kind:", "related:", "from:", "to:", "rel:", "has:", "missing:", "on:"];
const KIND_KEYS = new Set(["kind", "is", "type"]);
const REL_KEYS = new Set(["rel", "relation", "via"]);
const NAME_KEYS = new Set(["related", "near", "with", "from", "out", "to", "in"]);
const PRESENCE_KEYS = new Set(["has", "missing", "without", "no"]);

const quote = (v: string) => (/\s/.test(v) ? `"${v}"` : v);
const norm = (v: string) => v.trim().toLowerCase();

export interface Completion {
  /** Text to show on the chip. */
  label: string;
  /** The full query after applying the completion. */
  query: string;
}

export function completeQuery(query: string, vocab: GraphSnapshot | null, limit = 8): Completion[] {
  // last token: either an open quoted value (`key:"foo b`) or a plain token
  const m = /(^|\s)(?:(?<key>\w[\w-]*):(?:"(?<quoted>[^"]*)|(?<plain>[^\s"]*))|(?<bare>\S*))$/.exec(query);
  if (!m) return [];
  const g = m.groups ?? {};
  const head = query.slice(0, m.index + m[1]!.length);
  const rawKey = g.key ?? "";
  const key = rawKey ? norm(rawKey) : null;
  const partial = key ? (g.quoted ?? g.plain ?? "") : (g.bare ?? "");
  const p = norm(partial);
  const apply = (completion: string) => ({ label: completion, query: `${head}${completion} ` });
  const pick = (values: string[], prefix: (v: string) => string) => {
    const seen = new Set<string>();
    const out: Completion[] = [];
    for (const v of values) {
      if (!v || seen.has(norm(v))) continue;
      if (p && !norm(v).startsWith(p) && !norm(v).includes(p)) continue;
      seen.add(norm(v));
      out.push(apply(prefix(v)));
      if (out.length >= limit) break;
    }
    return out;
  };
  const attributeKeys = vocab ? [...new Set(vocab.kinds.flatMap((k) => k.attributeKeys.map((a) => a.key)))] : [];

  if (key === null) {
    // bare word → clause keywords and attribute keys
    const all = [...CLAUSES, ...attributeKeys.map((k) => `${k}:`)];
    return all.filter((c) => !p || norm(c).startsWith(p)).slice(0, limit).map((c) => ({ label: c, query: `${head}${c}` }));
  }
  if (!vocab) return [];
  if (KIND_KEYS.has(key)) return pick(vocab.kinds.map((k) => k.kind), (v) => `${rawKey}:${quote(v)}`);
  if (REL_KEYS.has(key)) return pick(vocab.relationKinds.map((r) => r.kind), (v) => `${rawKey}:${quote(v)}`);
  if (NAME_KEYS.has(key)) return pick(vocab.entities.map((e) => e.name), (v) => `${rawKey}:${quote(v)}`);
  if (PRESENCE_KEYS.has(key) || key === "on") return key === "on" ? [] : pick(attributeKeys, (v) => `${rawKey}:${quote(v)}`);
  // attribute key → its values
  const values = new Map<string, number>();
  for (const e of vocab.entities) {
    const hit = Object.keys(e.attributes).find((k) => norm(k) === key);
    if (hit && e.attributes[hit]) values.set(e.attributes[hit]!, (values.get(e.attributes[hit]!) ?? 0) + 1);
  }
  return pick([...values.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v), (v) => `${rawKey}:${quote(v)}`);
}
