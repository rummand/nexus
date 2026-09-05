import { PROVIDERS } from "./providers";
import { CHANNEL_LABEL, contextAround, extractHosts, matchFingerprints, rootDomain, type Channel, type Signal } from "./signals";
import type { Discovery, Provider } from "./types";

/**
 * The discovery agent — how Nexus works out what systems this enterprise runs.
 *
 * It does not scan a network, and says so. It scans what the workspace already holds: the
 * entities somebody drew, the attributes they carry, the meetings that have been ingested, the
 * text on the boards. Those turn out to be a better estate survey than a port sweep, because
 * every hit comes with a human context — who mentioned it, in what discussion, next to which
 * decision.
 *
 * Two kinds of finding come out:
 *
 *   recognised   — signals match a catalogue provider, so the agent can ask for named scopes.
 *   unrecognised — a host or endpoint nobody's catalogue knows. Those are the interesting ones:
 *                  every enterprise runs systems no vendor list contains, and the catalogue has
 *                  to be able to grow to fit the estate rather than the other way round.
 *
 * Pure and deterministic. A proposal that ends in a request for production access has to be able
 * to show the exact string that produced it.
 */

export interface ScanEntity {
  id: string;
  name: string;
  kind: string;
  attributes?: Record<string, string>;
  /** False when nothing in the graph explains where this entity came from. */
  sourced?: boolean;
}

export interface ScanText {
  id: string;
  name: string;
  text: string;
  channel: Extract<Channel, "intake" | "board">;
}

export interface DiscoveryInput {
  entities: ScanEntity[];
  texts: ScanText[];
  /** Declared type names — a workspace that models "CMDB CI" is telling you something. */
  typeNames?: string[];
  /** Providers already granted or declined; a settled question is not re-raised. */
  decided?: string[];
  /** Domains a human has already said are not worth cataloguing. */
  dismissedDomains?: string[];
  /** Sources registered in this workspace, treated exactly like catalogue entries. */
  extraProviders?: Provider[];
}

/** A host nobody's catalogue recognises. The estate is always bigger than the vendor list. */
export interface UnknownSystem {
  domain: string;
  hosts: string[];
  sightings: Array<{ channel: Channel; ref: string; refName: string; context: string }>;
}

export interface ScanReport {
  channels: Array<{ channel: Channel; label: string; scanned: number; signals: number }>;
  totalSignals: number;
  discoveries: Discovery[];
  unknown: UnknownSystem[];
  /** System-like entities with nothing behind them — model without provenance. */
  unsourced: Array<{ id: string; name: string; kind: string }>;
  scannedRecords: number;
}

/** Kinds that describe a running system, so an unsourced one is a gap rather than a note. */
const SYSTEM_KINDS = new Set(["application", "system", "platform", "it component", "service", "database", "integration", "interface"]);

