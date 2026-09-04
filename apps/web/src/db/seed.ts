import { nanoid } from "nanoid";
import { count } from "drizzle-orm";
import type { Db } from "./client";
import * as s from "./schema";
import { serializeDocument, type CanvasDocument, type CanvasElement } from "@/canvas/document";

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
    { id: DEMO_USER_ID, name: "Jes Olsen", email: "jes@acme-energy.example", color: "#6366f1" },
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
    { id: "team_ea", workspaceId, slug: "enterprise-architecture", name: "Enterprise Architecture", color: "#6366f1", description: "Owns the architecture canvas and the meta-model." },
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

  const rooms = [
    { id: "room_landscape", workspaceId, teamId: "team_ea", name: "Application Landscape", description: "Current-state portfolio, capabilities and how they connect.", emoji: "🗺️", visibility: "open" as const },
    { id: "room_target", workspaceId, teamId: "team_ea", name: "Target Architecture 2028", description: "Where we are heading and the transition steps.", emoji: "🎯", visibility: "open" as const },
    { id: "room_ot", workspaceId, teamId: "team_grid", name: "OT & Control Room", description: "SCADA, EMS and the substation integration layer.", emoji: "⚡", visibility: "private" as const },
    { id: "room_sandbox", workspaceId, teamId: null, name: "Sandbox", description: "Scratch boards for anyone in the workspace.", emoji: "🧪", visibility: "open" as const },
  ];
  await db.insert(s.rooms).values(rooms);

  const boards = [
    { id: "brd_capabilities", roomId: "room_landscape", name: "Business capability map", description: "L1/L2 capabilities with the applications that realise them.", document: capabilityMapDocument() },
    { id: "brd_integrations", roomId: "room_landscape", name: "Integration overview", description: "Data flows between core systems.", document: integrationDocument() },
    { id: "brd_roadmap", roomId: "room_target", name: "Transition roadmap", description: "Plateaus and work packages towards 2028.", document: roadmapDocument() },
    { id: "brd_ot", roomId: "room_ot", name: "Control-room landscape", description: "", document: emptyWithNote("Start by dropping the SCADA and EMS systems here.") },
    { id: "brd_scratch", roomId: "room_sandbox", name: "Scratch board", description: "", document: emptyWithNote("Anything goes.") },
  ];
  await db.insert(s.boards).values(
    boards.map((b) => ({
      ...b,
      workspaceId,
      createdById: DEMO_USER_ID,
      document: serializeDocument(b.document),
    })),
  );
  await db.insert(s.boardFavorites).values([{ userId: DEMO_USER_ID, boardId: "brd_capabilities" }]);
}

// ---- demo documents --------------------------------------------------------

function doc(elements: CanvasElement[]): CanvasDocument {
  return { version: 1, elements: Object.fromEntries(elements.map((e) => [e.id, e])) };
}

let z = 0;
const nextZ = () => ++z;

function frame(x: number, y: number, w: number, h: number, title: string, color: string, id = nanoid(10)): CanvasElement {
  return { id, type: "frame", x, y, w, h, title, color, z: nextZ() };
}
function sticky(x: number, y: number, text: string, color: string, id = nanoid(10)): CanvasElement {
  return { id, type: "sticky", x, y, w: 180, h: 120, text, color, z: nextZ() };
}
function shape(x: number, y: number, w: number, h: number, text: string, fill: string, id = nanoid(10), kind: "rect" | "ellipse" | "diamond" = "rect"): CanvasElement {
  return { id, type: "shape", shape: kind, x, y, w, h, text, fill, stroke: "#334155", z: nextZ() };
}
function text(x: number, y: number, w: number, t: string, fontSize = 20, id = nanoid(10)): CanvasElement {
  return { id, type: "text", x, y, w, h: fontSize * 1.5, text: t, fontSize, color: "#0f172a", align: "left", z: nextZ() };
}
function connect(from: string, to: string, label = "", id = nanoid(10)): CanvasElement {
  return { id, type: "connector", from: { elementId: from }, to: { elementId: to }, label, stroke: "#475569", style: "solid", arrowEnd: true, arrowStart: false, z: nextZ() };
}

function emptyWithNote(note: string): CanvasDocument {
  return doc([sticky(0, 0, note, "#FDE68A")]);
}

