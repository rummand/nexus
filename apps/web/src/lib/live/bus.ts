import { dialect } from "@/db/client";
import type { CanvasDocument, CanvasElement, ElementId } from "@/canvas/document";
import type { Box } from "@/canvas/document";
import type { DocParts, Patch, Peer } from "./protocol";

/**
 * Carrying a live board between server processes (§5.47).
 *
 * Rooms lived in one server's heap, so two replicas meant two rooms: two people on the same board
 * could land in different ones, see an empty presence list, and take turns overwriting each other's
 * document. That was written down honestly in the known gaps with the fix named — Postgres
 * `LISTEN`/`NOTIFY` — and this is it.
 *
 * **The bus decides the order, not the sender.** A local patch is *not* applied and then published;
 * it is published, and applied when it comes back. Every replica therefore applies patches in the
 * order Postgres delivered them, which is the same order everywhere — and that is what makes
 * last-writer-wins a defined rule rather than a race between two servers' clocks. With one process
 * the bus delivers synchronously, so the behaviour is identical and costs nothing.
 *
 * **A payload that will not fit is a fact, not a crash.** `NOTIFY` allows 8000 bytes. Almost every
 * patch is a fraction of that, but a card with a long description could exceed it, so the sender
 * writes the board down and asks the other replicas to re-read it instead. Rare, correct, and much
 * simpler than inventing a chunking protocol for a case that mostly does not happen.
 */

/** Who published something, so a replica can ignore its own presence echo. */
export const PROCESS_ID = `srv-${Math.random().toString(36).slice(2, 10)}`;

export type LiveMessage =
  | { kind: "patch"; boardId: string; from: string; patch: Patch }
  | { kind: "doc"; boardId: string; from: string; parts: DocParts }
  | { kind: "presence"; boardId: string; process: string; peers: Peer[] }
  | { kind: "gone"; boardId: string; process: string }
  /** The document changed outside the rooms, or a patch was too large to carry: read it again. */
  | { kind: "reload"; boardId: string }
  /** Somebody asked the room to look where they are looking (§5.95). One event, not a state. */
  | { kind: "gather"; boardId: string; from: string; name: string; view: Box };

export interface Bus {
  publish(message: LiveMessage): void;
  subscribe(handler: (message: LiveMessage) => void): void;
  /** Whether messages actually reach other processes, for the status line and the tests. */
  readonly shared: boolean;
  close(): Promise<void>;
}

/** The largest payload `NOTIFY` will carry, less a margin for the channel name and quoting. */
export const NOTIFY_LIMIT = 7500;

/** Would this message fit down the wire? Pure, so the fallback can be tested without a database. */
export function fits(message: LiveMessage): boolean {
  return Buffer.byteLength(JSON.stringify(message), "utf8") <= NOTIFY_LIMIT;
}

/**
 * Which replica writes the board down.
 *
 * All of them converge on the same elements, so any of them *could* — but then a board with three
 * replicas on it does three saves, three graph syncs and three import reconciles per settle, which
 * is the exact waste the room was built to remove. The lowest process id present wins: no election,
 * no lock, and no coordination beyond the presence every replica is already publishing. When that
 * replica dies its peers age out and the next one takes over on the following settle.
 */
export function shouldPersist(me: string, processesPresent: readonly string[]): boolean {
  const present = [...new Set([me, ...processesPresent])].sort();
  return present[0] === me;
}

class MemoryBus implements Bus {
  readonly shared = false;
  private handlers: Array<(m: LiveMessage) => void> = [];
  publish(message: LiveMessage) {
    // Synchronous: with one process the "bus" is a function call, and the ordering guarantee the
    // Postgres path buys is free because there is only one applier.
    for (const h of this.handlers) h(message);
  }
  subscribe(handler: (m: LiveMessage) => void) {
    this.handlers.push(handler);
  }
  async close() {
    this.handlers = [];
  }
}

const CHANNEL = "nexus_live";

class PostgresBus implements Bus {
  readonly shared = true;
  private handlers: Array<(m: LiveMessage) => void> = [];
  private client: import("pg").Client | null = null;
  private ready: Promise<void> | null = null;
  private queue: LiveMessage[] = [];
  private closed = false;

  private async connect() {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      const { Client } = await import("pg");
      const url = process.env.DATABASE_URL ?? "";
      const client = new Client({ connectionString: url, ...(/sslmode=disable/.test(url) ? {} : { ssl: { rejectUnauthorized: false } }) });
      client.on("notification", (note) => {
        if (note.channel !== CHANNEL || !note.payload) return;
        try {
          const message = JSON.parse(note.payload) as LiveMessage;
          for (const h of this.handlers) h(message);
        } catch {
          /* a payload this version cannot read is not worth taking the room down for */
        }
      });
      /*
       * A dropped listener is a board that silently stops being shared, which is worse than a
       * board that reconnects noisily — so the connection is rebuilt and the channel re-listened.
       */
      client.on("error", () => {
        this.ready = null;
        this.client = null;
        if (!this.closed) setTimeout(() => void this.connect().catch(() => undefined), 1000);
      });
      await client.connect();
      await client.query(`LISTEN ${CHANNEL}`);
      this.client = client;
      const pending = this.queue;
      this.queue = [];
      for (const m of pending) this.send(m);
    })();
    return this.ready;
  }

  private send(message: LiveMessage) {
    const client = this.client;
    if (!client) {
      this.queue.push(message);
      void this.connect().catch(() => undefined);
      return;
    }
    void client.query("SELECT pg_notify($1, $2)", [CHANNEL, JSON.stringify(message)]).catch(() => undefined);
  }

  publish(message: LiveMessage) {
    this.send(message);
  }

  subscribe(handler: (m: LiveMessage) => void) {
    this.handlers.push(handler);
    void this.connect().catch(() => undefined);
  }

  async close() {
    this.closed = true;
    this.handlers = [];
    await this.client?.end().catch(() => undefined);
    this.client = null;
    this.ready = null;
  }
}

const globalForBus = globalThis as unknown as { __nexusBus?: Bus };

/** One bus per process. Postgres when the store is Postgres; otherwise a function call. */
export function liveBus(): Bus {
  return (globalForBus.__nexusBus ??= dialect() === "postgres" ? new PostgresBus() : new MemoryBus());
}

/** Test seam: forget the bus, so one test's messages cannot reach another's. */
export async function resetBus() {
  await globalForBus.__nexusBus?.close();
  globalForBus.__nexusBus = undefined;
}

export type { CanvasDocument, CanvasElement, ElementId };
