import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { DEMO_USER_ID } from "@/db/seed";

/**
 * Current user. Authentication is not part of brief 1 (see docs/BRIEF.md §5.4), so this
 * resolves to the seeded demo user. When auth lands, this is the single place to change.
 */
export async function currentUser() {
  const db = await getDb();
  const user = await db.query.users.findFirst({ where: eq(users.id, DEMO_USER_ID) });
  if (!user) throw new Error("Demo user missing — database not seeded");
  return user;
}
