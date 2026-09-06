# Nexus — Product Brief (living document)

> **Status:** living document. This file is the single source of truth for what Nexus
> is, why it exists, what has been built and what comes next. Every agent and every
> contributor reads it before working and updates it after adding or changing
> functionality. See `CLAUDE.md` for the update rules.

Last updated: 2026-09-05 (rev 30 — Railway deployment)

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
| Monorepo | pnpm workspaces (`apps/*`, `packages/*`) | Space to split out shared code; `packages/ea-knowledge` is the first, and had to be separate to be provably standalone. |
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
└─ packages/
   └─ ea-knowledge/           standalone EA knowledge base: corpus, retrieval, doctrine, CLI
```

### 5.3 Canvas engine design

- **Two coordinate spaces.** The *document* is in world coordinates. The *camera*
  (`x`, `y`, `zoom`) maps world to screen. Elements are rendered inside a single
  CSS-transformed layer; selection handles and overlays are rendered in screen space so
  they stay crisp at any zoom.
- **Vocabulary on the canvas.** The board keeps the workspace's kinds and entity names
  (refreshed with the proposals after each save); a card's kind and title fields offer them as
  suggestions, so vocabularies converge while typing instead of via a proposal afterwards.
- **Link instead of duplicate.** When a selected card's title equals the name of an entity that is
  not the card's own (same kind preferred), a pill under the title offers *Link to existing …*:
  the card takes that entity's id, kind and attributes, so the next save updates the existing
  entity instead of minting a duplicate. Duplicates that slip through are still caught by the
  merge proposal.
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
- **Board from frame.** Right-click a frame → *Create board from frame*: a new board in the same
  space seeded with the frame's contents (and the connectors between them), translated to the
  origin; the new board syncs into the graph immediately, so the same entities now appear on
  both boards. The original board is untouched — this is the Miro "split a board" move.
- **Alignment.** With two or more objects selected the property bar offers align left / centre /
  right / top / middle / bottom and, from three objects, distribute horizontally / vertically
  (`alignBoxes`, `distributeBoxes` in geometry). Frames carry their contents; locked objects stay.
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
- **PNG export.** `src/canvas/png.ts` rasterises that SVG in the browser (blob URL → `<img>` →
  canvas → `toBlob`) at 2× for slides and chat. No server round trip and no headless browser.
  The scale is clamped so the longest edge stays within 8000 px, which keeps a very large board
  from exhausting browser memory; `fitScale` never drops below 1:1.
- **Export.** `src/canvas/export.ts` renders a document to a standalone SVG (frames, cards with
  kind / title / attribute chips / description, notes, text blocks, shapes, connectors with
  arrowheads and label pills; greedy text wrapping on an approximate glyph width). The topbar
  *Export* menu offers Download SVG, Download PNG, Copy SVG and *Present* — presentation mode hides all chrome,
  fits the board to the full viewport and leaves on Esc or a click on the pill. **Frames are
  slides**: → / space / PageDown step through the board's frames in reading order (rows top to
  bottom, then left to right), ← / PageUp step back, Home shows the whole board; the pill reads
  "Frame 2 of 6".
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

**Entity drawer (rev 18).** Clicking an entity name on the Knowledge graph page (list or table)
opens a right-hand drawer with everything the graph knows: kind / name / description (save on
change), attributes with the kind's schema as suggestions (blur saves, × removes), relations
(click the other end to navigate), boards it appears on (links), duplicate candidates with a
one-click merge, and delete. Esc or the backdrop closes it. Data comes from the existing
`GET /api/graph/entities/[id]`; edits go through the same server actions the canvas uses.

**Deep links (rev 23).** `/e/:entityId` redirects to the owning workspace's Knowledge graph page
with the drawer open (`?entity=`); the canvas inspector's graph block links there ("Open in
graph →") and the home page shows the six most recently changed entities as chips under the
graph strip. Anything that mentions an entity can now link to it.

**Relations without a board (rev 22).** The drawer's relation list has an add form (direction,
relation type with the workspace's types as suggestions, other entity by name) and a delete
button per relation (`src/lib/relations.ts`). Creating dedupes on ends + type; deleting also
strips the connectors that draw the relation from every board document, otherwise the next
autosave of such a board would recreate it. Boards stay the *other* way to create relations.


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

**On the canvas (rev 24).** The board fetches the workspace's open proposals after every save
and indexes them by entity. Cards whose entity has proposals wear a small ✦ badge; the Selection
inspector shows the proposals for the selected card with Accept / Dismiss (inputs for kind,
label and attribute values). Accepting applies the change in the graph *and* mirrors it onto the
open document (`applyLocally`: kind / colour, connector label, attributes, entity relink for
merges) so the next autosave agrees with the graph instead of undoing it.


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

**Bulk edits (rev 25).** Table rows have checkboxes (select all shown); a bulk bar sets an
attribute (empty value removes it) or the kind for the selection, or deletes the entities. Three
small server actions back it.

**Import preview (rev 28).** The import dialog parses the pasted text as you type (pure
`src/lib/import-parse.ts`, shared with the server) and shows what would happen before *Import*:
entities (new vs. updating existing, matched by kind + name like the server), kinds, attribute
columns, relations, and warnings (rows without a name, relations pointing at unknown names,
unrecognised header).

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

**Compare (rev 16).** Every checkpoint in the History panel has a *Compare* button that loads the
stored document (`GET /api/boards/[id]/versions/[versionId]`) and diffs it against the board as it
is now (`src/canvas/diff.ts`: added / removed / changed by element id; `x`/`y` collapse to
"position", `w`/`h` to "size", z-order is ignored). Added and changed entries focus the element on
click; removed entries are listed struck through. Diffing runs client-side on the open document,
so it also shows unsaved edits.


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

**Autocomplete (rev 27).** The command bar completes the last token from the workspace vocabulary
(`src/lib/query-complete.ts`, pure and unit-tested): a bare word offers clause keywords and
attribute keys; `kind:` offers kinds, `rel:` relation types, `related:`/`from:`/`to:` entity
names, `has:`/`missing:` attribute keys, and `<attribute>:` the values in use, most common first.
Values with spaces are quoted automatically.

**Rev 19 clauses.** `has:<key>` (attribute present with a value), `missing:<key>` (also
`without:` / `no:`; attribute absent or empty) and `on:<board>` (also `board:`; the entity is
placed on a board whose name contains the text). Together with the attribute proposals they make
schema hygiene queryable: `kind:Application missing:owner` lists exactly the gaps the agent
would otherwise propose one by one, and `on:landscape has:criticality` scopes a question to a
board. Each hit still carries a "why" (e.g. `no owner`, `on Application landscape`).


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
- **Query lens (living views).** A graph query typed in the Viewpoint tab becomes a lens: cards
  whose entity is in the result set stay, the rest fade; *Place missing* adds cards for results
  that are not on the board yet. The lens stores the query text and its last result; whenever
  the text changes (typing, or a saved view applying it) the query is re-run, so a saved view
  with a query lens is a **living view** of the graph, not a snapshot.
- **Group by attribute.** Next to "Group by kind", a picker lays every card out in one frame
  per value of an attribute (`lifecycle: active`, `no lifecycle` …). Both layouts remove frames
  that were emptied by the move so the board does not keep husks; one undo step reverts all.
- **Derived state.** The lens result (visible set, colours, hops, legend) is computed once per
  change of lens / selection / elements by a store subscription and stored as `lensResult`;
  every card and connector reads a per-id slice, so the graph walk never runs per component.
- **Legend card.** A screen-space card above the status line names the active lens and its
  legend, with a clear button, so the lens stays legible when the Graph panel is collapsed.
- **Saved views** carry the lens (`SavedViewpoint.lens`, optional — older views have none).

### 5.12 Optional access gate (v0.2)

Brief 1 has no per-user identity, so a public deployment would be world-editable. Setting
`NEXUS_ACCESS_PASSWORD` puts one shared password in front of the whole instance; leaving it
unset changes nothing, so local development, the seeded demo and the e2e suite are unaffected.

- `src/proxy.ts` (Next 16's `proxy` convention, formerly `middleware`) redirects anything
  without a valid cookie to `/login?next=…`.
- The cookie is an HMAC of a fixed message keyed by the password, so it verifies with no session
  store and the password never leaves the server. Comparison is length-independent.
- `/api/health` and Next's own assets bypass the gate — a platform health check must never be
  redirected, or deploys never go green.
- `?next=` only accepts same-site paths, so it cannot bounce a visitor to another origin.

This is a deployment lock, not an identity system: it says *whether* you may open the instance,
not *who* you are. Real auth (§6 roadmap) replaces it.

### 5.13 Graph explorer (v0.2)

Boards are *curated* slices: you choose what goes on them. The explorer is the complement — the
whole workspace graph at once, as a navigable node-link view at `/w/[slug]/explore`.

- **Data.** `src/lib/explorer.ts` returns nodes *and* individual edges (`graphSnapshot` only has
  relation types aggregated). Capped at 1 500 nodes, keeping the most connected ones, because the
  whole graph ships in one response; the UI says when it truncated.
- **Layout.** `src/lib/force.ts` is a small Fruchterman–Reingold: pairwise repulsion, attraction
  along edges, a cooling schedule, and a gentle pull to the origin so disconnected components do
  not drift away. It is pure and seeded, so a graph always lays out the same way and the
  behaviour is unit-tested (determinism, no NaN when nodes coincide, connected nodes ending up
  closer than unconnected ones, pinned nodes staying put).
- **Rendering.** A single `<canvas>`, for the same reason as the board's grid and minimap: a DOM
  node per entity is far too slow at this scale. One simulation tick per animation frame, so the
  structure visibly settles rather than appearing pre-arranged.
- **Navigating.** Drag to pan, scroll to zoom at the cursor, drag a node to pull it (it pins
  while held and the neighbourhood re-settles), click to focus. Focusing dims everything except
  the node and its neighbours and lights the connecting edges. The detail panel lists attributes
  and clickable neighbours, and links through to the entity drawer via `/e/:id`.
- **Path tracing (rev 35).** *"How are these two systems connected?"* — the question an impact
  assessment actually asks. Arm a trace from the selected entity, shift-click a second, and the
  shortest route lights amber while everything else dims; the banner spells out the chain
  (`Settlement Engine → Data Lake`) or says the two are in different components. Breadth-first
  over an undirected view of the relations, because connectivity does not care which way a
  relation was drawn.
- **Hop focus (rev 35).** *Show within 1 / 2 / 3* in the detail panel reduces the view to a
  neighbourhood, which is how a large graph becomes readable.
- **Fragmentation (rev 35).** The hint line reports connected components ("23 disconnected
  groups, largest 7") — a portfolio that is mostly islands is itself a finding about the data.
- **Filtering.** Node colour is the kind and radius is degree; the legend hides kinds; search
  dims non-matches and lists hits that focus on click. Pause / Fit / Relayout control the
  simulation.

### 5.14 Meta-model builder (v0.2)

The technical view of the graph's schema, at `/w/[slug]/meta` — a top-level menu item beside
Knowledge graph and Graph explorer. Left: the hierarchy (node types and relation types, expanding
to fields and observed connections). Right: the selected type.

Until now the meta-model was *only* emergent — kinds and attribute keys derived from the rows, so
there was nowhere to name a type before instances existed. Four tables now hold the *declared*
half (`node_types`, `node_type_fields`, `relation_types`, `relation_rules`, migration 0004), and
`src/lib/metamodel.ts` merges declared with observed. That merge is the point of the screen:

| presence | meaning |
|---|---|
| **declared** | declared and present in the data — the healthy case |
| **from data** | grew from the data, never declared — awaiting a decision |
| **unused** | modelled, but nothing uses it yet |

- **Restructuring.** Rename a node or relation type and every instance moves with it, or the
  declaration would silently stop describing its own data. Renaming a field renames that
  attribute on every instance of the type. Removing a declaration never deletes data — the type
  simply becomes "from data" again.
- **Building your own.** Create node and relation types that no instance uses yet, give a type a
  parent (so `Application ⊂ IT Component` is expressible), declare fields with a data type
  (text / number / date / boolean / enum), and constrain a relation type with rules
  (`Application —depends on→ Application`).
- **Drift.** Attribute keys found in the data but not declared are listed alongside declared ones
  with a one-click "declare this field". Where a relation type has rules, from→to pairs the data
  contains that the rules disallow are flagged as violations and counted in the header, with a
  one-click "allow this connection".

**The diagram (v0.2).** The right pane has two tabs: *Details* (the selected type) and *Diagram*
— the meta-model itself drawn on a canvas. One box per node type, one arc per relation type, so
what you see is the abstraction: how the *types* connect, not which applications talk to which.
`src/lib/metamodel-graph.ts` reduces the merged model to that type-level graph and labels every
arc with where it came from — a declared **rule** (solid blue, drawn even with no data behind it),
a connection **observed** in the data (dashed grey), or one that **breaks a rule** (red). It
re-derives on every render, so declaring a type, adding a rule or renaming something redraws the
diagram immediately: the model is watched as it evolves rather than inspected after the fact.

- **Layout.** The explorer's seeded force layout (`src/lib/force.ts`), so the picture is stable
  across reloads, with one spring per *pair* rather than per relation type — otherwise six
  relation types between the same two types pull six times as hard and the pair with the most
  arcs to draw gets the least room. `separateBoxes()` then pushes any overlapping pair apart
  locally along its shallower axis, which clears the crowding without inflating the diagram until
  the boxes are unreadable.
- **Bundles.** Relation types joining the same pair fan out as arcs at fixed offsets, with labels
  slid along their own arc so a bundle of six does not stack six captions in one place. A type
  related to itself gets a loop, and loops stack upwards.
- **Focus.** The tree and the diagram share one selection. Selecting a node type lights its arcs
  and its neighbours; selecting a relation type lights every pair it joins; clicking a box or an
  arc selects it, so the Details tab opens on the same thing.

Rules and data types are advisory today — they describe and surface drift rather than reject
writes. Enforcement (and agent proposals driven by these violations) is the natural next step.

### 5.15 Intake — the ingestion layer (v0.2)

`/w/[slug]/intake`, a top-level menu item. Sources in, graph out; the screen is deliberately
unlike the canvas and the meta-model builder, because the work is different: this is where
unconsolidated data is read, argued with and accepted.

**A source is a node.** An uploaded transcript, a pasted document, a connector sync — each is
stored whole (`sources`, migration 0005), and once accepted it *becomes an entity in the graph*
of kind Meeting / Document / Dataset / Sync. A meeting is therefore as touchable as the
applications discussed in it: open it on a board, pull on it, and the estate it talked about
comes with it. Provenance is graph-native rather than a side table — every `mentions` edge
carries the sentence that justified it, so "why does the graph think this?" is a click, not a log.

**The pipeline is watchable.** A run (`source_runs`) is seven reported stages — read, segment,
recognise, resolve, relate, viewpoints, stage for review — each with what went in, what came out,
how long it took and one line in the run's own numbers ("7 passages from 3 speakers", "5 of 9
already exist in the graph"). The screen draws them as a flow. An importer that says "23 objects
imported" is unarguable in the bad sense; this one can be blamed.

**What it reads out of a meeting** (`src/lib/intake/extract.ts`, deterministic and pure):

| | how it is recognised |
|---|---|
| **known things** | the name is already an entity here — the meeting links to the graph rather than duplicating it |
| **typed things** | a phrase names its own type: "the Maximo application", "the billing capability" |
| **emergent things** | a proper noun nobody declared, said more than once — the meta-model growing from what people actually say |
| **people** | whoever spoke; they `attended` the meeting, and own the actions they took |
| **subjects** | what the meeting was *about* — target architecture, the application portfolio, data governance — joined with `about` rather than `mentions` |
| **connections** | a relation verb between two names in one sentence ("Maximo depends on SCADA") |
| **viewpoints** | what a person made of it: a decision, an action, a risk, a question, a need — each becoming an object of its own, raised by its speaker and about what was under discussion |

Every row carries its confidence, its reason and the quote behind it. Low-confidence guesses are
shown but start unticked. **Nothing reaches the graph until a human accepts it** — extraction and
commitment are separate actions, which is the only thing that makes reading meetings
automatically defensible.

**The landscape.** A second view on the same screen: everything intake has brought in, as a
graph — meetings, who was in them, the subjects they covered, the systems they touched. It reuses
the explorer (§5.13) rather than growing a second, weaker viewer, so search, focus and path
tracing come with it. Click a person and their meetings light up; sixteen meetings with your name
on them is a shape, not a list.

**The connector catalogue** (`src/lib/intake/connectors.ts`) is the ecosystem: conversations,
files, enterprise systems (ServiceNow, Jira, Confluence, SharePoint, Entra ID, SAP, Ardoq/LeanIX)
and repositories (Git, Databricks/Snowflake, OT historian). Four are built — meeting transcript,
notes & documents, CSV/JSON — and the rest say "planned" plainly rather than being hidden, because
the reach of the catalogue *is* the pitch.

**A model reads it, and every claim is checked against the source.** Where a model is configured
(`ANTHROPIC_API_KEY` + `NEXUS_MODEL`), the passages go to it and it returns objects, connections
and viewpoints in the same shapes the rules produce — but it must **quote the source for every
one**, and `src/lib/intake/validate-extraction.ts` checks the quote against the passage it cites.
Not the shape of the citation: the words. A claim whose evidence is not in the text is dropped and
shown as dropped ("*Salesforce: quoted words that are not in p1*"), a connection between things it
did not itself propose is refused, a viewpoint is attributed to whoever actually spoke that
passage rather than to whoever the model named, and kinds and relation types are snapped onto the
vocabulary this workspace already uses.

That check is stronger than anything available on the board-scripting side, and it is why a model
belongs here: an extraction is a claim about a document that is sitting right there to compare
against. With no model configured the rules read the source instead, and the screen says which
ran. The rules remain the fallback and the floor, not the destination.

### 5.16 The source catalogue (v0.2)

The third view on the intake screen, and the answer to a question the connector list dodged:
*who decides what an agent may read?*

A catalogue of connectors is a menu. This is a **negotiation surface between the agent and the
human about access**, and three things are first-class — none of which is the connection:

- **Evidence.** The discovery agent (`src/lib/catalog/discovery.ts`) does not probe a network. It
  reads what Nexus already holds, across five channels — entities, their attributes, ingested
  sources, board text and the declared meta-model — and reports how much of each it read. Four
  meetings arguing about SAP PM is stronger evidence that the system matters here than a port
  being open, and it comes with the human context a port scan never has. Every proposal quotes the
  exact strings behind it, and a proposal with no evidence is not made.
- **Scope.** Access is granted as a tree — system → module → object — never as a switch.
  `sap/pm/equi`, not `sap`. Ticking a module takes its objects with it; taking one object back
  drops the module, because a module whose objects are not all granted is not itself granted.
  Grants are materialised (`connection_scopes`, migration 0006), so what is stored is exactly what
  was shown.
- **Purpose.** Every grantable node says what it puts in the Nexus graph, what the organisation
  could then ask, how sensitive it is and roughly how much of it there is. "SAP PM · EQUI ·
  ~80k rows · into the graph: Asset · answer which applications touch which physical assets."
  A scope nobody can justify is a scope nobody should grant.

The agent asks for at most three scopes at a time, least sensitive first — an agent that asks for
everything gets refused everything. A grant carries a note (who agreed it, on what basis), a
selection containing personal data says so before it is saved, declining is remembered so the
same system is not proposed again, and revoking deletes the scope rows rather than setting a flag.

The catalogue itself is seventeen sources across five categories — conversations, files,
enterprise systems (SAP, ServiceNow, Entra ID, Jira, Confluence, SharePoint, Ardoq/LeanIX), code
and data platforms (Git, Databricks/Snowflake) and operations (OT historian/OPC UA, SCADA/EMS) —
with scope trees down to named tables. Three are built; the rest say "planned" out loud, because
the reach of the catalogue is the pitch and hiding the ambition helps nobody.

**Fingerprints, not just names.** Name matching finds a system only when somebody wrote its name.
`src/lib/catalog/signals.ts` gives every provider a fingerprint set — instance hostnames
(`*.service-now.com`, `*.atlassian.net`), table and column names (`cmdb_ci`, `EQUI`, `IFLOT`),
transaction codes (`IW32`), endpoints (`opc.tcp://…`), and files only one toolchain produces
(`package.json`, a Helm chart). Each carries a weight, and confidence is the weighted sum: a
hostname is near-proof, a passing product name is a hint that on its own stays below the floor.
Hosts are normalised to the machine — scheme, port and path removed — so one system seen three
ways is one finding, and filenames are rejected as hosts, because proposing `package.json` as a
system is the fastest way to make a discovery agent look foolish.

