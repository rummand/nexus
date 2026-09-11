import { describe, expect, it } from "vitest";
import { driftWords, sourceBranchMeans, stalenessOf, stalenessWords, standingBranchName } from "./drift";
import { NO_DIVERGENCE } from "@/lib/change/ref";

const d = (over: Partial<typeof NO_DIVERGENCE>) => {
  const merged = { ...NO_DIVERGENCE, ...over };
  return { ...merged, total: merged.introduces + merged.retires + merged.changes + merged.connects + merged.disconnects };
};

describe("what a source branch says", () => {
  it("is named as a sentence, not a label", () => {
    expect(standingBranchName("ServiceNow")).toBe("What ServiceNow says");
  });

  it("describes itself as a standing claim rather than a plan", () => {
    expect(sourceBranchMeans("LeanIX")).toContain("standing claim from LeanIX");
  });

  it("says so plainly when the source agrees with us", () => {
    expect(driftWords("ServiceNow", NO_DIVERGENCE)).toBe("ServiceNow agrees with the model.");
  });

  it("proposes in the source's own voice, naming what kind of change", () => {
    expect(driftWords("ServiceNow", d({ introduces: 12, changes: 20, connects: 2 })))
      .toBe("ServiceNow proposes 34 changes to the model: 12 objects we do not have, 20 it says we have wrong, 2 connections.");
  });

  it("counts one change as one change", () => {
    expect(driftWords("The CMDB", d({ changes: 1 }))).toBe("The CMDB proposes 1 change to the model: 1 it says we have wrong.");
  });

  it("says what a source no longer sees, without calling it retired", () => {
    expect(driftWords("ServiceNow", d({ retires: 3 }))).toContain("3 it no longer sees");
  });
});

describe("a branch nobody merges", () => {
  const now = new Date("2026-09-11T00:00:00Z");

  it("is fine for the first few weeks", () => {
    expect(stalenessOf("2026-09-05T00:00:00Z", now)).toEqual({ days: 6, stale: false });
    expect(stalenessWords("ServiceNow", "2026-09-05T00:00:00Z", d({ changes: 9 }), now)).toBe("");
  });

  it("is called out once it has been three weeks", () => {
    const { days, stale } = stalenessOf("2026-08-01T00:00:00Z", now);
    expect(days).toBe(41);
    expect(stale).toBe(true);
    expect(stalenessWords("ServiceNow", "2026-08-01T00:00:00Z", d({ changes: 9 }), now))
      .toContain("Nobody has reconciled ServiceNow for 41 days");
  });

  it("says nothing when the branch is old but empty: there is nothing to nag about", () => {
    expect(stalenessWords("ServiceNow", "2026-01-01T00:00:00Z", NO_DIVERGENCE, now)).toBe("");
  });

  it("treats a branch that has never been merged as not yet stale, rather than infinitely so", () => {
    expect(stalenessOf("", now)).toEqual({ days: 0, stale: false });
  });
});
