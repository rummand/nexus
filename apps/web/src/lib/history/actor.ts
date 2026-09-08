import type { Actor } from "./events";

/**
 * Who did it (§5.43).
 *
 * Constructors rather than string literals scattered through the write sites, for one reason: the
 * history is only worth having if "an agent did this" and "Maria did this" are reliably different,
 * and the moment a caller writes `{ kind: "person", name: "" }` by hand that distinction starts to
 * rot. There is no default actor. A write that cannot say who made it says `system`, and says it
 * on purpose.
 *
 * Pure, so it can be used from anywhere — the request-bound version that reads the session cookie
 * lives in `current.ts`, and only pages and actions can call that.
 */

export const person = (user: { id: string; name: string }): Actor => ({ kind: "person", id: user.id, name: user.name });

export const agent = (agentId: string | null, name: string): Actor => ({ kind: "agent", id: agentId, name: name.trim() || "An agent" });

/** An import or a connected source. `source` is the label already stored on the entity: "import:cmdb.csv". */
export const importer = (source: string, batchId: string | null = null): Actor => ({ kind: "import", id: batchId, name: source.replace(/^import:\s*/i, "").trim() || "Import" });

/** A board save. The person who pressed the keys is usually known too — pass them and they win. */
export const board = (name: string, boardId: string): Actor => ({ kind: "board", id: boardId, name: name.trim() || "A board" });

/** Nexus's own rule engine, which proposes without a model behind it. */
export const rules = (): Actor => ({ kind: "rules", id: null, name: "The rules" });

/** Nobody could be identified. Seeding, a migration, a script. */
export const system = (name = "Nexus"): Actor => ({ kind: "system", id: null, name });
