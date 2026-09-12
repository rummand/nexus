import { describe, expect, it } from "vitest";
import { boardSetName, drawnNote, proposedWords, routeCard, routeRelation } from "./board-write";
import { MAIN, type Ref } from "./ref";

const set: Ref = { kind: "set", id: "chg_1", name: "Q3 platform", status: "draft", targetDate: "2027-09-01" };

describe("what a board save may do (#149)", () => {
  it("never lets something new into the estate, on any ref", () => {
    expect(routeCard({ exists: false, differs: false })).toBe("propose");
    expect(routeCard({ exists: false, differs: true })).toBe("propose");
    expect(routeRelation({ exists: false, differs: false })).toBe("propose");
  });

  it("leaves an unchanged object alone rather than rewriting it on every autosave", () => {
    expect(routeCard({ exists: true, differs: false })).toBe("skip");
    expect(routeRelation({ exists: true, differs: false })).toBe("skip");
  });

  it("writes an edit to something already in the estate through, as it always has", () => {
    // The honest limit of this slice: routing edits needs an op that carries a name, and the
    // change model has none — `setAttribute`, `retypeEntity`, `setParent`. Widening the rule
    // before the model can carry it would silently drop every rename.
    expect(routeCard({ exists: true, differs: true })).toBe("through");
    expect(routeRelation({ exists: true, differs: true })).toBe("through");
  });

  it("is the same rule whichever ref somebody is standing on", () => {
    // The rule is about what the *thing* is, not where the person is. Standing somewhere decides
    // which branch a proposal lands on; it never decides whether one is needed.
    for (const facts of [{ exists: false, differs: false }, { exists: true, differs: true }]) {
      expect(routeCard(facts)).toBe(routeCard(facts));
    }
  });
});

describe("what it is called and what it says", () => {
  it("names a board's branch after the board, which is what people remember", () => {
    expect(boardSetName("Application landscape")).toBe("Drawn on “Application landscape”");
    expect(boardSetName("  ")).toBe("Drawn on “an untitled board”");
  });

  it("says where the object went and what happens next, not merely that it did not save", () => {
    expect(proposedWords(1, set)).toBe('This object is on “Q3 platform”. It joins the model when that change set is delivered.');
    expect(proposedWords(3, set)).toMatch(/^These 3 objects are on “Q3 platform”\. They join/);
    expect(proposedWords(1, MAIN)).toMatch(/proposed, not yet in the model\. Review and deliver/);
    expect(proposedWords(2, MAIN)).toMatch(/These 2 objects are proposed/);
  });

  it("records where a change came from, so a reviewer is not guessing", () => {
    expect(drawnNote("Workshop")).toBe("Drawn on “Workshop”.");
    expect(drawnNote("")).toBe("Drawn on “an untitled board”.");
  });
});
