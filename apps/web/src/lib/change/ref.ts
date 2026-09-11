import type { Change, ChangeSet, ChangeSetStatus } from "./types";

/**
 * Which ref you are standing on (§5.82).
 *
 * `main` is the estate as we currently believe it to be. A change set is a proposal about it. The
 * product has had both since rev 40 and no way to say which one you are *in* — you could look at
 * a plan, but every page you opened afterwards quietly showed you as-is again.
 *
 * This module is the vocabulary, kept pure so the counting can be tested without a database and
 * without a projection. Counting from the changes themselves rather than projecting them is
 * deliberate: an indicator that has to load the whole graph to render is an indicator that will
 * be taken out of the layout the first time somebody profiles a page.
 */

/** The sentence `main` gets, everywhere it is named. Said out loud because it is not obvious. */
export const MAIN_MEANS = "the estate as we currently believe it to be";

export type Ref =
  | { kind: "main" }
  | {
      kind: "set";
      id: string;
      name: string;
      status: ChangeSetStatus;
      targetDate: string;
      /** Set when this branch belongs to a source system rather than to a person (§5.92). */
      sourceKey?: string;
      sourceName?: string;
    };

export const MAIN: Ref = { kind: "main" };

export interface Divergence {
  introduces: number;
  retires: number;
  changes: number;
  connects: number;
  disconnects: number;
  /** How many changes in total — the number that answers "how far have I moved". */
  total: number;
}

export const NO_DIVERGENCE: Divergence = {
  introduces: 0, retires: 0, changes: 0, connects: 0, disconnects: 0, total: 0,
};

/**
 * What a change set would do, counted by object rather than by row.
 *
 * Two `setAttribute` changes to one application are one changed application, not two: the
 * question the indicator answers is *how much of the estate does this move*, and counting rows
 * would make a plan that renames one system look bigger than one that retires four.
 */
export function divergenceOf(changes: Change[]): Divergence {
  const introduces = new Set<string>();
  const retires = new Set<string>();
  const changed = new Set<string>();
  const connects = new Set<string>();
  const disconnects = new Set<string>();

  for (const change of changes) {
    switch (change.op) {
      case "addEntity": if (change.entityId) introduces.add(change.entityId); break;
      case "retireEntity": if (change.entityId) retires.add(change.entityId); break;
      case "setAttribute": if (change.entityId) changed.add(change.entityId); break;
      /*
       * A move counts as a change to the object rather than a category of its own. Moving
       * something in the hierarchy is a change to that object in every sense the indicator is
       * asking about, and an import that reparents two hundred capabilities would otherwise
       * read as two hundred somethings nobody has a word for.
       */
      case "setParent": if (change.entityId) changed.add(change.entityId); break;
      case "retypeEntity": if (change.entityId) changed.add(change.entityId); break;
      case "addRelation": if (change.relationId) connects.add(change.relationId); break;
      case "removeRelation": if (change.relationId) disconnects.add(change.relationId); break;
    }
  }

  /*
   * An object that is introduced and then edited is one introduction, not an introduction and a
   * change; an object that is retired was not also "changed" in any sense a reader cares about.
   */
  for (const id of introduces) changed.delete(id);
  for (const id of retires) changed.delete(id);

  return {
    introduces: introduces.size,
    retires: retires.size,
    changes: changed.size,
    connects: connects.size,
    disconnects: disconnects.size,
    total: introduces.size + retires.size + changed.size + connects.size + disconnects.size,
  };
}

/** The short form under the ref's name: "4 added · 2 retired · 9 changed". Empty when it is empty. */
export function divergenceWords(d: Divergence): string {
  const parts: string[] = [];
  if (d.introduces) parts.push(`${d.introduces} added`);
  if (d.retires) parts.push(`${d.retires} retired`);
  if (d.changes) parts.push(`${d.changes} changed`);
  if (d.connects) parts.push(`${d.connects} connected`);
  if (d.disconnects) parts.push(`${d.disconnects} disconnected`);
  return parts.join(" · ");
}

/** The name shown on the indicator. `main` is a name, not a placeholder. */
export function refName(ref: Ref): string {
  return ref.kind === "main" ? "main" : ref.name || "(unnamed change set)";
}

/**
 * What kind of thing this branch is, which #133 §7 says the branch must say out loud: a
 * correction, a plan, or a claim from a source. Only the second is knowable today — a change set
 * with a target date is a plan — so the others wait for the source branches of #139 rather than
 * being guessed at.
 */
export function refKindWords(ref: Ref): string {
  if (ref.kind === "main") return MAIN_MEANS;
  /*
   * The three kinds #133 §7 says a branch must name out loud. A source branch is knowable now:
   * it is not a plan and not somebody's proposal, it is what a system currently claims, and
   * reading it as a plan would be reading a sync as an intention.
   */
  if (ref.sourceKey) return `a standing claim from ${ref.sourceName || "a source"}, reconciled deliberately`;
  return ref.targetDate ? `a plan, for ${ref.targetDate}` : "a proposal, undated";
}

/** A change set is somewhere you can stand only while it is still open. */
export function canCheckOut(set: Pick<ChangeSet, "status">): boolean {
  return set.status === "draft" || set.status === "planned";
}
