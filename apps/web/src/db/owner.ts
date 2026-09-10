import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Db } from "./client";
import * as s from "./schema";
import { hashPassword } from "@/lib/auth/password";

/**
 * Bootstrapping a real owner from the environment (§5.61).
 *
 * Nexus has no self-signup by design: accounts are made by somebody who already has one. That is
 * right for a workspace tool and wrong for the very first person, who has nobody to ask — a fresh
 * deployment could only be entered through the seeded demo account, and an operator who had
 * already seeded and then changed that password had no way in at all.
 *
 * So: three environment variables, read on every start.
 *
 *   NEXUS_OWNER_EMAIL      the account to guarantee exists
 *   NEXUS_OWNER_PASSWORD   its password, hashed here and never stored or logged in the clear
 *   NEXUS_OWNER_NAME       optional; the email's local part is used if it is absent
 *
 * On every start rather than only on an empty database, because the case that actually bites is
 * the *already seeded* one. It is idempotent: an existing account is left alone except for being
 * made an owner of every workspace.
 *
 * It will not silently reset a password. If the account exists with one, the env variable is
 * ignored unless `NEXUS_OWNER_PASSWORD_RESET=1` is set as well — otherwise a stale value in a
 * deployment's configuration would quietly undo every password change anybody ever made.
 */

export interface OwnerBootstrap {
  email: string;
  password: string;
  name: string;
  /** Overwrite the password of an account that already has one. */
  reset: boolean;
}

/** What the environment asks for, or null when it asks for nothing. Pure, so it can be tested. */
export function ownerFromEnv(env: Record<string, string | undefined>): OwnerBootstrap | null {
  const email = (env.NEXUS_OWNER_EMAIL ?? "").trim().toLowerCase();
  const password = env.NEXUS_OWNER_PASSWORD ?? "";
  if (!email || !password) return null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null;
  const fallback = email.split("@")[0]!.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    email,
    password,
    name: (env.NEXUS_OWNER_NAME ?? "").trim() || fallback,
    reset: env.NEXUS_OWNER_PASSWORD_RESET === "1",
  };
}

export type OwnerResult =
  | { status: "off" }
  | { status: "refused"; why: string }
  | { status: "created" | "joined" | "reset" | "present"; email: string; workspaces: number };

/**
 * Make sure the account named by the environment exists and owns every workspace.
 *
 * Never throws: a deployment must still start if this cannot be done, or a typo in one variable
 * takes the whole application down.
 */
export async function ensureOwner(db: Db, env: Record<string, string | undefined> = process.env): Promise<OwnerResult> {
  const want = ownerFromEnv(env);
  if (!want) return { status: "off" };

  /*
   * A floor, not the application's account-creation rule.
   *
   * `passwordProblem` asks for ten characters, and that is right where one person sets another
   * person's password in the People page: it is a default somebody else has to live with. This is
   * a different act — an operator setting *their own* password in the configuration of their own
   * deployment, where the alternative to accepting it is a deployment nobody can sign in to. So
   * the floor here is eight, and it is the only place the two differ. The in-app rule is
   * untouched, which does mean a password accepted here cannot later be re-entered in the app.
   */
  const OPERATOR_FLOOR = 8;
  if (want.password.length < OPERATOR_FLOOR) {
    return { status: "refused", why: `NEXUS_OWNER_PASSWORD must be at least ${OPERATOR_FLOOR} characters.` };
  }
  if (want.password.length > 200) return { status: "refused", why: "That password is longer than 200 characters." };

  try {
    const existing = await db.query.users.findFirst({ where: eq(s.users.email, want.email) });
    const workspaces = await db.select({ id: s.workspaces.id }).from(s.workspaces);
    let status: "created" | "joined" | "reset" | "present" = "present";
    let userId = existing?.id ?? "";

    if (!existing) {
      userId = `usr_${nanoid(10)}`;
      await db.insert(s.users).values({
        id: userId, name: want.name, email: want.email,
        passwordHash: await hashPassword(want.password), color: "#1376d4",
      });
      status = "created";
    } else if (want.reset || !existing.passwordHash) {
      await db.update(s.users).set({ passwordHash: await hashPassword(want.password) }).where(eq(s.users.id, userId));
      status = "reset";
    }

    /*
     * The bootstrapped account also runs the deployment (§5.64).
     *
     * It is the same argument that put this file here: the first person has nobody to ask. A
     * platform console that only an operator can reach, on a deployment with no operator, is a
     * console nobody can ever open — so the one account the operator of the machine can already
     * prove they control is the one that gets it.
     */
    if (existing?.platformRole !== "operator") {
      await db.update(s.users).set({ platformRole: "operator" }).where(eq(s.users.id, userId));
    }

    for (const w of workspaces) {
      const [member] = await db.select().from(s.workspaceMembers)
        .where(and(eq(s.workspaceMembers.workspaceId, w.id), eq(s.workspaceMembers.userId, userId)));
      if (!member) {
        await db.insert(s.workspaceMembers).values({ workspaceId: w.id, userId, role: "owner" });
        if (status === "present") status = "joined";
      } else if (member.role !== "owner") {
        await db.update(s.workspaceMembers).set({ role: "owner" })
          .where(and(eq(s.workspaceMembers.workspaceId, w.id), eq(s.workspaceMembers.userId, userId)));
        if (status === "present") status = "joined";
      }
    }
    return { status, email: want.email, workspaces: workspaces.length };
  } catch (e) {
    return { status: "refused", why: e instanceof Error ? e.message : "unknown error" };
  }
}

/** One line for the server log. Says what happened and never what the password was. */
export function ownerLine(r: OwnerResult): string | null {
  switch (r.status) {
    case "off": return null;
    case "refused": return `nexus: NEXUS_OWNER_EMAIL was not applied — ${r.why}`;
    case "created": return `nexus: created owner ${r.email} and gave them ${r.workspaces} workspace(s)`;
    case "reset": return `nexus: reset the password for ${r.email}`;
    case "joined": return `nexus: ${r.email} is now an owner of every workspace`;
    case "present": return null;
  }
}
