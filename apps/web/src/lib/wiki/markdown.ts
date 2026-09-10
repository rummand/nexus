/**
 * A small markdown for the wiki (§5.60).
 *
 * Written rather than installed, for the same reason the in-product documentation is authored as
 * typed blocks (§5.23): the output is a typed tree that React renders as elements, so there is no
 * `dangerouslySetInnerHTML` anywhere and a page somebody pastes in from a Word document cannot
 * put a script on the screen. A markdown library returning an HTML string would put that risk in
 * the one place users type — and it would still not understand the two things this wiki is for:
 *
 * - **`[[Wiki links]]`**, which resolve against the pages of this workspace.
 * - **Embed directives**, a line beginning `:::`, which name something in the model rather than
 *   quoting it. `:::board brd_landscape` is not a picture of a board; it is the board, drawn from
 *   its current document when the page is read.
 *
 * The subset is deliberately what people actually write: headings, paragraphs, lists, quotes,
 * fenced code, tables, rules. Anything unrecognised stays as text rather than disappearing.
 */

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "em"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; href: string }
  /** `[[Title]]` — resolved against the workspace's pages at render time. */
  | { kind: "wikilink"; title: string };

export type EmbedKind = "board" | "object" | "query";

export type Block =
  | { kind: "heading"; level: 1 | 2 | 3 | 4; text: Inline[]; id: string }
  | { kind: "paragraph"; text: Inline[] }
  | { kind: "list"; ordered: boolean; items: Inline[][] }
  | { kind: "quote"; text: Inline[] }
  | { kind: "code"; language: string; text: string }
  | { kind: "table"; head: Inline[][]; rows: Inline[][][] }
  | { kind: "rule" }
  /** A live view of something in the model, resolved when the page is read. */
  | { kind: "embed"; embed: EmbedKind; target: string; caption: string };

const INLINE = /(\[\[[^\]]+\]\]|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*(?!\s)[^*]+(?<!\s)\*|`[^`]+`)/g;

/** Turn one line of text into its inline runs. Unmatched text survives verbatim. */
export function parseInline(raw: string): Inline[] {
  const out: Inline[] = [];
  for (const part of raw.split(INLINE)) {
    if (!part) continue;
    if (part.startsWith("[[") && part.endsWith("]]")) {
      out.push({ kind: "wikilink", title: part.slice(2, -2).trim() });
    } else if (part.startsWith("[") && part.includes("](")) {
      const at = part.indexOf("](");
      out.push({ kind: "link", text: part.slice(1, at), href: part.slice(at + 2, -1) });
    } else if (part.startsWith("**") && part.endsWith("**")) {
      out.push({ kind: "strong", text: part.slice(2, -2) });
    } else if (part.startsWith("*") && part.endsWith("*")) {
      out.push({ kind: "em", text: part.slice(1, -1) });
    } else if (part.startsWith("`") && part.endsWith("`")) {
      out.push({ kind: "code", text: part.slice(1, -1) });
    } else {
      out.push({ kind: "text", text: part });
    }
  }
  return out;
}

/** An anchor a contents list can link to. Stable for the same heading text. */
export function headingId(text: string): string {
  return text.trim().toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 60) || "section";
}

const EMBED = /^:::(board|object|query)\s+(.+?)(?:\s*\|\s*(.*))?$/;
const TABLE_ROW = /^\s*\|(.+)\|\s*$/;
const DIVIDER = /^\s*\|?[\s:|-]+\|[\s:|-]*$/;

const cells = (line: string) => line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => parseInline(c.trim()));

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    if (!line.trim()) { i++; continue; }

    // fenced code — taken whole, and an unterminated fence runs to the end rather than eating
    // the rest of the page silently
    if (line.trimStart().startsWith("```")) {
      const language = line.trim().slice(3).trim();
      const body: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? "").trimStart().startsWith("```")) {
        body.push(lines[i] ?? "");
        i++;
      }
      i++;
      blocks.push({ kind: "code", language, text: body.join("\n") });
      continue;
    }

    const embed = EMBED.exec(line.trim());
    if (embed) {
      blocks.push({ kind: "embed", embed: embed[1] as EmbedKind, target: (embed[2] ?? "").trim(), caption: (embed[3] ?? "").trim() });
      i++;
      continue;
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { blocks.push({ kind: "rule" }); i++; continue; }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const text = (heading[2] ?? "").trim();
      blocks.push({ kind: "heading", level: heading[1]!.length as 1 | 2 | 3 | 4, text: parseInline(text), id: headingId(text) });
      i++;
      continue;
    }

    // a table needs its divider row, or it is just text with pipes in it
    if (TABLE_ROW.test(line) && DIVIDER.test(lines[i + 1] ?? "")) {
      const head = cells(TABLE_ROW.exec(line)![1]!);
      const rows: Inline[][][] = [];
      i += 2;
      while (i < lines.length && TABLE_ROW.test(lines[i] ?? "")) {
        rows.push(cells(TABLE_ROW.exec(lines[i]!)![1]!));
        i++;
      }
      blocks.push({ kind: "table", head, rows });
      continue;
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      const items: Inline[][] = [];
      while (i < lines.length) {
        const m = ordered ? /^\s*\d+[.)]\s+(.*)$/.exec(lines[i] ?? "") : /^\s*[-*+]\s+(.*)$/.exec(lines[i] ?? "");
        if (!m) break;
        items.push(parseInline((m[1] ?? "").trim()));
        i++;
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i] ?? "")) {
        body.push((lines[i] ?? "").replace(/^\s*>\s?/, ""));
        i++;
      }
      blocks.push({ kind: "quote", text: parseInline(body.join(" ")) });
      continue;
    }

    // a paragraph runs until a blank line or the start of any other block
    const body: string[] = [];
    while (i < lines.length && (lines[i] ?? "").trim() && !isBlockStart(lines[i] ?? "")) {
      body.push((lines[i] ?? "").trim());
      i++;
    }
    if (body.length) blocks.push({ kind: "paragraph", text: parseInline(body.join(" ")) });
    else i++; // a line that starts a block we did not consume: never loop on it
  }

  return blocks;
}

