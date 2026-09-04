# Nexus — Product Brief (living document)

> **Status:** living document. This file is the single source of truth for what Nexus
> is, why it exists, what has been built and what comes next. Every agent and every
> contributor reads it before working and updates it after adding or changing
> functionality. See `CLAUDE.md` for the update rules.

Last updated: 2026-09-04

---

## 1. The idea in one paragraph

Classic enterprise architecture (EA) tooling — LeanIX, Ardoq, Sparx, BiZZdesign and
their kin — starts from a **predefined meta-model**. You get a repository, a fixed set
of object types, fact sheets for everything and a library of reports, and your job is
to squeeze the organisation into that model. Nexus turns this upside down. You feed
Nexus **everything the organisation has** — structured and unstructured — and Nexus'
agents **discover the meta-model from the data**. Each organisation ends up with its
own model, grown from its own reality rather than imposed by a vendor. Every piece of
that model is touchable on an **infinite, Mural-like canvas** where people and agents
work side by side: exploring, extending, annotating and reshaping the graph.

## 2. Vision and principles

### 2.1 Data in: anything, from anywhere

Nexus must be able to ingest whatever an organisation can point it at:

- Application portfolios, process models, capability maps.
- Ticketing / CMDB sources such as ServiceNow.
- OT databases and industrial systems.
- Knowledge bases, wikis, document stores.
- Deep, domain-specific graph data (construction, manufacturing, energy grids …).
- Unstructured signals: meeting notes, transcripts, e-mails, chat.

Every source is a **connector**. Connectors normalise data into a common ingestion
format; they never decide what the data *means*.

### 2.2 The agents build the meta-model

The heart of Nexus is a set of AI agents that watch incoming data and:

1. **Classify** what kind of things and relationships are arriving.
2. **Propose** entity types, attributes and relationship types — a meta-model that
   emerges bottom-up and is unique to each organisation.
3. **Link** records across sources (the ServiceNow CI, the mention in a meeting, the
   node in the process model are the same application).
4. **Enrich** the graph with metadata and confidence scores, and explain their
   reasoning so humans can accept, correct or reject.

The meta-model is never frozen: it keeps evolving as new data arrives and as people
work on the canvas.

### 2.3 Everything is a graph, everything is touchable

All data in Nexus lives in one organisation-wide **knowledge graph**. The canvas is a
window onto that graph. Anything on the canvas can be selected, opened, extended,
annotated and connected. Metadata can be added by people or by agents, and both are
first-class.

### 2.4 The canvas is the workspace

Not a report, not a fact sheet — an **infinite canvas** with best-in-class navigation
(pan, zoom, minimap, keyboard, fit-to-content), where users can:

- Load and unload **optics** (lenses/views) onto the canvas: capability view, data
  flow view, risk overlay, ownership overlay, time slices …
- Structure freely: frames, stickies, notes, shapes and connectors next to graph
  nodes. Whiteboard freedom and repository rigour on the same surface.
- Work together: boards are shared spaces for teams (real-time collaboration is on
  the roadmap).

### 2.5 Delivery model

