import { beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { asc, eq } from "drizzle-orm";
import path from "node:path";
import * as s from "@/db/schema";
import type { Db } from "@/db/client";
import { threadsOf, type Comment } from "./threads";

/**
 * Conversations against a real database (§5.50).
 *
 * `threads.test.ts` proves the folding; this proves the storage — the half that fails quietly. A
 * comment outlives the person who wrote it and the card it was about, and that is not a nicety:
 * an architecture decision is usually argued once, and the argument is the part somebody needs two
 * years later. So the properties here are all about what survives a deletion.
 */

let db: Db;
const migrations = path.resolve(__dirname, "../../../drizzle");

const rows = async (boardId = "b1") =>
  (await db.select().from(s.comments).where(eq(s.comments.boardId, boardId)).orderBy(asc(s.comments.createdAt))) as Comment[];

async function say(id: string, over: Partial<typeof s.comments.$inferInsert> = {}) {
  await db.insert(s.comments).values({
    id,
    workspaceId: "ws",
    boardId: "b1",
    authorId: "u_maria",
    authorName: "Maria Lund",
    body: `said ${id}`,
    createdAt: `2026-09-09T10:0${id.slice(-1)}:00.000Z`,
    ...over,
  });
}

beforeEach(async () => {
  db = drizzle(createClient({ url: ":memory:" }), { schema: s });
  await migrate(db, { migrationsFolder: migrations });
  await db.insert(s.workspaces).values({ id: "ws", slug: "ws", name: "WS" });
  await db.insert(s.spaces).values({ id: "sp", workspaceId: "ws", name: "Space", emoji: "📁" });
  await db.insert(s.boards).values({ id: "b1", workspaceId: "ws", spaceId: "sp", name: "Landscape" });
  await db.insert(s.users).values({ id: "u_maria", name: "Maria Lund", email: "maria@example.com", passwordHash: "x" });
});

describe("a conversation on a board", () => {
  it("round-trips into the shape the panel reads", async () => {
    await say("c1", { elementId: "el_1", anchorLabel: "Maximo" });
    await say("c2", { parentId: "c1", authorId: null, authorName: "Jes Olsen" });

    const [thread, ...rest] = threadsOf(await rows());
    expect(rest).toEqual([]);
    expect(thread!.anchorLabel).toBe("Maximo");
    expect(thread!.replies.map((r) => r.body)).toEqual(["said c2"]);
    expect(thread!.voices).toEqual(["Maria Lund", "Jes Olsen"]);
    expect(thread!.resolved).toBe(false);
  });

  it("settles without being deleted, and drops below the open ones", async () => {
    await say("c1", { resolvedAt: "2026-09-09T11:00:00.000Z", resolvedById: "u_maria", resolvedByName: "Maria Lund" });
    await say("c2");

    const threads = threadsOf(await rows());
    expect(threads.map((t) => [t.id, t.resolved])).toEqual([["c2", false], ["c1", true]]);
    expect(threads[1]!.opening.resolvedByName).toBe("Maria Lund");
  });
});

describe("what a deletion takes with it", () => {
  it("keeps a reply when the question it answered is withdrawn", async () => {
    await say("c1");
    await say("c2", { parentId: "c1", authorName: "Jes Olsen" });
    await db.delete(s.comments).where(eq(s.comments.id, "c1"));

    /*
     * No foreign key on parent_id, deliberately: somebody taking back their own question must not
     * silently delete three colleagues' answers to it. The orphan becomes a thread of its own.
     */
    const threads = threadsOf(await rows());
    expect(threads.map((t) => t.id)).toEqual(["c2"]);
    expect(threads[0]!.opening.body).toBe("said c2");
  });

  it("keeps the name of somebody who has left", async () => {
    await say("c1");
    await db.delete(s.users).where(eq(s.users.id, "u_maria"));

    const [row] = await rows();
    expect(row!.authorId).toBeNull();
    expect(row!.authorName).toBe("Maria Lund");
  });

  it("takes the conversations when the board itself goes", async () => {
    await say("c1");
    await db.delete(s.boards).where(eq(s.boards.id, "b1"));
    expect(await rows()).toEqual([]);
  });

  it("keeps a thread about an object that is gone, and says so", async () => {
    await say("c1", { elementId: "el_gone", anchorLabel: "Old billing service" });
    const [thread] = threadsOf(await rows());
    // The element is not a foreign key — the document is JSON — so nothing cascades; the panel
    // labels it instead. Losing the reasoning at the moment it became history is the wrong answer.
    expect(thread!.elementId).toBe("el_gone");
    expect(thread!.anchorLabel).toBe("Old billing service");
  });
});
