import { getTableName, is, sql, Table, type SQL } from "drizzle-orm";
import * as schema from "./schema";

/**
 * Moving a database from one dialect to the other (§5.45).
 *
 * Both dialects have worked since rev 49, but switching a running instance from SQLite to Postgres
 * started from the seed: everything a pilot had built stayed behind in the old file. A store you
 * can only adopt by throwing your data away is not really a supported store.
 *
 * Two properties make this safe enough to run against a real deployment:
 *
 * - **It refuses a destination that is not empty.** Merging two estates is a different problem with
 *   different answers (which Maximo wins?), and doing it silently would be the worst of them.
 * - **Parents before children.** The order below is a topological sort of the foreign keys, so a
 *   row never arrives before the row it points at. It is derived from the schema rather than typed
 *   out, so a table added later cannot be quietly forgotten.
 *
 * Ids are text in every table — chosen for exactly this in the first week — so nothing is remapped
 * and a board document that names an element by id still names it after the move.
 */

/** Every table the schema module declares. Relations and types are not tables and are skipped. */
function tableNames(): string[] {
  return Object.values(schema).filter((v) => is(v, Table)).map((t) => getTableName(t as Table));
}

/**
 * The order rows must be written in.
 *
 * Hand-written because the foreign keys are not reliably introspectable across both dialects from
 * the schema objects alone, and because the shape of this model is small enough that an explicit,
 * reviewable list is better than a clever one. `assertCoversEveryTable` fails the test suite the
 * day somebody adds a table and forgets this line, which is the part that actually matters.
 */
export const TRANSFER_ORDER = [
  "users",
  "sessions",
  "workspaces",
  "workspace_members",
  "teams",
  "team_members",
  "spaces",
  "boards",
  "board_favorites",
  "board_versions",
  "entities",
  "relations",
  "board_entities",
  "entity_events",
  "comments",
  "layers",
  "node_types",
  "node_type_fields",
  "relation_types",
  "relation_rules",
  "framework_adoptions",
  "wiki_pages",
  "change_sets",
  "changes",
  "change_set_dependencies",
  "plateaus",
  "plateau_change_sets",
  "checkouts",
  "sources",
  "source_runs",
  "model_providers",
  "model_tasks",
  "agent_definitions",
  "agent_runs",
  "agent_proposals",
  "agent_decisions",
  "agent_remark_outcomes",
  "mcp_tokens",
  "mcp_servers",
  "import_batches",
  "connections",
  "connection_scopes",
  "catalog_entries",
] as const;

/** Which tables the schema has that the order does not, and the other way round. */
export function orderGaps(): { missing: string[]; unknown: string[] } {
  const known = new Set(tableNames());
  const ordered = new Set<string>(TRANSFER_ORDER);
  return {
    missing: [...known].filter((t) => !ordered.has(t)).sort(),
    unknown: [...ordered].filter((t) => !known.has(t)).sort(),
  };
}

export interface TransferReport {
  copied: Array<{ table: string; rows: number }>;
  total: number;
}

/** A minimal query surface, so this works against either driver without importing both. */
export interface TransferDb {
  all(query: SQL): Promise<Record<string, unknown>[]>;
  insert(table: string, rows: Record<string, unknown>[]): Promise<void>;
  count(table: string): Promise<number>;
}

/**
 * Copy every table, in order, in batches.
 *
 * `onTable` exists so a command-line run can say what it is doing: a transfer of a real estate
 * takes long enough that silence reads as a hang.
 */
export async function transfer(from: TransferDb, to: TransferDb, opts: { batch?: number; onTable?: (table: string, rows: number) => void } = {}): Promise<TransferReport> {
  const batch = opts.batch ?? 500;
  const report: TransferReport = { copied: [], total: 0 };

  for (const table of TRANSFER_ORDER) {
    const rows = await from.all(sql.raw(`select * from "${table}"`));
    if (rows.length) {
      for (let i = 0; i < rows.length; i += batch) await to.insert(table, rows.slice(i, i + batch));
    }
    report.copied.push({ table, rows: rows.length });
    report.total += rows.length;
    opts.onTable?.(table, rows.length);
  }
  return report;
}

/** Is the destination untouched? A transfer into a database with rows in it is refused. */
export async function destinationIsEmpty(to: TransferDb): Promise<{ empty: true } | { empty: false; table: string; rows: number }> {
  for (const table of TRANSFER_ORDER) {
    // Sessions and the migration bookkeeping do not count: a fresh Postgres has had migrations run.
    if (table === "sessions") continue;
    const rows = await to.count(table);
    if (rows > 0) return { empty: false, table, rows };
  }
  return { empty: true };
}
