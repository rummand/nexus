import { describe, expect, it } from "vitest";
import { easeCamera, followCamera, settled } from "./follow";
import { MAX_ZOOM, visibleWorldRect } from "./geometry";

/**
 * Following somebody's viewport (§5.51).
 *
 * The property that matters is one sentence: whatever the leader can see, the follower can see —
 * on any window. Everything here is a way of failing that sentence.
 */

const view = { x: 1000, y: 500, w: 800, h: 600 };
/** What the follower ends up looking at, given their window. */
const seen = (v: typeof view, w: number, h: number) => visibleWorldRect(followCamera(v, w, h), w, h);
const covers = (outer: { x: number; y: number; w: number; h: number }, inner: typeof view) =>
  outer.x <= inner.x + 0.01 && outer.y <= inner.y + 0.01 && outer.x + outer.w >= inner.x + inner.w - 0.01 && outer.y + outer.h >= inner.y + inner.h - 0.01;

describe("the camera that follows a viewport", () => {
  it("shows everything the leader shows, on the same window", () => {
    expect(covers(seen(view, 1600, 1000), view)).toBe(true);
  });

  it("shows everything the leader shows on a window of a different shape", () => {
    // The case a copied zoom gets wrong: a narrow window with the leader's zoom cuts the sides off.
    for (const [w, h] of [[600, 1200], [2400, 500], [900, 900], [1200, 400]] as const) {
      expect(covers(seen(view, w, h), view), `${w}×${h}`).toBe(true);
    }
  });

  it("centres on what they are looking at rather than merely containing it", () => {
    const cam = followCamera(view, 1600, 1000);
    const mine = visibleWorldRect(cam, 1600, 1000);
    expect(mine.x + mine.w / 2).toBeCloseTo(view.x + view.w / 2, 6);
    expect(mine.y + mine.h / 2).toBeCloseTo(view.y + view.h / 2, 6);
  });

  it("does not zoom past what the canvas allows, however small their window", () => {
    expect(followCamera({ x: 0, y: 0, w: 1, h: 1 }, 1600, 1000).zoom).toBeLessThanOrEqual(MAX_ZOOM);
  });

  it("answers something sane for a rectangle with no area", () => {
    expect(followCamera({ x: 0, y: 0, w: 0, h: 0 }, 1600, 1000)).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(followCamera(view, 0, 0)).toEqual({ x: 0, y: 0, zoom: 1 });
  });
});

describe("easing towards it", () => {
  const from = { x: 0, y: 0, zoom: 0.2 };
  const to = { x: 400, y: -200, zoom: 0.8 };

  it("gets there, and stops", () => {
    let cam = from;
    let frames = 0;
    while (!settled(cam, to) && frames < 500) {
      cam = easeCamera(cam, to);
      frames++;
    }
    expect(settled(cam, to)).toBe(true);
    // Fast enough to feel like following rather than a slow pan, slow enough not to be a jump.
    expect(frames).toBeGreaterThan(4);
    expect(frames).toBeLessThan(60);
  });

  it("eases zoom geometrically, so halfway between 20% and 80% is 40%", () => {
    expect(easeCamera({ x: 0, y: 0, zoom: 0.2 }, { x: 0, y: 0, zoom: 0.8 }, 0.5).zoom).toBeCloseTo(0.4, 6);
  });

  it("is already settled when there is nothing to do", () => {
    expect(settled(to, to)).toBe(true);
    expect(settled(from, to)).toBe(false);
  });
});
