import { count, eq } from "drizzle-orm";
import type { Db } from "./client";
import * as s from "./schema";
import { serializeDocument, type CanvasDocument } from "@/canvas/document";
import { capabilityMap, integration, landscape, note, roadmap } from "@/canvas/templates";
import { syncBoardToGraph } from "@/lib/graph";
import { hashPassword } from "@/lib/auth/password";

/** The person the seed makes first, and the one the demo sign-in hint names (§5.41). */
export const DEMO_USER_ID = "usr_demo";
export const DEMO_WORKSPACE_SLUG = "acme-energy";
/**
 * The password the seed gives all four of its people (§5.41).
 *
 * Public by design: it protects a database of invented energy companies, and the point of the
 * demo is to be two of those people at once and watch the board be shared. It lives here rather
 * than with the sign-in code because it is a property of the seed — a real deployment changes it
 * and the sign-in page stops advertising it.
 */
export const DEMO_PASSWORD = "acme-energy";

export async function seedIfEmpty(db: Db) {
  const [row] = await db.select({ n: count() }).from(s.workspaces);
  if ((row?.n ?? 0) > 0) {
    await backfillDemoRoadmap(db);
    return;
  }
  await seed(db);
}

/**
 * Give the demo workspace its roadmap, if it predates the feature.
 *
 * The seed only runs on an empty database, so an instance that was set up before change sets
 * existed shows an empty Roadmap for ever — which reads as a broken feature rather than an empty
 * one. This fills that gap once, on boot, and never again.
 *
 * Deliberately narrow. It touches only the demo workspace, by slug: seeded example plans belong in
 * the demo and nowhere near a real organisation's model. And it does nothing at all if the
 * workspace already has a change set, so somebody's own planning is never joined by fixtures.
 */
export async function backfillDemoRoadmap(db: Db) {
  const demo = await db.query.workspaces.findFirst({ where: eq(s.workspaces.slug, DEMO_WORKSPACE_SLUG) });
  if (!demo) return;
  const [existing] = await db.select({ n: count() }).from(s.changeSets).where(eq(s.changeSets.workspaceId, demo.id));
  if ((existing?.n ?? 0) > 0) return;
  await seedRoadmap(db, demo.id);
}

export async function seed(db: Db) {
  const users = [
    { id: DEMO_USER_ID, name: "Jesper Olesen", email: "jes@acme-energy.example", color: "#1376d4" },
    { id: "usr_maria", name: "Maria Lund", email: "maria@acme-energy.example", color: "#0ea5e9" },
    { id: "usr_tobias", name: "Tobias Kjær", email: "tobias@acme-energy.example", color: "#10b981" },
    { id: "usr_anna", name: "Anna Holm", email: "anna@acme-energy.example", color: "#f59e0b" },
  ];
  /*
   * The seeded people can sign in (§5.41). One known password for all four, because the point of
   * the demo is to be two of them at once and see the board shared — and because a password that
   * protects a database of invented energy companies is theatre.
   */
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  /*
   * The first of them also runs the deployment (§5.64). A demo with a platform console nobody can
   * open would be a demo of a screenshot; and on a one-tenant installation the person who owns
   * the tenant is in fact the person who runs the machine.
   */
  await db.insert(s.users).values(users.map((u, i) => ({ ...u, passwordHash, platformRole: i === 0 ? ("operator" as const) : null })));

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
  for (const b of boards) await syncBoardToGraph(db, { id: b.id, workspaceId, name: b.name }, b.document);

  await seedCapabilityTree(db, workspaceId);
  await seedRoadmap(db, workspaceId);
  await seedHistory(db, workspaceId);
}

/**
 * A capability hierarchy over the seeded estate (§5.70).
 *
 * The capability map board draws six L1 capabilities as frames, which was as much structure as a
 * flat graph could hold. With containment on the entity itself the same six become a real tree:
 * two levels, with the applications that realise them sitting underneath — so the roll-up in the
 * entity drawer has something to add up, and a demo workspace shows what a capability map is
 * actually for.
 *
 * The L1 rows are created here rather than drawn, because a capability that exists only as a
 * frame on one board is a picture, not a thing the graph knows about.
 *
 * The ids carry the `ent_` prefix every other object has: the canvas tests for it before treating
 * an element as the face of an object, so a seeded capability with a prettier id was drawn on a
 * board and then ignored by the board's index and by the save. Readable ids are not worth an
 * object the product cannot see.
 */
