import { describe, expect, it } from "vitest";
import { HELP, NAV, PLATFORM, SETTINGS, allItems, railItems } from "./nav";

/**
 * The rules the sidebar is meant to obey (§5.65).
 *
 * The rail grew to nineteen entries because nothing here said it could not. These are the
 * statements that make "the rail shows the work, not the plumbing" enforceable rather than an
 * intention somebody wrote down once.
 */

describe("the rail", () => {
  it("stays small enough to scan", () => {
    // Not a magic number: past about a dozen, a vertical list stops being scanned and starts
    // being searched, and the whole point of the grouping is to keep it scannable.
    expect(railItems().length).toBeLessThanOrEqual(14);
  });

  it("is grouped, and every group but the first says what it is", () => {
    expect(NAV.length).toBeGreaterThanOrEqual(3);
    expect(NAV[0]!.label).toBeNull();
    for (const group of NAV.slice(1)) {
      expect(group.label, "a group without a label is not a group").toBeTruthy();
    }
  });

  it("has no group so large it is a list again", () => {
    for (const group of NAV) expect(group.items.length, `${group.label} is too long`).toBeLessThanOrEqual(5);
  });

  it("puts nothing administrative in the rail", () => {
    /*
     * The regression this exists to catch: the next revision that adds a settings screen and
     * reaches for the rail because that is where the last one went.
     */
    const paths = railItems().map((i) => i.path);
    expect(paths.filter((p) => p.startsWith("/settings"))).toEqual([]);
    expect(paths).not.toContain("/admin");
    expect(paths).not.toContain("/docs");
  });

  it("gives everything an address of its own", () => {
    const paths = allItems().map((i) => i.path);
    expect(new Set(paths).size, "two entries point at the same page").toBe(paths.length);
    const ids = allItems().map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("puts nothing in two groups at once", () => {
    const seen = new Set<string>();
    for (const group of NAV) {
      for (const item of group.items) {
        expect(seen.has(item.id), `${item.id} is in two groups`).toBe(false);
        seen.add(item.id);
      }
    }
  });

  it("marks exactly one entry as exact, because only the home page is a prefix of everything", () => {
    expect(railItems().filter((i) => i.exact).map((i) => i.id)).toEqual(["home"]);
  });
});

describe("what moved out of it", () => {
  it("keeps the settings area to the things that are configured rather than used", () => {
    expect(SETTINGS.every((i) => i.path.startsWith("/settings"))).toBe(true);
    expect(SETTINGS.map((i) => i.id).sort()).toEqual(["connections", "models", "people"]);
  });

  it("shows the platform console to operators only, and addresses it outside the workspace", () => {
    expect(PLATFORM.operatorOnly).toBe(true);
    // It is not a workspace page: prefixing it with /w/<slug> would put the deployment inside one
    // of the tenants it is above (§5.64).
    expect(PLATFORM.path.startsWith("/settings")).toBe(false);
    expect(PLATFORM.path).toBe("/admin");
  });

  it("keeps help reachable without giving it a slot in the rail", () => {
    expect(HELP.path).toBe("/docs");
    expect(railItems().some((i) => i.id === HELP.id)).toBe(false);
  });

  it("marks nothing in the rail or the settings nav as operator-only", () => {
    // Operator-only is a property of one entry. If a second appears, the rule above stops being
    // "the console is hidden" and becomes a permission model nobody wrote down.
    expect([...railItems(), ...SETTINGS].filter((i) => i.operatorOnly)).toEqual([]);
  });
});
