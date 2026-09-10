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
 * What every fact sheet has, whatever type it is.
 *
 * `updatedAt` is on the `BaseFactSheet` interface, not on a type called `FactSheet` — there is
 * no such type. The first version of this asked for `...on FactSheet { updatedAt }`, which a
 * stub happily answered and a real workspace rejected outright with *Unknown type 'FactSheet'*,
 * taking the whole export with it.
 */
const COMMON = `
      id type name displayName description updatedAt
      tags { name }
      subscriptions { edges { node { user { email } roles { name } } } }`;

/** Used only when introspection is unavailable: the common fields, and no per-type detail. */
const FALLBACK_PAGE = `
query Page($first: Int!, $after: String) {
  allFactSheets(first: $first, after: $after) {
    totalCount
    pageInfo { hasNextPage endCursor }
    edges { node {${COMMON} } }
  }
}`;

/* -------------------------------------------------------------------------------------------- */
/* Asking the workspace what it is shaped like                                                     */
/* -------------------------------------------------------------------------------------------- */

/** One concrete fact sheet type, and what can be read off it. */
export interface TypeShape {
  name: string;
  /** Scalar and enum fields particular to this type — `lifecycle`, `businessCriticality`, … */
  fields: string[];
  /** Relation fields, each a connection to other fact sheets. Named per pair of types. */
  relations: string[];
}

const INTROSPECT = `
query Shape {
  __type(name: "BaseFactSheet") { possibleTypes { name } }
}`;

const TYPE_FIELDS = `
query Fields($name: String!) {
  __type(name: $name) {
    fields { name type { kind name ofType { kind name ofType { kind name } } } }
  }
}`;

interface TypeRef { kind: string; name: string | null; ofType?: TypeRef | null }

/** Peel NON_NULL and LIST wrappers off to get at what a field really is. */
function unwrap(t: TypeRef | null | undefined): TypeRef | null {
  let at = t ?? null;
  while (at && (at.kind === "NON_NULL" || at.kind === "LIST")) at = at.ofType ?? null;
  return at;
}

/**
 * Ask the workspace what its fact sheet types are and what each one carries.
 *
 * Every LeanIX tenant configures its own metamodel, so a hard-coded field list is right for one
 * workspace and wrong for the next — which is the whole reason this is a configurable product.
 * The comment above the old query said exactly this and the code did not do it; the query asked
 * for two generic relation fields that do not exist on the interface, so every relation in a
 * real workspace was silently lost.
 *
 * Returns an empty list when introspection is refused, and the caller falls back to the common
 * fields. A workspace that will not describe itself is still worth reading.
 */
export async function discoverShape(opts: LeanIxOptions, bearer: string): Promise<TypeShape[]> {
  let names: string[];
  try {
    const base = await graphql<{ __type: { possibleTypes: Array<{ name: string }> } | null }>(opts, bearer, INTROSPECT, {});
    names = (base.__type?.possibleTypes ?? []).map((t) => t.name).filter(Boolean);
  } catch {
    return [];
  }
  if (!names.length) return [];

  const shapes: TypeShape[] = [];
  for (const name of names) {
    try {
      const one = await graphql<{ __type: { fields: Array<{ name: string; type: TypeRef }> } | null }>(
        opts, bearer, TYPE_FIELDS, { name },
      );
      const fields: string[] = [];
      const relations: string[] = [];
      for (const f of one.__type?.fields ?? []) {
        const target = unwrap(f.type);
        if (!target) continue;
        // A relation is a connection; everything else worth reading is a scalar or an enum.
        if (target.kind === "OBJECT" && target.name?.endsWith("Connection") && f.name.startsWith("rel")) {
          relations.push(f.name);
        } else if ((target.kind === "SCALAR" || target.kind === "ENUM") && !COMMON.includes(` ${f.name} `)) {
          fields.push(f.name);
        }
      }
      shapes.push({ name, fields, relations });
    } catch {
      // One type refusing to describe itself is not a reason to lose the other twelve.
      shapes.push({ name, fields: [], relations: [] });
    }
  }
  return shapes;
}

/** Separates the type from the field in an alias. Two underscores, so a field with one is safe. */
const ALIAS = "__";

