import type { Box } from "./document";
import { MAX_ZOOM, cameraToFit, clamp, type Camera } from "./geometry";

/**
 * Following somebody's viewport (§5.51).
 *
 * The wire carries the **world rectangle** a peer can see, not their camera. A camera is in their
 * screen units: copying `zoom` verbatim onto a smaller window shows less of the board than they
 * are looking at, which is the one thing following must not do — "look at this corner" has to end
 * with the corner on your screen. A rectangle is what they can see, and each follower fits it to
 * whatever window they happen to have.
 */

/** How much further out than the peer to sit, so their edges are inside yours rather than on them. */
const MARGIN = 1.06;

/** The camera that shows everything `view` shows, in a `w`×`h` viewport. */
export function followCamera(view: Box, w: number, h: number): Camera {
  if (!(view.w > 0) || !(view.h > 0) || !(w > 0) || !(h > 0)) return { x: 0, y: 0, zoom: 1 };
  const padded = {
    x: view.x - (view.w * (MARGIN - 1)) / 2,
    y: view.y - (view.h * (MARGIN - 1)) / 2,
    w: view.w * MARGIN,
    h: view.h * MARGIN,
  };
  return cameraToFit(padded, w, h, 0, MAX_ZOOM);
}

/**
 * Is this camera near enough to the target to stop animating?
 *
 * In screen pixels rather than world units, because that is where the difference is visible: at
 * 3% zoom a hundred world units is three pixels and easing towards them forever is a wasted frame
 * every sixteen milliseconds.
 */
export function settled(a: Camera, b: Camera): boolean {
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.zoom - b.zoom) / b.zoom < 0.002;
}

/**
 * One frame of easing towards the target.
 *
 * Zoom is eased geometrically — halfway between 20% and 80% is 40%, not 50% — because zoom is a
 * ratio, and easing it linearly makes a long zoom look like it accelerates into the target.
 */
export function easeCamera(from: Camera, to: Camera, t = 0.28): Camera {
  const k = clamp(t, 0, 1);
  return {
    x: from.x + (to.x - from.x) * k,
    y: from.y + (to.y - from.y) * k,
    zoom: from.zoom * (to.zoom / from.zoom) ** k,
  };
}
