# Nexus — HTTP API and server actions

This is the contract between the browser client (canvas, home shell, Knowledge graph page) and
the server. Everything is JSON. There is no authentication yet (brief 1, see `docs/BRIEF.md` §7);
every route acts as the seeded demo user.

Shapes referenced below live in `apps/web/src/lib/graph-types.ts` (graph) and
`apps/web/src/canvas/document.ts` (board documents, `CanvasDocument` v2).

## Boards

| Method | Route | Body | Returns |
|---|---|---|---|
| GET | `/api/boards/:boardId` | — | `{ id, name, updatedAt, revision, document }` — the stored document **hydrated** from the graph (card kind / title / description / attributes and connector labels refreshed from their entities). |
| PUT | `/api/boards/:boardId` | `{ document: CanvasDocument, revision?: number }` | `{ ok: true, updatedAt, revision }`. Migrates older document versions, takes a time-based auto checkpoint of the previous state, saves, then **syncs the board into the graph** (cards → entities, connectors between cards → relations, `board_entities` membership). When `revision` is sent the write is conditional on it: a client that missed somebody else's save gets **409** `{ error, conflict: true, revision }` and must reload. Omitting it keeps last-writer-wins. |

The client autosaves with a debounce and flushes on tab hide / unload (`useAutosave`).

## Board versions

| Method | Route | Body | Returns |
|---|---|---|---|
| GET | `/api/change-sets?workspaceId=…` | — | `{ changeSets: [{ id, name, status, targetDate }] }` — enough to fill the board's state picker. |
| GET | `/api/change-sets/:id/overlay` | — | A change set resolved against the graph: `{ name, targetDate, retired[], changed[], added[], problems, impact }`. Entity ids and a sentence, not a graph: the board already holds the cards. |
| GET | `/api/plateaus?workspaceId=…` | — | `{ plateaus: [{ id, name, targetDate }] }`. |
| GET | `/api/plateaus/:id/overlay` | — | A named state resolved against the graph, in the same shape as a change set's overlay, so the canvas has one path for "show me the board at a state". |
| GET | `/api/knowledge` | — | The corpus: `{ builtAt, documents, registered, passages, characters, licenses, lessons }`. |
| GET | `/api/knowledge?q=…&limit=n` | — | Lexical search over the EA corpus: `{ query, empty, tookMs, unknownTerms, passages[] }`, each passage carrying its label, source link and licence. Works with no model API key. |
| GET | `/api/boards/:boardId/versions` | — | `{ versions: VersionSummary[] }` newest first. |
| POST | `/api/boards/:boardId/versions` | `{ label?, document? }` | `{ id, versions }` — manual checkpoint of the given document (or the stored one). |
| GET | `/api/boards/:boardId/versions/:versionId` | — | `{ document }` — the checkpointed document (used by *Compare*). |
| POST | `/api/boards/:boardId/versions/:versionId/restore` | — | `{ document, revision, versions }` — checkpoints the current state ("Before restore …"), then replaces the board document. |

Auto checkpoints are taken at most every 10 minutes while editing and pruned to the last 30;
manual and pre-restore checkpoints are kept.

## Live boards (`/api/boards/:boardId/live`)

Two people on one board (§5.40). Server-sent events down, ordinary POSTs up — no WebSocket, so
nothing in front of the app has to carry an upgrade.

| Method | Body | Returns |
|---|---|---|
| GET | — | `text/event-stream`. First an `event: peer` frame carrying `{ peerId }`, then a `hello` (`{ seq, elements, peers }`), then `patch` (`{ seq, from, patch }`), `presence` (`{ peers }`) and `resync` (`{ seq, elements }`) messages until the connection closes. A comment line every 25s keeps proxies from calling it idle. |
| POST | `{ kind: "patch", patch }`, `{ kind: "doc", parts }` or `{ kind: "presence", cursor?, selection?, editing? }`, with the peer id in `x-nexus-peer` | `204`, or `409 { reconnect: true }` when that peer has no open stream. |

A `patch` is `{ upsert?: { [id]: element }, remove?: id[] }` — whole elements, so per-element
last-writer-wins is exact. The server applies patches in arrival order, numbers each one, relays it
to everybody except the sender, and writes the board down once it goes quiet, through the same save
path a `PUT` takes. While a board is live its clients do not `PUT`; a `PUT` that arrives anyway
(an old client, a blocked stream, a script) is relayed to them as a `resync`.

