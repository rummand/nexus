import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getWorkspaceBySlug } from "@/lib/data";
import { auditFor } from "@/lib/source/audit";
import { Safety } from "@/components/settings/Safety";

/**
 * The read-only safety audit (#111, §5.99).
 *
 * Readable by anybody in the workspace, deliberately: the point of this page is that somebody who
 * is worried can check for themselves, and a promise only administrators may read is a promise
 * nobody outside the room can verify.
 */
export default async function SafetyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();
  const rows = await auditFor(await getDb(), workspace.id);
  return <Safety rows={rows} />;
}
