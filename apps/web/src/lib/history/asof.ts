import type * as s from "@/db/schema";
import { parseAttributes } from "@/lib/graph";

/**
 * The estate as it stood on a date (#138, §5.97).
 *
 * #138 frames the storage question as a trade: keep the current row as the truth and replay
 * diffs (A), or store every version and make the present a query (B). The second is what buys
 * *the estate at any date* — and it touches every read in the product, which is the actual risk.
 *
 * This is the third way, and it falls out of what is already here. The event log (§5.43) is
 * **field-level with before and after**, so the estate on any past date is the present rows with
 * the events since that date undone, newest first. Exactly the technique change sets already use
 * (§5.21) and the import plan already uses (§5.89), pointed at time instead of at intent.
 *
 * What it costs is proportional to *how much has changed since*, not to how much there is — so
 * "what did this look like when we signed the contract in March" is cheap, and 2019 is not. That
 * is the right shape: the recent question is the one people actually ask.
 *
 * Three honest limits, none of which Option B would have to face:
 *
 * - **A deleted object comes back thin.** The log keeps its name and type, because that is what a
 *   deletion event carries; the attributes it had are in earlier events and are replayed if they
 *   are within the window, and absent if the window does not reach them.
 * - **It is only as good as the log.** Anything written before the history existed, or by a path
 *   that does not record, is invisible to it — and the rewind says so rather than pretending.
 * - **Relations are not versioned here.** Their events exist (§5.43 records them) but they carry
 *   ends rather than a full row, so this rewinds objects only. Named, not hidden.
 */

/** One event, in the shape the rewind needs. */
export interface PastEvent {
  entityId: string;
  entityName: string;
  kind: string;
  field: string;
  fromValue: string;
  toValue: string;
  at: string;
}

export interface Rewound {
  entities: s.Entity[];
  /** How many events were undone to get here — the cost, made visible. */
  undone: number;
  /** Objects that existed then and are gone now, restored from what the log remembers. */
  restored: number;
  /** Objects that exist now and did not then. */
  removed: number;
}

const ms = (iso: string) => {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/**
 * Undo everything that happened after `at`.
 *
 * Newest first, because each event's `fromValue` is only the truth for the moment *before* it —
 * replaying them in forward order would apply a stale value over a newer one.
 */
export function rewind(entities: s.Entity[], events: PastEvent[], at: Date): Rewound {
  const target = at.getTime();
  const since = events.filter((e) => ms(e.at) > target).sort((a, b) => ms(b.at) - ms(a.at));

  const byId = new Map(entities.map((e) => [e.id, { ...e, attributes: parseAttributes(e.attributes) } as Omit<s.Entity, "attributes"> & { attributes: Record<string, string> }]));
  const gone = new Set<string>();
  let restored = 0;

  for (const event of since) {
    const entity = byId.get(event.entityId);

    switch (event.kind) {
      case "created":
        // It did not exist then. Remove it, and remember so a later (earlier) event about it is
        // not taken as evidence that it did.
        if (entity) { byId.delete(event.entityId); gone.add(event.entityId); }
        break;

      case "deleted": {
        // It existed then and does not now. The log carries its name and type; anything else is
        // recovered by the events that follow in this walk, if the window reaches them.
        if (byId.has(event.entityId) || gone.has(event.entityId)) break;
        byId.set(event.entityId, {
          id: event.entityId,
          workspaceId: entities[0]?.workspaceId ?? "",
          kind: event.field,
          name: event.fromValue || event.entityName,
          description: "",
          attributes: {},
          parentId: null,
          source: "history",
          createdAt: event.at,
          updatedAt: event.at,
        } as unknown as Omit<s.Entity, "attributes"> & { attributes: Record<string, string> });
        restored++;
        break;
      }

      case "renamed": if (entity) entity.name = event.fromValue; break;
      case "retyped": if (entity) entity.kind = event.fromValue; break;
      case "described": if (entity) entity.description = event.fromValue; break;
      case "attributeSet":
      case "attributeRemoved":
        if (!entity || !event.field) break;
        if (event.fromValue) entity.attributes[event.field] = event.fromValue;
        else delete entity.attributes[event.field];
        break;
      default:
        // A kind this does not know how to undo — a move, whose event carries names rather than
        // ids — is left alone rather than guessed at.
        break;
    }
  }

  return {
    entities: [...byId.values()].map((e) => ({ ...e, attributes: JSON.stringify(e.attributes) }) as s.Entity),
    undone: since.length,
    restored,
    removed: gone.size,
  };
}

/** What the rewind did, in one sentence, including what it cannot promise. */
export function rewindWords(rewound: Rewound, at: Date): string {
  const when = at.toISOString().slice(0, 10);
  if (!rewound.undone) return `Nothing has changed since ${when}; this is the estate as it is.`;
  const parts = [`The estate on ${when}: ${rewound.undone} change${rewound.undone === 1 ? "" : "s"} undone`];
  if (rewound.removed) parts.push(`${rewound.removed} object${rewound.removed === 1 ? "" : "s"} had not been created yet`);
  if (rewound.restored) parts.push(`${rewound.restored} that ${rewound.restored === 1 ? "has" : "have"} since been deleted ${rewound.restored === 1 ? "is" : "are"} back`);
  return `${parts.join(", ")}.`;
}
