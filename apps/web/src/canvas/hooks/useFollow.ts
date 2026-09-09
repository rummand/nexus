"use client";

import { useEffect, useRef } from "react";
import { easeCamera, followCamera, settled } from "../follow";
import { useCanvasStore } from "../store";
import type { Camera } from "../geometry";

/**
 * Your camera, tracking somebody else's (§5.51).
 *
 * Two things, and the second is the whole design. The first is easy: read the followed peer's
 * world rectangle out of presence and ease towards the camera that shows it.
 *
 * The second is knowing when to let go. Following has to end the moment you move the board
 * yourself — an "unfollow" button you have to find, while the canvas is being dragged out from
 * under you, is not an escape hatch. But this hook moves the camera too, so it cannot simply treat
 * every camera change as yours. It flags its own writes: zustand notifies synchronously inside
 * `set`, so a boolean held across the call is true for exactly this hook's own change and for
 * nothing else. Any other camera change — a pan, a wheel, zoom-to-fit, a viewpoint, the command
 * bar focusing a card — ends the follow without any of them having to know that following exists.
 */
export function useFollow() {
  const store = useCanvasStore();
  const mine = useRef(false);

  useEffect(() => {
    let frame: number | null = null;

    const move = (cam: Camera) => {
      mine.current = true;
      try {
        store.getState().setCamera(cam);
      } finally {
        mine.current = false;
      }
    };

    /** The camera that shows what the followed peer sees, or null if there is nobody to follow. */
    const target = (): Camera | null => {
      const s = store.getState();
      if (!s.following) return null;
      const peer = s.peers.find((p) => p.id === s.following);
      if (!peer?.view) return null;
      return followCamera(peer.view, s.viewport.w, s.viewport.h);
    };

    const step = () => {
      frame = null;
      const to = target();
      if (!to) return;
      const from = store.getState().camera;
      if (settled(from, to)) return;
      move(easeCamera(from, to));
      frame = requestAnimationFrame(step);
    };

    const nudge = () => {
      if (frame === null) frame = requestAnimationFrame(step);
    };

    /* A new rectangle from the peer, a follow just started, or this window was resized. */
    const unsubPeers = store.subscribe((state, prev) => {
      if (!state.following) return;
      if (state.peers !== prev.peers || state.following !== prev.following || state.viewport !== prev.viewport) nudge();
    });

    /*
     * Somebody moved the board. If it was not this hook, it was the person, and they have taken
     * the wheel back. The viewport is deliberately not watched here: resizing your window is not
     * you choosing where to look, and it would be a strange thing to be dropped by.
     */
    const unsubCamera = store.subscribe((state, prev) => {
      if (state.camera === prev.camera || mine.current) return;
      if (state.following) store.getState().follow(null);
    });

    // The key everybody presses to get out of something.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && store.getState().following) store.getState().follow(null);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
      unsubPeers();
      unsubCamera();
    };
  }, [store]);
}
