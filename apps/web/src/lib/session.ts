import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { readSession } from "@/lib/auth/session-store";

/**
 * Who is asking.
 *
 * Since rev 76 this is a real person: the session cookie names a row in `sessions`, which names a
 * row in `users`. Before that it always returned the seeded demo user, and the whole product was
 * written against that one function — which is why turning authentication on was a change to this
 * file and a sign-in page, rather than to the twenty-five places that ask.
 *
 * `currentUser()` **redirects** rather than returning null. Every caller is a page or an action
 * behind the gate, and each one having to invent its own answer to "there is nobody here" is how
 * a product ends up with five different ways of being logged out. Route handlers, which cannot
 * usefully redirect a machine, use `currentUserOrNull()`.
 */

export const SESSION_COOKIE = "nexus_session";

export async function currentUserOrNull() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  if (!token) return null;
  const db = await getDb();
  return (await readSession(db, token))?.user ?? null;
}

export async function currentUser() {
  const user = await currentUserOrNull();
  // A cookie that does not resolve is as good as none: expired, revoked, or forged.
  if (!user) redirect("/signin");
  return user;
}
