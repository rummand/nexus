import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { rewind, type PastEvent, type Rewound } from "./asof";
import { diffEstates, type EstateDiff } from "./diff";

/**
 * Named moments, and the estate at them (#112, §5.98).
 *
 * The database half. Reading the estate at a moment is `rewind` (§5.97); this is what fetches the
 * rows and the events for it, and what the two-moment comparison is built on.
 */

/** Only what happened *after* the earliest moment asked about has to be undone. */
async function eventsSince(db: Db, workspaceId: string, since: Date): Promise<PastEvent[]> {
  const rows = await db
    .select({
      entityId: s.entityEvents.entityId,
      entityName: s.entityEvents.entityName,
      kind: s.entityEvents.kind,
      field: s.entityEvents.field,
      fromValue: s.entityEvents.fromValue,
      toValue: s.entityEvents.toValue,
      at: s.entityEvents.at,
    })
    .from(s.entityEvents)
    .where(eq(s.entityEvents.workspaceId, workspaceId))
    .orderBy(desc(s.entityEvents.at));
  const floor = since.getTime();
  return rows.filter((row) => {
    const t = new Date(row.at).getTime();
    return !Number.isNaN(t) && t > floor;
  });
}

/** The estate as it stood at a moment. */
export async function estateAt(db: Db, workspaceId: string, at: Date): Promise<Rewound> {
  const [entities, events] = await Promise.all([
    db.select().from(s.entities).where(eq(s.entities.workspaceId, workspaceId)),
    eventsSince(db, workspaceId, at),
  ]);
  return rewind(entities, events, at);
}

/**
 * Two moments, compared.
 *
 * Both are rewound from today rather than one from the other, because "today" is the only state
 * that is certainly true — walking from an older reconstruction to a newer one would compound
 * whatever the log could not tell us.
 */
export async function compareMoments(db: Db, workspaceId: string, before: Date, after: Date): Promise<{
  before: Rewound;
  after: Rewound;
  diff: EstateDiff;
}> {
  const earliest = before < after ? before : after;
  const [entities, events] = await Promise.all([
    db.select().from(s.entities).where(eq(s.entities.workspaceId, workspaceId)),
    eventsSince(db, workspaceId, earliest),
  ]);
  const a = rewind(entities, events, before);
  const b = rewind(entities, events, after);
  return { before: a, after: b, diff: diffEstates(a.entities, b.entities) };
}

export async function listCheckpoints(db: Db, workspaceId: string) {
  return db.select().from(s.checkpoints).where(eq(s.checkpoints.workspaceId, workspaceId)).orderBy(asc(s.checkpoints.at));
}

export async function getCheckpoint(db: Db, workspaceId: string, id: string) {
  return db.query.checkpoints.findFirst({ where: and(eq(s.checkpoints.id, id), eq(s.checkpoints.workspaceId, workspaceId)) });
}

/**
 * The earliest moment the log can speak for.
 *
 * Rewinding past this is not wrong so much as uninformative: it returns today's estate with
 * nothing undone, which would read as "nothing has ever changed" rather than "I cannot see that
 * far back". The screens say which, using this.
 */
export async function historyReaches(db: Db, workspaceId: string): Promise<string | null> {
  const [oldest] = await db
    .select({ at: s.entityEvents.at })
    .from(s.entityEvents)
    .where(eq(s.entityEvents.workspaceId, workspaceId))
    .orderBy(asc(s.entityEvents.at))
    .limit(1);
  return oldest?.at ?? null;
}
