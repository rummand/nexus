"use client";

import { useEffect, useRef, type RefObject } from "react";
import { applyPatch, diffElements, type DocParts, type Down, type Patch, type Up } from "@/lib/live/protocol";
import { screenToWorld, visibleWorldRect } from "../geometry";
import { useCanvasStore } from "../store";

/** Cursors move every frame; the wire does not need to. */
const CURSOR_MS = 60;
/** Long enough that a drag is one message rather than sixty, short enough to look immediate. */
const PATCH_MS = 90;
/**
 * Coarser than the cursor on purpose (§5.51): a viewport is a slab of board rather than a point,
 * so a follower reading it every eighth of a second loses nothing, and the follow eases between
 * updates anyway.
 */
const VIEW_MS = 130;

/**
 * The board, shared.
 *
 * One stream down and small POSTs up (§5.40). The hook does three things and keeps them apart:
 * it sends what this person changed, it applies what other people changed, and it keeps the
 * presence of everybody in the store where the canvas can draw it.
 *
 * The whole design rests on one property of the store: every document mutation goes through a
 * single `mutate`, which replaces the element map and bumps `revision`. So "what did they just
 * do" is a diff of the element map between two revisions — no operation log to keep in step with
 * the undo stack, no second source of truth. Applying a remote change goes in through
 * `applyRemote`, which deliberately does *not* bump `revision`, so it is not echoed back and does
 * not land on the sender's undo stack.
 *
 * If the stream will not open — an old proxy, a network that hates long responses — nothing here
 * throws and the store's `live` stays false, which leaves the pre-multiplayer behaviour running
 * underneath: this tab saves for itself and a losing race is refused with "changed elsewhere".
 */
/**
 * "Everyone look at this" (#148, §5.95).
 *
 * A plain post rather than something threaded through the hook: it is a one-off event with no
 * state to keep, and the room already knows which viewport the asker has because presence has
 * been telling it all along.
 */
export async function askEveryoneHere(boardId: string, peerId: string): Promise<void> {
  if (!boardId || !peerId) return;
  await fetch(`/api/boards/${boardId}/live`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-nexus-peer": peerId },
    body: JSON.stringify({ kind: "gather" }),
  }).catch(() => { /* the stream closing is what triggers recovery, not this */ });
}

