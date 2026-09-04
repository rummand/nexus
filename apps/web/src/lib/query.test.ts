import { beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import path from "node:path";
import * as s from "@/db/schema";
import type { Db } from "@/db/client";
import { describeQuery, parseQuery, runQuery } from "./query";

let db: Db;

beforeAll(async () => {
  db = drizzle(createClient({ url: ":memory:" }), { schema: s });
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../../drizzle") });
  await db.insert(s.workspaces).values({ id: "ws", slug: "ws", name: "WS" });
  await db.insert(s.entities).values([
    { id: "ent_sap", workspaceId: "ws", kind: "Application", name: "SAP S/4", attributes: JSON.stringify({ criticality: "high", owner: "Corporate IT" }) },
    { id: "ent_crm", workspaceId: "ws", kind: "Application", name: "CRM Cloud", description: "Sales", attributes: JSON.stringify({ criticality: "medium", lifecycle: "active" }) },
    { id: "ent_hist", workspaceId: "ws", kind: "Application", name: "Historian", attributes: JSON.stringify({ lifecycle: "end of life" }) },
    { id: "ent_cap", workspaceId: "ws", kind: "Business Capability", name: "Billing" },
  ]);
  await db.insert(s.relations_).values([
    { id: "rel_1", workspaceId: "ws", fromEntityId: "ent_crm", toEntityId: "ent_sap", kind: "billing" },
    { id: "rel_2", workspaceId: "ws", fromEntityId: "ent_crm", toEntityId: "ent_cap", kind: "supports" },
  ]);
});

describe("query language", () => {
  it("parses clauses, quoted values and free text", () => {
    const q = parseQuery('? kind:Application owner:"Corporate IT" related:"CRM Cloud" rel:billing legacy system');
    expect(q.kinds).toEqual(["Application"]);
    expect(q.attributes).toEqual([{ key: "owner", value: "Corporate IT" }]);
    expect(q.related).toEqual([{ name: "CRM Cloud", direction: "both" }]);
    expect(q.relationKinds).toEqual(["billing"]);
    expect(q.text).toEqual(["legacy", "system"]);
    expect(q.structured).toBe(true);
    expect(describeQuery(q)).toContain("kind “Application”");
  });

  it("filters by kind and attribute", async () => {
    const r = await runQuery(db, "ws", "kind:app criticality:high");
    expect(r.entities.map((e) => e.name)).toEqual(["SAP S/4"]);
    expect(r.entities[0]!.why).toContain("criticality · high");
  });

  it("follows related / from / to clauses with optional relation kind", async () => {
    expect((await runQuery(db, "ws", "related:crm")).entities.map((e) => e.name).sort()).toEqual(["Billing", "SAP S/4"]);
    expect((await runQuery(db, "ws", 'from:"CRM Cloud" rel:billing')).entities.map((e) => e.name)).toEqual(["SAP S/4"]);
    expect((await runQuery(db, "ws", "to:Billing")).entities.map((e) => e.name)).toEqual(["CRM Cloud"]);
  });

  it("free text searches names, descriptions and attribute values", async () => {
    expect((await runQuery(db, "ws", "sales")).entities.map((e) => e.name)).toEqual(["CRM Cloud"]);
    expect((await runQuery(db, "ws", "end of life")).entities.map((e) => e.name)).toEqual(["Historian"]);
    expect((await runQuery(db, "ws", "")).total).toBe(4);
  });

  it("has: / missing: filter on attribute presence and on: on board placement", async () => {
    await db.insert(s.spaces).values({ id: "sp", workspaceId: "ws", name: "Space" });
    await db.insert(s.boards).values({ id: "b1", workspaceId: "ws", spaceId: "sp", name: "Application landscape" });
    await db.insert(s.boardEntities).values({ boardId: "b1", entityId: "ent_sap", elementId: "el1" });
    const missing = await runQuery(db, "ws", "kind:Application missing:lifecycle");
    expect(missing.entities.map((e) => e.name)).toEqual(["SAP S/4"]);
    const has = await runQuery(db, "ws", "has:lifecycle");
    expect(has.entities.map((e) => e.name).sort()).toEqual(["CRM Cloud", "Historian"]);
    const on = await runQuery(db, "ws", 'on:"landscape"');
    expect(on.entities.map((e) => e.name)).toEqual(["SAP S/4"]);
    expect(on.entities[0]!.why).toContain("on Application landscape");
    expect(describeQuery(parseQuery("missing:owner on:landscape"))).toBe("Entities where no “owner”, on board “landscape”");
  });
});