`parts` carries the document's non-element halves — `viewpoints` and `script` — whole-value rather
than as a delta, because a list of saved views and a block of prose have no useful finer grain.
They need their own message: while a board is live the client has stopped PUTing, so a viewpoint
saved during the session would otherwise never be written down.

Presence is never persisted: `cursor` is in world coordinates, `editing` is the element whose text
that person has focused, and everything they hold disappears when their stream closes.

## Knowledge graph

| Method | Route | Body | Returns |
|---|---|---|---|
| GET | `/api/workspaces/:workspaceId/graph` | — | `GraphSnapshot` — `entities[]` (with attributes, board and relation counts), `kinds[]` (count, colour, emergent attribute schema per kind), `relationKinds[]`. |
| GET | `/api/workspaces/:workspaceId/proposals` | — | `Proposal[]` — deterministic agent proposals (merge duplicates, kind variants, untyped, unlabelled relations, orphans, attribute key / value variants, missing attributes). |
| GET | `/api/graph/entities/:entityId` | — | `EntityDetail` — entity, the kind's attribute keys, boards it is on, relations (with the other end), duplicate candidates. |
| POST | `/api/graph/neighborhood` | `{ workspaceId, entityIds[], depth (0–3), direction ("both" \| "out" \| "in"), relationKinds? }` | `{ entities[], relations[] }` — the N-hop neighbourhood used by *Expand selection* and *Show all relations*. |
| POST | `/api/graph/query` | `{ workspaceId, q }` | `QueryResponse` — `{ query (parsed), explanation, entities[] (each with a "why"), total }`. |

### Query language (`q`)

```
kind:Application criticality:high        kinds and attribute values (prefix / substring, case-insensitive)
owner:"Grid Operations"                  quote values with spaces
related:Maximo  from:"Data Lake"  to:SAP  1-hop neighbours (any / outbound / inbound)
rel:"meter data"                         restrict related:/from:/to: to a relation type
has:owner   missing:lifecycle            attribute present / absent (aliases: without:, no:)
on:"Application landscape"               placed on a board whose name contains the text
billing                                  free text over name, description, attribute values
```

Clauses combine with AND. `?` at the start is ignored so questions can be typed naturally.

## MCP (`POST /api/mcp`)

Nexus is a Model Context Protocol server (§5.33). JSON-RPC 2.0 over one POST; a key in
`Authorization: Bearer nxs_…` decides which workspace is being asked and what the caller may do.
`GET` on the same URL describes the server rather than opening a stream.

