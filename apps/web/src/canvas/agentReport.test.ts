import { describe, expect, it } from "vitest";
import { ago, runLine, scopeLine } from "./agentReport";
import type { BoardScope } from "@/lib/agent/remarks";

/**
 * What an agent says about itself (§5.52).
 *
 * The wording is the feature, so the wording is what is tested. The property under all of it: two
 * different outcomes must never produce the same sentence.
 */

const scope = (items: number, total = items, frame: string | null = null): BoardScope => ({
  items: Array.from({ length: items }, (_, i) => ({ id: `e${i}`, label: `E${i}`, kind: "card", text: "words" })),
  links: [],
  frame,
  total,
});

describe("what it can see", () => {
  it("counts what it would read, and says where", () => {
    expect(scopeLine(scope(14), "board")).toBe("Reads 14 objects");
    expect(scopeLine(scope(1), "board")).toBe("Reads 1 object");
    expect(scopeLine(scope(6, 6, "OT estate"), "frame")).toBe("Reads 6 objects in “OT estate”");
  });

  it("says out loud when the cap has cut the scope short", () => {
    // Silently reading the first hundred and twenty of four hundred looks exactly like an agent
    // with nothing to say about the other two hundred and eighty.
    expect(scopeLine(scope(120, 400), "board")).toBe("Reads 120 of 400 objects — the rest are out of reach");
  });

  it("names the fix rather than the symptom when there is nothing in scope", () => {
    expect(scopeLine(scope(0), "connected")).toMatch(/draw a line/);
    expect(scopeLine(scope(0), "frame")).toMatch(/drag it into one/);
    expect(scopeLine(scope(0), "board")).toMatch(/any words on it yet/);
  });
});

describe("what the last run did", () => {
  it("tells the two silences apart", () => {
    // The whole reason the numbers are kept at all.
    expect(runLine({ read: 14, remarks: [] })).toBe("Read 14 · said nothing");
    expect(runLine({ read: 0, remarks: [] })).toBe("Read 0 · said nothing");
    expect(runLine({ read: 14, remarks: [] })).not.toBe(runLine({ read: 0, remarks: [] }));
  });

  it("counts what it said", () => {
    expect(runLine({ read: 9, remarks: [{ id: "r", about: "a", text: "t", quote: "q" }] })).toBe("Read 9 · said 1");
  });

  it("admits what the validator threw away", () => {
    expect(runLine({ read: 9, discarded: 2, remarks: [] })).toBe("Read 9 · said nothing · discarded 2");
    // Nothing thrown away is not worth a "discarded 0".
    expect(runLine({ read: 9, discarded: 0, remarks: [] })).toBe("Read 9 · said nothing");
  });

  it("survives an element from before any of this was recorded", () => {
    expect(runLine({ remarks: undefined })).toBe("Read 0 · said nothing");
  });
});

describe("how long ago", () => {
  const now = Date.parse("2026-09-09T12:00:00.000Z");
  const at = (iso: string) => ago(iso, now);

  it("uses the roughest unit that is still true", () => {
    expect(at("2026-09-09T11:59:40.000Z")).toBe("just now");
    expect(at("2026-09-09T11:42:00.000Z")).toBe("18 min ago");
    expect(at("2026-09-09T09:00:00.000Z")).toBe("3h ago");
    expect(at("2026-09-07T12:00:00.000Z")).toBe("2d ago");
  });

  it("gives a date once a week has gone by", () => {
    expect(at("2026-08-01T12:00:00.000Z")).toMatch(/Aug/);
  });

  it("does not say a run happened in the future", () => {
    // Two machines whose clocks disagree is not worth "in -3 minutes".
    expect(at("2026-09-09T12:05:00.000Z")).toBe("just now");
    expect(at("not a date")).toBe("at some point");
  });
});
