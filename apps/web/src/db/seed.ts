import { count } from "drizzle-orm";
import type { Db } from "./client";
import * as s from "./schema";
import { serializeDocument, type CanvasDocument } from "@/canvas/document";
import { capabilityMap, integration, landscape, note, roadmap } from "@/canvas/templates";

/** The demo identity used while authentication is not yet part of the product. */
export const DEMO_USER_ID = "usr_demo";
export const DEMO_WORKSPACE_SLUG = "acme-energy";

export async function seedIfEmpty(db: Db) {
  const [row] = await db.select({ n: count() }).from(s.workspaces);
  if ((row?.n ?? 0) > 0) return;
  await seed(db);
}

export async function seed(db: Db) {
  const users = [
    { id: DEMO_USER_ID, name: "Jes Olsen", email: "jes@acme-energy.example", color: "#1376d4" },
    { id: "usr_maria", name: "Maria Lund", email: "maria@acme-energy.example", color: "#0ea5e9" },
    { id: "usr_tobias", name: "Tobias Kjær", email: "tobias@acme-energy.example", color: "#10b981" },
    { id: "usr_anna", name: "Anna Holm", email: "anna@acme-energy.example", color: "#f59e0b" },
  ];
  await db.insert(s.users).values(users);

  const workspaceId = "ws_acme";
  await db.insert(s.workspaces).values({ id: workspaceId, slug: DEMO_WORKSPACE_SLUG, name: "Acme Energy" });
  await db.insert(s.workspaceMembers).values(
    users.map((u, i) => ({ workspaceId, userId: u.id, role: i === 0 ? ("owner" as const) : ("member" as const) })),
  );

  const teams = [
    { id: "team_ea", workspaceId, slug: "enterprise-architecture", name: "Enterprise Architecture", color: "#1376d4", description: "Owns the architecture canvas and the meta-model." },
    { id: "team_grid", workspaceId, slug: "grid-operations", name: "Grid Operations", color: "#0ea5e9", description: "OT systems, SCADA and the control-room landscape." },
    { id: "team_data", workspaceId, slug: "data-platform", name: "Data Platform", color: "#10b981", description: "Data products, integration and analytics." },
  ];
  await db.insert(s.teams).values(teams);
  await db.insert(s.teamMembers).values([
    { teamId: "team_ea", userId: DEMO_USER_ID, role: "lead" },
    { teamId: "team_ea", userId: "usr_maria", role: "member" },
    { teamId: "team_grid", userId: "usr_tobias", role: "lead" },
    { teamId: "team_grid", userId: DEMO_USER_ID, role: "member" },
    { teamId: "team_data", userId: "usr_anna", role: "lead" },
    { teamId: "team_data", userId: "usr_maria", role: "member" },
  ]);

  const spaces = [
    { id: "space_landscape", workspaceId, teamId: "team_ea", name: "Architecture thinking room", description: "Current-state portfolio, capabilities and how they connect.", emoji: "🗺️", visibility: "open" as const },
    { id: "space_target", workspaceId, teamId: "team_ea", name: "Target Architecture 2028", description: "Where we are heading and the transition steps.", emoji: "🎯", visibility: "open" as const },
    { id: "space_ot", workspaceId, teamId: "team_grid", name: "OT & Control Room", description: "SCADA, EMS and the substation integration layer.", emoji: "⚡", visibility: "private" as const },
    { id: "space_sandbox", workspaceId, teamId: null, name: "Sandbox", description: "Scratch boards for anyone in the workspace.", emoji: "🧪", visibility: "open" as const },
  ];
  await db.insert(s.spaces).values(spaces);

  const boards: Array<{ id: string; spaceId: string; name: string; description: string; document: CanvasDocument }> = [
    { id: "brd_capabilities", spaceId: "space_landscape", name: "Business capability map", description: "L1 capabilities with the applications that realise them.", document: capabilityMap() },
    { id: "brd_landscape", spaceId: "space_landscape", name: "Application landscape", description: "Applications, interfaces and dependencies.", document: landscape() },
    { id: "brd_integrations", spaceId: "space_landscape", name: "Integration overview", description: "Data flows between core systems.", document: integration() },
    { id: "brd_roadmap", spaceId: "space_target", name: "Transition roadmap", description: "Plateaus and work packages towards 2028.", document: roadmap() },
    { id: "brd_ot", spaceId: "space_ot", name: "Control-room landscape", description: "SCADA and EMS systems.", document: { version: 2, elements: Object.fromEntries([note(0, 0, "Start here", "Drop the SCADA and EMS systems on this board as cards.")].map((e) => [e.id, e])) } },
    { id: "brd_scratch", spaceId: "space_sandbox", name: "Scratch board", description: "Anything goes.", document: { version: 2, elements: {} } },
  ];
  await db.insert(s.boards).values(
    boards.map((b) => ({ ...b, workspaceId, createdById: DEMO_USER_ID, document: serializeDocument(b.document) })),
  );
  await db.insert(s.boardFavorites).values([{ userId: DEMO_USER_ID, boardId: "brd_capabilities" }]);
}
