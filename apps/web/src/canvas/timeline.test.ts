import { describe, expect, it } from "vitest";
import type { CardElement } from "./document";
import { dateAttributeKeys, originBelow, parseWhen, periodLabel, planTimeline } from "./timeline";

const card = (id: string, attributes: Record<string, string>, kind = "Application"): CardElement =>
  ({ id, type: "card", x: 0, y: 0, w: 236, h: 124, kind, color: "#000", title: id, description: "", z: 1, attributes });

describe("reading a date out of an attribute", () => {
  it("takes the forms people actually type", () => {
    expect(parseWhen("2027-03-14")).toBe(Date.UTC(2027, 2, 14));
    expect(parseWhen("2027-03")).toBe(Date.UTC(2027, 2, 1));
    expect(parseWhen("2027")).toBe(Date.UTC(2027, 0, 1));
    expect(parseWhen("2027 Q3")).toBe(Date.UTC(2027, 6, 1));
    expect(parseWhen("Q3 2027")).toBe(Date.UTC(2027, 6, 1));
    expect(parseWhen("March 2027")).toBe(Date.UTC(2027, 2, 1));
    expect(parseWhen("Mar 2027")).toBe(Date.UTC(2027, 2, 1));
  });

  it("refuses to guess rather than putting a card in the wrong century", () => {
    expect(parseWhen("soon")).toBeNull();
    expect(parseWhen("")).toBeNull();
    expect(parseWhen(undefined)).toBeNull();
    expect(parseWhen("high")).toBeNull();
    // a bare number that cannot be a year is a quantity — a cost, a count, a port
    expect(parseWhen("1200")).toBeNull();
    expect(parseWhen("42")).toBeNull();
  });

  it("offers the attributes that look like dates, commonest first", () => {
    const cards = [
      card("a", { "end of support": "2027-01", owner: "Grid" }),
      card("b", { "end of support": "2028", cost: "1200" }),
      card("c", { renewal: "Q1 2027" }),
    ];
    expect(dateAttributeKeys(cards)).toEqual([{ key: "end of support", count: 2 }, { key: "renewal", count: 1 }]);
  });
});

describe("laying a board out on a time axis", () => {
  const cards = [
    card("early", { when: "2027-01-05", team: "Grid" }),
    card("early2", { when: "2027-02-20", team: "Grid" }),
    card("late", { when: "2027-11-01", team: "Data" }),
  ];

  it("puts earlier things to the left", () => {
    const plan = planTimeline(cards, { dateKey: "when" });
    expect(plan.positions.early!.x).toBeLessThan(plan.positions.late!.x);
  });

  it("makes a lane per value of the lane attribute", () => {
    const plan = planTimeline(cards, { dateKey: "when", laneKey: "team" });
    expect(plan.lanes.map((l) => l.title)).toEqual(["Grid", "Data"]); // busiest first
    // and the lanes do not overlap
    expect(plan.lanes[1]!.y).toBeGreaterThanOrEqual(plan.lanes[0]!.y + plan.lanes[0]!.h);
  });

  it("keeps cards in the same lane and period from sitting on top of each other", () => {
    const together = [card("a", { when: "2027-01-05" }), card("b", { when: "2027-01-06" }), card("c", { when: "2027-01-07" })];
    const plan = planTimeline(together, { dateKey: "when", granularity: "quarter" });
    const ys = Object.values(plan.positions).map((p) => p.y).sort((a, b) => a - b);
    expect(new Set(ys).size).toBe(3);
    // the lane grew to hold them
    expect(plan.lanes[0]!.h).toBeGreaterThan(3 * 124);
  });

  it("labels every period between the first and the last, including empty ones", () => {
    const plan = planTimeline([card("a", { when: "2027-01-01" }), card("b", { when: "2027-10-01" })], { dateKey: "when", granularity: "quarter" });
    expect(plan.periods.map((p) => p.label)).toEqual(["2027 Q1", "2027 Q2", "2027 Q3", "2027 Q4"]);
  });

  it("chooses a granularity that suits the span", () => {
    expect(planTimeline([card("a", { when: "2027-01-01" }), card("b", { when: "2027-03-01" })], { dateKey: "when" }).granularity).toBe("month");
    expect(planTimeline([card("a", { when: "2027-01-01" }), card("b", { when: "2028-01-01" })], { dateKey: "when" }).granularity).toBe("quarter");
    expect(planTimeline([card("a", { when: "2027-01-01" }), card("b", { when: "2035-01-01" })], { dateKey: "when" }).granularity).toBe("year");
  });

  it("can make lanes from the card's kind, the grouping people reach for first", () => {
    const mixed = [card("a", { when: "2027-01-01" }, "Application"), card("b", { when: "2027-02-01" }, "Data Object"), card("c", { when: "2027-03-01" }, "Application")];
    const plan = planTimeline(mixed, { dateKey: "when", laneByKind: true });
    expect(plan.lanes.map((l) => l.title)).toEqual(["Application", "Data Object"]);
  });

  it("parks cards with no date in a lane of their own rather than dropping them", () => {
    const mixed = [...cards, card("nodate", { team: "Grid" })];
    const plan = planTimeline(mixed, { dateKey: "when", laneKey: "team" });
    expect(plan.undated).toEqual(["nodate"]);
    expect(plan.lanes.at(-1)!.title).toBe("no when");
    expect(plan.positions.nodate).toBeTruthy();
  });

  it("does nothing rather than something wrong when nothing has a date", () => {
    const plan = planTimeline([card("a", { owner: "Grid" })], { dateKey: "when" });
    expect(plan.lanes).toEqual([]);
    expect(plan.span).toBeNull();
    expect(plan.undated).toEqual(["a"]);
  });

  it("starts below whatever is already on the board", () => {
    const boxes = [{ id: "x", type: "card" as const, x: 40, y: 10, w: 200, h: 100, kind: "", color: "", title: "", description: "", z: 1 }];
    expect(originBelow(boxes, 100)).toEqual({ x: 40, y: 210 });
    expect(originBelow([])).toEqual({ x: 0, y: 0 });
  });

  it("labels periods the way a person would say them", () => {
    expect(periodLabel(Date.UTC(2027, 6, 1), "quarter")).toBe("2027 Q3");
    expect(periodLabel(Date.UTC(2027, 6, 1), "year")).toBe("2027");
    expect(periodLabel(Date.UTC(2027, 6, 1), "month")).toBe("July 2027");
  });
});
