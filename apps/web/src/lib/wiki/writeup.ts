import type { CanvasDocument, CardElement, FrameElement } from "@/canvas/document";

/**
 * Writing a board up as a page (§5.60).
 *
 * The request this answers is "import the architecture and write it up as wiki pages", and the
 * temptation is to hand a board to a model and print what comes back. That would be the wrong way
 * round twice over: it would need a model configured before the feature worked at all, and it
 * would produce a *copy* of the board — prose that is true on the day it is written and quietly
 * wrong a month later.
 *
 * So the draft is deterministic and it is made of references. The board goes in as a `:::board`
 * embed, which is drawn from the live document every time somebody reads the page. A kind with
 * more objects than a table wants goes in as a `:::query`, which lists whatever matches *now*.
 * Only the parts that genuinely are prose — the notes somebody typed on the board — are copied,
 * because those are already writing rather than data.
 *
 * A model can then improve the prose (§5.31), which is the right order: the page is useful with no
 * model at all, and a model makes it read better rather than making it exist.
 */

/** Above this many objects of one kind, a live query beats a table nobody will read. */
export const TABLE_LIMIT = 6;

export interface WriteupRelation {
  fromName: string;
  kind: string;
  toName: string;
}

export interface WriteupInput {
  boardId: string;
  boardName: string;
  document: CanvasDocument;
  /** Relations in the graph between objects that are on this board. */
  relations: WriteupRelation[];
}

const isCard = (el: { type: string }): el is CardElement => el.type === "card";
const isFrame = (el: { type: string }): el is FrameElement => el.type === "frame";
const centreIn = (el: { x: number; y: number; w: number; h: number }, f: FrameElement) => {
  const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
  return cx >= f.x && cx <= f.x + f.w && cy >= f.y && cy <= f.y + f.h;
};

const esc = (v: string) => v.replace(/\|/g, "\\|").trim();
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A table of these objects, with the columns they actually use between them. */
function objectTable(cards: CardElement[]): string[] {
  const keys: string[] = [];
  for (const c of cards) for (const k of Object.keys(c.attributes ?? {})) {
    if (!keys.includes(k) && (c.attributes?.[k] ?? "").trim()) keys.push(k);
  }
  const columns = keys.slice(0, 4);
  const head = ["Object", ...columns];
  const out = [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`];
  for (const c of cards) {
    const cells = [esc(c.title || "(untitled)"), ...columns.map((k) => esc(c.attributes?.[k] ?? "—"))];
    out.push(`| ${cells.join(" | ")} |`);
  }
  return out;
}

/** One section per kind: a table when it is short, a live query when it is not. */
function kindSections(cards: CardElement[], boardName: string): string[] {
  const byKind = new Map<string, CardElement[]>();
  for (const c of cards) {
    const kind = (c.kind || "Untyped").trim();
    byKind.set(kind, [...(byKind.get(kind) ?? []), c]);
  }
  const out: string[] = [];
  for (const [kind, list] of [...byKind.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))) {
    out.push(`### ${kind}`, "");
    if (list.length > TABLE_LIMIT) {
      out.push(
        `There ${list.length === 1 ? "is" : "are"} ${count(list.length, "of these")} on the board. The list below is live — it shows what matches today rather than what was here when this was written.`,
        "",
        `:::query kind:"${kind}" on:"${boardName}" | ${kind} on this board`,
        "",
      );
    } else {
      out.push(...objectTable(list.slice().sort((a, b) => (a.title || "").localeCompare(b.title || ""))), "");
    }
  }
  return out;
}

/**
 * A first draft of a page about this board.
 *
 * Deliberately a draft: it ends by saying what it did not know, because a generated page that
 * reads as finished is one nobody edits.
 */
export function boardWriteup(input: WriteupInput): { title: string; body: string } {
  const elements = Object.values(input.document.elements);
  const cards = elements.filter(isCard);
  const frames = elements.filter(isFrame).sort((a, b) => a.y - b.y || a.x - b.x);
  const notes = elements.filter((el): el is Extract<typeof el, { type: "sticky" }> => el.type === "sticky");
  const kinds = new Set(cards.map((c) => (c.kind || "Untyped").trim()));

  /*
   * No `# Title` line: the page carries its own title above the body, and a draft that repeats it
   * gives every generated page two headings that say the same thing — and puts the title twice in
   * the contents list beside it.
   */
  const lines: string[] = [];

  lines.push(
    cards.length === 0
      ? "This board has no architecture objects on it yet, so there is nothing to describe but the drawing itself."
      : `${input.boardName} holds ${count(cards.length, "architecture object")} across ${count(kinds.size, "kind")}${frames.length ? `, arranged in ${count(frames.length, "area")}` : ""}. The board below is live: it shows the board as it is now, not as it was when this page was drafted.`,
    "",
    `:::board ${input.boardId} | ${input.boardName}`,
    "",
  );

  if (frames.length > 0) {
    // A board somebody has framed has already been given its structure; the page should use it
    // rather than imposing an order of its own.
    lines.push("## The areas", "");
    for (const f of frames) {
      const inside = cards.filter((c) => centreIn(c, f));
      lines.push(`### ${f.title || "Untitled area"}`, "");
      lines.push(inside.length === 0
        ? "_Nothing is in this area yet._"
        : `${count(inside.length, "object")}: ${inside.map((c) => c.title || "(untitled)").join(", ")}.`, "");
    }
    const loose = cards.filter((c) => !frames.some((f) => centreIn(c, f)));
    if (loose.length) lines.push(`${count(loose.length, "object")} sits outside every area: ${loose.map((c) => c.title || "(untitled)").join(", ")}.`, "");
  }

  if (cards.length > 0) {
    lines.push("## What is on it", "");
    lines.push(...kindSections(cards, input.boardName));
  }

  if (input.relations.length > 0) {
    lines.push("## How they connect", "");
    lines.push("| From | Connection | To |", "|---|---|---|");
    for (const r of input.relations.slice(0, 60)) {
      lines.push(`| ${esc(r.fromName)} | ${esc(r.kind)} | ${esc(r.toName)} |`);
    }
    if (input.relations.length > 60) lines.push("", `_…and ${input.relations.length - 60} more._`);
    lines.push("");
  }

  if (notes.length > 0) {
    // The one part worth copying rather than referencing: somebody already wrote it as prose.
    lines.push("## Remarks from the board", "");
    for (const n of notes) {
      const text = [n.title, n.text].filter((t) => (t ?? "").trim()).join(" — ").trim();
      if (text) lines.push(`> ${text.replace(/\n+/g, " ")}`, "");
    }
  }

  lines.push(
    "## Still to write",
    "",
    "- Why this shape, and what was decided against.",
    "- Who owns each part, if the objects do not say.",
    "- What is planned to change, and by when.",
    "",
    "_Drafted from the board. Everything above the notes is a reference to the model, so it stays true as the model changes — the prose is yours to write._",
  );

  return { title: input.boardName, body: lines.join("\n") };
}
