import { nanoid } from "nanoid";
import { cardColorForKind, type CanvasDocument, type CanvasElement } from "@/canvas/document";
import type { Lane as LaneKind } from "./reconcile";
import type { Reviewed } from "./review";

/**
 * The batch, as a place to work.
 *
 * A table of four hundred rows is a thing you scroll past; the same four hundred objects on a
 * canvas is a thing you can see the shape of — which cluster is new, which corner is full of
 * questions, whether the export brought the systems you expected or somebody's test data.
 *
 * Since rev 70 this is not a picture of decisions made elsewhere: **the lanes are the decision**.
 * Drag a card from Held into New and it is accepted; drag it into Rejected and it is not. Rename
 * the card and the record is renamed. Draw a connector between two cards and the import will make
 * that relation. Saving the board writes all of it back to the batch (`reconcile.ts`), which is
 * what makes the canvas the import tool rather than its poster.
 *
 * Nothing here is written to the *graph*. Every card is marked `planned`, the same mark a change
 * set's cards carry (§5.21) and meaning the same thing: a drawing of something that is not true
 * yet. It becomes true by approving the batch, not by being drawn.
 */

const CARD_W = 236;
const CARD_H = 124;
const GAP = 20;
const PAD = 24;
const TITLE = 52;
const COLUMNS = 4;

interface Lane {
  title: string;
  colour: string;
  note: string;
  lane: LaneKind;
  rows: Reviewed[];
}

/**
 * Five lanes, three meanings.
 *
 * New, Changed and Unchanged all mean *accept*; they are separate because "what would this do to
 * the model" is the question a reviewer is actually asking, and three piles answer it at a glance
 * where one pile of two hundred does not. Dragging between them changes nothing, which is right:
 * it is not a person's job to decide whether a row is new.
 */
const LANES: Array<{ title: string; colour: string; note: string; lane: LaneKind; always?: boolean; take: (r: Reviewed) => boolean }> = [
  { title: "New", colour: "#10b981", lane: "accept", always: true, note: "Not in the graph. Approving the batch creates these. Drag anything here to accept it.", take: (r) => r.decision === "accept" && !r.match.entityId },
  { title: "Changed", colour: "#1376d4", lane: "accept", note: "Already in the graph. Approving changes the fields listed on each card.", take: (r) => r.decision === "accept" && Boolean(r.match.entityId) && r.changes.length > 0 },
  { title: "Unchanged", colour: "#94a3b8", lane: "accept", note: "Already in the graph, and nothing here changes them.", take: (r) => r.decision === "accept" && Boolean(r.match.entityId) && r.changes.length === 0 },
  { title: "Held", colour: "#f59e0b", lane: "hold", always: true, note: "Something has to be decided before these can be written. Drag a card out when it is settled.", take: (r) => r.decision === "hold" },
  { title: "Rejected", colour: "#ef4444", lane: "reject", always: true, note: "You said no. Approving the batch leaves these alone.", take: (r) => r.decision === "reject" },
];

/** How many of a lane's cards to draw before summarising the rest. */
const MAX_PER_LANE = 60;

export function batchDocument(
  rows: Reviewed[],
  options: { title?: string; batchId?: string } = {},
): { document: CanvasDocument; drawn: number; summarised: number } {
  /*
   * An empty lane is still drawn when it is somewhere a person needs to be able to drag *to*.
   * Held and Rejected exist on every board for that reason: with nothing held there would be no
   * Held lane, and holding a card would be a thing the canvas could not express — which is exactly
   * the sort of hole that makes people go back to the table.
   */
  const lanes: Lane[] = LANES.map((lane) => ({ ...lane, rows: rows.filter(lane.take) })).filter((lane) => lane.rows.length > 0 || lane.always);
  const elements: Record<string, CanvasElement> = {};
  const add = (el: CanvasElement) => { elements[el.id] = el; };

  const heading = nanoid(10);
  add({
    id: heading, type: "text", variant: "section", x: 0, y: 0, w: 820, h: 96, z: 1, color: "#1376d4",
    title: options.title ?? "Staged import",
    text:
      `${rows.length} object${rows.length === 1 ? "" : "s"} from the files, laid out by what would happen to each. ` +
      `This board is the import: drag a card into another lane to change what happens to it, rename it to rename the record, ` +
      `and draw a connector between two cards to add a relation the export missed. Nothing is in the graph until the batch is approved.`,
  });

  let y = 150;
  let drawn = 0;
  let summarised = 0;

  for (const lane of lanes) {
    const showing = lane.rows.slice(0, MAX_PER_LANE);
    const hidden = lane.rows.length - showing.length;
    const perRow = Math.min(COLUMNS, Math.max(1, showing.length));
    const lines = Math.ceil(showing.length / perRow);
    // An empty lane is a landing strip: wide enough to drop a card into without aiming.
    const w = PAD * 2 + Math.max(perRow, 2) * CARD_W + (Math.max(perRow, 2) - 1) * GAP;
    const h = showing.length
      ? TITLE + PAD + lines * CARD_H + (lines - 1) * GAP + (hidden ? 40 : 0)
      : TITLE + PAD + CARD_H;

    /*
     * `meta.lane` rather than the title: a person may rename a lane, and a reconciler that read
     * the words would then quietly stop understanding their board.
     */
    add({ id: nanoid(10), type: "frame", x: 0, y, w, h, title: `${lane.title} · ${lane.rows.length}`, color: lane.colour, z: 0, meta: { lane: lane.lane } });

    showing.forEach((row, i) => {
      const x = PAD + (i % perRow) * (CARD_W + GAP);
      const top = y + TITLE + Math.floor(i / perRow) * (CARD_H + GAP);
      const kind = row.record.kind || row.match.kind || "";
      const worst = row.issues.find((issue) => issue.severity === "blocker") ?? row.issues.find((issue) => issue.severity === "question");
      add({
        id: nanoid(10),
        type: "card",
        x, y: top, w: CARD_W, h: CARD_H,
        kind,
        color: cardColorForKind(kind),
        title: row.record.name || "(no name)",
        description: worst ? worst.message : row.changes.length ? row.changes.map((c) => `${c.key}: ${c.from || "—"} → ${c.to}`).join(" · ") : row.record.description,
        z: 1,
        attributes: {
          ...Object.fromEntries(Object.entries(row.record.attributes).slice(0, 4).map(([k, f]) => [k, f.chosen.value])),
          from: row.record.sources.join(", "),
        },
        /*
         * `planned`, and never `entityId`: a staged card must not create the object on the next
         * autosave, and must not be kept in step with an object it is only a claim about. The
         * batch id travels with it so a card can be traced back to the file it came from.
         */
        meta: { planned: true, staged: row.record.id },
      });
      drawn++;
    });

    if (hidden) {
      summarised += hidden;
      add({
        id: nanoid(10), type: "text", variant: "text",
        x: PAD, y: y + h - 34, w: w - PAD * 2, h: 28, z: 1, color: "#64748b",
        title: "",
        text: `…and ${hidden} more, not drawn. The review list has all of them.`,
      });
    }
    add({
      id: nanoid(10), type: "text", variant: "text",
      x: w + 28, y: y + TITLE, w: 260, h: 96, z: 1, color: "#64748b",
      title: lane.title, text: lane.note,
    });
    y += h + 56;
  }

  return {
    document: { version: 2, elements, ...(options.batchId ? { meta: { importBatch: options.batchId } } : {}) },
    drawn,
    summarised,
  };
}
