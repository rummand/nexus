// Generated from schema.ts by scripts/generate-pg-schema.mjs — do not edit by hand.
// Run `pnpm db:pg:schema` after changing the SQLite schema.

import { pgTable, text, integer, boolean, primaryKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

/**
 * Nexus data model v0.1 — see docs/BRIEF.md §5.4.
 *
 * Vocabulary (Miro-like): Workspace → Team / Space → Board.
 * The Postgres dialect, generated from the SQLite one. Same tables, same columns, same names.
 */

const timestamp = (name: string) =>
  text(name)
    .notNull()
    .default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  color: text("color").notNull().default("#6366f1"),
  createdAt: timestamp("created_at"),
});

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at"),
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "admin", "member", "guest"] })
      .notNull()
      .default("member"),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })],
);

export const teams = pgTable(
  "teams",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    color: text("color").notNull().default("#0ea5e9"),
    description: text("description").notNull().default(""),
    createdAt: timestamp("created_at"),
  },
  (t) => [index("teams_workspace_idx").on(t.workspaceId)],
);

export const teamMembers = pgTable(
  "team_members",
  {
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["lead", "member"] }).notNull().default("member"),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.userId] })],
);

export const spaces = pgTable(
  "spaces",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** Optional owning team. Null = workspace-level space. */
    teamId: text("team_id").references(() => teams.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    emoji: text("emoji").notNull().default("🗂️"),
    visibility: text("visibility", { enum: ["open", "private"] }).notNull().default("open"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [index("spaces_workspace_idx").on(t.workspaceId), index("spaces_team_idx").on(t.teamId)],
);

export const boards = pgTable(
  "boards",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    spaceId: text("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    /** Versioned canvas document, JSON-encoded. See src/canvas/document.ts. */
    document: text("document").notNull().default('{"version":1,"elements":{}}'),
    /**
     * Bumped on every save. A client sends the revision it loaded, and a save against a stale one
     * is refused rather than quietly overwriting somebody else's work. Whole-document writes are
     * merely wasteful; writing over a colleague is the thing that loses data.
     */
    revision: integer("revision").notNull().default(0),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
    lastOpenedAt: text("last_opened_at"),
  },
  (t) => [index("boards_space_idx").on(t.spaceId), index("boards_workspace_idx").on(t.workspaceId)],
);

export const boardFavorites = pgTable(
  "board_favorites",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.boardId] })],
);

// ---- knowledge graph ---------------------------------------------------------
//
// Entities and relations are workspace-wide. Cards on boards are *views* of entities
// (card.meta.entityId); connectors between entity-backed cards are views of relations
// (connector.meta.relationId). Boards sync into the graph on save; the graph hydrates
// cards on load. See docs/BRIEF.md §5.5.

export const entities = pgTable(
  "entities",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default(""),
    name: text("name").notNull().default(""),
    description: text("description").notNull().default(""),
    /** Free-form attributes, JSON-encoded. */
    attributes: text("attributes").notNull().default("{}"),
    /** Where the entity came from: canvas, import:<name>, connector:<name> … */
    source: text("source").notNull().default("canvas"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [index("entities_workspace_idx").on(t.workspaceId), index("entities_kind_idx").on(t.workspaceId, t.kind)],
);

export const relations_ = pgTable(
  "relations",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    fromEntityId: text("from_entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    toEntityId: text("to_entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default(""),
    attributes: text("attributes").notNull().default("{}"),
    source: text("source").notNull().default("canvas"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [index("relations_workspace_idx").on(t.workspaceId), index("relations_from_idx").on(t.fromEntityId), index("relations_to_idx").on(t.toEntityId)],
);

/** Which entities appear on which boards (rebuilt on every board save). */
export const boardEntities = pgTable(
  "board_entities",
  {
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    entityId: text("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    elementId: text("element_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.boardId, t.entityId, t.elementId] }), index("board_entities_entity_idx").on(t.entityId)],
);

/** Board checkpoints: automatic (time-based while editing), manual, or taken before a restore. */
export const boardVersions = pgTable(
  "board_versions",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    label: text("label").notNull().default(""),
    reason: text("reason", { enum: ["auto", "manual", "restore"] }).notNull().default("auto"),
    document: text("document").notNull(),
    objectCount: integer("object_count").notNull().default(0),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at"),
  },
  (t) => [index("board_versions_board_idx").on(t.boardId, t.createdAt)],
);

