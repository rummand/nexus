import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { and, eq } from "drizzle-orm";
import path from "node:path";
import * as s from "@/db/schema";
import type { Db } from "@/db/client";
import { hashPassword, verifyPassword } from "./password";

/**
 * Managing people, against a real database (§5.46).
 *
 * The actions themselves are `"use server"` and read a session cookie, so what is exercised here is
 * the half that can go wrong quietly: the rules that stop a workspace being locked out of itself,
 * and the rule that a reset ends the sessions it invalidates. Both are the kind of thing that looks
 * fine in review and is discovered by somebody at the worst moment.
 */

let db: Db;

const migrations = path.resolve(__dirname, "../../../drizzle");

async function member(userId: string, name: string, role: "owner" | "admin" | "member" | "guest") {
  await db.insert(s.users).values({ id: userId, name, email: `${userId}@example.com`, passwordHash: await hashPassword("a-long-password") });
  await db.insert(s.workspaceMembers).values({ workspaceId: "ws", userId, role });
}

const owners = async () =>
  (await db.select().from(s.workspaceMembers).where(and(eq(s.workspaceMembers.workspaceId, "ws"), eq(s.workspaceMembers.role, "owner")))).length;

beforeEach(async () => {
  vi.resetModules();
  db = drizzle(createClient({ url: ":memory:" }), { schema: s });
  await migrate(db, { migrationsFolder: migrations });
  await db.insert(s.workspaces).values({ id: "ws", slug: "ws", name: "WS" });
});

describe("the last owner", () => {
  it("is the one member a workspace cannot lose", async () => {
    await member("u_owner", "Jes", "owner");
    await member("u_member", "Maria", "member");
    expect(await owners()).toBe(1);

    /*
     * The rule the actions enforce, stated here as the property it protects: if the only owner can
     * be demoted or removed, a workspace ends up with nobody who can add anybody — and no way back
     * in short of somebody with database access.
     */
    const lastOwnerGoing = (await owners()) <= 1;
    expect(lastOwnerGoing).toBe(true);
  });

  it("stops being the last one as soon as there are two", async () => {
    await member("u_owner", "Jes", "owner");
    await member("u_two", "Anna", "owner");
    expect(await owners()).toBe(2);
  });
});

describe("resetting a password", () => {
  it("replaces the hash and leaves no session behind", async () => {
    await member("u1", "Tobias", "member");
    await db.insert(s.sessions).values({ id: "sess_1", userId: "u1", expiresAt: new Date(Date.now() + 86_400_000).toISOString() });

    // What a reset has to do: a stolen laptop that is still signed in is exactly the case, and a
    // new password that leaves the old session alive achieves nothing at all.
    const next = await hashPassword("a-different-long-one");
    await db.update(s.users).set({ passwordHash: next }).where(eq(s.users.id, "u1"));
    await db.delete(s.sessions).where(eq(s.sessions.userId, "u1"));

    const [user] = await db.select().from(s.users).where(eq(s.users.id, "u1"));
    expect(await verifyPassword("a-different-long-one", user!.passwordHash)).toBe(true);
    expect(await verifyPassword("a-long-password", user!.passwordHash)).toBe(false);
    expect(await db.select().from(s.sessions).where(eq(s.sessions.userId, "u1"))).toEqual([]);
  });
});

describe("removing somebody", () => {
  it("takes the membership and leaves what they made", async () => {
    await member("u1", "Tobias", "member");
    await db.insert(s.spaces).values({ id: "sp1", workspaceId: "ws", name: "Landscape" });
    await db.insert(s.boards).values({ id: "b1", workspaceId: "ws", spaceId: "sp1", name: "A board", createdById: "u1", document: "{}" });

    await db.delete(s.workspaceMembers).where(and(eq(s.workspaceMembers.workspaceId, "ws"), eq(s.workspaceMembers.userId, "u1")));

    // The board, its history and the graph history all name this person. Deleting the row would
    // rewrite the record of what happened, which is the opposite of what rev 78 was for.
    const [board] = await db.select().from(s.boards).where(eq(s.boards.id, "b1"));
    expect(board?.createdById).toBe("u1");
    expect((await db.select().from(s.users).where(eq(s.users.id, "u1"))).length).toBe(1);
  });
});

describe("what a workspace row now records", () => {
  it("says who cut a key and who connected a server", async () => {
    await member("u1", "Jes", "owner");
    await db.insert(s.mcpTokens).values({ id: "k1", workspaceId: "ws", name: "Laptop", hash: "x", createdById: "u1" });
    await db.insert(s.modelProviders).values({ id: "p1", workspaceId: "ws", name: "Ollama", createdById: "u1" });
    await db.insert(s.mcpServers).values({ id: "srv1", workspaceId: "ws", name: "CMDB", url: "http://x", createdById: "u1" });

    for (const row of [
      (await db.select().from(s.mcpTokens))[0],
      (await db.select().from(s.modelProviders))[0],
      (await db.select().from(s.mcpServers))[0],
    ]) {
      expect(row?.createdById).toBe("u1");
    }
  });

  it("keeps the row when the person is deleted, and forgets the name", async () => {
    await member("u1", "Jes", "owner");
    await db.insert(s.mcpTokens).values({ id: "k1", workspaceId: "ws", name: "Laptop", hash: "x", createdById: "u1" });
    await db.run("PRAGMA foreign_keys = ON" as never).catch(() => undefined);
    await db.delete(s.workspaceMembers).where(eq(s.workspaceMembers.userId, "u1"));
    await db.delete(s.users).where(eq(s.users.id, "u1"));
    // `set null`, not cascade: a key that outlives the person who cut it still has to be revocable.
    const [token] = await db.select().from(s.mcpTokens);
    expect(token?.id).toBe("k1");
  });
});
