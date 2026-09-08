import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getWorkspaceBySlug } from "@/lib/data";
import { workspaceHistory } from "@/lib/history/record";
import { WhatChanged } from "@/components/history/WhatChanged";

/**
 * What changed: the knowledge graph's own history (§5.43).
 *
 * Read on the server and handed over whole. A workspace's history is unbounded and a browser has
 * no business paging through it one fetch at a time to answer "what happened yesterday" — so the
 * page takes the most recent slice, says so, and filters that in the client where it is instant.
 */

const CAP = 300;

export default async function HistoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();
  const db = await getDb();
  const events = await workspaceHistory(db, workspace.id, { limit: CAP });
  return <WhatChanged slug={slug} events={events} cap={CAP} />;
}