/** Remembered decisions on agent proposals (dismissed / accepted), keyed by proposal key. */
export const agentDecisions = pgTable(
  "agent_decisions",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    decision: text("decision", { enum: ["accepted", "dismissed"] }).notNull(),
    createdAt: timestamp("created_at"),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.key] })],
);

/**
 * Proposals a model made about the graph, kept until somebody decides on them.
 *
 * The rule-derived proposals in `src/lib/proposals.ts` are recomputed on every page load because
 * they are cheap and deterministic. A model's are neither: asking costs money and a second or two,
 * and asking twice can give two different answers. So the answer is written down, reviewed at
 * leisure, and — once accepted or dismissed — deleted, with the decision remembered in
 * `agent_decisions` under the same key so a later run cannot raise it again.
 */
export const agentProposals = pgTable(
  "agent_proposals",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** Stable across runs, derived from the change proposed — see src/lib/agent/validate.ts. */
    key: text("key").notNull(),
    type: text("type").notNull(),
    confidence: text("confidence", { enum: ["high", "medium", "low"] }).notNull(),
    title: text("title").notNull(),
    detail: text("detail").notNull(),
    /** JSON array of entity ids. */
    entityIds: text("entity_ids").notNull().default("[]"),
    /** JSON ProposalAction — the only thing accepting it can do. */
    action: text("action").notNull(),
    /** JSON array: the words in the graph that justify it, quoted. */
    evidence: text("evidence").notNull().default("[]"),
    /** JSON array: the practice from the knowledge base the run was grounded in. */
    grounded: text("grounded").notNull().default("[]"),
    createdAt: timestamp("created_at"),
  },
  (t) => [uniqueIndex("agent_proposals_key_idx").on(t.workspaceId, t.key)],
);

/**
 * What happened to what an agent said.
 *
 * Remarks themselves live in the board document (§5.27) — they are annotations on a drawing. What
 * does not belong there is the record of how a person answered them, because that record has to
 * outlive both the remark and the agent: the useful question is "is this agent worth having", and
 * an agent whose remarks are dismissed nine times in ten should say so rather than keep talking.
 * The agent's name is copied in so a deleted agent still has a history.
 */
export const agentRemarkOutcomes = pgTable(
  "agent_remark_outcomes",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    boardId: text("board_id").references(() => boards.id, { onDelete: "cascade" }),
    /** The agent element's id on its board. */
    agentElementId: text("agent_element_id").notNull(),
    agentName: text("agent_name").notNull().default(""),
    /** kept — turned into a note by a person; dismissed — waved away. */
    outcome: text("outcome", { enum: ["kept", "dismissed"] }).notNull(),
    createdAt: timestamp("created_at"),
  },
  (t) => [index("agent_outcomes_workspace_idx").on(t.workspaceId, t.agentElementId)],
);

// ---- intake ----------------------------------------------------------------
// Unconsolidated data arrives as a *source*: an uploaded transcript, a pasted document, a
// connector sync. A source is kept whole and raw, because an extraction is only arguable if the
// text that produced it is still there to argue with. Running the pipeline over a source
// produces a *run*, whose report and staged objects are stored as JSON — the shapes belong to
// src/lib/intake, and pinning them into columns would freeze an extractor that is meant to keep
// getting better.

export const sources = pgTable(
  "sources",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** transcript | document | table | connector — see src/lib/intake/types.ts */
    kind: text("kind").notNull().default("document"),
    /** Which connector it came through (see src/lib/intake/connectors.ts). */
    connector: text("connector").notNull().default("notes"),
    /** The raw text, kept so an extraction can always be traced back to its words. */
    text: text("text").notNull().default(""),
    characters: integer("characters").notNull().default(0),
    /** new → extracted → committed. */
    status: text("status", { enum: ["new", "extracted", "committed"] }).notNull().default("new"),
    /** The source's own node in the graph, once committed: a meeting is an object too. */
    entityId: text("entity_id").references(() => entities.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [index("sources_workspace_idx").on(t.workspaceId, t.createdAt)],
);

/** One pass of the pipeline over one source. The newest run of a source is the current one. */
export const sourceRuns = pgTable(
  "source_runs",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    /** The whole Extraction, JSON-encoded: stages, passages, candidates, relations, viewpoints. */
    extraction: text("extraction").notNull(),
    candidateCount: integer("candidate_count").notNull().default(0),
    relationCount: integer("relation_count").notNull().default(0),
    viewpointCount: integer("viewpoint_count").notNull().default(0),
    /** Objects actually written to the graph from this run. */
    committedCount: integer("committed_count").notNull().default(0),
    ms: integer("ms").notNull().default(0),
    createdAt: timestamp("created_at"),
  },
  (t) => [index("source_runs_source_idx").on(t.sourceId, t.createdAt)],
);

