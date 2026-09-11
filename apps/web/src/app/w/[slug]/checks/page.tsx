import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getWorkspaceBySlug } from "@/lib/data";
import { currentUser } from "@/lib/session";
import { currentCheckout } from "@/lib/change/checkout";
import { checksForRef } from "@/lib/checks/run";
import { Checks } from "@/components/checks/Checks";

/**
 * The model's test suite, run against the ref you are standing on (§5.83).
 *
 * On main it is a list of what is wrong. On a change set it is a verdict: what this proposal
 * adds, what it repairs, and whether anything blocking is among them.
 */
export default async function ChecksPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [workspace, user] = await Promise.all([getWorkspaceBySlug(slug), currentUser()]);
  if (!workspace) notFound();

  const db = await getDb();
  const checkout = await currentCheckout(db, workspace.id, user.id);
  const result = await checksForRef(db, workspace.id, checkout.ref.kind === "main" ? null : checkout.ref.id);

  return <Checks slug={slug} at={checkout.ref} result={result} />;
}

export const metadata = { title: "Checks · Nexus" };
