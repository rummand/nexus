import { notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/data";
import { DocsNav } from "@/components/docs/DocsNav";

/**
 * The documentation shell: contents on the left, the page on the right.
 *
 * It lives inside the workspace so the sidebar is still there and every "try it" link can resolve
 * to the reader's own workspace — a how-to should end on the screen it describes, not beside it.
 */
export default async function DocsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await getWorkspaceBySlug(slug))) notFound();
  return (
    <section className="studio-home-main docs" aria-label="Documentation">
      <div className="doc-shell">
        <aside className="doc-nav-column"><DocsNav slug={slug} /></aside>
        {children}
      </div>
    </section>
  );
}
