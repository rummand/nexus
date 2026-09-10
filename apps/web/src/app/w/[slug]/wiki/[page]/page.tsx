import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { getWorkspaceBySlug } from "@/lib/data";
import { can } from "@/lib/auth/guard";
import { outline, parseMarkdown } from "@/lib/wiki/markdown";
import { buildTree, pageBySlug, resolveEmbeds, trail } from "@/lib/wiki/pages";
import { Markdown } from "@/components/wiki/Markdown";
import { WikiTree } from "@/components/wiki/WikiTree";
import { PageEditor } from "@/components/wiki/PageEditor";
import { NewPage } from "@/components/wiki/NewPage";

/** One wiki page, with its embeds resolved against the model as it is right now (§5.60). */
export default async function WikiPage({ params }: { params: Promise<{ slug: string; page: string }> }) {
  const { slug, page: pageSlug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();
  const db = await getDb();
  const row = await pageBySlug(db, workspace.id, pageSlug);
  if (!row) notFound();

  const blocks = parseMarkdown(row.body);
  const [rows, embeds, boards, canEdit] = await Promise.all([
    db.select().from(s.wikiPages).where(eq(s.wikiPages.workspaceId, workspace.id)),
    resolveEmbeds(db, workspace.id, blocks),
    db.select({ id: s.boards.id, name: s.boards.name }).from(s.boards).where(eq(s.boards.workspaceId, workspace.id)),
    can(workspace.id, "wiki.edit"),
  ]);

  const byTitle = new Map(rows.map((r) => [r.title.trim().toLowerCase(), r.slug]));
  const contents = outline(blocks);

  return (
    <div className="wiki-shell" data-wiki>
      <aside className="wiki-side">
        <h3>Pages <span>{rows.length}</span></h3>
        <WikiTree nodes={buildTree(rows)} slug={slug} current={row.slug} />
        {canEdit && <NewPage workspaceId={workspace.id} slug={slug} boards={boards} parentId={row.id} />}
      </aside>

      <main className="wiki-main" data-wiki-page-view>
        <nav className="wiki-trail">
          <Link href={`/w/${slug}/wiki`}>Wiki</Link>
          {trail(rows, row.id).map((p) => (
            <span key={p.id}>/ <Link href={`/w/${slug}/wiki/${p.slug}`}>{p.title}</Link></span>
          ))}
        </nav>

        <header className="wiki-head">
          <h1>{row.icon && <span className="wiki-icon">{row.icon}</span>}{row.title}</h1>
          <div className="wiki-head-actions">
            <PageEditor pageId={row.id} slug={slug} initialTitle={row.title} initialBody={row.body} canEdit={canEdit} />
          </div>
        </header>

        <div className="wiki-body">
          {contents.length > 2 && (
            <nav className="wiki-contents" aria-label="On this page">
              <h4>On this page</h4>
              <ul>
                {contents.map((h) => (
                  <li key={h.id} data-depth={h.level}><a href={`#${h.id}`}>{h.text}</a></li>
                ))}
              </ul>
            </nav>
          )}
          <article>
            {row.body.trim()
              ? <Markdown blocks={blocks} embeds={embeds} slug={slug} pageBySlug={byTitle} />
              : <p className="muted">This page is empty. {canEdit ? "Press Edit to write it." : ""}</p>}
          </article>
        </div>

        <footer className="wiki-foot">
          {row.source.startsWith("board:") && (
            <span>Drafted from <Link href={`/b/${row.source.slice(6)}`}>a board</Link>.</span>
          )}
          {row.updatedByName && <span>Last edited by {row.updatedByName}.</span>}
        </footer>
      </main>
    </div>
  );
}
