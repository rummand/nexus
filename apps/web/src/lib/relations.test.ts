import { beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import path from "node:path";
import * as s from "@/db/schema";
import type { Db } from "@/db/client";
import { createRelation, deleteRelation } from "./relations";
import { parseDocument, serializeDocument, type CanvasDocument } from "@/canvas/document";

let db: Db;

beforeAll(async () => {
  db = drizzle(createClient({ url: ":memory:" }), { schema: s });
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../../drizzle") });
  await db.insert(s.workspaces).values({ id: "ws", slug: "ws", name: "WS" });
  await db.insert(s.spaces).values({ id: "sp", workspaceId: "ws", name: "Space" });
  await db.insert(s.entities).values([
    { id: "ent_a", workspaceId: "ws", kind: "Application", name: "A" },
    { id: "ent_b", workspaceId: "ws", kind: "Application", name: "B" },
  ]);
});

describe("relations", () => {
  it("creates once and dedupes by ends + kind (case-insensitive)", async () => {
    const first = await createRelation(db, "ws", "ent_a", "uses", "ent_b");
    const again = await createRelation(db, "ws", "ent_a", "Uses ", "ent_b");
    expect(first.created).toBe(true);
    expect(again).toEqual({ id: first.id, created: false });
    const other = await createRelation(db, "ws", "ent_a", "owns", "ent_b");
    expect(other.created).toBe(true);
    await expect(createRelation(db, "ws", "ent_a", "x", "ent_a")).rejects.toThrow();
    await expect(createRelation(db, "ws", "ent_a", "x", "ent_missing")).rejects.toThrow();
  });

  it("deleting a relation also removes its connectors from board documents", async () => {
    const { id } = await createRelation(db, "ws", "ent_b", "feeds", "ent_a");
    const doc: CanvasDocument = { version: 2, elements: {
      a: { id: "a", type: "card", x: 0, y: 0, w: 200, h: 100, z: 1, kind: "Application", color: "#000", title: "A", description: "", meta: { entityId: "ent_a" } },
      b: { id: "b", type: "card", x: 400, y: 0, w: 200, h: 100, z: 2, kind: "Application", color: "#000", title: "B", description: "", meta: { entityId: "ent_b" } },
      c: { id: "c", type: "connector", from: { elementId: "b" }, to: { elementId: "a" }, label: "feeds", stroke: "#000", style: "solid", arrowEnd: true, arrowStart: false, z: 3, meta: { relationId: id } },
    } };
    await db.insert(s.boards).values({ id: "b1", workspaceId: "ws", spaceId: "sp", name: "B1", document: serializeDocument(doc) });
    const r = await deleteRelation(db, id);
    expect(r).toEqual({ deleted: true, boardsUpdated: 1 });
    const board = await db.query.boards.findFirst({ where: eq(s.boards.id, "b1") });
    expect(Object.keys(parseDocument(board!.document).elements).sort()).toEqual(["a", "b"]);
    expect(await db.query.relations_.findFirst({ where: eq(s.relations_.id, id) })).toBeUndefined();
    expect(await deleteRelation(db, "rel_nope")).toEqual({ deleted: false, boardsUpdated: 0 });
  });
});
