/** Client-safe shapes for the knowledge graph API. */

export interface EntitySummary {
  id: string;
  kind: string;
  name: string;
  description: string;
  attributes: Record<string, string>;
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
  /** Emergent attribute schema: keys used by entities of this kind, with usage counts. */
  attributeKeys: Array<{ key: string; count: number; sample: string }>;
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
  entity: { id: string; kind: string; name: string; description: string; attributes: Record<string, string>; source: string; updatedAt: string };
  /** Attribute keys other entities of the same kind use (for suggestions). */
  kindAttributeKeys: string[];
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
  entities: Array<{ kind: string; name: string; description?: string; attributes?: Record<string, string> }>;
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
  entities: Array<{ id: string; kind: string; name: string; description: string; attributes: Record<string, string> }>;
  relations: Array<{ id: string; fromEntityId: string; toEntityId: string; kind: string }>;
}

/** Structured graph query (deterministic precursor to natural-language questions). */
export interface ParsedQuery {
  text: string[];
  kinds: string[];
  attributes: Array<{ key: string; value: string }>;
  related: Array<{ name: string; direction: "both" | "out" | "in"; relationKind?: string }>;
  relationKinds: string[];
  /** true when at least one structured clause was used */
  structured: boolean;
}

export interface QueryResultEntity {
  id: string;
  kind: string;
  name: string;
  description: string;
  attributes: Record<string, string>;
  boards: Array<{ id: string; name: string }>;
  /** Why this entity matched (short, human-readable). */
  why: string;
}

export interface QueryResponse {
  query: ParsedQuery;
  explanation: string;
  entities: QueryResultEntity[];
  total: number;
}
