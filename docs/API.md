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
| GET | `/api/boards/:boardId/versions` | — | `{ versions: VersionSummary[] }` newest first. |
| POST | `/api/boards/:boardId/versions` | `{ label?, document? }` | `{ id, versions }` — manual checkpoint of the given document (or the stored one). |
| GET | `/api/boards/:boardId/versions/:versionId` | — | `{ document }` — the checkpointed document (used by *Compare*). |
| POST | `/api/boards/:boardId/versions/:versionId/restore` | — | `{ document, revision, versions }` — checkpoints the current state ("Before restore …"), then replaces the board document. |

Auto checkpoints are taken at most every 10 minutes while editing and pruned to the last 30;
manual and pre-restore checkpoints are kept.

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
minted on the client and upserted by the server on save. Add a migration in `document.ts` when
the shape changes.
