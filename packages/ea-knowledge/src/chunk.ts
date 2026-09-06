/**
 * Splitting documents into retrievable passages.
 *
 * A passage has to be big enough to answer something and small enough to quote. Paragraphs are
 * the natural unit — they are what the author decided belongs together — so we merge whole
 * paragraphs up to a target size and never cut one in half unless it is enormous on its own.
 *
 * Headings are carried, not discarded: "TOGAF § Architecture Development Method" is most of what
 * makes a citation useful, and the section path is also the cheapest relevance signal we have.
 */

import type { Chunk, Document } from "./types";

const TARGET = 900;
const MAX = 1500;
const MIN = 220;

/** MediaWiki plaintext extracts mark headings as `== Title ==`, deeper levels with more `=`. */
const HEADING = /^(={2,6})\s*(.+?)\s*\1$/;

/** Sections that are navigation, not knowledge. */
const SKIP_SECTIONS = new Set([
  "see also", "references", "external links", "further reading", "notes", "bibliography",
  "sources", "citations", "footnotes", "literature",
]);

interface Block {
  section: string[];
  text: string;
}

/** Split plain text into paragraph blocks, tracking the heading path each one sits under. */
export function blocks(text: string): Block[] {
  const out: Block[] = [];
  let path: string[] = [];
  let skipping = false;
  let skipDepth = 0;

  for (const raw of text.split(/\n/)) {
    const line = raw.trim();
    const heading = HEADING.exec(line);
    if (heading) {
      const depth = heading[1]!.length - 1; // == is depth 1
      const title = heading[2]!.trim();
      if (skipping && depth > skipDepth) continue; // a subsection of a skipped section
      skipping = false;
      path = path.slice(0, depth - 1);
      path[depth - 1] = title;
      path = path.slice(0, depth);
      if (SKIP_SECTIONS.has(title.toLowerCase())) {
        skipping = true;
        skipDepth = depth;
      }
      continue;
    }
    if (skipping || !line) continue;
    out.push({ section: [...path], text: line });
  }
  return out;
}

/** Merge paragraph blocks into passages of roughly TARGET characters, never across a heading. */
export function chunkDocument(doc: Document): Chunk[] {
  const chunks: Chunk[] = [];
  let buffer: Block[] = [];
  let ordinal = 0;

  const flush = () => {
    if (!buffer.length) return;
    const text = buffer.map((b) => b.text).join("\n\n");
    // A stub paragraph on its own answers nothing; it is better lost than returned as a hit.
    if (text.length >= MIN || buffer[0]!.section.length === 0) {
      chunks.push({
        id: `${doc.sourceId}#${ordinal}`,
        sourceId: doc.sourceId,
        title: doc.title,
        url: doc.url,
        license: doc.license,
        section: buffer[0]!.section,
        ordinal,
        text,
      });
      ordinal++;
    }
    buffer = [];
  };

  for (const block of blocks(doc.text)) {
    const sameSection = buffer.length > 0 && buffer[0]!.section.join("|") === block.section.join("|");
    if (buffer.length && !sameSection) flush();
    const size = buffer.reduce((n, b) => n + b.text.length + 2, 0);
    if (size + block.text.length > MAX && buffer.length) flush();
    buffer.push(block);
    if (buffer.reduce((n, b) => n + b.text.length + 2, 0) >= TARGET) flush();
  }
  flush();
  return chunks;
}

/** "TOGAF § Architecture Development Method" — how a passage is labelled in a citation. */
export function citationLabel(chunk: Chunk): string {
  return chunk.section.length ? `${chunk.title} § ${chunk.section.join(" › ")}` : chunk.title;
}
