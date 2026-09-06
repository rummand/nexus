import Link from "next/link";
import { BookOpen, Search } from "lucide-react";
import { SECTIONS, searchDocs } from "@/lib/docs";

/** The documentation front page: everything there is, and a search over it. */
export default async function DocsIndexPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { slug } = await params;
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const results = query ? searchDocs(query) : [];

  return (
    <article className="doc-article">
      <header className="doc-article-head">
        <h1><BookOpen size={26} /> Documentation</h1>
        <p>How to use Nexus, written for the person doing the architecture rather than the person who built the tool.</p>
      </header>

      <form className="doc-search" action={`/w/${slug}/docs`} method="get">
        <label className="studio-home-search">
          <Search size={15} />
          <input name="q" defaultValue={query} placeholder="Search the documentation — “impact”, “retire a system”, “shortcuts”" aria-label="Search the documentation" />
        </label>
        <button type="submit" className="primary-home-button">Search</button>
      </form>

      {query && (
        <div className="doc-results">
          <p className="doc-caption">{results.length === 0 ? `Nothing matches “${query}”.` : `${results.length} page${results.length === 1 ? "" : "s"} for “${query}”`}</p>
          {results.map(({ page }) => (
            <Link key={page.slug} href={`/w/${slug}/docs/${page.slug}`} className="doc-result">
              <b>{page.title}</b>
              <span>{page.summary}</span>
            </Link>
          ))}
        </div>
      )}

      {!query && SECTIONS.map((section) => (
        <section key={section.title} className="doc-index-section">
          <h2 className="doc-heading">{section.title}</h2>
          <div className="doc-index-grid">
            {section.pages.map((page) => (
              <Link key={page.slug} href={`/w/${slug}/docs/${page.slug}`} className="doc-index-card">
                <b>{page.title}</b>
                <span>{page.summary}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}
