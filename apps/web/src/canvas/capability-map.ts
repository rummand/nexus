import { nanoid } from "nanoid";
import type { CanvasDocument, CanvasElement, CardElement } from "./document";
import { cardColorForKind } from "./document";
import { card, frame, textBlock } from "./templates";

/**
 * The capability map, drawn from the model (§5.75).
 *
 * The starter used to hand out six invented capabilities and a dozen invented applications, the
 * same six for every workspace, whether the graph held four capabilities or four hundred. It made
 * a good screenshot and it was the wrong thing entirely: a capability map is a picture *of an
 * organisation*, and one that is not of yours is a slide, not a model.
 *
 * So this builds the whole thing: every capability in the graph, nested by containment (§5.70),
 * with the applications that realise each one placed inside it. "Full run" is the point — a map
 * that quietly draws the first twenty capabilities is a map that lies about the estate.
 *
 * Three rules worth knowing:
 *
 * - **Frames are measured from their contents, bottom-up.** A capability with three children and
 *   two applications is as big as those five things need, no more; a leaf is a card. Nothing is
 *   laid out on a fixed grid, because a real capability tree is nothing like even.
 * - **An application is drawn once.** Many realise several capabilities, and drawing a card per
 *   pairing would put the same object on the board four times — four cards claiming to be one
 *   entity, which the graph sync would have to guess about. It goes inside the first capability
 *   it realises, and its description says where else it is used.
 * - **No connectors.** Containment carries the meaning here; three hundred edges would carry
 *   nothing but ink.
 */

const CARD_W = 220;
const CARD_H = 104;
const GAP = 18;
const PAD = 20;
/** Room for the frame's own titlebar, above anything inside it. */
const TITLE = 46;

/** Depth colours: the top level is strongest, and it fades as the tree gets finer. */
const LEVEL_COLOURS = ["#1376d4", "#0ea5e9", "#10b981", "#8b5cf6"];

export interface CapabilityNode {
  id: string;
  name: string;
  parentId: string | null;
  description?: string;
  attributes?: Record<string, string>;
}

export interface RealisingApplication {
  id: string;
  name: string;
  description?: string;
  /** Every capability this application realises, in no particular order. */
  capabilityIds: string[];
  attributes?: Record<string, string>;
  kind?: string;
}

interface Box {
  w: number;
  h: number;
  /** Emit the elements for this box at an absolute position. */
  draw: (x: number, y: number, out: CanvasElement[]) => void;
}

/**
 * Shelf packing: left to right, wrapping when the row would pass `maxWidth`.
 *
 * Boxes are different sizes — a frame holding forty things beside a single card — so a column
 * grid would leave craters. This keeps rows tight and lets the tall ones set the row height.
 */
function pack(boxes: Box[], maxWidth: number): { w: number; h: number; at: Array<{ x: number; y: number }> } {
  const at: Array<{ x: number; y: number }> = [];
  let x = 0, y = 0, rowH = 0, widest = 0;
  for (const box of boxes) {
    if (x > 0 && x + box.w > maxWidth) {
      x = 0;
      y += rowH + GAP;
      rowH = 0;
    }
    at.push({ x, y });
    x += box.w + GAP;
    rowH = Math.max(rowH, box.h);
    widest = Math.max(widest, x - GAP);
  }
  return { w: widest, h: y + rowH, at };
}

/** Roughly square, and never narrower than the widest thing that has to fit in it. */
function targetWidth(boxes: Box[]): number {
  const widest = boxes.reduce((n, b) => Math.max(n, b.w), CARD_W);
  const across = Math.max(1, Math.ceil(Math.sqrt(boxes.length)));
  return Math.max(widest, across * (CARD_W + GAP) - GAP);
}

/*
 * Deliberately without attributes. A card shows the first few it carries, and on an imported
 * estate those are `createdAt`, `lxState`, `rev` — a wall of provenance under every name, which
 * is exactly what a map is meant to lift you out of. The drawer has them all, one click away.
 */
const cardFor = (x: number, y: number, kind: string, name: string, description: string, entityId: string): CardElement => {
  const c = card(x, y, kind, name, description) as CardElement;
  c.w = CARD_W;
  c.h = CARD_H;
  // The card *is* the entity: a board built from the model must not mint new objects.
  c.meta = { entityId };
  c.color = cardColorForKind(kind);
  return c;
};

/**
 * What this capability and everything under it needs, and how to draw it once a place is chosen.
 */
