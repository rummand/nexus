import "server-only";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { CONTRACTS, type Contract } from "./readonly";

/**
 * The safety audit's evidence (#111, §5.99).
 *
 * The guard in `readonly.ts` is the promise; this is the record of it being kept. A buyer asking
 * "can this change our LeanIX?" gets two things rather than an assurance: the rule, stated per
 * connector, and the log of every read it has actually made.
 */

/** One connector's contract, with what it has read. */
export interface AuditRow extends Contract {
  reads: Array<{
    id: string;
    host: string;
    objects: number;
    relations: number;
    ms: number;
    at: string;
    by: string | null;
  }>;
}

/** Written on the way out of a successful read: a row here means data came back. */
export async function recordRead(
  db: Db,
  input: {
    workspaceId: string;
    connector: string;
    host: string;
    objects: number;
    relations: number;
    ms: number;
    byId?: string | null;
  },
): Promise<void> {
  await db.insert(s.sourceReads).values({
    id: `rd_${nanoid(10)}`,
    workspaceId: input.workspaceId,
    connector: input.connector,
    host: input.host.slice(0, 200),
    objects: input.objects,
    relations: input.relations,
    ms: input.ms,
    byId: input.byId ?? null,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Every contract and its recent reads.
 *
 * Contracts come from the code, not from the log, so a connector that has never been used still
 * states what it is allowed to do. The opposite — listing only what has run — would make the panel
 * empty on a fresh install, which is exactly when somebody is deciding whether to trust it.
 */
export async function auditFor(db: Db, workspaceId: string, limit = 8): Promise<AuditRow[]> {
  const rows = await db
    .select({
      id: s.sourceReads.id,
      connector: s.sourceReads.connector,
      host: s.sourceReads.host,
      objects: s.sourceReads.objects,
      relations: s.sourceReads.relations,
      ms: s.sourceReads.ms,
      at: s.sourceReads.createdAt,
      by: s.users.name,
    })
    .from(s.sourceReads)
    // Left, not inner: a person can leave the workspace, and their departure must not take the
    // evidence that a read happened with it.
    .leftJoin(s.users, eq(s.users.id, s.sourceReads.byId))
    .where(eq(s.sourceReads.workspaceId, workspaceId))
    .orderBy(desc(s.sourceReads.createdAt))
    .limit(limit * CONTRACTS.length);
  return CONTRACTS.map((contract) => ({
    ...contract,
    reads: rows.filter((r) => r.connector === contract.connector).slice(0, limit).map((r) => ({
      id: r.id,
      host: r.host,
      objects: r.objects,
      relations: r.relations,
      ms: r.ms,
      at: r.at,
      by: r.by ?? null,
    })),
  }));
}
