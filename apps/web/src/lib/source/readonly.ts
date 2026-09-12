/**
 * The read-only guard over every system of record Nexus connects to (#111, §5.99).
 *
 * "Nexus cannot change your LeanIX workspace" is the first thing an EA tooling buyer asks about,
 * and until now the answer was an assurance: the client happens to send only queries. An assurance
 * is worth nothing — nobody can audit an intention, and the next person to add a feature has no
 * way of knowing they broke a promise nobody wrote down.
 *
 * So the promise is made structural. Every request to a source of record goes through this module,
 * and this module refuses anything that is not a read. A mutation does not fail at LeanIX with a
 * permission error; it never leaves this process.
 *
 * **Deny by default.** A document this cannot confidently classify as a pure read is refused. That
 * is the wrong bias for a parser and the only defensible one for a guard: the cost of refusing a
 * legitimate read is an error message, and the cost of passing an unrecognised mutation is
 * somebody's production estate.
 *
 * Pure and dependency-free on purpose, so the proof of the promise is a unit test rather than a
 * story about one.
 */

/** Refused before it left the process. Distinct from a transport error, which means it went. */
export class WriteRefused extends Error {
  constructor(readonly what: string, readonly why: string) {
    super(`Refused to send a ${what} to a source of record: ${why}`);
    this.name = "WriteRefused";
  }
}

/* -------------------------------------------------------------------------------------------- */
/* GraphQL                                                                                        */
/* -------------------------------------------------------------------------------------------- */

/**
 * Everything that is not part of the document's structure: comments, and the contents of strings.
 *
 * Stripped before anything is classified, because `query` inside a string argument or a `#` line
 * is not an operation, and `mutation` inside one is not a mutation. Replaced with spaces rather
 * than removed so that nothing on either side is accidentally joined into a new word.
 */
export function stripNoise(document: string): string {
  let out = "";
  let i = 0;
  const blank = (n: number) => " ".repeat(n);
  while (i < document.length) {
    const rest = document.slice(i);
    if (rest.startsWith('"""')) {
      const end = document.indexOf('"""', i + 3);
      const stop = end === -1 ? document.length : end + 3;
      out += blank(stop - i);
      i = stop;
      continue;
    }
    if (document[i] === '"') {
      let j = i + 1;
      while (j < document.length && document[j] !== '"') j += document[j] === "\\" ? 2 : 1;
      const stop = Math.min(j + 1, document.length);
      out += blank(stop - i);
      i = stop;
      continue;
    }
    if (document[i] === "#") {
      const nl = document.indexOf("\n", i);
      const stop = nl === -1 ? document.length : nl;
      out += blank(stop - i);
      i = stop;
      continue;
    }
    out += document[i];
    i += 1;
  }
  return out;
}

/** What a GraphQL document asks for, once the noise is gone. */
export type Operation = "query" | "mutation" | "subscription" | "fragment" | "unrecognised";

/**
 * Every top-level definition in a document, in order.
 *
 * A document may hold more than one, and a client that sends two definitions and names the one it
 * wants would slip a mutation past a guard that only looked at the first word. So all of them are
 * classified, and the caller refuses if *any* of them is a write.
 */
export function operationsIn(document: string): Operation[] {
  const src = stripNoise(document);
  const found: Operation[] = [];
  let i = 0;

  /** Walk a balanced `{ … }` selection set, leaving `i` just past its closing brace. */
  const skipSelectionSet = () => {
    let depth = 0;
    while (i < src.length) {
      if (src[i] === "{") depth += 1;
      else if (src[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          i += 1;
          return true;
        }
      }
      i += 1;
    }
    return false; // unbalanced — the caller treats that as unrecognisable
  };

  while (i < src.length) {
    const ch = src[i] ?? "";
    if (/\s|,/.test(ch)) {
      i += 1;
      continue;
    }
    // The anonymous shorthand — `{ me { id } }` — which is always a read.
    if (ch === "{") {
      found.push("query");
      if (!skipSelectionSet()) found.push("unrecognised");
      continue;
    }
    const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))?.[0];
    if (!word) {
      // Punctuation where a definition should start: not a document this understands.
      found.push("unrecognised");
      break;
    }
    if (word !== "query" && word !== "mutation" && word !== "subscription" && word !== "fragment") {
      found.push("unrecognised");
      break;
    }
    found.push(word);
    i += word.length;
    /*
     * Between the keyword and the selection set sit the operation name, the variable definitions
     * and any directives — `query Page($first: Int!) @live { … }`. None of it changes what the
     * operation is, but skipping to the first `{` without stepping over it would read `Page` as
     * a second definition and refuse a perfectly ordinary query.
     */
    while (i < src.length && src[i] !== "{") i += 1;
    if (i >= src.length || !skipSelectionSet()) {
      found.push("unrecognised");
      break;
    }
  }
  return found;
}

/**
 * Let a GraphQL document through, or throw.
 *
 * Subscriptions are refused alongside mutations, not because they write but because they hold a
 * socket open against somebody's production system, which is not a thing an importer should be
 * able to start by accident.
 */
