import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { parseDocument, type CanvasDocument, type CanvasElement, type ElementId } from "@/canvas/document";
import { saveBoardDocument } from "@/lib/board-save";
import { hydrateDocument, syncBoardToGraph } from "@/lib/graph";
import { reconcileBoard } from "@/lib/import/sync";
import { applyPatch, peerColor, type DocParts, type Down, type Patch, type Peer } from "./protocol";

/**
 * A board with people on it.
 *
 * One room per board, held in the server's memory for as long as somebody is looking. It owns
 * three things and nothing else: the document as it currently is, the people who are here, and a
 * debounce that writes the document down.
 *
 * **The server is the writer while a board is live.** Before this, every tab autosaved its own
 * whole document and the loser of a race was refused with a 409. With several people that is both
 * wrong (they have converged; there is nothing to refuse) and wasteful (N saves and N graph syncs
 * for one edit). So a live client sends what it changed and stops saving; the room applies the
 * patch in arrival order — which is what makes last-writer-wins *defined* rather than a matter of
 * whose network was quicker — and persists once the board goes quiet.
 *
 * **This is one process.** Rooms live in this server's heap, so a second replica would be a second
 * set of rooms and two people could land in different ones. That is the same constraint SQLite on
 * a volume already imposes (§5.19), and it is written down in the known gaps rather than papered
 * over: the fix, when there is a second replica, is to carry patches between processes on Postgres
 * LISTEN/NOTIFY and keep everything else here exactly as it is.
 */

/** How long the board must be quiet before the room writes it down. */
const PERSIST_MS = 1200;
/** …and the longest it may go without one while somebody keeps typing. */
const PERSIST_MAX_MS = 8000;
/** A room with nobody in it is kept this long, so a reload does not reload the document. */
const EMPTY_MS = 30_000;

interface Subscriber {
  peer: Peer;
  send(message: Down): void;
}

interface Room {
  boardId: string;
  workspaceId: string;
  elements: Record<ElementId, CanvasElement>;
  /** The document's non-element parts, carried through untouched so a save does not drop them. */
  document: CanvasDocument;
  /** Monotonic per board. A client that has seen `seq` has seen every patch up to it. */
  seq: number;
  subscribers: Map<string, Subscriber>;
  dirty: boolean;
  persistTimer: ReturnType<typeof setTimeout> | null;
  /** When the first unpersisted change arrived, so a long edit still gets written down. */
  dirtySince: number;
  emptyTimer: ReturnType<typeof setTimeout> | null;
}

/*
 * Module state survives hot reloads in development by living on globalThis: without this, editing
 * any server file drops everybody's room and the cursors vanish for reasons that have nothing to
 * do with the product.
 */
const rooms: Map<string, Room> = ((globalThis as { __nexusRooms?: Map<string, Room> }).__nexusRooms ??= new Map());

let peerCounter = 0;

async function openRoom(boardId: string): Promise<Room | null> {
  const existing = rooms.get(boardId);
  if (existing) {
    if (existing.emptyTimer) {
      clearTimeout(existing.emptyTimer);
      existing.emptyTimer = null;
    }
    return existing;
  }

  const db = await getDb();
  const board = await db.query.boards.findFirst({ where: eq(s.boards.id, boardId), columns: { document: true, workspaceId: true } });
  if (!board) return null;

  // Raced with another connection opening the same board while we were in the database.
  const raced = rooms.get(boardId);
  if (raced) return raced;

  /*
   * Hydrated, exactly as `GET /api/boards/:id` hydrates it. The room's copy has to be the document
   * clients actually render: an unhydrated one differs from every client's on the first message,
   * and the board would silently revert to stale titles the moment the stream opened.
   */
  const document = await hydrateDocument(db, parseDocument(board.document));
  const room: Room = {
    boardId,
    workspaceId: board.workspaceId,
    elements: { ...document.elements },
    document,
    seq: 0,
    subscribers: new Map(),
    dirty: false,
    persistTimer: null,
    dirtySince: 0,
    emptyTimer: null,
  };
  rooms.set(boardId, room);
  return room;
}

/** The document's non-element parts, as they currently stand. */
function docParts(room: Room): DocParts {
  return { viewpoints: room.document.viewpoints ?? [], script: room.document.script ?? "" };
}

function peers(room: Room): Peer[] {
  return [...room.subscribers.values()].map((sub) => sub.peer);
}

function broadcast(room: Room, message: Down, except?: string) {
  for (const [id, sub] of room.subscribers) {
    if (id === except) continue;
    try {
      sub.send(message);
    } catch {
      // A dead stream is not this room's problem: the reader's own cleanup removes it.
    }
  }
}

function announcePresence(room: Room) {
  broadcast(room, { kind: "presence", peers: peers(room) });
}

/**
 * Write the board down, and let the rest of the product know it changed.
 *
 * Deliberately the same path an ordinary save takes — the conditional write, the automatic
 * checkpoint, the graph sync, the import reconcile — because a board edited by two people must
 * become the same graph as a board edited by one. The revision guard is passed `null`: the room is
 * the only writer while it is live, so there is nobody to be refused by.
 */
async function persist(room: Room) {
  room.persistTimer = null;
  if (!room.dirty) return;
  room.dirty = false;
  room.dirtySince = 0;

  const doc: CanvasDocument = { ...room.document, elements: room.elements };
  try {
    const db = await getDb();
    const result = await saveBoardDocument(db, room.boardId, doc, null);
    if (result.status !== "saved") return;
    room.document = doc;
    await syncBoardToGraph(db, { id: room.boardId, workspaceId: result.workspaceId }, doc);
    if (doc.meta?.importBatch) await reconcileBoard(db, doc.meta.importBatch, doc);
  } catch {
    /*
     * Put the flag back so the next quiet moment tries again. Losing a save is worse than saving
     * twice, and the client still holds the document either way.
     */
    room.dirty = true;
    if (!room.dirtySince) room.dirtySince = Date.now();
  }
}