async function seedCapabilityTree(db: Db, workspaceId: string) {
  const ts = new Date().toISOString();
  const L1: Array<{ id: string; name: string; children: Array<{ id: string; name: string; realisedBy: string[] }> }> = [
    {
      id: "ent_cap_grid", name: "Grid Operations",
      children: [
        { id: "ent_cap_grid_control", name: "Real-time control", realisedBy: ["SCADA / EMS", "Historian"] },
        { id: "ent_cap_grid_outage", name: "Outage management", realisedBy: ["Outage Mgmt"] },
      ],
    },
    {
      id: "ent_cap_asset", name: "Asset Management",
      children: [
        { id: "ent_cap_asset_register", name: "Asset records", realisedBy: ["Asset Register", "Maximo"] },
        { id: "ent_cap_asset_work", name: "Work orders", realisedBy: ["Maximo"] },
      ],
    },
    {
      id: "ent_cap_market", name: "Market & Settlement",
      children: [{ id: "ent_cap_market_settle", name: "Settlement", realisedBy: ["Settlement Engine"] }],
    },
    {
      id: "ent_cap_customer", name: "Customer & Connections",
      children: [{ id: "ent_cap_customer_service", name: "Customer service", realisedBy: ["CRM", "CRM Cloud", "Connection Portal"] }],
    },
  ];

  const rows = await db
    .select({ id: s.entities.id, name: s.entities.name, kind: s.entities.kind })
    .from(s.entities)
    .where(eq(s.entities.workspaceId, workspaceId));
  const appNamed = (name: string) =>
    rows.filter((r) => r.kind === "Application" && r.name.trim().toLowerCase() === name.trim().toLowerCase());

  const created: Array<typeof s.entities.$inferInsert> = [];
  for (const l1 of L1) {
    created.push({ id: l1.id, workspaceId, kind: "Business Capability", name: l1.name, description: "", attributes: "{}", parentId: null, source: "seed", createdAt: ts, updatedAt: ts });
    for (const l2 of l1.children) {
      created.push({ id: l2.id, workspaceId, kind: "Business Capability", name: l2.name, description: "", attributes: "{}", parentId: l1.id, source: "seed", createdAt: ts, updatedAt: ts });
    }
  }
  await db.insert(s.entities).values(created);

  // The applications sit inside the capability they realise, so the roll-up has real weight.
  for (const l1 of L1) {
    for (const l2 of l1.children) {
      for (const name of l2.realisedBy) {
        for (const app of appNamed(name)) {
          await db.update(s.entities).set({ parentId: l2.id, updatedAt: ts }).where(eq(s.entities.id, app.id));
        }
      }
    }
  }
}

/**
 * A fortnight of the demo estate's past (§5.43).
 *
 * Invented, like the rest of the seed. "What changed" is a page about the last two weeks, and a
 * workspace created ninety seconds ago has nothing to show on it — so the demo gets a plausible
 * fortnight: a colleague setting owners, an overnight agent proposing a criticality somebody
 * accepted, an import that arrived from a CMDB. Every row here is the same shape a real change
 * writes; nothing about this table is special-cased for the demo.
 */
