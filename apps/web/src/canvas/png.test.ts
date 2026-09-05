import { describe, expect, it } from "vitest";
import { MAX_PNG_EDGE, fitScale, svgSize } from "./png";

describe("png export sizing", () => {
  it("reads width and height from the viewBox, rounding up", () => {
    expect(svgSize('<svg viewBox="-60 -92 1240.5 800.2" width="1240">')).toEqual({ width: 1241, height: 801 });
    expect(svgSize('<svg viewBox="0 0 400 300">')).toEqual({ width: 400, height: 300 });
  });
  it("falls back when there is no viewBox", () => {
    expect(svgSize("<svg>")).toEqual({ width: 1600, height: 1000 });
  });
  it("keeps the requested scale when it fits, and clamps a huge board", () => {
    expect(fitScale(1000, 800, 2)).toBe(2);
    // 5000 * 2 = 10000 exceeds the cap, so it scales down to land exactly on it
    expect(fitScale(5000, 1000, 2)).toBeCloseTo(MAX_PNG_EDGE / 5000);
    expect(fitScale(5000, 1000, 2) * 5000).toBeCloseTo(MAX_PNG_EDGE);
    // never below 1:1, even for a board wider than the cap
    expect(fitScale(20000, 500, 2)).toBe(1);
  });
});
