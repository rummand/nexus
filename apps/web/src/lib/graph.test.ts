import { beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import path from "node:path";
import { eq } from "drizzle-orm";
import * as s from "@/db/schema";
import type { Db } from "@/db/client";
import { buildBoardFromGraph, entityDetail, graphSnapshot, hydrateDocument, importGraph, parseImportText, syncBoardToGraph } from "./graph";
import type { CanvasDocument, CardElement } from "@/canvas/document";

let db: Db;

beforeAll(async () => {
  db = drizzle(createClient({ url: ":memory:" }), { schema: s });
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../../drizzle") });
  await db.insert(s.workspaces).values({ id: "ws", slug: "ws", name: "WS" });
  await db.insert(s.spaces).values({ id: "sp", workspaceId: "ws", name: "Space" });
  await db.insert(s.boards).values({ id: "b1", workspaceId: "ws", spaceId: "sp", name: "B1" });
  await db.insert(s.boards).values({ id: "b2", workspaceId: "ws", spaceId: "sp", name: "B2" });
});

const cardEl = (id: string, entityId: string, title: string, kind = "Application"): CardElement => ({ id, type: "card", x: 0, y: 0, w: 236, h: 124, kind, color: "#000", title, description: "", z: 1, meta: { entityId } });

describe("planned cards", () => {
  const planned = (id: string, entityId: string, title: string): CardElement => ({
    ...cardEl(id, entityId, title), meta: { entityId, planned: "chg_1" },
  });
  // A workspace of its own: the suites below assert over every entity in "ws", and a planned card
  // that leaked into those counts would be a confusing way to find this bug.
  beforeAll(async () => {
    await db.insert(s.workspaces).values({ id: "ws_plan", slug: "ws-plan", name: "Plan" });
    await db.insert(s.spaces).values({ id: "sp_plan", workspaceId: "ws_plan", name: "Space" });
    await db.insert(s.boards).values({ id: "b_plan", workspaceId: "ws_plan", spaceId: "sp_plan", name: "Plan board" });
  });

  it("never reaches the graph, however many times the board is saved", async () => {
    const doc: CanvasDocument = { version: 2, elements: { p1: planned("p1", "ent_planned_1", "SAP PM") } };
    await syncBoardToGraph(db, { id: "b_plan", workspaceId: "ws_plan" }, doc);
    await syncBoardToGraph(db, { id: "b_plan", workspaceId: "ws_plan" }, doc);
    const rows = await db.select().from(s.entities).where(eq(s.entities.id, "ent_planned_1"));
    expect(rows, "drawing an intention must not create the system").toHaveLength(0);
    const index = await db.select().from(s.boardEntities).where(eq(s.boardEntities.entityId, "ent_planned_1"));
    expect(index).toHaveLength(0);
  });

  it("becomes an ordinary card once the change set is delivered", async () => {
    const doc: CanvasDocument = { version: 2, elements: { p2: planned("p2", "ent_planned_2", "SAP PM") } };
    // delivery creates the entity …
    await db.insert(s.entities).values({ id: "ent_planned_2", workspaceId: "ws_plan", kind: "Application", name: "SAP PM", description: "", attributes: "{}", source: "plan:chg_1" });
    const hydrated = await hydrateDocument(db, doc);
    const card = hydrated.elements.p2 as CardElement;
    expect(card.meta?.planned, "the mark clears itself").toBeUndefined();
    expect(card.meta?.entityId).toBe("ent_planned_2");
    // … and from then on it syncs like any other card
    await syncBoardToGraph(db, { id: "b_plan", workspaceId: "ws_plan" }, hydrated);
    const index = await db.select().from(s.boardEntities).where(eq(s.boardEntities.entityId, "ent_planned_2"));
    expect(index).toHaveLength(1);
  });
});

describe("board ↔ graph sync", () => {
  it("creates entities and relations from a board and indexes board usage", async () => {
    const doc: CanvasDocument = {
      version: 2,
      elements: {
        a: cardEl("a", "ent_a", "CRM"),
        b: cardEl("b", "ent_b", "ERP"),
        c: { id: "c", type: "connector", from: { elementId: "a" }, to: { elementId: "b" }, label: "feeds", stroke: "#000", style: "solid", arrowEnd: true, arrowStart: false, z: 2, meta: { relationId: "rel_ab" } },
      },
    };
    await syncBoardToGraph(db, { id: "b1", workspaceId: "ws" }, doc);
    const snap = await graphSnapshot(db, "ws");
    expect(snap.entities.map((e) => e.name).sort()).toEqual(["CRM", "ERP"]);
    expect(snap.entities.find((e) => e.id === "ent_a")).toMatchObject({ relationCount: 1, boardCount: 1 });
    expect(snap.kinds).toEqual([expect.objectContaining({ kind: "Application", count: 2 })]);
    expect(snap.relationKinds).toEqual([{ kind: "feeds", count: 1 }]);
    const detail = await entityDetail(db, "ent_a");
    expect(detail?.boards.map((b) => b.id)).toEqual(["b1"]);
    expect(detail?.relations[0]).toMatchObject({ kind: "feeds", direction: "out", other: { name: "ERP" } });
  });

  it("updates entities on later saves and hydrates other boards", async () => {
    const doc: CanvasDocument = { version: 2, elements: { a: cardEl("a", "ent_a", "CRM Cloud", "Application") } };
    await syncBoardToGraph(db, { id: "b1", workspaceId: "ws" }, doc);
    const stale: CanvasDocument = { version: 2, elements: { z: cardEl("z", "ent_a", "CRM", "App") } };
    const fresh = await hydrateDocument(db, stale);
    expect(fresh.elements.z).toMatchObject({ title: "CRM Cloud", kind: "Application" });
    // relation connector gone from b1 → relation row stays (graph outlives boards)
    const snap = await graphSnapshot(db, "ws");
    expect(snap.relationKinds).toEqual([{ kind: "feeds", count: 1 }]);
    expect(snap.entities.find((e) => e.id === "ent_b")?.boardCount).toBe(0);
  });
});

describe("import", () => {
  it("parses CSV with a relations section and JSON", () => {
    const p = parseImportText(`kind,name,description\nApplication,SAP,"ERP, finance"\n# relations\nfrom,relation,to\nSAP,depends on,Application:CRM Cloud`);
    expect(p.entities).toEqual([{ kind: "Application", name: "SAP", description: "ERP, finance" }]);
    expect(p.relations).toEqual([{ from: "SAP", kind: "depends on", to: "Application:CRM Cloud" }]);
    expect(parseImportText(`{"entities":[{"kind":"K","name":"N"}],"relations":[]}`).entities).toHaveLength(1);
    // without a description column every extra column is an attribute
    const noDesc = parseImportText(`kind,name,Lifecycle,owner\nServer,srv-1,Active,Platform`);
    expect(noDesc.entities[0]).toEqual({ kind: "Server", name: "srv-1", description: "", attributes: { Lifecycle: "Active", owner: "Platform" } });
  });

  it("matches existing entities by kind + name and creates relations by name", async () => {
    const r = await importGraph(db, "ws", { entities: [{ kind: "application", name: "crm cloud", description: "Sales" }, { kind: "Capability", name: "Billing" }], relations: [{ from: "CRM Cloud", kind: "supports", to: "Billing" }, { from: "Nope", kind: "x", to: "Billing" }] }, "import:test");
    expect(r).toMatchObject({ entitiesCreated: 1, entitiesUpdated: 1, relationsCreated: 1 });
    expect(r.skipped).toHaveLength(1);
    const snap = await graphSnapshot(db, "ws");
    expect(snap.entities.find((e) => e.id === "ent_a")?.description).toBe("Sales");
    expect(snap.entities.filter((e) => e.kind === "Capability")).toHaveLength(1);
  });

  it("lays the graph out as frames per kind with linked cards and connectors", async () => {
    const entities = await db.select().from(s.entities);
    const relations = await db.select().from(s.relations_);
    const doc = buildBoardFromGraph(entities, relations, "Test");
    const els = Object.values(doc.elements);
    expect(els.filter((e) => e.type === "frame")).toHaveLength(2);
    expect(els.filter((e) => e.type === "card").every((c) => c.type === "card" && typeof c.meta?.entityId === "string")).toBe(true);
    expect(els.filter((e) => e.type === "connector")).toHaveLength(relations.length);
  });
});

describe("neighbourhood", () => {
  it("follows relations by depth and direction and returns relations among the set", async () => {
    const { neighborhood } = await import("./graph");
    // ent_a -feeds-> ent_b exists from the first test; add ent_c -> ent_a
    await db.insert(s.entities).values({ id: "ent_c", workspaceId: "ws", kind: "Application", name: "Upstream" });
    await db.insert(s.relations_).values({ id: "rel_ca", workspaceId: "ws", fromEntityId: "ent_c", toEntityId: "ent_a", kind: "sends" });
    // (the import test above also linked ent_a → Billing, so "out" has two neighbours)
    const out = await neighborhood(db, "ws", ["ent_a"], 1, "out");
    expect(out.entities.map((e) => e.id)).toContain("ent_b");
    expect(out.entities.map((e) => e.id)).not.toContain("ent_c");
    expect(out.relations.map((r) => r.id)).toContain("rel_ab");
    const both = await neighborhood(db, "ws", ["ent_a"], 1, "both");
    expect(both.entities.map((e) => e.id)).toContain("ent_c");
    expect(both.relations.map((r) => r.id)).toContain("rel_ca");
    const inbound = await neighborhood(db, "ws", ["ent_a"], 1, "in");
    expect(inbound.entities.map((e) => e.id)).toEqual(["ent_c"]);
    const zero = await neighborhood(db, "ws", ["ent_a", "ent_b"], 0);
    expect(zero.entities).toHaveLength(0);
    expect(zero.relations.map((r) => r.id)).toEqual(["rel_ab"]);
  });
});

describe("attributes", () => {
  it("imports extra CSV columns as attributes and merges them into existing entities", async () => {
    const { importGraph, parseImportText, graphSnapshot } = await import("./graph");
    const payload = parseImportText(`kind,name,description,lifecycle,owner\nApplication,CRM Cloud,,active,Customer\nApplication,New App,Fresh,plan,`);
    expect(payload.entities[0]).toMatchObject({ attributes: { lifecycle: "active", owner: "Customer" } });
    expect(payload.entities[1]).toMatchObject({ attributes: { lifecycle: "plan" } });
    await importGraph(db, "ws", payload, "import:attrs");
    const snap = await graphSnapshot(db, "ws");
    const crm = snap.entities.find((e) => e.id === "ent_a")!;
    expect(crm.attributes).toMatchObject({ lifecycle: "active", owner: "Customer" });
    const appKind = snap.kinds.find((k) => k.kind === "Application")!;
    expect(appKind.attributeKeys.map((a) => a.key)).toEqual(expect.arrayContaining(["lifecycle", "owner"]));
  });

  it("syncs card attributes to the entity and hydrates them back", async () => {
    const { syncBoardToGraph, hydrateDocument, entityDetail } = await import("./graph");
    const doc: CanvasDocument = { version: 2, elements: { a: { ...cardEl("a", "ent_a", "CRM Cloud"), attributes: { lifecycle: "end of life", criticality: "high" } } } };
    await syncBoardToGraph(db, { id: "b1", workspaceId: "ws" }, doc);
    const detail = await entityDetail(db, "ent_a");
    expect(detail?.entity.attributes).toEqual({ lifecycle: "end of life", criticality: "high" });
    expect(detail?.kindAttributeKeys).toContain("criticality");
    const stale: CanvasDocument = { version: 2, elements: { z: cardEl("z", "ent_a", "CRM Cloud") } };
    const fresh = await hydrateDocument(db, stale);
    expect(fresh.elements.z).toMatchObject({ attributes: { lifecycle: "end of life", criticality: "high" } });
  });
});
