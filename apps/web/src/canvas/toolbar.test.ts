import { describe, expect, it } from "vitest";
import { LINE_CHOICES, RAIL, RAIL_ITEMS, SHAPE_CHOICES, isArmed, tipFor, type ToolItem } from "./toolbar";
import type { Tool } from "./store";

/**
 * The rail as a catalogue (§5.59).
 *
 * These are the mistakes that get past review: two buttons on one letter, a flyout offering a tool
 * the keyboard cannot reach, a shortcut the rail advertises that the key handler does not honour.
 * The last one is the reason `TOOL_KEYS` is duplicated here rather than imported — the point is to
 * check that two independently-written lists agree, and importing one into the other would make
 * the test agree with itself.
 */

const TOOL_KEYS: Record<string, Tool> = {
  v: "select", h: "hand", f: "frame", c: "card", n: "sticky", t: "text",
  s: "section", a: "agent", r: "rect", o: "ellipse", d: "diamond", l: "connector",
};

const tools = RAIL_ITEMS.filter((i): i is ToolItem => i.kind === "tool");

describe("the tool rail", () => {
  it("puts every button in exactly one group", () => {
    const seen = new Set<string>();
    for (const g of RAIL) {
      for (const i of g.items) {
        const id = i.kind === "tool" ? `tool:${i.tool}` : i.kind === "panel" ? `panel:${i.panel}` : `history:${i.action}`;
        expect(seen.has(id), `${id} appears twice`).toBe(false);
        seen.add(id);
      }
    }
    expect(seen.size).toBe(RAIL_ITEMS.length);
  });

  it("gives every tool a shortcut the key handler actually honours", () => {
    for (const item of tools) {
      const key = item.key.toLowerCase();
      expect(TOOL_KEYS[key], `${item.label} advertises ${item.key}, which arms ${TOOL_KEYS[key] ?? "nothing"}`)
        .toBe(item.tool);
    }
  });

  it("never puts two buttons on the same letter", () => {
    const keys = tools.map((t) => t.key.toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("only offers shapes the keyboard can also reach", () => {
    for (const c of SHAPE_CHOICES) expect(TOOL_KEYS[c.key.toLowerCase()]).toBe(c.tool);
  });

  it("says what each line style is for, because three arrows look alike", () => {
    for (const c of LINE_CHOICES) expect(c.hint.length, c.label).toBeGreaterThan(20);
  });

  it("names a flyout only where one exists", () => {
    const withFlyout = tools.filter((t) => t.flyout).map((t) => t.flyout);
    expect(withFlyout.sort()).toEqual(["card", "line", "shape"]);
  });
});

describe("which button reads as armed", () => {
  it("lights the shape button for any shape, not only the one it is showing", () => {
    const shape = tools.find((t) => t.flyout === "shape")!;
    expect(isArmed(shape, "ellipse")).toBe(true);
    expect(isArmed(shape, "diamond")).toBe(true);
    expect(isArmed(shape, "card")).toBe(false);
  });

  it("lights an ordinary button only for its own tool", () => {
    const note = tools.find((t) => t.tool === "sticky")!;
    expect(isArmed(note, "sticky")).toBe(true);
    expect(isArmed(note, "text")).toBe(false);
  });
});

describe("what the tooltip says", () => {
  it("carries the key for a tool", () => {
    expect(tipFor({ kind: "tool", tool: "sticky", label: "Note", key: "N" })).toEqual({ label: "Note", key: "N" });
  });

  it("tells a toggle which way it is about to go", () => {
    const map = RAIL_ITEMS.find((i) => i.kind === "panel" && i.panel === "map")!;
    expect(tipFor(map, true).label).toMatch(/^Hide/);
    expect(tipFor(map, false).label).toMatch(/^Show/);
    // A toggle that says the same thing in both states is the "on/off badge" problem again (§5.55).
    expect(tipFor(map, true).label).not.toBe(tipFor(map, false).label);
  });
});
