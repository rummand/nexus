import type * as s from "@/db/schema";
import { parseAttributes } from "@/lib/graph";
import { allBlockers, deliveryOrder, type Dependency } from "./order";
import { project, settled } from "./project";
import type { ChangeSet } from "./types";

/**
 * Plateaus: named states of the estate, and the difference between two of them.
 *
 * A plateau is derived — the graph plus the change sets it includes, projected — so it cannot
 * drift from the model it describes. The valuable operation is not looking at one; it is
 * subtracting two, because "what changes between today and 2028" is the question the roadmap is
 * actually asked, and nobody can answer it by reading two pictures side by side.
 */

export interface Plateau {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  targetDate: string;
  createdAt: string;
  updatedAt: string;
  /** Change sets explicitly included. Blockers are added on write, not inferred here. */
  changeSetIds: string[];
}

export interface PlateauState {
  entities: s.Entity[];
  relations: s.Relation[];
  /** Included sets, in delivery order — the order they would actually land in. */
  order: string[];
  /**
   * Included plans whose blockers are missing from this plateau. Kept as a warning rather than
   * silently repaired on read: a state that includes a plan but not what it waits for cannot
   * exist, and the person should see which one is wrong.
   */
  incoherent: Array<{ changeSetId: string; missing: string[] }>;
  problems: Array<{ changeId: string; message: string }>;
}

/** The estate as it would stand at a plateau. */
export function plateauState(
  entities: s.Entity[],
  relations: s.Relation[],
  sets: ChangeSet[],
  deps: Dependency[],
  changeSetIds: string[],
): PlateauState {
  const included = new Set(changeSetIds);
  const byId = new Map(sets.map((set) => [set.id, set]));
  const incoherent: PlateauState["incoherent"] = [];
  for (const id of included) {
    const missing = allBlockers(id, deps).filter((b) => !included.has(b) && byId.get(b)?.status !== "delivered");
    if (missing.length) incoherent.push({ changeSetId: id, missing });
  }

  const members = [...included].map((id) => byId.get(id)).filter((set): set is ChangeSet => Boolean(set));
  const order = deliveryOrder(members, deps);
  const changes = order.flatMap((id) => byId.get(id)?.changes ?? []);
  const projection = project(entities, relations, changes);
  const state = settled(projection);
  return { entities: state.entities, relations: state.relations, order, incoherent, problems: projection.problems };
}

export interface AttributeChange {
  entity: s.Entity;
  key: string;
  before: string;
  after: string;
}

export interface GraphDiff {
  added: s.Entity[];
  removed: s.Entity[];
  renamed: Array<{ before: s.Entity; after: s.Entity }>;
  attributes: AttributeChange[];
  relationsAdded: s.Relation[];
  relationsRemoved: s.Relation[];
  summary: string;
}

/**
 * What changes between two states.
 *
 * Deliberately by entity id, not by name: renaming a system is a change *to* it, not a removal and
 * an arrival, and a diff that says otherwise would report every rationalisation as churn.
 */
export function diffStates(
  before: { entities: s.Entity[]; relations: s.Relation[] },
  after: { entities: s.Entity[]; relations: s.Relation[] },
): GraphDiff {
  const beforeById = new Map(before.entities.map((e) => [e.id, e]));
  const afterById = new Map(after.entities.map((e) => [e.id, e]));

  const added = after.entities.filter((e) => !beforeById.has(e.id));
  const removed = before.entities.filter((e) => !afterById.has(e.id));
  const renamed: GraphDiff["renamed"] = [];
  const attributes: AttributeChange[] = [];

  for (const [id, a] of afterById) {
    const b = beforeById.get(id);
    if (!b) continue;
    if (b.name !== a.name || b.kind !== a.kind) renamed.push({ before: b, after: a });
    const from = parseAttributes(b.attributes);
    const to = parseAttributes(a.attributes);
    for (const key of new Set([...Object.keys(from), ...Object.keys(to)])) {
      const was = from[key] ?? "";
      const now = to[key] ?? "";
      if (was !== now) attributes.push({ entity: a, key, before: was, after: now });
    }
  }

  const beforeRels = new Map(before.relations.map((r) => [r.id, r]));
  const afterRels = new Map(after.relations.map((r) => [r.id, r]));
  const relationsAdded = after.relations.filter((r) => !beforeRels.has(r.id));
  const relationsRemoved = before.relations.filter((r) => !afterRels.has(r.id));

  return { added, removed, renamed, attributes, relationsAdded, relationsRemoved, summary: describe(added.length, removed.length, renamed.length, attributes.length, relationsAdded.length, relationsRemoved.length) };
}

function describe(added: number, removed: number, renamed: number, attributes: number, relAdded: number, relRemoved: number): string {
  const parts: string[] = [];
  if (added) parts.push(`${added} arrive${added === 1 ? "s" : ""}`);
  if (removed) parts.push(`${removed} go${removed === 1 ? "es" : ""}`);
  if (renamed) parts.push(`${renamed} ${renamed === 1 ? "is" : "are"} renamed or retyped`);
  if (attributes) parts.push(`${attributes} attribute change${attributes === 1 ? "" : "s"}`);
  if (relAdded || relRemoved) parts.push(`${relAdded} connection${relAdded === 1 ? "" : "s"} made, ${relRemoved} severed`);
  return parts.length ? `${parts.join(", ")}.` : "Nothing changes between these two states.";
}