**Systems nobody's catalogue knows.** Hosts that match no vendor are grouped by registrable
domain and listed as unrecognised, with where they were seen. These are usually the systems that
matter most — the in-house scheduler, the acquired company's portal, the box in the control room —
because nothing off the shelf describes them. Registering one adds it to *this workspace's*
catalogue (`catalog_entries`, migration 0007) with the hosts it was seen at as its signals, so the
next scan recognises it instead of listing it as unknown again. The catalogue grows to fit the
estate rather than the other way round.

**Model without provenance.** The scan also reports system-like entities that nothing explains —
no ingested source, no edge from a source node. On the seed workspace that is 50 of them, which is
the honest state of most architecture repositories and the argument for the whole intake layer.

Nothing here fetches data yet: this is the decision layer, and the decisions it records are what
a fetching layer will be bound by.

### 5.17 Compose — writing the board (v0.2)

A board you write instead of draw. Open **Compose** on any board, type what it should contain, and
it is built:

```
title Metering landscape
add Maximo
expand 1 hop
connect them
lay out as flow
colour by kind
```

Six lines, and the board is fourteen cards and twenty-five connectors — the meeting, the people in
it, the decision they took, the risks they raised and the systems they discussed — with nothing
dragged and nothing placed by hand.

**It looks before it answers.** The planner has a second, read-only tool — `inspect_graph` — for
counts, samples, distinct attribute values, relation types and neighbourhoods
(`src/lib/compose/inspect.ts`). It calls that a few times, sees what is actually there, and only
then builds. That is the difference between a board builder and an analyst: without it a planner
can write *"two of them have no owner"* but cannot know it. Every look is bounded, every look is
shown to the person — *"read the values of owner (5 distinct, 50 missing)"* — so the reply can be
checked against what produced it, and an inspection it was not offered is refused rather than
guessed at.

**A model plans; the code decides what runs.** Asked in plain English — *"show me the applications
that depend on SCADA, and what they support"* — the request goes to a model that returns a *plan*:
a list of steps in the board instruction set, plus a sentence answering the person. It never
touches the graph, the document or the database. `src/lib/compose/validate.ts` then decides what
of that plan is executable: every step is checked against the closed instruction set, numbers are
clamped, proposed kinds and attributes are snapped onto what this workspace actually has, and
anything else is dropped and shown as dropped. A step named `drop_database` comes back as *“not
something a board script can do”*.

That split is the safety story, and it is why the rule compiler was worth building first. Entity
names and meeting transcripts go into the prompt, so anything in the workspace could in principle
try to instruct the model — and it does not matter, because the only thing the model can express
is a board script, and a board script can only read entities and arrange a document. There is no
verb for deleting data, changing a grant, or calling anything.

Both `ANTHROPIC_API_KEY` and `NEXUS_MODEL` must be set, together and deliberately; with either
missing the rule compiler reads the lines instead and the panel says which ran and what to set.
`NEXUS_MODEL_BASE_URL` points at a gateway — a distinct name, so the app never inherits an
`ANTHROPIC_BASE_URL` belonging to something else on the host.

**Every line compiles to the query grammar, and says so.** `add all applications` is echoed as
`kind:Application`; `add anything that depends on SCADA` as `to:SCADA rel:"depends on"`. The
English is the convenience and the query is the truth, and the screen shows you which is which,
line by line, with what each one did ("added 60 objects, 1 more not placed", "drew 25 relations").
A line it cannot read says so and lists the verbs it knows, rather than failing silently.

Compilation happens on the server against the workspace's *real* vocabulary — its kinds, relation
types and attribute keys — so "capabilities" resolves to `Business Capability` here and to
whatever this organisation calls it elsewhere. Irregular plurals and multi-word kinds are handled;
the fuzzy fallback is single-word only, because over a phrase it would swallow
`applications criticality:high` whole.

The verbs: `add`, `remove`, `expand` (N hops, optionally via a relation type, upstream or
downstream), `connect`, `group by`, `colour by`, `lay out` (grid, columns/rows by an attribute,
circle, flow), `title`, `note`, `clear`.

**The script is the board — and it stays with it.** The script is part of the document
(`CanvasDocument.script`), so reopening a written board shows the words that produced it rather
than an empty box, and they can be edited and re-run. A build starts from an empty board by
default, so the text and the picture cannot drift apart, and the same script over the same graph
gives the same board down to the coordinates — `src/lib/compose/apply.ts` is pure, and that is tested. Because a rebuild
discards what is there, it says how much it will replace and asks first; the board's own version
history is the backstop. Unticking it adds to what is already on the board instead.

This is "ask Nexus": the question and the answer are the same surface, so an answer is not a list
you read but a board you keep, and every step that produced it is on screen next to it.

### 5.18 Estate health (v0.2)

One number on the Knowledge graph page, and the six measures behind it: provenance, duplicates,
typing, connectedness, ownership, lifecycle. Each says what good looks like, how far off this
workspace is *in a sentence about this workspace*, and what would move it — with a button that
takes you there. Where the fix is bulk editing, the number pins its offenders into the entity
table; where it is a merge, it points at the proposals already computed on the same page.

The seed workspace scores **40 — "thin"**: 56 systems drawn by hand that no source explains, 51
nodes connected to nothing, 54 with no owner. That is the honest state of most architecture
repositories, and it is the argument for intake, the catalogue and the meta-model in one number
that moves when the work is done.

**And fixable.** A measure that only scolds gets read past, so each one shows what the agent can
already close from evidence the graph holds. `src/lib/proposals-evidence.ts` reads intake's own
record back out: the person who *raised an action about* a system is the best available candidate
for owning it — far better than the fact they sat in the meeting — and a risk that says a system
is "out of support" states its lifecycle. Each proposal cites the sentence behind it and lands in
the same accept/dismiss flow as the resolution rules; a question raised about a system is not
treated as a claim on it, and two people acting on the same thing produces silence rather than a
guess. Where nothing but attendance is available the proposal is made at low confidence and says
so: being present is not owning.

