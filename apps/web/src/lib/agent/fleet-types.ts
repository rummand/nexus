import type { AgentRunRow } from "@/db/schema";

/**
 * A run, as a screen needs it.
 *
 * The row stores three JSON columns — what it proposed, what was thrown away, and why — because
 * a dry run has to be readable in full months later, and freezing those shapes into columns would
 * pin down a validator that is still learning what a bad answer looks like. Parsing them back is
 * done here, defensively and in one place, so nothing downstream has to trust a stored string.
 */

export interface RunProposal {
  title: string;
  detail: string;
  evidence: string[];
  confidence: string;
}

export interface RunSummary {
  id: string;
  agentId: string | null;
  agentName: string;
  createdAt: string;
  outcome: "ok" | "failed" | "refused";
  dryRun: boolean;
  scope: string;
  objectsRead: number;
  proposed: number;
  rejected: number;
  /** Why claims were thrown away, in the validator's words. */
  detail: string[];
  proposals: RunProposal[];
  note: string;
  model: string;
  error: string;
  ms: number;
}

const strings = (raw: string): string[] => {
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

const proposals = (raw: string): RunProposal[] => {
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const p = item as Record<string, unknown>;
      return [{
        title: typeof p.title === "string" ? p.title : "",
        detail: typeof p.detail === "string" ? p.detail : "",
        evidence: Array.isArray(p.evidence) ? p.evidence.filter((x): x is string => typeof x === "string") : [],
        confidence: typeof p.confidence === "string" ? p.confidence : "",
      }];
    });
  } catch {
    return [];
  }
};

export function toRunSummary(row: AgentRunRow): RunSummary {
  return {
    id: row.id,
    agentId: row.agentId,
    agentName: row.agentName,
    createdAt: row.createdAt,
    outcome: (["ok", "failed", "refused"].includes(row.outcome) ? row.outcome : "ok") as RunSummary["outcome"],
    dryRun: row.dryRun,
    scope: row.scope,
    objectsRead: row.objectsRead,
    proposed: row.proposed,
    rejected: row.rejected,
    detail: strings(row.detail),
    proposals: proposals(row.proposals),
    note: row.note,
    model: row.model,
    error: row.error,
    ms: row.ms,
  };
}
