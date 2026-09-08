import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { revokeSession } from "@/lib/auth/session-store";
import { SESSION_COOKIE } from "@/lib/session";

/**
 * Sign out (§5.41).
 *
 * A POST, not a link: a GET that ends a session can be triggered by an image tag on any page on
 * the internet, and being logged out by somebody else's website is a small but real nuisance.
 *
 * The row is deleted as well as the cookie cleared. Clearing only the cookie leaves a token that
 * still works if it was ever copied, which is exactly the case signing out is meant to close.
 */
export async function POST(req: Request) {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value ?? "";
  if (token) await revokeSession(await getDb(), token);
  jar.delete(SESSION_COOKIE);
  return NextResponse.redirect(new URL("/signin", req.url), { status: 303 });
}
