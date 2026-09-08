"use client";

import { useMemo } from "react";
// The same initials the sidebar and the topbar already show for a person.
import { initials } from "@/components/workspace/Sidebar";
import { boxToScreen, elementBounds, worldToScreen } from "./geometry";
import { useCanvas } from "./store";

/**
 * Everybody else, drawn on top of the board.
 *
 * Two things and no more: where their pointer is, and what they have hold of. Both are read from
 * presence, which is never written down — close the tab and you are gone, with nothing to clean up
 * and no lock to get stuck.
 *
 * Cursors arrive in world coordinates, so a colleague who is zoomed out sees the pointer over the
 * same *card*, not at the same place on the glass. That is the only sensible reading of "where
 * they are" on a canvas two people are looking at from different distances.
 */
export function PeerLayer() {
  const peers = useCanvas((s) => s.peers);
  const camera = useCanvas((s) => s.camera);
  const elements = useCanvas((s) => s.elements);

  const marks = useMemo(() => {
    return peers.map((peer) => {
      const boxes = peer.selection
        .map((id) => elements[id])
        .filter((el) => el !== undefined)
        // A connector's bounds need the whole map to resolve its ends, and a connector with a
        // missing end has none — hence the null.
        .map((el) => elementBounds(el, elements))
        .filter((box) => box !== null)
        .map((box) => boxToScreen(box, camera));
      return { peer, boxes, cursor: peer.cursor ? worldToScreen(peer.cursor, camera) : null };
    });
  }, [peers, elements, camera]);

  if (!marks.length) return null;

  return (
    <div className="peer-layer" aria-hidden>
      {marks.map(({ peer, boxes, cursor }) => (
        <div key={peer.id}>
          {boxes.map((box, i) => (
            <div
              key={i}
              className="peer-hold"
              style={{ left: box.x, top: box.y, width: box.w, height: box.h, borderColor: peer.color }}
            />
          ))}
          {cursor && (
            <div className="peer-cursor" style={{ left: cursor.x, top: cursor.y }}>
              {/* Drawn rather than imported: one path is cheaper than a component and it can take
                  the peer's colour directly. */}
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M2 2 L2 14 L5.6 10.6 L8 16 L10.6 14.9 L8.2 9.7 L13 9.4 Z" fill={peer.color} stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
              <b style={{ background: peer.color }}>{peer.name}</b>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Who is here, in the topbar.
 *
 * Just the initials, in the person's colour, with the name on hover. Presence is worth a glance,
 * not a panel — the useful signal is "somebody else is in here", and the cursors say the rest.
 */
export function PeerChips() {
  const peers = useCanvas((s) => s.peers);
  const live = useCanvas((s) => s.live);
  if (!peers.length) return null;
  return (
    <div className="peer-chips" title={live ? "Also on this board" : "Reconnecting…"}>
      {peers.slice(0, 5).map((peer) => (
        <span key={peer.id} className="peer-chip" style={{ background: peer.color }} title={peer.name}>
          {initials(peer.name)}
        </span>
      ))}
      {peers.length > 5 && <span className="peer-chip more">+{peers.length - 5}</span>}
    </div>
  );
}