export type Source = typeof sources.$inferSelect;
export type SourceRun = typeof sourceRuns.$inferSelect;

// ---- model providers -------------------------------------------------------
// Where the thinking happens, as rows rather than environment variables: an organisation can point
// Nexus at Anthropic, at OpenAI, at its own gateway or at a model on its own hardware, per job,
// without a redeploy. The key is encrypted when NEXUS_SECRET_KEY is set and stored as it is when it
// is not — with `key_encrypted` recording which, because telling somebody their keys are protected
// when they are not is worse than not protecting them.

export const modelProviders = pgTable(
  "model_providers",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** How to talk to it: anthropic | openai. Not who sells it — everything else speaks one of these. */
    dialect: text("dialect", { enum: ["anthropic", "openai"] }).notNull().default("anthropic"),
    baseUrl: text("base_url").notNull().default(""),
    model: text("model").notNull().default(""),
    apiKey: text("api_key").notNull().default(""),
    keyEncrypted: boolean("key_encrypted").notNull().default(false),
    enabled: boolean("enabled").notNull().default(true),
    /** What a probe last found: unknown | ok | unauthorised | unreachable. */
    status: text("status").notNull().default("unknown"),
    statusDetail: text("status_detail").notNull().default(""),
    checkedAt: text("checked_at"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [index("model_providers_workspace_idx").on(t.workspaceId)],
);

/** Which provider does which job. A task with no row falls back to the first enabled provider. */
export const modelTasks = pgTable(
  "model_tasks",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** compose | intake | graph agent | board agent — see src/lib/models/types.ts */
    task: text("task").notNull(),
    providerId: text("provider_id").references(() => modelProviders.id, { onDelete: "cascade" }),
    /** Overrides the provider's own model, for using one endpoint at two sizes. */
    model: text("model").notNull().default(""),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.task] })],
);

export type ModelProviderRow = typeof modelProviders.$inferSelect;
export type ModelTaskRow = typeof modelTasks.$inferSelect;

// ---- the landing zone ------------------------------------------------------
// Files arrive as a *batch*: a ServiceNow export, an old spreadsheet, a Word document from a
// governance review. Nothing they say is true until somebody approves it, so the whole staged
// review lives here as JSON — the shapes belong to src/lib/apm and pinning them into columns would
// freeze a pipeline meant to keep learning what a bad export looks like.

export const importBatches = pgTable(
  "import_batches",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** staged → approved → rolled back. A batch is never deleted; the record of it is the audit. */
    status: text("status", { enum: ["staged", "approved", "rolled back"] }).notNull().default("staged"),
    /** The files as read: name, format, the proposed mapping, and their rows. */
    files: text("files").notNull().default("[]"),
    /** The staged records and every decision taken about them, as JSON. */
    review: text("review").notNull().default("{}"),
    /**
     * What approving it actually wrote, and the values it wrote over — the only thing that makes
     * an honest rollback possible. Empty until it is approved.
     */
    written: text("written").notNull().default("{}"),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    approvedById: text("approved_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
    approvedAt: text("approved_at"),
  },
  (t) => [index("import_batches_workspace_idx").on(t.workspaceId, t.createdAt)],
);

export type ImportBatch = typeof importBatches.$inferSelect;

// ---- source catalogue ------------------------------------------------------
// A connection is the *decision* about a source system, not a live session: an agent proposed it
// (or a human picked it from the catalogue), and a human granted, declined or revoked it. The
// grant is a set of scope paths — "sap/pm/equi", never "sap" — because the unit of consent is a
// module or an object, not a system. See src/lib/catalog.