function schedulePersist(room: Room) {
  room.dirty = true;
  if (!room.dirtySince) room.dirtySince = Date.now();
  if (room.persistTimer) clearTimeout(room.persistTimer);
  // Somebody dragging for a minute should not go a minute without a save.
  const wait = Math.min(PERSIST_MS, Math.max(0, room.dirtySince + PERSIST_MAX_MS - Date.now()));
  room.persistTimer = setTimeout(() => void persist(room), wait);
}

function closeIfEmpty(room: Room) {
  if (room.subscribers.size > 0) return;
  if (room.persistTimer) {
    clearTimeout(room.persistTimer);
    room.persistTimer = null;
  }
  void persist(room);
  /*
   * Held briefly rather than dropped: a reload is two seconds of nobody being here, and rebuilding
   * the room means reading the document back out of the database for no reason.
   */
  room.emptyTimer = setTimeout(() => {
    if (room.subscribers.size === 0 && !room.dirty) rooms.delete(room.boardId);
  }, EMPTY_MS);
}

export interface Joined {
  peerId: string;
  /** Everything a client needs to start from: the document as it is now, and who is here. */
  hello: Extract<Down, { kind: "hello" }>;
  patch(patch: Patch): void;
  /** Saved viewpoints and the Compose script — the document's non-element parts. */
  doc(parts: DocParts): void;
  presence(update: { cursor?: Peer["cursor"]; selection?: ElementId[]; editing?: ElementId | null }): void;
  leave(): void;
}

/** Join a board. Returns null when there is no such board. */
export async function join(
  boardId: string,
  user: { id: string; name: string },
  send: (message: Down) => void,
): Promise<Joined | null> {
  const room = await openRoom(boardId);
  if (!room) return null;

  const peerId = `p${++peerCounter}-${Math.random().toString(36).slice(2, 8)}`;
  const peer: Peer = { id: peerId, userId: user.id, name: user.name, color: peerColor(user.id), cursor: null, selection: [], editing: null };
  room.subscribers.set(peerId, { peer, send });

  const hello: Down = { kind: "hello", peerId, seq: room.seq, elements: room.elements, peers: peers(room), parts: docParts(room) };
  // Everybody else finds out somebody arrived; the arrival learns who is here from `hello`.
  announcePresence(room);

  return {
    peerId,
    hello,
    patch(patch) {
      const next = applyPatch(room.elements, patch);
      if (next === room.elements) return;
      room.elements = next;
      room.seq += 1;
      broadcast(room, { kind: "patch", seq: room.seq, from: peerId, patch }, peerId);
      schedulePersist(room);
    },
    doc(parts) {
      /*
       * Whole-value, unlike elements: a list of saved views and a block of prose have no useful
       * finer grain, and both change rarely enough that the last writer winning is not a race
       * anybody will notice.
       */
      if (!("viewpoints" in parts) && !("script" in parts)) return;
      room.document = {
        ...room.document,
        ...(parts.viewpoints ? { viewpoints: parts.viewpoints } : {}),
        ...(parts.script !== undefined ? { script: parts.script } : {}),
      };
      room.seq += 1;
      broadcast(room, { kind: "doc", seq: room.seq, from: peerId, parts }, peerId);
      schedulePersist(room);
    },
    presence(update) {
      const sub = room.subscribers.get(peerId);
      if (!sub) return;
      if ("cursor" in update) sub.peer.cursor = update.cursor ?? null;
      if (update.selection) sub.peer.selection = update.selection;
      if ("editing" in update) sub.peer.editing = update.editing ?? null;
      announcePresence(room);
    },
    leave() {
      room.subscribers.delete(peerId);
      if (room.subscribers.size > 0) announcePresence(room);
      else closeIfEmpty(room);
    },
  };
}

/**
 * Tell a live board its document was changed by something that is not a person on it.
 *
 * Approving an import, restoring a version and accepting a proposal all write boards behind the
 * canvas's back. Before multiplayer that was invisible until a reload; now the room holds the
 * document, so a write that ignored it would be overwritten by the next patch. Everybody gets the
 * new document instead.
 */
export async function boardChangedElsewhere(boardId: string, document: CanvasDocument) {
  const room = rooms.get(boardId);
  if (!room) return;
  room.document = document;
  room.elements = { ...document.elements };
  room.seq += 1;
  room.dirty = false;
  broadcast(room, { kind: "resync", seq: room.seq, elements: room.elements, parts: docParts(room) });
}

/** Whether anybody is on this board right now — the one thing other server code needs to ask. */
export function isLive(boardId: string): boolean {
  return (rooms.get(boardId)?.subscribers.size ?? 0) > 0;
}

/** Test seam: the room's view of the document, without going through the database. */
export function roomSnapshot(boardId: string): { seq: number; elements: Record<ElementId, CanvasElement>; peers: Peer[] } | null {
  const room = rooms.get(boardId);
  return room ? { seq: room.seq, elements: room.elements, peers: peers(room) } : null;
}

/** Test seam: forget every room, so one test's board cannot leak into another's. */
export function resetRooms() {
  for (const room of rooms.values()) {
    if (room.persistTimer) clearTimeout(room.persistTimer);
    if (room.emptyTimer) clearTimeout(room.emptyTimer);
  }
  rooms.clear();
}
