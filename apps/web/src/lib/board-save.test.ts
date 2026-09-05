import { beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import path from "node:path";
import * as s from "@/db/schema";
import type { Db } from "@/db/client";
import { parseDocument, serializeDocument, type CanvasDocument } from "@/canvas/document";
import { saveBoardDocument } from "./board-save";
import { createVersion, restoreVersion } from "./versions";

let db: Db;
const docWith = (n: number): CanvasDocument => ({
  version: 2,
  elements: Object.fromEntries(
    Array.from({ length: n }, (_, i) => [`n${i}`, { id: `n${i}`, type: "sticky" as const, x: i * 10, y: 0, w: 100, h: 100, title: "", text: `${i}`, color: "#fff", z: i + 1 }]),
  ),
});

beforeEach(async () => {
  db = drizzle(createClient({ url: ":memory:" }), { schema: s });
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../../drizzle") });
  await db.insert(s.workspaces).values({ id: "ws", slug: "ws", name: "WS" });
  await db.insert(s.spaces).values({ id: "sp", workspaceId: "ws", name: "Space" });
  await db.insert(s.boards).values({ id: "b1", workspaceId: "ws", spaceId: "sp", name: "B1", document: serializeDocument(docWith(1)) });
});

const objects = async () => Object.keys(parseDocument((await db.query.boards.findFirst({ where: eq(s.boards.id, "b1") }))!.document).elements).length;

describe("conditional board save", () => {
  it("bumps the revision on every accepted save", async () => {
    expect(await saveBoardDocument(db, "b1", docWith(2), 0)).toMatchObject({ status: "saved", revision: 1 });
    expect(await saveBoardDocument(db, "b1", docWith(3), 1)).toMatchObject({ status: "saved", revision: 2 });
    expect(await objects()).toBe(3);
  });

  it("refuses a save from a client that did not see the last one", async () => {
    await saveBoardDocument(db, "b1", docWith(2), 0); // the other tab saves
    const stale = await saveBoardDocument(db, "b1", docWith(9), 0); // we still think we are at 0
    expect(stale).toEqual({ status: "conflict", revision: 1 });
    expect(await objects()).toBe(2); // their work is still there
  });

  it("still accepts a save with no revision, so older clients keep working", async () => {
    await saveBoardDocument(db, "b1", docWith(2), 0);
    expect(await saveBoardDocument(db, "b1", docWith(4), null)).toMatchObject({ status: "saved", revision: 2 });
    expect(await objects()).toBe(4);
  });

  it("reports a missing board rather than creating one", async () => {
    expect(await saveBoardDocument(db, "nope", docWith(1), null)).toEqual({ status: "notFound" });
  });

  it("makes a restore win over an editor holding the pre-restore document", async () => {
    const versionId = await createVersion(db, "b1", docWith(5), "manual", "Five");
    const saved = await saveBoardDocument(db, "b1", docWith(2), 0);
    expect(saved).toMatchObject({ status: "saved", revision: 1 });
    await restoreVersion(db, "b1", versionId);
    expect(await objects()).toBe(5);
    // the tab that saved revision 1 tries again from its own state
    expect(await saveBoardDocument(db, "b1", docWith(2), 1)).toMatchObject({ status: "conflict" });
    expect(await objects()).toBe(5);
  });
});