export const connections = pgTable(
  "connections",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** Catalogue provider id, e.g. "sap" (src/lib/catalog/providers.ts). */
    providerId: text("provider_id").notNull(),
    /** proposed → granted → (revoked); declined ends it. */
    status: text("status", { enum: ["proposed", "granted", "declined", "revoked"] }).notNull().default("proposed"),
    /** Who raised it: the discovery agent, or a person browsing the catalogue. */
    origin: text("origin", { enum: ["agent", "human"] }).notNull().default("human"),
    /** The agent's case at the time of proposing, JSON-encoded, kept as the record of why. */
    evidence: text("evidence").notNull().default("[]"),
    reason: text("reason").notNull().default(""),
    /** Free text a human added when granting or declining. */
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [uniqueIndex("connections_provider_idx").on(t.workspaceId, t.providerId)],
);

/** One granted scope path. Absence is refusal — there is no "denied" row. */
export const connectionScopes = pgTable(
  "connection_scopes",
  {
    connectionId: text("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    createdAt: timestamp("created_at"),
  },
  (t) => [primaryKey({ columns: [t.connectionId, t.path] })],
);

export type Connection = typeof connections.$inferSelect;
export type ConnectionScope = typeof connectionScopes.$inferSelect;

/**
 * Sources this enterprise has that no vendor catalogue contains — the in-house scheduler, the
 * acquired company's portal, the box in the control room. Registering one adds it to the
 * catalogue for this workspace, so the next scan recognises it instead of listing it as unknown.
 * The catalogue grows to fit the estate, not the other way round.
 */
export const catalogEntries = pgTable(
  "catalog_entries",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    vendor: text("vendor").notNull().default(""),
    category: text("category").notNull().default("systems"),
    summary: text("summary").notNull().default(""),
    /** Hostnames and names that identify it, JSON-encoded. */
    signals: text("signals").notNull().default("[]"),
    createdAt: timestamp("created_at"),
  },
  (t) => [uniqueIndex("catalog_entries_name_idx").on(t.workspaceId, t.name)],
);

export type CatalogEntry = typeof catalogEntries.$inferSelect;

// ---- relations -------------------------------------------------------------

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(workspaceMembers),
  teams: many(teams),
  spaces: many(spaces),
  boards: many(boards),
  entities: many(entities),
}));

export const entitiesRelations = relations(entities, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [entities.workspaceId], references: [workspaces.id] }),
  boards: many(boardEntities),
}));

export const relationsRelations = relations(relations_, ({ one }) => ({
  from: one(entities, { fields: [relations_.fromEntityId], references: [entities.id], relationName: "from" }),
  to: one(entities, { fields: [relations_.toEntityId], references: [entities.id], relationName: "to" }),
}));

export const boardEntitiesRelations = relations(boardEntities, ({ one }) => ({
  board: one(boards, { fields: [boardEntities.boardId], references: [boards.id] }),
  entity: one(entities, { fields: [boardEntities.entityId], references: [entities.id] }),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [teams.workspaceId], references: [workspaces.id] }),
  members: many(teamMembers),
  spaces: many(spaces),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, { fields: [workspaceMembers.workspaceId], references: [workspaces.id] }),
  user: one(users, { fields: [workspaceMembers.userId], references: [users.id] }),
}));

export const spacesRelations = relations(spaces, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [spaces.workspaceId], references: [workspaces.id] }),
  team: one(teams, { fields: [spaces.teamId], references: [teams.id] }),
  boards: many(boards),
}));

export const boardsRelations = relations(boards, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [boards.workspaceId], references: [workspaces.id] }),
  space: one(spaces, { fields: [boards.spaceId], references: [spaces.id] }),
  createdBy: one(users, { fields: [boards.createdById], references: [users.id] }),
  favorites: many(boardFavorites),
}));

