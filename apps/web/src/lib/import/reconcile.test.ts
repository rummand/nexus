import { describe, expect, it } from "vitest";
import type { CanvasDocument, CanvasElement } from "@/canvas/document";
import { laneCounts, readBoard, withOverrides } from "./reconcile";
import { proposeFileKind, type Column } from "./map";
import { stage } from "./stage";
import type { StagedRecord } from "./stage";

/**
 * The board as the import tool.
 *
 * These tests are the contract between what somebody sees on a canvas and what an import will
 * write. The one that matters most is the containment rule: it has to be the same rule the canvas
 * uses when a drag decides what moves with a frame, or a card that *looks* held gets written.
 */

const record = (id: string, over: Partial<StagedRecord> = {}): StagedRecord => ({
  id,
  name: id,
  kind: "",
  description: "",
  key: "",
  attributes: {},
  personal: {},
  relations: [],
  sources: ["f.csv"],
  rows: [],
  ...over,
});

const frame = (id: string, lane: string, x: number, y: number, w = 400, h = 200): CanvasElement =>
  ({ id, type: "frame", x, y, w, h, z: 0, title: lane, color: "#000", meta: { lane } }) as CanvasElement;

const card = (id: string, staged: string, x: number, y: number, over: Record<string, unknown> = {}): CanvasElement =>
  ({
    id, type: "card", x, y, w: 200, h: 100, z: 1, kind: "", color: "#000",
    title: staged, description: "", meta: { planned: true, staged }, ...over,
  }) as CanvasElement;

const doc = (...elements: CanvasElement[]): CanvasDocument =>
  ({ version: 2, elements: Object.fromEntries(elements.map((el) => [el.id, el])) });

describe("reading a staged board back", () => {
  const records = [record("r1"), record("r2"), record("r3")];

  it("reads the lane a card is in as the decision", () => {
    const board = doc(
      frame("f_accept", "accept", 0, 0),
      frame("f_hold", "hold", 0, 300),
      card("c1", "r1", 50, 50),
      card("c2", "r2", 50, 350),
    );
    const { decisions } = readBoard(board, records);
    expect(decisions).toEqual({ r1: "accept", r2: "hold" });
  });

  it("uses the centre of the card, the same rule a drag uses", () => {
    // Straddling the edge: the canvas moves it with the frame its centre is in, and so does this.
    const board = doc(frame("f", "reject", 0, 0, 400, 200), card("c", "r1", 320, 150));
    expect(readBoard(board, records).decisions).toEqual({});

    const inside = doc(frame("f", "reject", 0, 0, 400, 200), card("c", "r1", 280, 90));
    expect(readBoard(inside, records).decisions).toEqual({ r1: "reject" });
  });

  it("leaves a card that is in no lane alone rather than inventing a decision", () => {
    const board = doc(frame("f", "accept", 0, 0), card("c", "r1", 900, 900));
    expect(readBoard(board, records).decisions).toEqual({});
  });

  it("reads a lane by what it is, not by what it is called", () => {
    const renamed = { ...(frame("f", "hold", 0, 0) as unknown as Record<string, unknown>), title: "Ask Marianne" } as unknown as CanvasElement;
    expect(readBoard(doc(renamed, card("c", "r1", 50, 50)), records).decisions).toEqual({ r1: "hold" });
  });

  it("reads an edited card as an edit to the record", () => {
    const board = doc(card("c", "r1", 0, 0, { title: "Maximo (retiring)", kind: "Application" }));
    expect(readBoard(board, records).overrides).toEqual({ r1: { name: "Maximo (retiring)", kind: "Application" } });
  });

  it("does not call an unchanged card an edit", () => {
    const board = doc(card("c", "r1", 0, 0, { title: "r1", kind: "" }));
    expect(readBoard(board, records).overrides).toEqual({});
  });

  it("reads a connector between two staged cards as a relation to create", () => {
    const board = doc(
      card("c1", "r1", 0, 0),
      card("c2", "r2", 400, 0),
      { id: "x", type: "connector", z: 1, from: { elementId: "c1" }, to: { elementId: "c2" }, label: "feeds", stroke: "#000", style: "solid", arrowEnd: true, arrowStart: false } as CanvasElement,
    );
    expect(readBoard(board, records).relations).toEqual([{ from: "r1", to: "r2", kind: "feeds" }]);
  });

  it("ignores a connector with a loose end, and one that leaves the import", () => {
    const board = doc(
      card("c1", "r1", 0, 0),
      { id: "x", type: "connector", z: 1, from: { elementId: "c1" }, to: { point: { x: 9, y: 9 } }, label: "", stroke: "#000", style: "solid", arrowEnd: true, arrowStart: false } as CanvasElement,
      { id: "y", type: "connector", z: 1, from: { elementId: "c1" }, to: { elementId: "not-staged" }, label: "", stroke: "#000", style: "solid", arrowEnd: true, arrowStart: false } as CanvasElement,
    );
    expect(readBoard(board, records).relations).toEqual([]);
  });

  it("treats a card somebody deleted as taken out of the import", () => {
    const board = doc(card("c1", "r1", 0, 0));
    expect(readBoard(board, records).removed).toEqual(["r2", "r3"]);
  });

  it("counts the lanes live, for the bar the person is reading while they drag", () => {
    const board = doc(
      frame("f_accept", "accept", 0, 0),
      frame("f_reject", "reject", 0, 300),
      card("c1", "r1", 50, 50),
      card("c2", "r2", 50, 50),
      card("c3", "r3", 50, 350),
      card("c4", "r1", 2000, 2000),
    );
    expect(laneCounts(board.elements)).toEqual({ accept: 2, hold: 0, reject: 1, loose: 1 });
  });

  it("applies overrides over freshly staged records, so a re-map keeps a correction", () => {
    const applied = withOverrides([record("r1", { name: "SCADA", kind: "" })], { r1: { kind: "Application" } });
    expect(applied[0]).toMatchObject({ name: "SCADA", kind: "Application" });
  });
});

