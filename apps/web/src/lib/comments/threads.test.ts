import { describe, expect, it } from "vitest";
import { anchorOf, cleanBody, MAX_BODY, openByElement, openCount, threadsOf, type Comment } from "./threads";

/**
 * Folding rows into conversations (§5.50).
 *
 * The cases worth writing down are the ones that lose somebody's words: a reply whose parent was
 * deleted, a thread about a card that no longer exists, two comments in the same millisecond. A
 * comment system may drop many things; what somebody said is not one of them.
 */

const at = (n: number) => new Date(Date.parse("2026-09-09T09:00:00.000Z") + n * 1000).toISOString();

const comment = (over: Partial<Comment> & { id: string }): Comment => ({
  boardId: "b1",
  elementId: "",
  anchorLabel: "",
  parentId: null,
  authorId: "u1",
  authorName: "Maria Lund",
  body: "…",
  resolvedAt: null,
  resolvedByName: "",
  editedAt: null,
  createdAt: at(0),
  ...over,
});

describe("folding rows into threads", () => {
  it("puts replies under the thing they reply to, oldest first", () => {
    const [thread] = threadsOf([
      comment({ id: "r2", parentId: "c1", createdAt: at(20) }),
      comment({ id: "c1", createdAt: at(0) }),
      comment({ id: "r1", parentId: "c1", createdAt: at(10) }),
    ]);
    expect(thread?.id).toBe("c1");
    expect(thread?.replies.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(thread?.lastAt).toBe(at(20));
  });

  it("keeps a reply whose parent is gone, as a thread of its own", () => {
    // Deleting the opening comment must not silently delete everybody's answers to it.
    const threads = threadsOf([comment({ id: "orphan", parentId: "deleted", body: "But we agreed?" })]);
    expect(threads).toHaveLength(1);
    expect(threads[0]?.opening.body).toBe("But we agreed?");
  });

  it("is stable when two comments share a timestamp", () => {
    const thread = threadsOf([
      comment({ id: "b", parentId: "c1", createdAt: at(5) }),
      comment({ id: "a", parentId: "c1", createdAt: at(5) }),
      comment({ id: "c1" }),
    ])[0];
    expect(thread?.replies.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("lists everybody who spoke, once, in the order they first did", () => {
    const [thread] = threadsOf([
      comment({ id: "c1", authorName: "Maria Lund" }),
      comment({ id: "r1", parentId: "c1", authorName: "Tobias Kjær", createdAt: at(10) }),
      comment({ id: "r2", parentId: "c1", authorName: "Maria Lund", createdAt: at(20) }),
    ]);
    expect(thread?.voices).toEqual(["Maria Lund", "Tobias Kjær"]);
  });
});

describe("what a list shows first", () => {
  it("puts open conversations above settled ones", () => {
    const threads = threadsOf([
      comment({ id: "settled", resolvedAt: at(99), createdAt: at(50) }),
      comment({ id: "open", createdAt: at(10) }),
    ]);
    // A resolved thread is kept — the reasoning is usually the point — but it has stopped asking
    // anybody for anything, so it stops competing for the top.
    expect(threads.map((t) => t.id)).toEqual(["open", "settled"]);
  });

  it("sorts the open ones by when anybody last spoke, not when they started", () => {
    const threads = threadsOf([
      comment({ id: "old-start", createdAt: at(0) }),
      comment({ id: "reply", parentId: "old-start", createdAt: at(100) }),
      comment({ id: "new-start", createdAt: at(50) }),
    ]);
    expect(threads.map((t) => t.id)).toEqual(["old-start", "new-start"]);
  });
});

describe("badges on the canvas", () => {
  it("counts only what is still open, and only what is pinned to something", () => {
    const threads = threadsOf([
      comment({ id: "a", elementId: "el1" }),
      comment({ id: "b", elementId: "el1", createdAt: at(1) }),
      comment({ id: "c", elementId: "el2", resolvedAt: at(9) }),
      comment({ id: "d", elementId: "" }),
    ]);
    expect(openByElement(threads)).toEqual({ el1: 2 });
    expect(openCount(threads)).toBe(3);
  });
});

describe("what a thread is about", () => {
  const thread = (over: Partial<Comment> & { id: string }) => threadsOf([comment(over)])[0]!;

  it("names the object, the board, or the object that is gone", () => {
    expect(anchorOf(thread({ id: "a" }), () => true)).toBe("This board");
    expect(anchorOf(thread({ id: "b", elementId: "el1", anchorLabel: "Maximo" }), () => true)).toBe("Maximo");
    // The moment a card is deleted is the moment the argument about it becomes history, not noise.
    expect(anchorOf(thread({ id: "c", elementId: "el1", anchorLabel: "Maximo" }), () => false)).toBe("Maximo (deleted)");
  });
});

describe("what counts as something said", () => {
  it("refuses whitespace and caps a paste", () => {
    expect(cleanBody("   \n  ")).toBe("");
    expect(cleanBody("  hello  ")).toBe("hello");
    expect(cleanBody("x".repeat(MAX_BODY + 500))).toHaveLength(MAX_BODY);
    expect(cleanBody("a\r\nb")).toBe("a\nb");
  });
});
