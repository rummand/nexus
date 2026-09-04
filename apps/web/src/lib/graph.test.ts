import { beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import path from "node:path";
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
    expect(snap.kinds).toEqual([{ kind: "Application", count: 2, color: expect.any(String) }]);
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
