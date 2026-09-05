import { eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import type { Provider, ProviderCategory } from "./types";

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

/**
 * Workspace-registered sources, presented as catalogue providers so everything downstream — the
 * scan, the grid, the grant panel — treats them identically to the built-in ones.
 */
export async function customProviders(db: Db, workspaceId: string): Promise<Provider[]> {
  const rows = await db.select().from(s.catalogEntries).where(eq(s.catalogEntries.workspaceId, workspaceId));
  return rows.map((row) => {
    let signals: string[] = [];
    try {
      const parsed: unknown = JSON.parse(row.signals);
      if (Array.isArray(parsed)) signals = parsed.filter((v): v is string => typeof v === "string");
    } catch { /* a malformed row simply has no signals */ }
    return {
      id: `custom:${row.id}`,
      name: row.name,
      vendor: row.vendor || "Registered here",
      category: (row.category as ProviderCategory) ?? "systems",
      status: "planned" as const,
      mode: "api" as const,
      summary: row.summary || `Registered from the estate scan, seen at ${signals.slice(0, 2).join(", ")}.`,
      rationale: "A system this enterprise runs that no vendor catalogue lists. What is worth reading out of it has not been modelled yet — that is the next conversation.",
      auth: "Not connected. Registering it only teaches the scan to recognise it.",
      produces: "connector" as const,
      scopes: [],
      signals,
      fingerprints: signals
        .filter((v) => v.includes("."))
        .map((host) => ({
          kind: "hostname" as const,
          pattern: `\\b${host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
          weight: 4,
          note: "a host registered for this source",
        })),
    };
  });
}
