import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { open } from "./secret";
import { DEFAULT_BASE, type ModelChoice, type Provider, type Task } from "./types";

/**
 * Answering "what do I call for this job".
 *
 * The order is deliberate: a provider configured for this task, then any enabled provider, then the
 * environment. The environment stays last and stays supported — an instance that has been running
 * on `ANTHROPIC_API_KEY` for months must not lose its model because a settings page appeared.
 */

export interface Configured {
  providers: Provider[];
  /** Per task: which provider, and a model that overrides the provider's own. */
  tasks: Record<string, { providerId: string | null; model: string }>;
}

export async function configured(db: Db, workspaceId: string): Promise<Configured> {
  const [rows, tasks] = await Promise.all([
    db.select().from(s.modelProviders).where(eq(s.modelProviders.workspaceId, workspaceId)),
    db.select().from(s.modelTasks).where(eq(s.modelTasks.workspaceId, workspaceId)),
  ]);
  return {
    providers: rows.map(toProvider),
    tasks: Object.fromEntries(tasks.map((t) => [t.task, { providerId: t.providerId, model: t.model }])),
  };
}

export function toProvider(row: s.ModelProviderRow): Provider {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    dialect: row.dialect,
    baseUrl: row.baseUrl,
    model: row.model,
    hasKey: Boolean(row.apiKey),
    keyEncrypted: row.keyEncrypted,
    enabled: row.enabled,
    status: (["unknown", "ok", "unauthorised", "unreachable"].includes(row.status) ? row.status : "unknown") as Provider["status"],
    statusDetail: row.statusDetail,
    checkedAt: row.checkedAt,
    createdAt: row.createdAt,
  };
}

/** What the environment offers, or null. Kept so an existing deployment keeps working. */
export function fromEnvironment(): ModelChoice | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.NEXUS_MODEL;
  if (!apiKey || !model) return null;
  return {
    dialect: "anthropic",
    baseUrl: process.env.NEXUS_MODEL_BASE_URL || DEFAULT_BASE.anthropic,
    apiKey,
    model,
    from: "environment",
    providerName: "the environment",
  };
}

/** The choice for one job, from rows already read. Pure, so the order of preference is testable. */
export function chooseFrom(config: Configured, rows: s.ModelProviderRow[], task: Task): ModelChoice | null {
  const enabled = rows.filter((r) => r.enabled);
  const wanted = config.tasks[task];
  const byTask = wanted?.providerId ? enabled.find((r) => r.id === wanted.providerId) : undefined;
  const row = byTask ?? enabled[0];
  if (!row) return fromEnvironment();

  const model = (wanted?.model || row.model).trim();
  if (!model) return fromEnvironment();
  const apiKey = open(row.apiKey);
  /*
   * A provider with a key that cannot be opened is not usable, and falling through to the
   * environment would be a surprise — the settings page says the key needs setting again, and this
   * agrees with it rather than quietly using something else.
   */
  if (row.apiKey && !apiKey) return null;
  return {
    dialect: row.dialect,
    baseUrl: row.baseUrl.trim() || DEFAULT_BASE[row.dialect],
    apiKey,
    model,
    from: "provider",
    providerName: row.name,
  };
}

export async function choose(db: Db, workspaceId: string, task: Task): Promise<ModelChoice | null> {
  const rows = await db.select().from(s.modelProviders).where(eq(s.modelProviders.workspaceId, workspaceId));
  const config = await configured(db, workspaceId);
  return chooseFrom(config, rows, task);
}

/**
 * Why there is no model, in words somebody can act on.
 *
 * Three different situations that all look like "it does not work": nothing configured at all, a
 * provider that needs a model id, and a key that can no longer be opened. Saying which is the
 * difference between a person fixing it in a minute and filing a bug.
 */
export function whyNoModel(config: Configured, rows: s.ModelProviderRow[], task: Task): string {
  const enabled = rows.filter((r) => r.enabled);
  if (!enabled.length) {
    return process.env.ANTHROPIC_API_KEY || process.env.NEXUS_MODEL
      ? "The environment has only half a model configured — both ANTHROPIC_API_KEY and NEXUS_MODEL are needed. Or add a provider under Settings → Models."
      : "No model is configured. Add one under Settings → Models — Anthropic, OpenAI, or something your organisation hosts.";
  }
  const wanted = config.tasks[task];
  const row = (wanted?.providerId ? enabled.find((r) => r.id === wanted.providerId) : undefined) ?? enabled[0]!;
  if (!(wanted?.model || row.model).trim()) return `“${row.name}” has no model id. Set one under Settings → Models.`;
  if (row.apiKey && !open(row.apiKey)) return `“${row.name}” has a key that can no longer be read — NEXUS_SECRET_KEY has probably changed. Enter the key again under Settings → Models.`;
  return "No model is configured.";
}
