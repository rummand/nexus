import { nanoid } from "nanoid";
import { cardColorForKind, type CanvasDocument, type CanvasElement } from "@/canvas/document";
import type { Reviewed } from "./review";

/**
 * The batch, drawn.
 *
 * A table of four hundred rows is a thing you scroll past; the same four hundred objects on a
 * canvas is a thing you can see the shape of — which cluster is new, which corner is full of
 * questions, whether the export brought the systems you expected or somebody's test data.
 *
 * Nothing here is written to the graph. Every card is marked `planned`, which is the same mark a
 * change set's cards carry (§5.21) and means the same thing: a drawing of something that is not
 * true yet. Deliver it by approving the batch, not by drawing it.
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
  rows: Reviewed[];
}

const LANES: Array<{ title: string; colour: string; note: string; take: (r: Reviewed) => boolean }> = [
  { title: "New", colour: "#10b981", note: "Not in the graph. Approving the batch creates these.", take: (r) => r.decision === "accept" && !r.match.entityId },
  { title: "Changed", colour: "#1376d4", note: "Already in the graph. Approving changes the fields listed on each card.", take: (r) => r.decision === "accept" && Boolean(r.match.entityId) && r.changes.length > 0 },
  { title: "Unchanged", colour: "#94a3b8", note: "Already in the graph, and nothing here changes them.", take: (r) => r.decision === "accept" && Boolean(r.match.entityId) && r.changes.length === 0 },
  { title: "Held", colour: "#f59e0b", note: "Something has to be decided before these can be written.", take: (r) => r.decision === "hold" },
  { title: "Rejected", colour: "#ef4444", note: "You said no. Approving the batch leaves these alone.", take: (r) => r.decision === "reject" },
];

/** How many of a lane's cards to draw before summarising the rest. */
const MAX_PER_LANE = 60;

export function batchDocument(rows: Reviewed[], options: { title?: string } = {}): { document: CanvasDocument; drawn: number; summarised: number } {
  const lanes: Lane[] = LANES.map((lane) => ({ ...lane, rows: rows.filter(lane.take) })).filter((lane) => lane.rows.length > 0);
  const elements: Record<string, CanvasElement> = {};
  const add = (el: CanvasElement) => { elements[el.id] = el; };

  const heading = nanoid(10);
  add({
    id: heading, type: "text", variant: "section", x: 0, y: 0, w: 820, h: 96, z: 1, color: "#1376d4",
    title: options.title ?? "Staged import",
    text: `${rows.length} object${rows.length === 1 ? "" : "s"} from the files, laid out by what would happen to each. Nothing here is in the graph yet — every card is a drawing of a claim until the batch is approved.`,
  });

  let y = 150;
  let drawn = 0;
  let summarised = 0;

  for (const lane of lanes) {
    const showing = lane.rows.slice(0, MAX_PER_LANE);
    const hidden = lane.rows.length - showing.length;
    const perRow = Math.min(COLUMNS, Math.max(1, showing.length));
    const lines = Math.ceil(showing.length / perRow);
    const w = PAD * 2 + perRow * CARD_W + (perRow - 1) * GAP;
    const h = TITLE + PAD + lines * CARD_H + (lines - 1) * GAP + (hidden ? 40 : 0);

    add({ id: nanoid(10), type: "frame", x: 0, y, w, h, title: `${lane.title} · ${lane.rows.length}`, color: lane.colour, z: 0 });

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

  return { document: { version: 2, elements }, drawn, summarised };
}