A bulk accept applies everything high-confidence that needs no judgement — never the ones with a
field for a human to fill in — after saying how many objects it touches and warning that merges
cannot be undone. On the seed workspace one bulk accept moved the score from 40 ("thin") to 71
("patchy").

Scoring is weighted by population, so a measure over three nodes cannot swing the headline, and
intake's own records — meetings, decisions, risks, the people who raised them — are excluded from
the estate measures: a decision has no owner and no lifecycle, and that is not a fault.
`src/lib/health.ts` is pure over rows and imports nothing but types, which matters more than it
sounds: it is rendered by a client component, and pulling in the database client dragged the whole
server bundle into the browser.

### 5.19 The store: two dialects, and a save that can be refused (v0.2)

The database was SQLite on a single volume: one instance, one writer, no backups worth the name.
It is now **either dialect, chosen by the connection string** — `DATABASE_URL=file:…` keeps the
zero-setup local file, `postgres://…` opens a pool and runs the Postgres migrations. Application
code did not change: `src/db/schema.pg.ts` is *generated* from `src/db/schema.ts` by
`scripts/generate-pg-schema.mjs` (table builder, boolean columns, the timestamp default), and a
unit test runs the generator with `--check` so a hand-edited schema can never drift from the copy
that ships. Both dialects have their own migration folder (`drizzle/`, `drizzle-pg/`) generated
from the same source. The full browser suite has been run against a real Postgres 16, not just
compiled against one.

More than one writer is only safe if two of them cannot silently overwrite each other, so
`boards` now carries a **revision**. The canvas sends the revision it loaded with every autosave;
the update is conditional on it, and a client that did not see the last save is refused with 409
rather than allowed to write. The topbar turns into "Changed elsewhere — reload", the retry loop
stops — retrying is exactly the wrong thing here, since it would land our document over theirs a
few seconds later — and nothing is lost that was not already lost. Server-side writers of the
document (a version restore, a merge accepted from the graph page, deleting a relation type) bump
the revision too, so an editor holding the pre-restore document is refused instead of quietly
undoing the restore on its next keystroke; the restore hands the new revision back to the tab that
asked for it, which is why restoring from your own History panel does not conflict with itself.
Requests with no revision keep last-writer-wins, so an older client degrades rather than breaks.

Not done: the save is still the whole document. Element-level persistence is a bigger change to
the document contract (§7) and the guard is what actually made concurrent editing safe.

### 5.20 The EA knowledge base: a module that teaches the agents (v0.2)

Nexus asks agents to do enterprise architecture, and until now the only architecture knowledge in
the building was whatever the model happened to have absorbed in training and whatever the prompt
happened to say. `packages/ea-knowledge` is the answer: **a standalone module** — its own package,
its own CLI, no import of Nexus anywhere in it — holding a curated corpus of openly-licensed EA
writing, retrieval that always answers with citations, and the doctrine the agents are grounded in.

**A curated corpus, not a crawl.** Every source is registered by hand in `src/sources.ts` with a
licence, topics and a sentence saying what it is good for. A corpus scraped from whatever is free
retrieves badly — an index cannot tell an article that *defines* a term from one that mentions it
— and cannot be shipped, because nobody checked the terms.

**Licence first.** The corpus is committed to this repository and served from a product, which is
redistribution, so the test is not "can I read it" but "may I ship it". Wikipedia (CC BY-SA 4.0)
and the Twelve-Factor App (MIT) pass; TOGAF, ArchiMate, the BIZBOK and every architecture textbook
do not. Those are listed openly in `REFERENCES` — cited and linked, never ingested — and the
Sources tab says so out loud rather than leaving a gap where the canon should be. The ingester
refuses any licence not on the redistributable list.

**Lexical retrieval, deliberately.** BM25 with a phrase boost, a title/section nudge and a cap of
two passages per document, over passages cut on paragraph boundaries that carry their heading path
("TOGAF § Architecture Development Method"). No embeddings, because the module has to work with no
model API key at all — a knowledge base that silently returns nothing without a key is not one.
It is also explainable: every hit says which of your words matched, and a term the corpus has never
seen is reported as such instead of being approximated by the nearest article.

**Two layers: evidence and doctrine.** Retrieval gives an agent evidence. What changes an agent's
behaviour is a short rule applied while it decides — "a capability is what the organisation does,
not the team that does it". Those live in `src/lesson-data.ts`, scoped to the agent they belong to,
and **every one of them quotes a passage that is really in the corpus**: `lessons.test.ts` checks
each quote against the fetched text and fails if it is not there. That is the same discipline
intake applies to a model's claims about a transcript, turned on ourselves.

Where the module shows up in the product:

- **EA knowledge** in the sidebar: search the corpus, read the doctrine, see every source with its
  licence and the works we may not redistribute. Server-rendered and URL-driven, so a passage can
  be sent to a colleague as a link.
- **Compose** and **Intake** append the relevant doctrine to their system prompts. The planner's
  failure mode is not syntax — validation catches that — it is a board that is technically fine and
  architecturally useless; the extractor's is a vocabulary mistake, a team recorded as a capability.
- **Estate health** shows the practice behind each measure, with the passage it came from: the
  difference between a metric and an argument.
- **The meta-model** puts the field's own definition next to a declared type, which is how you
  notice that your "Capability" is really a department.

Everywhere it plugs in, missing grounding is a no-op: with no corpus the agents behave exactly as
they did before. Grounding makes them better; it is not what makes them work.

`GET /api/knowledge?q=…` exposes the same retrieval to anything that is not this UI. `ea-kb` does
it from a terminal with no database and no server.

### 5.21 Time: change sets, to-be and what a plan would break (v0.2)

The graph was a snapshot. Architecture is a discipline about change, so a tool that can only
describe today can describe half the job — it can tell you what you have and nothing about what you
are doing to it.

A **change set** is a named, dated set of intentions about the estate: introduce this, retire that,
this attribute changes hands, connect these two. The decision that shapes everything else is that a
change set is **an overlay, not a mutation**. It is never applied to the graph until somebody
delivers it; until then it *projects* a to-be view. As-is therefore stays true — health, impact and
provenance keep meaning what they said — and to-be is free to be speculative, contradictory and
wrong, which is what planning actually is. Two rival plans can be compared without either of them
having happened.

`src/lib/change/project.ts` is a pure function over rows: graph + changes → the projected graph,
plus which ids were added, retired and changed. Retired systems are kept in the projection, marked,
because a view that simply dropped them would answer "what does the estate look like after this?"
while hiding the more interesting question — what was attached to the thing you are about to
remove. `settled()` is the version with them actually gone, which is what you measure. A plan that
has gone stale — retiring something already deleted, editing a system that no longer exists — is
reported change by change rather than silently skipped, and delivery refuses until it is fixed: a
half-applied plan is the hardest kind of mess to unpick.

**What it breaks.** `src/lib/change/impact.ts` answers the question a retirement decision actually
turns on, and it distinguishes four ways of being attached, because they are four different
problems: something that *depends on* the retiring system stops working; something *served by* it
loses an input; something that *supplies* it has a feed with nowhere to go — the decommissioning
job people routinely forget — and "connected" is the honest answer where the relation kind says
nothing. Direction is read from the vocabulary, so the same verb gives different answers depending
on which end is disappearing. It also names the systems that would be left attached to nothing at
all, and the second ring one hop further out.

**The roadmap** (`/w/:slug/roadmap`) puts the change sets on a timeline with as-is and to-be counts
above them, each one expandable into what it does, what it breaks and what has gone stale.
Delivering applies it to the graph — introductions become entities with `source: plan:<id>`,
retirements set `lifecycle: retired` and sever the system's relations rather than deleting the node,
because the graph is meant to outlive the things in it and a model that forgets a retired system
cannot answer "what did we replace it with".

**Sequencing.** A roadmap is not a list of independent intentions, so a change set can wait for
another: "retire the Historian and stream telemetry" is only coherent once the plan that re-points
the data lake has landed. Three things follow from modelling that rather than leaving it in
somebody's head. Delivery is refused while a blocker is outstanding — transitively, and an
abandoned blocker counts as outstanding, because a plan waiting on something that is not going to
happen is stranded and that is a decision somebody has to make. A plan is projected *in the context
of what it waits for* — its blockers applied first — so a change that connects to a system the
previous plan introduces reads as sequenced rather than as stale, which is what it looked like
before. And a plan dated earlier than something it waits for is told so: a date is a hope, but a
roadmap should point at the contradiction rather than draw it neatly. Cycles are refused when the
edge is drawn, so every reader can assume the graph is acyclic, and the to-be projection applies
plans in delivery order — blockers before dependents, date within that — because applying them by
date alone would be wrong the moment one waits for another.

**A board can be seen through a plan.** The Viewpoint panel gains a state picker: as-is, or as of
any change set. Retiring cards are struck through and hatched, changed ones marked, and the panel
says how many planned objects are not on this board and offers to place them. Placing one is an
edit and says so — but the card it creates is marked `planned`, and the board→graph sync skips
those. Drawing an intention cannot create the system: without that, dragging a planned card onto a
board would quietly deliver part of a plan nobody approved on the next autosave. The mark clears
itself when the change set is delivered and the entity exists, at which point the card becomes an
ordinary one.

### 5.22 Plateaus: states you can name, and the difference between two of them (v0.2)

A list of change sets is a list of intentions. What people actually talk about is a *state*:
"target architecture 2028", "after the platform migration". TOGAF calls it a plateau, and until it
is an object in the tool it lives in a slide — where it immediately starts drifting from the model
it claims to describe.

A plateau here stores a name, a date and a **membership**: which change sets have landed by then.
Never a copy of the estate. Its content is derived — the graph plus those change sets, projected in
delivery order — so it cannot drift, and it moves the moment the model does. Membership is explicit
rather than "everything dated before this", because two plateaus can share a date, a plan can be
deliberately excluded from one branch of a roadmap, and a membership you can see is one you can
argue with. Including a plan pulls in what it waits for and says how many it took; removing one is
refused while something else in the plateau still needs it, naming what.

**The valuable operation is subtraction.** Looking at one state is mildly useful; "what changes
between today and 2028" is the question a roadmap is actually asked, and nobody answers it by
reading two pictures side by side. `diffStates` compares any two states — as-is against a plateau,
or two future plateaus against each other — and reports what arrives, what goes, what is renamed or
retyped, which attributes move (with both values) and how many connections are made and severed.
It diffs by entity id, not by name: renaming a system is a change *to* it, and a diff that said
otherwise would report every rationalisation as churn.

**And a plateau can be measured.** Estate health runs over the projected state exactly as it runs
over today, so a roadmap can claim a number rather than a shape: 64 today, 65 after the work-order
move. A board can also be viewed at a plateau, through the same picker that shows a single change
set — one code path for "show me the board at a state", whether that state is one plan or a
milestone made of several.

### 5.23 Documentation, in the product (v0.2)

Nexus had accumulated a lot of screens and no explanation of any of them. **Documentation** is now
a menu item: twenty-two pages written for the person doing the architecture rather than the person
who built the tool, in the order somebody would actually learn it — draw something, understand what
it did, then the model, then getting data in, then time.

Three decisions make it worth having rather than another README nobody opens.

**It is illustrated from the product itself.** `scripts/capture-docs.mjs` starts a server and a
database of its own, drives the seeded demo through a real browser and writes thirty-three screenshots
into `public/docs`, which are committed. Each one is cropped to the page's own content: the
workspace navigation is identical on every screen, and repeating it in thirty pictures spends the
reader's width on something they are already looking at. The one exception is the home page, where
the navigation *is* the subject. The capture records each image's real dimensions in
`shots.json`, so the article reserves the right space and does not jump as the screenshots load.
A reader on a train sees the screen; a reviewer sees in the diff when one changed; and re-running
the script after a UI change is one command. The model is switched off for the capture on purpose
— a planner would answer differently every run and the documentation would end up describing one
lucky afternoon.

**It is data, so it can be checked.** Pages are typed block lists (prose, steps, screenshot, note,
table, keyboard reference, "try it") rather than Markdown. A unit test fails if a page references a
screenshot that is not on disk, if a screenshot has no alt text, if a "try it" link points at a
route that does not exist, if two headings share an id, or if a page escapes its section. The
failure mode of illustrated documentation is rot, and this is the only reason it is safe to promise
screenshots at all.

**Every how-to ends on the screen it describes.** A "try it" link resolves `:slug` against the
reader's own workspace, so the guide to retiring a system finishes with a button that opens *their*
roadmap. The docs are server-rendered with no interactivity beyond the contents highlight:
documentation that needs JavaScript to be read fails the person who needed it most, whose screen is
already misbehaving.

### 5.24 The time scrubber (v0.2)

Change sets say what will happen and plateaus name the states they produce, but both are read as
text. Under every board there is now a timeline — today, then each named state in date order —
and dragging along it moves the board through the roadmap: systems fade as they retire, planned
ones arrive, the counts change as you pass. Press play and it walks the whole roadmap once.

This is not decoration. An architecture audience does not read a diff table; it watches the
picture move and remembers which box went grey, and that is the difference between a roadmap
somebody agrees with in the room and one they take away to read later.

