import type { CanvasElement, ElementId, Point, SavedViewpoint } from "@/canvas/document";

/**
 * Two people on one board — the wire, and the rules.
 *
 * Until now the honest answer to "we both opened it" was to refuse the second save and say
 * *reload*. That is the right answer when there is no merge; it is the wrong product for a canvas
 * two architects are meant to stand in front of together. This module is the merge, and the shape
 * of the document is what makes it small enough to trust.
 *
 * A board is a **map of flat objects**. Nothing nests, nothing is ordered, and every field is a
 * value rather than a structure. So the merge rule can be per-element last-writer-wins, ordered by
 * the server: two people dragging the same card is a real conflict, not a merge failure, and the
 * later drag winning is what every tool on this shape does. What last-writer-wins *cannot* do is
 * two people typing into one text field — there it silently eats characters — so text is not
 * merged at all. It is locked to whoever is in it (§5.40), which is a smaller promise honestly
 * kept rather than a large one quietly broken.
 *
 * Nothing here imports the database, the store or React: this is the vocabulary both ends speak,
 * so both ends can be tested without either.
 */

/** A change to the document, as one element map delta. Absent keys mean "untouched". */
export interface Patch {
  upsert?: Record<ElementId, CanvasElement>;
  remove?: ElementId[];
}

/**
 * The parts of a document that are not elements.
 *
 * Saved viewpoints and the Compose script belong to the board but are not on the canvas, so they
 * cannot travel as an element patch — and on a live board the client has stopped saving, so
 * without their own message they would simply never be written down. They are whole-value
 * last-writer-wins, which for a list of saved views and a block of text is the right grain.
 */
export interface DocParts {
  viewpoints?: SavedViewpoint[];
  script?: string;
}

/** Somebody else on the board. Entirely ephemeral: presence is never written down. */
export interface Peer {
  /** This connection. One person with two tabs is two peers, which is what the cursors show. */
  id: string;
  userId: string;
  name: string;
  color: string;
  /** World coordinates, or null when the pointer is off the canvas. */
  cursor: Point | null;
  selection: ElementId[];
  /** The element whose text this peer has open. The soft lock everyone else obeys. */
  editing: ElementId | null;
}

/** Server → client. */
export type Down =
  | { kind: "hello"; peerId: string; seq: number; elements: Record<ElementId, CanvasElement>; peers: Peer[]; parts: DocParts }
  | { kind: "patch"; seq: number; from: string; patch: Patch }
  | { kind: "presence"; peers: Peer[] }
  | { kind: "doc"; seq: number; from: string; parts: DocParts }
  /** The board was changed by something that is not a peer (an import approval, a restore). */
  | { kind: "resync"; seq: number; elements: Record<ElementId, CanvasElement>; parts: DocParts };

/** Client → server. */
export type Up =
  | { kind: "patch"; patch: Patch }
  | { kind: "doc"; parts: DocParts }
  | { kind: "presence"; cursor?: Point | null; selection?: ElementId[]; editing?: ElementId | null };

/**
 * Apply a patch to an element map, returning a new map (or the same one if nothing changed).
 *
 * Removals are applied after upserts so a patch that does both cannot depend on their order —
 * the sender's intent is "this is what changed", not a script.
 */
export function applyPatch(elements: Record<ElementId, CanvasElement>, patch: Patch): Record<ElementId, CanvasElement> {
  const upserts = Object.entries(patch.upsert ?? {});
  const removes = patch.remove ?? [];
  if (!upserts.length && !removes.length) return elements;

  const next = { ...elements };
  for (const [id, el] of upserts) next[id] = el;
  for (const id of removes) delete next[id];
  return next;
}

/**
 * What changed between two element maps.
 *
 * The store already owns "the document as it is now", and every mutation goes through one seam, so
 * the cheapest honest way to say what a person did is to diff before against after. It sends whole
 * elements rather than field deltas: an element is a handful of scalars, and a whole-element write
 * is what makes last-writer-wins per element true rather than approximately true.
 */
export function diffElements(
  before: Record<ElementId, CanvasElement>,
  after: Record<ElementId, CanvasElement>,
): Patch | null {
  const upsert: Record<ElementId, CanvasElement> = {};
  const remove: ElementId[] = [];

  for (const [id, el] of Object.entries(after)) {
    // Reference equality first: the store copies the map and replaces only what it touched, so
    // this is one pointer comparison for every object a drag did not move.
    if (before[id] !== el) upsert[id] = el;
  }
  for (const id of Object.keys(before)) if (!(id in after)) remove.push(id);

  if (!Object.keys(upsert).length && !remove.length) return null;
  const patch: Patch = {};
  if (Object.keys(upsert).length) patch.upsert = upsert;
  if (remove.length) patch.remove = remove;
  return patch;
}

/**
 * The colours peers are given, in order.
 *
 * The same seven the canvas already uses for notes and frames, so a cursor in a board looks like
 * it belongs to this product rather than to a collaboration library bolted onto it.
 */
export const PEER_COLORS = ["#1376d4", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#ef4444", "#0ea5e9"] as const;

/**
 * A stable colour for a person.
 *
 * By user, not by connection: somebody who reloads should come back the colour their colleague has
 * already learned to associate with them. Two tabs of one person are therefore the same colour,
 * which is right — it is one person.
 */
export function peerColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return PEER_COLORS[hash % PEER_COLORS.length]!;
}

/**
 * Is this element locked to somebody else's keyboard?
 *
 * The one place the rule lives, so the canvas, the inspector and any future editor agree on it.
 * A lock is presence, so it disappears when they blur the field, close the tab or lose the
 * connection — there is nothing to release and nothing to get stuck.
 */
export function lockedBy(peers: Peer[], id: ElementId): Peer | null {
  return peers.find((p) => p.editing === id) ?? null;
}
