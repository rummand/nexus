/** Client-safe shapes for the knowledge graph API. */

export interface EntitySummary {
  id: string;
  kind: string;
  name: string;
  description: string;
  source: string;
  updatedAt: string;
  boardCount: number;
  relationCount: number;
  boards: Array<{ id: string; name: string }>;
}

export interface KindSummary {
  kind: string;
  count: number;
  color: string;
}

export interface RelationKindSummary {
  kind: string;
  count: number;
}

export interface GraphSnapshot {
  entities: EntitySummary[];
  kinds: KindSummary[];
  relationKinds: RelationKindSummary[];
}

export interface EntityDetail {
  entity: { id: string; kind: string; name: string; description: string; source: string; updatedAt: string };
  boards: Array<{ id: string; name: string; spaceName: string }>;
  relations: Array<{ id: string; kind: string; direction: "out" | "in"; other: { id: string; name: string; kind: string } }>;
  /** Other entities with the same name — candidates for a merge. */
  duplicates: Array<{ id: string; kind: string; name: string; description: string }>;
}

export type ProposalType = "merge" | "kind" | "untyped" | "relation" | "orphan";

export type ProposalAction =
  | { kind: "merge"; survivorId: string; otherIds: string[] }
  | { kind: "renameKind"; from: string; to: string }
  | { kind: "setKind"; entityId: string; to: string }
  | { kind: "setRelationKind"; relationId: string; to: string }
  | { kind: "deleteEntity"; entityId: string };

export interface Proposal {
  key: string;
  type: ProposalType;
  confidence: "high" | "medium" | "low";
  title: string;
  detail: string;
  entityIds: string[];
  action: ProposalAction;
  evidence?: string[];
}

export interface ImportPayload {
  entities: Array<{ kind: string; name: string; description?: string }>;
  relations: Array<{ from: string; kind: string; to: string }>;
}

export interface ImportResult {
  entitiesCreated: number;
  entitiesUpdated: number;
  relationsCreated: number;
  skipped: string[];
}

export const ENTITY_ID_PREFIX = "ent_";
export const RELATION_ID_PREFIX = "rel_";

export function isEntityId(v: unknown): v is string {
  return typeof v === "string" && v.startsWith(ENTITY_ID_PREFIX);
}
export function isRelationId(v: unknown): v is string {
  return typeof v === "string" && v.startsWith(RELATION_ID_PREFIX);
}

export interface NeighborhoodRequest {
  workspaceId: string;
  entityIds: string[];
  depth: number;
  direction: "both" | "out" | "in";
  relationKinds?: string[];
}

export interface NeighborhoodResponse {
  entities: Array<{ id: string; kind: string; name: string; description: string }>;
  relations: Array<{ id: string; fromEntityId: string; toEntityId: string; kind: string }>;
}
