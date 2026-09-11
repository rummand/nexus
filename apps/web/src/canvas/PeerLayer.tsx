"use client";

import { useMemo, useState } from "react";
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

/**
 * Who is on this board (#148, §5.95).
 *
 * Before this, the only evidence a colleague was here was their cursor, and only while it was
 * inside your viewport — so on a landscape the size of a wall, somebody working two screens away
 * was invisible, and *following* them was unreachable because following starts by clicking a
 * cursor you cannot see.
 *
 * Two verbs per person, deliberately different. **Go to** moves your camera once and leaves it
 * with you; **follow** hands it over until you take it back. Conflating them is how people end
 * up dragged around a board wondering what they pressed.
 */
export function PeopleCard() {
  const store = useCanvasStore();
  const boardId = useCanvas((s) => s.boardId);
  const peers = useCanvas((s) => s.peers);
  const live = useCanvas((s) => s.live);
  const following = useCanvas((s) => s.following);
  const myPeerId = useCanvas((s) => s.myPeerId);
  const gatheredBy = useCanvas((s) => s.gatheredBy);
  const [open, setOpen] = useState(false);

  // Alone on the board is the normal case, and a panel about nobody is chrome for its own sake.
  if (!live || peers.length === 0) return gatheredBy ? <GatheredNote /> : null;

  return (
    <>
      {gatheredBy && <GatheredNote />}
      <div className={`people-card${open ? " open" : ""}`} data-people-card>
        <button type="button" className="people-stack" onClick={() => setOpen((v) => !v)} aria-expanded={open} data-people-toggle>
          {peers.slice(0, 4).map((peer) => (
            <i key={peer.id} style={{ background: peer.color }} title={peer.name}>{initials(peer.name)}</i>
          ))}
          <span>{peers.length + 1} here</span>
        </button>

        {open && (
          <div className="people-list">
            {peers.map((peer) => (
              <div key={peer.id} className="people-row" data-person={peer.id}>
                <i style={{ background: peer.color }}>{initials(peer.name)}</i>
                <span>
                  <b>{peer.name}</b>
                  <em>{peer.editing ? "typing" : peer.selection.length ? `${peer.selection.length} selected` : "looking around"}</em>
                </span>
                <button type="button" onClick={() => store.getState().goTo(peer.id)} data-go-to={peer.id} title="Move my view to theirs, once">
                  Go to
                </button>
                <button
                  type="button"
                  className={following === peer.id ? "on" : ""}
                  onClick={() => store.getState().follow(peer.id)}
                  data-follow={peer.id}
                  title="Keep my view on theirs until I take it back"
                >
                  {following === peer.id ? "Following" : "Follow"}
                </button>
              </div>
            ))}
            <button type="button" className="people-gather" onClick={() => void askEveryoneHere(boardId, myPeerId)} data-gather>
              Bring everyone here
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/** Being moved without explanation is disorienting, so the move always says who did it. */
function GatheredNote() {
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
