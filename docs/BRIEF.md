# Nexus — Product Brief (living document)

> **Status:** living document. This file is the single source of truth for what Nexus
> is, why it exists, what has been built and what comes next. Every agent and every
> contributor reads it before working and updates it after adding or changing
> functionality. See `CLAUDE.md` for the update rules.

Last updated: 2026-09-04 (rev 15 — entity table)

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
  always live — no separate edit mode (shapes keep double-click labelling); fields of unselected objects are inert so the first click selects.
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
  move. Three routes: straight, **curved** (cubic Bézier leaving each box along its side
  normal — the default for relation connectors, as in LeanFlow) and **elbow** (orthogonal,
  two bends). Labels sit on the path midpoint. Rendered in an SVG layer inside the world
  transform.
- **Interaction** is a small state machine driven by pointer events on the root
  (`idle → pan | marquee | move | resize | draw | connect | edit`). Tools: select,
  hand, frame, card, note, text, section, shapes, connector. While moving, **smart
  guides** snap the moving group's edges and centres to other objects (6 screen px;
  Alt bypasses; magnet toggle in the zoom card). A **right-click menu** offers object
  actions (expand, focus, duplicate, order, lock, delete) or quick creation on empty canvas.
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
- **Performance.** The canvas is client-only (dynamic import, no SSR of 1 000 DOM nodes).
  The world transform is applied imperatively from a store subscription, so pans and zooms
  never re-render React. The dot grid and the minimap are drawn on `<canvas>` elements
  (one `drawImage`-class repaint instead of CSS gradients / hundreds of DOM boxes). Wheel
  deltas are accumulated and applied once per animation frame. Box elements are culled
  against a *quantised* viewport rectangle (240 screen px steps) so small camera moves do
  not touch the element layer at all. Element and connector layers memoise their children
  on the list of ids; every element, connector and label subscribes to its own slice, so
  dragging a card re-renders that card and the connectors touching it — nothing else.
  Google fonts load asynchronously (a render-blocking `<link>` stalled first paint for
  seconds in the sandbox). Measured on a 400-card / 300-connector board (headless Chromium,
  software rendering, production build): first load 0.4 s, warm reload 0.3 s, pan
  ≈ 25 ms/frame, zoom ≈ 20 ms/frame, drag ≈ 40 ms/step — down from 13.5 s / 85 / 60 /
  75 before this work. `scratchpad`-style stress scripts are not checked in; the
  numbers come from a Playwright script that PUTs the stress document to a scratch board.

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
  colours, relation types — click a type to rename / merge it), rename a kind (merges
  vocabularies), entity table with edit /
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

Attribute hygiene (rev 13) — the emergent attribute schema (§5.8) gets the same care as kinds:

- **Attribute key variants** — keys that differ only by case or separators (`Lifecycle` /
  `lifecycle`, `business_owner` / `Business owner`) → *Rename key* onto the most-used spelling
  (existing values on the target key win).
- **Attribute value variants** — values of one key that differ only by case / whitespace
  (`Active` / `active`) → *Normalise* to the most-used spelling.
- **Missing attributes** — when ≥ 80 % of a kind's entities (≥ 3) carry a key, each entity of
  that kind without it gets a *Set value* proposal; if one value covers ≥ 80 % of carriers it is
  pre-filled (medium confidence), otherwise the reviewer types it (low).

All three are pure functions over the entity list (`attributeProposals`) so they are unit-tested
without a database; accepting them rewrites the JSON attribute bags server-side and boards pick
the change up through `hydrateDocument` on the next load, like kind renames.


### 5.7 Viewpoints — the first optics (v0.2)

"Load and unload optics" (§2.4) starts as a **Viewpoint** tab in the board's Graph panel
(LeanFlow "Graph viewpoint"). Everything it places is graph-backed, so it round-trips
through the normal save → sync path.

- **Expand selection**: hop depth 1–3, direction both / outbound / inbound; the selected
  cards' graph neighbours are placed radially around them (skipping occupied space) and
  connected with relation connectors. Also a one-click **Expand** in the card property bar.
