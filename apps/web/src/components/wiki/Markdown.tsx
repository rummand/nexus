import Link from "next/link";
import { CircleAlert, ExternalLink, Table2 } from "lucide-react";
import type { Block, Inline } from "@/lib/wiki/markdown";
import { embedKey, type EmbedMap, type ResolvedEmbed } from "@/lib/wiki/pages";

/**
 * Rendering a page (§5.60).
 *
 * Blocks in, React elements out — never an HTML string, and so never `dangerouslySetInnerHTML`.
 * The wiki is the one surface where people paste text out of Word and Confluence, and a markdown
 * library that hands back HTML would put that paste one escaping bug away from a script on the
 * page. The one exception is the board embed, whose SVG this app generated itself two function
 * calls ago; it is marked as such where it happens.
 */

export function Markdown({ blocks, embeds, slug, pageBySlug }: {
  blocks: Block[];
  embeds: EmbedMap;
  slug: string;
  /** Title → page slug, so `[[a wiki link]]` can point somewhere or offer to be created. */
  pageBySlug: Map<string, string>;
}) {
  return (
    <div className="wiki-prose">
      {blocks.map((b, i) => <BlockView key={i} block={b} embeds={embeds} slug={slug} pageBySlug={pageBySlug} />)}
    </div>
  );
}

function BlockView({ block, embeds, slug, pageBySlug }: {
  block: Block; embeds: EmbedMap; slug: string; pageBySlug: Map<string, string>;
}) {
  const runs = (r: Inline[]) => <Runs runs={r} slug={slug} pageBySlug={pageBySlug} />;
  switch (block.kind) {
    /*
      A page's own `#` is an h2, not an h1: the page title above it is the h1, and two of those on
      one document is a heading order no screen reader can make sense of.
    */
    case "heading":
      if (block.level === 1) return <h2 id={block.id}>{runs(block.text)}</h2>;
      if (block.level === 2) return <h3 id={block.id}>{runs(block.text)}</h3>;
      if (block.level === 3) return <h4 id={block.id}>{runs(block.text)}</h4>;
      return <h5 id={block.id}>{runs(block.text)}</h5>;
    case "paragraph": return <p>{runs(block.text)}</p>;
    case "quote": return <blockquote>{runs(block.text)}</blockquote>;
    case "rule": return <hr />;
    case "code": return <pre data-language={block.language || undefined}><code>{block.text}</code></pre>;
    case "list":
      return block.ordered
        ? <ol>{block.items.map((it, i) => <li key={i}>{runs(it)}</li>)}</ol>
        : <ul>{block.items.map((it, i) => <li key={i}>{runs(it)}</li>)}</ul>;
    case "table":
      return (
        <div className="wiki-table-wrap">
          <table>
            <thead><tr>{block.head.map((c, i) => <th key={i}>{runs(c)}</th>)}</tr></thead>
            <tbody>{block.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{runs(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
    case "embed":
      return <Embed resolved={embeds.get(embedKey(block.embed, block.target))} caption={block.caption} slug={slug} />;
  }
}

function Runs({ runs, slug, pageBySlug }: { runs: Inline[]; slug: string; pageBySlug: Map<string, string> }) {
  return (
    <>
      {runs.map((r, i) => {
        switch (r.kind) {
          case "strong": return <strong key={i}>{r.text}</strong>;
          case "em": return <em key={i}>{r.text}</em>;
          case "code": return <code key={i}>{r.text}</code>;
          case "link":
            // Only http(s) is followed. A `javascript:` href in a pasted document is the reason.
            return /^https?:\/\//i.test(r.href)
              ? <a key={i} href={r.href} target="_blank" rel="noreferrer noopener">{r.text}<ExternalLink size={11} /></a>
              : <span key={i}>{r.text}</span>;
          case "wikilink": {
            const target = pageBySlug.get(r.title.trim().toLowerCase());
            return target
              ? <Link key={i} className="wiki-link" href={`/w/${slug}/wiki/${target}`}>{r.title}</Link>
              : <span key={i} className="wiki-link missing" title="No page with this title yet">{r.title}</span>;
          }
          default: return <span key={i}>{r.text}</span>;
        }
      })}
    </>
  );
}

/** A live view of something in the model. Never a picture of it. */
function Embed({ resolved, caption, slug }: { resolved: ResolvedEmbed | undefined; caption: string; slug: string }) {
  if (!resolved) return null;

  if (!resolved.ok) {
    return (
      <p className="wiki-embed-missing" data-embed="missing">
        <CircleAlert size={14} />
        <span><b>{resolved.kind} {resolved.target}</b> — {resolved.why}</span>
      </p>
    );
  }

  if (resolved.kind === "board") {
    return (
      <figure className="wiki-embed board" data-embed="board" data-board={resolved.boardId}>
        {/*
          The one place this component emits markup it did not build element by element. It is
          safe for a specific reason rather than by habit: `documentToSvg` produced this string
          from the board's own document a moment ago, on the server, and it escapes the text it
          draws. No user string reaches it unescaped.
        */}
        <div className="wiki-embed-canvas" dangerouslySetInnerHTML={{ __html: resolved.svg }} />
        <figcaption>
          <Link href={`/b/${resolved.boardId}`}>{caption || resolved.name}</Link>
          <span>{resolved.objects} element{resolved.objects === 1 ? "" : "s"} on the board · live, drawn as it is now</span>
        </figcaption>
      </figure>
    );
  }

  if (resolved.kind === "object") {
    const attributes = Object.entries(resolved.attributes).filter(([, v]) => v.trim());
    return (
      <div className="wiki-embed object" data-embed="object" data-object={resolved.id}>
        <header>
          <small>{resolved.objectKind}</small>
          <Link href={`/e/${resolved.id}`}>{resolved.name}</Link>
        </header>
        {resolved.description && <p>{resolved.description}</p>}
        {attributes.length > 0 && (
          <dl>{attributes.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        )}
        {caption && <footer>{caption}</footer>}
      </div>
    );
  }

  return (
    <div className="wiki-embed query" data-embed="query">
      <header>
        <Table2 size={13} />
        <b>{caption || resolved.explanation}</b>
        <span>{resolved.total} match{resolved.total === 1 ? "" : "es"} · live</span>
      </header>
      {resolved.entities.length === 0 ? (
        <p className="muted">Nothing matches this today.</p>
      ) : (
        <ul>
          {resolved.entities.map((e) => (
            <li key={e.id}>
              <Link href={`/e/${e.id}`}>{e.name}</Link>
              <small>{e.kind}</small>
            </li>
          ))}
        </ul>
      )}
      {resolved.total > resolved.entities.length && (
        <footer><Link href={`/w/${slug}/graph?q=${encodeURIComponent(resolved.query)}`}>See all {resolved.total} in the graph →</Link></footer>
      )}
    </div>
  );
}
