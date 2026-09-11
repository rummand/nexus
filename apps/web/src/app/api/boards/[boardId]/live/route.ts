import { NextResponse } from "next/server";
import { currentUserOrNull } from "@/lib/session";
import { can, workspaceOfBoard } from "@/lib/auth/guard";
import { join, type Joined } from "@/lib/live/room";
import type { Down, Up } from "@/lib/live/protocol";

/**
 * The live channel for one board: server-sent events down, ordinary POSTs up.
 *
 * **Why not a WebSocket.** Nexus is one Next.js server behind whatever the customer puts in front
 * of it, and the customers are enterprises: corporate proxies, TLS-terminating gateways and
 * old load balancers break WebSocket upgrades constantly and silently, and the failure mode is
 * "the canvas is dead for the one team on the segment with the strict proxy". Server-sent events
 * are a `GET` that never ends — plain HTTP/1.1, no upgrade, no custom server, nothing to add to
 * the Dockerfile or the health check. Sending is a `POST`, which every proxy on earth already
 * passes. The cost is one extra request per edit, which for a canvas is nothing.
 *
 * A `GET` that never returns must never be cached or prerendered, hence the segment config; the
 * Node runtime is the default and the version of Next here asks that it not be restated.
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ boardId: string }> };

/**
 * Every open stream, so a POST can find the room the sender is already joined to.
 *
 * `mayEdit` is decided once, when the stream opens, and carried here: a guest is welcome to watch a
 * board live — presence and cursors are the point of the feature — and may not change it (§5.46).
 * Deciding it at join time rather than per patch keeps the hot path free of a database lookup.
 */
interface Connection { joined: Joined; mayEdit: boolean }
const connections: Map<string, Connection> = ((globalThis as { __nexusLive?: Map<string, Connection> }).__nexusLive ??= new Map());

/** Something has to cross a proxy every so often, or an idle stream is closed as dead. */
const KEEPALIVE_MS = 25_000;

export async function GET(req: Request, { params }: Params) {
  const { boardId } = await params;
  const user = await currentUserOrNull();
  if (!user) return NextResponse.json({ error: "No user" }, { status: 401 });
  // Decided once, here, and carried on the connection for every patch that follows (§5.46).
  const workspaceId = await workspaceOfBoard(boardId);
  const mayEdit = workspaceId ? await can(workspaceId, "board.edit") : false;

  const encoder = new TextEncoder();
  let joined: Joined | null = null;
  let keepalive: ReturnType<typeof setInterval> | null = null;
  let left = false;

  const close = () => {
    if (left) return;
    left = true;
    if (keepalive) clearInterval(keepalive);
    if (joined) {
      connections.delete(joined.peerId);
      joined.leave();
    }
  };

  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const write = (text: string) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          open = false;
        }
      };
      const send = (message: Down) => write(`data: ${JSON.stringify(message)}\n\n`);

      joined = await join(boardId, { id: user.id, name: user.name, color: user.color }, send);
      if (!joined) {
        send({ kind: "presence", peers: [] });
        controller.close();
        return;
      }
      connections.set(joined.peerId, { joined, mayEdit });

      // The peer id goes in its own event so the client can identify itself before any data.
      write(`event: peer\ndata: ${JSON.stringify({ peerId: joined.peerId })}\n\n`);
      send(joined.hello);

      keepalive = setInterval(() => write(`: ping\n\n`), KEEPALIVE_MS);

      /*
       * Leaving has to be reliable or the board fills up with ghosts. `cancel` covers a reader
       * that lets go; the request's abort signal covers the commoner case of the socket simply
       * going away, and `close` makes both paths idempotent.
       */
      req.signal.addEventListener("abort", () => {
        open = false;
        close();
      });
    },
    cancel() {
      close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Nginx and several enterprise gateways buffer a response until it ends, which for a stream
      // means forever. This is the header they all agree on.
      "x-accel-buffering": "no",
    },
  });
}

/**
 * Say something: a patch, or where the cursor is.
 *
 * The peer id in the header is the whole of the addressing — it was minted by the stream this
 * client is holding open, so a POST that does not carry a live one has nothing to say and is told
 * so rather than being quietly accepted.
 */
export async function POST(req: Request, { params }: Params) {
  await params;
  const peerId = req.headers.get("x-nexus-peer") ?? "";
  const connection = connections.get(peerId);
  if (!connection) return NextResponse.json({ error: "Not connected", reconnect: true }, { status: 409 });
  const { joined } = connection;

  let body: Up;
  try {
    body = (await req.json()) as Up;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.kind === "patch") {
    if (!connection.mayEdit) return NextResponse.json({ error: "You may read this board but not change it." }, { status: 403 });
    if (!body.patch || typeof body.patch !== "object") return NextResponse.json({ error: "patch is required" }, { status: 400 });
    joined.patch(body.patch);
  } else if (body.kind === "doc") {
    if (!body.parts || typeof body.parts !== "object") return NextResponse.json({ error: "parts is required" }, { status: 400 });
    joined.doc(body.parts);
  } else if (body.kind === "presence") {
    joined.presence(body);
  } else if (body.kind === "gather") {
    /*
     * Moving other people's cameras is a thing anybody in the room may do, including a viewer:
     * it changes nothing about the board, and "everyone look at this" is the one gesture a
     * person who may only read still needs in a workshop (§5.95).
     */
    joined.gather();
  } else {
    return NextResponse.json({ error: "Unknown message" }, { status: 400 });
  }
  return new Response(null, { status: 204 });
}
