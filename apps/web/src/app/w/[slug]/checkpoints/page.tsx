import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getWorkspaceBySlug } from "@/lib/data";
import { compareMoments, historyReaches, listCheckpoints } from "@/lib/history/checkpoints";
import { Checkpoints } from "@/components/history/Checkpoints";

/**
 * The estate at a moment, and two moments compared (#112, §5.98).
 *
 * Everything is computed here on the server: the rewind walks the event log, and shipping a
 * workspace's events to the browser to do it there would be both slower and a larger payload
 * than the answer.
 *
 * The two moments come from the query string rather than from state, so a comparison is a link
 * somebody can send — which is most of the point of being able to name a moment at all.
 */
export default async function CheckpointsPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const db = await getDb();
  const [marks, reaches] = await Promise.all([
    listCheckpoints(db, workspace.id),
    historyReaches(db, workspace.id),
  ]);

  /*
   * Default to the oldest named moment against now, because "what has happened since we started
   * keeping track" is the question somebody opening this page for the first time has.
   */
  const from = query.from ?? marks[0]?.at ?? "";
  const to = query.to ?? "";
  const a = from ? new Date(from) : null;
  const b = to ? new Date(to) : new Date();

  const comparison = a && !Number.isNaN(a.getTime()) && b && !Number.isNaN(b.getTime())
    ? await compareMoments(db, workspace.id, a, b)
    : null;

  return (
    <Checkpoints
      slug={slug}
      workspaceId={workspace.id}
      reaches={reaches}
      marks={marks.map((m) => ({ id: m.id, label: m.label, at: m.at, note: m.note }))}
      from={a?.toISOString() ?? ""}
      to={to ? b.toISOString() : ""}
      comparison={comparison && {
        words: "",
        counts: { added: comparison.diff.added.length, removed: comparison.diff.removed.length, changed: comparison.diff.changed.length, untouched: comparison.diff.untouched },
        added: comparison.diff.added.slice(0, 40),
        removed: comparison.diff.removed.slice(0, 40),
        changed: comparison.diff.changed.slice(0, 40),
        more: Math.max(0, comparison.diff.added.length - 40) + Math.max(0, comparison.diff.removed.length - 40) + Math.max(0, comparison.diff.changed.length - 40),
        undone: comparison.after.undone + comparison.before.undone,
      }}
    />
  );
}

export const metadata = { title: "Checkpoints · Nexus" };
