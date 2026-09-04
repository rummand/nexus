import { nanoid } from "nanoid";
import type { CanvasDocument, CanvasElement } from "./document";
import { cardColorForKind } from "./document";

/**
 * Board templates. Used by the "How do you want to start?" starters on the home page and
 * by the demo seed. Everything here is plain document data — no React.
 */

export type TemplateId = "blank" | "capability" | "landscape" | "integration" | "roadmap";

export interface TemplateInfo {
  id: TemplateId;
  name: string;
  description: string;
}

export const TEMPLATES: TemplateInfo[] = [
  { id: "blank", name: "Blank board", description: "Start with an empty architecture canvas." },
  { id: "capability", name: "Capability map", description: "Capabilities as frames with the applications that realise them." },
  { id: "landscape", name: "Application landscape", description: "Applications as cards with their dependencies." },
  { id: "integration", name: "Integration flows", description: "Core systems and the data that moves between them." },
];

let z = 0;
const nextZ = () => ++z;

function doc(elements: CanvasElement[]): CanvasDocument {
  return { version: 2, elements: Object.fromEntries(elements.map((e) => [e.id, e])) };
}

export function frame(x: number, y: number, w: number, h: number, title: string, color: string, id = nanoid(10)): CanvasElement {
  return { id, type: "frame", x, y, w, h, title, color, z: nextZ() };
}
export function note(x: number, y: number, title: string, text: string, color = "#ff9800", id = nanoid(10)): CanvasElement {
  return { id, type: "sticky", x, y, w: 300, h: 150, title, text, color, z: nextZ() };
}
export function card(x: number, y: number, kind: string, title: string, description = "", id = nanoid(10)): CanvasElement {
  return { id, type: "card", x, y, w: 236, h: 120, kind, color: cardColorForKind(kind), title, description, z: nextZ() };
}
export function shape(x: number, y: number, w: number, h: number, text: string, fill: string, id = nanoid(10), kind: "rect" | "ellipse" | "diamond" = "rect"): CanvasElement {
  return { id, type: "shape", shape: kind, x, y, w, h, text, fill, stroke: "#475569", z: nextZ() };
}
export function textBlock(x: number, y: number, w: number, h: number, title: string, text: string, variant: "text" | "section" = "text", color = "#1376d4", id = nanoid(10)): CanvasElement {
  return { id, type: "text", variant, x, y, w, h, title, text, color, z: nextZ() };
}
export function connect(from: string, to: string, label = "", id = nanoid(10), style: "solid" | "dashed" = "solid"): CanvasElement {
  return { id, type: "connector", from: { elementId: from }, to: { elementId: to }, label, stroke: "#475569", style, arrowEnd: true, arrowStart: false, z: nextZ() };
}

export function buildTemplate(id: TemplateId): CanvasDocument {
  switch (id) {
    case "capability": return capabilityMap();
    case "landscape": return landscape();
    case "integration": return integration();
    case "roadmap": return roadmap();
    default: return doc([]);
  }
}

export function capabilityMap(): CanvasDocument {
  const els: CanvasElement[] = [];
  els.push(textBlock(0, -150, 900, 96, "Business capability map — current state", "Capabilities as frames with the applications that realise them. Agents will later grow this from portfolio and CMDB data.", "section"));
  const caps = [
    { title: "Grid Planning", color: "#1376d4", apps: ["PowerFactory", "GIS Portal", "Asset Register"] },
    { title: "Grid Operations", color: "#0ea5e9", apps: ["SCADA / EMS", "Outage Mgmt"] },
    { title: "Asset Management", color: "#10b981", apps: ["Maximo", "Inspection App", "Asset Register"] },
    { title: "Market & Settlement", color: "#f59e0b", apps: ["Settlement Engine", "DataHub Gateway"] },
    { title: "Customer & Connections", color: "#ef4444", apps: ["CRM", "Connection Portal"] },
    { title: "Corporate", color: "#64748b", apps: ["SAP S/4", "HR Suite", "M365"] },
  ];
  const ids: Record<string, string> = {};
  caps.forEach((cap, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const fx = col * 560;
    const fy = row * 400;
    els.push(frame(fx, fy, 520, 340, cap.title, cap.color));
    cap.apps.forEach((app, j) => {
      const id = nanoid(10);
      ids[`${cap.title}/${app}`] = id;
      els.push(card(fx + 20 + (j % 2) * 250, fy + 50 + Math.floor(j / 2) * 140, "Application", app, `Realises ${cap.title}`, id));
    });
  });
  els.push(connect(ids["Grid Planning/Asset Register"]!, ids["Asset Management/Asset Register"]!, "same system"));
  els.push(connect(ids["Customer & Connections/Connection Portal"]!, ids["Corporate/SAP S/4"]!, "billing"));
  els.push(note(1720, 0, "Open question", "Is the Asset Register one system or two? Ask Grid Planning.", "#ef4444"));
  els.push(note(1720, 180, "Agent proposal", "'Realises' relationship between Application and Capability. Accept?", "#8b5cf6"));
  return doc(els);
}

