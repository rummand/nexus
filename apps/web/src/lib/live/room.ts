import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { parseDocument, type CanvasDocument, type CanvasElement, type ElementId } from "@/canvas/document";
import { saveBoardDocument } from "@/lib/board-save";
import { hydrateDocument, syncBoardToGraph } from "@/lib/graph";
import { reconcileBoard } from "@/lib/import/sync";
import { applyPatch, peerColor, type DocParts, type Down, type Patch, type Peer } from "./protocol";
import { fits, liveBus, PROCESS_ID, shouldPersist, type LiveMessage } from "./bus";

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
 * **More than one process.** Rooms live in this server's heap, so a second replica used to be a
 * second set of rooms: two people on one board could land in different ones and take turns
 * overwriting each other. Since §5.47 the rooms share a bus — Postgres `LISTEN`/`NOTIFY` when the
 * store is Postgres, a function call when it is not — and everything here is unchanged except for
 * one thing that matters: **a patch is published before it is applied**, so every replica applies
 * in the bus's order and last-writer-wins is the same rule everywhere rather than a race between
 * two servers.
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
  /**
   * The people on this board in *other* processes, by process id, with when we last heard.
   *
   * Presence has to be the union or a colleague on the other replica is invisible, and the "when"
   * is what makes a replica that died stop having peers rather than haunting the list for ever.
   */
  remote: Map<string, { peers: Peer[]; at: number }>;
}

/** A remote replica that has not said anything for this long is treated as gone. */
const REMOTE_TTL_MS = 45_000;
/** …so every room says it is still here rather more often than that. */
const HEARTBEAT_MS = 15_000;

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
    remote: new Map(),
  };
  rooms.set(boardId, room);
  listen();
  return room;
}

/** The document's non-element parts, as they currently stand. */
function docParts(room: Room): DocParts {
  return { viewpoints: room.document.viewpoints ?? [], script: room.document.script ?? "" };
}

/** The people connected to *this* process. */
function localPeers(room: Room): Peer[] {
  return [...room.subscribers.values()].map((sub) => sub.peer);
}

/** Everybody on this board, here and on the other replicas, with the stale ones dropped. */
function peers(room: Room): Peer[] {
  const cutoff = Date.now() - REMOTE_TTL_MS;
  const out = localPeers(room);
  for (const [process, entry] of room.remote) {
    if (entry.at < cutoff) {
      room.remote.delete(process);
      continue;
    }
    out.push(...entry.peers);
  }
  return out;
}

