import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { DEMO_PASSWORD, DEMO_USER_ID } from "@/db/seed";

/**
 * The credentials printed on the sign-in page of a demo instance.
 *
 * Nexus used to need no configuration at all: `pnpm dev` and you were in. Requiring a real sign-in
 * (§5.41) would have traded that away for nothing on a machine whose database is a seeded demo, so
 * the seeded people keep a known password and the sign-in page says so — but only where saying so
 * is harmless.
 *
 * **Never in production unless somebody asks.** In development the hint is shown; in production it
 * takes `NEXUS_DEMO_SIGNIN=1`, which is a deliberate act by whoever runs the instance. It also
 * requires the seeded demo user to still be there with the seeded password, so a real deployment
 * that started from the seed and then changed the password stops advertising it.
 */

export async function demoSignInHint(): Promise<{ email: string; password: string; others: string[] } | null> {
  const enabled = process.env.NEXUS_DEMO_SIGNIN === "1" || (process.env.NODE_ENV !== "production" && process.env.NEXUS_DEMO_SIGNIN !== "0");
  if (!enabled) return null;

  const db = await getDb();
  const demo = await db.query.users.findFirst({ where: eq(s.users.id, DEMO_USER_ID) });
  if (!demo?.passwordHash) return null;
  // Only advertise a password that is still the seeded one.
  const { verifyPassword } = await import("./password");
  if (!(await verifyPassword(DEMO_PASSWORD, demo.passwordHash))) return null;

  const everyone = await db.select({ email: s.users.email }).from(s.users);
  return {
    email: demo.email,
    password: DEMO_PASSWORD,
    // The others matter: signing in as two different people is how you see multiplayer work.
    others: everyone.map((u) => u.email).filter((e) => e !== demo.email).slice(0, 3),
  };
}