export function assertReadQuery(document: string): void {
  const ops = operationsIn(document);
  if (!ops.length) throw new WriteRefused("GraphQL document", "it contains no operation at all.");
  const write = ops.find((o) => o === "mutation" || o === "subscription");
  if (write) {
    throw new WriteRefused(
      `GraphQL ${write}`,
      `Nexus only ever reads a source of record, and this document contains a ${write}.`,
    );
  }
  if (ops.includes("unrecognised")) {
    throw new WriteRefused(
      "GraphQL document",
      "it contains a top-level definition that is neither a query nor a fragment, and anything "
      + "this guard cannot recognise is refused rather than forwarded.",
    );
  }
}

/* -------------------------------------------------------------------------------------------- */
/* HTTP                                                                                           */
/* -------------------------------------------------------------------------------------------- */

/** The methods that cannot change anything at the other end. */
export const READ_METHODS = ["GET", "HEAD", "OPTIONS"] as const;

/**
 * Why POST is not simply banned.
 *
 * GraphQL is read over POST — that is how the protocol works — and an OAuth token exchange is a
 * POST too. Both are named here rather than waved through: a POST is allowed only when the caller
 * says which of the two it is, so a new POST added later has to state its case at the call site
 * instead of inheriting an exception somebody else argued for.
 */
export type PostReason = "graphql-read" | "token-exchange";

export function assertReadRequest(method: string, opts: { post?: PostReason; query?: string } = {}): void {
  const verb = method.toUpperCase();
  if ((READ_METHODS as readonly string[]).includes(verb)) return;
  if (verb !== "POST") {
    throw new WriteRefused(
      `${verb} request`,
      `Nexus only ever reads a source of record, and ${verb} is not a read.`,
    );
  }
  if (opts.post === "token-exchange") return;
  if (opts.post === "graphql-read") {
    if (typeof opts.query !== "string") {
      throw new WriteRefused("POST", "it claims to be a GraphQL read but carries no document to check.");
    }
    assertReadQuery(opts.query);
    return;
  }
  throw new WriteRefused(
    "POST",
    "a POST to a source of record has to say whether it is a GraphQL read or a token exchange; "
    + "this one said neither.",
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Saying it out loud                                                                             */
/* -------------------------------------------------------------------------------------------- */

/** One connector's promise, for the audit panel. */
export interface Contract {
  connector: string;
  /** The name a person recognises: "LeanIX", "Confluence". */
  label: string;
  /**
   * Whether Nexus actually promises this one cannot write.
   *
   * A field rather than something the panel infers from the wording below. Inferring it would
   * mean a rewritten sentence could silently turn a card green and claim a guarantee nobody
   * makes — which is the precise failure this whole feature exists to prevent.
   */
  guaranteed: boolean;
  /** How the promise is kept, in one sentence somebody non-technical can check against the code. */
  enforcement: string;
}

/**
 * Every connector that reaches a system of record, and what each one is allowed to do.
 *
 * A list rather than a discovered set, because "which connectors talk to somebody else's
 * production system" is a question the answer to which should change only when a person decides
 * it does. A new connector that is not here is not covered by the audit, and the test below the
 * fold keeps it honest.
 */
export const CONTRACTS: Contract[] = [
  {
    connector: "leanix",
    label: "LeanIX",
    guaranteed: true,
    enforcement:
      "Every request is checked before it is sent: a GraphQL mutation or subscription is refused "
      + "in this process, and the only non-GET requests are the token exchange and the read query "
      + "itself.",
  },
  {
    connector: "mcp",
    label: "Outbound MCP servers",
    guaranteed: false,
    enforcement:
      "Tools an outbound server offers are called with the arguments a person or an agent chose; "
      + "the server is somebody else's and Nexus makes no read-only promise on its behalf.",
  },
];

export function contractFor(connector: string): Contract | null {
  return CONTRACTS.find((c) => c.connector === connector) ?? null;
}

/** "455 fact sheets and 1,203 relations, read 12 minutes ago." */
export function readWords(read: { objects: number; relations: number; at: Date | string }): string {
  const n = (x: number) => x.toLocaleString("en-GB");
  const when = typeof read.at === "string" ? new Date(read.at) : read.at;
  const mins = Math.max(0, Math.round((Date.now() - when.getTime()) / 60000));
  const ago =
    mins < 1 ? "just now"
    : mins < 60 ? `${mins} minute${mins === 1 ? "" : "s"} ago`
    : mins < 60 * 48 ? `${Math.round(mins / 60)} hour${Math.round(mins / 60) === 1 ? "" : "s"} ago`
    : `${Math.round(mins / 1440)} days ago`;
  const parts = [`${n(read.objects)} object${read.objects === 1 ? "" : "s"}`];
  if (read.relations) parts.push(`${n(read.relations)} relation${read.relations === 1 ? "" : "s"}`);
  return `${parts.join(" and ")}, read ${ago}.`;
}