/** Which processes have somebody on this board, for deciding who writes it down. */
function processesPresent(room: Room): string[] {
  const cutoff = Date.now() - REMOTE_TTL_MS;
  return [...room.remote.entries()].filter(([, e]) => e.at >= cutoff && e.peers.length > 0).map(([process]) => process);
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

/** Tell the other replicas who is here. Called on every change, and on a heartbeat. */
function publishPresence(room: Room) {
  liveBus().publish({ kind: "presence", boardId: room.boardId, process: PROCESS_ID, peers: localPeers(room) });
}

/**
 * Send a change to every replica, this one included.
 *
 * A message too large for the wire (§5.47) is not dropped and not chunked: the board is written
 * down and the others are asked to read it again. `NOTIFY` allows 8000 bytes and a patch is
 * normally a fraction of that, so this is the long description nobody expected rather than the
 * common case, and correctness is worth more than the round trip it costs.
 */
function publish(message: LiveMessage) {
  const bus = liveBus();
  if (fits(message)) {
    bus.publish(message);
    return;
  }
  const room = rooms.get("boardId" in message ? message.boardId : "");
  if (!room) return;
  apply(message);
  void persist(room).then(() => bus.publish({ kind: "reload", boardId: room.boardId }));
}

/**
 * Apply one message from the bus to the room it belongs to.
 *
 * Every replica runs this, including the one that published — which is the point: the order the
 * bus delivered in is the order everybody applies in.
 */
function apply(message: LiveMessage) {
  const room = rooms.get(message.boardId);
  if (!room) return;

  if (message.kind === "patch") {
    const next = applyPatch(room.elements, message.patch);
    if (next === room.elements) return;
    room.elements = next;
    room.seq += 1;
    // The sender applied nothing locally, so it is told too — except that its own client already
    // drew the change optimistically, which is why the origin peer is still skipped.
    broadcast(room, { kind: "patch", seq: room.seq, from: message.from, patch: message.patch }, message.from);
    schedulePersist(room);
    return;
  }

  if (message.kind === "doc") {
    room.document = {
      ...room.document,
      ...(message.parts.viewpoints ? { viewpoints: message.parts.viewpoints } : {}),
      ...(message.parts.script !== undefined ? { script: message.parts.script } : {}),
    };
    room.seq += 1;
    broadcast(room, { kind: "doc", seq: room.seq, from: message.from, parts: message.parts }, message.from);
    schedulePersist(room);
    return;
  }

  if (message.kind === "presence") {
    if (message.process === PROCESS_ID) return;
    if (message.peers.length) room.remote.set(message.process, { peers: message.peers, at: Date.now() });
    else room.remote.delete(message.process);
    announcePresence(room);
    return;
  }

  if (message.kind === "gone") {
    if (room.remote.delete(message.process)) announcePresence(room);
    return;
  }

  if (message.kind === "reload") {
    void reload(room);
  }
}

/** Read the board back from the database and hand it to everybody here. */
async function reload(room: Room) {
  try {
    const db = await getDb();
    const board = await db.query.boards.findFirst({ where: eq(s.boards.id, room.boardId) });
    if (!board) return;
    const document = await hydrateDocument(db, parseDocument(board.document));
    room.document = document;
    room.elements = { ...document.elements };
    room.seq += 1;
    room.dirty = false;
    broadcast(room, { kind: "resync", seq: room.seq, elements: room.elements, parts: docParts(room) });
  } catch {
    /* the next patch will resynchronise; a failed read is not worth closing the board over */
  }
}

/*
 * One subscription per process, set up the first time a room is opened. Rooms come and go; the
 * handler does not, and a message for a board this replica is not holding is simply dropped.
 */
let listening = false;
let heartbeat: ReturnType<typeof setInterval> | null = null;
function listen() {
  if (listening) return;
  listening = true;
  liveBus().subscribe(apply);
  /*
   * Saying "still here" more often than the timeout, so a replica that is alive never has its
   * people vanish from somebody else's list — and one that died has them go within a minute.
   */
  heartbeat = setInterval(() => {
    for (const room of rooms.values()) if (room.subscribers.size) publishPresence(room);
  }, HEARTBEAT_MS);
  heartbeat.unref?.();
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
  /*
   * One replica writes (§5.47). Every replica has converged on the same elements, so any of them
   * could — but a board with three replicas on it would then do three saves, three graph syncs and
   * three import reconciles per settle, which is the exact waste the room exists to remove. The
   * lowest process id present wins; when it dies its peers age out and the next takes over.
   */
  if (!shouldPersist(PROCESS_ID, processesPresent(room))) {
    room.dirty = false;
    room.dirtySince = 0;
    return;
  }
  room.dirty = false;
  room.dirtySince = 0;

  const doc: CanvasDocument = { ...room.document, elements: room.elements };
  try {
    const db = await getDb();
    const result = await saveBoardDocument(db, room.boardId, doc, null);
    if (result.status !== "saved") return;
    room.document = doc;
    /*
     * A live room persists on a timer for everyone in it, so there is no one person whose save
     * this is (§5.43). The board is the actor, honestly, rather than whichever peer happened to
     * type last.
     */
    await syncBoardToGraph(db, { id: room.boardId, workspaceId: result.workspaceId, name: result.boardName }, doc);
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
    if (room.subscribers.size === 0 && !room.dirty) {
      rooms.delete(room.boardId);
      // Let the other replicas drop us now rather than waiting out the timeout (§5.47).
      liveBus().publish({ kind: "gone", boardId: room.boardId, process: PROCESS_ID });
    }
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
  user: { id: string; name: string; color?: string | null },
  send: (message: Down) => void,
): Promise<Joined | null> {
  const room = await openRoom(boardId);
  if (!room) return null;

  // The process id is in here because a peer id now travels between replicas and two of them
  // minting "p1-abc" would be one peer as far as everybody else is concerned.
  const peerId = `${PROCESS_ID}-p${++peerCounter}-${Math.random().toString(36).slice(2, 6)}`;
  const peer: Peer = { id: peerId, userId: user.id, name: user.name, color: peerColor(user.id, user.color), cursor: null, selection: [], editing: null };
  room.subscribers.set(peerId, { peer, send });

  const hello: Down = { kind: "hello", peerId, seq: room.seq, elements: room.elements, peers: peers(room), parts: docParts(room) };
  // Everybody else finds out somebody arrived; the arrival learns who is here from `hello`.
  announcePresence(room);
  publishPresence(room);

  return {
    peerId,
    hello,
    patch(patch) {
      /*
       * Published, not applied (§5.47). The bus decides the order every replica applies in, which
       * is what makes last-writer-wins one rule rather than a race between two servers; with a
       * single process the bus is a function call, so this is the same line it always was.
       */
      publish({ kind: "patch", boardId, from: peerId, patch });
    },
    doc(parts) {
      /*
       * Whole-value, unlike elements: a list of saved views and a block of prose have no useful
       * finer grain, and both change rarely enough that the last writer winning is not a race
       * anybody will notice.
       */
      if (!("viewpoints" in parts) && !("script" in parts)) return;
      publish({ kind: "doc", boardId, from: peerId, parts });
    },
    presence(update) {
      const sub = room.subscribers.get(peerId);
      if (!sub) return;
      if ("cursor" in update) sub.peer.cursor = update.cursor ?? null;
      if (update.selection) sub.peer.selection = update.selection;
      if ("editing" in update) sub.peer.editing = update.editing ?? null;
      announcePresence(room);
      publishPresence(room);
    },
    leave() {
      room.subscribers.delete(peerId);
      publishPresence(room);
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
  /*
   * The write may have happened on a replica that is not holding this board, so the others are
   * told to read it again whether or not there is a room here (§5.47).
   */
  liveBus().publish({ kind: "reload", boardId });
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
  /*
   * The bus subscription and the heartbeat are deliberately left alone: they belong to the
   * process, not to a room. Re-subscribing on every reset would stack handlers and apply each
   * patch once per reset, which is how this was found.
   */
}