function measure(
  capability: CapabilityNode,
  childrenOf: Map<string, CapabilityNode[]>,
  appsOf: Map<string, RealisingApplication[]>,
  extraFor: (app: RealisingApplication) => string,
  depth: number,
): Box {
  const children = childrenOf.get(capability.id) ?? [];
  const apps = appsOf.get(capability.id) ?? [];

  if (!children.length && !apps.length) {
    return {
      w: CARD_W,
      h: CARD_H,
      draw: (x, y, out) => out.push(cardFor(x, y, "Business Capability", capability.name, capability.description ?? "", capability.id)),
    };
  }

  // Sub-capabilities first: the structure of the thing, then what realises it.
  const inner: Box[] = [
    ...children.map((child) => measure(child, childrenOf, appsOf, extraFor, depth + 1)),
    ...apps.map((app): Box => ({
      w: CARD_W,
      h: CARD_H,
      draw: (x, y, out) => out.push(cardFor(x, y, app.kind ?? "Application", app.name, extraFor(app), app.id)),
    })),
  ];

  const laid = pack(inner, targetWidth(inner));
  const w = laid.w + PAD * 2;
  const h = laid.h + TITLE + PAD;
  return {
    w,
    h,
    draw: (x, y, out) => {
      const box = frame(x, y, w, h, capability.name, LEVEL_COLOURS[Math.min(depth, LEVEL_COLOURS.length - 1)]!);
      // The frame is the capability, not a label for it (§5.75): it binds to the object, so the
      // board's index, the drawer and a rename all reach the real thing.
      box.meta = { entityId: capability.id };
      out.push(box);
      inner.forEach((box, i) => box.draw(x + PAD + laid.at[i]!.x, y + TITLE + laid.at[i]!.y, out));
    },
  };
}

export interface CapabilityMapInput {
  capabilities: CapabilityNode[];
  applications: RealisingApplication[];
  /** The heading on the board. */
  title?: string;
}

/** How wide the whole map may run before it wraps. Wide boards read; endless ones do not. */
const PAGE_WIDTH = 4400;

export function capabilityMapFrom(input: CapabilityMapInput): CanvasDocument {
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  const capabilities = [...input.capabilities].sort(byName);
  const known = new Set(capabilities.map((c) => c.id));

  const childrenOf = new Map<string, CapabilityNode[]>();
  const roots: CapabilityNode[] = [];
  for (const capability of capabilities) {
    // A parent outside the set is no parent at all: the child is a root here rather than lost.
    const parent = capability.parentId && known.has(capability.parentId) ? capability.parentId : null;
    if (!parent) roots.push(capability);
    else childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), capability]);
  }

  /*
   * One card per application, under the first capability it realises — "first" by the capability's
   * own name, so the same estate always draws the same map. Where it realises more, the card says
   * so rather than appearing again somewhere else.
   */
  const rank = new Map(capabilities.map((c, i) => [c.id, i]));
  const appsOf = new Map<string, RealisingApplication[]>();
  let placed = 0;
  for (const app of [...input.applications].sort(byName)) {
    const mine = app.capabilityIds.filter((id) => known.has(id)).sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0));
    if (!mine.length) continue;
    appsOf.set(mine[0]!, [...(appsOf.get(mine[0]!) ?? []), app]);
    placed++;
  }
  const elsewhere = new Map<string, number>();
  for (const app of input.applications) {
    const n = app.capabilityIds.filter((id) => known.has(id)).length;
    if (n > 1) elsewhere.set(app.id, n - 1);
  }
  const extraFor = (app: RealisingApplication) => {
    const more = elsewhere.get(app.id) ?? 0;
    const also = more ? `Also realises ${more} other capabilit${more === 1 ? "y" : "ies"}.` : "";
    return [app.description?.trim(), also].filter(Boolean).join(" ").slice(0, 240);
  };

  const boxes = roots.map((root) => measure(root, childrenOf, appsOf, extraFor, 0));
  const laid = pack(boxes, PAGE_WIDTH);

  const els: CanvasElement[] = [];
  const nested = capabilities.length - roots.length;
  els.push(textBlock(
    0, -150, Math.max(900, Math.min(laid.w, 1400)), 96,
    input.title ?? "Capability map",
    `${capabilities.length} capabilit${capabilities.length === 1 ? "y" : "ies"} — ${roots.length} at the top, ${nested} nested inside them`
      + ` — and ${placed} application${placed === 1 ? "" : "s"} placed where they are realised.`
      + " Built from the model, so it is the whole estate rather than a sample. Rearrange freely; the graph stays the source of truth.",
    "section",
  ));
  boxes.forEach((box, i) => box.draw(laid.at[i]!.x, laid.at[i]!.y, els));

  return { version: 2, elements: Object.fromEntries(els.map((e) => [e.id, e])) };
}

/** An id for a board built this way, so two runs over the same estate are comparable. */
export const capabilityMapId = () => `cap_${nanoid(8)}`;
