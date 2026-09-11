import "server-only";
import type { Db } from "@/db/client";
import type * as s from "@/db/schema";
import { parseAttributes } from "@/lib/graph";
import { metaModel } from "@/lib/metamodel";
import { graphRows, getChangeSet } from "@/lib/change/read";
import { project } from "@/lib/change/project";
import { runChecks, type CheckInput, type CheckRun, type RelationRow } from "./suite";
import type { EntityLike } from "@/lib/metamodel-conformance";

/**
 * Running the suite against a ref (§5.83).
 *
 * The database half of #136, kept apart from the checks themselves so the checks stay pure and
 * testable. Everything here is shape conversion and one decision: a change set is checked
 * against its *projection*, the graph it would leave behind, which is the same in-memory
 * projection the canvas overlay and the roadmap already use. There is no second implementation
 * of "what this plan would do".
 */

function snapshot(entities: s.Entity[], relations: s.Relation[]): Omit<CheckInput, "model"> {
  const byId = new Map(entities.map((e) => [e.id, e]));
  const named: EntityLike[] = entities.map((e) => ({
    id: e.id, kind: e.kind, name: e.name, attributes: parseAttributes(e.attributes),
  }));
  const rows: RelationRow[] = relations.map((r) => ({
    id: r.id,
    kind: r.kind,
    fromKind: byId.get(r.fromEntityId)?.kind ?? "",
    toKind: byId.get(r.toEntityId)?.kind ?? "",
    fromName: byId.get(r.fromEntityId)?.name ?? "",
    toName: byId.get(r.toEntityId)?.name ?? "",
    fromEntityId: r.fromEntityId,
    toEntityId: r.toEntityId,
  }));
  /*
   * Containment lives on the entity as a column, not as a relation (§5.70). The projection
   * carries it, and since §5.84 a change set can move something in the tree, so these are the
   * parents *as the ref leaves them* rather than as the rows stand.
   */
  const parents = new Map<string, string | null>(entities.map((e) => [e.id, e.parentId ?? null]));
  return { entities: named, relations: rows, parents };
}

export interface RefChecks {
  /** The run against the ref itself. */
  head: CheckRun;
  /** The run against `main`, so the difference can be the verdict. Identical to `head` on main. */
  base: CheckRun;
  onMain: boolean;
}

export async function checksForRef(db: Db, workspaceId: string, changeSetId: string | null): Promise<RefChecks> {
  const [model, rows] = await Promise.all([metaModel(db, workspaceId), graphRows(db, workspaceId)]);
  const base = runChecks({ model, ...snapshot(rows.entities, rows.relations) });
  if (!changeSetId) return { head: base, base, onMain: true };

  const set = await getChangeSet(db, changeSetId);
  if (!set || set.workspaceId !== workspaceId) return { head: base, base, onMain: true };

  const projected = project(rows.entities, rows.relations, set.changes);
  const head = runChecks({ model, ...snapshot(projected.entities, projected.relations) });
  return { head, base, onMain: false };
}