/** The field name behind an alias, or the name itself when it is not one. */
export function unalias(key: string): string {
  const at = key.indexOf(ALIAS);
  return at > 0 ? key.slice(at + ALIAS.length) : key;
}

/**
 * The page query for a workspace of this shape: common fields, then each type's own.
 *
 * **Every per-type field is aliased with its type.** GraphQL refuses a query where two fragments
 * select the same field name and the two return different types — and LeanIX does this
 * constantly, because `technicalSuitability` on an Application is an
 * `ApplicationTechnicalSuitability` and on an IT Component an `ITComponentTechnicalSuitability`.
 * Three such conflicts were enough to reject the entire export. An alias per type sidesteps all
 * of them at once, and `unalias` puts the plain name back on the way out.
 */
export function pageQuery(shapes: TypeShape[]): string {
  const fragments = shapes
    .filter((t) => t.fields.length)
    .map((t) => {
      const picks = t.fields.map((f) => `${t.name}${ALIAS}${f}: ${f}`).join(" ");
      return `      ...on ${t.name} { ${picks} }`;
    })
    .join("\n");
  return `
query Page($first: Int!, $after: String) {
  allFactSheets(first: $first, after: $after) {
    totalCount
    pageInfo { hasNextPage endCursor }
    edges { node {${COMMON}
${fragments}
    } }
  }
}`;
}

/**
 * The relations query for a workspace of this shape.
 *
 * Relation fields are named after the pair of types they join — `relApplicationToITComponent`,
 * `relApplicationToBusinessCapability` — so they only exist inside a fragment on the concrete
 * type. The field name is kept as the relation's kind: it is what the workspace calls it, and
 * `readableRelation` turns it into English for the import.
 */
export function relationsQuery(shapes: TypeShape[]): string {
  const fragments = shapes
    .filter((t) => t.relations.length)
    .map((t) => {
      // Aliased for the same reason as the fields: the same relation name on two types is two
      // different connection types, and GraphQL will not have it.
      const picks = t.relations
        .map((r) => `${t.name}${ALIAS}${r}: ${r} { edges { node { factSheet { id } } } }`)
        .join(" ");
      return `      ...on ${t.name} { ${picks} }`;
    })
    .join("\n");
  return `
query Rels($first: Int!, $after: String) {
  allFactSheets(first: $first, after: $after) {
    pageInfo { hasNextPage endCursor }
    edges { node {
      id
${fragments}
    } }
  }
}`;
}

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
    // Per-type fields arrive aliased as `Application__lifecycle`; the estate calls it lifecycle.
    const key = unalias(k);
    if (known.has(key)) continue;
    const value = str(v);
    if (value) fields[key] = value;
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


/* -------------------------------------------------------------------------------------------- */
/* The same edge, twice                                                                            */
/* -------------------------------------------------------------------------------------------- */

/**
 * LeanIX exposes every relation from both ends, under two names.
 *
 * `relToChild` on a capability and `relToParent` on its child are the same edge; so are
 * `relApplicationToBusinessCapability` and `relBusinessCapabilityToApplication`. On Energinet's
 * workspace that is 1,242 rows describing 621 relations, and importing all of them would put
 * every connection into the graph twice — visible immediately as doubled degrees in the
 * explorer and doubled counts on every triple in the meta-model.
 *
 * The pairs are recognisable from the names, which is fortunate, because nothing in the payload
 * says "this is the inverse of that".
 */
const INVERSES: Array<[string, string]> = [
  ["relToChild", "relToParent"],
  ["relToPredecessor", "relToSuccessor"],
  ["relToRequires", "relToRequiredBy"],
];

/** `relApplicationToBusinessCapability` → `relBusinessCapabilityToApplication`, or null. */
export function inverseName(name: string): string | null {
  for (const [a, b] of INVERSES) {
    if (name === a) return b;
    if (name === b) return a;
  }
  const m = /^rel([A-Z][A-Za-z0-9]*?)To([A-Z][A-Za-z0-9]*)$/.exec(name);
  return m ? `rel${m[2]}To${m[1]}` : null;
}

