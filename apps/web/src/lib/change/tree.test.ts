import { describe, expect, it } from "vitest";
import { MARGIN, branchTree, fitBox, nodeAt, openingView, treeBounds, zoomAround, type TreeInput } from "./tree";
import type { GraphEvent } from "@/lib/history/events";
import type { Change, ChangeSet } from "./types";

/**
 * The tree (§5.84).
 *
 * The property that matters: the drawing must not claim a shape the data does not have. A branch
 * is cut from the state of main it was written against, a merge lands where it landed, and one
 * afternoon of edits by one person is one commit rather than eleven.
 */

const event = (over: Partial<GraphEvent> & { id: string; at: string; entityId: string }): GraphEvent => ({
  kind: "renamed", entityName: "Thing", field: "", from: "", to: "", context: "the canvas",
  actor: { kind: "person", id: "u1", name: "Jes" }, ...over,
});
const change = (over: Partial<Change> & { id: string; createdAt: string }): Change => ({
  op: "setAttribute", entityId: "ent_a", relationId: null, payload: {}, note: "", ...over,
});
const set = (over: Partial<ChangeSet> & { id: string; createdAt: string }): ChangeSet => ({
  workspaceId: "w", name: over.id, description: "", status: "draft", targetDate: "",
  deliveredAt: null, updatedAt: over.createdAt, changes: [], ...over,
});

const tree = (over: Partial<TreeInput> = {}) => branchTree({ events: [], changeSets: [], ...over });

describe("the trunk", () => {
  it("folds one hand's edits in one place into one commit", () => {
    // Three fields renamed in the same minute by the same person is one commit, as it would be
    // in a repository — not three rows pretending to be three decisions.
    const t = tree({
      events: [
        event({ id: "1", at: "2027-03-01T10:00:00.000Z", entityId: "a" }),
        event({ id: "2", at: "2027-03-01T10:00:30.000Z", entityId: "b" }),
        event({ id: "3", at: "2027-03-01T10:01:00.000Z", entityId: "c" }),
      ],
    });
    const trunk = t.nodes.filter((n) => n.lane === 0);
    expect(trunk).toHaveLength(1);
    expect(trunk[0]).toMatchObject({ size: 3, ref: "main" });
    expect(trunk[0]!.entityIds.sort()).toEqual(["a", "b", "c"]);
  });

  it("keeps two different hands apart even in the same minute", () => {
    const t = tree({
      events: [
        event({ id: "1", at: "2027-03-01T10:00:00.000Z", entityId: "a" }),
        event({ id: "2", at: "2027-03-01T10:00:10.000Z", entityId: "b", actor: { kind: "agent", id: "ag", name: "Owner finder" } }),
      ],
    });
    expect(t.nodes.filter((n) => n.lane === 0)).toHaveLength(2);
  });
});