export function useLive(rootRef: RefObject<HTMLDivElement | null>) {
  const store = useCanvasStore();
  const peerId = useRef<string>("");

  useEffect(() => {
    const boardId = store.getState().boardId;
    let source: EventSource | null = null;
    let stopped = false;
    let retry = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    /*
     * The element map as the server has it, from this client's point of view: what we last sent
     * plus everything we have received. Diffing against it rather than against the previous local
     * state is what stops a remote change bouncing straight back out again.
     */
    let mirror = { ...store.getState().elements };
    /* The same baseline idea for the document's non-element parts (§5.40). */
    let docMirror: DocParts = { viewpoints: store.getState().viewpoints, script: store.getState().script };
    let pending: Patch | null = null;
    let patchTimer: ReturnType<typeof setTimeout> | null = null;

    const post = (body: Up) => {
      if (!peerId.current) return;
      void fetch(`/api/boards/${boardId}/live`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-nexus-peer": peerId.current },
        body: JSON.stringify(body),
        keepalive: body.kind === "presence",
      }).catch(() => {
        /* A dropped message is a dropped message; the stream closing is what triggers recovery. */
      });
    };

    const flush = () => {
      patchTimer = null;
      if (!pending) return;
      post({ kind: "patch", patch: pending });
      pending = null;
    };

    /** Merge into the pending patch so a drag arrives as one message rather than as sixty. */
    const queue = (patch: Patch) => {
      if (!pending) pending = {};
      if (patch.upsert) pending.upsert = { ...pending.upsert, ...patch.upsert };
      if (patch.remove) {
        // An element removed after being upserted in the same window is simply gone.
        for (const id of patch.remove) delete pending.upsert?.[id];
        pending.remove = [...new Set([...(pending.remove ?? []), ...patch.remove])];
      }
      if (!patchTimer) patchTimer = setTimeout(flush, PATCH_MS);
    };

    const onMessage = (raw: string) => {
      let message: Down;
      try {
        message = JSON.parse(raw) as Down;
      } catch {
        return;
      }
      const s = store.getState();

      if (message.kind === "presence") {
        s.setPeers(message.peers.filter((p) => p.id !== peerId.current));
        return;
      }

      if (message.kind === "gather") {
        /*
         * Somebody asked the room to look at what they are looking at (§5.95). It moves the
         * camera once and stops following, because being pulled somewhere and *then* being
         * dragged around is two surprises where the person asked for one.
         */
        s.gatherTo(message.view, message.name);
        return;
      }

      if (message.kind === "doc") {
        s.applyRemoteDoc(message.parts);
        docMirror = { ...docMirror, ...message.parts };
        return;
      }

      if (message.kind === "resync") {
        // A board an approval, a restore or a plain save rewrote underneath us. That write is the
        // truth by definition, so it replaces what is here — the case that used to need a reload.
        mirror = { ...message.elements };
        s.applyRemote(mirror);
        s.applyRemoteDoc(message.parts);
        docMirror = { ...message.parts };
        return;
      }

      if (message.kind === "hello") {
        s.setPeers(message.peers.filter((p) => p.id !== peerId.current));
        /*
         * The server's copy is the base, but it must not swallow anything this person has already
         * done. Opening a stream takes a moment, and a card drawn — or deleted — in that moment
         * exists only here; replacing the map outright would make it reappear a second later.
         *
         * `mirror` still holds the document this tab was rendered with, and the room was built
         * from the same board, so it is a baseline both sides genuinely shared. The difference
         * between it and the board as it now stands is precisely this person's own intent, and it
         * is applied over the server's copy and sent on. Anything a colleague changed in the same
         * moment is in the server's copy and is not in this diff, so it survives.
         */
        const mine = diffElements(mirror, s.elements);
        mirror = { ...message.elements };
        if (mine) {
          mirror = applyPatch(mirror, mine);
          queue(mine);
        }
        s.applyRemote(mirror);

        // The same argument for the parts that are not elements: a viewpoint saved or a script
        // written before the stream opened belongs to this person, not to the server's copy.
        const myParts: DocParts = {};
        if (JSON.stringify(s.viewpoints) !== JSON.stringify(docMirror.viewpoints)) myParts.viewpoints = s.viewpoints;
        if (s.script !== docMirror.script) myParts.script = s.script;
        docMirror = { ...message.parts };
        // The server's copy first, then this person's own back over the top: taking only one or
        // the other loses whichever half the other side had.
        s.applyRemoteDoc(message.parts);
        if (Object.keys(myParts).length) {
          s.applyRemoteDoc(myParts);
          post({ kind: "doc", parts: myParts });
          docMirror = { ...docMirror, ...myParts };
        }
        return;
      }

      if (message.kind === "patch") {
        mirror = applyPatch(mirror, message.patch);
        /*
         * Applied over what *this* person has since done, not over the mirror: they may have moved
         * something else in the last ninety milliseconds, and their own unsent work must survive
         * somebody else's card moving.
         */
        const merged = applyPatch(s.elements, message.patch);
        if (merged !== s.elements) s.applyRemote(merged);
      }
    };

    const connect = () => {
      if (stopped) return;
      source = new EventSource(`/api/boards/${boardId}/live`);

      source.addEventListener("peer", (e) => {
        try {
          peerId.current = (JSON.parse((e as MessageEvent<string>).data) as { peerId: string }).peerId;
          retry = 0;
          store.getState().setMyPeerId(peerId.current);
          store.getState().setLive(true);
          // Say where we are looking straight away: until the camera next moves there would be
          // nothing to follow, and "follow me" has to work on the board as it is standing.
          sendView();
        } catch {
          /* malformed handshake: the retry below will get another one */
        }
      });
      source.onmessage = (e: MessageEvent<string>) => onMessage(e.data);
      source.onerror = () => {
        source?.close();
        source = null;
        peerId.current = "";
        store.getState().setLive(false);
        if (stopped) return;
        // Back off, but not far: a canvas that silently stops being shared is worse than a retry.
        retry = Math.min(retry + 1, 5);
        reconnectTimer = setTimeout(connect, 500 * 2 ** (retry - 1));
      };
    };

    /*
     * What this person can see, for anybody following them (§5.51). Throttled with a trailing send,
     * because the last frame of a pan is the one that matters and dropping it would leave the
     * follower a little behind wherever the leader stopped.
     */
    let viewTimer: ReturnType<typeof setTimeout> | null = null;
    let lastView = 0;
    const sendView = () => {
      viewTimer = null;
      lastView = Date.now();
      const s = store.getState();
      post({ kind: "presence", view: visibleWorldRect(s.camera, s.viewport.w, s.viewport.h) });
    };
    const unsubView = store.subscribe((state, prev) => {
      if (state.camera === prev.camera && state.viewport === prev.viewport) return;
      if (!peerId.current || viewTimer) return;
      const wait = Math.max(0, VIEW_MS - (Date.now() - lastView));
      viewTimer = setTimeout(sendView, wait);
    });

    connect();

    // ---- what this person does, going out ----
    const unsubDoc = store.subscribe((state, prev) => {
      if (state.elements === prev.elements) return;
      if (!peerId.current) {
        /*
         * Not connected, so the mirror is deliberately left alone. It holds the last state this
         * tab and the server agreed on — the document the page was rendered with, or whatever was
         * current when the stream dropped — and that baseline is the only thing that can tell the
         * `hello` handler what this person did in the meantime. Advancing it here would erase the
         * evidence and the work with it.
         */
        return;
      }
      const patch = diffElements(mirror, state.elements);
      if (!patch) return;
      mirror = { ...state.elements };
      queue(patch);
    });

    /*
     * Saved viewpoints and the Compose script are part of the board but not on the canvas, so they
     * cannot ride an element patch — and while the room is the writer this tab has stopped saving,
     * so without this they would never be written down at all. Both change rarely; neither is
     * batched.
     */
    const unsubParts = store.subscribe((state, prev) => {
      if (!peerId.current) return;
      const parts: DocParts = {};
      if (state.viewpoints !== prev.viewpoints) parts.viewpoints = state.viewpoints;
      if (state.script !== prev.script) parts.script = state.script;
      if (!Object.keys(parts).length) return;
      docMirror = { ...docMirror, ...parts };
      post({ kind: "doc", parts });
    });

    // What this person has selected, and which field they have open — the soft lock everyone
    // else obeys. Both change rarely, so neither is throttled.
    const unsubPresence = store.subscribe((state, prev) => {
      if (state.selection === prev.selection && state.focusedId === prev.focusedId) return;
      post({ kind: "presence", selection: state.selection, editing: state.focusedId });
    });

    /* Who this person is following, so nobody can follow them back into a loop (§5.51). */
    const unsubFollowing = store.subscribe((state, prev) => {
      if (state.following === prev.following) return;
      post({ kind: "presence", following: state.following });
    });

    let lastCursor = 0;
    const onPointer = (e: PointerEvent) => {
      const now = Date.now();
      if (now - lastCursor < CURSOR_MS) return;
      lastCursor = now;
      // World coordinates, so a colleague zoomed differently still sees the cursor on the card
      // it is over. Screen coordinates would put it somewhere meaningless on their screen.
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      post({ kind: "presence", cursor: screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top }, store.getState().camera) });
    };
    const onLeave = () => post({ kind: "presence", cursor: null });

    window.addEventListener("pointermove", onPointer);
    document.addEventListener("mouseleave", onLeave);

    return () => {
      stopped = true;
      if (patchTimer) {
        clearTimeout(patchTimer);
        flush();
      }
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (viewTimer) clearTimeout(viewTimer);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("mouseleave", onLeave);
      unsubDoc();
      unsubParts();
      unsubPresence();
      unsubFollowing();
      unsubView();
      source?.close();
      peerId.current = "";
      store.getState().setLive(false);
      store.getState().setPeers([]);
      store.getState().follow(null);
      store.getState().setMyPeerId("");
    };
  }, [store, rootRef]);
}
