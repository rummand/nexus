import { sqliteTable, text, integer, primaryKey, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

/**
 * Nexus data model v0.1 — see docs/BRIEF.md §5.4.
 *
 * Vocabulary (Miro-like): Workspace → Team / Space → Board.
 * Written for SQLite in development; kept Postgres-portable (text ids, ISO timestamps,
 * JSON stored as text) so the SaaS target is a dialect switch, not a redesign.
 */

const timestamp = (name: string) =>
  text(name)
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  color: text("color").notNull().default("#6366f1"),
  /**
   * Nullable on purpose (§5.41): a person who will arrive through an identity provider, or one
   * who has been invited but has not chosen a password yet, is a real row with no way to sign in
   * by password. `verifyPassword` treats null as "no".
   */
  passwordHash: text("password_hash"),
  /**
   * Above the workspace: who runs the deployment itself (§5.64).
   *
   * Null for everybody normal. `workspace_members.role` answers "what may you do *here*", and no
   * value of it can answer "may you create a tenant, or see that this tenant exists at all" —
   * those questions are not about a workspace, so they cannot be a workspace capability. Kept as
   * a nullable column rather than a second table because it is one fact about a person, and as
   * text rather than a flag because "operator" will not be the last value.
   */
  platformRole: text("platform_role", { enum: ["operator"] }),
  /**
   * When this person last read the digest of what happened while they were away (§5.42).
   *
   * Not "last signed in": the question the digest answers is "what have I not seen yet", and
   * somebody who signs in on a phone at the weekend without reading it has not seen it.
   */
  lastDigestAt: text("last_digest_at"),
  createdAt: timestamp("created_at"),
});

/**
 * Signed-in sessions (§5.41).
 *
 * A table rather than a self-describing signed cookie, for one reason: revocation. "Sign out
 * everywhere" and "that laptop was stolen" both have to be able to end a session before it
 * expires, and a stateless token cannot be taken back. The id *is* the secret — a long random
 * string, stored hashed, so a leaked database does not hand somebody a working cookie.
 */
export const sessions = sqliteTable(
  "sessions",
  {
    /** SHA-256 of the token in the cookie. The token itself is never written down. */
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at"),
    expiresAt: text("expires_at").notNull(),
    /** Enough to recognise a session in a list, never enough to identify a person elsewhere. */
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at"),
});

