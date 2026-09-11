import type { ImportIntent } from "@/lib/import/plan";

/**
 * Where a claim goes, and who is entitled to say it (#139, §5.90).
 *
 * Rev 133 gave an import two destinations and made a person choose between them. That is the
 * right pair of destinations and the wrong way to pick: the choice is not a matter of taste, it
 * follows from what the claim *is*, and a question asked four hundred times is a question
 * answered carelessly.
 *
 * So the two rules of #139, as a function:
 *
 * 1. **Anything new lands on a branch.** An object that did not exist before never appears in
 *    the shared model because a nightly job ran. It waits until somebody works on it, which is
 *    what a campaign (§5.85) is for.
 * 2. **A known object's new values flow straight through.** Where the object is already
 *    reconciled and the source is the recognised owner of that field, the update lands, is
 *    recorded and attributed, and breaks the quality seal if somebody had validated it.
 *
 * The second rule carries as much weight as the first. Routing routine updates through a review
 * queue is how a queue becomes a thing somebody rubber-stamps on a Friday afternoon — and once
 * that habit exists the first rule protects nothing either. **Ceremony for what is new or
 * contested; silence for what is routine.**
 */

/** Where a single claim ends up. */
export type Route = "through" | "branch";

/**
 * What a source is allowed to say without asking.
 *
 * Field ownership is per source and per field because that is how it really is: ServiceNow knows
 * a system's lifecycle, the CMDB knows where it runs, and neither of them knows who owns it in
 * the business. `"*"` is for the source that is the whole record of something — useful for a
 * first connection, and a thing to narrow rather than a thing to leave.
 */
export interface SourceTrust {
  /** Stable id of the source: a connection id, `leanix`, `paste`, `person`. */
  id: string;
  /** What it is called where a person reads it. */
  name: string;
  /** Attribute keys it owns, or `["*"]` for all of them. Compared case- and space-insensitively. */
  owns: string[];
  /** May it retype an object it owns? Rarely: a type is a modelling decision, not a field. */
  ownsKind?: boolean;
  /** May it move an object in the hierarchy? A source that owns the tree usually owns only that. */
  ownsPlace?: boolean;
}

/** Everything a routing decision needs to know about the estate it is landing in. */
export interface Standing {
  /**
   * Has this object been reconciled — taken through a campaign, or matched by a key this source
   * wrote itself on a previous read? An object nobody has ever looked at is not a known object
   * just because a name matched.
   */
  reconciled: (entityId: string) => boolean;
  /** Fields a person has validated, which a source may still write — loudly (§5.85). */
  sealed?: (entityId: string, key: string) => boolean;
}

export interface Routed {
  intent: ImportIntent;
  route: Route;
  /** One sentence, in the product's own words, for the screen that shows the split. */
  why: string;
  /** True when this lands straight through over a value somebody had validated. */
  breaksSeal: boolean;
}

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

/** Does this source own this field? `*` owns everything; otherwise it is an exact key match. */
export function owns(source: SourceTrust, key: string): boolean {
  return source.owns.some((k) => k === "*" || norm(k) === norm(key));
}

/**
 * Route one claim.
 *
 * Deliberately conservative at every fork: anything this cannot justify letting through, it
 * lands. A claim held on a branch costs somebody a click; a claim through the front door costs
 * the model its credibility.
 */
export function routeOf(intent: ImportIntent, source: SourceTrust, standing: Standing): Routed {
  const hold = (why: string): Routed => ({ intent, route: "branch", why, breaksSeal: false });

  if (intent.op === "addEntity") return hold(`“${intent.name}” is new — nothing new lands without somebody seeing it.`);
  // A relation is structure, and structure is a modelling claim rather than a field value.
  if (intent.op === "addRelation") return hold(`${intent.name} is a connection ${source.name} is proposing.`);
  if (intent.fresh) return hold(`“${intent.name}” is new in this batch.`);
  if (!standing.reconciled(intent.entityId)) {
    return hold(`Nobody has reconciled “${intent.name}” yet, so ${source.name} does not get to write to it unseen.`);
  }

  if (intent.op === "retypeEntity") {
    return source.ownsKind
      ? { intent, route: "through", why: `${source.name} decides what “${intent.name}” is.`, breaksSeal: false }
      : hold(`${source.name} calls “${intent.name}” a ${String(intent.payload.kind)}; what something *is* is a modelling decision.`);
  }
  if (intent.op === "setParent") {
    return source.ownsPlace
      ? { intent, route: "through", why: `${source.name} owns where “${intent.name}” sits.`, breaksSeal: false }
      : hold(`${source.name} would move “${intent.name}” in the hierarchy.`);
  }

  const key = String(intent.payload.key ?? "");
  if (!owns(source, key)) return hold(`${source.name} is not the owner of ${key}.`);
  const breaksSeal = Boolean(standing.sealed?.(intent.entityId, key));
  return {
    intent,
    route: "through",
    why: breaksSeal
      ? `${source.name} owns ${key}, and this replaces a value somebody had validated.`
      : `${source.name} owns ${key} on “${intent.name}”, which is reconciled. Routine.`,
    breaksSeal,
  };
}

export interface Split {
  routed: Routed[];
  /** What goes to the shared model now. */
  through: ImportIntent[];
  /** What waits on a branch for somebody. */
  branch: ImportIntent[];
  /** Validated values this would overwrite: worth saying out loud before, not after. */
  seals: number;
}

export function splitByRoute(intents: ImportIntent[], source: SourceTrust, standing: Standing): Split {
  const routed = intents.map((intent) => routeOf(intent, source, standing));
  return {
    routed,
    through: routed.filter((r) => r.route === "through").map((r) => r.intent),
    branch: routed.filter((r) => r.route === "branch").map((r) => r.intent),
    seals: routed.filter((r) => r.breaksSeal).length,
  };
}

/**
 * The split in one sentence, for the button that is about to do it.
 *
 * Written so the routine half sounds routine: "312 routine updates land; 143 claims wait on a
 * branch" is a thing somebody can agree to at a glance, which is the whole point of not asking
 * them four hundred separate questions.
 */
export function splitWords(split: Split): string {
  const through = split.through.length;
  const held = split.branch.length;
  if (!through && !held) return "Nothing to do.";
  const parts: string[] = [];
  if (through) parts.push(`${through} routine update${through === 1 ? "" : "s"} land`);
  if (held) parts.push(`${held} claim${held === 1 ? "" : "s"} wait${held === 1 ? "s" : ""} on a branch`);
  const seals = split.seals ? ` ${split.seals} validated value${split.seals === 1 ? "" : "s"} would be overwritten.` : "";
  return `${parts.join("; ")}.${seals}`;
}

/**
 * What a source is trusted with until somebody says otherwise.
 *
 * An EA repository is the recognised owner of the fields it exists to hold, and of the
 * hierarchy, because a capability map *is* the tree. Everything else arriving through a door
 * starts owning nothing: a pasted block has no standing until a person gives it some, which is
 * the honest default for a block of text in a mail.
 */
export function defaultTrust(origin: string, id: string, name: string): SourceTrust {
  if (origin === "EA repository") {
    return { id, name, owns: ["lifecycle", "business criticality", "business owner", "technical owner", "description"], ownsPlace: true };
  }
  if (origin === "connected system") return { id, name, owns: ["lifecycle", "hosting", "environment", "version"] };
  return { id, name, owns: [] };
}
