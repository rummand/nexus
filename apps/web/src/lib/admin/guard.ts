import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { currentUserOrNull } from "@/lib/session";
import { isPlatformRole, type PlatformRole } from "./platform";

/**
 * The guard in front of the platform console (§5.64).
 *
 * Deliberately *not* part of `lib/auth/guard.ts`. That guard's whole shape is "what may you do in
 * this workspace", and every one of its capabilities takes a workspace id. The console's questions
 * take none — they are about the deployment — and folding them in would mean inventing a fake
 * workspace to ask about, or a capability that silently ignores its argument. Either would make
 * the workspace matrix a worse description of itself.
 *
 * Read per call, like the workspace guard and for the same reason: taking somebody's operator
 * role away has to take effect now, not when their cookie expires.
 */

export interface Operator {
  userId: string;
  name: string;
  email: string;
  role: PlatformRole;
}

export async function operatorOrNull(): Promise<Operator | null> {
  const user = await currentUserOrNull();
  if (!user) return null;
  const db = await getDb();
  const [row] = await db
    .select({ role: s.users.platformRole, name: s.users.name, email: s.users.email })
    .from(s.users)
    .where(eq(s.users.id, user.id));
  if (!isPlatformRole(row?.role)) return null;
  return { userId: user.id, name: row.name, email: row.email, role: row.role };
}

/**
 * The refusal an action returns.
 *
 * One sentence and no detail, on purpose: somebody who is not an operator should not learn from
 * the wording whether the console exists, how many tenants there are, or that their own account
 * was once one. The page above it does the same by answering 404 rather than 403.
 */
export const NOT_AN_OPERATOR = "Only a platform operator may do that.";

export async function denyOperator(): Promise<{ error: string } | null> {
  return (await operatorOrNull()) ? null : { error: NOT_AN_OPERATOR };
}