const escape = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function scanForSources(input: DiscoveryInput): ScanReport {
  const providers = [...PROVIDERS, ...(input.extraProviders ?? [])];
  const decided = new Set(input.decided ?? []);
  const dismissed = new Set((input.dismissedDomains ?? []).map((d) => d.toLowerCase()));

  /** Everything readable, tagged with where it came from. */
  const documents: Array<{ channel: Channel; ref: string; refName: string; text: string }> = [
    ...input.entities.map((e) => ({ channel: "graph" as const, ref: e.id, refName: e.name, text: `${e.name} ${e.kind}` })),
    ...input.entities
      .filter((e) => e.attributes && Object.keys(e.attributes).length > 0)
      .map((e) => ({ channel: "attributes" as const, ref: e.id, refName: e.name, text: Object.entries(e.attributes!).map(([k, v]) => `${k}: ${v}`).join("\n") })),
    ...input.texts.map((t) => ({ channel: t.channel, ref: t.id, refName: t.name, text: t.text })),
    ...(input.typeNames?.length ? [{ channel: "model" as const, ref: "meta", refName: "the meta-model", text: input.typeNames.join("\n") }] : []),
  ];

  const perChannel = new Map<Channel, { scanned: number; signals: number }>();
  const bump = (channel: Channel, scanned: number, signals: number) => {
    const cur = perChannel.get(channel) ?? { scanned: 0, signals: 0 };
    perChannel.set(channel, { scanned: cur.scanned + scanned, signals: cur.signals + signals });
  };

  const signalsByProvider = new Map<string, Signal[]>();
  const allHosts = new Map<string, Array<{ channel: Channel; ref: string; refName: string; context: string }>>();

  for (const doc of documents) {
    let found = 0;
    for (const provider of providers) {
      if (provider.signals.length === 0 && provider.fingerprints.length === 0) continue;
      const nameFingerprints = provider.signals.map((sig) => ({
        kind: "name" as const,
        pattern: `(?<![\\p{L}\\d])${escape(sig)}(?![\\p{L}\\d])`,
        weight: 1,
        note: "the product is named",
      }));
      const hits = matchFingerprints(doc.text, [...provider.fingerprints, ...nameFingerprints], doc);
      if (hits.length === 0) continue;
      found += hits.length;
      signalsByProvider.set(provider.id, [...(signalsByProvider.get(provider.id) ?? []), ...hits]);
    }

    // Hosts are collected whether or not a provider claims them: what nobody claims is the
    // second half of the answer.
    for (const host of extractHosts(doc.text)) {
      allHosts.set(host, [...(allHosts.get(host) ?? []), { channel: doc.channel, ref: doc.ref, refName: doc.refName, context: contextAround(doc.text, host) }]);
    }

    bump(doc.channel, 1, found);
  }

  // ---- recognised systems -------------------------------------------------------------------
  const discoveries: Discovery[] = [];
  for (const provider of providers) {
    if (decided.has(provider.id)) continue;
    const signals = signalsByProvider.get(provider.id) ?? [];
    if (signals.length === 0) continue;
    const score = signals.reduce((n, s) => n + s.weight, 0);
    // A single product name in one sentence is a hint, not a finding.
    if (score < 2) continue;
    discoveries.push({
      providerId: provider.id,
      confidence: score >= 8 ? "high" : score >= 4 ? "medium" : "low",
      score,
      reason: reasonFor(provider, signals, score),
      signals: rank(signals).slice(0, 5),
      wants: wantedScopes(provider),
    });
  }
  discoveries.sort((a, b) => b.score - a.score || a.providerId.localeCompare(b.providerId));

  // ---- systems nobody's catalogue knows -----------------------------------------------------
  const claimed = new Set<string>();
  for (const signals of signalsByProvider.values()) {
    for (const s of signals) if (s.kind === "hostname") claimed.add(s.match.toLowerCase());
  }
  const unknownByDomain = new Map<string, UnknownSystem>();
  for (const [host, sightings] of allHosts) {
    if (claimed.has(host)) continue;
    const domain = rootDomain(host);
    if (dismissed.has(domain)) continue;
    // A domain a provider already owns is that provider's, even for a host it did not match.
    if ([...claimed].some((c) => rootDomain(c) === domain)) continue;
    const cur = unknownByDomain.get(domain) ?? { domain, hosts: [], sightings: [] };
    if (!cur.hosts.includes(host)) cur.hosts.push(host);
    cur.sightings.push(...sightings);
    unknownByDomain.set(domain, cur);
  }
  const unknown = [...unknownByDomain.values()].sort((a, b) => b.sightings.length - a.sightings.length || a.domain.localeCompare(b.domain));

  // ---- model without provenance ---------------------------------------------------------------
  const unsourced = input.entities
    .filter((e) => e.sourced === false && SYSTEM_KINDS.has(e.kind.trim().toLowerCase()))
    .map((e) => ({ id: e.id, name: e.name, kind: e.kind }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    channels: (["graph", "attributes", "intake", "board", "model"] as Channel[])
      .map((channel) => ({ channel, label: CHANNEL_LABEL[channel], ...(perChannel.get(channel) ?? { scanned: 0, signals: 0 }) })),
    totalSignals: [...signalsByProvider.values()].reduce((n, list) => n + list.length, 0),
    discoveries,
    unknown,
    unsourced,
    scannedRecords: documents.length,
  };
}

/**
 * Strongest and most specific first: a hostname before a passing mention of the vendor. Identical
 * strings are folded together with a count — four entities all named "SCADA / EMS" is one fact,
 * and listing it four times reads as padding rather than as evidence.
 */
function rank(signals: Signal[]): Signal[] {
  const kindWeight = { hostname: 4, identifier: 3, file: 2, name: 1 };
  const folded = new Map<string, Signal>();
  for (const sig of signals) {
    const key = `${sig.kind}|${sig.match.toLowerCase()}`;
    const seen = folded.get(key);
    if (seen) {
      seen.occurrences = (seen.occurrences ?? 1) + 1;
      // keep the richest context we have seen for it
      if (sig.context.length > seen.context.length) seen.context = sig.context;
      continue;
    }
    folded.set(key, { ...sig, occurrences: 1 });
  }
  return [...folded.values()].sort((a, b) => b.weight - a.weight || kindWeight[b.kind] - kindWeight[a.kind] || (b.occurrences ?? 1) - (a.occurrences ?? 1));
}

function reasonFor(provider: Provider, signals: Signal[], score: number): string {
  const best = rank(signals)[0]!;
  const channels = [...new Set(signals.map((s) => CHANNEL_LABEL[s.channel].toLowerCase()))];
  const where = channels.length === 1 ? channels[0] : `${channels.slice(0, -1).join(", ")} and ${channels[channels.length - 1]}`;
  const first = provider.scopes.find((s) => s.enables);
  const strength = score >= 8 ? "It is almost certainly running here" : score >= 4 ? "It looks like it is running here" : "It may be running here";
  return `${signals.length} signal${signals.length === 1 ? "" : "s"} across ${where} — strongest: ${best.note} (“${best.match}”). ${strength}, and nothing in Nexus reads it.${first?.enables ? ` Granted ${first.name}, Nexus could ${lowerFirst(first.enables)}` : ""}`;
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

/** Kept for callers that only want the proposals. */
export function discoverProviders(input: DiscoveryInput): Discovery[] {
  return scanForSources(input).discoveries;
}
