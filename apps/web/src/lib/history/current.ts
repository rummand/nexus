import { currentUserOrNull } from "@/lib/session";
import { person, system } from "./actor";
import type { Actor } from "./events";

/**
 * The actor for the request in hand.
 *
 * Separate from `actor.ts` because this one reads the session cookie, which only a page, a server
 * action or a route handler may do. Everything else — the seed, a scheduled agent, a test — builds
 * its actor explicitly, which is the point.
 */
export async function currentActor(): Promise<Actor> {
  const user = await currentUserOrNull();
  return user ? person(user) : system();
}
