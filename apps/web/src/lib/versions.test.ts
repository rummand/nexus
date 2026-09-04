import { beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import path from "node:path";
import * as s from "@/db/schema";
import type { Db } from "@/db/client";
import { parseDocument, serializeDocument, type CanvasDocument } from "@/canvas/document";
import { AUTO_INTERVAL_MS, autoCheckpoint, createVersion, listVersions, restoreVersion } from "./versions";

let db: Db;
const docWith = (n: number): CanvasDocument => ({ version: 2, elements: Object.fromEntries(Array.from({ length: n }, (_, i) => [`n${i}`, { id: `n${i}`, type: "sticky" as const, x: i * 10, y: 0, w: 100, h: 100, title: "", text: `${i}`, color: "#fff", z: i + 1 }])) });

beforeAll(async () => {
  db = drizzle(createClient({ url: ":memory:" }), { schema: s });
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../../drizzle") });
  await db.insert(s.workspaces).values({ id: "ws", slug: "ws", name: "WS" });
  await db.insert(s.spaces).values({ id: "sp", workspaceId: "ws", name: "Space" });
  await db.insert(s.boards).values({ id: "b1", workspaceId: "ws", spaceId: "sp", name: "B1", document: serializeDocument(docWith(3)) });
});

describe("version history", () => {
  it("takes an auto checkpoint only when the last one is old enough", async () => {
    const t0 = Date.parse("2026-09-04T20:00:00Z");
    expect(await autoCheckpoint(db, "b1", docWith(1), t0)).toBe(true);
    expect(await autoCheckpoint(db, "b1", docWith(2), t0 + 1000)).toBe(false);
    expect(await autoCheckpoint(db, "b1", docWith(2), t0 + AUTO_INTERVAL_MS + 1)).toBe(false); // createdAt is real "now", far newer than t0
    expect(await autoCheckpoint(db, "b1", docWith(2), Date.now() + AUTO_INTERVAL_MS + 1)).toBe(true);
    expect(await autoCheckpoint(db, "b1", { version: 2, elements: {} }, Date.now() + 10 * AUTO_INTERVAL_MS)).toBe(false); // empty boards are not checkpointed
    const list = await listVersions(db, "b1");
    expect(list.map((v) => v.objectCount)).toEqual([2, 1]);
  });

  it("restores a version and keeps the replaced state as a checkpoint", async () => {
    const id = await createVersion(db, "b1", docWith(5), "manual", "Five things");
    const restored = await restoreVersion(db, "b1", id);
    expect(Object.keys(restored!.elements)).toHaveLength(5);
    const board = await db.query.boards.findFirst({ where: eq(s.boards.id, "b1") });
    expect(Object.keys(parseDocument(board!.document).elements)).toHaveLength(5);
    const list = await listVersions(db, "b1");
    expect(list[0]).toMatchObject({ reason: "restore", objectCount: 3 });
    expect(list.find((v) => v.id === id)).toMatchObject({ label: "Five things", reason: "manual" });
  });
});
