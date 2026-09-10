import { describe, expect, it } from "vitest";
import { TABLE_LIMIT, boardWriteup, type WriteupInput } from "./writeup";
import { parseMarkdown, references } from "./markdown";
import type { CanvasDocument, CanvasElement } from "@/canvas/document";

/**
 * Writing a board up as a page (§5.60).
 *
 * The property that matters: the draft must be made of **references**, not of copies. A generated
 * page whose facts are transcribed is true on the day it is written and quietly wrong a month
 * later, which is the failure mode of every architecture wiki anybody has ever met.
 */

let n = 0;
const card = (title: string, kind: string, attributes: Record<string, string> = {}, at = { x: 0, y: 0 }): CanvasElement =>
  ({ id: `e${n++}`, type: "card", x: at.x, y: at.y, w: 100, h: 60, kind, title, description: "", attributes, color: "#000", z: 0 });
const frame = (title: string, box: { x: number; y: number; w: number; h: number }): CanvasElement =>
  ({ id: `f${n++}`, type: "frame", ...box, title, color: "#000", z: 0 });
const note = (text: string): CanvasElement =>
  ({ id: `s${n++}`, type: "sticky", x: 0, y: 0, w: 10, h: 10, title: "", text, color: "#000", z: 0 });

const doc = (...elements: CanvasElement[]): CanvasDocument =>
  ({ version: 2, elements: Object.fromEntries(elements.map((e) => [e.id, e])) });

const input = (over: Partial<WriteupInput> = {}): WriteupInput =>
  ({ boardId: "brd_a", boardName: "Application landscape", document: doc(), relations: [], ...over });

describe("a first draft of a page about a board", () => {
  it("titles the page after the board and embeds the board itself", () => {
    const { title, body } = boardWriteup(input({ document: doc(card("CRM", "Application")) }));
    expect(title).toBe("Application landscape");
    expect(body.startsWith("#")).toBe(false);
    expect(references(parseMarkdown(body)).embeds).toContainEqual({ kind: "board", target: "brd_a" });
  });

  it("references rather than transcribes, so the page cannot go stale behind the model", () => {
    const many = Array.from({ length: TABLE_LIMIT + 3 }, (_, i) => card(`App ${i}`, "Application"));
    const { body } = boardWriteup(input({ document: doc(...many) }));
    const embeds = references(parseMarkdown(body)).embeds;
    expect(embeds).toContainEqual({ kind: "query", target: 'kind:"Application" on:"Application landscape"' });
    // The nine applications are not listed one by one: the live query is the list.
    expect(body).not.toContain("App 7");
  });

  it("uses a table while a table is still readable", () => {
    const few = [card("A", "Interface", { protocol: "REST" }), card("B", "Interface", { protocol: "file" })];
    const { body } = boardWriteup(input({ document: doc(...few) }));
    expect(body).toContain("| Object | protocol |");
    expect(body).toContain("| A | REST |");
    expect(references(parseMarkdown(body)).embeds.filter((e) => e.kind === "query")).toEqual([]);
  });

  it("takes its structure from the frames somebody already drew", () => {
    const d = doc(
      frame("Front office", { x: 0, y: 0, w: 200, h: 200 }),
      frame("Back office", { x: 0, y: 300, w: 200, h: 200 }),
      card("CRM", "Application", {}, { x: 20, y: 20 }),
      card("Ledger", "Application", {}, { x: 20, y: 320 }),
    );
    const { body } = boardWriteup(input({ document: d }));
    expect(body).toContain("### Front office");
    expect(body).toContain("### Back office");
    expect(body.indexOf("Front office")).toBeLessThan(body.indexOf("Back office"));
    expect(body).toMatch(/Front office[\s\S]*?CRM/);
  });

  it("says which objects sit outside every area rather than losing them", () => {
    const d = doc(
      frame("Inside", { x: 0, y: 0, w: 100, h: 100 }),
      card("In", "Application", {}, { x: 10, y: 10 }),
      card("Out", "Application", {}, { x: 900, y: 900 }),
    );
    expect(boardWriteup(input({ document: d })).body).toMatch(/outside every area:.*Out/);
  });

  it("copies the notes, because those are the one part that is already prose", () => {
    const { body } = boardWriteup(input({ document: doc(note("Which of these is the system of record?")) }));
    expect(body).toContain("> Which of these is the system of record?");
  });

  it("tabulates the connections and stops before the table becomes a database dump", () => {
    const relations = Array.from({ length: 70 }, (_, i) => ({ fromName: `A${i}`, kind: "depends on", toName: `B${i}` }));
    const { body } = boardWriteup(input({ relations }));
    expect(body).toContain("| A0 | depends on | B0 |");
    expect(body).not.toContain("| A65 |");
    expect(body).toContain("and 10 more");
  });

  it("escapes a pipe in a name rather than breaking the table it is in", () => {
    const { body } = boardWriteup(input({ relations: [{ fromName: "A|B", kind: "uses", toName: "C" }] }));
    const table = parseMarkdown(body).find((b) => b.kind === "table");
    expect(table).toBeTruthy();
    expect(body).toContain("A\\|B");
  });

  it("ends by saying what it does not know, so it does not read as finished", () => {
    const { body } = boardWriteup(input());
    expect(body).toContain("## Still to write");
    expect(body).toMatch(/the prose is yours to write/);
  });

  it("says so plainly when there is nothing on the board", () => {
    expect(boardWriteup(input()).body).toContain("no architecture objects on it yet");
  });

  it("produces markdown this wiki can actually parse", () => {
    const d = doc(
      frame("Area", { x: 0, y: 0, w: 500, h: 500 }),
      card("CRM", "Application", { owner: "IT" }, { x: 10, y: 10 }),
      note("A remark"),
    );
    const blocks = parseMarkdown(boardWriteup(input({ document: d, relations: [{ fromName: "CRM", kind: "uses", toName: "X" }] })).body);
    // Round-tripping is the real check: a generator that emits markdown its own parser mis-reads
    // is two bugs waiting to be blamed on each other.
    // No level-1 heading: the page's own title is the h1, and the draft must not repeat it.
    expect(blocks.some((b) => b.kind === "heading" && b.level === 1)).toBe(false);
    expect(blocks.some((b) => b.kind === "heading" && b.level === 2)).toBe(true);
    expect(blocks.some((b) => b.kind === "embed")).toBe(true);
    expect(blocks.some((b) => b.kind === "table")).toBe(true);
    expect(blocks.some((b) => b.kind === "quote")).toBe(true);
    expect(blocks.some((b) => b.kind === "list")).toBe(true);
  });
});