Every stop is fetched once and kept, so scrubbing is the browser's animation rather than the
network's. The stops are the workspace's plateaus where it has them — those are the states people
named, and a timeline of everything at once is a timeline nobody reads — falling back to change
sets before anybody has named a state, so the control is useful from the first plan.

The scrubber holds no position of its own: where it sits is derived from the overlay the board is
showing. An index kept alongside raced the fetch — clicking a stop set the index, the effect that
returns the scrubber to today saw an overlay that had not arrived, and put it back to zero while
the board went on into the future. One source of truth removed the race rather than timing around
it, and turning the overlay off anywhere else now moves the scrubber for free.

### 5.25 The timeline layout, and the roadmap as a board (v0.2)

The roadmap was a list. A list is not how anybody presents a plan, and the obvious fix — a roadmap
screen with a bar chart on it — is the wrong one: it adds a second place where objects live, drawn
by code that can only ever draw roadmaps.

So the capability went on the canvas instead. `src/canvas/timeline.ts` lays *any* cards out along
*any* attribute that reads as a date, in lanes made from *any* other attribute or from the card's
kind. It is pure over boxes, so it is tested without a browser and reused by three callers: the
Viewpoint panel (**Timeline → Along / In lanes by**), Compose (`lay out applications on a timeline
by end of support in lanes by owner`), and the roadmap.

- Dates are read forgivingly about form and strictly about ambiguity: `2027-03-14`, `2027-03`,
  `2027`, `2027 Q3`, `Q3 2027`, `March 2027`, `Mar 2027`. Anything else — including a bare number
  that cannot be a year — is treated as having no date and parked in a lane of its own.
- Granularity follows the span: months, then quarters, then years. Every period between the first
  and the last gets a column *including the empty ones*, so a gap in the plan stays visible.
- Columns are equal width rather than a linear time scale, because a linear scale spends the board
  on the gap between two clusters and squeezes the clusters into nothing.
- The layout starts below whatever is already on the board, and everything it draws — lanes as
  frames, period labels as section blocks — is an ordinary board object.

**Lay out on a board** on the roadmap (`src/lib/change/board.ts`) then becomes a thin thing: it
works out which objects each plan touches, in delivery order, makes one card per object carrying
`when`, `change` and `effect` as ordinary attributes, and hands them to the layout. An object
touched by two plans appears once, at the first plan that touches it, with the later ones named on
the card — a card is one object in one place, and drawing it twice would make the board disagree
with the model.

The cards deliberately do **not** carry `meta.entityId`. An entity-backed card is kept in step with
its entity in both directions, so opening the board would overwrite `when` and `effect` with the
system's own attributes and saving it would write the change note into Maximo's description. A
roadmap card is a statement *about* a system at a date; it records which one it means in
`meta.about` and otherwise stays out of the graph. Introductions keep the `planned` mark, so the
board still says which boxes do not exist yet.


### 5.26 The agent that reads the graph (v0.2)

§2.2 says the agents build the meta-model. Until now the only model in the product read *sources* —
a transcript, a document — and everything proposed about the graph itself came from hand-written
rules. Rules are fast, free and deterministic, and they can only find what somebody wrote a rule
for: that two objects share a name, that a kind is spelled two ways. They cannot see that "PI
Server" and "Historian" are the same product, that a thing described as "our work-order system" is
an Application, or that a description saying "pulls meter reads from the head-end" is a relation
nobody has drawn.

**Ask the agent**, on the Knowledge graph page, hands the whole graph to a model and asks what is
wrong with it. What comes back is a plan, not an edit — the same plan-then-validate boundary as
Compose (§5.17), pointed at the model of the estate rather than at a board:

- **Five verbs and no others.** setKind, renameKind, merge, setAttribute, addRelation. There is no
  verb for deleting an object, editing a board, changing a grant or reaching anything outside the
  graph, so the worst a confused or hostile model can produce is a card somebody has to click.
- **Every id is checked** against the graph that was actually sent, so a hallucinated system cannot
  become a proposal about a system.
- **Every claim must quote the graph.** The model names the object it read and copies the words it
  read; the words are checked against that object's own kind, name, description and attributes. An
  unquotable claim is dropped and the count of drops is shown, so a quiet agent and a wrong one look
  different. This is the discipline intake already applies to a transcript (§5.15) — and it is the
  difference between "the model thinks this is an Application" and "the model read *work-order
  management* on it".
- **Its confidence is capped, not trusted.** A model proposal is never "high", so it is never in
  *Accept the confident ones*; a proposed merge is always "low", because it is the one irreversible
  action here. It may fill a blank attribute and never overwrite one somebody has answered.

The run is grounded in the EA knowledge base (§5.20) under the `modelling` scope, and the statements
it was given are shown beneath the queue. That closes a loop the corpus had been missing: until now
the knowledge base had a library page and no consumer.

Model proposals are stored (`agent_proposals`) rather than recomputed, because asking costs money
and gives a different answer each time; a re-run replaces the last one, so the agent has one current
opinion rather than a growing pile. Accepting or dismissing removes the row, and the decision in
`agent_decisions` is what stops a later run raising it again. The agent and the rules share a key
scheme on purpose: when both spot the same thing one card is shown, and it is the one that can say
why — a rule that has noticed an untyped object knows only that it is untyped, while the agent
arrives quoting the sentence it read.

Everything that decides whether an answer is safe is pure, so the interesting half of the agent is
tested without a key — including the answers a model gets wrong, which is the half that matters.


### 5.27 Agents on the board (v0.2)

§5.26 put a model behind a button on the Knowledge graph page. That is a useful thing and a small
idea: an agent you have to go somewhere to consult is a feature of a page, and this product is a
canvas. The point of an AI-native platform is not a screen where the AI lives; it is that agents are
*present in the work*.

So an agent is now an element. You place it with a tool like a card or a note, it renders as an
object on the board, you drag it, duplicate it, lock it, delete it, and it appears in the board's
version history like everything else. What makes it an agent is three things a person controls
directly:

- **A purpose, in their words.** The purpose field is the whole interface. It is the instruction the
  agent is given, which means two agents on one board with different purposes are genuinely two
  different agents rather than two copies of one feature.
- **A scope decided by where it sits.** *The board*, *its frame* — the smallest frame containing it,
  so dragging it into "OT estate" changes its job — or *what it joins*, the objects a line connects
  it to. Every other tool would make somebody write a filter. On a canvas, where a thing sits
  already means something, and it means it to everybody looking at the board rather than only to the
  person who wrote the query.
- **A voice that is not an edit.** It answers with **remarks**: a short note pinned to one object,
  quoting the words on that object which prompted it. The object gets a badge; you read the remark
  on the object itself; you keep it as a note, or dismiss it. An agent on a board changes nothing by
  speaking, which is what makes it safe to have several of them, always there, in the middle of
  somebody's thinking.

Remarks live in the document rather than in a table, because a remark is an annotation on a drawing:
it should travel with the drawing, be exported with it, be undone with it, and be there for the
colleague who opens the board next week.

The validator is the same boundary as everywhere else (`lib/agent/remarks.ts`): a remark must be
about something the agent was actually shown and must quote that object's own words, one remark per
object, and silence is a valid answer. What cannot be grounded is thrown away before anybody sees
it. The closed schema has no verb that changes anything at all — which is a stronger guarantee than
§5.26's five verbs, and the reason an agent can sit on a board unattended.

Everything about scope and speech is pure over the document, so what an agent may see and may say is
tested without a browser or a model key.


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
  kind lens, saved views per board). ~~Automatic layouts~~ force-directed done in the explorer
  (§5.13). Next: relation-type filters, overlays (lifecycle, risk, ownership), lanes/radial
  layouts on boards.
- Connectors framework and first sources (~~file import~~ done as CSV/JSON import,
  ServiceNow, CMDB, wiki).
- Agent framework: classification, meta-model proposal, ~~entity resolution~~ (rules done),
  enrichment, with human review queue (the accept / dismiss flow exists; LLM-backed
  proposal sources are next).
- ~~Search across boards and the graph~~ done: home search over boards + objects, board command bar with structured graph queries (§5.10). Next: natural-language translation by the agent layer.
- Board templates; ~~export (PNG)~~ done (SVG rev 17, PNG rev 33); PDF export; comments.
- Sovereign deployment package (containers, Postgres, object storage, model gateway).
- **The agent framework** — agents as objects in the graph, a run log, a fleet view, model providers
  as an admin setting (including sovereign/local endpoints), Nexus as an MCP server, and agents
  proposing agents behind a human signature. Surveyed and designed in `docs/AGENT-FRAMEWORK.md`.

## 6a. What exists today (v0.2, 2026-09-06 — rev 61)

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

### Agent proposals on the canvas (v0.2)
- ✦ badge on cards with open proposals; review and accept / dismiss from the Selection inspector,
  with the document patched to match.

### Agent proposals (v0.2)
- Rule-based proposals with evidence and confidence: duplicate merge, kind normalisation,
  untyped entities, unlabelled relations, orphans (§5.6).
- Accept / dismiss with remembered decisions; inline inputs for kinds and labels.
- In-canvas duplicate hint with one-click merge in the Selection inspector.

### Polish (v0.2, rev 21)
- Right-click a note → *Turn into card*: the note becomes an untyped card in place (title / body →
  title / description, fresh entity id) so ideas captured as notes flow into the graph; the
  untyped-kind proposal then suggests a kind.
- Attribute keys on the kind cards of the Knowledge graph page are renameable in place (rename
  across the workspace), complementing the automatic key-variant proposals.
- Shortcuts panel lists multi-select, smart-guide bypass, right-click actions, alignment and
  presentation mode.

### Entity deep links (v0.2)
- `/e/:id` opens the entity drawer; inspector and home "Recently changed" chips link to it.

### Entity drawer (v0.2)
- Detail drawer for any entity on the Knowledge graph page: edit fields and attributes, navigate
  relations, add / delete relations (board connectors cleaned up), jump to boards, merge
  duplicates, delete.

### Link to existing (v0.2)
- Title matches an existing entity → one click links the card to it (dedupe at creation).

### Drag from the inventory (v0.2)
- Entities drag out of the board's Graph inventory and drop where you release them; the kind
  header drags the whole un-placed group. The "+" buttons still place into a centred grid.

### Intake — ingestion layer (v0.2)
- `/w/[slug]/intake`: sources (transcript / document / CSV upload or paste), a seven-stage
  pipeline drawn as a flow, and a review of everything it found — objects, connections and
  viewpoints (decisions, actions, risks, questions, needs) — each with its confidence and the
  sentence behind it. Accepted objects are written to the graph with the source itself as a node,
  `mentions` edges carrying their evidence, and people joined to the meetings they attended.
- Landscape view: everything taken in, as a navigable graph (the explorer, scoped to intake).
- Connector catalogue: 16 enterprise sources, 4 built and the rest marked planned.

### Estate health (v0.2)
- One score on the Knowledge graph page over six measures, each with what good looks like, a
  sentence about this workspace, and a route to the fix — bulk edit, merge proposal or Intake.

### Compose — writing the board (v0.2)
- A Compose panel on every board: ask in plain English and a model plans the board, or write the
  script yourself. Either way the plan is validated into one closed instruction set and executed
  by the same pure executor, with the answer, every step, and anything refused shown on screen.
  Needs `ANTHROPIC_API_KEY` + `NEXUS_MODEL`; without them the rule compiler runs and says so.

### Source catalogue (v0.2)
- `/w/[slug]/intake?view=catalog`: a browsable catalogue of 17 sources with scope trees down to
  named modules and tables; a grant panel where a human allows access scope by scope, with what
  each scope yields, what it enables and how sensitive it is written next to the box. Grants,
  declines and revocations are recorded (`connections`, `connection_scopes`).
- Estate scan: five channels read (entities, attributes, ingested sources, boards, meta-model),
  fingerprint matching on hostnames, table names, transaction codes, endpoints and build files,
  and a report saying where it looked and what it found. Systems no vendor catalogue knows are
  grouped by domain and can be registered into this workspace's own catalogue
  (`catalog_entries`); entities nothing explains are reported as gaps.

### Meta-model builder (v0.2)
- `/w/[slug]/meta`: hierarchy of node and relation types with fields and rules; declare, rename,
  restructure and constrain; declared-vs-observed drift and rule violations surfaced.
- Diagram tab: the meta-model on a canvas — a box per node type, an arc per relation type,
  coloured by rule / observed / violation, with bundled arcs, self-loops, pan-zoom, focus
  highlighting and click-through to the detail pane. Redraws as the model changes.

### Graph explorer (v0.2)
- `/w/[slug]/explore`: the whole graph as a force-directed, canvas-rendered node-link view with
  pan/zoom, node dragging, focus-and-neighbours highlighting, kind legend, search and a detail
  panel. Sidebar entry next to Knowledge graph.

### Import preview (v0.2)
- Live dry run in the import dialog: new / existing counts, kinds, attribute columns, relations,
  warnings. Card kind fields suggest the workspace's kinds.

### Entity table (v0.2)
- Spreadsheet view of entities on the Knowledge graph page: attribute columns from the emergent
  schema, sort, inline editing, add column, copy as CSV, row selection with bulk set attribute /
  set kind / delete.
- Context menu on a frame: create a board from its contents.

