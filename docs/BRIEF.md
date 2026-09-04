# Nexus — Product Brief (living document)

> **Status:** living document. This file is the single source of truth for what Nexus
> is, why it exists, what has been built and what comes next. Every agent and every
> contributor reads it before working and updates it after adding or changing
> functionality. See `CLAUDE.md` for the update rules.

Last updated: 2026-09-04 (rev 4 — agent proposals)

---

## 1. The idea in one paragraph

Classic enterprise architecture (EA) tooling — LeanIX, Ardoq, Sparx, BiZZdesign and
their kin — starts from a **predefined meta-model**. You get a repository, a fixed set
of object types, fact sheets for everything and a library of reports, and your job is
to squeeze the organisation into that model. Nexus turns this upside down. You feed
Nexus **everything the organisation has** — structured and unstructured — and Nexus'
agents **discover the meta-model from the data**. Each organisation ends up with its
own model, grown from its own reality rather than imposed by a vendor. Every piece of
that model is touchable on an **infinite, Miro-like canvas** where people and agents
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

## 3. Management structure (Miro-like)

The reference product for structure is **Miro** (the first brief said Mural by mistake;
corrected 2026-09-04). Miro organises Teams → Spaces → Boards; Nexus adds the tenant
level on top:

| Concept | Meaning |
|---|---|
| **Workspace** | The tenant: one organisation. Owns members, teams, spaces and boards. |
| **Team** | A group of people inside the workspace (e.g. "Grid Architecture"). Spaces can belong to a team. |
| **Space** | A group of boards around a topic or initiative (Miro "Space"). Open to the workspace or private to a team. |
| **Board** | One infinite canvas. Lives in exactly one space; can be moved between spaces. |

Cross-cutting: favourites, recently opened, search. The workspace home is the entry
point; from there users dive into spaces and open boards.

## 4. Scope of the first brief (this iteration)

The first brief asks for the **foundation**:

1. The living brief (this document) and agent instructions.
2. A web app with the Miro-like management structure: workspace home, teams, spaces
   (groups of boards), boards.
3. An infinite canvas with extremely good navigation and the basic whiteboard toolkit,
   built so that graph nodes and optics can be layered on top later.

Ingestion, agents and the emergent meta-model come in later briefs, but the data model
and canvas are designed with them in mind (see §6 and §8).

## 4a. UI/UX reference: LeanFlow Studio

The product owner's earlier repo **`rummand/leanflow-studio`** ("LeanIX Flow Studio", a
local-first Miro-like canvas for LeanIX data) is the **design reference** for Nexus. Its UI
and UX were replicated on 2026-09-04 and Nexus must keep following it:

- **Look**: calm, white, spacious, board-first. Type stack Aptos / IBM Plex Sans; ink
  `#172033`, muted `#657186`, accent blue `#1376d4`, hairlines `#d9e1eb`; translucent
  white floating panels with 13px radius and soft shadows; uppercase, tracked micro-labels
  (10–12px, heavy weight); pill-shaped chips and buttons. Tokens live in
  `apps/web/src/app/globals.css` and mirror LeanFlow's class names (`studio-home-shell`,
  `canvas-toolbar`, `fact-card`, `impact-note`, `board-frame`, `map-card`, `zoom-card` …).
- **Home shell**: 320px sidebar (brand mark, search, Home / Recent / Starred / Teams, SPACES
  and TEAMS lists with hover actions), main column with meta line + big title, "Open last
  board", grid/list toggle, blue "Create new"; "How do you want to start?" search with ⌘K
  keycap; four **starter** cards (templates); "Recent boards" strip; **board browser** rows
  (thumbnail, star glyph, name / description / counts, last opened, space, actions: star,
  rename, move to space, duplicate, delete) with an inline "Move to space" panel.
- **Board shell**: 54px topbar (back, brand mark, board name + breadcrumb, mono canvas
  chip, save pill, Shortcuts, Share, avatar); centred **command bar** (search objects on
  the board, ⌘K; natural-language questions arrive with the agent layer); left **tool
  rail** with mono badges (FRAME, CARD, NOTE, TEXT, SECTION, SHAPE + panel toggles);
  **shape picker** panel (lines: line / arrow / dashed; shapes: rectangle / oval / rhombus);
  draggable **Selection** inspector (LeanFlow "Impact selection": title, kind, detail grid,
  actions; board summary when nothing is selected); **Map overview** card (minimap with
  draggable viewport, readout, "Fit visible board"); **zoom card**; centred status line.