export const workspaceMembers = sqliteTable(
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

export const teams = sqliteTable(
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

export const teamMembers = sqliteTable(
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

export const spaces = sqliteTable(
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

export const boards = sqliteTable(
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

export const boardFavorites = sqliteTable(
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

export const entities = sqliteTable(
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
    /**
     * The entity this one sits inside (§5.70). Null for a root.
     *
     * Containment is not an ordinary relation and modelling it as one loses the two things it
     * is for: a capability is *part of* its parent, so counts roll up through it, and a thing
     * has exactly one parent, so the structure is a tree that can be walked. No foreign key —
     * a self-reference here would cascade a delete through a whole subtree, and orphaning the
     * children of a deleted parent is the survivable failure. `reparentOrphans` handles it.
     */
    parentId: text("parent_id"),
    /** Where the entity came from: canvas, import:<name>, connector:<name> … */
    source: text("source").notNull().default("canvas"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [
    index("entities_workspace_idx").on(t.workspaceId),
    index("entities_kind_idx").on(t.workspaceId, t.kind),
    index("entities_parent_idx").on(t.parentId),
  ],
);

export const relations_ = sqliteTable(
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
export const boardEntities = sqliteTable(
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
export const boardVersions = sqliteTable(
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
export const agentDecisions = sqliteTable(
  "agent_decisions",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    decision: text("decision", { enum: ["accepted", "dismissed"] }).notNull(),
    /** Copied off the proposal being decided, so an agent's acceptance survives the proposal. */
    agentId: text("agent_id"),
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
export const agentProposals = sqliteTable(
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
    /** Which described agent proposed it, and in which run — so acceptance is measurable per agent. */
    agentId: text("agent_id"),
    runId: text("run_id"),
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
export const agentRemarkOutcomes = sqliteTable(
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

export const sources = sqliteTable(
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
export const sourceRuns = sqliteTable(
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

export const modelProviders = sqliteTable(
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
    keyEncrypted: integer("key_encrypted", { mode: "boolean" }).notNull().default(false),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    /**
     * Who set this up (§5.46).
     *
     * A workspace was the only tenant boundary there was, so a key, a provider and a batch each
     * belonged to an organisation and to nobody in particular — there was no answer to "who issued
     * this" or "whose account is this spending". `set null` rather than cascade: the row is a fact
     * about the workspace and outlives the person who made it.
     */
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
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
export const modelTasks = sqliteTable(
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


// ---- described agents ------------------------------------------------------
// An agent stops being a hand-written module and becomes a row somebody can read: what it is for,
// who owns it, what it may read, what it may propose, what it may spend, and whether it is allowed
// to speak yet. Everything here exists so "what is this thing allowed to do" is answerable from a
// screen rather than from the source.

export const agentDefinitions = sqliteTable(
  "agent_definitions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** One sentence a person can judge it against. It is also the instruction the model gets. */
    purpose: text("purpose").notNull().default(""),
    /** Who is answerable for it. An agent nobody owns is nobody's to switch off. */
    ownerTeamId: text("owner_team_id").references(() => teams.id, { onDelete: "set null" }),
    /** A graph query (lib/query.ts): what it may read. Never "everything" by default. */
    scope: text("scope").notNull().default(""),
    /** JSON array of verbs from the closed list of five. */
    verbs: text("verbs").notNull().default("[]"),
    /** Which knowledge-base scope grounds it, or "" for none. */
    grounding: text("grounding").notNull().default(""),
    providerId: text("provider_id").references(() => modelProviders.id, { onDelete: "set null" }),
    model: text("model").notNull().default(""),
    trigger: text("trigger").notNull().default("manual"),
    /** JSON { runsPerDay, maxProposals } — enforced before the model is called. */
    budget: text("budget").notNull().default("{}"),
    /** draft (dry run) | active | paused | retired. */
    status: text("status").notNull().default("draft"),
    /** The definition that proposed this one, when an agent wrote it. */
    parentId: text("parent_id"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [index("agent_definitions_workspace_idx").on(t.workspaceId)],
);

/**
 * One row per run, whatever the outcome.
 *
 * The run log is what makes a fleet governable: it is the only place that can answer what an agent
 * has cost, what it has said, how much of that survived validation and how much of *that* a person
 * kept. A failed run is written too — an agent that has failed eleven times is a fact somebody
 * needs, and a log that only records successes is a log that flatters.
 */
export const agentRuns = sqliteTable(
  "agent_runs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    agentId: text("agent_id").references(() => agentDefinitions.id, { onDelete: "cascade" }),
    /** Copied so a deleted agent still has a legible history. */
    agentName: text("agent_name").notNull().default(""),
    trigger: text("trigger").notNull().default("manual"),
    /** ok | failed | refused (a budget or a status stopped it before it cost anything). */
    outcome: text("outcome").notNull().default("ok"),
    /** True when nothing reached the review queue because the agent is a draft. */
    dryRun: integer("dry_run", { mode: "boolean" }).notNull().default(false),
    /** What it was pointed at, and how much of it there was. */
    scope: text("scope").notNull().default(""),
    objectsRead: integer("objects_read").notNull().default(0),
    proposed: integer("proposed").notNull().default(0),
    /** Claims validation threw away — the honest count, not a hidden one. */
    rejected: integer("rejected").notNull().default(0),
    /** JSON array of the reasons, so a dry run can be read in full. */
    detail: text("detail").notNull().default("[]"),
    /** JSON array of what it proposed, kept for a dry run and for the record. */
    proposals: text("proposals").notNull().default("[]"),
    note: text("note").notNull().default(""),
    model: text("model").notNull().default(""),
    error: text("error").notNull().default(""),
    ms: integer("ms").notNull().default(0),
    createdAt: timestamp("created_at"),
  },
  (t) => [index("agent_runs_workspace_idx").on(t.workspaceId, t.createdAt), index("agent_runs_agent_idx").on(t.agentId)],
);

export type AgentDefinitionRow = typeof agentDefinitions.$inferSelect;
export type AgentRunRow = typeof agentRuns.$inferSelect;


/**
 * Keys that let something outside Nexus read the model.
 *
 * Nexus speaks MCP (§5.33): another organisation's coding agent, or a person's assistant, can ask
 * this workspace what depends on Maximo and what is out of support next year — and, if the key
 * allows it, *suggest* a correction that lands in the same review queue as everything else. The
 * key is stored as a SHA-256 hash and shown once, because a key we can print back is a key that
 * leaks; the prefix is kept so a person can tell two of them apart.
 */
export const mcpTokens = sqliteTable(
  "mcp_tokens",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** What it is for: "Claude Code on my laptop", "the platform team's assistant". */
    name: text("name").notNull(),
    /** The first characters of the key, so two of them are distinguishable in a list. */
    prefix: text("prefix").notNull().default(""),
    hash: text("hash").notNull(),
    /** read — only the reading tools; propose — may also put suggestions in the review queue. */
    scope: text("scope", { enum: ["read", "propose"] }).notNull().default("read"),
    /** The described agent (§5.32) outside proposals are attributed to, so they can be measured. */
    agentId: text("agent_id").references(() => agentDefinitions.id, { onDelete: "set null" }),
    /** Who set this up (§5.46). Null once that person is gone; the row is the workspace's. */
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    lastUsedAt: text("last_used_at"),
    revokedAt: text("revoked_at"),
    createdAt: timestamp("created_at"),
  },
  (t) => [index("mcp_tokens_workspace_idx").on(t.workspaceId)],
);

export type McpTokenRow = typeof mcpTokens.$inferSelect;


/**
 * MCP servers Nexus may ask.
 *
 * The other direction of §5.33: an organisation already has systems that speak MCP — a CMDB, a
 * wiki, a ticket tracker, a vendor's own server — and what those systems know is exactly what the
 * model is missing. Rather than a bespoke connector per source, Nexus calls the tool and puts the
 * answer through the intake pipeline (§5.15), where it is read for claims, quoted, reviewed and
 * committed by a person. Nothing an outside server says reaches the graph directly.
 */
export const mcpServers = sqliteTable(
  "mcp_servers",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    url: text("url").notNull(),
    /** Sealed the same way a model provider's key is (lib/models/secret.ts). */
    apiKey: text("api_key").notNull().default(""),
    keyEncrypted: integer("key_encrypted", { mode: "boolean" }).notNull().default(false),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    /** Who connected it (§5.46). Null once that person is gone; the connection is the workspace's. */
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    /** unknown | ok | unauthorised | unreachable — what a real handshake last found. */
    status: text("status").notNull().default("unknown"),
    statusDetail: text("status_detail").notNull().default(""),
    /** JSON: the tools it last reported, so the page can show them without asking again. */
    tools: text("tools").notNull().default("[]"),
    checkedAt: text("checked_at"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [index("mcp_servers_workspace_idx").on(t.workspaceId)],
);

export type McpServerRow = typeof mcpServers.$inferSelect;

// ---- the landing zone ------------------------------------------------------
// Files arrive as a *batch*: a ServiceNow export, an old spreadsheet, a Word document from a
// governance review. Nothing they say is true until somebody approves it, so the whole staged
// review lives here as JSON — the shapes belong to src/lib/import and pinning them into columns would
// freeze a pipeline meant to keep learning what a bad export looks like.

export const importBatches = sqliteTable(
  "import_batches",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /**
     * How the data arrived: files | paste | connected system. Provenance starts here — "somebody
     * pasted this" and "a CMDB answered this" are different kinds of claim, and the difference is
     * worth keeping even though the staging is identical.
     */
    origin: text("origin").notNull().default("files"),
    /**
     * staged → approved → rolled back, or staged → landed (§5.89).
     *
     * `landed` is the branch destination: the import is written as a change set nobody has
     * merged, so the estate has not moved and there is nothing to roll back. A batch is never
     * deleted; the record of it is the audit.
     */
    status: text("status", { enum: ["staged", "approved", "landed", "rolled back"] }).notNull().default("staged"),
    /** The files as read: name, format, the proposed mapping, and their rows. */
    files: text("files").notNull().default("[]"),
    /** The staged records and every decision taken about them, as JSON. */
    review: text("review").notNull().default("{}"),
    /**
     * What approving it actually wrote, and the values it wrote over — the only thing that makes
     * an honest rollback possible. Empty until it is approved.
     */
    written: text("written").notNull().default("{}"),
    /**
     * The board that is this batch's working surface (§5.36). Set when one is drawn; the board is
     * where the decisions are actually taken, so the link matters in both directions — the
     * document carries the batch id, and the batch carries the board id.
     */
    boardId: text("board_id").references(() => boards.id, { onDelete: "set null" }),
    /**
     * The branch this import landed on (§5.89). Deliberately not a foreign key: `changeSets` is
     * declared further down this file, and more to the point a deleted change set should leave
     * the batch saying where it went rather than quietly forgetting. Resolved on read.
     */
    changeSetId: text("change_set_id"),
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

export const connections = sqliteTable(
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
export const connectionScopes = sqliteTable(
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
export const catalogEntries = sqliteTable(
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
export const nodeTypes = sqliteTable(
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
    /**
     * Which modelling framework declared this type — "c4", "ddd", "safe" — or "" for a type this
     * organisation invented (§5.57). Provenance, not ownership: the type is editable either way.
     */
    framework: text("framework").notNull().default(""),
    /** Which band of the stack it sits in (§5.58). Null for a type nobody has placed. */
    layerId: text("layer_id").references(() => layers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [index("node_types_workspace_idx").on(t.workspaceId), uniqueIndex("node_types_name_idx").on(t.workspaceId, t.name)],
);

/** A field declared on a node type — the schema half of the emergent attribute keys. */
export const nodeTypeFields = sqliteTable(
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
    required: integer("required", { mode: "boolean" }).notNull().default(false),
    /** Allowed values for `enum`, JSON-encoded array. */
    options: text("options").notNull().default("[]"),
    /**
     * Which group of the object page this field belongs in — "Ownership", "Lifecycle", "Cost" (§5.77).
     *
     * Empty means nobody has filed it, and the page puts those together rather than inventing a
     * home for them: a field's section is somebody's opinion about what belongs beside what, and
     * guessing it from the key name is how you end up with "cost centre" under Lifecycle.
     */
    section: text("section").notNull().default(""),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("node_type_fields_type_idx").on(t.nodeTypeId), uniqueIndex("node_type_fields_key_idx").on(t.nodeTypeId, t.key)],
);

/** A declared relation (reference) type. Matched to relations by `name` = relations.kind. */
export const relationTypes = sqliteTable(
  "relation_types",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    /** Which framework declared it — see `nodeTypes.framework` (§5.57). */
    framework: text("framework").notNull().default(""),
    /**
     * The band this relation type belongs to as vocabulary (§5.58). Optional and often empty: most
     * relation types *cross* layers, and which two they cross is derivable from their rules.
     */
    layerId: text("layer_id").references(() => layers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [index("relation_types_workspace_idx").on(t.workspaceId), uniqueIndex("relation_types_name_idx").on(t.workspaceId, t.name)],
);

/**
 * A band of the stack (§5.58).
 *
 * Layers group node types and relation types into an ordered pile — ArchiMate's Business over
 * Application over Technology being the case everybody knows. Three things can create one and the
 * row says which: a framework brought it, somebody drew it, or an agent read it out of the estate's
 * own dependency directions (§2.2). The third is the one the product is actually about.
 *
 * `position` is 0 at the top. Kept as a plain integer rather than a linked list because a stack is
 * re-ordered wholesale far more often than one band is moved.
 */
export const layers = sqliteTable(
  "layers",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    color: text("color").notNull().default(""),
    /** 0 is the top of the stack. */
    position: integer("position").notNull().default(0),
    /** "" drawn by hand · a framework id · "agent" when inferred from the data. */
    source: text("source").notNull().default(""),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [index("layers_workspace_idx").on(t.workspaceId), uniqueIndex("layers_name_idx").on(t.workspaceId, t.name)],
);

/**
 * Which modelling frameworks this workspace has said it models with (§5.57).
 *
 * A separate row rather than a flag on the workspace because a workspace can hold several at once
 * — C4 for the software, DDD for the domain, SAFe for how the work is funded — and because the
 * interesting facts are per framework: when it was taken up, and by whom. Abandoning one deletes
 * this row and nothing else: the types it brought may hold data by then, and a modelling decision
 * reversed should not take the estate with it.
 */
export const frameworkAdoptions = sqliteTable(
  "framework_adoptions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** The catalogue id: "c4", "uml-class", "ddd", "mbse", "it4it", "safe", … */
    frameworkId: text("framework_id").notNull(),
    adoptedBy: text("adopted_by"),
    adoptedByName: text("adopted_by_name").notNull().default(""),
    createdAt: timestamp("created_at"),
  },
  (t) => [
    index("framework_adoptions_workspace_idx").on(t.workspaceId),
    uniqueIndex("framework_adoptions_one_idx").on(t.workspaceId, t.frameworkId),
  ],
);

/** "Application —depends on→ Application": which node types a relation type may join. */
export const relationRules = sqliteTable(
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
export type LayerRow = typeof layers.$inferSelect;
export type FrameworkAdoptionRow = typeof frameworkAdoptions.$inferSelect;

// ---- the wiki: pages that reference the model rather than copying it -------
// A page is markdown, and the parts of it that are about the architecture are *embed directives*
// resolved when the page is read (§5.60). So a page cannot drift behind the board it describes,
// which is the failure mode of every architecture wiki anybody has met.

export const wikiPages = sqliteTable(
  "wiki_pages",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /**
     * The parent page, for the tree down the side. Self-referencing, so a moved subtree moves
     * whole; a page whose parent is deleted is re-parented to the root rather than vanishing with
     * it — losing a page because somebody tidied its parent is not a trade anybody would accept.
     */
    parentId: text("parent_id"),
    /** Unique per workspace, and what the URL carries. */
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    /** Markdown, with `:::board` / `:::object` / `:::query` lines for the live parts. */
    body: text("body").notNull().default(""),
    /** An emoji, for the tree. Optional and entirely cosmetic. */
    icon: text("icon").notNull().default(""),
    /** Order among siblings. */
    position: integer("position").notNull().default(0),
    /** What drafted it — "" for a page a person started, "board:<id>" for a write-up (§5.60). */
    source: text("source").notNull().default(""),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    updatedByName: text("updated_by_name").notNull().default(""),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [
    index("wiki_pages_workspace_idx").on(t.workspaceId),
    index("wiki_pages_parent_idx").on(t.parentId),
    uniqueIndex("wiki_pages_slug_idx").on(t.workspaceId, t.slug),
  ],
);

export type WikiPageRow = typeof wikiPages.$inferSelect;

// ---- change sets: the model in time ----------------------------------------
// The graph is the estate as it is. A *change set* is a named, dated set of intentions about it —
// what will be introduced, what will be retired, what will change hands — and it is deliberately
// **not** applied to the graph. It projects a to-be view instead (src/lib/change/project.ts).
//
// That separation is the whole design. As-is stays true, so health, impact and provenance keep
// meaning what they said; to-be is free to be speculative, contradictory and wrong, which is what
// planning actually is. A change set only touches the graph when somebody delivers it.

export const changeSets = sqliteTable(
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

export const changes = sqliteTable(
  "changes",
  {
    id: text("id").primaryKey(),
    changeSetId: text("change_set_id")
      .notNull()
      .references(() => changeSets.id, { onDelete: "cascade" }),
    op: text("op", { enum: ["addEntity", "retireEntity", "setAttribute", "setParent", "retypeEntity", "addRelation", "removeRelation"] }).notNull(),
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
export const changeSetDependencies = sqliteTable(
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
export const plateaus = sqliteTable(
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
export const plateauChangeSets = sqliteTable(
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

/**
 * Which change set a person is working on, per workspace (§5.82).
 *
 * The product had change sets and no notion of being *on* one: you could look at a plan, but not
 * work inside it, and nothing on screen said which world the thing in front of you belonged to.
 * A checkout is the missing half — one row per person per workspace, naming the ref they are
 * standing on, or absent when they are on `main`.
 *
 * Deliberately per person and not per board. Two architects can be on two different plans in the
 * same workspace at the same time, which is the point of having plans; a board that carried the
 * ref would make the last person to open it decide for everybody.
 */
export const checkouts = sqliteTable(
  "checkouts",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The change set being worked on. Deleting it puts the person back on main rather than nowhere. */
    changeSetId: text("change_set_id")
      .notNull()
      .references(() => changeSets.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] }), index("checkouts_set_idx").on(t.changeSetId)],
);

export type CheckoutRow = typeof checkouts.$inferSelect;

// ---- campaigns: giving remediation a shape (§5.85) -------------------------
// An import ends at "approved" and the actual work — going through the estate, deciding what is
// true, filling what is missing — has no shape, no owner, no queue and no end. A campaign is the
// unit that turns "the import landed" into "we went through it": a named, scoped, finite piece
// of validation with a definition of done taken from the meta-model rather than written twice.

export const campaigns = sqliteTable(
  "campaigns",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull().default(""),
    description: text("description").notNull().default(""),
    /**
     * A query over the repository, not a hand-picked list, so the scope stays true as objects
     * arrive. Stored as the same filter shape the objects list already speaks (§5.78).
     */
    scope: text("scope").notNull().default("{}"),
    /** Which checks (§5.83) must hold for an object in scope to count as done. A JSON array of ids. */
    checks: text("checks").notNull().default("[]"),
    status: text("status", { enum: ["open", "closed"] }).notNull().default("open"),
    /** The branch it runs on, when it has one (#133): the campaign closes by proposing a merge. */
    changeSetId: text("change_set_id").references(() => changeSets.id, { onDelete: "set null" }),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [index("campaigns_workspace_idx").on(t.workspaceId, t.status)],
);

/**
 * Where one object stands in one campaign.
 *
 * The thing the repository has never had: an object is in the model or it is not, and there is
 * no room between for "somebody has looked at this". A row exists only once somebody has touched
 * the object — absent means `untouched`, which keeps a 455-object campaign from writing 455 rows
 * on the day it is created.
 */
export const campaignObjects = sqliteTable(
  "campaign_objects",
  {
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    entityId: text("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    state: text("state", { enum: ["in-review", "needs-decision", "validated", "waived"] }).notNull(),
    /** The waiver's reason, or the question being waited on. A state without one is not a decision. */
    note: text("note").notNull().default(""),
    /** A waiver without an expiry is how a model quietly rots, so one is always recorded. */
    expiresAt: text("expires_at"),
    /** Who the question is addressed to, when the state is a question. */
    askedOfId: text("asked_of_id").references(() => users.id, { onDelete: "set null" }),
    /**
     * What the object looked like when somebody said yes — its `updated_at` at that moment.
     * A fact sheet validated in March and edited in June is not validated, and comparing this
     * to the entity's current `updated_at` is what makes the burn-down go up as well as down.
     */
    atVersion: text("at_version").notNull().default(""),
    byId: text("by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.entityId] }), index("campaign_objects_entity_idx").on(t.entityId)],
);

export type CampaignRow = typeof campaigns.$inferSelect;
export type CampaignObjectRow = typeof campaignObjects.$inferSelect;

export type PlateauRow = typeof plateaus.$inferSelect;

// ---- the graph remembers (§5.43) --------------------------------------------

/**
 * What happened to the graph, and who did it.
 *
 * Boards have had version history since §5.9, but the graph — the thing the product is actually
 * about — has had none. "Who changed Maximo's owner, when, and from what" was unanswerable, and
 * since §5.42 agents write to the graph overnight without anybody watching. A model that changes
 * itself while you sleep and cannot say how it got here is not a system of record.
 *
 * Three properties this table is shaped by:
 *
 * - **The event outlives its subject.** `entity_id` is deliberately *not* a foreign key, and the
 *   name is copied in. A deletion is the single most interesting thing that can happen to an
 *   entity, and a cascade would erase exactly that.
 * - **Field-level, not row-level.** One row per field that moved, with its before and after, so
 *   the history reads as sentences rather than as JSON blobs a person has to diff by eye.
 * - **The actor is recorded, never inferred.** A person, an agent, an import, a board save. The
 *   whole point is being able to tell an overnight agent's work from a colleague's.
 */
export const entityEvents = sqliteTable(
  "entity_events",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** No FK on purpose: the history of a deleted entity is the history worth keeping. */
    entityId: text("entity_id").notNull(),
    /** Copied at write time, so a deleted entity still has a name in the list. */
    entityName: text("entity_name").notNull().default(""),
    /** created | renamed | retyped | described | attributeSet | attributeRemoved | … */
    kind: text("kind").notNull(),
    /** The attribute key, or the relation's label — whatever `kind` says this is about. */
    field: text("field").notNull().default(""),
    fromValue: text("from_value").notNull().default(""),
    toValue: text("to_value").notNull().default(""),
    /** person | agent | import | board | rules | system */
    actorKind: text("actor_kind").notNull().default("system"),
    /** A user id, an agent definition id, an import batch id — or null when there is nothing to point at. */
    actorId: text("actor_id"),
    actorName: text("actor_name").notNull().default(""),
    /** Where it happened, in words: "board: Application landscape", "import: cmdb.csv". */
    context: text("context").notNull().default(""),
    at: timestamp("at"),
  },
  (t) => [index("entity_events_workspace_idx").on(t.workspaceId, t.at), index("entity_events_entity_idx").on(t.entityId, t.at)],
);

export type EntityEventRow = typeof entityEvents.$inferSelect;

// ---- talking about it (§5.50) -----------------------------------------------

/**
 * A conversation about a board, or about one thing on it.
 *
 * The open question when this was logged was whether a comment is a board object — versioned and
 * exported with the drawing, the way an agent's remark is (§5.27) — or a row beside it. It is a
 * row, for four reasons, and the difference from a remark is the whole argument:
 *
 * - **It has to outlive its subject.** Somebody deletes the card and the conversation about *why*
 *   is the most valuable thing left. `element_id` is therefore a plain string, not a foreign key.
 * - **It is not part of the drawing.** A board exported to PDF for a steering committee should not
 *   carry the team's argument about it.
 * - **Restoring a version must not rewrite it.** A checkpoint from Tuesday would otherwise
 *   resurrect resolved threads and delete Wednesday's.
 * - **"What is still open?" is a query**, and a JSON blob inside a document cannot answer it.
 *
 * An agent's remark is an annotation of a drawing at a moment and is meant to be disposable. A
 * human conversation is neither.
 */
export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    /** The element it is pinned to, or "" for a comment about the board as a whole. No FK: see above. */
    elementId: text("element_id").notNull().default(""),
    /** What the element was called when the comment was written, so a deleted card is still named. */
    anchorLabel: text("anchor_label").notNull().default(""),
    /** Null for the first comment in a thread; the thread's id for a reply. */
    parentId: text("parent_id"),
    authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
    /** Copied, so a conversation still says who said it after somebody leaves the organisation. */
    authorName: text("author_name").notNull().default(""),
    body: text("body").notNull().default(""),
    /** Set on the first comment of a thread when somebody marks the whole thing settled. */
    resolvedAt: text("resolved_at"),
    resolvedById: text("resolved_by_id").references(() => users.id, { onDelete: "set null" }),
    resolvedByName: text("resolved_by_name").notNull().default(""),
    editedAt: text("edited_at"),
    createdAt: timestamp("created_at"),
  },
  (t) => [
    index("comments_board_idx").on(t.boardId, t.createdAt),
    index("comments_thread_idx").on(t.parentId),
    index("comments_open_idx").on(t.workspaceId, t.resolvedAt),
  ],
);

export type CommentRow = typeof comments.$inferSelect;

/**
 * What a source system is trusted to say without asking (#139, §5.90).
 *
 * Not to be confused with `sources` above, which is intake's record of a document or a meeting.
 * This is the standing of a *system* — LeanIX, ServiceNow, the spreadsheet somebody maintains —
 * and it is what decides whether a claim it makes lands in the shared model or waits on a
 * branch.
 *
 * Per field, because that is how it really is: ServiceNow knows a system's lifecycle, the CMDB
 * knows where it runs, and neither of them knows who owns it in the business. A row is written
 * the first time a source is seen, with the conservative default for its kind, so the matrix
 * fills itself in as an estate connects things rather than arriving as an empty screen nobody
 * completes.
 */
export const sourceTrust = sqliteTable(
  "source_trust",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** Stable across reads: `leanix:acme.leanix.net`, `connection:<id>`, `paste`, `files`. */
    sourceKey: text("source_key").notNull(),
    name: text("name").notNull().default(""),
    /** The door it comes through, which decides the default: files | paste | connected system | EA repository. */
    origin: text("origin").notNull().default("files"),
    /** Attribute keys it owns, JSON array of strings. `["*"]` owns everything it carries. */
    owns: text("owns").notNull().default("[]"),
    /** May it decide what something *is*? A type is a modelling decision, so rarely. */
    ownsKind: integer("owns_kind", { mode: "boolean" }).notNull().default(false),
    /** May it move things in the hierarchy? True for a source that *is* the tree. */
    ownsPlace: integer("owns_place", { mode: "boolean" }).notNull().default(false),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [
    // One standing per source per workspace: two rows would be two answers to one question.
    uniqueIndex("source_trust_key_idx").on(t.workspaceId, t.sourceKey),
  ],
);

export type SourceTrustRow = typeof sourceTrust.$inferSelect;
