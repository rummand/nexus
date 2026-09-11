import { describe, expect, it } from "vitest";
import { burnDown, burnWords, canClose, parseChecks, standing, type StateRow } from "./state";

/**
 * Where an object stands in a campaign (§5.85).
 *
 * The property worth defending: a validation is a statement about the object *as it was*. If
 * editing an object could leave it validated, the badge means nothing within a quarter, and the
 * burn-down becomes a number that only ever goes one way.
 */

const NOW = Date.parse("2027-06-01T12:00:00.000Z");
const row = (over: Partial<StateRow> & { state: StateRow["state"] }): StateRow => ({
  entityId: "e1", note: "", expiresAt: null, askedOfId: null, atVersion: "2027-03-01T00:00:00.000Z",
  byId: "u1", updatedAt: "2027-03-01T00:00:00.000Z", ...over,
});

describe("what an object's state actually is", () => {
  it("is untouched when nobody has written anything", () => {
    expect(standing(undefined, "2027-01-01T00:00:00.000Z", NOW).state).toBe("untouched");
  });

  it("keeps a validation while the object has not moved", () => {
    const s = standing(row({ state: "validated" }), "2027-03-01T00:00:00.000Z", NOW);
    expect(s.state).toBe("validated");
    expect(s.lapsed).toBe("");
  });

  it("undoes a validation the moment the object changes", () => {
    // Validated in March, edited in June: not validated. This is the edge the whole process
    // stands on — without it the badge is believed for one quarter and then it is furniture.
    const s = standing(row({ state: "validated" }), "2027-06-01T09:00:00.000Z", NOW);
    expect(s.state).toBe("untouched");
    expect(s.lapsed).toBe("changed");
  });

  it("keeps a waiver until its expiry, then lets it go", () => {
    const live = standing(row({ state: "waived", note: "Vendor gone; nobody owns it", expiresAt: "2027-12-01T00:00:00.000Z" }), "x", NOW);
    expect(live.state).toBe("waived");
    const dead = standing(row({ state: "waived", note: "…", expiresAt: "2027-05-01T00:00:00.000Z" }), "x", NOW);
    expect(dead).toMatchObject({ state: "untouched", lapsed: "expired" });
  });

  it("does not let an edit undo a waiver — a waiver is about the gap, not about the value", () => {
    const s = standing(row({ state: "waived", note: "accepted", expiresAt: "2027-12-01T00:00:00.000Z" }), "2027-06-01T09:00:00.000Z", NOW);
    expect(s.state).toBe("waived");
  });

  it("leaves a question standing whatever happens to the object", () => {
    expect(standing(row({ state: "needs-decision", note: "Whose is this?", askedOfId: "u2" }), "2027-06-01T09:00:00.000Z", NOW).state)
      .toBe("needs-decision");
  });

  it("survives a row with no recorded version rather than lapsing everything", () => {
    // Older rows, or a validation recorded before the column existed: keep the decision.
    expect(standing(row({ state: "validated", atVersion: "" }), "2027-06-01T00:00:00.000Z", NOW).state).toBe("validated");
  });
});

describe("the burn-down", () => {
  const scope = (states: Array<Parameters<typeof standing>[0]>, updated = "2027-03-01T00:00:00.000Z") =>
    states.map((r, i) => standing(r && { ...r, entityId: `e${i}` }, updated, NOW));

  it("counts validated and waived as done, and says what is left", () => {
    const b = burnDown(scope([
      row({ state: "validated" }),
      row({ state: "waived", expiresAt: "2027-12-01T00:00:00.000Z" }),
      row({ state: "in-review" }),
      undefined,
    ]));
    expect(b).toMatchObject({ total: 4, done: 2, untouched: 1, inReview: 1, percent: 50 });
    expect(burnWords(b)).toBe("1 validated · 1 waived · 2 to go");
  });

  it("goes up as well as down, and says how many came back", () => {
    // Three validated in March; one of them edited since.
    const b = burnDown([
      standing(row({ state: "validated", entityId: "a" }), "2027-03-01T00:00:00.000Z", NOW),
      standing(row({ state: "validated", entityId: "b" }), "2027-03-01T00:00:00.000Z", NOW),
      standing(row({ state: "validated", entityId: "c" }), "2027-06-01T00:00:00.000Z", NOW),
    ]);
    expect(b).toMatchObject({ validated: 2, untouched: 1, lapsed: 1, percent: 67 });
  });

  it("is complete rather than undefined when nothing is in scope", () => {
    expect(burnDown([])).toMatchObject({ total: 0, percent: 100 });
    expect(burnWords(burnDown([]))).toMatch(/Nothing in scope/);
  });
});

describe("closing a campaign", () => {
  it("refuses while anything is still untouched, and says how many", () => {
    const b = burnDown([standing(row({ state: "validated" }), "2027-03-01T00:00:00.000Z", NOW), standing(undefined, "x", NOW)]);
    const c = canClose(b);
    expect(c.ok).toBe(false);
    expect(c.why).toMatch(/1 object still needs somebody/);
    // …and the verb agrees in the plural too.
    const two = burnDown([standing(undefined, "x", NOW), standing(undefined, "x", NOW)]);
    expect(canClose(two).why).toMatch(/2 objects still need somebody/);
  });

  it("allows it when the remainder is explicitly waived", () => {
    const b = burnDown([
      standing(row({ state: "validated" }), "2027-03-01T00:00:00.000Z", NOW),
      standing(row({ state: "waived", expiresAt: "2028-01-01T00:00:00.000Z" }), "x", NOW),
    ]);
    expect(canClose(b).ok).toBe(true);
  });
});

describe("the definition of done", () => {
  it("reads a stored list of check ids, and is not fooled by rubbish", () => {
    expect(parseChecks('["required-fields","no-cycles"]')).toEqual(["required-fields", "no-cycles"]);
    expect(parseChecks("not json")).toEqual([]);
    expect(parseChecks('{"a":1}')).toEqual([]);
    expect(parseChecks('["ok",3,null]')).toEqual(["ok"]);
  });
});