### Attribute proposals (v0.2)
- Rename attribute keys that differ by case / separators, normalise value spellings, fill in
  attributes that (almost) every entity of a kind carries — with accept / dismiss memory like
  the other rules. CSV import without a `description` column now treats every extra column as
  an attribute.

### Lenses (v0.2)
- Impact lens (direction, depth), attribute lens (colour by value), relation lens (colour
  connectors by type, toggle types) and query lens (living graph query with place-missing) in the Viewpoint tab; cards badge their hop distance or
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

### Export & present (v0.2)
- Export menu in the topbar: Download SVG, Download PNG (2×), Copy SVG, Present (chrome-free, frames as slides with
  arrow keys, Esc to leave).
- Command-bar autocomplete for the query language from the live vocabulary.

### Alignment (v0.2)
- Align and distribute buttons in the selection bar for multi-selections; one undo step.

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

### The store (v0.2)
- SQLite or Postgres from one schema: `schema.pg.ts` generated from `schema.ts`, drift caught by a
  unit test, a migration folder per dialect, and the browser suite verified against Postgres 16.
- Conditional board saves: `boards.revision`, a 409 on a stale write, "Changed elsewhere — reload"
  in the topbar, and server-side document writers bumping the revision so a restore wins.

### EA knowledge base (v0.2)
- `packages/ea-knowledge`: a standalone module — corpus, retrieval, doctrine, CLI — that imports
  nothing from Nexus.
- A curated, openly-licensed corpus with a licence per source, and the unshippable canon listed as
  referenced-only.
- BM25 retrieval with citations that works with no model API key; `GET /api/knowledge` and `ea-kb`.
- Doctrine scoped per agent, every rule quoting the corpus verbatim, enforced by a test.
- Grounding in Compose, Intake, estate health and the meta-model — a no-op when no corpus is built.

### Time and change (v0.2)
- Change sets: named, dated intentions (introduce / retire / change / connect / disconnect), held
  as overlays and projected, never applied until delivered.
- Impact analysis over the graph: depends-on / served-by / supplies / connected, systems left
  orphaned, and the second ring.
- `/w/:slug/roadmap`: a timeline, as-is vs to-be counts, what each plan breaks, stale changes
  reported, and delivery.
- A board seen as-is or as of a change set; planned cards are drawings of an intention and cannot
  create the system.
- A time scrubber under every board: step or play through the roadmap and watch the landscape
  become its own future.
- Dependencies between change sets: cycle-free, delivery blocked until blockers land, projection in
  the context of what a plan waits for, delivery-order numbering and schedule contradictions named.
- Plateaus: named, dated states defined by which change sets have landed; derived, never stored;
  compared as a diff (arrives / goes / changes, with both values); measured with estate health; and
  viewable on a board through the same state picker.
- A timeline layout on the canvas: lay any board out along any date-shaped attribute, in lanes by
  any other attribute or by kind — from the Viewpoint panel or from a Compose line. Unreadable dates
  are parked, never guessed at.
- **Lay out on a board** on the roadmap: the chosen plans drawn as an ordinary board, one card per
  object with `when`, `change` and `effect` as attributes, laid out by that same timeline.

### The agent that reads the graph (v0.2)
- **Ask the agent** on the Knowledge graph page: a model reads the whole graph and proposes
  corrections into the same review queue as the rules, badged and reviewed one at a time.
- Five verbs and no others; every id checked against the graph; every claim quoting the object it
  came from, with the quote checked and the drops counted.
- Never high confidence, never a bulk accept, never an overwrite of an attribute somebody answered,
  and a proposed merge always low.
- Grounded in the EA knowledge base, with the practice it was given shown under the queue.
- One stored run per workspace; a decision removes the card and is remembered.

### Agents on the board (v0.2)
- An agent is an element: place it with the **A** tool, name it, write what it is for, and it is an
  ordinary object you can drag, duplicate, lock, export and undo.
- Scope is where you put it: the board, the frame it sits in, or the objects you join it to.
- It answers with remarks pinned to the objects it read, each quoting their own words; the object
  carries a badge and the remark is read in place.
- **Keep as a note** makes it yours; **Dismiss** removes it; the agent changes nothing by speaking.
- The closed schema has no verb that alters anything, so an agent can sit on a board unattended.

### Documentation (v0.2)
- Twenty-two in-app pages under **Documentation**, from a first board through to plateaus, with a
  glossary, a keyboard reference and the questions people ask.
- Thirty-three screenshots captured from the seeded demo by `pnpm docs:capture` and committed.
- Ten tests over the docs as data: missing screenshots, unrecorded image sizes, missing alt text,
  dead links, duplicate heading ids, orphaned pages, and that search finds the page a person would
  be looking for.

### Quality gates
- `pnpm typecheck`, `pnpm lint` (Next + TypeScript ESLint), `pnpm test` (Vitest, 69 tests:
  camera math, panel-aware fit, align/distribute, box/resize/connector geometry, store history,
  frame behaviour and frame→board extraction, lenses (impact / attribute / relation / query),
  document diff, SVG export and PNG sizing, link-to-existing, graph sync / hydrate / import /
  layout, proposal rules incl. attribute normalisation, relation create/delete, graph
  neighbourhood, version checkpoints / restore, query parsing and autocomplete — all against an
  in-memory SQLite).
- **CI** (`.github/workflows/gates.yml`) runs typecheck, lint and the unit tests on one job and the
  browser suite on another, for every push and pull request. A failing browser run uploads
  `e2e/failure.png` as an artifact. This is only possible because the suite brings its own server
  and database; before that there was nothing for a runner to point at.
- `pnpm e2e` (Playwright) starts **a server and a database of its own** — a temporary SQLite file,
  a free port, migrations and seed on the first request, the routes warmed in a browser, then the
  suite, then the file is deleted. Every run therefore begins from the same known workspace, which
  is what lets the tests assert rather than guard. `BASE_URL=… pnpm e2e:attach` runs against a
  server that is already up, for the fast local loop. It drives the real browser through
  the home, space and team pages and the canvas — create note (typing into the focused
  title), drag, zoom, pan, fit, inspector, delete, undo, card, rectangle, connector,
  command-bar search, structured graph query, viewpoint tab and kind lens, impact lens, history
  checkpoint and compare, entity table view, entity deep link, autosave, reload, graph import,
  create board from a starter, intake pipeline and review, the source catalogue and a grant,
  registering and removing an unrecognised system, estate health and its drill-through, writing a
  board with Compose. A failing assertion leaves `e2e/failure.png` and prints where it was.
- The shared-password gate (§5.12) is exercised separately: with NEXUS_ACCESS_PASSWORD set,
  `/api/health` must stay open, protected paths must redirect, a wrong password must be
  rejected and a correct one must land on the originally requested page.

### Known gaps (intentional for brief 1)
- No per-user authentication or authorisation; everyone is the seeded demo user. A deployed
  instance can be closed off with a single shared password (§5.12) until real auth lands.
