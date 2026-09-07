import { isBoxElement, type CanvasDocument, type CanvasElement } from "@/canvas/document";
import type { Decision, StagedRecord } from "./stage";

/**
 * Reading the board back.
 *
 * Until rev 70 the canvas was where an import was *shown*: decisions were made in a table and
 * "Draw it on a board" produced a picture of them. That is the wrong way round for this product.
 * A staged import is exactly the kind of work a canvas is for — four hundred claims you want to
 * see the shape of, sort into piles, argue about with somebody standing next to you — and the
 * piles should be the decision, not a drawing of one made elsewhere.
 *
 * So a staged board is a working surface, and this module is what makes that true: it reads a
 * saved document and returns what the board now says. Three things come back.
 *
 * **Which lane each card is in** — by the centre-inside rule the canvas already uses for dragging
 * into a frame, so what a person sees is what is read. A card in no lane is not a decision: it is
 * somebody dragging something out of the way, and its previous decision stands.
 *
 * **What was edited on the card** — a name, a kind, a description. Correcting a name on the card
 * in front of you is the natural thing to do, and the alternative (find the row in a table of four
 * hundred) is why nobody corrects anything.
 *
 * **What was connected** — a connector drawn between two staged cards is a relation the import
 * will create. The files' own relation columns already produce these; this is how you add the one
 * the export forgot, by drawing it.
 *
 * Everything here is pure, so the rules can be tested without a board, a batch or a database.
 */

/** Which lane a frame is, independent of its title — a person may rename a lane. */
export type Lane = "accept" | "hold" | "reject";

export interface BoardReading {
  /** Record id → the decision its lane implies. Only cards inside a lane appear. */
  decisions: Record<string, Decision>;
  /** Record id → fields a person changed on the card. */
  overrides: Record<string, RecordOverride>;
  /** Relations drawn between two staged cards. */
  relations: DrawnRelation[];
  /** Staged cards a person deleted from the board — read as "this is not part of the import". */
  removed: string[];
}

export interface RecordOverride {
  name?: string;
  kind?: string;
  description?: string;
}

export interface DrawnRelation {
  from: string;
  to: string;
  kind: string;
}

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

/** The lane a frame declares. Set when the board is drawn; a renamed frame keeps its meaning. */
export function laneOf(el: CanvasElement): Lane | null {
  if (el.type !== "frame") return null;
  const lane = (el.meta as { lane?: unknown } | undefined)?.lane;
  return lane === "accept" || lane === "hold" || lane === "reject" ? lane : null;
}

/** The staged record a card stands for, if it is one. */
export const stagedId = (el: CanvasElement): string => {
  const staged = (el.meta as { staged?: unknown } | undefined)?.staged;
  return typeof staged === "string" ? staged : "";
};

/**
 * What the board now says about a batch.
 *
 * `records` is the staging as it stands, so an edit can be told from the value that was already
 * there — writing an override that says the same thing would make every save look like a change.
 */
export function readBoard(document: CanvasDocument, records: StagedRecord[]): BoardReading {
  const byId = new Map(records.map((r) => [r.id, r]));
  const elements = Object.values(document.elements);
  const lanes = elements.filter((el) => laneOf(el) !== null);

  const decisions: Record<string, Decision> = {};
  const overrides: Record<string, RecordOverride> = {};
  const relations: DrawnRelation[] = [];
  const seen = new Set<string>();

  /** Element id → record id, for reading connectors afterwards. */
  const recordOf = new Map<string, string>();

  for (const el of elements) {
    const id = stagedId(el);
    if (!id || !byId.has(id) || !isBoxElement(el)) continue;
    recordOf.set(el.id, id);
    seen.add(id);

    // Centre-inside, the same rule `frameChildren` uses when a drag decides what moves with a
    // frame. Any other rule would mean a card that looks held is read as accepted.
    const cx = el.x + el.w / 2;
    const cy = el.y + el.h / 2;
    const frame = lanes.find((f) => isBoxElement(f) && cx >= f.x && cx <= f.x + f.w && cy >= f.y && cy <= f.y + f.h);
    const lane = frame ? laneOf(frame) : null;
    if (lane) decisions[id] = lane;

    if (el.type === "card") {
      const record = byId.get(id)!;
      const override: RecordOverride = {};
      if (el.title.trim() && norm(el.title) !== norm(record.name)) override.name = el.title.trim().slice(0, 200);
      if (norm(el.kind) !== norm(record.kind)) override.kind = el.kind.trim().slice(0, 60);
      // A card's description is written over with the reason it is held or what would change, so
      // it is only read as an edit when the record had one and the card no longer matches it.
      if (record.description && el.description.trim() && norm(el.description) !== norm(record.description)) {
        override.description = el.description.trim().slice(0, 600);
      }
      if (Object.keys(override).length) overrides[id] = override;
    }
  }

  const endpoint = (end: { elementId?: string } | { point: unknown }): string =>
    "elementId" in end && typeof end.elementId === "string" ? end.elementId : "";

  for (const el of elements) {
    if (el.type !== "connector") continue;
    const from = recordOf.get(endpoint(el.from));
    const to = recordOf.get(endpoint(el.to));
    if (!from || !to || from === to) continue;
    const kind = (el.label ?? "").trim().slice(0, 60);
    if (relations.some((r) => r.from === from && r.to === to && norm(r.kind) === norm(kind))) continue;
    relations.push({ from, to, kind });
  }

  // A staged card somebody deleted is a claim they have taken out of the import. It is not the
  // same as rejecting it — a rejected row stays visible with a reason — but it is a decision, and
  // silently re-drawing it on the next redraw would be the product arguing with its user.
  const removed = records.filter((r) => !seen.has(r.id)).map((r) => r.id);

  return { decisions, overrides, relations, removed };
}

/** Apply the overrides a person made on the board over freshly staged records. */
export function withOverrides(records: StagedRecord[], overrides: Record<string, RecordOverride>): StagedRecord[] {
  if (!Object.keys(overrides).length) return records;
  return records.map((record) => {
    const override = overrides[record.id];
    if (!override) return record;
    return {
      ...record,
      name: override.name ?? record.name,
      kind: override.kind ?? record.kind,
      description: override.description ?? record.description,
    };
  });
}

/**
 * How many staged cards are in each lane, straight from the elements.
 *
 * The board shows this live, as somebody drags: a count that only updated after a save would make
 * the lanes feel like a form rather than a pile of cards. It is the same containment rule the
 * reconciler uses, so what the bar says is what a save would write.
 */
export function laneCounts(elements: Record<string, CanvasElement>): { accept: number; hold: number; reject: number; loose: number } {
  const all = Object.values(elements);
  const lanes = all.filter((el) => laneOf(el) !== null).filter(isBoxElement);
  const counts = { accept: 0, hold: 0, reject: 0, loose: 0 };
  for (const el of all) {
    if (!stagedId(el) || !isBoxElement(el)) continue;
    const cx = el.x + el.w / 2;
    const cy = el.y + el.h / 2;
    const frame = lanes.find((f) => cx >= f.x && cx <= f.x + f.w && cy >= f.y && cy <= f.y + f.h);
    const lane = frame ? laneOf(frame) : null;
    if (lane) counts[lane] += 1;
    else counts.loose += 1;
  }
  return counts;
}
