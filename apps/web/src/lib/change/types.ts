import type * as s from "@/db/schema";

/**
 * Change sets: the model in time.
 *
 * Everything here is plain data over the graph rows, so the projection can be a pure function and
 * therefore testable, cheap to run per request, and impossible to get subtly wrong in a way that
 * writes to the database.
 */

export type ChangeOp = s.ChangeRow["op"];
export type ChangeSetStatus = s.ChangeSetRow["status"];

/** What each op carries. Parsed defensively at the read boundary — these rows outlive the code. */
export interface AddEntityPayload {
  kind: string;
  name: string;
  description?: string;
  attributes?: Record<string, string>;
}
export interface SetAttributePayload {
  key: string;
  value: string;
}
export interface AddRelationPayload {
  fromEntityId: string;
  toEntityId: string;
  kind: string;
}
/**
 * Move something in the hierarchy (§5.84).
 *
 * Containment is a column on the entity rather than a relation (§5.70), so a plan that says
 * "this capability moves under that one" cannot be written as `addRelation` — it needs an op of
 * its own. An empty `parentId` means the top level, which is a real destination and not a
 * missing value: "take this out of where it is" is one of the two moves people actually make.
 */
export interface SetParentPayload {
  parentId: string;
}
/**
 * Change what something *is*.
 *
 * The kind is a column too, for the same reason the parent is, and a re-read of a source that
 * has since typed its rows properly is a retype of two hundred objects. Written as its own op
 * rather than an attribute, because everything that reads the model — the meta-model, the
 * conformance checks, the layers — reads the column, not the attributes.
 */
export interface RetypeEntityPayload {
  kind: string;
}

export interface Change {
  id: string;
  op: ChangeOp;
  entityId: string | null;
  relationId: string | null;
  payload: Record<string, unknown>;
  note: string;
  createdAt: string;
}

export interface ChangeSet {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  status: ChangeSetStatus;
  /** ISO date (YYYY-MM-DD), or "" when undated. */
  targetDate: string;
  deliveredAt: string | null;
  /** The source system this branch belongs to, when it is one (§5.92). Empty otherwise. */
  sourceKey: string;
  /** The board that opened this branch by being drawn on (§5.100). Null otherwise. */
  boardId: string | null;
  createdAt: string;
  updatedAt: string;
  changes: Change[];
}

/** The graph a change set would leave behind, and which parts of it the change set moved. */
export interface Projection {
  entities: s.Entity[];
  relations: s.Relation[];
  /** Entity ids introduced by the change set — they do not exist in the graph yet. */
  added: Set<string>;
  /** Entity ids the change set retires. Still present in `entities` so a view can show them going. */
  retired: Set<string>;
  /** Entity ids whose attributes the change set alters. */
  changed: Set<string>;
  /** Entity ids the change set moves in the hierarchy. */
  moved: Set<string>;
  addedRelations: Set<string>;
  removedRelations: Set<string>;
  /**
   * Changes that no longer make sense — retiring something already gone, editing a deleted
   * entity, joining a system nobody has. A plan written last quarter goes stale, and saying so is
   * more useful than quietly skipping the line.
   */
  problems: Array<{ changeId: string; message: string }>;
}

/** A one-line count of what a change set does, for a list or a chip. */
export interface ChangeSummary {
  additions: number;
  retirements: number;
  attributeChanges: number;
  moves: number;
  newRelations: number;
  severedRelations: number;
  problems: number;
}

export function summarise(projection: Projection): ChangeSummary {
  return {
    additions: projection.added.size,
    retirements: projection.retired.size,
    attributeChanges: projection.changed.size,
    moves: projection.moved.size,
    newRelations: projection.addedRelations.size,
    severedRelations: projection.removedRelations.size,
    problems: projection.problems.length,
  };
}

/** Ops, in the order a human reads them, with the words the UI uses. */
export const OP_LABEL: Record<ChangeOp, string> = {
  addEntity: "Introduce",
  retireEntity: "Retire",
  setAttribute: "Change",
  setParent: "Move",
  retypeEntity: "Retype",
  addRelation: "Connect",
  removeRelation: "Disconnect",
};

export const STATUS_LABEL: Record<ChangeSetStatus, string> = {
  draft: "Draft",
  planned: "Planned",
  delivered: "Delivered",
  abandoned: "Abandoned",
};