async function seedHistory(db: Db, workspaceId: string) {
  const rows = await db.select({ id: s.entities.id, name: s.entities.name, kind: s.entities.kind }).from(s.entities).where(eq(s.entities.workspaceId, workspaceId));
  const pick = (name: string) => rows.find((r) => r.name.toLowerCase().includes(name.toLowerCase()));
  const days = (n: number) => new Date(Date.now() - n * 86_400_000 + 9 * 3_600_000).toISOString();

  /*
   * Everything recorded so far is the seeded boards being indexed into the graph, a minute ago.
   * The demo estate is meant to look like one that has existed for a while, so its birth is dated
   * a month back — otherwise "what changed" opens on sixty objects appearing at once, and the
   * fortnight below it, which is the part worth looking at, is off the bottom of the screen.
   */
  await db.update(s.entityEvents).set({ at: days(30) }).where(eq(s.entityEvents.workspaceId, workspaceId));

  const maria = { kind: "person" as const, id: "usr_maria", name: "Maria Lund" };
  const tobias = { kind: "person" as const, id: "usr_tobias", name: "Tobias Kjær" };
  const nightWatch = { kind: "agent" as const, id: null, name: "Night watch" };
  const cmdb = { kind: "import" as const, id: null, name: "cmdb-export.csv" };

  const script: Array<{ target: string; at: string; actor: { kind: "person" | "agent" | "import"; id: string | null; name: string }; context: string; kind: string; field: string; from: string; to: string }> = [
    { target: "SCADA", at: days(11), actor: cmdb, context: "import: cmdb-export.csv", kind: "attributeSet", field: "owner", from: "", to: "Control Room" },
    { target: "SCADA", at: days(11), actor: cmdb, context: "import: cmdb-export.csv", kind: "attributeSet", field: "criticality", from: "", to: "high" },
    { target: "SAP", at: days(9), actor: maria, context: "the entity drawer", kind: "attributeSet", field: "owner", from: "", to: "Finance" },
    { target: "SAP", at: days(9), actor: maria, context: "the entity drawer", kind: "described", field: "", from: "", to: "Finance and procurement, on-premise." },
    { target: "Maximo", at: days(6), actor: tobias, context: "board: Application landscape", kind: "renamed", field: "", from: "Maximo (IBM)", to: "" },
    { target: "Maximo", at: days(6), actor: tobias, context: "board: Application landscape", kind: "attributeSet", field: "owner", from: "", to: "Asset Management" },
    { target: "GIS", at: days(3), actor: nightWatch, context: "accepted “Give GIS a criticality”", kind: "attributeSet", field: "criticality", from: "", to: "medium" },
    { target: "CRM", at: days(1), actor: maria, context: "the entity drawer", kind: "attributeSet", field: "owner", from: "", to: "Customer Service" },
  ];

  const values = script.flatMap((line, i) => {
    const target = pick(line.target);
    if (!target) return [];
    return [{
      id: `evt_seed_${i}`,
      workspaceId,
      entityId: target.id,
      entityName: target.name,
      kind: line.kind,
      field: line.field,
      fromValue: line.from,
      // A rename has to end at the name the object actually has, or the demo's own history
      // contradicts the demo.
      toValue: line.kind === "renamed" ? target.name : line.to,
      actorKind: line.actor.kind,
      actorId: line.actor.id,
      actorName: line.actor.name,
      context: line.context,
      at: line.at,
    }];
  });
  if (values.length) await db.insert(s.entityEvents).values(values);
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

  // onConflictDoNothing throughout: a half-finished earlier attempt should be completed, not
  // turned into a crash on the next boot.
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
  ]).onConflictDoNothing();

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
  await db.insert(s.changes).values(changes.map((c) => ({ ...c, createdAt: now }))).onConflictDoNothing();

  // The streaming plan writes into the same data lake the work-order move re-points; doing it the
  // other way round would mean rewiring twice. That is a dependency, not a preference.
  await db.insert(s.changeSetDependencies).values({ changeSetId: "chg_seed_streaming", dependsOnId: "chg_seed_workorders", createdAt: now }).onConflictDoNothing();

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
  ]).onConflictDoNothing();
  await db.insert(s.plateauChangeSets).values([
    { plateauId: "plt_seed_workorders", changeSetId: "chg_seed_workorders", createdAt: now },
    { plateauId: "plt_seed_2028", changeSetId: "chg_seed_workorders", createdAt: now },
    { plateauId: "plt_seed_2028", changeSetId: "chg_seed_streaming", createdAt: now },
  ]).onConflictDoNothing();
}
