import { describe, expect, it } from "vitest";
import { fits, NOTIFY_LIMIT, shouldPersist, type LiveMessage } from "./bus";

/**
 * Carrying a board between processes (§5.47).
 *
 * The two decisions worth pinning down are both arithmetic, and both are the sort of thing that is
 * fine until the day it is not: which replica writes the board down, and what happens to a message
 * that will not fit down the wire.
 */

const patch = (bytes: number): LiveMessage => ({
  kind: "patch",
  boardId: "b1",
  from: "srv-a-p1",
  patch: { upsert: { a: { id: "a", type: "note", x: 0, y: 0, w: 10, h: 10, z: 0, title: "t", text: "x".repeat(bytes) } } } as never,
});

describe("which replica writes the board down", () => {
  it("is exactly one of them, and the same one for everybody", () => {
    /*
     * The property, rather than the implementation: every replica runs this with the same set and
     * has to agree, or a settle produces two saves and two graph syncs.
     */
    const present = ["srv-c", "srv-a", "srv-b"];
    const answers = present.map((me) => shouldPersist(me, present.filter((p) => p !== me)));
    expect(answers.filter(Boolean)).toHaveLength(1);
    expect(shouldPersist("srv-a", present)).toBe(true);
  });

  it("is me when I am the only one here", () => {
    expect(shouldPersist("srv-a", [])).toBe(true);
    expect(shouldPersist("srv-a", ["srv-a"])).toBe(true);
  });

  it("moves to the next replica when the writer disappears", () => {
    // Its peers age out of everybody's list, and the next settle simply has a different minimum.
    expect(shouldPersist("srv-b", ["srv-a", "srv-b"])).toBe(false);
    expect(shouldPersist("srv-b", ["srv-b", "srv-c"])).toBe(true);
  });
});

describe("a message that will not fit", () => {
  it("says so, rather than being sent and truncated", () => {
    expect(fits(patch(10))).toBe(true);
    expect(fits(patch(NOTIFY_LIMIT))).toBe(false);
  });

  it("leaves ordinary edits well inside the limit", () => {
    // A card with a paragraph on it is the realistic worst case, and it is nowhere near.
    expect(fits(patch(500))).toBe(true);
    expect(fits({ kind: "presence", boardId: "b1", process: "srv-a", peers: [] })).toBe(true);
    expect(fits({ kind: "reload", boardId: "b1" })).toBe(true);
  });
});
