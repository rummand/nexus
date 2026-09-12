import type { Ref } from "./ref";

/**
 * What a board save is allowed to do to the estate (#149, §5.100).
 *
 * The product already had this rule, written down and enforced — on one door. `routeOf`
 * (`src/lib/source/trust.ts`) refuses to let anything new from a source land in the estate:
 * *"is new — nothing new lands without somebody seeing it."* Everything an import proposes goes
 * to a branch, through the merge gate, past MODELOWNERS, and only then into the graph.
 *
 * The canvas ignored it. A card drawn in a workshop became an entity on the next autosave, with
 * exactly the standing of an object that came from LeanIX, was reconciled by a person and signed
 * off by its owner. Nothing recorded that one of them was a sketch.
 *
 * So the rule is one rule now. Pure and separate from the sync so that what a save may do is a
 * question with a testable answer, rather than a shape that emerges from a hundred lines of
 * database calls.
 */

/** Where a single thing a board save found should go. */
export type Route =
  /** Nothing to do: the estate already says this. */
  | "skip"
  /** Straight into the estate, as board saves have always done. */
  | "through"
  /** Onto a ref as a proposal, to be seen before it counts. */
  | "propose";

export interface CardFacts {
  /** Is there a row for it in `entities` yet? */
  exists: boolean;
  /** Does the card differ from the row? Meaningless when `exists` is false. */
  differs: boolean;
}

/**
 * The rule, in four lines.
 *
 * **New never lands unseen, wherever you are standing.** Not on a branch, not on main, not from
 * an agent, not at three in the morning. It is the same sentence the import door enforces, and
 * the estate is only as trustworthy as its least governed door.
 *
 * **An edit to something already in the estate writes through.** Deliberately unchanged in this
 * slice: routing edits as well would mean ordinary curation on main suddenly needed a merge, and
 * a rename cannot even be expressed as a change yet — the ops are `setAttribute`, `retypeEntity`
 * and `setParent`, and none of them carries a name. Widening the rule before the change model can
 * carry it would mean silently dropping renames, which is worse than not routing them.
 */
export function routeCard(facts: CardFacts): Route {
  if (!facts.exists) return "propose";
  return facts.differs ? "through" : "skip";
}

/** Same rule for a connector: a relation that does not exist yet is a modelling claim. */
export function routeRelation(facts: CardFacts): Route {
  if (!facts.exists) return "propose";
  return facts.differs ? "through" : "skip";
}

/**
 * The name of the change set a board opens for itself.
 *
 * Named after the board rather than after the person or the date, because the question somebody
 * asks three weeks later is "what came off that workshop?" — not "what did Maria draw on the
 * fourth". The board is the thing both of them remember.
 */
export function boardSetName(boardName: string): string {
  const name = boardName.trim() || "an untitled board";
  return `Drawn on “${name}”`;
}

/**
 * What to tell somebody who has just drawn their first object.
 *
 * One sentence, and it has to answer the question the surprise raises: *where did it go, and what
 * do I do now?* A message that only says "this was not saved to the model" invites somebody to
 * press things until it is.
 */
export function proposedWords(count: number, ref: Ref): string {
  const what = count === 1 ? "This object is" : `These ${count} objects are`;
  if (ref.kind === "set") {
    return `${what} on “${ref.name}”. ${count === 1 ? "It joins" : "They join"} the model when that change set is delivered.`;
  }
  return `${what} proposed, not yet in the model. Review and deliver the change set to add ${count === 1 ? "it" : "them"}.`;
}

/** The one-line reason recorded on each change, so a reviewer knows where it came from. */
export function drawnNote(boardName: string): string {
  return `Drawn on “${boardName.trim() || "an untitled board"}”.`;
}