function capabilityMapDocument(): CanvasDocument {
  const els: CanvasElement[] = [];
  els.push(text(0, -130, 900, "Business capability map — current state", 28));
  els.push(text(0, -90, 900, "Capabilities (frames) with the applications that realise them. Agents will later grow this from portfolio and CMDB data.", 14));

  const caps = [
    { title: "Grid Planning", color: "#6366F1", apps: ["PowerFactory", "GIS Portal", "Asset Register"] },
    { title: "Grid Operations", color: "#0EA5E9", apps: ["SCADA / EMS", "Outage Mgmt"] },
    { title: "Asset Management", color: "#10B981", apps: ["Maximo", "Inspection App", "Asset Register"] },
    { title: "Market & Settlement", color: "#F59E0B", apps: ["Settlement Engine", "DataHub Gateway"] },
    { title: "Customer & Connections", color: "#EF4444", apps: ["CRM", "Connection Portal"] },
    { title: "Corporate", color: "#64748B", apps: ["SAP S/4", "HR Suite", "M365"] },
  ];
  const ids: Record<string, string> = {};
  caps.forEach((cap, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const fx = col * 460;
    const fy = row * 360;
    els.push(frame(fx, fy, 420, 320, cap.title, cap.color));
    cap.apps.forEach((app, j) => {
      const id = nanoid(10);
      ids[`${cap.title}/${app}`] = id;
      els.push(shape(fx + 20 + (j % 2) * 200, fy + 60 + Math.floor(j / 2) * 110, 180, 80, app, "#FFFFFF", id));
    });
  });
  // a few cross-capability relations
  els.push(connect(ids["Grid Planning/Asset Register"]!, ids["Asset Management/Asset Register"]!, "same system"));
  els.push(connect(ids["Customer & Connections/Connection Portal"]!, ids["Corporate/SAP S/4"]!, "billing"));
  els.push(sticky(1420, 0, "Question: is the Asset Register one system or two? Ask Grid Planning.", "#FCA5A5"));
  els.push(sticky(1420, 140, "Agent proposal: 'Realises' relationship between Application and Capability. Accept?", "#C4B5FD"));
  return doc(els);
}

function integrationDocument(): CanvasDocument {
  const els: CanvasElement[] = [];
  els.push(text(0, -100, 800, "Integration overview — core data flows", 28));
  const nodes: Array<[string, number, number, string]> = [
    ["SCADA / EMS", 0, 0, "#F0F9FF"],
    ["Historian", 320, 0, "#F0F9FF"],
    ["Asset Register", 0, 220, "#ECFDF5"],
    ["Maximo", 320, 220, "#ECFDF5"],
    ["Data Lake", 640, 110, "#F5F3FF"],
    ["Settlement Engine", 960, 0, "#FFF7ED"],
    ["Reporting", 960, 220, "#FFF7ED"],
  ];
  const ids: Record<string, string> = {};
  for (const [name, x, y, fill] of nodes) {
    const id = nanoid(10);
    ids[name] = id;
    els.push(shape(x, y, 220, 100, name, fill, id));
  }
  const flows: Array<[string, string, string]> = [
    ["SCADA / EMS", "Historian", "telemetry"],
    ["Historian", "Data Lake", "hourly batch"],
    ["Asset Register", "Maximo", "master data"],
    ["Maximo", "Data Lake", "work orders"],
    ["Data Lake", "Settlement Engine", "meter data"],
    ["Data Lake", "Reporting", "curated views"],
  ];
  for (const [a, b, label] of flows) els.push(connect(ids[a]!, ids[b]!, label));
  els.push(sticky(0, 400, "Integration style: file-based batch dominates. Candidate for event streaming.", "#FDBA74"));
  return doc(els);
}

function roadmapDocument(): CanvasDocument {
  const els: CanvasElement[] = [];
  els.push(text(0, -110, 800, "Transition roadmap towards 2028", 28));
  const plateaus = ["2026 — Baseline", "2027 — Consolidate", "2028 — Target"];
  plateaus.forEach((p, i) => {
    els.push(frame(i * 520, 0, 480, 520, p, ["#64748B", "#0EA5E9", "#10B981"][i]!));
  });
  const items: Array<[number, string, string]> = [
    [0, "Inventory all OT systems", "#FDE68A"],
    [0, "Connect ServiceNow CMDB", "#FDE68A"],
    [0, "Agree capability L1", "#93C5FD"],
    [1, "Retire legacy Historian", "#FCA5A5"],
    [1, "Event streaming platform", "#86EFAC"],
    [1, "Single Asset Register", "#93C5FD"],
    [2, "Digital twin of the grid", "#C4B5FD"],
    [2, "Self-service data products", "#86EFAC"],
  ];
  const perCol: number[] = [0, 0, 0];
  for (const [col, label, color] of items) {
    const n = perCol[col]!++;
    els.push(sticky(col * 520 + 20 + (n % 2) * 220, 60 + Math.floor(n / 2) * 140, label, color));
  }
  return doc(els);
}
