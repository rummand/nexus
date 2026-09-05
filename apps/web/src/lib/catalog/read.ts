import { eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";

/** Read model for the catalogue: what has been decided here, and what each grant covers. */

export interface ConnectionRow {
  providerId: string;
  status: "proposed" | "granted" | "declined" | "revoked";
  origin: "agent" | "human";
  reason: string;
  note: string;
  paths: string[];
  updatedAt: string;
}

export async function connectionsFor(db: Db, workspaceId: string): Promise<ConnectionRow[]> {
  const rows = await db.select().from(s.connections).where(eq(s.connections.workspaceId, workspaceId));
  const scopes = rows.length
    ? await db.select().from(s.connectionScopes).where(inArray(s.connectionScopes.connectionId, rows.map((r) => r.id)))
    : [];
  return rows.map((r) => ({
    providerId: r.providerId,
    status: r.status,
    origin: r.origin,
    reason: r.reason,
    note: r.note,
    paths: scopes.filter((sc) => sc.connectionId === r.id).map((sc) => sc.path),
    updatedAt: r.updatedAt,
  }));
}