- **SaaS first**: multi-tenant web application.
- **Sovereign later**: the same product deployable inside an organisation's own
  environment (on-prem / private cloud) for organisations that cannot send data out.
  Architecture decisions must keep this door open (no hard dependency on a single
  cloud vendor's proprietary services in the core).

## 3. Management structure (Mural-like)

Nexus borrows the organisational structure that works in Mural:

| Concept | Meaning |
|---|---|
| **Workspace** | The tenant: one organisation. Owns members, teams, rooms and boards. |
| **Team** | A group of people inside the workspace (e.g. "Grid Architecture"). Rooms can belong to a team. |
| **Room** | A group of boards around a topic or initiative. Can be open to the workspace or private to a team. |
| **Board** | One infinite canvas. Lives in exactly one room. |

Cross-cutting: favourites, recently opened, search. The workspace home is the entry
point; from there users dive into rooms and open boards.

## 4. Scope of the first brief (this iteration)

The first brief asks for the **foundation**:

1. The living brief (this document) and agent instructions.
2. A web app with the Mural-like management structure: workspace home, teams, rooms
   (groups of boards), boards.
3. An infinite canvas with extremely good navigation and the basic whiteboard toolkit,
   built so that graph nodes and optics can be layered on top later.

Ingestion, agents and the emergent meta-model come in later briefs, but the data model
and canvas are designed with them in mind (see §6 and §8).

## 5. Architecture

### 5.1 Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript strict | One codebase for UI and API, server components for management pages, great deployment story for SaaS. |
| Styling | Tailwind CSS v4 | Fast iteration, design tokens in CSS variables. |
| State (canvas) | Zustand | Tiny, fast, selector-based re-rendering — right for a canvas with many elements. |
| Persistence | Drizzle ORM + SQLite (libsql) in dev; Postgres target for SaaS | Zero-setup local development; Drizzle keeps the schema portable to Postgres. |
| Monorepo | pnpm workspaces (`apps/*`, `packages/*`) | Room to split out the canvas core, meta-model and connectors as packages. |
| Testing | Vitest (unit) + Playwright (e2e/smoke) | Geometry and store logic are pure and unit-testable; the canvas gets browser smoke tests. |

### 5.2 Repository layout

```
nexus/
├─ CLAUDE.md / AGENTS.md      agent instructions (read the brief, update the brief)
├─ docs/BRIEF.md              this document
├─ apps/web/                  the web application
│  ├─ src/app/                routes: workspace home, rooms, boards, API
│  ├─ src/canvas/             infinite-canvas engine
│  ├─ src/db/                 Drizzle schema, client, migrations, seed
│  └─ src/components/         shared UI
└─ packages/                  (reserved) canvas-core, meta-model, connectors
```

### 5.3 Canvas engine design

- **Two coordinate spaces.** The *document* is in world coordinates. The *camera*
  (`x`, `y`, `zoom`) maps world to screen. Elements are rendered inside a single
  CSS-transformed layer; selection handles and overlays are rendered in screen space so
  they stay crisp at any zoom.
- **Elements** are a discriminated union: `sticky`, `text`, `shape` (rect/ellipse),
  `frame`, `connector`. Every element carries an `id`, geometry, style and an open
  `meta` bag so graph-backed nodes can later attach entity references.
- **Connectors** reference element ids (or free points) and are re-routed on every
  move. Rendered in an SVG layer inside the world transform.
- **Interaction** is a small state machine driven by pointer events on the root
  (`idle → pan | marquee | move | resize | draw | connect | edit`). Tools: select,
  hand, sticky, text, rectangle, ellipse, frame, connector.
- **Navigation.** Trackpad two-finger scroll pans; ctrl/⌘ + wheel or pinch zooms
  around the cursor; space + drag, middle-mouse and the hand tool pan; zoom-to-fit,
  zoom-to-selection, 100 %; keyboard shortcuts; minimap with draggable viewport.
- **History.** Snapshot-based undo/redo on committed operations (not on every mouse
  move).
- **Persistence.** The board document is versioned JSON (`{ version, elements }`),
  autosaved to the server with a debounce; save state is visible in the UI.
- **Performance.** Off-screen elements are culled; per-element subscriptions keep
  re-renders local.

### 5.4 Data model (v0.1)

```
users            id, name, email, color
workspaces       id, slug, name
workspace_members workspace_id, user_id, role
teams            id, workspace_id, slug, name, color, description
team_members     team_id, user_id, role
rooms            id, workspace_id, team_id?, name, description, emoji, visibility
boards           id, workspace_id, room_id, name, description, document(json), created_by,
                 created_at, updated_at, last_opened_at
board_favorites  user_id, board_id
```

Authentication is **not** part of the first brief: the app runs as a seeded demo user
inside a seeded demo workspace. Auth (SSO/OIDC for enterprises) is on the roadmap and
the schema already separates users, memberships and roles.

## 6. Roadmap

### Now (brief 1 — foundation) — done, see §6a
- [x] Living brief + agent instructions.
- [x] Workspace home with teams, rooms and boards (create, rename, favourite, recent).
- [x] Infinite canvas: navigation, minimap, tools, selection, move/resize, inline text,
      connectors, frames, undo/redo, copy/paste, autosave.

### Next (brief 2+ — candidates, to be confirmed by the product owner)
- Real-time multiplayer on boards (presence, cursors, CRDT/OT).
- Authentication and enterprise SSO; roles and permissions per team/room/board.
- Graph core: entity + relationship store behind the canvas; canvas elements that are
  *views* of graph nodes.
- Optics: load/unload lenses (capability view, data-flow view, overlays).
- Connectors framework and first sources (file import, ServiceNow, CMDB, wiki).
- Agent framework: classification, meta-model proposal, entity resolution, enrichment,
  with human review queue.
- Search across boards and the graph.
- Board templates; export (PNG/PDF); comments.
- Sovereign deployment package (containers, Postgres, object storage, model gateway).

## 6a. What exists today (v0.1, 2026-09-04)

### Management structure
- **Workspace home** (`/w/[slug]`): greeting, recently edited boards, room cards.
- **Rooms** (`/w/[slug]/rooms`, `/rooms/[roomId]`): create (icon, name, description, team,
  open/private), rename inline, settings (description, team, visibility, delete), board
  grid with "New board" tile.
- **Boards**: create, rename (card menu or board header), duplicate, delete, favourite,
  "Recent" (by last opened) and "Favourites" pages, SVG thumbnails rendered from the
  document.
- **Teams** (`/w/[slug]/teams`, `/teams/[teamId]`): create with colour, rename inline,
  add/remove members from the workspace, delete; team page lists its rooms.
- **Sidebar**: Home / Recent / Favourites, favourite boards, teams, rooms, current user.
- Seeded demo tenant "Acme Energy" (an energy-grid operator): 4 users, 3 teams, 4 rooms,
  5 boards including a capability map, an integration overview and a roadmap.

### Canvas engine (`apps/web/src/canvas`)
| Area | Delivered |
|---|---|
| Navigation | Wheel/two-finger pan, ⌘/ctrl+wheel and pinch zoom at cursor, space+drag / middle-mouse / hand-tool pan, zoom in/out/100 %/fit/selection, adaptive dot grid, minimap with click-and-drag viewport, scroll-mode toggle (trackpad pans vs mouse zooms, remembered per browser). |
| Elements | Sticky (auto-fit text, 8 colours), text (size, alignment), shape (rect / ellipse / diamond, fill), frame (title, colour; moving a frame carries the elements inside it), connector (element-to-element or free end, label, solid/dashed, arrows either end, re-routed live). |
| Editing | Click / shift-click / marquee selection (frames need full enclosure), drag-move, 8-handle resize (shift keeps aspect), inline text editing (double-click or Enter; double-click on empty canvas creates a sticky), floating property bar per selection type, lock, bring-to-front / send-to-back, nudge with arrows, duplicate, copy/cut/paste (internal clipboard + system clipboard JSON), delete (connectors follow their elements), undo/redo (snapshot history of committed operations). |
| Persistence | Versioned JSON document (`{ version: 1, elements }`) per board; debounced autosave (`PUT /api/boards/[id]`) with saved/saving/error indicator; flush on tab hide and unload. |
| Performance | Off-screen culling of box elements; per-element store subscriptions; `overflow: clip` root so nothing can scroll the canvas surface. |
| Help | Keyboard-shortcut panel in the board header. |

### Quality gates
- `pnpm typecheck`, `pnpm lint` (Next + TypeScript ESLint), `pnpm test` (Vitest: camera
  math, box/resize/connector geometry, store history and frame behaviour).
- `pnpm e2e` (Playwright, needs a running dev server): drives the real browser through
  the workspace pages and the canvas — create sticky, type, drag, zoom, pan, fit, delete,
  undo, draw rectangle, draw connector, autosave, reload, create board.

### Known gaps (intentional for brief 1)
- No authentication or authorisation; everyone is the seeded demo user.
- Single workspace; no multiplayer; no comments; no export; no search.
- Connectors are straight lines; no orthogonal routing yet.
- SQLite only; Postgres wiring is a config change but not yet exercised.
- Next.js 16 dev server (Turbopack) occasionally panics on first compile of a route;
  `rm -rf apps/web/.next` and restart fixes it. Not seen in production builds.

## 6b. Running it

```bash
pnpm install
pnpm dev            # http://localhost:3000 → redirects to /w/acme-energy
pnpm typecheck && pnpm lint && pnpm test
pnpm e2e            # in a second terminal, against the running dev server
pnpm build && pnpm start
```

The SQLite file lives in `apps/web/data/nexus.db` (git-ignored). Migrations in
`apps/web/drizzle` run automatically on first request; the demo seed runs when the
database is empty. Delete the file to reset. Schema changes: edit
`apps/web/src/db/schema.ts`, then `pnpm db:generate`.

## 7. Decision log

| Date | Decision | Reasoning |
|---|---|---|
| 2026-09-04 | Build our own canvas engine instead of adopting tldraw / React Flow. | The canvas is the product. We need full control over rendering graph nodes, optics and agent overlays; libraries optimise for whiteboards or node-graphs, not both, and licensing (tldraw) is a constraint for SaaS. |
| 2026-09-04 | Drizzle + SQLite in dev, Postgres as the SaaS target. | Zero-setup local dev; Drizzle keeps SQL portable. The graph store (later) may add a dedicated graph engine or Postgres extensions. |
| 2026-09-04 | No auth in brief 1; seeded demo user/workspace. | Focus on canvas and structure. Schema keeps users/memberships/roles so auth slots in without a migration of intent. |
| 2026-09-04 | Mural vocabulary: Workspace → Team / Room → Board. | Familiar to the target users; matches the requested management structure. |
| 2026-09-04 | Connectors render above all elements. | Labels and arrowheads must stay readable; connectors attach to element borders so they rarely obscure content. |
| 2026-09-04 | Canvas root uses `overflow: clip`, not `hidden`. | `hidden` containers can still be scrolled by `focus()`/`scrollIntoView`, which shifted the whole UI during testing. |
| 2026-09-04 | Tools revert to *select* after one use, except *hand* and *connector*. | Matches Mural/Figma muscle memory; connectors are usually drawn in batches. |

## 8. Open questions for the product owner

- Which first data source should the ingestion work start with (ServiceNow? file
  import? a process-modelling tool)?
- Should optics be user-authored (query + layout), agent-suggested, or both?
- Real-time collaboration: how early is it needed relative to ingestion and agents?
- Sovereign deployment: which model providers must be supported locally?

## 9. Changelog

- **2026-09-04 — Brief 1 kick-off.** Captured the vision (agent-built meta-model,
  everything-is-a-graph, infinite canvas, SaaS first / sovereign later). Set up the pnpm
  monorepo, Next.js 16 web app, Drizzle/SQLite persistence with seed data, the
  Mural-like management structure (workspace home, teams, rooms, boards) and the first
  version of the infinite-canvas engine (navigation, minimap, tools, selection,
  move/resize, inline text editing, connectors, frames, undo/redo, copy/paste,
  autosave).