describe("branches", () => {
  const trunkEvents = [
    event({ id: "old", at: "2027-01-01T00:00:00.000Z", entityId: "a" }),
    event({ id: "mid", at: "2027-03-01T00:00:00.000Z", entityId: "b" }),
    event({ id: "new", at: "2027-05-01T00:00:00.000Z", entityId: "c" }),
  ];

  it("gives every change set a lane of its own, and main lane zero", () => {
    const t = tree({ changeSets: [set({ id: "cs1", createdAt: "2027-02-01T00:00:00.000Z" }), set({ id: "cs2", createdAt: "2027-04-01T00:00:00.000Z" })] });
    expect(t.lanes[0]).toMatchObject({ lane: 0, ref: "main" });
    expect(t.lanes.map((l) => l.ref)).toEqual(["main", "cs2", "cs1"]);
    // Newest branch nearest the trunk, so the thing being worked on now is easiest to follow.
    expect(t.lanes.find((l) => l.ref === "cs2")!.lane).toBe(1);
  });

  it("cuts a branch from the state of main it was written against, not from the newest", () => {
    const t = tree({ events: trunkEvents, changeSets: [set({ id: "cs", createdAt: "2027-04-01T00:00:00.000Z" })] });
    const cut = t.nodes.find((n) => n.kind === "cut")!;
    const edge = t.edges.find((e) => e.from === cut.id && e.kind === "cut")!;
    const base = t.nodes.find((n) => n.id === edge.to)!;
    // Written in April: the state of main then was the March commit, not May's.
    expect(base.at).toBe("2027-03-01T00:00:00.000Z");
  });

  it("lands a delivered change set back on main, at the moment it landed", () => {
    const t = tree({
      events: trunkEvents,
      changeSets: [set({ id: "cs", createdAt: "2027-02-01T00:00:00.000Z", status: "delivered", deliveredAt: "2027-05-02T00:00:00.000Z" })],
    });
    const merge = t.nodes.find((n) => n.kind === "merge");
    expect(merge).toBeTruthy();
    expect(t.edges.some((e) => e.from === merge!.id && e.kind === "merge")).toBe(true);
    expect(t.lanes.find((l) => l.ref === "cs")!.status).toBe("landed");
  });

  it("gives an open branch a head and an abandoned one none", () => {
    const t = tree({ changeSets: [set({ id: "open", createdAt: "2027-02-01T00:00:00.000Z" }), set({ id: "gone", createdAt: "2027-02-01T00:00:00.000Z", status: "abandoned" })] });
    expect(t.nodes.some((n) => n.kind === "open" && n.ref === "open")).toBe(true);
    expect(t.nodes.some((n) => n.kind === "open" && n.ref === "gone")).toBe(false);
    expect(t.lanes.find((l) => l.ref === "gone")!.status).toBe("abandoned");
  });

  it("folds a branch's changes by the minute they were written in", () => {
    const t = tree({
      changeSets: [set({
        id: "cs", createdAt: "2027-02-01T00:00:00.000Z",
        changes: [
          change({ id: "1", createdAt: "2027-02-02T09:00:10.000Z", note: "Out of support" }),
          change({ id: "2", createdAt: "2027-02-02T09:00:40.000Z" }),
          change({ id: "3", createdAt: "2027-02-03T09:00:00.000Z" }),
        ],
      })],
    });
    const commits = t.nodes.filter((n) => n.kind === "commit" && n.ref === "cs");
    expect(commits).toHaveLength(2);
    expect(commits.some((c) => c.size === 2 && c.title === "Out of support")).toBe(true);
  });
});

describe("the drawing itself", () => {
  it("numbers every row once, newest first, with no gaps", () => {
    const t = tree({
      events: [event({ id: "1", at: "2027-05-01T00:00:00.000Z", entityId: "a" })],
      changeSets: [set({ id: "cs", createdAt: "2027-02-01T00:00:00.000Z" })],
    });
    expect(t.nodes.map((n) => n.row)).toEqual(t.nodes.map((_, i) => i));
    const times = t.nodes.map((n) => Date.parse(n.at));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(t.rows).toBe(t.nodes.length);
  });

  it("joins each lane down its own column", () => {
    const t = tree({
      events: [
        event({ id: "1", at: "2027-05-01T00:00:00.000Z", entityId: "a" }),
        event({ id: "2", at: "2027-04-01T00:00:00.000Z", entityId: "b", actor: { kind: "agent", id: "x", name: "Agent" } }),
      ],
    });
    expect(t.edges.filter((e) => e.kind === "line")).toHaveLength(1);
  });

  it("places a plateau as a tag on the trunk", () => {
    const t = tree({ plateaus: [{ id: "plt", name: "Target 2028", targetDate: "2028-01-01" }] });
    const tag = t.nodes.find((n) => n.kind === "tag")!;
    expect(tag).toMatchObject({ lane: 0, title: "Target 2028" });
  });

  it("puts a branch's cut below its own commits when they share an instant", () => {
    // A seeded or scripted workspace writes the change set and its changes in the same
    // millisecond. Without a tie-break the branch appeared to start after the work on it.
    const t = tree({
      changeSets: [set({
        id: "cs", createdAt: "2027-02-01T00:00:00.000Z", updatedAt: "2027-02-01T00:00:00.000Z",
        changes: [change({ id: "1", createdAt: "2027-02-01T00:00:00.000Z" })],
      })],
    });
    const rows = Object.fromEntries(t.nodes.map((n) => [n.kind, n.row]));
    expect(rows.cut).toBeGreaterThan(rows.commit!);
    expect(rows.open).toBeLessThan(rows.commit!);
  });

  it("survives an empty workspace", () => {
    const t = tree();
    expect(t.nodes).toEqual([]);
    expect(t.lanes).toHaveLength(1);
  });
});