- **Objects**: architecture **cards** (kind row with colour square, title, description),
  **notes** (tinted left border, uppercase label, title + body), **text blocks** and
  **sections** (titled paragraphs), **frames** (translucent, pill titlebar with title /
  #order / Color / Focus / Delete), shapes, connectors with pill labels. Text fields are
  always live — no separate edit mode (shapes keep double-click labelling).
- **Grid**: 80 px major / 20 px minor lines that scale with zoom.

When the reference evolves, port the change here and note it in the changelog.

## 5. Architecture

### 5.1 Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript strict | One codebase for UI and API, server components for management pages, great deployment story for SaaS. |
| Styling | Tailwind CSS v4 | Fast iteration, design tokens in CSS variables. |
| State (canvas) | Zustand | Tiny, fast, selector-based re-rendering — right for a canvas with many elements. |
| Persistence | Drizzle ORM + SQLite (libsql) in dev; Postgres target for SaaS | Zero-setup local development; Drizzle keeps the schema portable to Postgres. |
| Monorepo | pnpm workspaces (`apps/*`, `packages/*`) | Space to split out the canvas core, meta-model and connectors as packages. |
| Testing | Vitest (unit) + Playwright (e2e/smoke) | Geometry and store logic are pure and unit-testable; the canvas gets browser smoke tests. |

### 5.2 Repository layout

```
nexus/
├─ CLAUDE.md / AGENTS.md      agent instructions (read the brief, update the brief)
├─ docs/BRIEF.md              this document
├─ apps/web/                  the web application
│  ├─ src/app/                routes: workspace home, spaces, boards, API
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
- **Elements** are a discriminated union (document v2): `card` (kind, title,
  description — the canvas face of a future graph entity), `sticky` (note: title, body,
  colour), `text` (variant text/section: title, body, colour), `shape` (rect / ellipse /
  diamond), `frame`, `connector`. Every element carries an `id`, geometry, style and an
  open `meta` bag so graph-backed nodes can later attach entity references.
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
- **Persistence.** The board document is versioned JSON (`{ version, elements }`;
  currently v2 with a v1 → v2 migration), autosaved to the server with a debounce; save
  state is visible in the UI.
- **Templates.** `src/canvas/templates.ts` builds starter documents (capability map,
  application landscape, integration flows, roadmap) used by the home starters and the seed.
- **Performance.** Off-screen elements are culled; per-element subscriptions keep
  re-renders local.

### 5.4 Data model (v0.1)

```
users            id, name, email, color
workspaces       id, slug, name
workspace_members workspace_id, user_id, role
teams            id, workspace_id, slug, name, color, description
team_members     team_id, user_id, role
spaces           id, workspace_id, team_id?, name, description, emoji, visibility
boards           id, workspace_id, space_id, name, description, document(json), created_by,
                 created_at, updated_at, last_opened_at
board_favorites  user_id, board_id
```

### 5.5 Knowledge graph core (v0.2)

The graph is workspace-wide; boards are **views** of it.

```
entities        id, workspace_id, kind, name, description, attributes(json), source
relations       id, workspace_id, from_entity_id, to_entity_id, kind, attributes, source
board_entities  board_id, entity_id, element_id      (rebuilt on every save)
```

- Every **card** is graph-backed from birth: `card.meta.entityId` (`ent_…`, generated on
  the client). A **connector** between two entity-backed cards carries
  `meta.relationId` (`rel_…`); its label is the relation kind.
- **Board → graph** (`syncBoardToGraph`, on every save): upsert entities from cards
  (kind, name, description; last write wins), upsert relations from connectors, rebuild
  the board's entity index. Removing a card from a board never deletes the entity — the
  graph outlives boards.
- **Graph → board** (`hydrateDocument`, on every load): cards and relation labels are
  refreshed from the graph, so edits made on other boards or via import show everywhere.
- **Graph inventory** panel on the board (LeanFlow "Factsheet hierarchy"): every entity
  grouped by kind with on-board markers; place one entity or a whole kind as linked cards.
- **Selection inspector** shows graph facts for a card: relations (with direction), the
  other boards it appears on, its source.
- **Knowledge graph page** (`/w/[slug]/graph`): emergent meta-model (kinds with counts and
  colours, relation types), rename a kind (merges vocabularies), entity table with edit /
  delete and board links, **Import data** (CSV `kind,name,description` + `# relations`
  `from,relation,to`, or JSON; matched by kind + name, idempotent, sources recorded), and
  **Lay out on a board** (frames per kind, cards inside, connectors for relations — a
  deterministic preview of "feed data in, get a board").
