import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ArrowRight, ExternalLink, HelpCircle, Lightbulb } from "lucide-react";
import type { Block, DocPage } from "@/lib/docs";
import { resolveHref } from "@/lib/docs";

/**
 * One documentation page.
 *
 * A server component with no interactivity: documentation that needs JavaScript to be read is
 * documentation that fails the person who needed it most — the one whose screen is already
 * misbehaving.
 */
export function DocArticle({ page, slug, previous, next }: {
  page: DocPage;
  slug: string;
  previous: DocPage | null;
  next: DocPage | null;
}) {
  const headings = page.blocks.filter((b): b is Extract<Block, { kind: "heading" }> => b.kind === "heading");
  return (
    <article className="doc-article">
      <header className="doc-article-head">
        <h1>{page.title}</h1>
        <p>{page.summary}</p>
      </header>

      {headings.length > 1 && (
        <nav className="doc-onpage" aria-label="On this page">
          <b>On this page</b>
          <ul>{headings.map((h) => <li key={h.id}><a href={`#${h.id}`}>{h.text}</a></li>)}</ul>
        </nav>
      )}

      {page.blocks.map((block, i) => <BlockView key={i} block={block} slug={slug} />)}

      <nav className="doc-pager" aria-label="More documentation">
        {previous ? (
          <Link href={`/w/${slug}/docs/${previous.slug}`} className="doc-pager-link">
            <ArrowLeft size={14} />
            <span><small>Previous</small>{previous.title}</span>
          </Link>
        ) : <span />}
        {next && (
          <Link href={`/w/${slug}/docs/${next.slug}`} className="doc-pager-link next">
            <span><small>Next</small>{next.title}</span>
            <ArrowRight size={14} />
          </Link>
        )}
      </nav>
    </article>
  );
}

/**
 * Bold and code spans, without a Markdown parser.
 *
 * The docs need emphasis in a sentence and nothing more, so this handles `**bold**` and `` `code` ``
 * and leaves everything else alone. A real parser would be more machinery than the job is worth,
 * and a half-parser that silently mangled an unmatched asterisk would be worse than none.
 */
function inline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
    return <span key={i}>{part}</span>;
  });
}

const NOTE_ICON = {
  tip: <Lightbulb size={15} />,
  warning: <AlertTriangle size={15} />,
  why: <HelpCircle size={15} />,
};

function BlockView({ block, slug }: { block: Block; slug: string }) {
  switch (block.kind) {
    case "heading":
      return <h2 id={block.id} className="doc-heading">{block.text}</h2>;

    case "prose":
      return <p className="doc-prose">{inline(block.text)}</p>;

    case "list":
      return <ul className="doc-list">{block.items.map((item, i) => <li key={i}>{inline(item)}</li>)}</ul>;

    case "steps":
      return (
        <div className="doc-steps">
          {block.title && <b>{block.title}</b>}
          <ol>
            {block.steps.map((step, i) => (
              <li key={i}>
                <span>{inline(step.do)}</span>
                {step.note && <small>{inline(step.note)}</small>}
              </li>
            ))}
          </ol>
        </div>
      );

    case "shot":
      return (
        <figure className="doc-shot">
          {/*
            Fixed intrinsic size because every capture uses the same viewport (scripts/capture-docs.mjs);
            the CSS scales it down and the aspect ratio holds, so nothing jumps as the image loads.
          */}
          <Image src={`/docs/${block.src}.png`} alt={block.alt} width={1560} height={980} sizes="(max-width: 1100px) 100vw, 900px" />
          <figcaption>{block.caption}</figcaption>
        </figure>
      );

    case "note":
      return (
        <aside className={`doc-note ${block.tone}`}>
          <b>{NOTE_ICON[block.tone]} {block.title ?? (block.tone === "warning" ? "Careful" : block.tone === "why" ? "Why it works this way" : "Tip")}</b>
          <p>{inline(block.text)}</p>
        </aside>
      );

    case "table":
      return (
        <div className="doc-table-wrap">
          <table className="doc-table">
            <thead><tr>{block.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>{row.map((cell, j) => <td key={j}>{inline(cell)}</td>)}</tr>
              ))}
            </tbody>
          </table>
          {block.caption && <p className="doc-caption">{block.caption}</p>}
        </div>
      );

    case "keys":
      return (
        <dl className="doc-keys">
          {block.rows.map(([keys, what]) => (
            <div key={keys}>
              <dt><kbd>{keys}</kbd></dt>
              <dd>{what}</dd>
            </div>
          ))}
        </dl>
      );

    case "try":
      return (
        <p className="doc-try">
          <Link href={resolveHref(block.href, slug)}>{block.label} <ExternalLink size={13} /></Link>
          {block.note && <small>{block.note}</small>}
        </p>
      );
  }
}
