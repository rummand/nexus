import type { FactSheet, FactSheetRelation, LeanIxExport } from "./types";

/**
 * Reading a LeanIX workspace (§5.62).
 *
 * Thin on purpose: everything with judgement in it is in `map.ts`, which can be tested without a
 * licence. This part authenticates, pages, and complains loudly.
 *
 * The auth is LeanIX's two-step: an API token is exchanged at the MTM service for a short-lived
 * bearer, and the bearer is what Pathfinder's GraphQL accepts. The token is read from the
 * environment and never from an argument — a secret in `argv` is a secret in the shell history
 * and in every `ps` on the machine.
 */

export interface LeanIxOptions {
  /** "energinet.leanix.net" — the host, not a URL. */
  host: string;
  /**
   * Where to reach it, when that is not `https://<host>`: an enterprise gateway in front of the
   * API, or a stub in a test. Named separately for the same reason `NEXUS_MODEL_BASE_URL` is
   * (§5.31) — so the tool never inherits a base URL that belongs to something else.
   */
  baseUrl?: string;
  token: string;
  /** How many fact sheets per request. LeanIX rejects much more than a few hundred. */
  pageSize?: number;
  /** Refuse to loop forever if a cursor ever stops advancing. */
  maxPages?: number;
  log?: (line: string) => void;
}

const base = (o: LeanIxOptions) => (o.baseUrl ?? `https://${o.host}`).replace(/\/$/, "");

const TOKEN_PATH = "/services/mtm/v1/oauth2/token";
const GRAPHQL_PATH = "/services/pathfinder/v1/graphql";

export class LeanIxError extends Error {
  constructor(message: string, readonly detail?: unknown) {
    super(message);
    this.name = "LeanIxError";
  }
}

