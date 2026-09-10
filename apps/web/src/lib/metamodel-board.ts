import type { MetaModel, MetaNodeType, MetaRelationType } from "./metamodel";
import type { Conformance } from "./metamodel-conformance";

/**
 * The meta-model as something you can look at (§5.66).
 *
 * The page was a file tree beside a five-tab inspector: Details, Diagram, Layers, Conformance,
 * Frameworks. Five tabs is five screens pretending to be one, and the tree was an IDE metaphor
 * applied to five node types — navigation for a quantity that does not need navigating. Between
 * them they buried the two things somebody actually opens this page to learn: *which of our types
 * are real declarations rather than accidents of the data*, and *does the data obey them*.
 *
 * So the model becomes a board of cards, and this module is what a card knows. Pure, because the
 * judgements here — what counts as needing attention, which of four possible complaints to show —
 * are the design, and a design worth arguing with belongs in a test rather than in JSX.
 *
 * The card carries **one** nudge, never four. A card that lists everything wrong with it is a
 * report; a card that names the next thing to do is a worklist, and a worklist is what a
 * meta-model in this state actually is.
 */

export type NudgeKind = "undeclared" | "breaches" | "undeclared-fields" | "no-fields";

export interface Nudge {
  kind: NudgeKind;
  /** One sentence, already counted, ready to render. */
  text: string;
  /** Ordering only: 0 is most urgent. Never shown. */
  rank: number;
}

