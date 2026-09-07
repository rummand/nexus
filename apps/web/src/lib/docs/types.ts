/**
 * The documentation, as data.
 *
 * Authored in TypeScript rather than Markdown on purpose. A page here is not only prose: it has
 * numbered procedures, screenshots with captions, and links that resolve to *the reader's own*
 * workspace so a how-to ends on the screen it describes rather than next to it. A typed block
 * vocabulary gives all of that with no parser to get subtly wrong and no new dependency, and the
 * compiler catches a screenshot that no longer exists or a link with no destination.
 */

export type Block =
  | { kind: "prose"; text: string }
  /** A section heading within a page; also what the on-page contents list is built from. */
  | { kind: "heading"; text: string; id: string }
  | { kind: "steps"; title?: string; steps: Array<{ do: string; note?: string }> }
  /** A screenshot from `public/docs`, captured by scripts/capture-docs.mjs. */
  | { kind: "shot"; src: string; caption: string; alt: string }
  | { kind: "note"; tone: "tip" | "warning" | "why"; title?: string; text: string }
  | { kind: "table"; columns: string[]; rows: string[][]; caption?: string }
  /** Keyboard reference: [keys, what it does]. */
  | { kind: "keys"; rows: Array<[string, string]> }
  /** Opens the screen being described, in the reader's workspace. `href` may contain :slug. */
  | { kind: "try"; href: string; label: string; note?: string }
  | { kind: "list"; items: string[] };

export interface DocPage {
  slug: string;
  title: string;
  /** One line, shown in the contents and in search results. */
  summary: string;
  /** Words a person might search for that do not appear in the prose. */
  keywords?: string[];
  blocks: Block[];
}

export interface DocSection {
  title: string;
  pages: DocPage[];
}

/** Resolve `:slug` in a "try it" link against the workspace the reader is in. */
export function resolveHref(href: string, slug: string): string {
  return href.replace(/:slug/g, slug);
}

/** Plain text of a page, for search. */
export function pageText(page: DocPage): string {
  const parts: string[] = [page.title, page.summary, ...(page.keywords ?? [])];
  for (const block of page.blocks) {
    switch (block.kind) {
      case "prose":
      case "heading":
        parts.push(block.text);
        break;
      case "steps":
        parts.push(block.title ?? "", ...block.steps.flatMap((s) => [s.do, s.note ?? ""]));
        break;
      case "shot":
        parts.push(block.caption);
        break;
      case "note":
        parts.push(block.title ?? "", block.text);
        break;
      case "table":
        parts.push(block.caption ?? "", ...block.columns, ...block.rows.flat());
        break;
      case "keys":
        parts.push(...block.rows.flat());
        break;
      case "try":
        parts.push(block.label, block.note ?? "");
        break;
      case "list":
        parts.push(...block.items);
        break;
    }
  }
  return parts.filter(Boolean).join(" ");
}

/**
 * The inline markup the documentation renderer understands: `**bold**`, `*emphasis*`, `` `code` ``.
 *
 * It lives here rather than in the renderer so the tests can hold the pages to it. A single
 * asterisk only opens a span when a non-space follows it and a non-space closes it, which leaves
 * an ordinary asterisk in a sentence alone — a half-parser that mangled one would be worse than
 * having no emphasis at all.
 */
export const INLINE_SPAN = /(\*\*[^*]+\*\*|\*(?!\s)[^*]+(?<!\s)\*|`[^`]+`)/g;

/** The asterisks a reader would actually see: the ones no span above claimed. */
export function strayAsterisks(text: string): string[] {
  return text
    .split(INLINE_SPAN)
    .filter((part, i) => i % 2 === 0)
    .flatMap((part) => part.match(/\*+/g) ?? []);
}
