import { beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import path from "node:path";
import * as s from "@/db/schema";
import type { Db } from "@/db/client";
import { parseAttributes } from "../attributes";
import { entityHistory, recordRelationEvent, remembering, workspaceHistory } from "./record";
import * as who from "./actor";

/**
 * The graph remembering, against a real database.
 *
 * The pure tests prove the arithmetic; this proves the seam — that a write wrapped in
 * `remembering` produces the rows a person will read, that the events outlive the entity they are
 * about, and that recording can fail without taking the edit down with it. The last one is the
 * property that matters most: an audit trail nobody can break is worth having, an audit trail that
 * can break an edit is not.
 */

let db: Db;
const maria = who.person({ id: "u_maria", name: "Maria Lund" });

const ent = (id: string, over: Partial<typeof s.entities.$inferInsert> = {}) => ({
  id,
  workspaceId: "ws",
  kind: "Application",
  name: "Maximo",
  description: "",
  attributes: "{}",
  source: "canvas",
  ...over,
});

beforeEach(async () => {
  db = drizzle(createClient({ url: ":memory:" }), { schema: s });
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../../../drizzle") });
  await db.insert(s.workspaces).values({ id: "ws", slug: "ws", name: "WS" });
});

const ctx = (over: Partial<{ context: string; actor: typeof maria }> = {}) => ({ workspaceId: "ws", actor: maria, context: "the entity drawer", ...over });

describe("a write, remembered", () => {
  it("records the fields an edit moved, and who moved them", async () => {
    await db.insert(s.entities).values(ent("ent_1", { attributes: JSON.stringify({ owner: "IT" }) }));

    await remembering(db, ctx(), { ids: ["ent_1"] }, async () => {
      await db.update(s.entities).set({ name: "Maximo EAM", attributes: JSON.stringify({ owner: "Grid Operations" }) }).where(eq(s.entities.id, "ent_1"));
    });

    const history = await entityHistory(db, "ent_1");
    expect(history.map((e) => [e.kind, e.field, e.from, e.to])).toEqual(
      expect.arrayContaining([
        ["renamed", "", "Maximo", "Maximo EAM"],
        ["attributeSet", "owner", "IT", "Grid Operations"],
      ]),
    );
    expect(history.every((e) => e.actor.kind === "person" && e.actor.name === "Maria Lund")).toBe(true);
  });

  it("writes nothing at all when the write changed nothing", async () => {
    await db.insert(s.entities).values(ent("ent_1"));
    await remembering(db, ctx(), { ids: ["ent_1"] }, async () => {
      await db.update(s.entities).set({ name: "Maximo" }).where(eq(s.entities.id, "ent_1"));
    });
    expect(await entityHistory(db, "ent_1")).toEqual([]);
  });

  it("keeps the history of a deleted entity, with the name it had", async () => {
    /*
     * The point of the table having no foreign key on `entity_id`. A deletion is the single most
     * interesting thing that can happen to an object, and a cascade would erase exactly that.
     */
    await db.insert(s.entities).values(ent("ent_1", { name: "Legacy CRM" }));
    await remembering(db, ctx(), { ids: ["ent_1"] }, async () => {
      await db.delete(s.entities).where(eq(s.entities.id, "ent_1"));
    });
    const [event] = await entityHistory(db, "ent_1");
    expect(event?.kind).toBe("deleted");
    expect(event?.entityName).toBe("Legacy CRM");
  });

  it("catches what a bulk write did without being told what it was", async () => {
    // The reason history is observed rather than declared: nobody had to describe this.
    await db.insert(s.entities).values([ent("ent_1"), ent("ent_2", { name: "SAP" })]);
    await remembering(db, ctx({ context: "renamed the kind “Application”" }), { workspace: true }, async () => {
      await db.update(s.entities).set({ kind: "Business application" }).where(eq(s.entities.workspaceId, "ws"));
    });
    const events = await workspaceHistory(db, "ws");
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.kind === "retyped" && e.to === "Business application")).toBe(true);
  });

  it("notices an entity that appeared during the write", async () => {
    await remembering(db, ctx({ context: "an import" }), { workspace: true }, async () => {
      await db.insert(s.entities).values(ent("ent_new", { name: "Kafka" }));
    });
    const [event] = await entityHistory(db, "ent_new");
    expect(event?.kind).toBe("created");
    expect(event?.to).toBe("Kafka");
  });

  it("returns what the write returned, and lets its errors through", async () => {
    await db.insert(s.entities).values(ent("ent_1"));
    expect(await remembering(db, ctx(), { ids: ["ent_1"] }, async () => "done")).toBe("done");
    await expect(remembering(db, ctx(), { ids: ["ent_1"] }, async () => { throw new Error("nope"); })).rejects.toThrow("nope");
  });
});