| Method | Answer |
|---|---|
| `initialize` | Protocol version (the client's, if we know it), `tools` capability, server info, and instructions naming the workspace |
| `tools/list` | The tools this key may call — a read key does not see `propose_change` |
| `tools/call` | `search_model`, `describe_object`, `what_depends_on`, `list_kinds`, `estate_health`, `propose_change` |
| `ping` | `{}` |
| `notifications/*` | 202 with no body |

`search_model` takes the same query language as the command bar and, with `format: "table"`, answers
as TSV — a header line and one row per object — so the caller (Nexus itself included) can stage the
answer as an import batch rather than re-parsing prose.

No tool changes the model. `propose_change` is validated exactly as the graph agent's proposals are
— the closed list of five changes, ids checked, every claim quoting the object it names — and what
survives waits in the review queue under the name of the key that sent it.

## Server actions (`apps/web/src/lib/actions.ts`)

Mutations from the home shell and the Knowledge graph page are Next.js server actions rather
than routes; they revalidate the affected pages.

| Area | Actions |
|---|---|
| Spaces | `createSpace`, `renameSpace`, `updateSpace`, `deleteSpace` |
| Boards | `createBoard` (optionally from a template), `renameBoard`, `moveBoard`, `updateBoardDescription`, `deleteBoard`, `duplicateBoard`, `toggleFavorite`, `markBoardOpened`, `createBoardFromGraph` |
| Teams | `createTeam`, `renameTeam`, `setTeamMembership`, `deleteTeam` |
| Graph | `importGraphText` (CSV / JSON, see below), `renameKind`, `renameRelationKind`, `updateEntity`, `setEntityAttributeAction` (empty value removes), `deleteEntity`, `mergeEntitiesAction` |
| Proposals | `acceptProposal` (applies the proposal's action, with an optional override value), `dismissProposal` (remembered per proposal key) |
| Models | `addProvider`, `updateProvider` (a new key resets the last check), `removeProvider`, `assignTask` (which provider and model id does which job), `checkProvider` (a real one-token call), `modelSettings` (everything the settings page needs; no key is ever returned) |
| Import | `createBatch` (FormData with many files; tables are read, folded and staged, prose is read for claims through intake's extractor and folded into the same records, and nothing is written), `createPastedBatch` (a pasted block, shape sniffed from the content), `stageFromServer` (rows a connected MCP server answered), `remapBatch` (change a column's meaning, what a file's rows are, the trust order, or whether people are included), `decideRows` (accept / hold / reject), `approveBatch` (the one call that writes, recording what it wrote), `rollbackBatch` (reverts only that, and reports what it would not touch), `createBatchBoard` (the batch's working surface; one per batch), `redrawBatchBoard`, `deleteBatch`. Saving a staged board reconciles it into the batch — the lanes are the decision (§5.36) |
| Connections (MCP, outbound) | `addServer`, `updateServer`, `removeServer`, `checkServer` (handshake and list its tools), `askServer` (call one tool, return its text), `keepAsSource` (that text becomes an intake source — never a change to the model), `listServers` |
| Connections (MCP) | `issueKey` (returns the key once — nothing else ever can), `revokeKey`, `forgetKey`, `connectionSettings` |
| Described agents | `suggestAgents` (an agent proposes agents, capped by its own verbs and budget), `approveAgent` (proposed → draft), `createAgent` (always saved as a draft), `updateAgent`, `setAgentStatus` (draft / active / paused / retired), `removeAgent`, `runAgent` (refused before it costs anything when paused, retired or over budget; a draft runs as a dry run), `scopeSize` (how much a scope query would read) |
| Agent | `askTheAgent` (a model reads the graph and proposes corrections into the review queue; returns what survived checking and what was thrown away), `forgetAgentRun` |
| Board agents | `wakeBoardAgent` (an agent on a board reads its scope and returns remarks, each quoting the object it is about), `askAboutSelection` (prose plus checked citations for a set of selected objects), `recordRemarkOutcome` (kept / dismissed, so the fleet can measure) |
| Change sets | `createChangeSet`, `updateChangeSet`, `deleteChangeSet`, `addChange`, `removeChange`, `addDependency` / `removeDependency` (cycles refused), `deliverChangeSet` (refused while a blocker is outstanding or a change has gone stale), `createRoadmapBoard` (draws the chosen plans on a new board and redirects to it) |
| Plateaus | `createPlateau`, `updatePlateau`, `deletePlateau`, `includeInPlateau` (pulls in what the plan waits for), `excludeFromPlateau` (refused while something still needs it) |

### Import format

CSV with a header. `kind,name` are required; `description` is optional and, when present, must
be the third column; **every other column is an attribute**. A `# relations` section (or a
second header `from,relation,to`) adds relations; `Kind:Name` disambiguates names.

```
kind,name,description,lifecycle,owner
Application,CRM Cloud,Customer relationship management,active,Customer
Interface,Customer API,REST interface exposed by CRM Cloud,plan,Customer
# relations
from,relation,to
CRM Cloud,provides,Customer API
```

JSON is accepted too: `{ "entities": [{ kind, name, description?, attributes? }], "relations": [{ from, kind, to }] }`.

## Documents

Board documents are versioned JSON: `{ version: 2, elements: { [id]: element }, viewpoints?: SavedViewpoint[] }`.
Element types: `card`, `sticky`, `text`, `shape`, `frame`, `connector` — see `document.ts`.
Cards carry `meta.entityId`, connectors between cards carry `meta.relationId`; those ids are
minted on the client and upserted by the server on save. `meta.planned` marks a card as a drawing
of an intention, which the graph sync must not create. A document may also carry
`meta.importBatch`: after the ordinary sync — which creates nothing, because every staged card is
planned — saving such a board is also reconciled into that batch (lane → decision, edited card →
edited record, connector → relation to create, deleted card → out of the import).

Add a migration in `document.ts` when the shape changes.
