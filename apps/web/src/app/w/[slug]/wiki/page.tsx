import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { BookOpen, FileText, LayoutTemplate } from "lucide-react";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { getWorkspaceBySlug } from "@/lib/data";
import { can } from "@/lib/auth/guard";
import { buildTree, pageSummary } from "@/lib/wiki/pages";
import { WikiTree } from "@/components/wiki/WikiTree";
import { NewPage } from "@/components/wiki/NewPage";

/** The wiki index: the tree, and what is in it (§5.60). */
export default async function WikiIndex({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();
  const db = await getDb();
  const [rows, boards, canEdit] = await Promise.all([
    db.select().from(s.wikiPages).where(eq(s.wikiPages.workspaceId, workspace.id)),
    db.select({ id: s.boards.id, name: s.boards.name }).from(s.boards).where(eq(s.boards.workspaceId, workspace.id)),
    can(workspace.id, "wiki.edit"),
  ]);
  const tree = buildTree(rows);

  return (
    <div className="wiki-shell" data-wiki>
      <aside className="wiki-side">
        <h3>Pages <span>{rows.length}</span></h3>
        <WikiTree nodes={tree} slug={slug} />
        {canEdit && <NewPage workspaceId={workspace.id} slug={slug} boards={boards} />}
      </aside>

      <main className="wiki-main">
        <header className="wiki-head">
          <h1><BookOpen size={18} /> Wiki</h1>
          <p className="muted">
            Pages that <b>reference</b> the model rather than copying it. A board, an object or a
            query put on a page is drawn from the model when the page is read, so a page cannot
            drift behind the architecture it describes.
          </p>
        </header>

        {rows.length === 0 ? (
          <div className="wiki-empty">
            <p><FileText size={22} /></p>
            <h2>Nothing written yet</h2>
            <p>
              Start with a blank page, or let a board write its own first draft — the objects on it,
              their attributes, how they connect and the notes somebody left, with the board itself
              embedded live.
            </p>
            {canEdit && <NewPage workspaceId={workspace.id} slug={slug} boards={boards} prominent />}
          </div>
        ) : (
          <ul className="wiki-index">
            {rows.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((p) => (
              <li key={p.id}>
                <Link href={`/w/${slug}/wiki/${p.slug}`}>
                  <b>{p.icon || <FileText size={14} />} {p.title}</b>
                  <span>{pageSummary(p) || "No text yet."}</span>
                </Link>
                <small>
                  {p.source.startsWith("board:") && <em><LayoutTemplate size={11} /> drafted from a board</em>}
                  {p.updatedByName && <> {p.updatedByName}</>}
                </small>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