export function landscape(): CanvasDocument {
  const els: CanvasElement[] = [];
  els.push(textBlock(0, -130, 760, 80, "Application landscape", "Applications and the interfaces between them. Drag cards, connect them, annotate with notes.", "section"));
  const apps: Array<[string, string, number, number]> = [
    ["CRM Cloud", "Application", 0, 0],
    ["ERP Core", "Application", 520, 0],
    ["Revenue Management", "Business Capability", 260, 220],
    ["Customer API", "Interface", 260, -10],
    ["Workflow Service", "IT Component", 0, 220],
    ["Customer Data", "Data Object", 520, 220],
  ];
  const ids: Record<string, string> = {};
  for (const [name, kind, x, y] of apps) {
    const id = nanoid(10);
    ids[name] = id;
    els.push(card(x, y, kind, name, kind === "Application" ? "Lifecycle: active" : "", id));
  }
  els.push(connect(ids["CRM Cloud"]!, ids["Customer API"]!, "provides"));
  els.push(connect(ids["Customer API"]!, ids["ERP Core"]!, "consumed by"));
  els.push(connect(ids["CRM Cloud"]!, ids["Revenue Management"]!, "supports"));
  els.push(connect(ids["ERP Core"]!, ids["Customer Data"]!, "owns"));
  els.push(connect(ids["Workflow Service"]!, ids["CRM Cloud"]!, "implements", undefined, "dashed"));
  els.push(note(820, 0, "Local note", "Which of these is the system of record for customer data?"));
  return doc(els);
}

export function integration(): CanvasDocument {
  const els: CanvasElement[] = [];
  els.push(textBlock(0, -130, 800, 80, "Integration overview — core data flows", "Batch dominates today. Candidates for event streaming are marked.", "section"));
  const nodes: Array<[string, number, number]> = [
    ["SCADA / EMS", 0, 0], ["Historian", 340, 0], ["Asset Register", 0, 240], ["Maximo", 340, 240],
    ["Data Lake", 680, 120], ["Settlement Engine", 1020, 0], ["Reporting", 1020, 240],
  ];
  const ids: Record<string, string> = {};
  for (const [name, x, y] of nodes) {
    const id = nanoid(10);
    ids[name] = id;
    els.push(card(x, y, name === "Data Lake" ? "IT Component" : "Application", name, "", id));
  }
  const flows: Array<[string, string, string]> = [
    ["SCADA / EMS", "Historian", "telemetry"], ["Historian", "Data Lake", "hourly batch"], ["Asset Register", "Maximo", "master data"],
    ["Maximo", "Data Lake", "work orders"], ["Data Lake", "Settlement Engine", "meter data"], ["Data Lake", "Reporting", "curated views"],
  ];
  for (const [a, b, label] of flows) els.push(connect(ids[a]!, ids[b]!, label));
  els.push(note(0, 440, "Integration style", "File-based batch dominates. Candidate for event streaming: Historian → Data Lake."));
  return doc(els);
}

export function roadmap(): CanvasDocument {
  const els: CanvasElement[] = [];
  els.push(textBlock(0, -130, 800, 80, "Transition roadmap towards 2028", "Plateaus as frames, work packages as notes.", "section"));
  const plateaus = ["2026 — Baseline", "2027 — Consolidate", "2028 — Target"];
  plateaus.forEach((p, i) => els.push(frame(i * 700, 0, 660, 560, p, ["#64748b", "#0ea5e9", "#10b981"][i]!)));
  const items: Array<[number, string, string, string]> = [
    [0, "Inventory all OT systems", "Grid Operations owns the list.", "#ff9800"],
    [0, "Connect ServiceNow CMDB", "First ingestion source for Nexus.", "#ff9800"],
    [0, "Agree capability L1", "Workshop with EA + business.", "#1376d4"],
    [1, "Retire legacy Historian", "Depends on Data Lake ingestion.", "#ef4444"],
    [1, "Event streaming platform", "Replace nightly batch.", "#10b981"],
    [1, "Single Asset Register", "Merge the two registers.", "#1376d4"],
    [2, "Digital twin of the grid", "Built on the graph.", "#8b5cf6"],
    [2, "Self-service data products", "Data platform team.", "#10b981"],
  ];
  const perCol: number[] = [0, 0, 0];
  for (const [col, title, body, color] of items) {
    const n = perCol[col]!++;
    els.push(note(col * 700 + 20 + (n % 2) * 320, 50 + Math.floor(n / 2) * 170, title, body, color));
  }
  return doc(els);
}