export interface TypeCard {
  /** "node:Application" — unique across both halves of the model. */
  id: string;
  kind: "node" | "relation";
  name: string;
  description: string;
  color: string;
  declared: boolean;
  instances: number;
  /** Declared fields, or declared rules for a relation type. */
  declaredParts: number;
  /** Seen in the data and not declared: fields, or from→to pairs. */
  observedParts: number;
  breaches: number;
  offenders: number;
  framework: string;
  layerId: string | null;
  nudge: Nudge | null;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What every card here is saying, when they are all saying the same thing. Two or more only. */
function sharedNudge(list: TypeCard[]): Band["shared"] {
  if (list.length < 2) return null;
  const kind = list[0]!.nudge?.kind;
  if (!kind || !list.every((c) => c.nudge?.kind === kind)) return null;
  /*
   * The fact, not the advice. What to do about it is in the verdict at the top of the page and is
   * said once; repeating it per band would put the same paragraph on screen three times.
   */
  const text = kind === "undeclared"
    ? "None of these are declared. Each one grew from the data."
    : kind === "breaches"
      ? "Every one of these has objects breaking its rules."
      : kind === "undeclared-fields"
        ? "Each of these has something in the data its declaration does not mention."
        : "Each of these is declared with nothing in it yet.";
  return { kind, text };
}

/**
 * What this type most needs, or nothing.
 *
 * The order is the argument. An undeclared type outranks a broken rule because until somebody
 * says what a thing is, "broken" has no meaning — there is no rule to break. Breaches outrank
 * undeclared fields because a breach is the data contradicting a decision that was made, while an
 * undeclared field is only a decision not yet taken. And "no fields" comes last because a type
 * with a name and nothing else is still a useful statement.
 */
function nudgeFor(card: Omit<TypeCard, "nudge">): Nudge | null {
  if (!card.declared) {
    return {
      kind: "undeclared",
      rank: 0,
      text: card.instances
        ? `Grew from the data — ${plural(card.instances, "object")} and no declaration`
        : "Grew from the data and has never been declared",
    };
  }
  if (card.breaches > 0) {
    return {
      kind: "breaches",
      rank: 1,
      text: `${plural(card.offenders, "object")} break${card.offenders === 1 ? "s" : ""} the rules here`,
    };
  }
  if (card.observedParts > 0) {
    return {
      kind: "undeclared-fields",
      rank: 2,
      text: card.kind === "node"
        ? `${plural(card.observedParts, "field")} in the data, not declared`
        : `${plural(card.observedParts, "pairing")} in the data, no rule allows`,
    };
  }
  if (card.declaredParts === 0) {
    return {
      kind: "no-fields",
      rank: 3,
      text: card.kind === "node" ? "Declared, with no fields yet" : "Declared, with no rules yet",
    };
  }
  return null;
}

function nodeCard(t: MetaNodeType, breaches: number, offenders: number): TypeCard {
  const base = {
    id: `node:${t.name}`,
    kind: "node" as const,
    name: t.name,
    description: t.description,
    color: t.color,
    declared: t.id !== null,
    instances: t.instances,
    declaredParts: t.fields.filter((f) => f.id !== null).length,
    observedParts: t.fields.filter((f) => f.id === null).length,
    breaches,
    offenders,
    framework: t.framework,
    layerId: t.layerId,
  };
  return { ...base, nudge: nudgeFor(base) };
}

function relationCard(t: MetaRelationType, breaches: number, offenders: number): TypeCard {
  const base = {
    id: `relation:${t.name}`,
    kind: "relation" as const,
    name: t.name,
    description: t.description,
    color: "#8592a8",
    declared: t.id !== null,
    instances: t.instances,
    declaredParts: t.rules.length,
    observedParts: t.observedPairs.filter((p) => !p.declared).length,
    breaches,
    offenders,
    framework: t.framework,
    layerId: t.layerId ?? null,
  };
  return { ...base, nudge: nudgeFor(base) };
}

/**
 * Every type as a card, biggest first.
 *
 * Sorted by how much of the estate it accounts for rather than alphabetically, for the reason the
 * tenant list is (§5.64): the question somebody opens this with is "what is our architecture made
 * of", and an alphabetical list answers "what did we happen to name things".
 */
export function cards(model: MetaModel, report: Conformance): TypeCard[] {
  const conf = new Map(report.byType.map((t) => [`${t.kind}:${t.name}`, t]));
  const of = (kind: "node" | "relation", name: string) => conf.get(`${kind}:${name}`);
  const out = [
    ...model.nodeTypes.map((t) => {
      const c = of("node", t.name);
      return nodeCard(t, c?.breaches ?? 0, c?.offenders ?? 0);
    }),
    ...model.relationTypes.map((t) => {
      const c = of("relation", t.name);
      return relationCard(t, c?.breaches ?? 0, c?.offenders ?? 0);
    }),
  ];
  return out.sort((a, b) => b.instances - a.instances || a.name.localeCompare(b.name));
}

// ---- the health strip --------------------------------------------------------

export interface Health {
  /** Share of the estate whose type is declared at all, 0–100. */
  coverage: number;
  /**
   * Of what is described, the share breaking nothing — or **null when nothing is described**.
   *
   * A model covering none of the estate has no conforming instances and no breaking ones, and
   * the ratio of those is not 100%: it is undefined. Rendering a full green bar beside "0%
   * described" was the page telling its most flattering possible lie.
   */
  conformance: number | null;
  undeclared: number;
  /**
   * Breaches against a declared type. An undeclared kind is not a broken rule — it is a missing
   * one, and `coverage` is already the number for that.
   */
  breaches: number;
  /** Types with something to do. */
  needsAttention: number;
  /** One sentence that says which of the two numbers is the problem. */
  verdict: string;
}

/**
 * The two numbers, and which one to worry about.
 *
 * Both are needed and either alone lies: a model describing 4% of the estate perfectly scores
 * 100% conformance, and a model describing all of it while everything breaks scores 100%
 * coverage. The verdict exists so the reader is not left to work out which of their two numbers
 * is the bad one — it names the binding constraint, in the order it should be fixed.
 */
export function health(all: TypeCard[], report: Conformance): Health {
  const undeclared = all.filter((c) => !c.declared).length;
  const needsAttention = all.filter((c) => c.nudge !== null).length;
  const coverage = Math.round(report.typed);
  /*
   * Only breaches against a *declared* type count here.
   *
   * An undeclared kind — or an undeclared relation type — is not a rule being broken. It is the
   * absence of a rule, and the coverage figure already says exactly that. Counting it in both
   * places produced a verdict that contradicted itself in one sentence: "100% of that obeys the
   * rules. The breaches are listed."
   *
   * The same two kinds `conformance()` leaves out of its own score, and deliberately the same:
   * two definitions of "a breach" on one screen is how the numbers stop agreeing.
   */
  const ruleBreaches = report.breaches.filter(
    (b) => b.kind !== "kind-undeclared" && b.kind !== "relation-undeclared",
  ).length;
  const conformance = report.checked === 0 ? null : Math.round(report.score);

  let verdict: string;
  if (all.length === 0) verdict = "Nothing is modelled yet. Declare a type, or adopt a framework to start from.";
  else if (coverage < 50) verdict = `The model describes ${coverage}% of what is here. Declaring the types that grew from the data is worth more than any rule you could add.`;
  else if (ruleBreaches > 0) verdict = `${coverage}% of the estate is described, and ${conformance ?? 0}% of that obeys the rules. The breaches are listed against the types they belong to.`;
  else if (coverage < 100) verdict = `Everything described obeys its rules. ${undeclared === 1 ? "One type" : `${undeclared} types`} still ${undeclared === 1 ? "grows" : "grow"} from the data undeclared.`;
  else verdict = "Every type is declared and the data obeys all of it.";

  return { coverage, conformance, undeclared, breaches: ruleBreaches, needsAttention, verdict };
}

// ---- filtering and grouping ---------------------------------------------------

export type Only = "all" | "attention" | "undeclared" | "breaches";

export function filterCards(all: TypeCard[], query: string, only: Only): TypeCard[] {
  const q = query.trim().toLowerCase();
  return all.filter((c) => {
    if (q && !c.name.toLowerCase().includes(q) && !c.description.toLowerCase().includes(q)) return false;
    if (only === "attention") return c.nudge !== null;
    if (only === "undeclared") return !c.declared;
    // Same rule as the health strip: a type with no declaration has no rules to break.
    if (only === "breaches") return c.declared && c.breaches > 0;
    return true;
  });
}

export interface Band {
  id: string;
  label: string;
  /** Null for the catch-all band, which is drawn differently. */
  color: string | null;
  cards: TypeCard[];
  /** Said under the heading when the band is the catch-all. */
  note?: string;
  /**
   * The nudge every card in this band shares, hoisted out of them (§5.66).
   *
   * A workspace that has declared nothing yet showed the same sentence eighteen times — once per
   * card — which is how a useful prompt becomes wallpaper nobody reads. When a band is uniform
   * the fact belongs to the band, said once, and the cards go quiet.
   */
  shared: { kind: NudgeKind; text: string } | null;
}

/**
 * Cards in bands, or one band containing everything.
 *
 * Layers stop being a tab here (§5.58 gave the model a stack; this is what a stack is *for*):
 * grouping the board by layer is the same act as looking at the layers, so it is a control on one
 * view rather than a second screen showing the same types again.
 */
export function bands(list: TypeCard[], model: MetaModel, by: "none" | "layer" | "kind"): Band[] {
  if (by === "kind") {
    return [
      { id: "node", label: "Object types", color: null, cards: list.filter((c) => c.kind === "node") },
      { id: "relation", label: "Relationship types", color: null, cards: list.filter((c) => c.kind === "relation") },
    ].filter((b) => b.cards.length > 0).map((b) => ({ ...b, shared: sharedNudge(b.cards) }));
  }
  if (by === "layer") {
    const ordered = [...model.layers].sort((a, b) => a.position - b.position);
    const out: Band[] = ordered.map((l) => {
      const inBand = list.filter((c) => c.layerId === l.id);
      return { id: l.id, label: l.name, color: l.color, cards: inBand, shared: sharedNudge(inBand) };
    });
    const loose = list.filter((c) => !c.layerId || !ordered.some((l) => l.id === c.layerId));
    if (loose.length) {
      out.push({
        id: "unplaced",
        label: "Not in a layer",
        color: null,
        cards: loose,
        note: "A type nobody has placed. The stack can be read from the data rather than decided.",
        shared: sharedNudge(loose),
      });
    }
    return out.filter((b) => b.cards.length > 0);
  }
  return list.length ? [{ id: "all", label: "", color: null, cards: list, shared: sharedNudge(list) }] : [];
}