export const boardFavoritesRelations = relations(boardFavorites, ({ one }) => ({
  board: one(boards, { fields: [boardFavorites.boardId], references: [boards.id] }),
  user: one(users, { fields: [boardFavorites.userId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Space = typeof spaces.$inferSelect;
export type Board = typeof boards.$inferSelect;
export type Entity = typeof entities.$inferSelect;
export type Relation = typeof relations_.$inferSelect;
export type BoardVersion = typeof boardVersions.$inferSelect;
export type AgentProposalRow = typeof agentProposals.$inferSelect;
export type AgentRemarkOutcomeRow = typeof agentRemarkOutcomes.$inferSelect;

// ---- meta-model ------------------------------------------------------------------------------
// The meta-model is *emergent*: kinds, relation types and attribute keys are derived from the
// entities and relations themselves (see lib/metamodel.ts). These tables let a modeller also
// *declare* it — name a type before any instance exists, describe it, fix its field list, and
// constrain which types may connect. The view merges both, so drift between what was declared
// and what the data actually contains is visible rather than hidden.

/** A declared node (object) type. Matched to entities by `name` = entities.kind. */
export const nodeTypes = pgTable(
  "node_types",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    color: text("color").notNull().default(""),
    /** Optional parent type, so the modeller can build a hierarchy (Application ⊂ IT Component). */
    parentId: text("parent_id"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [index("node_types_workspace_idx").on(t.workspaceId), uniqueIndex("node_types_name_idx").on(t.workspaceId, t.name)],
);

/** A field declared on a node type — the schema half of the emergent attribute keys. */
export const nodeTypeFields = pgTable(
  "node_type_fields",
  {
    id: text("id").primaryKey(),
    nodeTypeId: text("node_type_id")
      .notNull()
      .references(() => nodeTypes.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    /** text | number | date | boolean | enum — advisory today, enforced later. */
    dataType: text("data_type").notNull().default("text"),
    description: text("description").notNull().default(""),
    required: boolean("required").notNull().default(false),
    /** Allowed values for `enum`, JSON-encoded array. */
    options: text("options").notNull().default("[]"),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("node_type_fields_type_idx").on(t.nodeTypeId), uniqueIndex("node_type_fields_key_idx").on(t.nodeTypeId, t.key)],
);

/** A declared relation (reference) type. Matched to relations by `name` = relations.kind. */
export const relationTypes = pgTable(
  "relation_types",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [index("relation_types_workspace_idx").on(t.workspaceId), uniqueIndex("relation_types_name_idx").on(t.workspaceId, t.name)],
);

/** "Application —depends on→ Application": which node types a relation type may join. */
export const relationRules = pgTable(
  "relation_rules",
  {
    id: text("id").primaryKey(),
    relationTypeId: text("relation_type_id")
      .notNull()
      .references(() => relationTypes.id, { onDelete: "cascade" }),
    /** Node type *names*, so a rule can reference an emergent kind that was never declared. */
    fromType: text("from_type").notNull(),
    toType: text("to_type").notNull(),
    /** one-to-one | one-to-many | many-to-many — advisory today. */
    cardinality: text("cardinality").notNull().default("many-to-many"),
  },
  (t) => [index("relation_rules_type_idx").on(t.relationTypeId)],
);

export type NodeType = typeof nodeTypes.$inferSelect;
export type NodeTypeField = typeof nodeTypeFields.$inferSelect;
export type RelationType = typeof relationTypes.$inferSelect;
export type RelationRule = typeof relationRules.$inferSelect;

// ---- change sets: the model in time ----------------------------------------
// The graph is the estate as it is. A *change set* is a named, dated set of intentions about it —
// what will be introduced, what will be retired, what will change hands — and it is deliberately
// **not** applied to the graph. It projects a to-be view instead (src/lib/change/project.ts).
//
// That separation is the whole design. As-is stays true, so health, impact and provenance keep
// meaning what they said; to-be is free to be speculative, contradictory and wrong, which is what
// planning actually is. A change set only touches the graph when somebody delivers it.

export const changeSets = pgTable(
  "change_sets",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull().default(""),
    description: text("description").notNull().default(""),
    /** draft: still being written. planned: agreed. delivered: applied to the graph. abandoned: kept, not happening. */
    status: text("status", { enum: ["draft", "planned", "delivered", "abandoned"] }).notNull().default("draft"),
    /** When it is meant to land: an ISO date (YYYY-MM-DD), or "" for undated. */
    targetDate: text("target_date").notNull().default(""),
    /** Set when the change set was applied to the graph; the graph moved at this moment. */
    deliveredAt: text("delivered_at"),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [index("change_sets_workspace_idx").on(t.workspaceId, t.targetDate)],
);

export const changes = pgTable(
  "changes",
  {
    id: text("id").primaryKey(),
    changeSetId: text("change_set_id")
      .notNull()
      .references(() => changeSets.id, { onDelete: "cascade" }),
    op: text("op", { enum: ["addEntity", "retireEntity", "setAttribute", "addRelation", "removeRelation"] }).notNull(),
    /**
     * The entity this change is about. For `addEntity` the id is minted when the change is
     * written, before the entity exists — the same trick the canvas uses, and what lets a new
     * relation in the same change set point at a system that has not been built yet.
     */
    entityId: text("entity_id"),
    relationId: text("relation_id"),
    /** Operands: the new entity's fields, the attribute key/value, the relation's ends. */
    payload: text("payload").notNull().default("{}"),
    /** Why. A change nobody can explain is one nobody can review. */
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at"),
  },
  (t) => [index("changes_set_idx").on(t.changeSetId), index("changes_entity_idx").on(t.entityId)],
);

export type ChangeSetRow = typeof changeSets.$inferSelect;
export type ChangeRow = typeof changes.$inferSelect;

/**
 * "This cannot happen until that lands."
 *
 * A dependency is a real thing in a roadmap, not a comment: the streaming plan is only coherent
 * after the platform plan delivers the thing it streams into. Modelling it lets three things be
 * true — delivery is refused while a blocker is outstanding, a plan is projected in the context of
 * what it waits for (so a sequenced plan stops reading as stale), and a dependent scheduled before
 * its blocker can be told it is scheduled backwards.
 *
 * `changeSetId` is the dependent; `dependsOnId` is the blocker. Cycles are refused when the edge
 * is written, so every read can assume the graph is acyclic.
 */
export const changeSetDependencies = pgTable(
  "change_set_dependencies",
  {
    changeSetId: text("change_set_id")
      .notNull()
      .references(() => changeSets.id, { onDelete: "cascade" }),
    dependsOnId: text("depends_on_id")
      .notNull()
      .references(() => changeSets.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at"),
  },
  (t) => [primaryKey({ columns: [t.changeSetId, t.dependsOnId] }), index("change_set_deps_blocker_idx").on(t.dependsOnId)],
);

export type ChangeSetDependencyRow = typeof changeSetDependencies.$inferSelect;

/**
 * A plateau: a named, dated state of the estate.
 *
 * The word is TOGAF's and the idea is the one thing a list of change sets does not give you — a
 * state somebody can name, point at and argue with. "Target Architecture 2028" is a thing people
 * talk about in meetings; until it is an object in the tool it lives in a slide.
 *
 * A plateau is *derived*, not stored: its content is the graph plus the change sets it includes,
 * projected. Nothing about the estate is duplicated here, so a plateau cannot drift from the model
 * it describes — which is exactly what happens to the slide.
 */
export const plateaus = pgTable(
  "plateaus",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull().default(""),
    description: text("description").notNull().default(""),
    /** When this state is meant to hold. ISO date, or "" for a state with no date yet. */
    targetDate: text("target_date").notNull().default(""),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [index("plateaus_workspace_idx").on(t.workspaceId, t.targetDate)],
);

/**
 * Which change sets are complete at a plateau.
 *
 * Explicit rather than "everything dated before it": two plateaus can share a date, a plan can be
 * deliberately excluded from one branch of the roadmap, and a membership you can see is a
 * membership you can argue with. Blockers are pulled in with their dependents, because a state
 * that includes a plan but not what it waits for is not a state that can exist.
 */
export const plateauChangeSets = pgTable(
  "plateau_change_sets",
  {
    plateauId: text("plateau_id")
      .notNull()
      .references(() => plateaus.id, { onDelete: "cascade" }),
    changeSetId: text("change_set_id")
      .notNull()
      .references(() => changeSets.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at"),
  },
  (t) => [primaryKey({ columns: [t.plateauId, t.changeSetId] }), index("plateau_change_sets_set_idx").on(t.changeSetId)],
);

export type PlateauRow = typeof plateaus.$inferSelect;