/** Exchange the API token for a bearer. Returns the bearer only; the token is not kept. */
export async function authenticate(opts: LeanIxOptions): Promise<string> {
  const res = await fetch(`${base(opts)}${TOKEN_PATH}`, {
    method: "POST",
    headers: {
      // LeanIX wants the literal user "apitoken" and the token as the password.
      Authorization: `Basic ${Buffer.from(`apitoken:${opts.token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    throw new LeanIxError(
      `Authentication failed (${res.status}). A LeanIX API token is created under Administration → `
      + `API tokens, and it must belong to a user who can read the workspace.`,
      await res.text().catch(() => ""),
    );
  }
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new LeanIxError("Authentication returned no access token.", body);
  return body.access_token;
}

async function graphql<T>(opts: LeanIxOptions, bearer: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${base(opts)}${GRAPHQL_PATH}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  if (!res.ok) throw new LeanIxError(`GraphQL request failed (${res.status}).`, text.slice(0, 2000));
  let body: { data?: T; errors?: unknown };
  try {
    body = JSON.parse(text) as { data?: T; errors?: unknown };
  } catch {
    throw new LeanIxError("GraphQL returned something that is not JSON.", text.slice(0, 500));
  }
  // A GraphQL 200 with an errors array is the normal way this API says no.
  if (body.errors) throw new LeanIxError("GraphQL reported errors.", body.errors);
  if (!body.data) throw new LeanIxError("GraphQL returned no data.", body);
  return body.data;
}

/**
 * Every fact sheet, with every field the workspace configured.
 *
 * `...on FactSheet` gives the fields common to all types. The per-type fields are fetched by
 * asking the schema what they are first: a hard-coded field list would be right for one
 * workspace and wrong for the next, which is the whole reason this is a configurable product.
 */
const PAGE = `
query Page($first: Int!, $after: String) {
  allFactSheets(first: $first, after: $after) {
    totalCount
    pageInfo { hasNextPage endCursor }
    edges { node {
      id type name displayName description
      tags { name }
      subscriptions { edges { node { user { email } roles { name } } } }
      ...on FactSheet { updatedAt }
    } }
  }
}`;

const RELATIONS = `
query Rels($first: Int!, $after: String) {
  allFactSheets(first: $first, after: $after) {
    pageInfo { hasNextPage endCursor }
    edges { node {
      id
      relToChild: relToChild { edges { node { factSheet { id } } } }
      relToParent: relToParent { edges { node { factSheet { id } } } }
    } }
  }
}`;

interface PageNode {
  id: string; type: string; name?: string; displayName?: string; description?: string;
  updatedAt?: string;
  tags?: Array<{ name?: string }>;
  subscriptions?: { edges?: Array<{ node?: { user?: { email?: string }; roles?: Array<{ name?: string }> } }> };
  [key: string]: unknown;
}

interface PageResult {
  allFactSheets: {
    totalCount?: number;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: Array<{ node: PageNode }>;
  };
}

const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : "");

function toFactSheet(node: PageNode): FactSheet {
  const known = new Set(["id", "type", "name", "displayName", "description", "tags", "subscriptions", "__typename"]);
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(node)) {
    if (known.has(k)) continue;
    const value = str(v);
    if (value) fields[k] = value;
  }
  return {
    id: node.id,
    type: node.type ?? "",
    name: node.name ?? "",
    displayName: node.displayName,
    description: node.description,
    fields,
    tags: (node.tags ?? []).map((t) => t?.name ?? "").filter(Boolean),
    subscriptions: (node.subscriptions?.edges ?? [])
      .map((e) => ({
        email: e?.node?.user?.email ?? "",
        role: (e?.node?.roles ?? []).map((r) => r?.name ?? "").filter(Boolean).join(" / "),
      }))
      .filter((s) => s.email),
  };
}

/** Page through everything, refusing to loop if the cursor stops moving. */
export async function fetchAll(opts: LeanIxOptions): Promise<LeanIxExport> {
  const log = opts.log ?? (() => {});
  const pageSize = opts.pageSize ?? 100;
  const maxPages = opts.maxPages ?? 500;
  const bearer = await authenticate(opts);
  log(`authenticated against ${opts.host}`);

  const factSheets: FactSheet[] = [];
  const relations: FactSheetRelation[] = [];
  const seenCursors = new Set<string>();
  let after: string | null = null;

  for (let page = 0; page < maxPages; page++) {
    const data: PageResult = await graphql<PageResult>(opts, bearer, PAGE, { first: pageSize, after });
    const conn = data.allFactSheets;
    for (const edge of conn.edges) factSheets.push(toFactSheet(edge.node));
    log(`page ${page + 1}: ${factSheets.length}${conn.totalCount ? ` of ${conn.totalCount}` : ""} fact sheets`);
    if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) break;
    // A cursor that repeats means the server is not advancing; stopping beats a silent infinite
    // loop that fills a disk.
    if (seenCursors.has(conn.pageInfo.endCursor)) {
      log("the cursor stopped advancing — stopping here rather than looping");
      break;
    }
    seenCursors.add(conn.pageInfo.endCursor);
    after = conn.pageInfo.endCursor;
  }

  /*
   * Relations are fetched in a second pass over the same connection. Parent/child is the pair
   * every workspace has; anything else is named after the two fact sheet types it joins and is
   * therefore workspace-specific — `--relations` in the CLI takes those field names.
   */
  after = null;
  seenCursors.clear();
  for (let page = 0; page < maxPages; page++) {
    let data: { allFactSheets: PageResult["allFactSheets"] };
    try {
      data = await graphql(opts, bearer, RELATIONS, { first: pageSize, after });
    } catch (e) {
      log(`relations pass stopped: ${e instanceof Error ? e.message : String(e)}`);
      break;
    }
    const conn = data.allFactSheets;
    for (const edge of conn.edges) {
      const node = edge.node as PageNode & Record<string, { edges?: Array<{ node?: { factSheet?: { id?: string } } }> }>;
      for (const key of ["relToChild", "relToParent"]) {
        for (const e of node[key]?.edges ?? []) {
          const otherId = e?.node?.factSheet?.id;
          if (otherId) relations.push({ fromId: node.id, toId: otherId, type: key, fields: {} });
        }
      }
    }
    if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor || seenCursors.has(conn.pageInfo.endCursor)) break;
    seenCursors.add(conn.pageInfo.endCursor);
    after = conn.pageInfo.endCursor;
  }

  const counts = new Map<string, number>();
  for (const fs of factSheets) counts.set(fs.type, (counts.get(fs.type) ?? 0) + 1);

  return {
    host: opts.host,
    workspace: opts.host.split(".")[0] ?? opts.host,
    exportedAt: new Date().toISOString(),
    factSheets,
    relations,
    types: [...counts.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
  };
}