- **Show all relations**: draws connectors for every graph relation between cards already
  on the board (idempotent — existing connectors and pairs are skipped). **Hide relations**
  removes relation connectors.
- **Cleanup**: Group cards by kind (one frame per kind under the current content), Distribute
  the selection on a grid, Fit board.
- **Kind lens**: dim / show card kinds on this board.
- **Saved views**: name the current lens + camera and re-apply it later; saved in the board
  document (`document.viewpoints`), so they travel with the board and its checkpoints.
- Server: `POST /api/graph/neighborhood` — BFS over relations with depth, direction and an
  optional relation-kind filter; returns discovered entities plus all relations among the set.

### 5.8 Attributes and the emergent attribute schema (v0.2)

Cards carry free-form `attributes` (key → value: lifecycle, owner, criticality, hosting …).
They render as chips on the card (risk-tinted for values like *high*, *end of life*,
*phase out*), are edited in the Selection inspector (with key suggestions from other entities
of the same kind), sync to `entities.attributes` and hydrate back. The **set of keys per
kind, with usage counts,** is the emergent attribute schema shown on each kind card of the
Knowledge graph page — nobody defines a schema up front; it appears from the data. CSV import
turns any extra header columns into attributes; JSON entities may carry `attributes`.

**Table view (rev 15).** The Knowledge graph page's entity section has a *List | Table* toggle.
The table has one column per attribute key in use (ordered by the filtered kind's schema, or by
frequency across all kinds), sortable headers, inline cell editing (click, type, Enter; empty
removes the attribute), an "Add column" box that simply introduces a new key, and "Copy as CSV"
in the import format so a round-trip through a spreadsheet works. Cells save through
`setEntityAttributeAction`; the schema chips on the kind cards update on the next render because
the schema *is* the data.


### 5.9 Board version history (v0.2)

