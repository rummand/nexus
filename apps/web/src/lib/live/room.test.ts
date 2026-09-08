import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { CanvasElement } from "@/canvas/document";
import type { Down } from "./protocol";

/**
 * The room: one board, several people, one writer.
 *
 * This one needs a real database, because the interesting claims are about the seam between the
 * live session and everything that was already there — the document it loads, the document it
 * writes back, and the graph sync that has to run exactly as it would for one person. The
 * connection string is set before the module that reads it is imported, so this suite gets a
 * database of its own the way the browser suite does.
 */

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "nexus-live-")), "live.db")}`;

let room: typeof import("./room");
let dbmod: typeof import("@/db/client");
let schema: typeof import("@/db/schema");

const card = (id: string, over: Partial<CanvasElement> = {}): CanvasElement =>
  ({ id, type: "card", x: 0, y: 0, w: 200, h: 120, z: 1, kind: "Application", color: "#1376d4", title: id, description: "", ...over }) as CanvasElement;

/** A subscriber that simply records what it was sent. */
function listener() {
  const seen: Down[] = [];
  return { seen, send: (m: Down) => void seen.push(m), last: <K extends Down["kind"]>(kind: K) => [...seen].reverse().find((m) => m.kind === kind) as Extract<Down, { kind: K }> | undefined };
}

beforeAll(async () => {
  room = await import("./room");
  dbmod = await import("@/db/client");
  schema = await import("@/db/schema");
  const db = await dbmod.getDb();
  await db.insert(schema.workspaces).values({ id: "ws", slug: "live-ws", name: "WS" }).onConflictDoNothing();
  await db.insert(schema.spaces).values({ id: "sp", workspaceId: "ws", name: "Space" }).onConflictDoNothing();
});

async function makeBoard(id: string, elements: Record<string, CanvasElement>) {
  const db = await dbmod.getDb();
  await db.insert(schema.boards).values({
    id,
    workspaceId: "ws",
    spaceId: "sp",
    name: id,
    document: JSON.stringify({ version: 2, elements }),
  });
}

afterEach(() => room.resetRooms());

describe("joining", () => {
  it("hands a newcomer the board as it is, and tells everybody who is here", async () => {
    await makeBoard("b-join", { a: card("a") });
    const one = listener();
    const first = await room.join("b-join", { id: "u1", name: "Jes" }, one.send);
    expect(first).not.toBeNull();
    expect(first!.hello).toMatchObject({ kind: "hello", seq: 0 });
    expect(Object.keys(first!.hello.elements)).toEqual(["a"]);

    const two = listener();
    const second = await room.join("b-join", { id: "u2", name: "Marianne" }, two.send);
    // The newcomer learns who is here from its own hello; the person already here is told.
    expect(second!.hello.peers.map((p) => p.name).sort()).toEqual(["Jes", "Marianne"]);
    expect(one.last("presence")?.peers.map((p) => p.name).sort()).toEqual(["Jes", "Marianne"]);

    second!.leave();
    expect(one.last("presence")?.peers.map((p) => p.name)).toEqual(["Jes"]);
    first!.leave();
  });

  it("refuses a board that does not exist rather than inventing a room for it", async () => {
    expect(await room.join("no-such-board", { id: "u1", name: "Jes" }, () => {})).toBeNull();
  });

  it("gives one person the same colour in every session", async () => {
    await makeBoard("b-color", {});
    const a = await room.join("b-color", { id: "u1", name: "Jes" }, () => {});
    const b = await room.join("b-color", { id: "u1", name: "Jes" }, () => {});
    const peers = room.roomSnapshot("b-color")!.peers;
    expect(peers[0]!.color).toBe(peers[1]!.color);
    // …and two connections are two peers, because two tabs really are two cursors.
    expect(peers[0]!.id).not.toBe(peers[1]!.id);
    a!.leave();
    b!.leave();
  });
});

describe("a change", () => {
  it("reaches everybody else, and not the person who made it", async () => {
    await makeBoard("b-patch", { a: card("a") });
    const one = listener();
    const two = listener();
    const first = await room.join("b-patch", { id: "u1", name: "Jes" }, one.send);
    const second = await room.join("b-patch", { id: "u2", name: "Marianne" }, two.send);
    one.seen.length = 0;
    two.seen.length = 0;

    first!.patch({ upsert: { a: card("a", { x: 400 }) } });

    expect(two.last("patch")).toMatchObject({ seq: 1, from: first!.peerId });
    // An echo would be applied over whatever they have done since, which is how a drag stutters.
    expect(one.seen.filter((m) => m.kind === "patch")).toHaveLength(0);
    expect(room.roomSnapshot("b-patch")!.elements.a).toMatchObject({ x: 400 });

    first!.leave();
    second!.leave();
  });

  it("numbers changes so a client can tell what it has already seen", async () => {
    await makeBoard("b-seq", {});
    const one = await room.join("b-seq", { id: "u1", name: "Jes" }, () => {});
    one!.patch({ upsert: { a: card("a") } });
    one!.patch({ upsert: { b: card("b") } });
    expect(room.roomSnapshot("b-seq")!.seq).toBe(2);
    one!.leave();
  });

  it("does not move the sequence for a patch that changes nothing", async () => {
    await makeBoard("b-noop", {});
    const one = await room.join("b-noop", { id: "u1", name: "Jes" }, () => {});
    one!.patch({});
    expect(room.roomSnapshot("b-noop")!.seq).toBe(0);
    one!.leave();
  });

  it("resolves two people on one card by arrival order, and two on different cards by keeping both", async () => {
    await makeBoard("b-race", { a: card("a"), b: card("b") });
    const first = await room.join("b-race", { id: "u1", name: "Jes" }, () => {});
    const second = await room.join("b-race", { id: "u2", name: "Marianne" }, () => {});

    first!.patch({ upsert: { a: card("a", { x: 100 }) } });
    second!.patch({ upsert: { a: card("a", { x: 900 }) } });
    second!.patch({ upsert: { b: card("b", { y: 50 }) } });

    const snap = room.roomSnapshot("b-race")!;
    expect(snap.elements.a).toMatchObject({ x: 900 });
    expect(snap.elements.b).toMatchObject({ y: 50 });

    first!.leave();
    second!.leave();
  });
});

describe("the parts of a document that are not elements", () => {
  it("carries saved viewpoints and the Compose script, and writes them down", async () => {
    await makeBoard("b-parts", {});
    const two = listener();
    const first = await room.join("b-parts", { id: "u1", name: "Jes" }, () => {});
    const second = await room.join("b-parts", { id: "u2", name: "Marianne" }, two.send);

    first!.doc({ script: "card Maximo", viewpoints: [{ id: "v1", name: "OT only", hiddenKinds: [], camera: { x: 0, y: 0, zoom: 1 }, createdAt: "2026-09-08T00:00:00.000Z" }] });
    expect(two.last("doc")?.parts).toMatchObject({ script: "card Maximo" });

    first!.leave();
    second!.leave();
    const db = await dbmod.getDb();
    let doc = "";
    for (let i = 0; i < 40 && !doc.includes("card Maximo"); i++) {
      await new Promise((r) => setTimeout(r, 50));
      doc = (await db.query.boards.findFirst({ where: (b, { eq }) => eq(b.id, "b-parts") }))?.document ?? "";
    }
    // The bug this exists to prevent: while the room is the writer the client has stopped saving,
    // so a script that only the client knew about would be lost when the board closed.
    expect(doc).toContain("card Maximo");
    expect(doc).toContain("OT only");
  });

  it("hands them to somebody who joins later", async () => {
    await makeBoard("b-parts-late", {});
    const first = await room.join("b-parts-late", { id: "u1", name: "Jes" }, () => {});
    first!.doc({ script: "frame Estate" });
    const second = await room.join("b-parts-late", { id: "u2", name: "Marianne" }, () => {});
    expect(second!.hello.parts).toMatchObject({ script: "frame Estate" });
    first!.leave();
    second!.leave();
  });

  it("ignores a message that says nothing", async () => {
    await makeBoard("b-parts-noop", {});
    const one = await room.join("b-parts-noop", { id: "u1", name: "Jes" }, () => {});
    one!.doc({});
    expect(room.roomSnapshot("b-parts-noop")!.seq).toBe(0);
    one!.leave();
  });
});

describe("presence", () => {
  it("carries the selection and the field somebody has open, and lets it go", async () => {
    await makeBoard("b-presence", { a: card("a") });
    const one = listener();
    const first = await room.join("b-presence", { id: "u1", name: "Jes" }, one.send);
    const second = await room.join("b-presence", { id: "u2", name: "Marianne" }, () => {});

    second!.presence({ selection: ["a"], editing: "a", cursor: { x: 10, y: 20 } });
    const held = one.last("presence")!.peers.find((p) => p.name === "Marianne")!;
    expect(held).toMatchObject({ selection: ["a"], editing: "a", cursor: { x: 10, y: 20 } });

    second!.presence({ editing: null, cursor: null });
    const freed = one.last("presence")!.peers.find((p) => p.name === "Marianne")!;
    expect(freed.editing).toBeNull();
    expect(freed.cursor).toBeNull();

    first!.leave();
    second!.leave();
  });

  it("takes the lock away with the person when they disconnect", async () => {
    await makeBoard("b-leave", { a: card("a") });
    const one = listener();
    const first = await room.join("b-leave", { id: "u1", name: "Jes" }, one.send);
    const second = await room.join("b-leave", { id: "u2", name: "Marianne" }, () => {});
    second!.presence({ editing: "a" });
    expect(one.last("presence")!.peers.some((p) => p.editing === "a")).toBe(true);

    // The whole point of presence-as-a-lock: closing the tab is the release.
    second!.leave();
    expect(one.last("presence")!.peers.some((p) => p.editing === "a")).toBe(false);
    first!.leave();
  });
});

describe("writing it down", () => {
  it("persists the board and syncs the graph once the room empties", async () => {
    await makeBoard("b-save", {});
    const one = await room.join("b-save", { id: "u1", name: "Jes" }, () => {});
    // A card only reaches the graph when it carries an entity id, exactly as it does for one
    // person: the room must not be a second, looser way in.
    one!.patch({ upsert: { a: card("a", { title: "Maximo", meta: { entityId: "ent_live_max" } }) } });
    // `leave` on the last person flushes rather than waiting out the debounce, but the flush is
    // a save plus a checkpoint plus a graph sync, so poll for it rather than guessing a delay.
    one!.leave();
    const db = await dbmod.getDb();
    let entities: Array<{ name: string }> = [];
    for (let i = 0; i < 40 && !entities.some((e) => e.name === "Maximo"); i++) {
      await new Promise((r) => setTimeout(r, 50));
      entities = await db.query.entities.findMany({ where: (e, { eq }) => eq(e.workspaceId, "ws") });
    }

    const board = await db.query.boards.findFirst({ where: (b, { eq }) => eq(b.id, "b-save") });
    expect(board!.document).toContain("Maximo");
    expect(board!.revision).toBeGreaterThan(0);
    // The graph must not be able to tell whether one person or three drew the card.
    expect(entities.some((e) => e.name === "Maximo")).toBe(true);
  });

  it("hands a live board the new document when something else rewrites it", async () => {
    await makeBoard("b-elsewhere", { a: card("a") });
    const one = listener();
    const first = await room.join("b-elsewhere", { id: "u1", name: "Jes" }, one.send);

    await room.boardChangedElsewhere("b-elsewhere", { version: 2, elements: { z: card("z") } });

    // This is the case that used to be a 409 and a reload: an import approval or a version
    // restore writing the board while somebody is looking at it.
    expect(one.last("resync")).toBeTruthy();
    expect(Object.keys(room.roomSnapshot("b-elsewhere")!.elements)).toEqual(["z"]);
    first!.leave();
  });

  it("knows whether anybody is on a board", async () => {
    await makeBoard("b-islive", {});
    expect(room.isLive("b-islive")).toBe(false);
    const one = await room.join("b-islive", { id: "u1", name: "Jes" }, () => {});
    expect(room.isLive("b-islive")).toBe(true);
    one!.leave();
    expect(room.isLive("b-islive")).toBe(false);
  });
});
