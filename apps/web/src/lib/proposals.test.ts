import { beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import path from "node:path";
import * as s from "@/db/schema";
import type { Db } from "@/db/client";
import { computeProposals, mergeEntities, recordDecision } from "./proposals";
import { syncBoardToGraph } from "./graph";
import { parseDocument, serializeDocument, type CanvasDocument, type CardElement } from "@/canvas/document";

let db: Db;
const cardEl = (id: string, entityId: string, title: string, kind: string): CardElement => ({ id, type: "card", x: 0, y: 0, w: 236, h: 124, kind, color: "#000", title, description: "", z: 1, meta: { entityId } });

beforeAll(async () => {
  db = drizzle(createClient({ url: ":memory:" }), { schema: s });
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../../drizzle") });
  await db.insert(s.workspaces).values({ id: "ws", slug: "ws", name: "WS" });
  await db.insert(s.spaces).values({ id: "sp", workspaceId: "ws", name: "Space" });
  await db.insert(s.boards).values([{ id: "b1", workspaceId: "ws", spaceId: "sp", name: "B1" }, { id: "b2", workspaceId: "ws", spaceId: "sp", name: "B2" }]);
  const doc1: CanvasDocument = { version: 2, elements: { a: cardEl("a", "ent_a", "Asset Register", "Application"), x: cardEl("x", "ent_x", "Maximo", "Application"), c: { id: "c", type: "connector", from: { elementId: "x" }, to: { elementId: "a" }, label: "", stroke: "#000", style: "solid", arrowEnd: true, arrowStart: false, z: 2, meta: { relationId: "rel_1" } } } };
  const doc2: CanvasDocument = { version: 2, elements: { b: cardEl("b", "ent_b", "asset register", "Applications"), u: cardEl("u", "ent_u", "Grid Planning Tool", "") } };
  await db.update(s.boards).set({ document: serializeDocument(doc1) }).where(eq(s.boards.id, "b1"));
  await db.update(s.boards).set({ document: serializeDocument(doc2) }).where(eq(s.boards.id, "b2"));
  await syncBoardToGraph(db, { id: "b1", workspaceId: "ws" }, doc1);
  await syncBoardToGraph(db, { id: "b2", workspaceId: "ws" }, doc2);
  await db.insert(s.entities).values({ id: "ent_orphan", workspaceId: "ws", kind: "Application", name: "Old Thing", source: "import:x" });
});

describe("proposals", () => {
  it("finds duplicates, kind variants, untyped entities, unlabelled relations and orphans", async () => {
    const props = await computeProposals(db, "ws");
    const types = props.map((p) => p.type);
    expect(types).toContain("merge");
    expect(types).toContain("kind");
    expect(types).toContain("untyped");
    expect(types).toContain("relation");
    expect(types).toContain("orphan");
    const merge = props.find((p) => p.type === "merge")!;
    expect(merge.entityIds.sort()).toEqual(["ent_a", "ent_b"]);
    expect(merge.action).toMatchObject({ kind: "merge", survivorId: "ent_a" }); // ent_a has the relation
    const kind = props.find((p) => p.type === "kind")!;
    expect(kind.action).toMatchObject({ kind: "renameKind", from: "Applications", to: "Application" });
    const untyped = props.find((p) => p.type === "untyped")!;
    expect(untyped.action).toMatchObject({ kind: "setKind", entityId: "ent_u" });
  });

  it("hides dismissed proposals", async () => {
    const before = await computeProposals(db, "ws");
    const orphan = before.find((p) => p.type === "orphan")!;
    await recordDecision(db, "ws", orphan.key, "dismissed");
    const after = await computeProposals(db, "ws");
    expect(after.find((p) => p.key === orphan.key)).toBeUndefined();
  });

  it("merges entities: relinks cards in board documents, repoints relations, deletes the rest", async () => {
    const r = await mergeEntities(db, "ws", "ent_a", ["ent_b"]);
    expect(r.boardsUpdated).toBe(1);
    const b2 = await db.query.boards.findFirst({ where: eq(s.boards.id, "b2") });
    const doc = parseDocument(b2!.document);
    expect(doc.elements.b).toMatchObject({ meta: { entityId: "ent_a" }, title: "Asset Register", kind: "Application" });
    expect(await db.query.entities.findFirst({ where: eq(s.entities.id, "ent_b") })).toBeUndefined();
    const usage = await db.select().from(s.boardEntities).where(eq(s.boardEntities.entityId, "ent_a"));
    expect(usage.map((u) => u.boardId).sort()).toEqual(["b1", "b2"]);
    const props = await computeProposals(db, "ws");
    expect(props.find((p) => p.type === "merge")).toBeUndefined();
  });
});
