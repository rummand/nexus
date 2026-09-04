import { sqliteTable, text, primaryKey, index } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

/**
 * Nexus data model v0.1 — see docs/BRIEF.md §5.4.
 *
 * Vocabulary (Mural-like): Workspace → Team / Room → Board.
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
  createdAt: timestamp("created_at"),
});

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

export const rooms = sqliteTable(
  "rooms",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** Optional owning team. Null = workspace-level room. */
    teamId: text("team_id").references(() => teams.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    emoji: text("emoji").notNull().default("🗂️"),
    visibility: text("visibility", { enum: ["open", "private"] }).notNull().default("open"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [index("rooms_workspace_idx").on(t.workspaceId), index("rooms_team_idx").on(t.teamId)],
);

export const boards = sqliteTable(
  "boards",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    roomId: text("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    /** Versioned canvas document, JSON-encoded. See src/canvas/document.ts. */
    document: text("document").notNull().default('{"version":1,"elements":{}}'),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
    lastOpenedAt: text("last_opened_at"),
  },
  (t) => [index("boards_room_idx").on(t.roomId), index("boards_workspace_idx").on(t.workspaceId)],
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

// ---- relations -------------------------------------------------------------

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(workspaceMembers),
  teams: many(teams),
  rooms: many(rooms),
  boards: many(boards),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [teams.workspaceId], references: [workspaces.id] }),
  members: many(teamMembers),
  rooms: many(rooms),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, { fields: [workspaceMembers.workspaceId], references: [workspaces.id] }),
  user: one(users, { fields: [workspaceMembers.userId], references: [users.id] }),
}));

export const roomsRelations = relations(rooms, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [rooms.workspaceId], references: [workspaces.id] }),
  team: one(teams, { fields: [rooms.teamId], references: [teams.id] }),
  boards: many(boards),
}));

export const boardsRelations = relations(boards, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [boards.workspaceId], references: [workspaces.id] }),
  room: one(rooms, { fields: [boards.roomId], references: [rooms.id] }),
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
export type Room = typeof rooms.$inferSelect;
export type Board = typeof boards.$inferSelect;
