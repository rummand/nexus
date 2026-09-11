import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { canCheckOut, divergenceOf, MAIN, NO_DIVERGENCE, type Divergence, type Ref } from "./ref";
import type { Change } from "./types";

/**
 * Standing on a ref (§5.82).
 *
 * One row per person per workspace. Absent means `main`, which is the right default in both
 * directions: a new workspace needs no row, and losing the row puts you somewhere safe rather
 * than nowhere.
 */

export interface Checkout {
  ref: Ref;
  divergence: Divergence;
}

export const ON_MAIN: Checkout = { ref: MAIN, divergence: NO_DIVERGENCE };

function asChange(row: s.ChangeRow): Change {
  let payload: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(row.payload);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) payload = parsed as Record<string, unknown>;
  } catch { /* a payload written by a version of the code that no longer exists */ }
  return { id: row.id, op: row.op, entityId: row.entityId, relationId: row.relationId, payload, note: row.note, createdAt: row.createdAt };
}

/**
 * Where this person is standing, and how far it has moved.
 *
 * A change set that has since been delivered or abandoned is *not* a place you can stand — the
 * first is history and the second is a decision — so the checkout quietly resolves to main
 * rather than leaving somebody editing something that has stopped being open. The row is left
 * alone; putting them back is the next thing they do, not a write on a read.
 */
export async function currentCheckout(db: Db, workspaceId: string, userId: string): Promise<Checkout> {
  const row = await db.query.checkouts.findFirst({
    where: and(eq(s.checkouts.workspaceId, workspaceId), eq(s.checkouts.userId, userId)),
  });
  if (!row) return ON_MAIN;

  const set = await db.query.changeSets.findFirst({ where: eq(s.changeSets.id, row.changeSetId) });
  if (!set || set.workspaceId !== workspaceId || !canCheckOut(set)) return ON_MAIN;

  const changes = await db.select().from(s.changes).where(eq(s.changes.changeSetId, set.id));
  return {
    ref: { kind: "set", id: set.id, name: set.name, status: set.status, targetDate: set.targetDate },
    divergence: divergenceOf(changes.map(asChange)),
  };
}

/** The refs this person could move to: main, plus every change set still open. */
export async function refChoices(db: Db, workspaceId: string): Promise<Array<{ id: string; name: string; status: s.ChangeSetRow["status"]; targetDate: string; changes: number }>> {
  const sets = await db.select().from(s.changeSets).where(eq(s.changeSets.workspaceId, workspaceId));
  const open = sets.filter(canCheckOut);
  if (!open.length) return [];
  const rows = await db.select().from(s.changes);
  const counted = new Map<string, number>();
  for (const row of rows) counted.set(row.changeSetId, (counted.get(row.changeSetId) ?? 0) + 1);
  return open
    .map((set) => ({ id: set.id, name: set.name, status: set.status, targetDate: set.targetDate, changes: counted.get(set.id) ?? 0 }))
    .sort((a, b) => (a.targetDate || "9999").localeCompare(b.targetDate || "9999") || a.name.localeCompare(b.name));
}

/**
 * Move to a ref. `null` is main, which is always allowed — you can always get back.
 *
 * Refuses a change set that is not open, and one from another workspace, because a checkout that
 * can point anywhere is a checkout that will eventually point somewhere wrong.
 */
export async function checkOut(db: Db, workspaceId: string, userId: string, changeSetId: string | null): Promise<{ error?: string }> {
  if (!changeSetId) {
    await db.delete(s.checkouts).where(and(eq(s.checkouts.workspaceId, workspaceId), eq(s.checkouts.userId, userId)));
    return {};
  }
  const set = await db.query.changeSets.findFirst({ where: eq(s.changeSets.id, changeSetId) });
  if (!set || set.workspaceId !== workspaceId) return { error: "That change set is not in this workspace." };
  if (!canCheckOut(set)) return { error: `“${set.name}” is ${set.status}, so it is not somewhere you can work.` };

  const now = new Date().toISOString();
  await db
    .insert(s.checkouts)
    .values({ workspaceId, userId, changeSetId, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [s.checkouts.workspaceId, s.checkouts.userId],
      set: { changeSetId, updatedAt: now },
    });
  return {};
}
