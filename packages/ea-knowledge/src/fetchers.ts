/**
 * Reading a source over the network.
 *
 * Three things matter here and none of them are clever:
 *
 * - **Identify yourself.** Wikimedia rate-limits anonymous traffic hard, and a shared egress IP is
 *   already hot; a real User-Agent with a contact URL is the difference between 429 and 200.
 * - **Go slowly.** One request at a time with a pause between them. Ingest is a background job run
 *   occasionally, not a page load, so there is nothing to gain by hurrying and a block to lose.
 * - **Give up honestly.** A source that cannot be fetched is recorded as unreachable and the run
 *   continues. Half a corpus with a manifest that says which half is missing beats a failed run.
 */

import type { Source } from "./types";

export const USER_AGENT = "NexusEAKnowledgeBase/0.1 (https://github.com/rummand/nexus; enterprise-architecture corpus builder)";

export interface FetchOptions {
  /** Pause between requests, in ms. */
  delayMs?: number;
  /** How many times to retry a 429 / 5xx, with exponential backoff. */
  retries?: number;
  /** Called with progress lines. */
  log?: (line: string) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function politeFetch(url: string, opts: Required<Pick<FetchOptions, "retries">> & { log?: (l: string) => void }): Promise<string> {
  let wait = 2000;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "application/json, text/plain, */*" } });
    if (res.ok) return await res.text();
    const retriable = res.status === 429 || res.status >= 500;
    if (!retriable || attempt >= opts.retries) throw new Error(`HTTP ${res.status} for ${url}`);
    // Wikimedia sends Retry-After on a rate limit; honour it rather than guessing.
    const after = Number(res.headers.get("retry-after"));
    const pause = Number.isFinite(after) && after > 0 ? after * 1000 : wait;
    opts.log?.(`  … ${res.status}, waiting ${Math.round(pause / 1000)}s`);
    await sleep(pause);
    wait = Math.min(wait * 2, 60_000);
  }
}

/** MediaWiki plaintext extract of one article, headings included as `== … ==`. */
async function fetchMediaWiki(source: Source, opts: Required<Pick<FetchOptions, "retries">> & { log?: (l: string) => void }): Promise<string> {
  const title = source.title;
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "extracts",
    explaintext: "1",
    redirects: "1",
    titles: title,
  });
  const body = await politeFetch(`${source.fetchUrl}?${params}`, opts);
  const data = JSON.parse(body) as { query?: { pages?: Array<{ title: string; missing?: boolean; extract?: string }> } };
  const page = data.query?.pages?.[0];
  if (!page || page.missing) throw new Error(`no such article: ${title}`);
  if (!page.extract || page.extract.length < 400) throw new Error(`article too short to be useful: ${title}`);
  return page.extract;
}

/** A Markdown or plain-text document, lightly de-marked so the chunker sees paragraphs. */
async function fetchText(source: Source, opts: Required<Pick<FetchOptions, "retries">> & { log?: (l: string) => void }): Promise<string> {
  const raw = await politeFetch(source.fetchUrl, opts);
  return markdownToText(raw);
}

/**
 * Markdown → the same plain shape MediaWiki extracts have.
 *
 * `# Heading` becomes `== Heading ==` so one chunker handles both. Links keep their text and lose
 * their target: a URL inside a passage is noise to the index and clutter in a quote.
 */
export function markdownToText(md: string): string {
  return md
    .replace(/^<!--[\s\S]*?-->\s*/m, "")
    .split("\n")
    .map((line) => {
      const heading = /^(#{1,6})\s+(.*)$/.exec(line.trim());
      if (heading) {
        const level = Math.min(6, Math.max(2, heading[1]!.length + 1));
        return `${"=".repeat(level)} ${heading[2]!.replace(/[[\]]/g, "").trim()} ${"=".repeat(level)}`;
      }
      return line
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/^[-*]\s+/, "")
        .replace(/`{1,3}/g, "")
        .replace(/\*\*|__/g, "");
    })
    .join("\n");
}

/** Read one source. Throws with a readable message; the caller decides what to do about it. */
export async function readSource(source: Source, options: FetchOptions = {}): Promise<string> {
  const opts = { retries: options.retries ?? 4, log: options.log };
  const text = source.kind === "mediawiki" ? await fetchMediaWiki(source, opts) : await fetchText(source, opts);
  if (options.delayMs) await sleep(options.delayMs);
  return normalise(text);
}

/** Collapse the whitespace variants the sources arrive with, so hashes are stable across runs. */
export function normalise(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/ /g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
