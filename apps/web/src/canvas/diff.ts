import type { CanvasDocument, CanvasElement, ElementId } from "./document";

/** A human label for any element (used by diffs, search results, legends). */
export function elementLabel(el: CanvasElement): string {
  switch (el.type) {
    case "card": return el.title || "(untitled card)";
    case "sticky": return el.title || el.text.slice(0, 40) || "(empty note)";
    case "text": return el.title || el.text.slice(0, 40) || "(empty text)";
    case "shape": return el.text || `${el.shape} shape`;
    case "frame": return el.title || "(untitled frame)";
    case "connector": return el.label || "(unlabelled connector)";
    case "agent": return el.name || "(unnamed agent)";
  }
}

export interface ElementChange {
  before: CanvasElement;
  after: CanvasElement;
  /** Top-level fields whose values differ (position fields collapse to "position", size to "size"). */
  fields: string[];
}

export interface DocumentDiff {
  added: CanvasElement[];
  removed: CanvasElement[];
  changed: ElementChange[];
}

const POSITION = new Set(["x", "y"]);
const SIZE = new Set(["w", "h"]);
const IGNORED = new Set(["z"]);

/** Structural diff of two documents by element id. Order and z-index are ignored. */
export function diffDocuments(from: CanvasDocument, to: CanvasDocument): DocumentDiff {
  const added: CanvasElement[] = [];
  const removed: CanvasElement[] = [];
  const changed: ElementChange[] = [];
  for (const [id, el] of Object.entries(to.elements)) if (!(id in from.elements)) added.push(el);
  for (const [id, el] of Object.entries(from.elements)) {
    const after = to.elements[id as ElementId];
    if (!after) { removed.push(el); continue; }
    const fields = changedFields(el, after);
    if (fields.length) changed.push({ before: el, after, fields });
  }
  return { added, removed, changed };
}

function changedFields(a: CanvasElement, b: CanvasElement): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out = new Set<string>();
  for (const k of keys) {
    if (IGNORED.has(k)) continue;
    const va = (a as unknown as Record<string, unknown>)[k];
    const vb = (b as unknown as Record<string, unknown>)[k];
    if (JSON.stringify(va) === JSON.stringify(vb)) continue;
    out.add(POSITION.has(k) ? "position" : SIZE.has(k) ? "size" : k);
  }
  return [...out];
}

/** One-line summary, e.g. "3 added · 1 removed · 2 changed". */
export function summarizeDiff(d: DocumentDiff): string {
  const parts: string[] = [];
  if (d.added.length) parts.push(`${d.added.length} added`);
  if (d.removed.length) parts.push(`${d.removed.length} removed`);
  if (d.changed.length) parts.push(`${d.changed.length} changed`);
  return parts.length ? parts.join(" · ") : "No differences";
}
