import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";

/**
 * Sessions: issue one, read one, take one back.
 *
 * Deliberately not a "use server" module and deliberately not React-aware — it takes a `Db` and
 * returns rows, so the sign-in action, the route handlers and the tests all use the same code.
 * Reading the cookie is somebody else's job (`src/lib/session.ts`).
 *
 * **The token is never stored.** The cookie holds 32 random bytes; the table holds their SHA-256.
 * A stolen database backup therefore contains no usable session, which is the whole reason to
 * hash something that is already random: it is not about guessing, it is about blast radius.
 */

/** Thirty days, refreshed on use. Long enough not to nag, short enough to expire a forgotten tab. */
export const SESSION_DAYS = 30;
/** Re-issue the expiry when a session is more than a day old, so an active person is never logged out. */
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

export const sessionId = (token: string) => createHash("sha256").update(token).digest("hex");

const isoIn = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

/** Start a session and return the token to put in the cookie. It cannot be recovered afterwards. */
export async function createSession(db: Db, userId: string, userAgent?: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.insert(s.sessions).values({
    id: sessionId(token),
    userId,
    expiresAt: isoIn(SESSION_DAYS),
    userAgent: userAgent?.slice(0, 200) ?? null,
  });
  return token;
}

/**
 * The user behind a token, or null.
 *
 * Expiry is checked in the query rather than in JavaScript so a clock-skewed or half-migrated row
 * cannot accidentally read as valid, and an active session has its expiry pushed forward — being
 * signed out mid-sentence because thirty days happened to elapse is not security, it is rudeness.
 */
export async function readSession(db: Db, token: string) {
  if (!token) return null;
  const id = sessionId(token);
  const now = new Date().toISOString();
  const row = await db.query.sessions.findFirst({
    where: and(eq(s.sessions.id, id), gt(s.sessions.expiresAt, now)),
  });
  if (!row) return null;

  const user = await db.query.users.findFirst({ where: eq(s.users.id, row.userId) });
  if (!user) return null;

  if (Date.now() - new Date(row.createdAt).getTime() > REFRESH_AFTER_MS) {
    await db.update(s.sessions).set({ expiresAt: isoIn(SESSION_DAYS) }).where(eq(s.sessions.id, id));
  }
  return { session: row, user };
}

/** End this one session — signing out of this browser and nothing else. */
export async function revokeSession(db: Db, token: string) {
  if (token) await db.delete(s.sessions).where(eq(s.sessions.id, sessionId(token)));
}

/** End every session a person has, which is what a changed password has to mean. */
export async function revokeAllSessions(db: Db, userId: string) {
  await db.delete(s.sessions).where(eq(s.sessions.userId, userId));
}

/** Housekeeping: rows whose time has passed are dead weight and a small privacy liability. */
export async function purgeExpiredSessions(db: Db) {
  await db.delete(s.sessions).where(lt(s.sessions.expiresAt, new Date().toISOString()));
}