function isBlockStart(line: string): boolean {
  return /^(#{1,4})\s/.test(line)
    || /^\s*[-*+]\s/.test(line)
    || /^\s*\d+[.)]\s/.test(line)
    || /^\s*>/.test(line)
    || line.trimStart().startsWith("```")
    || EMBED.test(line.trim())
    || /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line);
}

/** Every heading, for a contents list beside the page. */
export function outline(blocks: Block[]): Array<{ level: number; text: string; id: string }> {
  return blocks
    .filter((b): b is Extract<Block, { kind: "heading" }> => b.kind === "heading")
    .map((b) => ({ level: b.level, text: plain(b.text), id: b.id }));
}

/** Everything a page references, so a page can say what it is made of and links can be checked. */
export function references(blocks: Block[]): { embeds: Array<{ kind: EmbedKind; target: string }>; wikilinks: string[] } {
  const embeds: Array<{ kind: EmbedKind; target: string }> = [];
  const wikilinks: string[] = [];
  const walk = (runs: Inline[]) => { for (const r of runs) if (r.kind === "wikilink") wikilinks.push(r.title); };
  for (const b of blocks) {
    switch (b.kind) {
      case "embed": embeds.push({ kind: b.embed, target: b.target }); break;
      case "heading": case "paragraph": case "quote": walk(b.text); break;
      case "list": b.items.forEach(walk); break;
      case "table": b.head.forEach(walk); b.rows.forEach((r) => r.forEach(walk)); break;
      default: break;
    }
  }
  return { embeds, wikilinks: [...new Set(wikilinks)] };
}

/** The plain text of some inline runs — for search, summaries and heading ids. */
export function plain(runs: Inline[]): string {
  return runs.map((r) => (r.kind === "wikilink" ? r.title : r.kind === "text" || r.kind === "strong" || r.kind === "em" || r.kind === "code" || r.kind === "link" ? r.text : "")).join("");
}

/** The first paragraph, trimmed — what a page shows in a list of pages. */
export function summarise(blocks: Block[], max = 160): string {
  const p = blocks.find((b) => b.kind === "paragraph");
  if (!p) return "";
  const text = plain(p.text).trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
