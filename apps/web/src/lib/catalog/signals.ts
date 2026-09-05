/**
 * Fingerprints: how a system gives itself away.
 *
 * Name matching finds a system only when somebody wrote its name. Real estates leak far more than
 * that — a hostname in a meeting, a table name in a spreadsheet header, a tcode in a support
 * ticket, a file that only one toolchain produces. Each of those is a *signal*, and signals are
 * what the discovery agent actually reasons over.
 *
 * Everything here is pure and regex-driven, so a proposal can always name the exact string that
 * produced it. That matters more than cleverness: this machinery ends in a request for access to
 * a production system, and "because something matched" is not an argument.
 */

export type SignalKind = "hostname" | "identifier" | "file" | "name";

export interface Fingerprint {
  kind: SignalKind;
  /** Regex source, case-insensitive. Kept as a string so providers stay plain data. */
  pattern: string;
  /** How much this is worth. A hostname is near-proof; a product name is a hint. */
  weight: number;
  /** What a match means, in words, for the evidence line. */
  note: string;
}

export interface Signal {
  kind: SignalKind;
  /** The exact text that matched. */
  match: string;
  weight: number;
  note: string;
  /** Where it was found. */
  channel: Channel;
  /** Which record it came from, so evidence stays clickable. */
  ref: string;
  refName: string;
  /** A readable window around the match. */
  context: string;
  /** How many places this same string was found, once identical hits are folded together. */
  occurrences?: number;
}

export type Channel = "graph" | "attributes" | "intake" | "board" | "model";

export const CHANNEL_LABEL: Record<Channel, string> = {
  graph: "Entities",
  attributes: "Attributes",
  intake: "Ingested sources",
  board: "Boards",
  model: "Meta-model",
};

/** Anything shaped like a host, optionally with a scheme, port and path. */
const HOST = /\b(?:([a-z][a-z0-9+.-]{1,12}):\/\/)?((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.){1,4}(?:[a-z]{2,24}))(?::(\d{2,5}))?(?:\/[\w\-./%?=&#]*)?/gi;

/** Hosts that say nothing about an estate. */
const NOISE = new Set([
  "example.com", "example.org", "localhost", "google.com", "www.google.com", "wikipedia.org",
  "youtube.com", "linkedin.com", "microsoft.com", "www.microsoft.com",
]);

/**
 * Last labels that mean "this is a filename", not "this is a host". Without these, package.json
 * and diagram.drawio are proposed as systems, which is the fastest way to make a discovery agent
 * look stupid.
 */
const NOT_A_TLD = new Set([
  "json", "xml", "yml", "yaml", "md", "txt", "csv", "tsv", "png", "jpg", "jpeg", "gif", "svg",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "zip", "gz", "tar", "log", "lock", "env",
  "js", "ts", "tsx", "jsx", "py", "rb", "go", "rs", "java", "cs", "sh", "sql", "toml", "ini",
  "cfg", "conf", "properties", "tcp", "udp", "http", "https", "exe", "dll", "bat", "ps1", "drawio",
]);

/**
 * Every hostname in a piece of text, normalised to a bare host: scheme, port and path removed, so
 * `opc.tcp://pi-prd.acme.dk:4840` and `https://pi-prd.acme.dk/x` are recognised as one machine.
 */
export function extractHosts(text: string): string[] {
  const out = new Set<string>();
  const re = new RegExp(HOST.source, HOST.flags);
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const host = m[2]!.toLowerCase().replace(/[.,;:)]+$/, "");
    // A scheme captured *without* a host means the match is the scheme itself ("opc.tcp" in
    // "opc.tcp://…"); the real host is picked up by the next match.
    if (text.slice(m.index + m[0].length, m.index + m[0].length + 3) === "://") continue;
    const tld = host.split(".").pop()!;
    if (NOT_A_TLD.has(tld)) continue;
    if (NOISE.has(host)) continue;
    if (/^\d+(\.\d+)+$/.test(host)) continue; // version numbers
    out.add(host);
  }
  return [...out];
}

/** The registrable-ish domain, for grouping several hosts of one system together. */
export function rootDomain(host: string): string {
  const bare = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").split("/")[0]!.split(":")[0]!;
  const parts = bare.split(".");
  if (parts.length <= 2) return bare;
  // co.uk, com.au and friends keep three labels.
  const twoLevel = /^(co|com|org|net|gov|ac)\.[a-z]{2}$/.test(parts.slice(-2).join("."));
  return parts.slice(twoLevel ? -3 : -2).join(".");
}

/** A readable window around a match, so evidence quotes rather than paraphrases. */
export function contextAround(text: string, match: string, width = 120): string {
  const at = text.toLowerCase().indexOf(match.toLowerCase());
  if (at < 0) return "";
  const from = Math.max(0, at - Math.floor(width / 3));
  const slice = text.slice(from, from + width).replace(/\s+/g, " ").trim();
  return `${from > 0 ? "…" : ""}${slice}${from + width < text.length ? "…" : ""}`;
}

/** Match one text against one fingerprint set, returning every distinct hit. */
export function matchFingerprints(
  text: string,
  fingerprints: Fingerprint[],
  where: { channel: Channel; ref: string; refName: string },
): Signal[] {
  const out: Signal[] = [];
  const seen = new Set<string>();
  for (const fp of fingerprints) {
    const re = new RegExp(fp.pattern, "giu");
    for (let m = re.exec(text); m; m = re.exec(text)) {
      const match = m[0].trim();
      const key = `${fp.kind}|${match.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ kind: fp.kind, match, weight: fp.weight, note: fp.note, context: contextAround(text, match), ...where });
      if (out.length > 200) return out; // a pathological input cannot stall a scan
    }
  }
  return out;
}