describe("what are these rows?", () => {
  const columns = (roles: Array<[string, Column["role"]]>): Column[] =>
    roles.map(([header, role]) => ({ header, role, why: "", sample: [] }));

  it("says nothing when the rows say for themselves", () => {
    const proposal = proposeFileKind(
      "export.csv",
      ["Name", "Class"],
      [["Maximo", "Application"], ["SCADA", "Application"]],
      columns([["Name", { as: "name" }], ["Class", { as: "kind" }]]),
    );
    expect(proposal.fromRows).toBe(true);
    expect(proposal.kind).toBe("");
  });

  it("reads the file name, in the workspace's own spelling", () => {
    expect(proposeFileKind("servers-2026.csv", ["Name"], [["web01"]], columns([["Name", { as: "name" }]])).kind).toBe("Server");
    // If these people call them "Applications", propose that rather than our word for it.
    const theirs = proposeFileKind("application-list.xlsx", ["Name"], [["Maximo"]], columns([["Name", { as: "name" }]]), ["Applications"]);
    expect(theirs.kind).toBe("Applications");
  });

  it("falls back to the columns, then admits it does not know", () => {
    expect(proposeFileKind("export final v3.csv", ["Interface name", "Owner"], [["Meter feed", "Ops"]], []).kind).toBe("Interface");
    const unknown = proposeFileKind("book1.csv", ["Col1", "Col2"], [["a", "b"]], []);
    expect(unknown.kind).toBe("");
    expect(unknown.why).toMatch(/Nothing here says/);
  });

  it("gives the file's kind to rows that do not carry one, and never overrides a row that does", () => {
    const staged = stage([
      {
        name: "servers.csv",
        headers: ["Name", "Class"],
        rows: [["web01", ""], ["db01", "Database"]],
        columns: columns([["Name", { as: "name" }], ["Class", { as: "kind" }]]),
        kind: "Server",
      },
    ]);
    expect(staged.map((r) => [r.name, r.kind])).toEqual([["web01", "Server"], ["db01", "Database"]]);
  });
});