- Sources are recorded per entity/relation (`canvas`, `import:<name>`); this is the hook
  for connectors and agents (§2.1–2.2).

### 5.6 Agent proposals (v0.2)

The first rung of the agent layer (§2.2). Proposals are computed deterministically from the
graph, explained with evidence, and resolved through one accept / dismiss workflow that
remembers decisions (`agent_decisions`). LLM-backed classifiers will later emit the same
`Proposal` shape, so the UI and the decision memory do not change.

| Rule | Confidence | Accept does |
|---|---|---|
| Same name, same kind (e.g. three "Asset Register") | high | **Merge**: repoint relations (de-duplicated), relink cards in every board document, rebuild the board index, delete the others. Survivor = most relations, then most boards, then oldest. |
| Same name, different kinds | medium | Merge, keeping the survivor's kind. |
| Kind variants (case / plural / whitespace) | high | Rename the minority kind to the majority one. |
| Untyped entity | medium/low | Set a kind (guessed from similarly named entities, editable). |
| Unlabelled relation | medium/low | Label it (suggested from other relations between the same kinds, editable). |
| Orphan (no relations, on no board) | low | Delete the entity. |

Surfaces: the **Agent proposals** section at the top of the Knowledge graph page, and an
"Agent proposal · possible duplicate" block in the board's Selection inspector with a
one-click merge that relinks the open board's cards immediately.

Authentication is **not** part of the first brief: the app runs as a seeded demo user
inside a seeded demo workspace. Auth (SSO/OIDC for enterprises) is on the roadmap and
the schema already separates users, memberships and roles.

## 6. Roadmap

### Now (brief 1 — foundation) — done, see §6a
- [x] Living brief + agent instructions.
- [x] Workspace home with teams, spaces and boards (create, rename, favourite, recent).
- [x] Infinite canvas: navigation, minimap, tools, selection, move/resize, inline text,
      connectors, frames, undo/redo, copy/paste, autosave.

### Next (brief 2+ — candidates, to be confirmed by the product owner)
- Real-time multiplayer on boards (presence, cursors, CRDT/OT).
- Authentication and enterprise SSO; roles and permissions per team/space/board.
- ~~Graph core: entity + relationship store behind the canvas; canvas elements that are
  *views* of graph nodes.~~ **Done (v0.2)** — see §5.5.
- ~~Entity resolution proposals (same name / kind across boards → merge)~~ **Done (v0.2)**
  — see §5.6. Next: attribute schema per kind, relation-type vocabulary management.
- Optics: load/unload lenses (capability view, data-flow view, overlays).
- Connectors framework and first sources (~~file import~~ done as CSV/JSON import,
  ServiceNow, CMDB, wiki).
- Agent framework: classification, meta-model proposal, ~~entity resolution~~ (rules done),
  enrichment, with human review queue (the accept / dismiss flow exists; LLM-backed
  proposal sources are next).
- Search across boards and the graph.
- Board templates; export (PNG/PDF); comments.
- Sovereign deployment package (containers, Postgres, object storage, model gateway).

## 6a. What exists today (v0.1, 2026-09-04)

### Management structure (LeanFlow home shell)
- **Workspace home** (`/w/[slug]`): meta line, title, "Open last board", grid/list toggle
  (remembered), "Create new" (dialog: name, space, template), start panel with search
  (filters boards by name, description, space and object text), four starters (blank,
  capability map, application landscape, integration flows), recent boards strip, board
  browser.
- **Board browser** rows: thumbnail, star glyph, name / description / object counts, last
  opened, space; actions star, rename inline, move to another space, duplicate, delete.