- Single workspace; no multiplayer; no comments.
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
pnpm e2e            # isolated: its own server, its own database, cleaned up afterwards
pnpm build && pnpm start
```

The SQLite file lives in `apps/web/data/nexus.db` (git-ignored). Migrations in
`apps/web/drizzle` run automatically on first request; the demo seed runs when the
database is empty. Delete the file to reset. Schema changes: edit
`apps/web/src/db/schema.ts`, then `pnpm db:generate`.

- `pnpm db:reset` deletes `apps/web/data/nexus.db` (stop the dev server first — it keeps the
  old file open); the next request recreates and re-seeds it. The e2e suite no longer touches
  this database, so resets are only needed after your own experiments.
- The HTTP routes, server actions, query grammar and import format are documented in
  `docs/API.md`; keep it in step with `src/app/api` and `src/lib/actions.ts`.

### Deploying

`Dockerfile` + `railway.json` deploy the app to Railway (or any Docker host). The database is
the same SQLite file, on a volume mounted at `/data` (`DATABASE_URL=file:/data/nexus.db`);
`GET /api/health` runs migrations + seed on first call, reports readiness and names the dialect it
is running on. Point `DATABASE_URL` at a Postgres instance to leave the single-volume limit behind
(§5.19); `pnpm db:pg:schema` regenerates the Postgres schema and `pnpm db:pg:generate` its
migrations. Steps in `docs/DEPLOY.md`.


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
| 2026-09-05 | First deployment keeps SQLite on a Railway volume instead of adding Postgres now. | One service, one file, zero extra infrastructure gets the product in front of users today; Drizzle keeps the SQL portable and `DATABASE_URL` is the only switch. The trade-off (single instance, no read replicas) is acceptable for a pilot. |
| 2026-09-04 | Deleting a graph relation rewrites board documents to drop its connectors. | Same resurrection problem as merge: the board document is the client's truth while open and `syncBoardToGraph` upserts relations from connectors on every save. Rewriting the stored document (and letting an open board reload) is the only consistent option. |
| 2026-09-04 | Export is SVG generated from the document, not a DOM/canvas screenshot. | Vector output scales into slides and design tools, needs no headless browser on the server, and works offline in the client; PNG can be derived from it later. Fidelity is "faithful enough" rather than pixel identical. |
| 2026-09-04 | Lenses never mutate the document; the impact lens walks *board connectors*, not the workspace graph. | What you see is what you traverse: the user controls which relations are on the board (Show all relations / expand) and the lens explains exactly that picture. A graph-backed variant can come later as "expand then lens". |
| 2026-09-04 | The board canvas is client-only (`dynamic(..., { ssr: false })`) with a loading shell. | Server-rendering a thousand absolutely positioned nodes doubled the payload and the hydration cost for zero benefit — the canvas needs the viewport size before it can place anything. |
| 2026-09-04 | Grid and minimap are drawn on `<canvas>`; the world transform is set imperatively. | These are the three things that change on *every* pan/zoom frame. Keeping them out of React (and out of CSS gradient repaints) is what made navigation frame-bound instead of render-bound. |
| 2026-09-04 | Layers memoise children on a joined-ids string; components subscribe to their own slice. | A drag mutates `elements` every pointer move; without id-keyed memoisation React recreated 700 elements per frame even though every child bailed out. |
| 2026-09-04 | Fonts load from a client component after mount rather than a `<link>` in `<head>`. | The render-blocking stylesheet stalled first paint for up to 13 s behind the sandbox proxy; the fallback stack (Aptos / system sans) is close enough that the swap is barely visible. |

| 2026-09-05 | An ingested source becomes a node in the graph, and provenance rides on the edges. | A meeting is not metadata hanging off the applications it mentioned — it is a thing with attendees, subjects and decisions, and the questions worth asking ("which meetings touched this system?") are graph questions. Putting the quote on the `mentions` edge means evidence is navigable instead of buried in an audit table. |
| 2026-09-05 | Extraction and commitment are separate actions; nothing is written without a human tick. | The whole argument for reading meetings automatically only holds if a person can see what was concluded, and the evidence for it, before the graph believes it. It also makes the extractor safe to improve aggressively. |
| 2026-09-05 | The extractor is deterministic and rule-based, behind shapes a model can replace. | The interesting half of the design is the evidence-carrying review workflow, not the classifier. Rules are testable, explainable and need no key; an LLM slots in behind `Candidate`/`Viewpoint` without changing a line of the UI. |
| 2026-09-05 | Objects intake writes itself (Meeting, Decision, Risk, Action, Question, Need) are excluded from the recognition vocabulary. | A risk is named by the sentence somebody said. Left in the vocabulary, the next run over the same meeting finds that sentence in the text and offers the risk as a thing being discussed — the graph reading its own notes back to itself. |
| 2026-09-05 | The intake landscape reuses the graph explorer rather than adding a second viewer. | Search, focus, hop-limiting and path tracing already exist and are better than anything a scoped-down second implementation would have; the explorer only needed an `embedded` mode. |

| 2026-09-05 | The catalogue is a grant surface, not a connector list: access is granted per scope path, with purpose and sensitivity shown at the point of decision. | "Connect SAP" is not a decision anyone can take responsibly. "Read Plant Maintenance equipment and functional locations, nothing else, because it answers which applications touch which assets" is. Least privilege is a product surface here rather than a config file. |
| 2026-09-05 | The discovery agent proposes only from evidence already in Nexus (the graph and ingested sources), never from a network scan. | It is the honest version of "the agent found SAP", and in practice the stronger one — four meetings arguing about SAP PM say more about whether it matters here than an open port does. It also keeps the agent inside data the workspace already holds. |
| 2026-09-05 | Grants are materialised: a module grant stores every path it covers. | Storing only the parent is more compact and reads on screen as a narrower grant than it is. On a consent record, being imprecise in that direction is the wrong bug to have. |

| 2026-09-05 | Discovery matches fingerprints — hostnames, table names, tcodes, endpoints, build files — not only product names, and scores them by weight. | A system is usually visible in an organisation's own material long before anyone writes its name down: a ServiceNow instance host in a meeting is proof, where "we should look at ticketing" is nothing. Weighting is what lets a single passing mention stay below the floor instead of generating noise. |
| 2026-09-05 | Hosts nobody's catalogue claims are first-class findings, and can be registered into the workspace's own catalogue. | Every enterprise runs systems no vendor list contains, and they are usually the ones that matter. A catalogue that cannot grow to fit the estate quietly redefines the estate as whatever the catalogue already knew. |

| 2026-09-05 | A written board compiles to the existing query grammar rather than interpreting English directly, and shows the compiled form. | The grammar is already the single definition of what a question means (§5.10). Compiling into it keeps one source of truth, makes every line arguable, and means an LLM front-end later changes only the compiler — not what the board is. |
| 2026-09-05 | A compose build rebuilds the board from empty by default. | If the script only ever added to what was there, the text and the picture would drift apart within minutes and the script would stop describing the board. The cost is that a rebuild discards work, so it says how much it will replace and asks first. |

| 2026-09-05 | The model plans; a closed instruction set is the boundary. Nothing the planner returns reaches the executor unvalidated. | Workspace content — entity names, meeting transcripts — is in the prompt, so the prompt is untrusted by construction. Making the model's only expressible output a board script means an injected instruction has nothing to reach: there is no verb for deleting data or calling out. It also means the model can be swapped, degraded or absent without changing what a board is. |
| 2026-09-05 | No default model id in the repo; `ANTHROPIC_API_KEY` and `NEXUS_MODEL` are required together. | A board built by a model the operator did not choose, at a cost they did not agree, is not a good surprise. The rule compiler makes the unconfigured case useful rather than broken. |

| 2026-09-05 | The planner may read the graph before it answers, through a second read-only tool with its own bounded vocabulary. | A planner that cannot look can only produce plausible sentences; one that can look produces checkable ones. Keeping inspection a separate, read-only tool means the thing it can *see* and the thing it can *do* are validated independently — and both are shown to the person. |
| 2026-09-05 | Health is one weighted number with six measures, each carrying the entities behind it. | A dashboard of six numbers is ignored; one number with a word attached ("thin") is argued with, which is the point. Carrying the entity ids is what turns the argument into work: the number is one click from the rows that cause it. |

| 2026-09-05 | The e2e suite runs against a database and server of its own, created and destroyed per run. | Sharing the development database was wrong in both directions: the suite silted the demo up (a note per run, and one careless rebuild emptied a seeded board), and the demo's drift broke the suite — three false failures in an afternoon, and the meta-model coverage quietly disappearing as earlier runs declared every type there was. A known starting state is what lets a test assert instead of guard. |
| 2026-09-06 | Documentation is authored as typed data, not Markdown. | A page here is not only prose — it has procedures, screenshots with captions, and links that resolve to the reader's own workspace. Typed blocks give all of that with no parser to get subtly wrong, and let a test fail when a screenshot or a route disappears. |
| 2026-09-06 | Screenshots are captured from the running product by a script and committed. | Hand-taken screenshots rot silently and nobody notices until a reader does. A script that brings its own server and database can be re-run after any UI change, and committing the output means the diff shows when a screen changed. |
| 2026-09-06 | The time scrubber derives its position from the overlay rather than keeping an index. | The index it kept raced the fetch and reset itself to today while the board showed the future. Deriving state that already exists elsewhere removes the race instead of timing around it. |
| 2026-09-06 | A plateau stores a name, a date and a membership — never a copy of the estate. | A stored copy is a slide: it starts drifting from the model the moment either changes. Deriving the state means a plateau is always exactly as true as the graph it describes. |
| 2026-09-06 | Plateau membership is explicit, not "every change set dated before it". | Two plateaus can share a date, a plan can be deliberately excluded from one branch of a roadmap, and a membership somebody can see is one they can argue with. Blockers are pulled in with their dependents, because a state that includes a plan but not what it waits for cannot exist. |
| 2026-09-06 | The plateau diff compares by entity id, never by name. | Renaming a system is a change to it, not a death and a birth. A name-based diff would report every rationalisation as churn and bury the real movement. |
| 2026-09-06 | A change set is projected in the context of its blockers, not against today's graph. | Otherwise a plan that connects to a system the previous plan introduces reports a problem where there is only an order — and a roadmap that cries stale at correct sequencing teaches people to ignore it. |
| 2026-09-06 | An abandoned blocker does not satisfy a dependency. | A plan waiting on something that is not going to happen is stranded. Letting it through quietly would hide exactly the decision somebody needs to make about it. |
| 2026-09-06 | Dependency cycles are refused when the edge is written, not when delivery is attempted. | Two plans that each wait for the other is not a roadmap anybody can deliver, and the honest moment to say so is while somebody is drawing it. It also lets every reader assume the graph is acyclic. |
| 2026-09-06 | A change set is an overlay projected over the graph, never a mutation of it. | As-is has to stay true or health, impact and provenance stop meaning anything; to-be has to be free to be wrong, because planning is. Keeping the two apart is also what lets two rival plans be compared without either having happened. |
| 2026-09-06 | Delivering a retirement sets `lifecycle: retired` and severs its relations rather than deleting the node. | The graph outlives the things in it. A system retired last year is the answer to "what did we replace it with", and a model that forgets it cannot answer that. Deleting an entity stays a separate, deliberate act. |
| 2026-09-06 | A card placed from a change set is marked `planned` and skipped by the board→graph sync. | Otherwise drawing an intention on a board would create the system on the next autosave — delivering part of a plan nobody approved, through a gesture that looks like arranging a picture. |
| 2026-09-06 | Delivery refuses a change set with stale changes rather than applying what still fits. | A partially applied plan is the hardest state to reason about afterwards, and the person is the only one who can decide whether a change that no longer fits should be dropped or repointed. |
| 2026-09-06 | The EA knowledge base is a separate package, not a folder in the web app. | The product owner asked for a module that stands alone and teaches the agents. A package with its own CLI and no import of Nexus can be shown to be standalone rather than merely described that way — and the constraint is what forced retrieval to work without a database, a server or a model key. |
| 2026-09-06 | Lexical retrieval (BM25) rather than embeddings. | The module must work with no model API key: a knowledge base that silently returns nothing without one is not a knowledge base. Lexical retrieval is also explainable — every hit names the words that matched — which matters when the point of a citation is that a human can check it. |
| 2026-09-06 | The corpus is committed, and only openly-licensed sources may enter it. | Shipping the text is what makes the module work offline and lets a human read exactly what the agents are grounded in. That is redistribution, so the licence gate is not optional; the canon that cannot be shipped is listed openly as referenced-only rather than quietly omitted. |
| 2026-09-06 | Every lesson must quote the corpus verbatim, checked by a test. | A hand-written file of "what is true about architecture" is exactly where plausible folklore accumulates. Tying each rule to a passage that must exist is the only cheap defence, and it is the same rule we already impose on the model in intake. |
| 2026-09-05 | The Postgres schema is generated from the SQLite one, not maintained by hand. | Two hand-written schemas diverge the first time someone is in a hurry, and the divergence shows up as a missing column in production. A generator plus a `--check` test makes drift a failing test instead. |
| 2026-09-05 | A stale board save is refused (409) rather than merged or retried. | We have no merge, so writing anyway would drop somebody's work silently — the worst outcome. Retrying is the same thing on a delay. Refusing, saying so, and offering a reload is the only honest option until real-time collaboration exists. |
| 2026-09-06 | A time axis is a canvas layout, not a roadmap screen. | A roadmap screen can only ever draw roadmaps. A layout that puts any cards along any date-shaped attribute answers the same question and also answers "when does each of these contracts expire", and it keeps every object on the canvas where it can be dragged, coloured, queried and exported like everything else. |
| 2026-09-06 | Timeline columns are equal-width periods, not a linear time scale. | A linear scale spends most of the board on the gap between two clusters and squeezes the clusters into nothing: accurate and unreadable. Equal periods keep every card legible and still put earlier things to the left, which is all anybody reads off a timeline. |
| 2026-09-06 | A date that does not clearly parse is parked, never guessed. | A card silently placed in 1970 is a lie the reader cannot catch; a card in the "no date" lane is a question somebody can answer. This is why a bare `1200` is a cost, not a year. |
| 2026-09-06 | Cards on a roadmap board reference their object in `meta.about`, not `meta.entityId`. | An entity-backed card is synchronised with its entity both ways: the board would lose its `when` and `effect` on open, and write the change note into the system's description on save. A roadmap card is a statement about a system at a date, not the system. |
| 2026-09-06 | The model may propose five changes to the graph and nothing else. | A closed verb list is the whole safety story: the graph, entity names and imported documents all go into the prompt, so anything in the workspace could in principle try to instruct the model. It does not matter when the only thing it can express is a suggestion somebody has to click, and there is no verb for deleting, exporting or calling anything. |
| 2026-09-06 | Every agent proposal must quote the object it came from, checked against that object's text. | A confidence score is the model's opinion of its own opinion; a quote is checkable. It is also what makes a wrong agent visible — the number of claims thrown away is shown rather than swallowed into "no proposals", which would read as "your graph is fine". |
| 2026-09-06 | An agent proposal is never high confidence and never bulk-acceptable. | Bulk accept exists for deterministic rules that need no judgement. Applying a model's guesses fifty at a time is the fastest way to lose the trust the whole review queue depends on, and a merge — the one irreversible action — is capped lower still. |
| 2026-09-06 | The agent runs when asked, and its answer is stored rather than recomputed. | It costs money and a second or two, and gives a different answer each time. Recomputing on page load would be expensive, non-deterministic and resented; storing one current run makes it a thing you review at leisure. |
| 2026-09-06 | Where a rule and the agent propose the same thing, the one with evidence wins. | They share a key scheme so the collision is detectable at all. A rule that has spotted an untyped object knows only that it is untyped; the agent arrives quoting the sentence. Showing both would be a duplicate, and showing the weaker one would waste the better answer. |


| 2026-09-06 | An agent is an element on the board, not a page. | An agent you have to go somewhere to consult is a feature of a page; this product is a canvas, and the claim "AI-native" means agents present in the work rather than a screen where the AI lives. Being an element also gets it dragging, duplication, locking, export, undo and version history for nothing. |
| 2026-09-06 | A board agent's scope is where you put it, not a query. | On a canvas, position already carries meaning — this frame is the OT estate, these three cards are the ones under discussion. Dragging an agent into a frame says what it watches faster than any filter language, and says it to everybody looking at the board rather than only to whoever wrote the query. |
| 2026-09-06 | A board agent answers with remarks, and remarks change nothing. | Its schema has no verb that alters anything at all. That is what makes it safe for several agents to sit on a board unattended in the middle of somebody's thinking — and "keep as a note" is the only way its words become part of the board, which keeps a person the author of what the board says. |
| 2026-09-06 | Remarks live in the document, not in a table. | A remark is an annotation on a drawing. It should travel with the drawing: exported with it, undone with it, versioned with it, and there for whoever opens the board next week. |
| 2026-09-06 | An agent is drawn in exports rather than skipped. | An element you can see on screen and cannot find in the picture you exported is a small betrayal, even when the element is scaffolding. Its remarks are not drawn — those belong to the objects they are about, and anybody who wants one in the picture keeps it as a note first. |



## 8. Open questions for the product owner

- Which catalogue entry should be built first for real (ServiceNow CMDB? Entra ID app
  registrations? SAP PM)? The scope trees are modelled; the fetching is not.
- Should a granted scope also carry a schedule (read once, nightly, on demand), or is that a
  property of the connection rather than the grant?
- Should optics be user-authored (query + layout), agent-suggested, or both?
- Real-time collaboration: how early is it needed relative to ingestion and agents?
- Sovereign deployment: which model providers must be supported locally?

## 9. Changelog

- **2026-09-06 — Rev 61: agents live on the board.** Rev 60 put a model behind a button on a page,
  which is a useful thing and a small idea: an agent you have to go somewhere to consult is a feature
  of a page, and this product is a canvas. An agent is now an *element*. Place it with the Agent tool
  where the work is, name it, and write what it is for in your own words — that text is the
  instruction it gets, so two agents on one board are genuinely two agents. What it can see is
  decided by where it sits: the whole board, the frame you dropped it into, or the objects you join
  it to with a line; nobody writes a filter, and everybody looking at the board can see what each
  agent is watching. It answers with remarks — a note pinned to one object, quoting the words on that
  object which prompted it — and the object carries a badge you click to read it in place. Keep it as
  a note and it becomes yours; dismiss it and it is gone. The schema it must answer in has no verb
  that changes anything at all, which is why an agent can sit on a board unattended. Remarks live in
  the document, so they are exported, undone and versioned with the drawing they annotate. 15 new
  tests over scope and speech, a new documentation page, and an e2e path that places an agent,
  scopes it by frame and checks that one which cannot run says so on the board.

- **2026-09-06 — Rev 60: an agent that reads the graph.** The brief has always said the agents build
  the meta-model; until now the only model in the product read sources, and everything proposed about
  the graph itself came from rules that can only find what a rule describes. **Ask the agent** hands
  the whole graph to a model and asks what is wrong with it. It may propose five things — set a kind,
  rename a kind, merge, set a missing attribute, draw a relation — and nothing else, so the worst it
  can produce is a card somebody has to click. Every id is checked against the graph that was sent,
  and every claim has to quote the object it came from, with the quote checked against that object's
  own words; what cannot be quoted is thrown away and counted where the reviewer can see it. Its
  confidence is capped rather than trusted: never high, never bulk-acceptable, a merge always low,
  and never an overwrite of an attribute somebody has already answered. The run is grounded in the EA
  knowledge base, which finally gives the corpus a consumer rather than a library page. Proposals are
  stored as one current run per workspace, land in the existing accept / dismiss queue beside the
  rules', and lose a collision only to a rule that can also say why. 27 new tests, all of them
  without a model key — everything that decides whether an answer is safe is pure.

- **2026-09-06 — Rev 59: a time axis for any board, and the roadmap drawn on one.** The roadmap was
  a list, and a list is not how anybody presents a plan. Rather than add a roadmap screen, the
  canvas gained a general capability: lay any board out along any attribute that reads as a date, in
  lanes made from any other attribute or from the card's kind. It is offered in the Viewpoint panel,
  in Compose (`lay out applications on a timeline by end of support in lanes by owner`) and, now, by
  **Lay out on a board** on the roadmap — which turns the chosen change sets into an ordinary board
  of cards carrying `when`, `change` and `effect` as attributes and lets the generic layout do the
  drawing. An object touched by two plans appears once, at the earliest, with the later plans named
  on it; introductions stay marked planned. The cards reference their object in `meta.about` rather
  than `meta.entityId`, because an entity-backed card would have its roadmap attributes overwritten
  on open and would write the change note back into the system on save. Dates are read forgivingly
  about form and strictly about ambiguity — a bare `1200` is a cost, not a year — and anything
  unreadable is parked in a lane of its own instead of being placed wrongly. 25 new unit tests, two
  new e2e paths and two new documentation pages' worth of screenshots.

- **2026-09-06 — Rev 58: the demo roadmap, backfilled.** The seed only runs on an empty database,
  so the deployed instance — set up long before change sets existed — showed an empty Roadmap for
  ever, which reads as a broken feature rather than an unused one. A narrow, idempotent backfill now
  runs on boot: it touches only the demo workspace, by slug, and only when that workspace has no
  change set at all, so seeded example plans can never turn up beside somebody's real planning or
  in a real organisation's workspace. Five tests reproduce the older instance and check both halves
  — that it gets its roadmap, and that repeated boots do not give it a second one.

- **2026-09-06 — Rev 57: the time scrubber.** A timeline under every board — today, then each named
  state in date order. Click a stop, step with the arrows or press play, and the landscape becomes
  its own future: retiring systems fade and strike through, planned ones arrive, the counts move as
  you pass. It uses the workspace's plateaus where there are any and falls back to change sets
  before anybody has named a state. Every stop is fetched once and cached, so the movement is the
  browser's rather than the network's. Its position is derived from the overlay rather than tracked
  beside it, after an index of its own raced the fetch and snapped back to today while the board
  went on into the future.

- **2026-09-06 — Rev 56: a route in the wrong directory.** The two plateau API routes had been
  written to the repository root rather than into `apps/web`, so Next never registered them: the
  board's state picker asked for the workspace's named states, got a 404, and — because the fetch
  failure was swallowed — simply offered none. Nothing caught it. Typecheck and lint only run inside
  the packages, and the end-to-end suite exercised the overlay through a change set but never
  through a plateau. Moved, and the suite now selects a plateau on a board and asserts the impact
  line it produces, which is the check that would have failed loudly the first time.

- **2026-09-06 — Rev 55: screenshots cropped to their subject.** Every documentation screenshot
  included the workspace navigation, which is the same on every screen — thirty repetitions of the
  sidebar, spending the reader's width on the one thing they were already looking at. The capture
  script now crops each shot to the page's own content, keeping the whole window only for the home
  page, where the navigation is the subject. Since cropped and full-window captures no longer share
  an aspect ratio, the script also records each image's real dimensions in `shots.json` and the
  renderer uses them, so the article reserves the right space instead of jumping as the images
  load; a test fails if a shot is missing from that manifest.

- **2026-09-06 — Rev 54: the documentation.** Nineteen in-app pages under a new **Documentation**
  menu item, written for architects using Nexus and ordered the way somebody would learn it, from a
  first board through the model and intake to change sets and plateaus — plus a glossary, a keyboard
  reference and the questions people actually ask (what happens when two of us edit, why deleting a
  card did not delete the system, where the data lives). It is illustrated with thirty screenshots
  captured from the seeded demo by `pnpm docs:capture`, which brings its own server and database and
  runs with the model switched off so the pictures are the same on every machine. Pages are typed
  block lists rather than Markdown, which is what lets nine tests fail the build when a screenshot
  goes missing, an image has no alt text, a "try it" link points nowhere, or a page falls out of its
  section. Each guide ends with a link that opens the screen it describes in the reader's own
  workspace.

- **2026-09-06 — Rev 53: plateaus.** The states people actually talk about — "target architecture
  2028" — are now objects rather than slides. A plateau stores a name, a date and which change sets
  have landed by then; its content is derived from the graph and those plans, so it cannot drift.
  Membership is explicit and coherent: including a plan pulls in what it waits for, and removing one
  is refused while something in the plateau still needs it. The point of the screen is subtraction —
  any two states can be compared, today against a plateau or two future plateaus against each other,
  reporting what arrives, what goes, what is renamed, which attributes move and how many connections
  are made or severed, diffed by entity id so a rename reads as a change rather than a death and a
  birth. Estate health runs over a projected state exactly as over today, so the roadmap can claim
  a number. A board can be viewed at a plateau through the same picker as a single change set.
  Two seeded plateaus, 10 unit tests, and e2e over the diff, the comparison between two plateaus and
  the coherence refusal.

- **2026-09-06 — Rev 52: plans that wait for other plans.** A change set can now depend on another,
  which turns a list of intentions into a sequence. Delivery is refused while a blocker is
  outstanding — transitively, and an abandoned blocker counts, because a plan waiting on something
  that will not happen is stranded rather than free. Each plan is projected *in the context of what
  it waits for*, which fixes a real wrongness in rev 51: a change connecting to a system the
  previous plan introduces was reported as stale when it was only sequenced. Cycles are refused as
  the edge is drawn, the to-be projection applies plans in delivery order rather than by date, the
  roadmap numbers them in that order, and a plan dated before something it waits for is told so.
  14 new unit tests over the ordering, and e2e over the waiting badge, the blocked delivery and the
  refused cycle.

- **2026-09-06 — Rev 51: the model in time.** The graph could only describe today. It now carries
  *change sets*: named, dated sets of intentions — introduce, retire, change, connect — held as
  overlays and projected rather than applied, so as-is stays true while a plan is free to be wrong.
  `src/lib/change` is pure over rows: projection, settling, and an impact analysis that separates
  the four ways of being attached to something that is going (depends on it, is served by it,
  feeds it, merely connected), names what would be left orphaned, and reads direction from the
  relation vocabulary rather than assuming every arrow is a dependency. A plan that has gone stale
  is reported change by change, and delivery refuses until it is fixed. The new **Roadmap** page
  puts change sets on a timeline with as-is and to-be counts and what each one breaks; delivering
  applies it, retiring by setting `lifecycle: retired` and severing relations rather than deleting
  the node. A board can now be viewed as-is or as of a change set, with retiring cards struck
  through and planned ones placeable — and a placed card is marked `planned` so the sync skips it,
  because drawing an intention must never create the system. Two seeded plans against the demo
  estate, 17 unit tests over the pure functions, two over the invariant, and e2e coverage of the
  whole path.

- **2026-09-06 — Rev 50: an EA knowledge base the agents are taught from.** A new standalone
  package, `packages/ea-knowledge`, with its own CLI and no import of Nexus: a curated corpus of
  openly-licensed enterprise-architecture writing (a licence recorded per source; the unshippable
  canon — TOGAF, ArchiMate, the textbooks — listed openly as referenced-only), BM25 retrieval that
  works with no model API key and answers with citations, and the doctrine the agents are grounded
  in. The doctrine is the part that changes behaviour: short rules scoped per agent, each quoting a
  passage that is really in the corpus, with a test that fails if it is not — the discipline intake
  already applies to the model, turned on ourselves. It shows up as an **EA knowledge** page
  (search, doctrine, sources and licences), as grounding appended to the Compose planner and the
  intake extractor, as the practice behind each estate-health measure, and as the field's own
  definition next to a declared meta-model type. With no corpus every one of those is a no-op, so
  grounding makes the agents better without being what makes them work. `GET /api/knowledge` and
  `ea-kb ask` expose the same retrieval outside the UI.

- **2026-09-05 — Rev 49: two dialects and a save that can be refused.** The store is no longer tied
  to one SQLite file on one volume: the connection string picks the driver, and the Postgres schema
  is generated from the SQLite one so the two cannot drift (a unit test runs the generator with
  `--check`). The full browser suite passes against a real Postgres 16. With more than one writer
  possible, `boards` gained a revision: the canvas sends the revision it loaded, the update is
  conditional on it, and a client that missed somebody else's save is told so (409, "Changed
  elsewhere — reload") instead of overwriting them — and the retry loop stops, because retrying
  would do the overwrite a few seconds later. Version restore, entity merges and relation deletion
  bump the revision too, so an open tab cannot quietly undo them; the restore route hands the new
  revision back so your own restore never conflicts with itself. Clients that send no revision keep
  the old behaviour. 6 new unit tests. Element-level incremental persistence is explicitly not part
  of this — the whole document is still written on save.

- **2026-09-05 — Rev 48: health that can be fixed, not just read.** Estate health now shows, per
  measure, how much of the gap the agent can already close from evidence the graph holds, and a
  bulk accept applies the confident ones. `src/lib/proposals-evidence.ts` adds two rules that read
  intake's own record back out: ownership from whoever raised an action or decision *about* a
  system (a question is not a claim on it; two claimants produce silence rather than a guess; bare
  attendance is offered only at low confidence, saying that being present is not owning), and
  lifecycle from a viewpoint that states one — "out of support" is an end of life. Every proposal
  cites the sentence behind it and goes through the existing accept/dismiss flow. The bulk button
  takes only what needs no judgement, and says how many objects it will touch before it does,
  because a merge cannot be undone. One bulk accept on the seed workspace moved the score from 40
  to 71. 11 unit tests over the rules.

- **2026-09-05 — Rev 47: a model reads the sources, and has to show its working.** Intake's
  extraction is now done by a model where one is configured: the passages go to it and it returns
  objects, connections and viewpoints in the same shapes the rules produce, with the same review
  screen in front of them. What makes it safe is not the prompt but the check — every claim must
  quote the source, and the quote is verified against the passage it cites, words and all. A
  fabricated system is dropped ("quoted words that are not in p1"), a connection between things it
  did not propose is refused, viewpoints are attributed to whoever actually spoke, and kinds are
  snapped onto the workspace's vocabulary. The workbench says which reader ran and lists what was
  dropped. 8 unit tests over the validation boundary, including invented quotes, invented
  endpoints, invented viewpoint types and outright rubbish; the whole path was exercised against a
  stand-in endpoint returning a reading with two fabrications, both of which were refused.

- **2026-09-05 — Rev 46: a written board remembers its words, and the gates run themselves.**
  The Compose script is now part of the board document, so reopening a written board shows the
  script that produced it, ready to edit and re-run — the claim "the script is the board" is only
  true if the script is still there when you come back. A planner-written board stores the script
  the planner decided on, with the request kept as a comment line above it. And
  `.github/workflows/gates.yml` runs typecheck, lint, unit tests and the browser suite on every
  push and pull request, uploading the failure screenshot as an artifact — possible only because
  the suite now carries its own server and database.

- **2026-09-05 — Rev 45: the tests get a database of their own.** `pnpm e2e` now starts its own
  server on a free port against a temporary SQLite file, seeds it, warms the routes in a browser,
  runs the suite and deletes the database. Nothing it does can touch the demo workspace, and every
  run starts from the same known seed — so five defensive guards became assertions, including the
  meta-model's declare-a-type path, which had silently stopped being exercised once earlier runs
  had declared every undeclared type in the shared database. A failing assertion now leaves a
  screenshot and says where it was, which is how the last problem here was found at all.

  Two things learned the hard way. Warming a dev server with `fetch` is not enough: that compiles
  the server route, while the client bundle is only built when a browser asks — the warm-up drives
  a real browser and waits for something each page only shows once it works. And the runner must
  address its server as `localhost`, not `127.0.0.1`: the numeric form had its chunks and HMR
  socket intercepted here, so the canvas never loaded at all, which looked for an hour exactly
  like a slow test.

- **2026-09-05 — Rev 44: the planner looks, and the estate has a score.** Two improvements to
  what was already there. Compose's planner gained `inspect_graph`, a read-only tool for counts,
  samples, distinct attribute values, relation types and neighbourhoods: it now looks two or three
  times before it plans, every look is bounded and shown to the person, and an inspection it was
  not offered is refused. And the Knowledge graph page gained **estate health** — one weighted
  score over provenance, duplicates, typing, connectedness, ownership and lifecycle, each measure
  saying what good looks like, what is true here, and where the fix lives. The seed workspace
  scores 40. Clicking a measure pins its offenders into the entity table; the duplicates measure
  points at the merge proposals already on the page. 12 new unit tests over inspection bounds and
  the health arithmetic, e2e over the panel and the drill-through.

  One bug worth recording: the health panel rendered but could not be clicked, because as a flex
  item in an already-overflowing column it was shrunk to two pixels tall and painted clipped. The
  same shape of bug as the inventory panel in rev 20. `flex: 0 0 auto` on anything dropped into
  `.studio-home-main`.

- **2026-09-05 — Rev 43: Compose answers in plain English.** The front end of Compose is now a
  model. Ask *"show me the applications that depend on SCADA, and what they support"* and a
  planner returns a board script plus a sentence answering you; the script is validated against
  the closed instruction set — steps clamped, kinds and attributes snapped onto what this
  workspace has, anything else dropped and shown as dropped — and executed by the same pure
  executor as before. The panel shows the answer, every step with what it did, which planner ran,
  and what was refused. Configuration is deliberate and joint (`ANTHROPIC_API_KEY` +
  `NEXUS_MODEL`, optional `NEXUS_MODEL_BASE_URL` for a gateway); without it the rule compiler
  reads the lines and the panel says what to set. 7 new unit tests over the validation boundary
  and the configuration gate; the whole request/response path was exercised against a stand-in
  endpoint, including a planner returning a `drop_database` step, which is refused.

- **2026-09-05 — Rev 42: compose — write the board.** A Compose panel on every board: type what it
  should contain and it is built, with nothing dragged. `add all applications`, `add anything that
  depends on SCADA`, `expand 1 hop via "depends on"`, `connect them`, `group by lifecycle`,
  `lay out as flow`, `colour by criticality`, `title`, `note`, `clear`. Every line is compiled on
  the server against the workspace's real kinds, relation types and attribute keys, echoed back as
  the query grammar it became, and reported with what it did; a line it cannot read says so and
  lists the verbs it knows. A build rebuilds from empty by default so the script and the board stay
  the same thing, warning first about what it replaces. The executor is pure, so the same script
  over the same graph gives the same board down to the coordinates — 19 unit tests cover the
  compiler, the matcher, each verb, reproducibility and layout wrapping; e2e writes a board on a
  freshly created one. `src/lib/compose/`, `POST /api/graph/compose`.

- **2026-09-05 — Rev 41: the estate scan.** Discovery grew from name matching into a proper
  survey. It now reads five channels — entities, their attributes, ingested sources, board text
  and the declared meta-model — and reports how much of each it read, so a survey that cannot say
  where it looked is no longer possible. Every provider gained a fingerprint set: instance
  hostnames, table and column names, SAP transaction codes, OPC UA endpoints, and build files only
  one toolchain produces. Confidence is the weighted sum of what matched, so a hostname is
  near-proof and one passing product name stays below the floor. Hosts are normalised to the
  machine, and filenames are rejected as hosts. Hosts no vendor claims are grouped by registrable
  domain, listed as unrecognised with where they were seen, and can be registered into this
  workspace's own catalogue (`catalog_entries`, migration 0007) — after which the next scan
  recognises them. The scan also reports system-like entities that nothing explains: on the seed
  workspace, 50 of them. 14 unit tests, e2e over the scan report, the grant panel, registering an
  unrecognised system and removing it again.

- **2026-09-05 — Rev 40: the source catalogue.** Intake gained a third view: a browsable
  catalogue of everywhere Nexus could reach, and the machinery for deciding what an agent may
  actually read. A discovery agent proposes systems it found evidence for — entities in the graph
  with no source behind them, and systems the ingested meetings kept naming — quoting that
  evidence and asking for at most three scopes, least sensitive first. A human then grants access
  scope by scope down to named modules and tables (SAP PM → EQUI), with what each scope yields in
  the graph, what it would let the organisation ask, its sensitivity and its rough volume written
  next to the checkbox. Ticking a module takes its objects; taking one object back drops the
  module. Grants carry a note, personal-data selections are called out, declines are remembered
  and revoking removes the rows. Seventeen sources across five categories, three built. New tables
  `connections` and `connection_scopes` (migration 0006), 8 unit tests over discovery and the
  grant algebra, e2e over the catalogue and the grant panel.

  Two bugs fixed on the way: the meta-model builder rendered its field and rule forms as soon as a
  type's *presence* said declared, which for the moment before the refreshed model arrived meant
  posting a null type id and silently doing nothing — both are now gated on the declaration id.
  And the smoke suite now removes the note it creates, instead of silting up the demo board a
  little more on every run.

- **2026-09-05 — Rev 39: intake, the ingestion layer.** A new top-level view at `/w/[slug]/intake`
  that turns unconsolidated data into graph. Upload or paste a Teams/Zoom transcript, minutes or a
  CSV; a seven-stage pipeline is drawn as a flow with its counts, and everything it found is
  listed for review with a confidence, a reason and the quote that produced it: objects (known,
  typed, emergent), the people who spoke, the subjects the source was *about*, the connections it
  described, and viewpoints — decisions, actions, risks, questions and needs, attributed to
  whoever raised them. Accepting writes it into the graph with the source itself as a node, so a
  meeting is an object connected to its attendees, its subjects and the systems it touched, and
  every `mentions` edge carries its evidence. A second Landscape view draws all of that as a
  navigable graph (the explorer, embedded and scoped). New tables `sources` and `source_runs`
  (migration 0005), a connector catalogue of 16 enterprise sources with four built, 22 unit tests
  across parsing, extraction, the pipeline report and the commit, and e2e that reads the sample
  meeting end to end. Also fixed: the workspace sidebar emitted a React key warning once its nav
  grew past seven links (the compiler builds the list as an array at that size).

- **2026-09-05 — Rev 38: the meta-model on a canvas.** The builder's right pane gained a
  *Diagram* tab beside *Details*: the meta-model drawn as a type-level graph — one box per node
  type, one arc per relation type — so the abstraction is visible rather than only the instances.
  Arcs are coloured by origin (declared rule / observed in the data / breaks a rule), relation
  types joining the same pair fan out as separate labelled arcs, self-relations loop, and the
  diagram shares its selection with the tree in both directions. Because it derives from the same
  merged model on every render, declaring a type or adding a rule redraws it at once — adding
  `Interface —provides→ Data Object` immediately draws the new rule and turns the pair it
  disallows red. `src/lib/metamodel-graph.ts` (5 unit tests) holds the reduction to types;
  `separateBoxes()` in `src/lib/force.ts` replaces the earlier whole-layout scaling, which cleared
  overlaps only by shrinking the diagram. e2e covers the tab, non-overlapping boxes and
  click-through.

- **2026-09-05 — Rev 37: meta-model builder.** A new top-level view at `/w/[slug]/meta` giving
  the technical picture of the schema: a left-hand hierarchy of node and relation types with
  their fields and observed connections, and a detail pane to declare, rename, restructure and
  constrain them. Adds the declared half of the meta-model (migration 0004) and merges it with
  the emergent half, so drift — undeclared kinds and fields, and edges that break a declared
  rule — is visible rather than hidden. Renames propagate to instances. 4 unit tests cover the
  merge and violation detection; e2e declares a type and adds a field.

- **2026-09-05 — Rev 36: drag entities onto the canvas.** The Graph inventory's rows (and a kind
  header, for the whole un-placed group) are now drag sources; dropping on the canvas creates the
  card centred on the pointer instead of in the middle of the viewport, with a dashed drop
  affordance while dragging. Card construction moved to `src/canvas/entityCard.ts` so the drop
  and the "+" button build identical, correctly linked cards.

  Worth recording because it cost the bug: the canvas root's `onMouseDown` calls
  `preventDefault()` to stop the canvas stealing focus, and the panels live *inside* that root.
  preventDefault on mousedown also cancels a native drag before `dragstart` fires, so the drag
  silently did nothing. The root now leaves `[draggable="true"]` sources alone. (Note for future
  testing: synthetic `mouse.down/move/up` does not trigger HTML5 drag events — e2e uses
  Playwright's `dragTo`.)

- **2026-09-05 — Rev 34: graph explorer.** A new whole-graph view at `/w/[slug]/explore`,
  complementing the curated boards: force-directed layout (pure, seeded, unit-tested), canvas
  rendering, pan/zoom/drag navigation, focus highlighting of a node and its neighbours, kind
  legend, search, and a detail panel that links through to the entity drawer. E2E now loads the
  explorer, asserts the canvas actually painted, and opens an entity through search.

- **2026-09-05 — Rev 35: path tracing, hop focus, fragmentation.** The explorer can answer "how
  are these two connected?": shift-click two entities and the shortest route lights up, with the
  chain named in a banner. The detail panel gained a *show within N hops* filter, and the hint
  line reports how many disconnected groups the graph has. Algorithms live in a pure
  `src/lib/graph-algo.ts` (BFS shortest path, hop distances, connected components) with 7 unit
  tests; e2e traces a real path between two entities.

- **2026-09-05 — Rev 33: PNG export.** "Download PNG" in the export menu rasterises the existing
  SVG client-side at 2×, with the longest edge clamped to 8000 px. Verified end to end: the
  download produces a valid 2480×1252 PNG of the seeded landscape board.

- **2026-09-05 — Rev 32: optional shared-password access gate.** `NEXUS_ACCESS_PASSWORD` closes
  a deployed instance behind one password (§5.12); unset, nothing changes. Implemented on Next
  16's `proxy` convention with an HMAC cookie, a `/login` page, and `/api/health` deliberately
  exempt so platform health checks still pass. Verified end to end: health bypasses, protected
  paths redirect, a wrong password is rejected, a correct one lands on the requested page.

- **2026-09-05 — Rev 31: denser chrome, bigger canvas.** The board shell was taking too much
  room from the drawing surface. Topbar 54→46 px, graph panel 280→238, inspector 270→234,
  command bar 850→720 with 17→14 px input, tool rail and map/zoom cards tightened, panel and
  status type down a step. `fitInsets` was updated to match the real widths (they are duplicated
  in `store.ts` and must move together) — zoom-to-fit on the seeded landscape board goes from
  76 % to 86 % at 1600×1000, i.e. the same board renders ~13 % larger.

- **2026-09-05 — Rev 30: Railway deployment.** Root `Dockerfile` (pnpm monorepo build, Next
  production server, `/data` volume for the SQLite file), `railway.json` with a health check,
  `GET /api/health` readiness route, `docs/DEPLOY.md` with the click-through.

- **2026-09-04 — Rev 29: link to existing entity.** Cards offer to link to an existing entity
  when their title matches one; entity names are suggested while typing. Vocabulary (kinds,
  entities) now lives in the board store.

- **2026-09-04 — Rev 28: import preview, kind suggestions.** The CSV / JSON parser moved to a
  pure module shared with the client; the import dialog previews new vs. existing entities,
  kinds, attributes, relations and warnings before importing. Card kind fields get a datalist
  of the workspace's kinds.

- **2026-09-04 — Rev 27: frames as slides, query autocomplete.** Presentation mode steps through
  frames with the keyboard (‹ › buttons and a "Frame n of m" pill); the command bar completes
  query tokens from kinds, relation types, entity names, attribute keys and values.

- **2026-09-04 — Rev 26: query lens, home entity search.** Fourth lens type turns a graph query
  into a living view (re-run on apply, place missing results); the home search also returns
  entities from the graph with deep links.

- **2026-09-04 — Rev 25: bulk edits, board from frame.** Row selection and a bulk bar (set
  attribute, set kind, delete) in the entity table; "Create board from frame" in the canvas
  context menu with a pure `documentFromFrame` helper (unit-tested) and a server action that
  seeds and graph-syncs the new board.

- **2026-09-04 — Rev 24: proposals on the canvas.** Proposals are fetched into the board store
  after each save; affected cards show a ✦ badge and the inspector lets you accept or dismiss
  them in place, patching the open document to mirror the graph change.

- **2026-09-04 — Rev 23: entity deep links, recently changed.** `/e/:id` route, `?entity=`
  drawer opening on the graph page, "Open in graph" from the canvas inspector, and a
  "Recently changed" chip row on the home page.

- **2026-09-04 — Rev 22: graph-first relation editing.** Add and delete relations from the
  entity drawer (deduped create, delete strips board connectors), with unit tests and two new
  server actions.

- **2026-09-04 — Rev 21: note promotion, attribute key rename, shortcuts.** Context-menu *Turn
  into card* for notes (single undo step, unit + e2e tested), click-to-rename attribute keys on
  kind cards backed by a new server action, and an updated Shortcuts panel.

- **2026-09-04 — Rev 20: API documentation, db:reset.** New `docs/API.md` (routes, server
  actions, query grammar, import format, document shape), README feature overview, and a
  `pnpm db:reset` script for a clean demo database.

- **2026-09-04 — Rev 19: query clauses has / missing / on.** The graph query language gained
  attribute-presence filters (`has:`, `missing:` with `without:` / `no:` aliases) and board
  scoping (`on:` / `board:`), each explained in the hit's "why"; command-bar example chips
  updated.

- **2026-09-04 — Rev 18: entity drawer.** Entity names on the Knowledge graph page (list and
  table) open a detail drawer: editable fields and attributes, navigable relations, board links,
  duplicate merge and delete.

- **2026-09-04 — Rev 17: SVG export, presentation mode.** Topbar Export menu with Download SVG /
  Copy SVG (pure document → SVG renderer, unit-tested) and Present (hides topbar, tool rail,
  panels and command bar, fits the board edge to edge, Esc leaves).

- **2026-09-04 — Rev 16: alignment tools, version compare.** Align / distribute group in the
  selection bar (frames carry contents, single undo step). History panel gained *Compare*: a
  structural diff between any checkpoint and the current board with focus-on-click, backed by a
  new version-document endpoint and a pure `diffDocuments` helper.

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
