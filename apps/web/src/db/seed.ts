import { count, eq } from "drizzle-orm";
import type { Db } from "./client";
import * as s from "./schema";
import { serializeDocument, type CanvasDocument } from "@/canvas/document";
import { capabilityMap, integration, landscape, note, roadmap } from "@/canvas/templates";
import { syncBoardToGraph } from "@/lib/graph";

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
  // index the seeded boards into the knowledge graph
  for (const b of boards) await syncBoardToGraph(db, { id: b.id, workspaceId }, b.document);

  await seedRoadmap(db, workspaceId);
}

/**
 * Two plans against the seeded estate.
 *
 * The demo is not much of a demo without them: the roadmap's whole argument is that a change set
 * held against a real graph can tell you what it breaks, and that only shows with a plan that
 * touches something. Entity ids are looked up by name because the seed mints them randomly.
 */
async function seedRoadmap(db: Db, workspaceId: string) {
  const rows = await db.select({ id: s.entities.id, name: s.entities.name }).from(s.entities).where(eq(s.entities.workspaceId, workspaceId));
  const wires = await db.select({ from: s.relations_.fromEntityId, to: s.relations_.toEntityId }).from(s.relations_).where(eq(s.relations_.workspaceId, workspaceId));
  const degree = new Map<string, number>();
  for (const w of wires) {
    degree.set(w.from, (degree.get(w.from) ?? 0) + 1);
    degree.set(w.to, (degree.get(w.to) ?? 0) + 1);
  }
  /**
   * The same system appears on more than one seeded board, so a name matches several entities —
   * which is exactly the duplication the resolution proposals exist to find. Take the one that is
   * actually wired into the landscape: a plan against the unconnected copy would look harmless.
   */
  const id = (name: string) =>
    rows.filter((r) => r.name === name).sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))[0]?.id;
  const maximo = id("Maximo");
  const historian = id("Historian");
  const assetRegister = id("Asset Register");
  const dataLake = id("Data Lake");
  if (!maximo || !historian) return;

  const at = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const sapPm = "ent_seed_sap_pm";

  await db.insert(s.changeSets).values([
    {
      id: "chg_seed_workorders",
      workspaceId,
      name: "Move work orders to SAP PM",
      description:
        "Maximo is out of support at the end of the year. Work-order management moves to SAP PM, which we already run for finance; asset master data keeps flowing from the Asset Register.",
      status: "planned",
      targetDate: at(120),
      createdById: DEMO_USER_ID,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "chg_seed_streaming",
      workspaceId,
      name: "Retire the Historian, stream telemetry",
      description: "Candidate, not agreed. Replace the hourly batch out of the Historian with telemetry streamed straight to the data lake.",
      status: "draft",
      targetDate: at(300),
      createdById: DEMO_USER_ID,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  const changes = [
    { id: "chn_seed_1", changeSetId: "chg_seed_workorders", op: "addEntity" as const, entityId: sapPm, relationId: null, payload: JSON.stringify({ kind: "Application", name: "SAP PM", description: "Plant maintenance module, already licensed.", attributes: { owner: "Asset Management", lifecycle: "planned" } }), note: "Already licensed; no new vendor." },
    { id: "chn_seed_2", changeSetId: "chg_seed_workorders", op: "retireEntity" as const, entityId: maximo, relationId: null, payload: "{}", note: "Out of support from December." },
    ...(assetRegister
      ? [{ id: "chn_seed_3", changeSetId: "chg_seed_workorders", op: "addRelation" as const, entityId: null, relationId: "rel_seed_1", payload: JSON.stringify({ fromEntityId: assetRegister, toEntityId: sapPm, kind: "master data" }), note: "The same feed Maximo had." }]
      : []),
    ...(dataLake
      ? [{ id: "chn_seed_4", changeSetId: "chg_seed_workorders", op: "addRelation" as const, entityId: null, relationId: "rel_seed_2", payload: JSON.stringify({ fromEntityId: sapPm, toEntityId: dataLake, kind: "work orders" }), note: "Work orders still land in the lake." }]
      : []),
    { id: "chn_seed_5", changeSetId: "chg_seed_streaming", op: "retireEntity" as const, entityId: historian, relationId: null, payload: "{}", note: "Only exists to buffer for the batch." },
    ...(dataLake
      ? [{ id: "chn_seed_6", changeSetId: "chg_seed_streaming", op: "addRelation" as const, entityId: null, relationId: "rel_seed_3", payload: JSON.stringify({ fromEntityId: id("SCADA / EMS") ?? "", toEntityId: dataLake, kind: "telemetry" }), note: "Straight through, no hourly batch." }]
      : []),
  ];
  await db.insert(s.changes).values(changes.map((c) => ({ ...c, createdAt: now })));

  // The streaming plan writes into the same data lake the work-order move re-points; doing it the
  // other way round would mean rewiring twice. That is a dependency, not a preference.
  await db.insert(s.changeSetDependencies).values({ changeSetId: "chg_seed_streaming", dependsOnId: "chg_seed_workorders", createdAt: now });

  // Two states worth naming: the one after the work-order move, and the one people call "2028".
  await db.insert(s.plateaus).values([
    {
      id: "plt_seed_workorders",
      workspaceId,
      name: "Work orders on SAP PM",
      description: "Maximo is gone and work-order management runs on SAP PM. The Historian is still in the middle of the telemetry path.",
      targetDate: at(150),
      createdById: DEMO_USER_ID,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "plt_seed_2028",
      workspaceId,
      name: "Target architecture 2028",
      description: "Both moves have landed: work orders on SAP PM, telemetry streamed straight to the lake with no intermediate store.",
      targetDate: at(330),
      createdById: DEMO_USER_ID,
      createdAt: now,
      updatedAt: now,
    },
  ]);
  await db.insert(s.plateauChangeSets).values([
    { plateauId: "plt_seed_workorders", changeSetId: "chg_seed_workorders", createdAt: now },
    { plateauId: "plt_seed_2028", changeSetId: "chg_seed_workorders", createdAt: now },
    { plateauId: "plt_seed_2028", changeSetId: "chg_seed_streaming", createdAt: now },
  ]);
}