- **Spaces** (`/spaces`, `/spaces/[spaceId]`): create (icon, name, description, team,
  open/private), rename inline, settings (description, team, visibility, delete); the
  space page reuses the home shell scoped to that space (starters create boards there).
- **Teams** (`/teams`, `/teams/[teamId]`): create with colour, rename inline, add/remove
  members, delete; team page lists its spaces and members.
- **Sidebar**: brand, search (→ home with `?q=`), Home / Recent / Starred / Teams with
  counts, SPACES list with hover actions (new board, open), TEAMS list, current user.
- Seeded demo tenant "Acme Energy" (an energy-grid operator): 4 users, 3 teams, 4 spaces,
  6 boards built from the templates.

### Canvas engine (`apps/web/src/canvas`)
| Area | Delivered |
|---|---|
| Navigation | Wheel/two-finger pan, ⌘/ctrl+wheel and pinch zoom at cursor, space+drag / middle-mouse / hand-tool pan, zoom in/out/100 %/fit/selection, adaptive dot grid, minimap with click-and-drag viewport, scroll-mode toggle (trackpad pans vs mouse zooms, remembered per browser). |
| Elements | Architecture card (kind with colour, title, description; kind swatches from a starter vocabulary), note (title, body, 7 tints), text block / section (title, body, colour), shape (rectangle / oval / rhombus, fill; double-click to label), frame (pill titlebar: title, #order, Color, Focus, Delete; moving a frame carries the objects inside it), connector (element-to-element or free end, pill label, line / arrow / dashed presets, arrows either end, re-routed live). |
| Editing | Live text fields on cards, notes, text blocks and frames (new objects focus their title), click / shift-click / marquee selection (frames need full enclosure), drag-move, 8-handle resize (shift keeps aspect), floating property bar per selection type, draggable Selection inspector with editable fields and actions, command bar search (⌘K) that focuses matches, lock, bring-to-front / send-to-back, nudge with arrows, duplicate, copy/cut/paste, delete (connectors follow their elements), undo/redo (snapshot history of committed operations). |
| Persistence | Versioned JSON document (`{ version: 1, elements }`) per board; debounced autosave (`PUT /api/boards/[id]`) with saved/saving/error indicator; flush on tab hide and unload. |
| Performance | Off-screen culling of box elements; per-element store subscriptions; `overflow: clip` root so nothing can scroll the canvas surface. |
| Help | Shortcuts panel (topbar button); empty-board hint card. |

### Knowledge graph (v0.2)
- Cards are entities, connectors between cards are relations; board saves sync into the
  graph and board loads hydrate from it (§5.5).
- Graph inventory panel on every board (search, kinds with counts, place one / place all,
  focus cards already on the board).
- Inspector "Knowledge graph" block: relations with direction, other boards, source.
- Knowledge graph page: emergent meta-model, rename kind, entity edit/delete, CSV/JSON
  import with result summary, "Lay out on a board" (optionally filtered by kinds).
- Seeded boards are indexed into the graph at seed time (28 entities, 13 relations).

### Agent proposals (v0.2)
- Rule-based proposals with evidence and confidence: duplicate merge, kind normalisation,
  untyped entities, unlabelled relations, orphans (§5.6).
- Accept / dismiss with remembered decisions; inline inputs for kinds and labels.
- In-canvas duplicate hint with one-click merge in the Selection inspector.

### Quality gates
- `pnpm typecheck`, `pnpm lint` (Next + TypeScript ESLint), `pnpm test` (Vitest: camera
  math, panel-aware fit, box/resize/connector geometry, store history and frame behaviour,
  graph sync / hydrate / import / layout and proposal rules / merge against an in-memory SQLite).
- `pnpm e2e` (Playwright, needs a running dev server): drives the real browser through
  the home, space and team pages and the canvas — create note (typing into the focused
  title), drag, zoom, pan, fit, inspector, delete, undo, card, rectangle, connector,
  command-bar search, autosave, reload, create board from a starter.

### Known gaps (intentional for brief 1)
- No authentication or authorisation; everyone is the seeded demo user.
- Single workspace; no multiplayer; no comments; no export; no search.
- Connectors are straight lines; no orthogonal/curved routing yet.
- Google Fonts (IBM Plex) are loaded at runtime; offline environments fall back to the
  system stack.
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
| 2026-09-04 | Miro vocabulary: Workspace → Team / Space → Board. | Familiar to the target users; matches the requested management structure. |
| 2026-09-04 | Connectors render above all elements. | Labels and arrowheads must stay readable; connectors attach to element borders so they rarely obscure content. |
| 2026-09-04 | Canvas root uses `overflow: clip`, not `hidden`. | `hidden` containers can still be scrolled by `focus()`/`scrollIntoView`, which shifted the whole UI during testing. |
| 2026-09-04 | Tools revert to *select* after one use, except *hand* and *connector*. | Matches Miro/Figma muscle memory; connectors are usually drawn in batches. |
| 2026-09-04 | Graph ids are minted on the client (`ent_…`, `rel_…`) and the server upserts on save. | No round-trip needed to link a card; saves stay idempotent; imports and layouts reuse the same ids. |
| 2026-09-04 | The graph outlives boards: deleting a card never deletes its entity; deleting an entity only unlinks cards. | Boards are views; the workspace graph is the asset. |
| 2026-09-04 | Zoom-to-fit targets the viewport area not covered by floating panels. | With inventory + inspector open, a naive fit hid content under the panels. |
| 2026-09-04 | Agent proposals start as deterministic rules behind the final `Proposal` contract. | Gives users the review workflow and decision memory now; LLM sources can be added without UI changes, and rule proposals stay explainable. |
| 2026-09-04 | Merging entities rewrites board documents server-side and the open canvas relinks its cards client-side. | The board document is the client's truth while open; without the client patch the next autosave would resurrect the merged entity. |

## 8. Open questions for the product owner

- Which first data source should the ingestion work start with (ServiceNow? file
  import? a process-modelling tool)?
- Should optics be user-authored (query + layout), agent-suggested, or both?
- Real-time collaboration: how early is it needed relative to ingestion and agents?
- Sovereign deployment: which model providers must be supported locally?

## 9. Changelog

- **2026-09-04 — Rev 4: agent proposals.** Deterministic entity-resolution and meta-model
  hygiene rules (duplicates, kind variants, untyped, unlabelled relations, orphans) with
  evidence, confidence, accept / dismiss and remembered decisions; merge relinks cards on
  every board. Proposals section on the Knowledge graph page and a duplicate hint with
  one-click merge in the board inspector. Unit tests for the rules and the merge.

- **2026-09-04 — Rev 3: knowledge graph core.** Entities, relations and a board↔entity
  index in the database; cards are graph-backed from birth and connectors between cards
  are relations; boards sync into the graph on save and hydrate from it on load. New
  Graph inventory panel on boards (place entities as linked cards), graph facts in the
  Selection inspector, a Knowledge graph page with the emergent meta-model, kind renaming,
  entity editing, CSV/JSON import and "Lay out on a board". Panel-aware zoom-to-fit,
  SQLite WAL + busy timeout, text-field clicks select the owning card. Graph logic covered
  by unit tests against in-memory SQLite; e2e extended with inventory placement and import.

- **2026-09-04 — Rev 2: Miro, Spaces, LeanFlow Studio design.** Corrected the reference
  product to Miro and renamed Rooms → Spaces everywhere (schema, routes, ids, copy).
  Replicated the UI/UX of `rummand/leanflow-studio`: new design tokens and CSS, LeanFlow
  home shell (sidebar, start panel, starters, recent strip, board browser with row
  actions and move-to-space), LeanFlow board shell (topbar, command bar with board search,
  badge tool rail with shape picker, draggable Selection inspector, Map overview card,
  zoom card, status line). Document model v2: architecture cards, notes and text blocks
  with title + body, section variant, v1 migration. Board templates power the starters
  and the seed. Agents must now attach screenshots when reporting UI work (CLAUDE.md).

- **2026-09-04 — Brief 1 kick-off.** Captured the vision (agent-built meta-model,
  everything-is-a-graph, infinite canvas, SaaS first / sovereign later). Set up the pnpm
  monorepo, Next.js 16 web app, Drizzle/SQLite persistence with seed data, the
  Miro-like management structure (workspace home, teams, spaces, boards) and the first
  version of the infinite-canvas engine (navigation, minimap, tools, selection,
  move/resize, inline text editing, connectors, frames, undo/redo, copy/paste,
  autosave).
