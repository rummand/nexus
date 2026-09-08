import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { currentUserOrNull } from "@/lib/session";
import { allows, capabilitiesOf, isRole, refusal, type Capability, type Role } from "./roles";

/**
 * The guard in front of every administrative action (§5.46).
 *
 * Two shapes, because the actions have two shapes. Most return `{ error }` on refusal and their
 * caller renders it, so `deny()` hands back exactly that or null. A few — route handlers, and
 * actions whose signature has no room for an error — want to stop, so `must()` throws.
 *
 * The membership is read per call rather than cached on the session. A role change has to take
 * effect for somebody who is already signed in, and the alternative is a person keeping powers for
 * as long as their cookie lasts after being demoted, which is the thing revocation exists to stop.
 * It is one indexed lookup on a two-column primary key.
 */

export interface Viewer {
  userId: string | null;
  role: Role | null;
  can: (capability: Capability) => boolean;
  capabilities: Capability[];
}

const NOBODY: Viewer = { userId: null, role: null, can: () => false, capabilities: [] };

/** Who is asking, and what they may do here. */
export async function viewer(workspaceId: string): Promise<Viewer> {
  const user = await currentUserOrNull();
  if (!user) return NOBODY;
  const db = await getDb();
  const [row] = await db
    .select({ role: s.workspaceMembers.role })
    .from(s.workspaceMembers)
    .where(and(eq(s.workspaceMembers.workspaceId, workspaceId), eq(s.workspaceMembers.userId, user.id)));
  const role = isRole(row?.role) ? row.role : null;
  return { userId: user.id, role, can: (c) => allows(role, c), capabilities: capabilitiesOf(role) };
}

/** Whether the person asking may do this here. */
export async function can(workspaceId: string, capability: Capability): Promise<boolean> {
  return (await viewer(workspaceId)).can(capability);
}

/**
 * `null` when it is allowed, `{ error }` when it is not — for the many actions that return that.
 *
 *   const no = await deny(workspaceId, "import.approve");
 *   if (no) return no;
 */
export async function deny(workspaceId: string, capability: Capability): Promise<{ error: string } | null> {
  const v = await viewer(workspaceId);
  return v.can(capability) ? null : { error: refusal(capability, v.role) };
}

/** The same check, for callers with nowhere to put an error. Throws rather than returning. */
export async function must(workspaceId: string, capability: Capability): Promise<Viewer> {
  const v = await viewer(workspaceId);
  if (!v.can(capability)) throw new NotAllowed(refusal(capability, v.role));
  return v;
}

export class NotAllowed extends Error {
  readonly status = 403;
  constructor(message: string) {
    super(message);
    this.name = "NotAllowed";
  }
}

/** The workspace a board belongs to — most board-scoped actions only know the board. */
export async function workspaceOfBoard(boardId: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db.select({ workspaceId: s.boards.workspaceId }).from(s.boards).where(eq(s.boards.id, boardId));
  return row?.workspaceId ?? null;
}

/** The workspace an entity belongs to — likewise for the graph actions. */
export async function workspaceOfEntity(entityId: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db.select({ workspaceId: s.entities.workspaceId }).from(s.entities).where(eq(s.entities.id, entityId));
  return row?.workspaceId ?? null;
}