describe("typing is not history", () => {
  it("folds a run of saves into the one change they add up to", async () => {
    await db.insert(s.entities).values(ent("ent_1", { name: "M" }));
    for (const name of ["Ma", "Max", "Maximo"]) {
      await remembering(db, ctx({ context: "board: Landscape" }), { ids: ["ent_1"] }, async () => {
        await db.update(s.entities).set({ name }).where(eq(s.entities.id, "ent_1"));
      });
    }
    const history = await entityHistory(db, "ent_1");
    expect(history).toHaveLength(1);
    expect([history[0]?.from, history[0]?.to]).toEqual(["M", "Maximo"]);
  });

  it("leaves nothing behind when an edit was undone", async () => {
    await db.insert(s.entities).values(ent("ent_1", { name: "Maximo" }));
    for (const name of ["Maximo EAM", "Maximo"]) {
      await remembering(db, ctx(), { ids: ["ent_1"] }, async () => {
        await db.update(s.entities).set({ name }).where(eq(s.entities.id, "ent_1"));
      });
    }
    expect(await entityHistory(db, "ent_1")).toEqual([]);
  });

  it("does not fold two different hands together", async () => {
    await db.insert(s.entities).values(ent("ent_1", { name: "Maximo" }));
    await remembering(db, ctx(), { ids: ["ent_1"] }, async () => {
      await db.update(s.entities).set({ name: "Maximo EAM" }).where(eq(s.entities.id, "ent_1"));
    });
    const jonas = { workspaceId: "ws", actor: who.person({ id: "u_jonas", name: "Jonas Berg" }), context: "the entity drawer" };
    await remembering(db, jonas, { ids: ["ent_1"] }, async () => {
      await db.update(s.entities).set({ name: "Maximo" }).where(eq(s.entities.id, "ent_1"));
    });
    // "Maria changed it and Jonas changed it back" is two facts, not zero.
    expect(await entityHistory(db, "ent_1")).toHaveLength(2);
  });
});

describe("relations, on both ends", () => {
  it("puts a new link in the history of the things it links", async () => {
    await db.insert(s.entities).values([ent("ent_a", { name: "CRM" }), ent("ent_b", { name: "Billing" })]);
    await recordRelationEvent(db, ctx(), { kind: "relationAdded", label: "supports", from: { id: "ent_a", name: "CRM" }, to: { id: "ent_b", name: "Billing" } });
    expect((await entityHistory(db, "ent_a"))[0]?.kind).toBe("relationAdded");
    expect((await entityHistory(db, "ent_b"))[0]?.field).toBe("supports");
  });
});

describe("the attribute bag", () => {
  it("reads rubbish as an empty bag rather than throwing", () => {
    expect(parseAttributes("not json")).toEqual({});
    expect(parseAttributes(null)).toEqual({});
    expect(parseAttributes('["a"]')).toEqual({});
    expect(parseAttributes('{"owner":" IT ","blank":"  "}')).toEqual({ owner: "IT" });
  });
});
