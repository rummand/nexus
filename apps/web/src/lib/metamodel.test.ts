import { beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import path from "node:path";
import * as s from "@/db/schema";
import type { Db } from "@/db/client";
import { metaModel } from "./metamodel";

let db: Db;

beforeAll(async () => {
  db = drizzle(createClient({ url: ":memory:" }), { schema: s });
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../../drizzle") });
  await db.insert(s.workspaces).values({ id: "ws", slug: "ws", name: "WS" });
  await db.insert(s.entities).values([
    { id: "e1", workspaceId: "ws", kind: "Application", name: "SAP", attributes: JSON.stringify({ lifecycle: "active", owner: "IT" }) },
    { id: "e2", workspaceId: "ws", kind: "Application", name: "CRM", attributes: JSON.stringify({ lifecycle: "active" }) },
    { id: "e3", workspaceId: "ws", kind: "Server", name: "srv-1", attributes: "{}" },
  ]);
  await db.insert(s.relations_).values([
    { id: "r1", workspaceId: "ws", fromEntityId: "e1", toEntityId: "e2", kind: "depends on" },
    { id: "r2", workspaceId: "ws", fromEntityId: "e1", toEntityId: "e3", kind: "runs on" },
  ]);
  // declare Application with one field that the data uses and one it does not
  await db.insert(s.nodeTypes).values({ id: "nt1", workspaceId: "ws", name: "Application", description: "Business app", color: "#f59e0b" });
  await db.insert(s.nodeTypeFields).values([
    { id: "f1", nodeTypeId: "nt1", key: "lifecycle", dataType: "enum", options: JSON.stringify(["active", "retired"]), position: 0 },
    { id: "f2", nodeTypeId: "nt1", key: "costCentre", dataType: "text", position: 1 },
  ]);
  // declare a type nothing uses yet
  await db.insert(s.nodeTypes).values({ id: "nt2", workspaceId: "ws", name: "Capability" });
  // declare a relation type constrained to Application → Application
  await db.insert(s.relationTypes).values({ id: "rt1", workspaceId: "ws", name: "depends on" });
  await db.insert(s.relationRules).values({ id: "rr1", relationTypeId: "rt1", fromType: "Application", toType: "Application" });
});

describe("metaModel", () => {
  it("classifies node types as declared, undeclared or unused", async () => {
    const m = await metaModel(db, "ws");
    const by = (n: string) => m.nodeTypes.find((t) => t.name === n)!;
    expect(by("Application").presence).toBe("declared");
    expect(by("Application").instances).toBe(2);
    expect(by("Server").presence).toBe("undeclared"); // grown from data, never declared
    expect(by("Capability").presence).toBe("unused");  // declared, no instances
    expect(m.totals.undeclaredNodeTypes).toBe(1);
  });

  it("merges declared fields with attribute keys found in the data", async () => {
    const app = (await metaModel(db, "ws")).nodeTypes.find((t) => t.name === "Application")!;
    const field = (k: string) => app.fields.find((f) => f.key === k)!;
    expect(field("lifecycle")).toMatchObject({ dataType: "enum", usage: 2, presence: "declared" });
    expect(field("lifecycle").options).toEqual(["active", "retired"]);
    expect(field("owner")).toMatchObject({ id: null, usage: 1, presence: "undeclared" }); // in data only
    expect(field("costCentre")).toMatchObject({ usage: 0, presence: "unused" });          // declared only
  });

  it("reports observed from→to pairs and flags ones the rules do not allow", async () => {
    const m = await metaModel(db, "ws");
    const depends = m.relationTypes.find((r) => r.name === "depends on")!;
    expect(depends.observedPairs).toEqual([{ fromType: "Application", toType: "Application", count: 1, declared: true }]);
    const runs = m.relationTypes.find((r) => r.name === "runs on")!;
    expect(runs.presence).toBe("undeclared");
    // no rules on an undeclared type means nothing to violate
    expect(m.totals.violations).toBe(0);
  });

  it("counts a violation when the data breaks a declared rule", async () => {
    await db.insert(s.relations_).values({ id: "r3", workspaceId: "ws", fromEntityId: "e1", toEntityId: "e3", kind: "depends on" });
    const m = await metaModel(db, "ws");
    const depends = m.relationTypes.find((r) => r.name === "depends on")!;
    // Application → Server is not allowed by rule rr1
    expect(depends.observedPairs.find((p) => p.toType === "Server")?.declared).toBe(false);
    expect(m.totals.violations).toBe(1);
  });
});