/**
 * One row per edge, keeping the direction whose name sorts first.
 *
 * Sorting is arbitrary but it has to be *stable*: the same export must produce the same
 * direction every time, or a re-import looks like every relation was reversed. Where a relation
 * has no recognisable inverse it is kept as it is — losing a real edge is far worse than
 * keeping a duplicate.
 */
export function dedupeRelations(relations: FactSheetRelation[]): FactSheetRelation[] {
  const seen = new Set<string>();
  const out: FactSheetRelation[] = [];
  for (const r of relations) {
    const inverse = inverseName(r.type);
    if (!inverse) {
      const key = `${r.fromId}|${r.type}|${r.toId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
      continue;
    }
    // The two descriptions of one edge, reduced to the same key.
    const forward = r.type <= inverse;
    const key = forward ? `${r.fromId}|${r.type}|${r.toId}` : `${r.toId}|${inverse}|${r.fromId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(forward ? r : { ...r, fromId: r.toId, toId: r.fromId, type: inverse });
  }
  return out;
}

/** Page through everything, refusing to loop if the cursor stops moving. */
export async function fetchAll(opts: LeanIxOptions): Promise<LeanIxExport> {
  const log = opts.log ?? (() => {});
  const pageSize = opts.pageSize ?? 100;
  const maxPages = opts.maxPages ?? 500;
  const bearer = await authenticate(opts);
  log(`authenticated against ${opts.host}`);

  /*
   * Ask the workspace what it is shaped like before reading it. Every tenant configures its own
   * metamodel: the types, their fields, and the relation fields named after each pair of types.
   * Without this the export gets the half-dozen fields common to everything and none of the
   * relations, which is not an import of an estate — it is a list of names.
   */
  const shapes = await discoverShape(opts, bearer);
  const pageQ = shapes.length ? pageQuery(shapes) : FALLBACK_PAGE;
  const rels = shapes.length ? relationsQuery(shapes) : "";
  log(
    shapes.length
      ? `the workspace describes ${shapes.length} fact sheet types, `
        + `${shapes.reduce((n, t) => n + t.fields.length, 0)} type-specific fields and `
        + `${shapes.reduce((n, t) => n + t.relations.length, 0)} relation fields`
      : "the workspace would not describe itself; reading the common fields only",
  );

  const factSheets: FactSheet[] = [];
  const relations: FactSheetRelation[] = [];
  const seenCursors = new Set<string>();
  let after: string | null = null;

  for (let page = 0; page < maxPages; page++) {
    const data: PageResult = await graphql<PageResult>(opts, bearer, pageQ, { first: pageSize, after });
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
  const relationFields = new Set(shapes.flatMap((t) => t.relations));
  if (rels) {
    for (let n = 0; n < maxPages; n++) {
      let data: { allFactSheets: PageResult["allFactSheets"] };
      try {
        data = await graphql(opts, bearer, rels, { first: pageSize, after });
      } catch (e) {
        log(`relations pass stopped: ${e instanceof Error ? e.message : String(e)}`);
        break;
      }
      const conn = data.allFactSheets;
      for (const edge of conn.edges) {
        const node = edge.node as PageNode & Record<string, { edges?: Array<{ node?: { factSheet?: { id?: string } } }> }>;
        for (const [key, value] of Object.entries(node)) {
          if (key === "id" || !value || typeof value !== "object") continue;
          const kind = unalias(key);
          if (!relationFields.has(kind)) continue;
          for (const e of (value as { edges?: Array<{ node?: { factSheet?: { id?: string } } }> }).edges ?? []) {
            const otherId = e?.node?.factSheet?.id;
            if (otherId) relations.push({ fromId: node.id, toId: otherId, type: kind, fields: {} });
          }
        }
      }
      log(`relations page ${n + 1}: ${relations.length} so far`);
      if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor || seenCursors.has(conn.pageInfo.endCursor)) break;
      seenCursors.add(conn.pageInfo.endCursor);
      after = conn.pageInfo.endCursor;
    }
  }

  const unique = dedupeRelations(relations);
  if (unique.length !== relations.length) {
    log(`${relations.length} relation rows describe ${unique.length} edges — the rest are the same edges seen from the other end`);
  }
  relations.length = 0;
  relations.push(...unique);

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
