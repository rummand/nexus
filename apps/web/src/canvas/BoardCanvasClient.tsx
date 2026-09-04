"use client";

import dynamic from "next/dynamic";
import type { CanvasDocument } from "./document";
import type { StudioTopbarProps } from "./StudioTopbar";

/**
 * The canvas is client-only: server-rendering hundreds of absolutely positioned objects and
 * hydrating them buys nothing (the camera is fitted on the client anyway) and costs seconds
 * on large boards. The shell renders immediately with a lightweight placeholder.
 */
const BoardCanvas = dynamic(() => import("./BoardCanvas").then((m) => m.BoardCanvas), {
  ssr: false,
  loading: () => (
    <div className="miro-studio">
      <header className="studio-topbar"><div className="brand-block"><span className="brand-mark" /><div><h1>Loading board…</h1><p>Fitting the canvas to your content.</p></div></div></header>
      <main className="canvas-viewport select-tool" />
    </div>
  ),
});

export function BoardCanvasClient(props: { document: CanvasDocument; header: StudioTopbarProps }) {
  return <BoardCanvas {...props} />;
}