describe("the camera", () => {
  it("frames every node, with room for the labels beside them", () => {
    const nodes = [{ lane: 0, row: 0 }, { lane: 2, row: 9 }];
    const box = treeBounds(nodes);
    for (const n of nodes) {
      const { x, y } = nodeAt(n);
      expect(x).toBeGreaterThanOrEqual(box.x);
      expect(x).toBeLessThanOrEqual(box.x + box.width);
      expect(y).toBeGreaterThanOrEqual(box.y);
      expect(y).toBeLessThanOrEqual(box.y + box.height);
    }
    // Room on the right for the label that is drawn beside the rightmost node.
    const right = nodeAt(nodes[1]!).x;
    expect(box.x + box.width - right).toBeGreaterThan(MARGIN * 2);
  });

  it("gives an empty tree a world rather than a zero-sized one", () => {
    const box = treeBounds([]);
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });

  it("fits without distorting: the framed box keeps the viewport's shape", () => {
    const fitted = fitBox({ x: 0, y: 0, width: 100, height: 400 }, { width: 800, height: 400 });
    expect(fitted.width / fitted.height).toBeCloseTo(2, 5);
    // …and still contains the original.
    expect(fitted.x).toBeLessThanOrEqual(0);
    expect(fitted.x + fitted.width).toBeGreaterThanOrEqual(100);
  });

  it("fits a wide box by growing the height instead of squashing the width", () => {
    const fitted = fitBox({ x: 0, y: 0, width: 1000, height: 100 }, { width: 500, height: 500 });
    expect(fitted.width).toBe(1000);
    expect(fitted.height).toBeCloseTo(1000, 5);
  });

  it("keeps the point under the pointer under the pointer while zooming", () => {
    const view = { x: 0, y: 0, width: 1000, height: 500 };
    const at = { x: 250, y: 125 };
    const zoomed = zoomAround(view, at, 2);
    const before = (at.x - view.x) / view.width;
    const after = (at.x - zoomed.x) / zoomed.width;
    expect(after).toBeCloseTo(before, 5);
    expect(zoomed.width).toBeCloseTo(500, 5);
  });

  it("can always zoom back towards the readable range, even from a view outside it", () => {
    /*
     * A tall history fitted into a wide stage opens *below* the minimum scale. An absolute
     * guard refused every zoom from there and locked the camera at the one view you arrive in —
     * which the walk caught. A zoom that moves towards the range is always allowed.
     */
    const wide = { x: 0, y: 0, width: 9200, height: 2400 };
    const inwards = zoomAround(wide, { x: 0, y: 0 }, 1.25);
    expect(inwards.width).toBeLessThan(wide.width);
    // …and going further out from there is refused, because it only makes it worse.
    expect(zoomAround(wide, { x: 0, y: 0 }, 1 / 1.25).width).toBe(wide.width);
  });

  it("refuses to zoom past its limits rather than letting the drawing vanish", () => {
    let view = { x: 0, y: 0, width: 1000, height: 500 };
    for (let i = 0; i < 40; i++) view = zoomAround(view, { x: 0, y: 0 }, 1.3);
    expect(view.width).toBeGreaterThan(1);
    let out = { x: 0, y: 0, width: 1000, height: 500 };
    for (let i = 0; i < 40; i++) out = zoomAround(out, { x: 0, y: 0 }, 1 / 1.3);
    expect(Number.isFinite(out.width)).toBe(true);
  });
});

describe("where the camera opens", () => {
  it("opens at one-to-one on the newest commits, not zoomed out to everything", () => {
    // A year of history is thousands of units tall. Framing all of it in a wide stage shrinks
    // every label out of existence, which is a picture of a tree rather than one you can read.
    const world = treeBounds([{ lane: 0, row: 0 }, { lane: 2, row: 400 }]);
    const open = openingView(world, { width: 1000, height: 800 });
    expect(open.width).toBe(1000);
    expect(open.height).toBe(800);
    expect(open.y).toBe(world.y);
    // …and fit is still there for the whole shape, which is a different question.
    expect(fitBox(world, { width: 1000, height: 800 }).height).toBeGreaterThan(open.height);
  });

  it("gives back the world when the stage has not been measured yet", () => {
    const world = treeBounds([{ lane: 0, row: 0 }]);
    expect(openingView(world, { width: 0, height: 0 })).toEqual(world);
  });
});
