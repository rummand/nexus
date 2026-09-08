import { beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import path from "node:path";
import { eq } from "drizzle-orm";
import * as s from "@/db/schema";
import type { Db } from "@/db/client";
import { createSession, purgeExpiredSessions, readSession, revokeAllSessions, revokeSession, sessionId } from "./session-store";

/**
 * A session, from issued to revoked.
 *
 * The claims worth testing are the ones a person would notice if they broke: that a token works,
 * that signing out stops it working *for everybody who has a copy*, and that an expired row is
 * not a way in. The last one is the reason expiry is a `WHERE` clause and not an `if`.
 */

let db: Db;

beforeAll(async () => {
  db = drizzle(createClient({ url: ":memory:" }), { schema: s });
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../../../drizzle") });
  await db.insert(s.users).values([
    { id: "u1", name: "Jes Olsen", email: "jes@example.test", color: "#1376d4" },
    { id: "u2", name: "Maria Lund", email: "maria@example.test", color: "#0ea5e9" },
  ]);
});

describe("a session", () => {
  it("names the person who signed in", async () => {
    const token = await createSession(db, "u1", "a browser");
    const found = await readSession(db, token);
    expect(found?.user.email).toBe("jes@example.test");
    expect(found?.session.userAgent).toBe("a browser");
  });

  it("is not the token that was handed out", async () => {
    const token = await createSession(db, "u1");
    const rows = await db.select().from(s.sessions).where(eq(s.sessions.id, sessionId(token)));
    expect(rows).toHaveLength(1);
    // What is on disk cannot be pasted into a cookie: that is the whole point of hashing a secret
    // that is already random.
    expect(rows[0]!.id).not.toBe(token);
    expect(await db.select().from(s.sessions).where(eq(s.sessions.id, token))).toHaveLength(0);
  });

  it("says nothing for a token nobody issued", async () => {
    expect(await readSession(db, "")).toBeNull();
    expect(await readSession(db, "a-token-i-made-up")).toBeNull();
  });

  it("stops working the moment it is revoked", async () => {
    const token = await createSession(db, "u1");
    expect(await readSession(db, token)).not.toBeNull();
    await revokeSession(db, token);
    // The reason sessions are a table rather than a self-describing signed cookie: a stateless
    // token cannot be taken back, and "sign out" has to mean something.
    expect(await readSession(db, token)).toBeNull();
  });

  it("signs one person out everywhere without touching anybody else", async () => {
    const mine = [await createSession(db, "u2"), await createSession(db, "u2")];
    const theirs = await createSession(db, "u1");
    await revokeAllSessions(db, "u2");
    for (const token of mine) expect(await readSession(db, token)).toBeNull();
    expect(await readSession(db, theirs)).not.toBeNull();
  });

  it("refuses one whose time has passed, and sweeps it up", async () => {
    const token = await createSession(db, "u1");
    await db
      .update(s.sessions)
      .set({ expiresAt: new Date(Date.now() - 60_000).toISOString() })
      .where(eq(s.sessions.id, sessionId(token)));

    expect(await readSession(db, token)).toBeNull();
    await purgeExpiredSessions(db);
    expect(await db.select().from(s.sessions).where(eq(s.sessions.id, sessionId(token)))).toHaveLength(0);
  });

  it("pushes the expiry forward for somebody who is still here", async () => {
    const token = await createSession(db, "u1");
    const id = sessionId(token);
    // Pretend it was issued a week ago and is a day from lapsing.
    const soon = new Date(Date.now() + 86_400_000).toISOString();
    await db
      .update(s.sessions)
      .set({ createdAt: new Date(Date.now() - 7 * 86_400_000).toISOString(), expiresAt: soon })
      .where(eq(s.sessions.id, id));

    await readSession(db, token);
    const after = await db.query.sessions.findFirst({ where: eq(s.sessions.id, id) });
    // Being signed out mid-sentence because thirty days elapsed is not security, it is rudeness.
    expect(new Date(after!.expiresAt).getTime()).toBeGreaterThan(new Date(soon).getTime());
  });

  it("goes when the person does", async () => {
    await db.insert(s.users).values({ id: "u3", name: "Temp", email: "temp@example.test", color: "#000000" });
    const token = await createSession(db, "u3");
    await db.delete(s.users).where(eq(s.users.id, "u3"));
    // The foreign key cascades, so a deleted account cannot leave a working key behind.
    expect(await readSession(db, token)).toBeNull();
  });
});
