import type { ChangeSet, ChangeSetStatus } from "./types";

/**
 * Sequencing change sets.
 *
 * A roadmap is not a list of independent intentions. "Retire the Historian and stream telemetry"
 * only makes sense once the platform plan has delivered the thing being streamed into, and a tool
 * that cannot say so leaves the sequencing in somebody's head — which is where roadmaps go wrong.
 *
 * Everything here is pure over ids so it can be tested without a database and run per request.
 */

/** `changeSetId` waits for `dependsOnId`. */
export interface Dependency {
  changeSetId: string;
  dependsOnId: string;
}

export function blockersOf(id: string, deps: Dependency[]): string[] {
  return deps.filter((d) => d.changeSetId === id).map((d) => d.dependsOnId);
}

export function dependentsOf(id: string, deps: Dependency[]): string[] {
  return deps.filter((d) => d.dependsOnId === id).map((d) => d.changeSetId);
}

/**
 * Everything `id` waits for, directly or through another plan, nearest first.
 *
 * Transitive because delivery has to be: a plan whose blocker is itself blocked is not ready
 * either, and saying "waiting for A" while A waits for B is a half-truth.
 */
export function allBlockers(id: string, deps: Dependency[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const queue = blockersOf(id, deps);
  while (queue.length) {
    const next = queue.shift()!;
    if (seen.has(next)) continue;
    seen.add(next);
    out.push(next);
    queue.push(...blockersOf(next, deps));
  }
  return out;
}

/**
 * Would adding this edge make a loop?
 *
 * Checked before the write so every reader can assume the graph is acyclic. Two plans that each
 * wait for the other is not a roadmap anybody can deliver, and the honest moment to say so is
 * when somebody draws the second edge.
 */
export function wouldCycle(deps: Dependency[], changeSetId: string, dependsOnId: string): boolean {
  if (changeSetId === dependsOnId) return true;
  // A cycle appears exactly when the proposed blocker already waits for the dependent.
  return allBlockers(dependsOnId, deps).includes(changeSetId) || dependsOnId === changeSetId;
}

/**
 * Delivery order: blockers before dependents, and within that, by target date.
 *
 * Kahn's algorithm with a date tiebreak, so the order is stable and reads the way a person would
 * write the plan out. Any set caught in a cycle (which the write path prevents, but old data or a
 * hand-edited database might hold) is appended rather than dropped.
 */
export function deliveryOrder(sets: Array<{ id: string; targetDate: string }>, deps: Dependency[]): string[] {
  const ids = new Set(sets.map((s) => s.id));
  const remaining = new Map(sets.map((s) => [s.id, s]));
  const waiting = new Map<string, Set<string>>();
  for (const s of sets) waiting.set(s.id, new Set(blockersOf(s.id, deps).filter((b) => ids.has(b))));

  const out: string[] = [];
  while (remaining.size) {
    const ready = [...remaining.values()]
      .filter((s) => (waiting.get(s.id)?.size ?? 0) === 0)
      .sort((a, b) => (a.targetDate || "9999").localeCompare(b.targetDate || "9999") || a.id.localeCompare(b.id));
    if (!ready.length) {
      // A cycle: emit what is left in date order rather than losing it.
      out.push(...[...remaining.values()].sort((a, b) => (a.targetDate || "9999").localeCompare(b.targetDate || "9999")).map((s) => s.id));
      break;
    }
    for (const s of ready) {
      out.push(s.id);
      remaining.delete(s.id);
      for (const set of waiting.values()) set.delete(s.id);
    }
  }
  return out;
}

/** A blocker that is still in the way, and why. */
export interface Blocked {
  id: string;
  name: string;
  status: ChangeSetStatus;
  reason: "not delivered" | "abandoned";
}

/**
 * What still stands between a change set and delivery.
 *
 * An abandoned blocker is listed too, and deliberately not treated as satisfied: a plan waiting on
 * something that is not going to happen is stranded, and quietly letting it through would hide
 * exactly the decision somebody needs to make.
 */
export function blocking(id: string, sets: ChangeSet[], deps: Dependency[]): Blocked[] {
  const byId = new Map(sets.map((s) => [s.id, s]));
  const out: Blocked[] = [];
  for (const blockerId of allBlockers(id, deps)) {
    const blocker = byId.get(blockerId);
    if (!blocker || blocker.status === "delivered") continue;
    out.push({ id: blocker.id, name: blocker.name, status: blocker.status, reason: blocker.status === "abandoned" ? "abandoned" : "not delivered" });
  }
  return out;
}

/**
 * Plans dated before something they wait for.
 *
 * Not an error — a date is a hope, and people write them down before the sequencing is settled.
 * But it is the kind of contradiction a roadmap should point at rather than draw neatly.
 */
export function scheduleWarnings(sets: ChangeSet[], deps: Dependency[]): Array<{ id: string; message: string }> {
  const byId = new Map(sets.map((s) => [s.id, s]));
  const out: Array<{ id: string; message: string }> = [];
  for (const set of sets) {
    if (!set.targetDate || set.status === "delivered") continue;
    for (const blockerId of blockersOf(set.id, deps)) {
      const blocker = byId.get(blockerId);
      if (!blocker || !blocker.targetDate || blocker.status === "delivered") continue;
      if (blocker.targetDate > set.targetDate) {
        out.push({ id: set.id, message: `Dated ${set.targetDate}, but waits for “${blocker.name}” which is dated ${blocker.targetDate}.` });
      }
    }
  }
  return out;
}
