import type { MetaModel } from "./metamodel";

/**
 * The triple — source → relationship → target — as a thing in its own right (§5.67).
 *
 * Borrowed, deliberately, from Ardoq's constraints table, which is the best idea in their
 * product: the unit of a meta-model is not the relationship *type* but the **triple**. "An
 * Application uses an IT Component" is a statement an organisation can agree with or reject;
 * "uses" on its own is not. Nexus already computed every part of this — `observedPairs` carries
 * the counts and a declared flag, `rules` carries the declarations — and then buried it inside
 * one relation type's detail panel at a time, where nobody could see the shape of it.
 *
 * Three statuses, and the third is the one this product exists for:
 *
 * - **in use** — declared, and the data has instances of it. The model working.
 * - **unused** — declared, and nothing in the estate does it. Either a rule written for a future
 *   that never arrived, or a genuine gap. Worth seeing; never worth deleting automatically.
 * - **observed** — the data does it and nobody declared it. In another tool this is a violation
 *   to be cleaned up. Here it is a **proposal**: the organisation's data telling you what its
 *   meta-model actually is, one click from becoming a rule.
 *
 * Pure. The statuses and the ordering are the design, and they belong somewhere arguable.
 */

export type TripleStatus = "in-use" | "unused" | "observed";

export interface Triple {
  /** Stable across renders: the three names are the identity. */
  id: string;
  from: string;
  relation: string;
  to: string;
  status: TripleStatus;
  /** How many connections in the estate are this exact triple. */
  instances: number;
  /** Declared rules only. "" when the rule does not say. */
  cardinality: string;
  /** The rule row, for removing it. Null for an observed triple. */
  ruleId: string | null;
  /** The relation type's id, for adding a rule. Null when the type itself is undeclared. */
  relationTypeId: string | null;
}

const key = (from: string, relation: string, to: string) => `${from} ${relation} ${to}`;

/**
 * Every triple the model declares or the data exhibits, heaviest first.
 *
 * Ordered by how much of the estate each accounts for rather than alphabetically: the question
 * this table answers is "what does this organisation actually do", and the triple with four
 * hundred instances is the answer whether or not its name starts with A. Unused rules sort last
 * among equals — they have no instances by definition, and they are the least urgent thing here.
 */
export function triples(model: MetaModel): Triple[] {
  const out = new Map<string, Triple>();

  for (const rt of model.relationTypes) {
    const counts = new Map(rt.observedPairs.map((p) => [key(p.fromType, rt.name, p.toType), p.count]));

    for (const rule of rt.rules) {
      const k = key(rule.fromType, rt.name, rule.toType);
      const instances = counts.get(k) ?? 0;
      out.set(k, {
        id: k,
        from: rule.fromType,
        relation: rt.name,
        to: rule.toType,
        status: instances > 0 ? "in-use" : "unused",
        instances,
        cardinality: rule.cardinality ?? "",
        ruleId: rule.id,
        relationTypeId: rt.id,
      });
    }

    for (const pair of rt.observedPairs) {
      const k = key(pair.fromType, rt.name, pair.toType);
      if (out.has(k)) continue;
      out.set(k, {
        id: k,
        from: pair.fromType,
        relation: rt.name,
        to: pair.toType,
        status: "observed",
        instances: pair.count,
        cardinality: "",
        ruleId: null,
        relationTypeId: rt.id,
      });
    }
  }

  return [...out.values()].sort(
    (a, b) =>
      b.instances - a.instances ||
      a.from.localeCompare(b.from) ||
      a.relation.localeCompare(b.relation) ||
      a.to.localeCompare(b.to),
  );
}

export interface RuleSummary {
  inUse: number;
  unused: number;
  observed: number;
  /** Connections accounted for by a declared rule, and the total, so a share can be shown. */
  covered: number;
  total: number;
  /** Share of connections following a declared rule, 0-100. Null when there are none. */
  share: number | null;
  verdict: string;
}

/**
 * What the rules add up to, and which of the three numbers is the interesting one.
 *
 * The share is of *connections*, not of triples: one undeclared triple carrying four hundred
 * connections matters more than nine carrying one each, and counting rows would say the opposite.
 */
export function ruleSummary(list: Triple[]): RuleSummary {
  const inUse = list.filter((t) => t.status === "in-use").length;
  const unused = list.filter((t) => t.status === "unused").length;
  const observed = list.filter((t) => t.status === "observed").length;
  const covered = list.filter((t) => t.status === "in-use").reduce((n, t) => n + t.instances, 0);
  const total = list.reduce((n, t) => n + t.instances, 0);
  const share = total === 0 ? null : Math.round((covered / total) * 100);

  let verdict: string;
  if (list.length === 0) {
    verdict = "No relationships yet. Draw some connections, or declare a rule to say what should be possible.";
  } else if (observed === 0 && unused === 0) {
    verdict = "Every connection in the estate is one the model allows.";
  } else if (observed > 0) {
    const pairings = observed === 1 ? "One pairing is" : `${observed} pairings are`;
    verdict = `${share ?? 0}% of connections follow a declared rule. ${pairings} in the data and undeclared — the estate proposing what the rest of the model should say.`;
  } else {
    const rules = unused === 1 ? "One rule has" : `${unused} rules have`;
    verdict = `Every connection follows a rule. ${rules} nothing doing it yet.`;
  }

  return { inUse, unused, observed, covered, total, share, verdict };
}

export type RuleFilter = "all" | TripleStatus;

export function filterTriples(list: Triple[], query: string, only: RuleFilter): Triple[] {
  const q = query.trim().toLowerCase();
  return list.filter((t) => {
    if (only !== "all" && t.status !== only) return false;
    if (!q) return true;
    return `${t.from} ${t.relation} ${t.to}`.toLowerCase().includes(q);
  });
}

/**
 * Whether this triple can be promoted to a rule, and what stops it.
 *
 * A rule constrains a relationship *type*, so an undeclared type has nothing to hang one on.
 * That is a real order of operations rather than a technicality, and saying it beats a button
 * that fails: you cannot constrain a word the model has not yet agreed is a word.
 */
export function blockedFrom(t: Triple): string | null {
  if (t.status !== "observed") return null;
  if (!t.relationTypeId) {
    return `Declare the "${t.relation}" relationship type first — a rule constrains a type, and this one is not declared yet.`;
  }
  return null;
}
