import { PROVIDERS } from "./providers";
import type { Discovery, DiscoveryEvidence, Provider } from "./types";

/**
 * The discovery agent.
 *
 * It does not scan a network — it reads what Nexus already knows. That is the honest version of
 * "the agent found SAP on the estate", and in practice the better one: four meetings that argued
 * about SAP PM are stronger evidence that the system matters here than a port being open.
 *
 * Deterministic and pure, like every other agent rung in this codebase (docs/BRIEF.md §2.2), and
 * for the same reason: a proposal that asks for access to a production system has to be able to
 * show its working.
 */

export interface DiscoveryInput {
  /** Entities in the graph — a system somebody has already drawn is strong evidence. */
  entities: Array<{ id: string; name: string; kind: string }>;
  /** Ingested sources: name and text, so a mention in a meeting counts. */
  sources: Array<{ id: string; name: string; text: string }>;
  /** Providers already granted or declined; a settled question is not re-proposed. */
  decided?: string[];
}

const norm = (v: string) => v.toLowerCase();

/** Whole-word, case-insensitive: "SAP" must not match "asap". */
function mentions(haystack: string, signal: string): boolean {
  const escaped = signal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\d])${escaped}(?![\\p{L}\\d])`, "iu").test(haystack);
}

/** A short window around the first hit, so the evidence quotes the source rather than paraphrasing. */
function around(text: string, signal: string, width = 130): string {
  const at = norm(text).indexOf(norm(signal));
  if (at < 0) return "";
  const from = Math.max(0, at - width / 2);
  const slice = text.slice(from, from + width).replace(/\s+/g, " ").trim();
  return `${from > 0 ? "…" : ""}${slice}${from + width < text.length ? "…" : ""}`;
}

export function discoverProviders(input: DiscoveryInput): Discovery[] {
  const decided = new Set(input.decided ?? []);
  const out: Discovery[] = [];

  for (const provider of PROVIDERS) {
    if (decided.has(provider.id) || provider.signals.length === 0) continue;
    const evidence: DiscoveryEvidence[] = [];

    // 1. the graph — somebody has already put this system on a canvas
    const hits = input.entities.filter((e) => provider.signals.some((s) => mentions(e.name, s)));
    if (hits.length > 0) {
      evidence.push({
        origin: "graph",
        detail: `${hits.length === 1 ? "An entity" : `${hits.length} entities`} named ${hits.slice(0, 3).map((h) => `“${h.name}”`).join(", ")} already ${hits.length === 1 ? "exists" : "exist"} in the graph, with no source behind ${hits.length === 1 ? "it" : "them"}.`,
        refs: hits.map((h) => h.id),
      });
    }

    // 2. intake — people talked about it
    const spoken = input.sources.filter((s) => provider.signals.some((sig) => mentions(s.text, sig) || mentions(s.name, sig)));
    for (const s of spoken.slice(0, 3)) {
      const signal = provider.signals.find((sig) => mentions(s.text, sig)) ?? provider.signals[0]!;
      evidence.push({
        origin: "intake",
        detail: `“${s.name}” mentions ${signal}: ${around(s.text, signal)}`,
        refs: [s.id],
      });
    }
    if (spoken.length > 3) {
      evidence.push({ origin: "intake", detail: `…and ${spoken.length - 3} more ingested sources mention it.`, refs: spoken.slice(3).map((s) => s.id) });
    }

    if (evidence.length === 0) continue;

    const strength = (hits.length > 0 ? 2 : 0) + Math.min(2, spoken.length);
    const confidence = strength >= 3 ? "high" : strength >= 2 ? "medium" : "low";
    out.push({
      providerId: provider.id,
      confidence,
      reason: reasonFor(provider, hits.length, spoken.length),
      evidence,
      wants: wantedScopes(provider),
    });
  }

  const rank = { high: 3, medium: 2, low: 1 };
  return out.sort((a, b) => rank[b.confidence] - rank[a.confidence] || b.evidence.length - a.evidence.length);
}

/** The agent's case for asking. It names what it wants and what that would buy. */
function reasonFor(provider: Provider, graphHits: number, sourceHits: number): string {
  const seen = [
    graphHits ? `${graphHits} ${graphHits === 1 ? "entity" : "entities"} in the graph` : "",
    sourceHits ? `${sourceHits} ingested source${sourceHits === 1 ? "" : "s"}` : "",
  ].filter(Boolean).join(" and ");
  const first = provider.scopes.find((s) => s.enables);
  return `${provider.name} shows up in ${seen}, but nothing here reads it.${first?.enables ? ` Granted ${first.name}, Nexus could ${lowerFirst(first.enables)}` : ""}`;
}

const lowerFirst = (v: string) => (v ? v.charAt(0).toLowerCase() + v.slice(1) : v);

/**
 * What the agent asks for first: the scopes that can justify themselves, least sensitive first.
 * It asks for three at most — an agent that asks for everything gets refused everything.
 */
function wantedScopes(provider: Provider): string[] {
  const weight = { open: 0, internal: 1, confidential: 2, personal: 3 };
  return provider.scopes
    .filter((s) => s.enables)
    .sort((a, b) => weight[a.sensitivity] - weight[b.sensitivity])
    .slice(0, 3)
    .map((s) => s.path);
}
