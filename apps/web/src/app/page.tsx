import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { getWorkspacesFor } from "@/lib/data";
import { DEMO_WORKSPACE_SLUG } from "@/db/seed";

/**
 * The front door.
 *
 * It used to send everybody to the seeded demo workspace, which was right when there was only one
 * and wrong the moment there were two (§5.48). Now it sends a person to a workspace they are
 * actually in — and falls back to the demo only for somebody who is in none, which on a seeded
 * instance is where they were going anyway.
 */
export default async function Home() {
  const user = await currentUser();
  const mine = await getWorkspacesFor(user.id);
  redirect(`/w/${mine[0]?.slug ?? DEMO_WORKSPACE_SLUG}`);
}