`board_versions` stores full-document checkpoints per board: **auto** (on save, when the
latest checkpoint is older than 10 minutes — the state being overwritten is kept), **manual**
("Save checkpoint" with a label) and **restore** (the state replaced by a restore, so restores
are reversible). Auto checkpoints are pruned to 30 per board; manual ones are kept. The
History panel (topbar → History) lists versions with age, object count and author, and
restores with one click; the restored document re-syncs into the graph. This is the seed of
the "dated checkpoints / compare over time" idea (§2, LeanFlow's snapshots).

### 5.10 Graph query in the command bar (v0.2)

The board's command bar (⌘K) searches the board **and** queries the workspace graph with a
small deterministic language (`src/lib/query.ts`, `POST /api/graph/query`):

| Clause | Meaning |
|---|---|
| `kind:Application` (`is:`, `type:`) | entity kind (exact or prefix, case-insensitive) |
| `owner:"Grid Operations"`, `criticality:high` | attribute contains value (key exact or prefix) |
| `related:Maximo` · `from:X` · `to:X` | 1-hop neighbours of entities whose name matches X (any / outbound / inbound) |
| `rel:billing` (`via:`) | restrict the relation kinds used by related/from/to |
| free text | name, description and attribute values contain every word |

Results show why they matched, where they already live, and can be **placed** one by one,
all at once (Enter / "Place n"), or **highlighted** when already on the board. Example
queries appear as chips when the bar is empty. The agent layer will translate natural
language into this structure, so the runner is the single definition of what a question means.

Authentication is **not** part of the first brief: the app runs as a seeded demo user
inside a seeded demo workspace. Auth (SSO/OIDC for enterprises) is on the roadmap and
the schema already separates users, memberships and roles.

### 5.11 Lenses — impact and attribute optics (v0.2)

A *lens* is a client-side optic over a board: it changes how the board is drawn, never what it
contains (`src/canvas/lens.ts`).

- **Impact lens.** Breadth-first walk from the selected cards along the board's connectors
  (direction outbound / inbound / both, depth 1–3, sharing the controls of "Expand selection").
  Cards and connectors that are not reached fade to 12 %; reached cards carry a "n hops" badge.
  The legend lists hop rings with counts; clicking a ring selects those cards. With nothing
  selected the lens is armed but shows everything.
- **Attribute lens.** Colour cards by the value of one attribute (keys offered are those present
  on the board, most common first). Each distinct value gets a palette colour, a ring and a badge
  on the card; cards without the attribute fade; connectors stay visible only between two
  visible cards. The legend is the emergent value set with counts — i.e. the attribute's schema
  as the data actually uses it.
- **Relation lens.** Colours connectors by relation type (palette in order of frequency,
  unlabelled connectors grouped as "(unlabelled)"); clicking a type in the legend fades that
  type out (`hidden` list in the lens). Cards are never faded by this lens.
- **Group by attribute.** Next to "Group by kind", a picker lays every card out in one frame
  per value of an attribute (`lifecycle: active`, `no lifecycle` …). Both layouts remove frames
  that were emptied by the move so the board does not keep husks; one undo step reverts all.
- **Derived state.** The lens result (visible set, colours, hops, legend) is computed once per
  change of lens / selection / elements by a store subscription and stored as `lensResult`;
  every card and connector reads a per-id slice, so the graph walk never runs per component.
- **Legend card.** A screen-space card above the status line names the active lens and its
  legend, with a clear button, so the lens stays legible when the Graph panel is collapsed.
- **Saved views** carry the lens (`SavedViewpoint.lens`, optional — older views have none).

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
  — see §5.6. ~~Attribute schema per kind~~ done (§5.8). Next: relation-type vocabulary
  management, attribute value normalisation proposals.
- Optics: ~~load/unload lenses~~ first version done (§5.7: expand, relations, group by kind,
  kind lens, saved views per board). Next: relation-type filters, overlays (lifecycle,
  risk, ownership), automatic layouts (lanes, radial).
- Connectors framework and first sources (~~file import~~ done as CSV/JSON import,
  ServiceNow, CMDB, wiki).
- Agent framework: classification, meta-model proposal, ~~entity resolution~~ (rules done),
  enrichment, with human review queue (the accept / dismiss flow exists; LLM-backed
  proposal sources are next).
- ~~Search across boards and the graph~~ done: home search over boards + objects, board command bar with structured graph queries (§5.10). Next: natural-language translation by the agent layer.
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
| Performance | Client-only canvas, imperative world transform, canvas-drawn grid and minimap, per-frame wheel coalescing, quantised culling, id-keyed layer memoisation, per-connector subscriptions with cached paths, async fonts; `overflow: clip` root so nothing can scroll the canvas surface. 400 cards + 300 connectors: 0.4 s load, ~25 ms pan frames in headless software rendering. |
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

### Entity table (v0.2)
- Spreadsheet view of entities on the Knowledge graph page: attribute columns from the emergent
  schema, sort, inline editing, add column, copy as CSV.

### Attribute proposals (v0.2)
- Rename attribute keys that differ by case / separators, normalise value spellings, fill in
  attributes that (almost) every entity of a kind carries — with accept / dismiss memory like
  the other rules. CSV import without a `description` column now treats every extra column as
  an attribute.

### Lenses (v0.2)
- Impact lens (direction, depth), attribute lens (colour by value) and relation lens (colour
  connectors by type, toggle types) in the Viewpoint tab; cards badge their hop distance or
  attribute value; legend card on the canvas; legend entries select their cards or toggle a
  relation type; saved views remember the lens. Group by kind / by attribute lay cards out in
  frames and clean up emptied frames.

### Viewpoints (v0.2)
- Graph panel with Inventory | Viewpoint tabs; expand neighbours (depth, direction),
  show / hide relations, group by kind, distribute, kind lens (§5.7).

### Attributes (v0.2)
- Key/value attributes on cards with risk-tinted chips, inspector editor with suggestions,
  graph sync/hydrate, CSV extra columns → attributes, emergent per-kind schema on the
  Knowledge graph page (§5.8). Demo data ships lifecycle / criticality / owner.

### Version history (v0.2)
- Auto / manual / restore checkpoints per board, History panel with restore (§5.9).

### Canvas polish (v0.2)
- Connector routes (straight / curved / elbow) with route buttons in the property bar;
  relation connectors default to curved. Smart alignment guides with Alt bypass and toggle.
  Right-click context menu.

### Graph query (v0.2)
- Structured graph queries from the command bar with place / highlight actions (§5.10).

### Saved views, relation types, home summary (v0.2)
- Saved viewpoints per board (lens + camera, persisted in the document), relation-type
  rename / merge on the graph page, knowledge-graph summary strip on the workspace home
  with the number of open agent proposals.

### Quality gates
- `pnpm typecheck`, `pnpm lint` (Next + TypeScript ESLint), `pnpm test` (Vitest: camera
  math, panel-aware fit, box/resize/connector geometry, store history and frame behaviour,
  graph sync / hydrate / import / layout and proposal rules / merge, graph neighbourhood, version checkpoints / restore, query parsing and execution against an in-memory SQLite).
- `pnpm e2e` (Playwright, needs a running dev server): drives the real browser through
  the home, space and team pages and the canvas — create note (typing into the focused
  title), drag, zoom, pan, fit, inspector, delete, undo, card, rectangle, connector,
  command-bar search, autosave, reload, create board from a starter.

### Known gaps (intentional for brief 1)
- No authentication or authorisation; everyone is the seeded demo user.
- Single workspace; no multiplayer; no comments; no export; no search.
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
| 2026-09-04 | Viewpoint controls live in a tab of the left Graph panel rather than a third floating panel. | Screen budget: inventory + inspector + map already frame the canvas; LeanFlow's separate panel would overlap content. |
| 2026-09-04 | Saved viewpoints live inside the board document rather than in their own table. | They are part of what a board *is*; they version and restore together with it, and boards are already the unit of sync. |
| 2026-09-04 | Text fields on an *unselected* object are inert: the first click selects (and can drag), the second click edits. | At low zoom a note is mostly text field; without this rule it could not be grabbed. Matches the Miro / Figma model. |
| 2026-09-04 | Attributes are schemaless key/values per entity; the schema is *derived* (keys per kind with counts). | This is the vision in miniature: the meta-model emerges from data instead of being configured. Validation / typing can be layered on later as proposals. |
| 2026-09-04 | Checkpoints store the full document (not diffs), time-based auto + manual + pre-restore. | Documents are small JSON; full snapshots make restore trivial and diffing possible later. Pruning keeps growth bounded. |
| 2026-09-04 | A deterministic query language precedes natural-language questions. | Gives an unambiguous target for the future LLM translation step, keeps results explainable ("why" per hit), and is useful today. |
| 2026-09-04 | Missing-attribute proposals need ≥ 80 % coverage within a kind of ≥ 3 entities. | Below that the "schema" is not established and the proposals would be noise; the threshold is a constant to tune once real data arrives. |
| 2026-09-04 | Lenses never mutate the document; the impact lens walks *board connectors*, not the workspace graph. | What you see is what you traverse: the user controls which relations are on the board (Show all relations / expand) and the lens explains exactly that picture. A graph-backed variant can come later as "expand then lens". |
| 2026-09-04 | The board canvas is client-only (`dynamic(..., { ssr: false })`) with a loading shell. | Server-rendering a thousand absolutely positioned nodes doubled the payload and the hydration cost for zero benefit — the canvas needs the viewport size before it can place anything. |
| 2026-09-04 | Grid and minimap are drawn on `<canvas>`; the world transform is set imperatively. | These are the three things that change on *every* pan/zoom frame. Keeping them out of React (and out of CSS gradient repaints) is what made navigation frame-bound instead of render-bound. |
| 2026-09-04 | Layers memoise children on a joined-ids string; components subscribe to their own slice. | A drag mutates `elements` every pointer move; without id-keyed memoisation React recreated 700 elements per frame even though every child bailed out. |
| 2026-09-04 | Fonts load from a client component after mount rather than a `<link>` in `<head>`. | The render-blocking stylesheet stalled first paint for up to 13 s behind the sandbox proxy; the fallback stack (Aptos / system sans) is close enough that the swap is barely visible. |

## 8. Open questions for the product owner

- Which first data source should the ingestion work start with (ServiceNow? file
  import? a process-modelling tool)?
- Should optics be user-authored (query + layout), agent-suggested, or both?
- Real-time collaboration: how early is it needed relative to ingestion and agents?
- Sovereign deployment: which model providers must be supported locally?

## 9. Changelog

- **2026-09-04 — Rev 15: entity table.** List | Table toggle on the Knowledge graph page: one
  column per attribute key in use, sortable, cells editable in place (empty removes), "Add
  column" introduces a key, "Copy as CSV" exports in the import format. New server action to set
  or remove a single attribute.

- **2026-09-04 — Rev 14: relation lens, group by attribute.** Third lens colours connectors by
  relation type with a toggleable legend; "Group by attribute" lays cards out in frames per
  value; both group-by layouts now delete frames they emptied and stay a single undo step
  (`deleteElements` gained a history option).

- **2026-09-04 — Rev 13: attribute proposals.** Three new resolution rules keep the emergent
  attribute schema clean: rename key variants, normalise value spellings, fill in attributes
  that a kind (almost) always carries — each with accept / dismiss and evidence in the proposals
  panel. CSV import treats every extra column as an attribute when there is no `description`
  header (previously the third column was silently read as the description).

- **2026-09-04 — Rev 12: impact and attribute lenses.** Two board optics in the Viewpoint tab:
  the impact lens fades everything not reachable from the selection along connectors (direction
  and depth), the attribute lens colours cards by an attribute's values with an emergent legend.
  Hop / value badges on cards, a legend card on the canvas, legend entries select their cards,
  saved views carry the lens. E2E now picks a free spot for its test note (the shared dev board
  accumulates objects) and covers the impact lens.

- **2026-09-04 — Rev 11: performance.** Client-only canvas with a loading shell,
  imperative world transform, canvas-drawn grid and minimap, wheel coalescing per animation
  frame, quantised culling, id-keyed memoisation of the element and connector layers,
  per-connector subscriptions with cached paths, asynchronous font loading. A
  400-card / 300-connector stress board now loads in 0.4 s (production build) instead of
  13.5 s, and pan / zoom / drag frame costs dropped three- to four-fold. E2E pan check now
  reads the world transform (the CSS grid it used to read is gone).

- **2026-09-04 — Rev 10: saved views, relation types, home strip.** Saved viewpoints in the
  board document, relation-type renaming on the Knowledge graph page, and a graph summary
  strip on the home page linking to the graph with the open-proposal count.

- **2026-09-04 — Rev 9: graph query.** Command bar queries the workspace graph with
  kind:, attribute:, related:/from:/to:, rel: and free text; results explain their match,
  show board usage, and can be placed or highlighted. Unit tests for parsing and execution.

- **2026-09-04 — Rev 8: canvas polish.** Curved and elbow connector routing (relations
  curved by default), smart alignment guides while dragging, right-click context menu,
  snapping toggle. Geometry unit tests for routes and snapping.

- **2026-09-04 — Rev 7: version history.** Board checkpoints (auto every 10 minutes of
  editing, manual with label, pre-restore), History panel with one-click restore that
  re-syncs the graph. Unit tests for checkpoint timing, pruning rules and restore.

- **2026-09-04 — Rev 6: attributes and emergent schema.** Cards carry key/value attributes
  (chips, risk tint), editable in the inspector with per-kind key suggestions, synced to
  entities and hydrated back; CSV import maps extra columns to attributes; the Knowledge
  graph page shows the discovered attribute schema per kind and attribute chips per entity.

- **2026-09-04 — Rev 5: viewpoints (first optics).** Viewpoint tab on the board: expand
  selected cards into their graph neighbours (depth, direction, collision-free placement),
  show / hide all relations between cards on the board, group cards by kind, distribute,
  kind lens (dim kinds). Expand button in the card property bar. Graph neighbourhood API.

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
