"use client";

import { useMemo } from "react";
import { Users } from "lucide-react";
// The same initials the sidebar and the topbar already show for a person.
import { initials } from "@/components/workspace/Sidebar";
import { askEveryoneHere } from "./hooks/useLive";
import { boxToScreen, elementBounds, worldToScreen } from "./geometry";
import { useCanvas, useCanvasStore } from "./store";

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
 * Who is here, in the topbar — and the way to go and stand where they are standing (§5.51).
 *
 * Just the initials, in the person's colour, with the name on hover. Presence is worth a glance,
 * not a panel — the useful signal is "somebody else is in here", and the cursors say the rest.
 * Clicking one follows their viewport, which is the shortest path from "look at this corner" to
 * looking at it; clicking it again stops.
 */
export function PeerChips() {
  const store = useCanvasStore();
  const boardId = useCanvas((s) => s.boardId);
  const peers = useCanvas((s) => s.peers);
  const live = useCanvas((s) => s.live);
  const following = useCanvas((s) => s.following);
  const me = useCanvas((s) => s.myPeerId);
  if (!peers.length) return null;
  return (
    <div className="peer-chips" title={live ? "Also on this board" : "Reconnecting…"} data-peer-chips>
      {peers.slice(0, 5).map((peer) => {
        const on = following === peer.id;
        // Following somebody who is following you is the one loop the design refuses, so the
        // control says so rather than doing nothing when pressed.
        const watchingMe = Boolean(me) && peer.following === me;
        return (
          <button
            key={peer.id}
            type="button"
            className={on ? "peer-chip following" : watchingMe ? "peer-chip watching" : "peer-chip"}
            /* The ring is the person's own colour, so it has to be drawn with it rather than with
               `currentColor` — the text on these chips is white. */
            style={on ? { background: peer.color, boxShadow: `0 0 0 2px var(--panel), 0 0 0 4px ${peer.color}` } : { background: peer.color }}
            title={
              on ? `Stop following ${peer.name}`
                : watchingMe ? `${peer.name} is following you`
                : peer.view ? `Follow ${peer.name}`
                : `${peer.name} — not looking anywhere yet`
            }
            aria-pressed={on}
            disabled={!peer.view || watchingMe}
            onClick={() => store.getState().follow(peer.id)}
            data-peer-follow={peer.id}
          >
            {initials(peer.name)}
          </button>
        );
      })}
      {peers.length > 5 && <span className="peer-chip more">+{peers.length - 5}</span>}
      {/*
        The one thing the chips could not do (#148, §5.95). Following is a pull — it takes you to
        somebody. This is the push, and it is the gesture people actually use out loud: "everyone
        look at this". It lives here rather than in a panel of its own, because a second place to
        see who is on the board would be two answers to one question.
      */}
      <button
        type="button"
        className="peer-gather"
        title="Bring everyone on this board to where you are looking"
        onClick={() => void askEveryoneHere(boardId, me)}
        data-gather
      >
        <Users size={13} />
      </button>
    </div>
  );
}

/**
 * The board is not yours at the moment, and that has to be impossible to miss (§5.51).
 *
 * A tint in the peer's colour around the edge of the canvas, and one sentence saying whose view
 * you are in. Both go the instant you touch the board yourself.
 */
export function FollowBar() {
  const store = useCanvasStore();
  const following = useCanvas((s) => s.following);
  const peer = useCanvas((s) => s.peers.find((p) => p.id === s.following));
  if (!following || !peer) return null;
  return (
    <>
      <div className="follow-frame" style={{ borderColor: peer.color }} aria-hidden />
      <div className="follow-bar" data-follow-bar>
        <i style={{ background: peer.color }} />
        Following {peer.name}
        <small>move the board to take it back</small>
        <button type="button" onClick={() => store.getState().follow(null)}>Stop</button>
      </div>
    </>
  );
}

/** Being moved without explanation is disorienting, so the move always says who did it. */
export function GatheredNote() {
  const store = useCanvasStore();
  const gatheredBy = useCanvas((s) => s.gatheredBy);
  if (!gatheredBy) return null;
  return (
    <div className="gathered-note" data-gathered>
      <b>{gatheredBy.name}</b> brought you here.
      <button type="button" onClick={() => store.getState().clearGathered()}>OK</button>
    </div>
  );
}
