import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { INTAKE_RECORD_KINDS } from "./commit";
import type { Vocabulary } from "./extract";

/**
 * What the workspace already knows, so an extraction links instead of duplicating.
 *
 * Its own module rather than a private helper in the actions file, because import reads prose too
 * now (§5.38) and the alternative was exporting it from a "use server" module — which would turn a
 * lookup into something a browser could call.
 */
export async function vocabulary(workspaceId: string): Promise<Vocabulary> {
  const db = await getDb();
  const [entities, relations, declaredNodes, declaredRels] = await Promise.all([
    db.select({ id: s.entities.id, name: s.entities.name, kind: s.entities.kind }).from(s.entities).where(eq(s.entities.workspaceId, workspaceId)),
    db.select({ kind: s.relations_.kind }).from(s.relations_).where(eq(s.relations_.workspaceId, workspaceId)),
    db.select({ name: s.nodeTypes.name }).from(s.nodeTypes).where(eq(s.nodeTypes.workspaceId, workspaceId)),
    db.select({ name: s.relationTypes.name }).from(s.relationTypes).where(eq(s.relationTypes.workspaceId, workspaceId)),
  ]);
  const kinds = new Set<string>([...declaredNodes.map((n) => n.name), ...entities.map((e) => e.kind)].filter(Boolean));
  const relationKinds = new Set<string>([...declaredRels.map((r) => r.name), ...relations.map((r) => r.kind)].filter(Boolean));
  const records = new Set(INTAKE_RECORD_KINDS.map((k) => k.toLowerCase()));
  return {
    // What intake wrote is evidence, not vocabulary — see INTAKE_RECORD_KINDS.
    entities: entities.filter((e) => !records.has(e.kind.trim().toLowerCase())),
    kinds: [...kinds],
    relationKinds: [...relationKinds],
  };
}
