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

## 4b. Five directions for a tighter look (proposal, 2026-09-09)

The owner's note: *"we are still too Miro cartoonish"*. It is a fair reading of what is on screen.
The visual language Nexus inherited is a whiteboard's — 12–16px radii on everything, chunky pill
chips for attributes, soft blue shadows, a pastel note, loose vertical rhythm. None of it is wrong
for a drawing toy and all of it undersells a system of record that an enterprise architect is meant
to defend in a governance forum.

Five directions were drawn, as standalone HTML in **`docs/design/mocks`**, rendered by
`apps/web/scripts/capture-mocks.mjs`. All five show the *same* board with the same six objects and
the same five connections, so the difference between them is the argument and not the content.
Nothing here is wired into the app — this is a proposal awaiting the owner's pick.

| # | Direction | Thesis | What changes |
|---|---|---|---|
| 1 | **Blueprint** | Architecture is drafting, not sticky notes. | Hairlines and no shadows at all; 2px corners; `« stereotype »` headers and UML-ish compartments; mono for every machine-shaped value; colour reduced to a 3px rule on one edge; a drawing frame with a title block (sheet, notation, as-of, revision). |
| 2 | **Console** | The people who live in this spend their day in Linear, Grafana and an IDE. | Graphite surfaces, one accent, 4px radii, 26px rows, chrome flush to the edges with no floating cards; attribute chips become `key value` in mono; the inspector is a property grid. |
| 3 | **Ledger** | An EA repository's job is to be believed. | Tabular figures, hairline rules, every fact carrying its source underneath it; headline numbers in the topbar; the inspector is a property sheet; a footnote on the canvas saying how much of the board nothing explains. |
| 4 | **Notation-aware** | The reason it looks like a whiteboard is that every object is the same rounded rectangle. | The shape follows the framework: a C4 container with its technology line, a UML class with three compartments, a DDD aggregate inside a dashed consistency boundary. This is the visual half of §5.57. |
| 5 | **Focus** | Rev 89 took chrome from 43% to 32%; go further. | One 44px rail and one command strip are the whole of the permanent chrome. The title sits on the canvas. Panels become sheets that slide in and are gone again. Hidden panels advertise their key. |

They are not mutually exclusive: 1 and 3 share a palette, 4 is a capability rather than a skin and
belongs under whichever of the others is chosen, and 5 is a layout decision that any of the four
could wear. A reasonable outcome is one skin plus 4 plus 5.

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

> **Superseded in part by §5.68 (rev 102).** The data layer, the force simulation and the
> canvas rendering described here are unchanged and still power the **Map** view. The single
> whole-graph view, the floating legend/search/detail cards, the dim-on-select behaviour and
> shift-click path tracing described below were replaced by three views, a permanent rail and
> named pickers. Read §5.68 for what the explorer is now.

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

Health is not conformance (§5.56). These six measures are general EA standards that nobody in this
organisation chose; conformance asks the narrower question of whether the data obeys the rules these
people wrote down for themselves. Both screens link to the other, because the answers differ.

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
a menu item: twenty-eight pages written for the person doing the architecture rather than the person
who built the tool, in the order somebody would actually learn it — draw something, understand what
it did, then the model, then the agents, then getting data in, then time.

Three decisions make it worth having rather than another README nobody opens.

**It is illustrated from the product itself.** `scripts/capture-docs.mjs` starts a server and a
database of its own, drives the seeded demo through a real browser and writes forty-one screenshots
into `public/docs`, which are committed. A name on the command line narrows a run to the shots a
change made stale, which is what makes re-capturing a habit rather than an afternoon. Each one is cropped to the page's own content: the
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
route that does not exist, if two headings share an id, if a page escapes its section, or if a page
uses inline markup the renderer does not understand — that last one arrived after a hundred-odd
`*emphasised*` phrases turned out to be reaching readers with their asterisks showing, which is
exactly the kind of rot a person stops noticing after a week. The
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


### 5.28 Ambient agents, and the fleet (v0.2)

Two more places, and one place to see them all.

**Ask about a selection.** The other two agents need somewhere to live: a page, or a spot on the
board. This one needs nothing. Select any objects and the Selection panel offers *Ask about these* —
the selection *is* the scope, which is the fastest way there is of saying "these ones", and nothing
is set up, saved or left behind. It answers in prose plus citations: each object it read, with the
words it read on it, clickable to fly to the thing named. A citation that cannot be found on the
object it names is dropped and the drop is counted; an answer with nothing left to cite is still
shown, marked as an opinion rather than a reading. The prose is the model's and is presented as the
model's — what makes it usable is the checkable list underneath it.

**The fleet** (`/w/:slug/agents`). Agents are scattered on purpose, and scattering is only humane if
there is one page that answers how many there are, what each is watching, and whether anybody is
listening to them.

The number it leads with is deliberately not runs, tokens or remarks made. It is **kept**: how often
a person turned what an agent said into a note of their own. Every other metric an agent could
report measures it talking; this one measures it being useful, and it is the one that gets worse
when an agent starts padding. The page says what the number means in words — "too early to say",
"people keep most of what it says", "almost everything it says is waved away; change its purpose or
delete it" — rather than in a colour nobody can read out loud.

Remarks live in the board document, so answering one removes it. The record of *how it was answered*
therefore cannot live there: `agent_remark_outcomes` keeps a row per answer, with the agent's name
copied in, so deleting an agent does not erase how it did — which is exactly the moment somebody is
about to write the same agent again.

While building this the remark popover moved to a portal: inside the card it lived in the canvas's
transformed world, underneath the selection toolbar that appears over whatever you have just
clicked, so the remark you wanted to read was covered by the buttons for the thing it was about.

The three agent surfaces are also now one section of the documentation rather than scattered through
the sections of the product they happen to touch — they read as one subject, because they are one.


### 5.29 The type scale, tightened (v0.2)

A craft pass over the shell, keeping the LeanFlow language and changing its weight.

The app had no stated base font size, so everything drawn with `font: inherit` — the navigation,
every button, every input — was rendering at the browser's 16px. The sidebar in particular read as a
consumer app rather than a tool somebody spends a day in: 16px semibold links, 12px of padding each,
8px between them, 20px icons, in a 320px column.

`body` now states 14px/1.5, and the shell is tuned around it: a 268px sidebar; navigation at 13px
with 6px padding and 1px gaps, muted icons that take the accent colour only when active, and a
pill for the count; a page title at 23px instead of 30px; a lede capped at 68 characters; and the
documentation's own scale brought into line with the rest so the two stop disagreeing.

Two things the pass caught, which are the reason to do these by looking rather than by rule:

- The line above a page title is an eyebrow on most pages and a whole sentence on the Knowledge
  graph. Uppercasing it — the obvious thing for an eyebrow — shouted a paragraph. It is small and
  quiet instead, and not uppercased anywhere.
- The "no model is configured" sentence was borrowing a class meant for a two-word legend:
  uppercase, right-aligned and 280px wide, so an honest explanation became four lines of shouting
  in the corner. Prose gets prose styling.

Every committed documentation screenshot was re-captured, because a type-scale change makes all of
them wrong at once — which is exactly the rot the capture script exists to prevent.


### 5.30 Reading what people actually have (v0.2)

*Renamed in rev 70: this was "the landing zone", and it was framed as an application-portfolio
feature. It is the reading half of **Import** (§5.36) — the same machinery, pointed at whatever the
data is about.*

Real data does not arrive as a clean CSV. It arrives as a ServiceNow export, a spreadsheet
somebody has maintained since 2019, a SharePoint list and a Word document from a governance review —
four files that disagree with each other and with the model. Nexus now takes all four, works on them
where a person can see them, and takes only what that person agrees with.

**Reading what people actually have** (`lib/apm/read.ts`). CSV and TSV with quoted fields, embedded
commas and newlines, CRLF, byte-order marks and UTF-16 — the things a decade-old Windows export
really contains. JSON including ServiceNow's `{ result: [...] }` wrapper, taking the readable half
of a reference field. Excel and Word, both of which are zip archives of XML: eighty lines of ZIP
(`unzip.ts`) reads the central directory and inflates what it needs, which seemed a better trade
than a dependency for two well-specified containers. A document arrives as prose rather than being
squeezed into columns, because a governance review is read for claims (§5.15), not tabulated.

**Proposing what the columns mean** (`map.ts`). Rules rather than a model — it must work with no
key, give the same answer twice, and an export header's vocabulary is small enough that rules are
simply better. Every column gets a role and a sentence saying why, and a person can change any of
it. Two judgements are worth naming:

- A relation column is one whose values *name things*. "Hosting" reads like a relation and holds
  "on premise"; "Depends on" holds the names of other systems. Given the names this batch and the
  graph know, that is decidable — so the mapping runs twice, once to find each file's name column
  and once knowing every name in the batch.
- Dates are read from ISO, Excel serials, spelled months and slash formats — and a slash column is
  judged as a whole: one value with a day above twelve settles the order for the column. A genuinely
  ambiguous column is left alone and flagged rather than guessed, because a roadmap a month out is
  worse than a blank.

**Provenance per field** (`stage.ts`). The same application in two files is one record; the trust
order is the order of the files, and the losing value is kept beside the winner rather than dropped.
Rows fold on the source's own key where there is one and on the name otherwise — and two rows that
both carry keys are never folded however alike their names, because that is what a key is for.
Columns that name people are held apart and excluded until somebody ticks a box.

**Matching, graded and visible** (`match.ts`). A source key is a fact; a name plus a kind is strong;
a name alone is worth looking at; a near name is a question and never an answer. Where the graph has
one name twice and nothing tells them apart, it refuses to pick and offers both.

**The review** (`review.ts`) turns all of that into blockers, questions and notes, defaults each row
to accept or hold from its worst issue, and lets a person override any of it. It counts the
unchanged rows separately, because a re-import is mostly unchanged and a review that opens on four
hundred unremarkable rows is a review that gets rubber-stamped. It also raises what the source has
*stopped* claiming — never as a deletion, because a system missing from this month's export has been
retired, moved out of scope, or filtered, and only a person knows which.

**Drawing it** (`board.ts`). The batch as an ordinary board, laid out by what would happen to each
object, every card marked `planned` so drawing it creates nothing (§5.21).

**Approving and putting it back** (`actions.ts`). Exactly one function writes and one undoes. The
write records what it did as it went — every object created, every field overwritten and the value
that was there before — and the rollback reverts only that: an object it created is deleted only if
nothing has been connected to it or drawn from it since, and a field is restored only if it still
holds what the batch put there. Everything it declines to touch is counted and named, because a
rollback that quietly leaves half the estate changed is worse than one that admits it cannot finish.


### 5.31 Where the thinking happens (v0.2)

Until now a model was two environment variables: one provider, chosen at deploy time, for
everything. That is wrong in three directions at once. An organisation that wants Claude for the
careful work and a model of its own for the frequent work cannot have it. A sovereign deployment
cannot point Nexus at its own gateway without a redeploy. And nobody inside the product can tell
what it is talking to. **Settings → Models** (`/w/:slug/settings/models`) replaces all of that.

**Two dialects, not a list of vendors** (`lib/models/types.ts`, `translate.ts`). There are two
request shapes that matter — Anthropic's Messages API and OpenAI's chat completions — and
everything else in the world speaks the second: Ollama, vLLM, llama.cpp, Azure, a national cloud's
gateway, a LiteLLM proxy. Modelling the *dialect* rather than the vendor is what makes a model an
organisation hosts itself a first-class option rather than a special case. The translation is small
and one-way-testable: the system prompt moves into the messages, a tool becomes a function, a
tool call comes back as `tool_use`. The one thing that must survive it is **"answer with exactly
this tool"** — `tool_choice` — because a closed schema is the whole safety mechanism behind
Compose, intake and every agent (§5.17, §5.26, §5.27). A small model that fences its JSON in a code
block is salvaged; one that answers with prose yields an empty input rather than an exception.

**One call point** (`call.ts`). Every model call in the product now goes through `callModel`, so a
new dialect, a timeout, a retry or an audit trail is one file rather than five. `probe` is the same
path with a one-token question, which is what **Try it** runs: a reachable host and a key of the
right shape answer a question nobody asked.

**Which model does which job** (`resolve.ts`). The four jobs — Compose, intake, the graph agent,
board agents — are genuinely different work with different costs and different appetites for
judgement, so each can name a provider and override its model id. One endpoint at two sizes is
therefore a setting rather than a second provider. The order of preference is deliberate: the
provider set for this task, then the first enabled provider, then the environment — which stays
supported, because an instance that has run on `ANTHROPIC_API_KEY` for months must not lose its
model because a settings page appeared. When there is no usable model, `whyNoModel` distinguishes
the three situations that all look like "it does not work": nothing configured, a provider with no
model id, and a key that can no longer be read.

**Keys** (`secret.ts`). AES-256-GCM under `NEXUS_SECRET_KEY`. If that variable is not set the key
is stored as it is and the page says so, at the top, in plain words — deriving a key from something
already in the same database and storing it beside the ciphertext is theatre, and being told the
truth is what lets an administrator decide what to do about it. A key goes in and never comes out:
no action returns one, and the page shows only that one exists. A key that can no longer be opened
makes the provider unusable rather than falling through to another one, because quietly using
something the administrator did not choose is worse than stopping.


### 5.32 An agent, described (v0.2)

Every agent in Nexus so far was a hand-written module. The one that reads the graph (§5.26) took the
whole workspace, could propose all five changes, cost whatever it cost and answered to nobody. That
is fine for one agent and untenable for a fleet: "what is this thing allowed to do" should be
answerable by a person reading a screen, not by us reading source.

**A definition** (`lib/agent/definition.ts`, `definitions.ts`). An agent is now a row: a name, a
purpose, an owner, a scope, verbs, grounding, a model, a budget and a status. The module that holds
the rules is pure, so they can be read in one sitting and tested without a workspace. Four refusals
carry the design:

- **No scope, no agent.** The scope is a graph query (§5.9) and only what it matches goes into the
  prompt. An agent for the OT estate cannot comment on finance systems because it was never shown
  them. Relations are included only where *both* ends are in scope — a relation with one end outside
  would put the name of an unreadable object into the prompt.
- **No owner, no agent.** An agent nobody owns is nobody's to switch off.
- **No verbs, no agent.** Otherwise it runs, costs money and has nothing it is allowed to say.
- **A budget is clamped, not believed.** Runs a day and proposals a run, both enforced before a
  model is called; a refusal is written to the log rather than silently doing nothing.

**Draft is a dry run.** A new agent starts as a draft whatever the form asked for, and a draft runs
for real but keeps its proposals on the run: nothing reaches the review queue until a person presses
*Give it a voice*. That is what lets somebody read an agent's first opinions before granting it one,
the way they would with a new colleague, and it costs a single call.

**The run log** (`agent_runs`). One row per run, whatever happened: what it read, what it proposed,
what validation threw away and why, the model that answered, how long it took. Failed and refused
runs are kept too — a log that records only successes is a log that flatters, and "this agent has
been quietly refused eleven times" is exactly the fact somebody needs.

**Verbs are enforced twice.** The definition's verbs go into the prompt *and* into
`validateProposals`, which rejects anything outside them in the open with the reason said out loud.
Telling the model is a courtesy that stops it wasting its answer; the validator is the mechanism.

**Attribution end to end.** A queued proposal now carries the agent and the run that produced it,
the review queue shows the agent's name beside its suggestion, and a decision copies that name off
the proposal before it is deleted — which is what lets the fleet say how often people keep what a
given agent says (§5.28) long after the proposal is gone.

**The old agent is the first described one.** *Ask the agent* on the Knowledge graph page now runs
the workspace's **Model reviewer**: an ordinary definition, created the first time it is needed,
owned by a team, budgeted, logged and listed with the rest. The button is unchanged; what it starts
is now something a person can read and switch off.

Capability monotonicity is written and tested (`checkDefinition` refuses a child with a verb or a
budget its parent lacks) but nothing calls it yet — it is the rule §4.4 of the agent-framework note
needs before an agent may propose an agent, and it is cheaper to have in place first.


### 5.33 Nexus as an MCP server (v0.2)

The estate model is the thing other people's agents most want to read — "what depends on Maximo",
"what is out of support next year", "what does this organisation call an interface" — and answering
that is cheap for us and expensive for them. So Nexus speaks **MCP**: one endpoint, `POST /api/mcp`,
JSON-RPC, six tools, a key per client.

**Reading is generous.** `search_model` takes the workspace's own query language (§5.9);
`describe_object` gives an object with its attributes, every relation with direction, the boards it
is drawn on and where the record came from; `what_depends_on` walks the graph outwards with the
distance to each thing; `list_kinds` hands over the vocabulary, which is what stops an outside agent
suggesting things in its words rather than the organisation's; `estate_health` gives the score and
the measures behind it. Where a name is ambiguous the answer says so and lists the candidates with
their ids rather than picking one.

**Writing does not exist.** There is no tool that changes the model — not for a trusted client, not
behind a flag; the test suite asserts the tool list to keep it that way. The most a caller can do is
`propose_change`, which goes through the same validator our own agent goes through (§5.26): the
closed list of five changes, ids checked against the graph, and every claim quoting the object it
names or being discarded. What survives waits in the review queue for a person.

**An outside caller is an agent like any other.** A key with the `propose` scope gets a described
agent (§5.32) — an owner, a scope, verbs without `merge`, a budget of ten waiting suggestions — so
what arrives from outside appears in the fleet, is attributed by name in the review queue, and has
an acceptance rate somebody can read. Without that, "an outside system suggested this" would be the
one kind of proposal nobody could hold to account.

**Keys** (`lib/mcp/tokens.ts`). Minted here, hashed with SHA-256, shown once and never recoverable —
the mirror of §5.31, where the key belongs to somebody else and we must never be able to print it.
Two scopes and deliberately no third. A revoked key is treated as no key at all rather than as a
different error. Last-used is recorded because "is this still in anything's configuration" is the
question a person asks a year later. The endpoint sits outside the shared-password gate (§5.12) by
name: it carries its own bearer authentication, which is stricter, and a machine cannot follow a
redirect to a login form.

**Written by hand** (`lib/mcp/server.ts`, ~120 lines). The simple half of MCP's Streamable HTTP
transport — a POST that answers with one JSON object — is all a server of plain request/response
tools needs: no stream, no session, nothing to expire. A notification is answered with 202 and no
body, which is the detail hand-written servers most often get wrong. A tool's own failure comes back
as content marked `isError` rather than as a JSON-RPC error, because the thing on the other end is a
model that can read a sentence and try again.


### 5.34 Agents that suggest agents (v0.2)

The request was "let agents build new agents, with a human in the loop". The pattern that answers it
is the one the product already uses everywhere else: **a proposed agent is just another proposal.**
It is emitted in a closed language, checked by a typed validator, queued, and signed by a person
before it can do anything at all.

**Ask what is missing** (`lib/agent/suggest.ts`) hands a model the shape of the estate — kinds and
counts, what is untyped, what is unconnected, which attributes are missing and how often — plus
every agent already watching it, plus the asking agent's own verbs and budget. What comes back is a
list of agent definitions with, for each, the thing in *this* model that says it is needed.

Three rules make it safe, and none of them is a prompt:

1. **Capability monotonicity.** No agent may create an agent that can do something it cannot do
   itself, or spend more than it has. It is enforced by `checkDefinition` — the same function a
   person's form goes through — with the parent's verbs and budget filled in, and the refusal is
   shown in the parent's own words: *"Its parent cannot say two objects are one, so it may not grant
   that."*
2. **A proposed agent is not an agent.** It is stored with the status `proposed`, which the runner
   refuses outright: not a run, not even a dry run, until a person approves it. Approving makes it
   an ordinary **draft**, so its first opinions are still read before it is given a voice (§5.32).
3. **It must say what it read.** A suggestion with no reason grounded in this workspace's model is
   dropped, because "you should have an agent for interfaces" is a thing anybody could say about
   anybody. The reason is stored with the purpose, because by the time somebody reads the definition
   the run that produced it is one of many.

Duplicates by name are refused, a suggestion whose scope matches nothing is refused by the ordinary
scope rule, and everything refused is listed rather than swallowed — an agent quietly dropping half
its own answer is how a fleet stops being believed.

The button is in two places, and the difference is the point: on the **Agents** page the workspace's
own reviewer asks, and it has every verb; on **one agent's page** that agent asks, and its own
ceiling applies. A narrow agent can only ever propose a narrower one.


### 5.35 The other direction: asking somebody else's server (v0.2)

The cheapest connector is the one nobody has to write. An organisation's CMDB, wiki or ticket
tracker increasingly speaks MCP already, and a system that does needs no bespoke integration —
which is the honest answer to the catalogue's unbuilt half (§5.16).

**A server is a row** (`mcp_servers`): a name, a URL, a key sealed the same way a model provider's
is (§5.31). *Ask what it can do* shakes hands and stores the tools it reports, so the page can offer
them without asking again. The handshake is not politeness: several servers refuse `tools/list`
before `initialize`, and a client that skips it sees an empty toolbox and blames the server.

**A form from a schema we have never seen.** The tools a remote server offers are described by JSON
Schema, and Nexus builds a form from the top-level string, number and boolean fields — the ones a
person can reasonably be asked for. Anything deeper is left to whoever knows that system, rather
than generating a form for a shape nobody has looked at.

**What comes back is text, not truth.** The answer is shown, and only becomes an **intake source**
(§5.15) when somebody presses the second button — where it is read for claims, every claim checked
against the words it came from, and reviewed before any of it reaches the graph. There is
deliberately no path from a tool's answer to the model that skips that. A one-click "sync" would be
shorter and would quietly make somebody else's system an author of this organisation's architecture.
The source is named for where it came from, because provenance is the point of keeping it.

Failure is reported in words somebody can act on: a 401 is "that server refused the key", an HTML
error page from a proxy is "that address answered with 502 and something that is not JSON-RPC — it
is probably not an MCP endpoint", and an unreachable host says to check whether it is reachable
*from the server Nexus runs on* rather than from the reader's laptop. Both JSON and a single SSE
frame are accepted, because the transport allows either and real servers use both.


### 5.36 Import, and the canvas as the place it happens (v0.2)

Two things were wrong with the landing zone, and they were the same thing twice.

It was **APM-shaped**. It lived at `/apm`, it was called a landing zone, and the language around it
was about business applications — but nothing in the machinery ever cared: a row is a claim about a
thing, and a thing is whatever the file is a list of. So it is **Import** now, at `/w/:slug/import`
(the old address redirects), with `lib/import`, and no framing that assumes applications.

And the **canvas was an output**. Decisions were made in a table, and *Draw it on a board* produced
a picture of them. For a product whose whole premise is an infinite canvas, that is exactly the
wrong way round: a staged import — four hundred claims you want to see the shape of, sort into
piles, and argue about with somebody standing next to you — is the best possible canvas work.

**The lanes are the decision** (`reconcile.ts`, `sync.ts`). A staged board carries its batch id in
the document, and saving it reads the board back: which lane each card's *centre* is in — the same
containment rule a drag uses, so what a person sees is what is written — plus what they renamed,
what kind they set, what they connected and what they deleted. Held and Rejected are drawn even when
empty, because a decision you cannot drag to is a decision the canvas cannot express. There is no
Apply button: the save is the apply.

**What the board can say that the table cannot.** Rename a card and the record is renamed. Set its
kind and the record's kind is set. Draw a connector between two staged cards and the import creates
that relation — named by record rather than by name, so a rename cannot silently repoint it. Delete
a card and the claim leaves the import.

**And what the table can say that the board cannot** — what a column means, the trust order between
files, whether people's names come in. Those are properties of the *files*, not of the objects, and
they stay on the batch page. The two surfaces are views of one batch: a decision on either shows up
on the other, and the review is computed with the board's edits applied so they cannot disagree.

**Finishing from the canvas.** A bar above the board counts what the lanes currently say — live, from
the elements, so it moves as a card is dragged — and approves. Once a batch is approved the bar says
so instead, because a button whose only outcome is "already approved" is not a button.

**What are these rows?** (`proposeFileKind`). Most exports never say what they are *of*: a server
list is all servers and the filename is the whole of the metadata. Until now that meant rows arrived
untyped and somebody typed them one at a time. Each file is now asked, with an answer proposed from
a kind column if the rows carry one, else the file name, else the columns — preferring the
workspace's own spelling ("Applications" if that is what these people call them) over ours. A row
that carries its own kind always keeps it: a column knows more than a filename.


### 5.37 Three doors into import (v0.2)

Import was a file drop, and a file is only one of the three ways data actually arrives.

**Paste.** The most common thing an architect has is not a file: it is forty rows in a mail, a
query result from somebody's console, a list in a chat message. Making them save it as a CSV first
is a step whose only purpose is to satisfy the import feature. A pasted block is sniffed from its
content rather than a filename — JSON if it parses as a list of records, a table if the lines
*agree* on a delimiter (counted across the block, because a CSV containing tabs and a TSV
containing commas are both common and both read wrongly by a sniff that stops at the first
separator), prose otherwise.

**A connected system.** A system that speaks MCP (§5.35) can be asked from the import page itself:
pick the system, pick a tool, fill in what it wants, read the answer, stage it. Rows are mapped and
matched like any import; prose goes to intake instead, and the refusal says so. Configuring servers
stays on the Connections page — this is the door, not the plumbing.

**And Nexus answers rows when asked.** `search_model` now takes `format: "table"` and returns
tab-separated rows instead of prose. The default stays prose because the caller is usually a model
summarising for a person, but "give me that as a table" is a reasonable ask — and it is what lets
one Nexus import from another. The e2e uses exactly that: it asks this instance's own endpoint for
its applications as a table and stages them, and every row matches itself as unchanged.

All the doors converge on one `stageBatch`, so "paste" cannot quietly become a worse import than
"upload" — and when a fourth was added for an EA repository (§5.63) it inherited the whole pipeline
rather than growing a second one. The batch records which door it came through, because *somebody
pasted this* and *a CMDB answered this* are different kinds of claim even when the staging is
identical.


### 5.38 Prose and tables as one pipeline (v0.2)

A batch could contain a Word document and did nothing with it. The file was kept, and the review
said reading it for claims was the intake pipeline's job — two pipelines side by side for one
obvious piece of work, because the governance review in the batch is *about* the systems in the
export sitting next to it.

**The prose in a batch is read for claims and folded into the same records.** Intake's extractor
(§5.15) runs over each prose file, and what it finds becomes ordinary field values on the staged
records: same folding by name, same trust order, same conflict display. "Maximo is out of support
from December" lands on the Maximo record beside the ServiceNow row.

**With the sentence.** A `FieldValue` now carries an optional `quote`, and the review shows it under
the value. A column's provenance can be the column; a document's has to be the words, or "the
review says the owner is Grid Ops" is an assertion nobody can check. A claim that cannot be quoted
never arrives — intake already drops those and reports them.

**The trust order is the file order, still.** A document sits in the same list as the tables: put it
above the 2019 spreadsheet and it wins; leave it below and its value is kept beside the winner with
its sentence. That is one mechanism for both kinds of source rather than a special rule for prose.

**A document may introduce an object.** A candidate matching nothing in the batch becomes a staged
record of its own — the system somebody named in the review that no export has caught up with.

**What it does not take.** Viewpoints — decisions, actions, risks, the things people *said* — are
not claims about the estate's shape and stay on the intake screen. An import is about what the
model should contain.

**Reading happens once.** The claims are stored on the batch's file, so re-mapping a column
re-stages without re-reading: reading is the one step in this pipeline that can cost money.

**And the extractor learned to state values** (`validate-extraction.ts`). Until now a source could
name an object and quote the sentence, but had nowhere to put what the sentence *said*: "out of
support from December" was thrown away. An object may now carry `facts` — a key, a value and the
words that state it — each checked against the passages like every other claim. That is a better
intake as well as a working import.


### 5.39 An agent beside the import (v0.2)

A staged batch is where a second opinion is worth most and hardest to get: four hundred claims, and
whoever is reviewing them has been reading a spreadsheet for an hour. So the staged board arrives
with an **Import reviewer** already placed and already pointed at the job.

It is an ordinary board agent (§5.27) — same remarks, same quoting, same *keep as a note*, same
acceptance rate in the fleet, and it changes nothing by speaking. What is import-specific is only
the sentence it is given: these cards are claims and the lane each sits in is what would happen to
it, so say what you would question before a person accepts them. Two cards that look like the same
system under two names, a date that has already passed, a value that disagrees with the rest of the
batch, something accepted that reads like test data. A person can rewrite that sentence like any
other agent's.

**And board agents learned to see the grouping.** A `ScopeItem` now carries the frame it sits in,
by the same centre-inside rule a drag uses, and the digest says so. That is not import-specific:
on any board people group by frame and the grouping means something — the OT estate, this quarter,
the pile we have accepted. An agent blind to it was reading a list where a person was reading a
picture. On a staged import it is the difference between "these two are the same system" and "you
have *accepted* two cards that are the same system".

The bar above the board counts remarks nobody has answered, because the moment they matter is the
moment before somebody presses Approve.


### 5.40 Two people on one board (v0.2)

Until now the honest answer to "we both opened it" was to refuse the second save: **Changed
elsewhere — reload.** That was the right answer to the question as it stood — there was no merge,
and silently overwriting somebody is worse than telling them — but it was the wrong question. An
architecture canvas is a thing two people stand in front of. The fix was to be able to merge, not
to apologise better.

**The document's shape is what makes the merge small.** A board is a map of flat objects: nothing
nests, nothing is ordered, every field is a value. So the rule is per-element last-writer-wins,
ordered by the server. Two people moving different cards both land, and their patches commute. Two
people moving the same card is a *real* conflict, not a merge failure, and the later one winning is
the only sensible answer — what the server adds is that "later" means something, rather than being
whoever's network was quicker. No CRDT, no operational transform, no vendor: a hundred lines of
protocol and a diff of the element map.

**Except text, which is not merged at all.** Last-writer-wins on a field two people are typing into
eats characters, and the product looks like it lost your work. So a field somebody is in is locked:
it turns their colour and goes read-only for everybody else. That is a smaller promise honestly
kept instead of a large one quietly broken — and the lock is *presence*, not state, so it lifts the
moment they blur, close the tab or lose the connection. There is nothing to release and nothing
that can get stuck.

**Server-sent events, not WebSockets.** One `GET /api/boards/:id/live` that never ends, and small
`POST`s back on the same URL. The customers are enterprises, and corporate proxies, TLS gateways
and older load balancers break WebSocket upgrades constantly and silently — the failure mode being
"the canvas is dead for the one team behind the strict proxy". SSE is plain HTTP: no upgrade, no
custom server, nothing added to the Dockerfile or the health check. The cost is one extra request
per edit, which for a canvas is nothing.

**The room is the writer.** While anybody is live, a per-board room on the server holds the
document, applies patches in arrival order and persists once the board goes quiet — through exactly
the ordinary save path, so the automatic checkpoint, the graph sync and the import reconcile all
run as they would for one person. Clients stop PUTing, which is what stops N tabs racing each other
with N whole documents and N graph syncs. When the stream drops, the client's own autosave comes
straight back, so a blocked stream degrades to the pre-multiplayer behaviour rather than to a board
that quietly stops saving.

**Not everything in a document is an element.** Saved viewpoints and the Compose script belong to
the board but are not on the canvas, so they cannot ride an element patch — and once the client
stops saving, a viewpoint saved during a shared session would simply never be written down. They
travel as their own message, whole-value last-writer-wins, which is the right grain for a list of
saved views and a block of prose. The browser suite found this one before a person did: it reopened
a Compose-written board and the script that produced it was gone.

**And the board can now be told it changed underneath.** Approving an import, restoring a version
and deleting a relation all rewrite a board from outside the canvas. Each now hands the live room
the new document, and everybody standing on it simply sees it. That was the other case that used to
need a reload.

What you see: coloured cursors in world coordinates (so a colleague zoomed out is pointing at the
same *card*, not the same bit of glass), a thin outline round what each person has selected,
initials in the topbar, and **Shared** where the pill used to say *Saved*. Undo stays personal —
a remote change never lands on your undo stack, because Ctrl+Z quietly reverting a colleague's work
is the single worst thing a shared canvas can do.


### 5.41 Signing in as yourself (v0.2)

Rev 75 made a board shared and then had to admit, in its own known gaps, that the cursors were
honest about *how many* people were on it and not about *who*: everybody was the seeded demo user,
so two colleagues got the same initials in the same colour. Presence that cannot tell people apart
is half a feature, and the half that was missing was authentication.

**The data model was already right.** `users` has had a name, an email and a colour since the first
week; `workspace_members` has had a role (owner / admin / member / guest); boards, versions, change
sets and agent runs have all recorded a `createdById`. Every one of those columns held the same
value, because `currentUser()` returned the demo user. So this was not a new model — it was one
function, a sign-in page, and a session.

**Sessions are a table, not a signed cookie.** A self-describing token cannot be taken back, and
"sign out", "sign out everywhere" and "that laptop was stolen" all have to end a session before it
expires. The cookie holds 32 random bytes; the row holds their SHA-256, so a leaked backup contains
no usable session. An active session has its expiry pushed forward on use — being signed out
mid-sentence because thirty days elapsed is not security, it is rudeness.

**Passwords are scrypt, written by hand.** It is in Node's standard library, it is memory-hard, and
the whole job fits in forty lines; argon2 or bcrypt would mean a native module in the image and a
supply-chain surface in exchange for a difference nobody here can measure. The stored form carries
its own cost parameters, so raising them later does not invalidate anybody — an old hash still says
how to check itself, and a successful sign-in quietly rewrites it. The one rule on what people may
choose is length: composition rules push people towards `Password1!` and away from the only thing
that reliably helps.

**The form answers as little as possible.** It never says which half was wrong, because "no account
with that address" tells you who works at an organisation. It costs the same either way — an
unknown address is still put through a hash — so the timing does not answer the question the
wording refuses to.

**Two gates, in order.** The optional shared password (§5.12) is still there and still useful: an
instance behind it is not enumerable at all, which is a different property from "you need an
account". Behind it, the proxy checks that a session cookie is *present*. It cannot check that it
is valid — no database at the edge — and that is not a hole: a forged cookie gets past the proxy
and fails at `currentUser()`. The cheap check exists so the ordinary signed-out visitor is
redirected once rather than rendering a page that immediately redirects. `/api/mcp` is excluded
because it carries its own bearer key, and `/api/health` because a platform probe has no cookies.

**A demo instance still opens in one step.** `pnpm dev` used to need no configuration at all, and
trading that away would have bought nothing on a machine whose database is invented. The seed gives
its four people one known password and the sign-in page prints it — in development always, in
production only with `NEXUS_DEMO_SIGNIN=1`, and never once the seeded password has been changed.
Being able to sign in as two of them is also how anybody sees multiplayer work at all.

**Three things the browser suite found before a person could.** Putting a gate in front of
everything has consequences a unit test cannot see. The e2e warm-up, which visits thirteen routes
so the dev server compiles them, was redirected to the sign-in page thirteen times and spent a
two-minute timeout on each — 343 seconds of a suite that looked hung rather than misconfigured.
The suite's own out-of-band `fetch` calls to the graph API got the sign-in page and a baffling
`Unexpected token '<'`. And the real one: **static files under `public/` were behind the gate**, so
Next's image optimiser — which fetches the source image over HTTP — was redirected, and every
screenshot in the in-product documentation failed to render. Files in `public/` carry no user data
and are baked into the image; they are now public, and because pages and API routes have no file
extension the rule cannot open one by accident.

And presence stopped inventing a colour. A person already had one; the cursor, the topbar avatar
and the sidebar now all use it, so "which one is Maria" has the same answer everywhere.


### 5.42 Agents that run themselves, and the digest (v0.2)

The agent framework note put this off in as many words — *"a schedule is a trigger, and a trigger
needs a runtime; both come later"* — and everything it was waiting for now exists: definitions with
a scope and an owner, budgets counted before the model is called, a run log, refusals that are
written down. What was missing was a clock, and the reason to want one.

**A schedule is not a privilege.** An unattended run goes through exactly the function a person's
run goes through. It refuses a paused agent, refuses one over its budget, reads only its scope, and
writes the refusal down. There is no second, looser path — which is the property that makes leaving
an agent running overnight a reasonable thing to do rather than an act of faith.

**Intervals, not times of day.** "Every night at 02:00" needs a timezone and this product does not
have one: a workspace is an organisation, not a place. So a daily agent is one that has not run for
a day. It drifts by minutes, which is the honest cost, and it never runs twice because the clocks
went back. A brand-new scheduled agent is due immediately, because somebody who has just written a
purpose wants to see what it does, not wait a day to find out they phrased it badly.

**The clock is a nudge; the database is the schedule.** Due is computed from the last run row, so a
restart, a redeploy or a container that slept loses and duplicates nothing. `instrumentation.ts`
starts an interval when the server comes up, and `POST /api/agents/tick` does the same pass on
demand — for a host that recycles idle containers and has no long-running timer, and for a person
who does not want to wait five minutes to see whether their new schedule works.

**And then somebody has to find out.** A fleet working all night whose only evidence is a number on
a page nobody opens is not an agent doing something *for* you, it is an agent doing something *near*
you. So the workspace home opens with **While you were away**: the unattended runs, what they
proposed, what anybody has accepted or dismissed since — and first, because it is the fact people
least expect, any agent that refused to run and why.

Three rules keep it worth reading. It is **silent when nothing happened**, and most mornings nothing
did; a panel that speaks every day gets skimmed, then skipped, and is invisible on the morning it
matters. It counts **news, not work**: proposals that were already waiting when it was last
dismissed are not "while you were away", which is what stops it reappearing the moment it is closed.
And **dismissing is the only thing that moves the window** — reading is not dismissing, so a glance
on a phone at the weekend does not cost somebody the digest they meant to read at a desk.

The budget arithmetic is said out loud where the schedule is chosen: an hourly agent wants 24 runs a
day and the default budget allows 12. Obvious in a table, invisible in a form, and otherwise
discovered a week later from a run log full of refusals.


### 5.43 The graph remembers (v0.2)

Boards have had version history since §5.9. The **graph** — the thing this product is actually
about — had none. "Who changed Maximo's owner, when, and from what" was a question with no answer,
and since §5.42 agents write to the model overnight with nobody watching. A system of record that
changes itself while you sleep and cannot say how it got here is not one.

So every change to an entity is now written down, field by field, with its before and after, the
hand that made it and where it happened: a person in the drawer, a board save, a scheduled agent, an
import, a rollback. Two places read it — a timeline inside the entity drawer, and **What changed**,
a workspace-wide page grouped by day and filterable by hand.

**History is observed, not declared.** Twenty-odd places in the codebase write to the graph. Asking
each of them to also describe what it did is twenty places to forget and twenty descriptions that
can drift from the truth. Instead `remembering()` snapshots the rows in scope, runs the write, and
diffs — so what is recorded is what happened to the database, and a merge that also inherits a
description is in the history whether or not its author thought about it. The cost is one extra read
per write over a bounded set of rows, which is the right price for a system of record.

**The event outlives its subject.** `entity_id` is deliberately not a foreign key and the name is
copied onto the row. A deletion is the single most interesting thing that can happen to an object,
and a cascade would erase exactly that.

**It does not record your typing.** Renaming a card is eleven keystrokes and four autosaves. A
change that continues the one before it — same field, same hand, same place, within two minutes — is
folded into it, so `A → B` then `B → C` becomes `A → C` and `A → B` then `B → A` becomes nothing at
all, because nothing happened. Anybody else's edit ends the run: "Maria changed it and Tobias
changed it back" is two facts, not zero.

**The actor is recorded, never inferred.** There is no default actor and no guessing after the
fact. A board save carries the person who saved it; a live room, which persists on a timer for
everybody in it, carries the board, honestly, because there is no one person whose save it is. An
accepted proposal is attributed to the reviewer rather than the agent — an agent that proposes has
not changed anything — with the proposal's title as the context line.

What is *not* here is as deliberate: moving, resizing or recolouring a card is a change to a
picture, not to the estate, and boards keep their own version history for it. Mixing the two would
bury the six changes that mattered under six hundred that did not.


### 5.44 Dropping an object onto the board (v0.2)

Dragging a system out of the Graph inventory worked and looked wrong. Three things were wrong with
it, and they are the same mistake three times: the interface answered a question nobody was asking.

**The affordance was the window.** A two-pixel dashed border inset round the entire viewport, plus
a blue wash over the whole board — drawn *behind* every floating panel, so it framed the sidebar and
the inspector as though they were part of the drop. It said "you may drop something somewhere",
which the person already knew. What they want to know is *where it will land and how big it is*.

So the affordance is now the cards themselves. While you drag, the board draws the object where it
would be created, in world space, at its real size and in its kind's colour — drag over a gap
between two frames and you can see whether it fits before you let go. Drag a whole kind by its **+**
and you get the grid, with a count above it. The preview is laid out by the same function the drop
uses (`cardLayout`), because a preview computed a second way is a preview that eventually lies.

**The panels were drop targets.** They are children of the canvas element, so dropping onto the
Graph panel created a card underneath it, where nobody could see it — the object was in the model
and invisible on the board. A drop over any floating chrome is now refused, and the cursor says so.

**The thing following the cursor was the row you grabbed.** The browser's default drag image is a
snapshot of the list item, complete with its "+" button: a picture of the control rather than of the
object. It is now a small chip naming the object in its kind's colour, or "8 Applications" for a
group.

One consequence worth recording: the drop no longer special-cases a single object. A 1×1 grid *is* a
card centred on the pointer, so there is one code path, and a test asserts the two agree.


### 5.45 Closing the deployment gaps (v0.2)

Three of the gaps §6a admitted to were about running this thing somewhere real rather than about
what it does. They are closed together because they are the same subject.

**The typeface is served from the deployment.** IBM Plex was fetched from `fonts.googleapis.com` at
runtime, so an air-gapped or egress-restricted installation — the sovereign case this product is
aimed at — silently fell back to the system stack and did not look like itself in the environment it
is most meant for. It also put a third-party request on every page load of a tool holding an
organisation's architecture. The files are committed under `public/fonts` with their OFL licence,
`pnpm fonts:vendor` refreshes them, and the `@font-face` rules are imported with the stylesheet
rather than linked from the document, so there is no round trip before text can be painted. The
browser suite now fails if anything asks a font host for anything.

**A database can move between dialects.** Both have worked since §5.19, but adopting Postgres meant
starting from the seed: everything a pilot had built stayed in the old file. `pnpm db:transfer
--from file:./data/nexus.db --to postgres://…` copies every table, parents before children, in
batches. Two properties make it safe enough to point at a real deployment: it **refuses a
destination that is not empty**, because merging two estates is a different problem with different
answers and doing it silently would be the worst of them; and the order it writes in is checked
against the schema by a test, so a table added next year cannot be quietly left behind — the failure
mode there is a move that reports success while an organisation's change sets are gone. Ids are text
in every table, chosen for exactly this in the first week, so nothing is remapped.

**The Turbopack panic is a workaround, not a fix.** Next 16.3.4 is the latest release and still
occasionally panics compiling a route for the first time in `next dev`. There is nothing to fix
here; what there is, is `pnpm dev:clean`, which clears `.next` and starts again, and an honest note
that says so.

### 5.46 Who may do what (v0.2)

`workspace_members.role` had been in the schema since the first week and nothing read it. Since
§5.41 everybody signs in as themselves — and then every signed-in person could issue an MCP key,
point the product at a different model, grant a system read access to the estate, approve an import,
deliver a change set and delete an object from the graph. That was the largest gap between what this
product looked like it enforced and what it did.

**Capabilities, not role checks.** A role check scattered through ninety server actions is ninety
places to be inconsistent, and the inconsistency is invisible until somebody finds it. `roles.ts`
turns a role into sentences about the product — *may approve an import*, *may deliver a change set*
— in one table, and everything else asks that table.

**The line is consequence outside the screen you are on.** Drawing on a board affects a board;
editing an object affects the model, which is what the model is for. Approving an import rewrites
the estate everybody else is reading, issuing a key hands somebody's agent a door, delivering a plan
moves the model into the future, and a merge or a delete cannot be undone by doing the opposite. So:
a **guest** reads; a **member** draws, edits and runs agents; an **administrator** approves,
delivers, deletes, manages agents and configures; an **owner** also manages people. Written out in
full rather than composed by inheritance, because a reader asking "can a member deliver a change
set?" should be able to answer it by looking.

**Hiding a button is a courtesy; the server is the enforcement.** Every guarded action re-checks,
including the board `PUT` and the live channel's patches — a guest is welcome to watch a board live,
cursor and all, and may not change it. The membership is read per call rather than cached on the
session, because a demotion has to take effect for somebody who is already signed in.

Two rules the matrix cannot express live with the people actions: **the last owner cannot be demoted
or removed**, or a workspace ends up with nobody who can add anybody; and **a reset ends that
person's sessions**, because a new password that leaves a stolen laptop signed in achieves nothing.

Alongside it, two smaller gaps closed. Rows that belonged to an organisation and to nobody in
particular — an MCP key, a model provider, a connected server — now record **who set them up**, so
"who issued this key" and "whose account is this spending" have answers. And the account gap is
closed as far as it should be: somebody can **change their own password** without an administrator
knowing it, and an owner can add a colleague and reset a password. There is still no sign-up and no
forgotten-password email, on purpose — SSO is the intended answer to both, and a mail transport in
the middle of an architecture tool is a moving part nobody asked for.

### 5.47 A live board across more than one server (v0.2)

Rooms lived in one process's heap, so a second replica was a second set of rooms: two people on the
same board could land in different ones, see an empty presence list, and take turns overwriting each
other's document. §5.40 wrote that down as a known gap and named the fix — Postgres
`LISTEN`/`NOTIFY` — and this is it.

**The bus decides the order, not the sender.** The one real change to the room is that a patch is
*published before it is applied*, and applied when it comes back. Every replica therefore applies in
the order Postgres delivered, which is the same order everywhere, and last-writer-wins is one rule
rather than a race between two servers' clocks. With a single process the bus is a synchronous
function call, so the behaviour and the cost are exactly what they were.

**One replica writes the board down.** All of them converge on the same elements, so any could — but
three replicas would then do three saves, three graph syncs and three import reconciles per settle,
which is the waste the room exists to remove. The lowest process id present wins: no election, no
lock, no coordination beyond the presence everybody is already publishing, and when that replica
dies its peers age out and the next takes over on the following settle.

**Presence is the union, and it forgets.** Each replica publishes its own peers on every change and
on a heartbeat; a replica nobody has heard from for forty-five seconds stops having people, so a
crash does not leave ghosts in the list.

**A payload that will not fit is a fact, not a crash.** `NOTIFY` allows 8000 bytes. Almost every
patch is a fraction of that; a card with a very long description might not be, so the sender writes
the board down and asks the others to read it again. Rare, correct, and much simpler than a chunking
protocol for a case that mostly does not happen.

### 5.48 More than one workspace (v0.2)

Everything below the workspace row has been scoped to one since the first week — entities, boards,
agents, keys, providers, batches — and the product only ever showed a single one, chosen by slug and
rendered for anybody signed in. That was a curiosity with one workspace and a hole with two.

So: a **switcher** where the workspace name already was, because that line was already answering the
question and simply could not answer it a second way; **creating** one, which makes you its owner
(the only sensible answer, and the rule that keeps §5.46 true — a workspace with no owner is one
nobody can add anybody to) and gives it a space so the first board has somewhere to go; and, the
part that matters, the workspace layout now checks **membership**. Somebody who is not a member gets
`notFound` rather than a refusal, because "this exists and you may not see it" is itself something
they should not learn from a URL. The front door sends a person to a workspace they are actually in.

### 5.49 The guard, actually everywhere (v0.2)

§5.46 introduced the capability matrix, guarded the administrative modules, and reported that the
write boundary was closed. It was not. An audit the next morning found **forty-nine exported actions
that changed something and asked nobody** — bulk attribute edits, committing an intake source into
the model, deleting a board or a space, renaming a relation type, staging and deleting import
batches, every change-set edit, four meta-model actions. Every one was reachable by a guest.

The lesson is not "be more careful". Ninety actions guarded by hand is a coverage problem, and a
coverage problem wants a machine. So the fix is two things: the forty-nine guards, and a **test that
reads the action modules and fails unless every exported async function either calls a guard or is
named in a list of deliberate exceptions with its reason written down**. It is a coarse check — it
proves a guard is called, not that the right capability was chosen — but it converts the failure
that actually happened, somebody forgetting, from a silent hole into a red build.

Writing that scanner produced its own small lesson. The first version counted braces from the
`export` keyword, which meant a multi-line `Promise<{ … } | { error: string }>` return type opened
and closed a brace before the body began: the scan stopped at the signature and reported two
*guarded* actions as unguarded. A test that errs towards false alarms is tolerable; one that errs
the other way is worse than none, and this one did both until the body was taken as "everything up
to the next line that is exactly `}`".

Two actions are deliberately open and say so: starring a board and marking one opened write a row
about *you*, and somebody entitled to read a board is entitled to have opened it. The new lines the
guards drew, beyond §5.46: **staging an import is a member's work and approving it is not**, which
is a workflow worth having rather than a compromise; deleting a *space* is administrative because it
takes its boards with it; and teams are administrative because they decide who owns what.

Also fixed, from the same review: the live bus's oversized-message path wrote the board down through
the ordinary persist, which **declines unless the replica is the elected writer** — so a patch too
large for `NOTIFY` could be followed by every replica re-reading a document that did not contain it.
That write is now forced, and the reload is announced only once it has happened.

### 5.50 Talking about a board (v0.2)

A board is a thing two people stand in front of (§5.40) and, until now, the one thing they could
not do on it was talk. Everything else about a card is expressible — its kind, its owner, its
relations — and the argument that produced it lived in an email or somebody's memory. Comments close
the last real gap in the product.

**Rows, not document.** §6a's known-gaps entry left the question open: is a comment a board object,
versioned and exported with the drawing like an agent remark, or a row beside it? A row. A comment
must survive the thing it is about — you delete the card and the reasoning is exactly what you still
want — and a version restore that silently deleted three colleagues' questions would be the product
losing people's words. Rows also mean a guest can write one without being able to write a document.

```
comments  id, workspace_id, board_id, element_id(""), anchor_label, parent_id?, author_id?,
          author_name, body, resolved_at?, resolved_by_id?, resolved_by_name, edited_at?, created_at
```

`element_id` is `""` for a comment about the board as a whole, and is deliberately not a foreign key
— the document is JSON, and a conversation about a card that has been deleted is one somebody still
needs to read. `anchor_label` and `author_name` are copies taken at write time, for the same reason.

**Two levels, never three.** A conversation is one thing somebody said and the replies to it. A
reply to a reply joins the same conversation rather than starting a third rung: an arbitrarily deep
tree is a shape nobody can read in a panel beside a canvas, and every product that has tried it
ends up flattening the display anyway.

**A separate capability.** `board.comment` is granted to all four roles including **guest**, which
is the point of it existing rather than being a corner of `board.edit`: the reviewer you invite to
look at an architecture is exactly the person with something to say about it. Editing and deleting
are *your own words only*, and deliberately **not** an administrator's power — a record somebody
can rewrite is not a record, and no amount of convenience is worth that. Resolving is different: it
settles a conversation rather than changing it, so anybody who may comment may settle or reopen one.
The rule is shown rather than enforced after the fact: **Edit** and the bin appear only on your own
words, so nobody is offered a control that would answer them with a refusal.

**Settled, not deleted.** The tick drops a conversation below the open ones, takes its pin off the
board and leaves it under *Show settled*. A year later, why a card is the shape it is matters more
than the question that got it there.

**What survives a deletion**, which is most of the design:

| Deleted | What happens | Why |
|---|---|---|
| The opening comment | Its replies are promoted to conversations of their own (`threadsOf`), because there is no foreign key on `parent_id` | Somebody withdrawing their own question must not silently delete three colleagues' answers |
| The object it was about | The conversation stays and its heading says **(deleted)**, next to the name the object had when somebody first commented | Hiding it throws the reasoning away at the moment it became history |
| The person who wrote it | `author_id` goes null; `author_name` was copied at write time and stays | A conversation still says who said it after somebody leaves |
| The board | The comments go with it (`ON DELETE CASCADE`) | A comment about a board that no longer exists is about nothing |

**On the board, in screen space.** An object with an open conversation carries a pin at its
top-right — drawn in one overlay above the world layer rather than inside each of the seven element
renderers, so it is the same size at 30% zoom and at 300% and there is one place to change it.

**One thing the new button uncovered.** `.miro-studio` is a grid with no explicit column, so its
single implicit track sized itself to the *max-content* of its widest child — and the topbar is a
flex row of controls that do not wrap. Adding a sixth button pushed that past the window, the whole
studio grew wider than the viewport, the page scrolled sideways and the board no longer sat where
the pointer expected it: a drag aimed at a card landed on a connector behind it. The bar had already
been twelve pixels over before this change and nothing had gone visibly wrong yet. The fix is the
column — `minmax(0, 1fr)`, so the track is the window — and the breadcrumb now gives way first. The
browser suite caught it, which is the argument for having one: no unit test can see a page that is
the wrong width.

**Not live, and honest about it.** Comments are not carried by the live channel (§5.47). They
refresh after you post and when the tab regains focus, which is the moment somebody has been away
long enough for a colleague to have said something. Pushing them through the bus is a small change
when it is worth making; claiming they are live when they are not is not.

### 5.51 Following somebody's viewport (v0.2)

Rev 75 put two people on one board and rev 84 let them talk about it. What was still missing is
the smallest thing of all: *look at this corner*. A sentence somebody has to act on — scroll, hunt,
"no, the other one" — where the board could simply take you there.

Click a peer's initials in the topbar and your camera tracks theirs until you move the board
yourself.

**A rectangle, not a camera.** Presence gains `view`: the world rectangle a peer can see. It is
tempting to send the camera — three numbers already in the store — and it is wrong. A camera is in
*their* screen units, so copying its zoom onto a smaller window shows **less** of the board than
they are looking at, which defeats the entire point: the corner they were pointing at ends up off
your screen. A rectangle is what they can see, and each follower fits it to whatever window they
happen to have. In the browser test a 1400×900 leader at 392% and a 1600×1000 follower at 413% have
the same world point at the centre of both screens — different zooms, same view, which is the whole
argument in one line. It is the same reasoning that put cursors in world coordinates in §5.40.

**Letting go without a button.** Following ends the moment you pan, zoom, fit, open a viewpoint or
let the command bar focus a card — anything that moves the board. That has to be automatic: when a
canvas starts moving under your hands, the reflex is to grab it, not to look for the way out. The
hook flags its own camera writes (zustand notifies synchronously inside `set`, so a boolean held
across the call is true for exactly its own change and nothing else) and treats every other camera
change as the person taking the wheel back. Nothing else in the canvas has to know that following
exists. Escape and a **Stop** button are there too, for the people who look for one.

**The loop that had to be unreachable.** The fit leaves a 6% margin so the leader's edges are
inside yours rather than on them. Two people each following the other would therefore widen by 6%
every round and zoom the pair off the board — a slow, baffling drift outward. So presence also
carries `following`, and following somebody who is already following you is refused, with their
initials saying why. The check at the click cannot see a decision that has not arrived yet, so two
people who press each other's initials in the same moment both get through it; that is settled when
the presence lands, by letting the **lower peer id keep the follow** — both sides compute the same
answer, so exactly one of them lets go rather than neither or both. Chains are fine: C following A
following B is stable, because the margin is applied a fixed number of times, not repeatedly.

**Saying so.** The edge of the canvas takes the followed peer's colour and one pill names them. A
board that moves on its own is alarming; a board that moves on its own *and says whose view you are
in* is a feature.

Eased rather than snapped: the wire carries a rectangle about eight times a second and the camera
eases towards it each frame, zoom geometrically — halfway between 20% and 80% is 40%, not 50%, or a
long zoom appears to accelerate into its target.

### 5.52 An agent that accounts for itself (v0.2)

§5.27 put agents on the board and §5.28 gave them a fleet page. Using one for an afternoon shows
what was missing: an agent on a canvas was a **black box with a Wake button**. You wrote a purpose,
chose a scope, pressed Wake, and hoped.

Four things were wrong, and all four were already known to the code and thrown away by the screen.

**You could not see what it could see.** Scope is a place — the board, the frame it was dragged into,
the objects a line joins it to — and that is the good idea in §5.27. What was missing is that
nowhere did the board say what the place resolved to. Selecting an agent now outlines every object
it would read, in the agent's colour, and the agent counts them in a sentence: *Reads 8 objects*,
*Reads 6 objects in "OT estate"*, or the reason there are none — *Joined to nothing — draw a line
from it to what it should watch*. It is drawn from `scopeOf`, the same function the run uses, so it
is not an approximation of what the agent sees; it *is* what the agent sees — an object with no
words on it is left out of both, so the outlines answer "why does it say six when I can count
nine" without anybody having to ask. On a canvas the filter is a position, so the match is a set of
objects, and objects can simply be drawn on.

The cost is that `scopeOf` now runs for every agent on every document change, which during a drag
means once a frame. That is deliberate: it is what makes the outlines follow an agent live as it is
dragged into a frame, and the alternative — a cheaper function that only counts — is a second
definition of scope to keep in step with the first, which is exactly the drift this avoids. Agents
are few; boards are large; the arithmetic is small.

**You could not see what it had done.** The server has always returned how many objects it read, how
many remarks the validator threw away, and which doctrine the run was given — and the view kept the
remarks and discarded the rest. So *"I read fourteen objects and none of them needed saying about"*
and *"I could not see anything at all"* rendered identically, as silence. The agent now carries
`read`, `discarded` and `grounded`, and says: **Read 14 · said 3 · discarded 1 · 4 min ago**.
`discarded` is the uncomfortable one and the reason to show it: an agent that keeps quoting words
that are not there is one somebody should rewrite or delete, and that only becomes visible if the
number is on the screen.

**Finding what it said meant hunting.** The remark tally is now a button that flies you to each
object the agent spoke about, one press at a time.

**An agent could get stuck reading for ever.** `thinking` is written into the document on purpose,
so a live board shows everybody that somebody has woken an agent (§5.40). Nothing ever cleared it:
a tab closed mid-run left the flag true, the agent said *Reading…* with its Wake button disabled,
and the only way out was to delete it and write it again. A run cannot outlive the page that
started it, so `migrateDocument` clears the flag — which, because that function runs on the board
`PUT` as well as on every read, makes the flag in-memory and broadcast-only in practice and the
stuck state unreachable in two independent places rather than one.

**One silence made honest.** `BoardScope` gained `total`: `items` is capped at 120, and the cap used
to be silent, so an agent pointed at a four-hundred-object board read the first hundred and twenty
and said nothing about the rest — which reads exactly like having nothing to say. The interface now
says *Reads 120 of 400 objects — the rest are out of reach*, and the digest tells the model the same
thing, so it does not generalise from a sample as though it were the whole picture.

Waking an agent whose scope is empty is refused before the round trip, since the screen already says
why and pressing a button to be told what is written under it is not an interaction.

The wording is the feature here, so the wording is tested (`canvas/agentReport.ts`): the property
under all of it is that two different outcomes must never produce the same sentence.

### 5.53 An answer you can keep (v0.2)

*Ask about a selection* (§5.28) is the agent that needs no setting up: point at some objects, ask,
read prose with checked citations under it. Two things about it were wrong, and both are about what
happens **after** the answer arrives.

**It evaporated.** Click anywhere else and the answer was gone. Remarks have had *keep as a note*
since §5.27; an answer had nothing at all, so a good one survived exactly as long as the selection
did — and the better the answer, the more that hurt. *Keep as a comment* now turns the exchange
into a comment on the board (§5.50), or on the object if that is all that was selected: the
questions, the answers, and the words on the objects each answer rested on.

A comment rather than a note, deliberately. A note is a thing on the drawing; a comment is somebody
talking *about* the drawing, which is exactly what this is. It also lands where colleagues already
look, records who kept it and when, and can be settled when it stops mattering — without adding an
object nobody drew. And the body says plainly that a model wrote the prose. An agent's answer read
as a colleague's would be the worst outcome this feature could have, so that line is written once
per exchange rather than per answer, where it will not be scrolled past.

**You could not ask a second question.** Each ask replaced the last, which is the wrong shape: a
second question is nearly always a narrowing of the first — *"and which of those are
customer-facing?"* — and on its own that is not a question at all. The exchange now stays on screen
and the next question carries the ones before it, capped at four turns.

Only the prose of earlier turns goes back to the model, not their citations: those were checked
against these same objects, which are already at the top of the conversation, and re-sending them
would be telling the model what it is looking at. The objects go once; the turns follow.

Four turns is a cap with an opinion in it. This is one question taking a second breath, not a chat
window bolted to a canvas — the moment an exchange wants to be longer than that, what it wants is
to be an agent on the board with a purpose somebody wrote down.

One thing this uncovered: `useComments()` falls back to a no-op outside a board, and a no-op `say`
returns null, which is the *success* value. Anything asking outside a board would have reported
keeping a comment it never wrote. The fallback now refuses in a sentence.

### 5.54 The chrome stops landing on itself (v0.2)

A craft pass driven by measuring rather than looking. Opening the canvas at 1280×800 — an ordinary
laptop, not a corner case — and asking which pieces of floating chrome overlap each other turned up
three collisions, **all of them present at every window size including 1920×1080**, and all three
the same shape: *a hard-coded offset that assumed a smaller version of something which has since
grown*.

| What overlapped | By | Why |
|---|---|---|
| The property bar on the Graph panel | 117–184px | The bar clamped its position to the raw window, so it slid under whatever was at the edge |
| The Selection panel on the Map overview | 172×84px | The panel's height budget reserved 230px for the map card; the map grows a second button, *Fit selection*, exactly when something is selected — which is exactly when the Selection panel is at its tallest |
| The property bar on **the object it belongs to** | 22px, always | Placed at `sb.y - 64` while standing 86px tall. The 64 was written when the bar was one row; it grew to two and the offset never followed |

The fixes are each a removal of a guess.

**The property bar lives in the band between the panels.** `fitInsets` was already the canvas's one
answer to "where is the chrome" — it is what zoom-to-fit uses, and it carries a comment asking the
next person to keep it in step. The bar now asks it too, with `extra` at zero because it wants the
chrome's real edges rather than the breathing room a fitted board gets. Two things that must agree
now read from one function. Where the band is narrower than the bar would like, the bar wraps
instead of reaching outside it: a control that is off the edge is worse than a taller bar.

**The bar is anchored by the edge that faces the selection.** Placing it above by `top` requires
knowing how tall it is; anchoring its **bottom** a fixed gap above the selection means the height
cannot matter, because it grows away from the object rather than onto it. There is no number left
to fall out of step.

**The bottom reserve is one named number.** `--canvas-bottom-reserve`, beside `--canvas-panel-top`
and `--canvas-topbar`, so a panel hanging from the top subtracts the topbar it hangs below and the
map card it must not land on — and the next person to add a row to the map card has something to
change rather than a magic `360` to reverse-engineer.

What it is worth, measured on the same board: objects hidden behind the property bar fell from five,
four and three (at 1280, 1440 and 1920) to **one at every size**, chrome-on-chrome overlap went to
zero, and the share of the canvas covered by chrome at 1280×800 went from 43% to 41% — a small
number that undersells it, because the change is not how much is covered but *what*: the panel you
are reading and the card you just clicked.

The durable part is the check. The browser suite now resizes to 1280×800, selects a card, and fails
if any two pieces of chrome overlap or if the property bar is standing on its own object. None of
these three bugs is visible to a unit test and all three are obvious in a window; the suite is the
only place that can see them.

### 5.55 Say it once, and give the canvas edges (v0.2)

§5.54 stopped the chrome landing on itself. This asks the harder question: how much of it should be
there at all. Measured on the same board at 1280×800, again rather than judged by eye.

**The same facts were on screen three times.** The object count appeared in the topbar, in the map
card and in a status line along the bottom. The zoom appeared in the topbar, in the map card and in
the zoom control. "Autosaved" appeared in the status line and, in more detail and in real time, in
the topbar's save pill. None of it was wrong; all of it was noise, and the reason it accumulated is
that each piece was added by somebody looking at that piece rather than at the screen.

So each thing is now said once, by whichever piece owns it: the **topbar** counts the objects, the
**zoom control** owns the zoom because it is the one you can press, and the **map** keeps what only
it knows — the composition, and how much of the board is in view. The status line is gone entirely.

**Three right-hand cards, three left edges.** The Selection panel, the map and the zoom control were
234, 174 and 231 wide at margins of 12, 10 and 10 — left edges scattered across sixty pixels. Each
was individually reasonable, which is exactly why it survived; together they read as three cards
somebody had dropped rather than as one rail. They now share `--canvas-rail` and
`--canvas-rail-gap`, and the right side reads as an edge.

**The search bar was 720×53 of the best space on the canvas, empty.** Dead centre at the top, over
the board, permanently — for a box that advertised **⌘ K** on its own right-hand end. It rests as a
pill now and opens on ⌘K or a click, in the same place with the same shadow and the same keycap, so
it reads as the thing that was there rather than as something removed. The documentation already
told people to press ⌘K; the bar is now what the documentation always said it was.

**The map starts folded away.** It was the largest permanently-open thing on the canvas — 234×268,
six and a half per cent of a laptop screen — for a view of the board you want occasionally and can
otherwise get by zooming out. Its toggle is in the tool rail with an on/off badge, so it is one
press back and visibly off rather than missing. Inventory and Selection stay open: those are the
product, not a convenience.

Because the reserve a top-anchored panel keeps for the map should not be kept for a map that is not
there, the canvas carries `data-map` and the custom property follows it. With the map away the
Selection panel is 600px tall instead of 344 and shows an object's attributes without scrolling —
the declutter gave the remaining panel its content back, which is the part worth having.

One bug came out of building it, caught by the browser suite rather than by review. The blur that
folds the bar away is deferred 150ms so that clicking a suggestion lands before the list disappears;
press Escape and then ⌘K straight away and that *stale* timer fired afterwards, folding the bar up
under whatever had just been typed. It is cancelled when the bar opens now. Reproduced three times
out of three before the fix and none out of three after — the second time this session that a
browser test has caught something no unit test could see.

| At 1280×800, with a card selected | Before §5.54 | Now |
|---|---|---|
| Chrome over the canvas | 43% | **32%** |
| Pieces of chrome | 9 | **7** |
| Board objects hidden behind the property bar | 5 | **1** |
| Chrome overlapping other chrome | 3 collisions | **none** |

### 5.56 The meta-model means something (v0.2)

§5.14 built the declaration — node types, fields with data types and required flags, enum options,
relation rules — and then checked almost none of it. A field could be marked required and be missing
on every object; an enum could list four options and the data hold nine; a date field could contain
"Q3"; only relation rules were ever counted, and only as a number. Everything else the modeller
wrote down was decoration. A model nothing is checked against is a diagram of good intentions.

And a new workspace started from nothing: the model could only grow from whatever got imported
first, so the vocabulary of an estate ended up being the column headings of somebody else's
spreadsheet. Ardoq's answer to that — best-practice models you apply on day one — is a good one.

Two halves, then, both on the meta-model page as tabs beside Details and Diagram.

**Conformance** (`src/lib/metamodel-conformance.ts`) checks the estate against every claim the
declaration makes and names each object that breaks one. Six kinds of breach: an object of a kind
nobody declared, a missing required field, a value outside its field's vocabulary, a value that is
not the data type it was declared as, a relation of an undeclared type, and a connection no rule
allows. The output is not a number. Every breach carries one object, a link to it, and a sentence:
*"Maximo" has no owner, and Application requires one.* "83% conformant" tells nobody what to do on
Monday.

Two headline numbers rather than one, because one would lie:

| Number | What it is | Why it is separate |
|---|---|---|
| **score** | of instances *of declared types*, the share breaking no rule | It is the only honest denominator: an undeclared kind cannot break rules it was never given. |
| **typed** | of the whole estate, the share of a declared type at all | Without it, a workspace that declares one type and obeys it scores 100% on 3% of its estate. |

Beside them a sentence, because a percentage is not a verdict — from *"Nothing is declared yet, so
there is nothing to conform to"* through *"Most of this estate is of types nobody has declared"* to
*"The declared model and the data disagree more than they agree. One of them needs to change."*

This is deliberately **not** estate health (§5.18). Health asks whether an estate is in good shape
by general EA standards, on checks nobody in this organisation chose. Conformance asks the narrower
and more useful question: does the data obey *the rules these people wrote for themselves*. An
estate can be in poor health and perfectly conformant, or immaculate and conform to nothing. Each
screen says so and links to the other.

Nothing rejects a write. The premise of the whole product is that the model grows out of the work
(§2.2, §5.14), and a canvas that refused a card because a field was empty would stop the drawing
that produces the model in the first place. So conformance reports, names, and leaves the decision
where it belongs — the data may be wrong, or the model may be.

**Standard models** (`src/lib/metamodel-standards.ts`) are three starter meta-models: an application
portfolio, a business capability model, and integration and data flow. Three rules kept them honest.
*Small* — the smallest model that is still useful, not the largest that is still defensible; a
forty-type starter model is somebody else's opinion imposed as work. *Additive* — applying one never
renames, never deletes and never touches an entity; it adds only what is missing, so it is safe on a
workspace that has been running for a year, and applying it twice does nothing the second time.
*Attributable* — each says where its practice comes from, which is this product's habit everywhere
else.

The summary above the button is a plan computed against *this* workspace's live model
(`planApply`), not a description of the standard: *"Adds 5 object types, 9 fields, 5 relation types,
6 rules."* When there is nothing left to add it says *"Everything in this standard is already
declared here"* and the button is disabled. The plan is recomputed server-side at write time as
well, so a stale page cannot double-declare.

Applying a standard usually makes the conformance numbers *worse*, and that is the point. Before,
nothing was declared, so nothing could be wrong. The breaches were already there; there were simply
no rules to see them against. On the seeded estate: 100% / 0% before, 48% / 61% after.

One thing that looked like a detail and was not: the sentences embed type names, which are somebody
else's words, so `article()` picks *a* or *an* from how a name is **said** rather than how it is
spelt — a leading acronym is read letter by letter (an IT Component, an API, an SLA, but a CRM
System), and a leading "u" is "yoo" in the words people use for types (a User, a Utility). "is a
Interface" in a compliance report is the sentence that makes a reader stop trusting the tool.

### 5.57 Modelling frameworks: C4, UML, DDD, MBSE, IT4IT, SAFe (v0.2)

§5.56 shipped three "standard models" — an application portfolio and two neighbours — as somewhere
to start. Building them made the smaller idea visible: an organisation does not only choose *which
types* it wants, it chooses **a way of describing things**, and those ways have names people already
argue about. Ardoq's insight is that such a notation is not a feature of the drawing tool but *a
metamodel you adopt*. So the three standard models are gone as a separate concept and are three of
nine **frameworks**, in four families:

| Family | Frameworks |
|---|---|
| **Notations** | C4 model · UML class model |
| **Domain and engineering methods** | Domain-driven design · Model-based systems engineering |
| **Operating models** | IT4IT · SAFe |
| **Portfolio models** | Application portfolio · Business capability model · Integration and data flow |

A framework carries what a standard model carried — object types with fields and data types,
relation types with rules — plus the two things that make it a framework rather than a bag of types:

- **Levels.** Most of these are layered, and a type without its level is half a type. C4's four
  zoom levels; DDD's strategic and tactical halves; MBSE's requirement / functional / physical /
  verification spine; IT4IT's four value streams; SAFe's portfolio-to-team. The levels are the
  first thing the panel shows, because they are how somebody recognises their own framework.
- **Provenance, carried down.** `node_types.framework`, `node_types.level` and
  `relation_types.framework` (migration 0026 / pg 0019) mean a year later the model can still answer
  *who said an Aggregate was a thing here* — us, or Eric Evans. Every type in the tree wears a small
  tag; the detail pane says "declared by C4 model · Container".

**More than one at a time**, which is the whole reason for adopting rather than choosing:
`framework_adoptions` is a row per workspace per framework, not a column on the workspace. The
software in C4, the domain in DDD, the funding in SAFe. Where two frameworks want the same type
name it is declared once and keeps whatever provenance it already had — a framework does not get to
claim something the organisation had invented for itself just because the names collide. The page
says it in a sentence: *Models with C4 model and Domain-driven design.*

**Free form is a real answer** and remains the default. A workspace that adopts nothing and lets the
model grow out of the drawing is using the product exactly as §2.2 intends; the frameworks are for
teams who already think in one and should not have to retype it.

Adopting is additive by construction, as §5.56 established: nothing renamed, nothing deleted, no
object touched, and the summary above the button is a plan computed against *this* workspace's live
model and recomputed server-side at write time. Adopting the same framework twice does nothing.
**Stopping** deletes the adoption row and nothing else: by then the types may hold hundreds of
objects, and a modelling decision reversed must not take the estate with it.

Writing nine templates needed rules, or the catalogue would rot the first time somebody added one in
a hurry — so the rules are unit tests over the catalogue itself, not prose. Every framework must
name the question it answers and where its practice comes from; must not constrain a relation
between types it does not itself declare; must place every one of its types at one of its own
declared levels, or declare no levels; must give every enum a vocabulary; must give every type a
colour; and must not require more than two fields on any type. Two of those failed on the first run
and the *templates* were wrong, not the tests:

- **MBSE required three fields on a Requirement**, including `verification method`. True to the
  discipline and wrong for the tool: the first import of somebody's requirements register never
  carries it, so every requirement would arrive non-conformant, and a conformance report that is red
  on arrival is one people learn to ignore (§5.56). It is a closed vocabulary of the standard four
  and it is optional.
- **The business capability model declared "levels" that were not levels.** A capability's depth is
  a property of the *instance* — the `level` field on Business Capability already carries it — and a
  framework level groups *types*. Two different ideas wearing one word; the model now declares none.

The two failures are the argument for the whole test file: nobody reviewing nine templates by eye
catches either.

**What this does not do yet.** Adopting C4 gives you its types, its fields, its rules and its levels
in the model; it does not yet change how a Container is *drawn*. The shape should follow the
framework — a C4 container showing its technology, a UML class with three compartments, a DDD
aggregate inside a dashed consistency boundary — and a board should be able to say which framework
and which level it is drawn at. That is the next piece, and it is drawn in `docs/design/mocks`
(direction 4).

### 5.58 Layers: a stack the data can propose (v0.2)

A layering is the one part of an EA model everybody arrives already having an opinion about —
business over application over technology — and the one most tools make you configure before you
have any data to configure it from. **Layers** group node types and relation types into an ordered
stack (`layers`, migration 0027–0028 / pg 0020–0021, with `layer_id` on both type tables).

Three things can create a band, and the row says which:

| Source | |
|---|---|
| **By hand** | Somebody typed it. |
| **A framework** | §5.57's per-framework `levels` were always layers; they are the same idea and are now the same rows. Adopting ArchiMate, C4, IT4IT or SAFe brings its bands and places its types. |
| **From the data** | The agent read the stack out of the estate. |

The third is why this rev exists. §2.2 says the organisation's data describes its meta-model, and a
layering is a place where that is unusually easy to mean literally: **direction of dependency is
already in the graph**. If nineteen connections run Application → Server and none run back, Server
is underneath — not a guess about names, a fact about edges. `src/lib/layers/infer.ts` sums the
observed connections between every ordered pair of kinds, keeps the dominant direction, breaks any
remaining cycle by dropping its weakest edge, and ranks by longest path from the kinds nothing
points at. Equal rank is the same band.

Every band carries the counts that put it there — *"3 of the 5 connections between this band and the
one above run downward"* — and the reading reports what it had to decide for itself: a near-tie
(*"6 connections against 5, close enough to be worth checking"*), an edge dropped to break a loop,
and any kind nothing connects at all, which the data simply cannot place. Under six connections it
declines to read a stack rather than doing arithmetic on noise.

**Only the name is guessed, and only when the data agrees with it.** A small word list puts
Business, Application or Technology on a band so it arrives readable. Two rules keep that from
becoming a lookup table wearing the vision's clothes:

- The list may never decide *what is in* a band. Naming a band "Technology" because it holds Server
  and Database is a convenience; putting Server and Database in the same band is a finding.
- Conventional names are accepted **all or nothing**, top to bottom. If the estate has put
  infrastructure above the applications — and estates do — then "Technology" at the top would import
  a claim the data does not make, and dropping only the offending name leaves a stack that still
  *looks* conventional and is not. So either the whole reading agrees with the conventional order,
  or every band is named after its own largest type: duller, and always true. On the seeded estate
  it is the second case, and the bands come out IT Component / Application / Business Capability.

Accepting the reading is additive like everything else that writes a model: a band the workspace
already has is reused, and a type somebody placed by hand is left alone — an agent that overwrites a
person's decision is one people turn off. A kind that has never been declared *is* declared as part
of it, which is the honest consequence rather than a side effect to hide: a kind that is not a type
cannot be in a layer, and the button says so.

**The mirror is the more useful half.** Once a stack exists, `upwardFlows` lists every connection
running up it, with counts: *"2 connections run Application → IT Component, which is Application
reaching up into IT Component."* Either the connection is wrong or a type is in the wrong band. As
with conformance (§5.56), nothing is blocked.

And the type diagram becomes the stack: with layers present the force simulation decides *x* only
and the band decides *y*, so an edge pointing upward looks like an edge pointing upward. Types in no
layer sit below the stack in a dashed band rather than being quietly dropped to the bottom.

**ArchiMate (core)** joins the catalogue with this — ten of its ~60 elements over four bands. It is
the layered EA language and the reason this section exists; shipping layers without it would have
been odd.

Two bugs the browser found that no unit test had asked about, both now tests. The word list gave two
different bands the same name, which a unique index refuses — the bigger band keeps the word and the
other is named after its largest type. And accepting a reading placed nothing at all, because every
kind in the seeded estate is undeclared and there was no row to put a `layer_id` on; that is what
the declaring step above is for.

### 5.59 The tool rail earns its place (v0.2)

The rail down the left had been added to and never looked at. Three things were wrong, and they
are the three things a rail can get wrong.

**Every button wore a permanent caption.** "frame", "card", "note", "text", "section", "agent",
"shape", "graph", "on", "off" — ten 8px words, positioned into the four-pixel gap below each button
so they crowded the one beneath. This is the duplication §5.55 spent a whole revision removing from
the rest of the canvas, still sitting in the one piece of chrome that rev did not open. They are
gone. What replaces them is a **tooltip carrying the keycap** — because the shortcut is what a
returning user actually wants, and it had been hidden in a native `title` attribute where it takes
a second to appear and cannot be styled.

**The one submenu was pinned to the viewport.** `shape-picker-panel` was a floating card at an
absolute `left: 74px; top: 250px`, so it pointed at whichever button happened to be at 250px. The
same class of mistake §5.54 fixed for the property bar, in the place that had been missed. Flyouts
are now anchored to the button that opens them, and a flyout is no longer a `PanelName` at all: a
panel persists and other things toggle it, a flyout is component state that closes when you look
away.

**Two icons described the wrong thing** — a 3D cube for an architecture card and a paragraph-heading
mark for a section. An icon that describes the wrong thing is worse than a plain square, so those
two and the dashed connector are drawn: a card is a rounded rectangle with a type stripe, which is
what a card looks like; a section is a band with a name tab, which is what a section looks like.

Then the part that adds rather than removes: **three flyouts that remember.**

| Flyout | What it offers |
|---|---|
| **Card** | The eight card kinds with their colours. The kind is armed *before* placing, so an interface arrives as an interface rather than as an Application you retype. The rail button wears the armed kind's stripe. |
| **Shape** | Rectangle, oval, rhombus. The button shows the one you picked last and re-arms it on click. |
| **Connection** | Arrow, plain line, dashed — each saying what it is for, because three arrows look alike and "dashed means proposed" is a convention nobody is born knowing. |

Clicking a flyout button both arms the remembered choice *and* opens the menu, because both
readings of a split button are right: somebody who wants what they used last wants one click, and
opening the list costs them nothing since they are already drawing. Arming a shape from the
keyboard moves the rail button too — otherwise the button shows one thing while the canvas draws
another.

The rail's contents live in `src/canvas/toolbar.ts` as data, for the same reason the framework
catalogue does (§5.57): a rail is a list of claims — these are the things you can make, this key
arms that tool — and claims can be held to invariants. The tests check that every button is in
exactly one group, that no two buttons share a letter, that every advertised shortcut is one the
key handler actually honours (`TOOL_KEYS` is deliberately re-typed in the test rather than
imported, or the test would only agree with itself), and that a toggle says something different in
its two states — which is the on/off badge problem stated as a rule.

Measured in the browser on the seeded landscape board, the rail is now **44×559** with fifteen
buttons and no text on any of them. The one it replaces had fourteen buttons carrying ten permanent
captions between them, in a column 52px wide by its own CSS — the extra eight pixels were there to
give the captions somewhere to sit.

### 5.60 The wiki: pages that reference the model (v0.2)

Every architecture wiki fails the same way. Somebody writes a good page; the estate moves; the page
stays where it was; a year later nobody trusts any of it. Confluence does not have a bug — the
failure is structural, because a page there is a **copy** of what was true on the day it was
written.

So the wiki in Nexus is built the other way round: a page is markdown, and the parts of it that are
about the architecture are **references** resolved when the page is read.

| Directive | What the reader gets |
|---|---|
| `:::board brd_landscape` | The board itself, drawn from its current document by `documentToSvg`. Change the board and the page changes. |
| `:::object ent_8f21c40a` | One object with its kind, description and attributes as they are now. |
| `:::query kind:Application missing:owner` | A live list of whatever matches today, over the same query language as the graph page (§5.13). |

`[[Wiki links]]` resolve against the workspace's pages; a link to a page nobody has written yet is
shown as unresolved rather than as plain text, so a wiki can see what it has promised itself. And
an embed whose target has been deleted says so **in place** — a wiki that silently drops a diagram
is worse than one that admits the diagram is gone, because only the second gets fixed.

**A board writes its own first draft.** Blank pages are how wikis stay empty, so *New page → write
up a board* produces something already half true (`src/lib/wiki/writeup.ts`): the board embedded
live, the objects grouped by kind, how they connect from the graph rather than from the drawn
connectors, and the notes somebody left on the canvas carried across — those being the one part
that is already prose rather than data. A kind with more than six objects becomes a live query
instead of a table, because a list of six is worth reading and a list of forty is worth querying.
If the board has frames, the draft takes its structure from them: your areas become its sections,
and anything outside every frame is named rather than quietly dropped. It ends with **Still to
write**, because a generated page that reads as finished is one nobody edits.

The draft is deterministic, not written by a model, which is the same order as everywhere else in
this product: it works with no provider configured, gives the same answer twice, and a model can
improve the prose later (§5.31). The deeper reason is that a model asked to describe a board writes
prose that is true on the day it is written — exactly the failure this section exists to avoid. The
generated parts are references; the parts that can go stale are the ones a person wrote.

**The markdown is ours** (`src/lib/wiki/markdown.ts`), for the same reason the in-product docs are
typed blocks (§5.23): it parses to a tree that React renders as elements, so there is no
`dangerouslySetInnerHTML` on the one surface where people paste out of Word — the single exception
is the board SVG, which this app generated two calls earlier and which escapes what it draws. Two
properties are tested harder than the syntax: **nothing may disappear**, because a parser that
swallows a line it does not recognise loses somebody's writing; and **it must terminate**, because
a hand-written block loop that consumes zero lines is an infinite loop in a server component. The
second one was not hypothetical — the fence branch never advanced its cursor, and the first version
of the property test was too weak to reach it. Both are tests now.

Pages nest, deleting one moves its children up rather than taking them, and renaming keeps the
slug, because an address somebody pasted into a mail six months ago should still work.

**What is not here yet**, and is worth naming because this is meant to grow: page history and
diffs; drag to re-file; a review flow for pages that are decisions rather than descriptions (ADRs
with an approval, which is the wiki's version of a pull request); embedding one page in another;
and full-text search across pages.

### 5.61 An owner who is not the demo (v0.2)

Nexus has no self-signup, by design: accounts are made by somebody who already has one (§5.41).
That is right for a workspace tool and leaves exactly one hole — the first real person, who has
nobody to ask. A fresh deployment could only be entered through the seeded demo account, and an
operator who had seeded and then changed that password had no way in at all.

Three environment variables, read on **every start** rather than only on an empty database,
because the case that bites is the already-seeded one:

```
NEXUS_OWNER_EMAIL=you@example.com
NEXUS_OWNER_PASSWORD="your password"      # quote it — see below
NEXUS_OWNER_NAME=Your Name                # optional; derived from the address otherwise
NEXUS_OWNER_PASSWORD_RESET=1              # only when you mean it
```

`ensureOwner` creates the account if it is missing, makes it an owner of every workspace, and is
idempotent. It **will not** reset a password that already exists unless `..._PASSWORD_RESET=1` is
set as well: a stale value left in a deployment's configuration must not quietly undo every
password change anybody has made. It never throws — a typo in one variable must not stop the
application from starting — and it never logs the password, only the address and what it did.

**The floor here is eight characters, not the application's ten**, and that is the one place the
two differ. Ten is right in the People page, where one person is setting a password somebody else
has to live with. This is a different act: an operator setting their own password in their own
deployment's configuration, where the alternative to accepting it is a deployment nobody can sign
in to. The in-app rule is untouched, which does mean a password accepted here cannot later be
re-typed in the app — worth knowing rather than worth preventing.

One trap, found by walking into it: **`#` starts a comment in a `.env` file**, so an unquoted
`NEXUS_OWNER_PASSWORD=abc##` is read as `abc` and the account is created with a password nobody
can guess — or, as happened here, refused for being too short with no hint as to why. Quote the
value. The refusal now names the length it saw, which is what made it findable in seconds.

### 5.62 Getting a LeanIX workspace out (v0.2)

Nobody starts from zero. §5.30's catalogue has carried an entry for an incumbent EA repository
since it was written, on the argument that bringing one in as *data* is the difference between a
migration and a rebuild. This is the first half of that, for LeanIX: `pnpm leanix:export` reads a
workspace and writes it to files.

```
LEANIX_HOST=acme.leanix.net LEANIX_API_TOKEN=… pnpm leanix:export --dry-run
LEANIX_HOST=acme.leanix.net LEANIX_API_TOKEN=… pnpm leanix:export
```

It writes `raw.json` (everything as it came back, so nothing is fetched twice), `nexus-import.json`
(entities and relations in the Import page's own format), `dropped.json` where it applies, and a
`summary.md` counting what it found by kind — a number somebody can check against LeanIX itself.
The output directory is git-ignored: an estate export is the most sensitive file this repository
will ever sit next to.

**The token is read from the environment and never from an argument.** A secret in `argv` is a
secret in the shell history and in every `ps` on the machine. Nothing in the tool writes it down.

Two rules shape the mapping, which lives in `src/lib/leanix/map.ts` — pure, and separate from the
fetching, so the half with judgement in it can be tested without a licence or a network:

- **Keep their vocabulary.** An `ITComponent` becomes an "IT Component", not a "Technology". The
  names an organisation has used for years are the ones its people search for, and a migration
  that renames everything on the way in is one nobody can check. Only the spelling is normalised.
  Relation names keep both ends and invent no verb: `relApplicationToITComponent` becomes
  "application → it component", because a guessed "uses" would be an invention presented as data.
- **Lose nothing quietly.** Every configured field crosses as an attribute; the LeanIX id is kept
  so a second import updates rather than duplicates; subscriptions become the ownership fields
  every health measure asks for first (§5.18). Two fact sheets that share a name — LeanIX allows
  it, and a large workspace is full of "Reporting" — get the id appended to *both*, because Nexus
  keys an import on the name and merging two systems into one is the quietest possible data loss.
  A relation whose other end was not exported is **counted and listed**, not discarded: a relation
  count that silently shrinks is how somebody concludes the export worked.

Verified end to end against a stub that speaks the real two-step auth and pages the way Pathfinder
does — the token exchange, two pages, the duplicate names, the dropped relation. It has **not**
been run against a live LeanIX instance from here; outbound access to that host is closed in this
environment, so `--dry-run` exists to prove the token, the host and the network in about a second
before anything is written.

The other half is §5.63.

### 5.63 The fourth door: an EA repository, read straight into a staged import (v0.2)

§5.62 got a LeanIX workspace onto disk. This puts it into the product, and it does so by adding
**nothing to the pipeline**: the repository is a *door*, exactly like Files, Paste and A connected
system (§5.35, §5.37), and everything behind the door is the import machinery that already exists.
Host and API token on the Import page, and the workspace arrives as a staged batch that is then
mapped, matched against what the graph already holds, decided on a board, approved by a person and
rolled back if it was wrong (§5.21, §5.36).

That was the design goal and it is worth stating plainly, because the tempting shape here is a
"LeanIX importer" with its own review screen, its own matching and its own idea of what a conflict
is. Three months later there are two import pipelines and the second one has none of the first
one's lessons in it. The translation is 120 lines in `src/lib/leanix/batch.ts` and stops there.

**One file per fact sheet type.** The pipeline reasons per file — a file has a kind — and a
workspace's Applications and its IT Components are not one kind. It also makes the review legible:
"342 Applications, 88 IT Components" instead of an undifferentiated pile of 430.

**Declared, not guessed.** `BatchFile.declared` is new, and `stageBatch` skips its column guesser
for a file that carries it. The mapper exists because a CSV says nothing about itself; a
repository with an API is the opposite case. Letting the regexes overwrite what LeanIX *stated*
would turn known facts back into inferences — and would silently lose every relation, whose
headers are LeanIX's own relation names rather than the English the guesser looks for.

The column roles come out as: the fact sheet name as the name, the description as the description,
**the LeanIX id as the key** — which is what makes the second read an update rather than a second
copy of the estate — every configured field as an attribute, every subscription as a person (off
by default, like every column that names somebody), and every modelled relation as a relation
named the way LeanIX names it. §5.62's two rules still hold on the way through: their vocabulary
is kept, and nothing is lost quietly.

The batch records **EA repository** as its origin — a fourth value beside files, paste and a
connected system — for the reason §5.37 gave for recording it at all: *somebody pasted this* and
*a repository was read* are different kinds of claim, and the provenance is worth as much as the
data.

`NEXUS_LEANIX_BASE_URL` overrides where the host is reached, for an enterprise gateway in front of
the API — and, deliberately, it is server-side only. A caller who could choose the endpoint could
choose where the token goes. The token itself is used for the one read and never stored; a failed
read keeps what was typed, because a mistyped host should not also cost you the token.

`pnpm e2e` now starts a LeanIX of its own (`e2e/leanix-stub.mjs`) speaking the real two-step auth
and a cursor-paged GraphQL, and the suite walks the whole road: a refused token, two pages of fact
sheets, the declared column roles, two fact sheets that share a name, approve, and roll back. So
the door is tested rather than merely compiled. Along the way the disambiguator got a real fix:
it appended the first eight characters of the id, which for two ids sharing a prefix produced the
*same* name twice — worse than not disambiguating at all. The prefix now grows until it separates
them.

### 5.64 The platform console: above the tenants (v0.2)

Everything built so far happens **inside** a workspace, and `workspace_members.role` (§5.46)
answers exactly one question: what may you do here. It cannot answer the questions of the person
who runs the deployment — how many customers are on it, which of them was created and never used,
who has an account at all, who cannot sign in and needs a password set. None of those is about a
workspace, so none of them can be a workspace capability, and inventing one would mean either a
fake workspace to ask about or a permission that ignores the argument it is given.

So a second, thinner level. One platform role on the account (`users.platform_role`, null for
everybody normal), one guard of its own in `lib/admin/guard.ts`, and a console at `/admin` outside
`/w/[slug]` — because this is not *in* a tenant, and framing it inside a workspace sidebar would
suggest it belonged to whichever one you last looked at.

**To everybody else the console is a page that is not there.** `notFound`, not a refusal: "this
exists and you may not see it" is itself something a URL should not teach, which is the same
argument §5.48 made for workspaces a person is not a member of. The sidebar link appears only for
an operator, for the ordinary reason that a console nobody can find is a console nobody uses.

**Tenants.** Every workspace on the deployment with its people, owners, boards, objects, relations
and one word for what it is doing: *empty* (created, nothing in it), *dormant* (nothing changed for
`DORMANT_DAYS`), or *in use*. Sorted by size rather than alphabetically, because the question the
page is opened with is "who is actually using this" and an alphabetical list buries that under
whoever is called Acme. "Last activity" is the newest board save, deliberately — a board is what
somebody has to open and change by hand, so an agent run or a scheduled import cannot make an
abandoned tenant look busy. Creating one gives it an owner and a single space; nothing else,
because what a tenant is for is its own to decide. Renaming and re-addressing are separate acts: a
name is a label, an address is in every link anybody ever shared. Deleting asks the operator to
type the address back — not because a confirm is hard to click, but because they are the one person
who cannot see what is inside, and retyping is the step that makes them read which tenant they are
on. The dialog says what would go with it, counted.

**People.** Every account on the platform with the four facts the workspace People page cannot
show: operator or not, has a password or not, belongs to no tenant, and how many live sessions
right now. Memberships can be added, changed and removed from here across any tenant. Setting a
password **ends every session that person has** — setting one while the laptop that prompted it is
still signed in achieves nothing at all — and that single action is what this console was asked
for.

Three rules the schema cannot state, and one the console refuses on principle:

- **The last operator cannot stand down, and cannot be deleted.** A deployment with no operator has
  no way back except its environment variables, and the person who would have to edit them is not
  necessarily awake. The same shape as §5.46's last-owner rule, for the same reason.
- **You cannot delete your own account from here.** Locking yourself out of the console you are
  standing in is never what you meant.
- **Deleting a person does not delete their work.** Boards, versions, comments and change sets name
  whoever made them and those references are `set null`, not cascade. What goes is the ability to
  sign in and the memberships; the record of what happened is not theirs to take with them.
- **An operator does not silently join the tenants they can see.** Creating one names its first
  owner explicitly. Being able to administer a customer is not the same as being in their workspace,
  and quietly making it so would be the surprise that makes an operator distrust the tool.

`ensureOwner` (§5.61) now also makes the bootstrapped account an operator, by the same argument
that created it: a console only an operator can open, on a deployment with no operator, is a
console nobody can ever open. The seeded demo owner is one too, so the console is real in the demo
rather than a screenshot. An operator can make another from the People page, and should — one
operator is a single point of failure with a person attached to it.

The guard-coverage test (§5.49) gained a clause of its own here: every action in `admin/actions.ts`
must call `denyOperator`, and must **not** call the workspace `deny`. A workspace check inside a
platform action would pass the generic "is it guarded" scan while refusing the very person the
console exists for — an operator acting on a tenant they are not a member of has no role in it to
check.

### 5.65 The sidebar shows the work, not the plumbing (v0.2)

The rail had reached nineteen entries in one undifferentiated run — Home next to Models next to
Documentation next to the platform console. Nobody decided that; every revision that added a
surface added a line, and no revision ever read the whole list. Nineteen things with no grouping
is not a navigation, it is an inventory, and the cost falls on whoever scans it several times a
day looking for the four they use.

Two rules, and they are the whole design.

**Frequency is the axis.** Boards, the model and the data coming in are daily. Which model
provider is configured, who is in the workspace, what an MCP key may reach — monthly, and usually
because something is wrong. Giving each of those a permanent slot charged the daily work for the
monthly work, so they moved behind one **Settings** entry and got a screen of their own.

**A group is worth a label or it is not a group.** Four quiet headings — *Model*, *Data*, *Work*,
and an unlabelled first group for Home/Recent/Starred/Teams — turn thirteen entries into four
things to choose between. That is a scan rather than a search. The first group is deliberately
unnamed: calling it "the workspace" states the obvious.

The rail is now 14 entries in 4 groups; Documentation and Settings are pinned below the spaces,
reachable everywhere and costing the rail nothing.

`/w/:slug/settings` is a shell with its own nav over the three pages that were already at that
address and had nothing in common but the URL — somebody who came to change a password and then
wanted to check a key had to leave through the sidebar to find it. It redirects to the first entry
rather than rendering a menu of the links already visible beside it.

The **platform console** (§5.64) sits in that nav under a divider labelled *Above this workspace*,
for operators only. It is not this tenant's configuration — it is the deployment every tenant is
on — and an operator arriving from inside one workspace must not be able to mistake the two.

The structure is data in `components/workspace/nav.ts`, held to rules by a test rather than by
eye: the rail stays at or under fourteen, no group exceeds five, nothing sits in two groups, every
entry has its own address, and **nothing under `/settings` or `/admin` may appear in the rail**.
That last one is the regression this exists to catch — the next revision that adds a settings
screen and reaches for the rail because that is where the last one went. Which is precisely how it
got to nineteen.

### 5.66 The meta-model becomes one surface (v0.2)

The page was a file tree beside a five-tab inspector: Details, Diagram, Layers, Conformance,
Frameworks. Measured at 1440×900 it was 81 controls, 50 of them buttons, with the tab strip
wrapping into a ragged three-row block and half the viewport empty. Eighteen types were eighteen
identical rows — a caret, a dash, a name, a dot, a count — which is a list you read once and never
scan again, because nothing in a row tells you which one matters.

Worse than the clutter was what it hid. The two facts somebody opens this page to learn were both
behind a click: **which of our types are real declarations rather than accidents of the data**, and
**does the data obey them**. Forty-one conformance breaches were a badge on the fourth tab.

**The model is a board of cards.** Five to thirty types is exactly the range where cards beat both
a tree and a diagram: a card can carry state, and a row cannot. Each one shows what it is called,
how much of the estate it accounts for, whether it was declared, and **one** thing to do about it.

**Declared or emergent is the strongest signal on the card** — solid border against dashed, on a
warm ground. That distinction is what this product is *about*, and it is now legible across the
whole model without reading a word.

**One nudge, never four.** A card listing everything wrong with it is a report, and nobody works
from a report. The order is an argument: an undeclared type outranks a broken rule, because until
somebody says what a thing is there is no rule to break; a breach outranks an undeclared field,
because a breach is the data contradicting a decision already made. And when *every* card in a
band says the same thing — as they all do in a workspace that has declared nothing — the sentence
is hoisted into the band heading and said once. Eighteen copies of a good prompt is wallpaper.

**The two numbers, at the top.** Described and Conforming, as bars, with a sentence naming which
is the binding constraint. Both are needed and either alone lies: a model describing four per cent
of the estate perfectly reports 100% conformance. Each number is a filter, because a figure you
cannot act on is decoration.

**Five tabs became one view with three drawers.** Layers is a *grouping* of the board, since
banding the model by its layers is the same act as looking at the layers. Conformance and
Frameworks are drawers you consult about the model on screen, not separate screens showing the
same types again. The diagram is a shape toggle. The inspector appears on selection and gives the
space back when nothing is selected — a permanent panel reading "select a type on the left" is a
third of the screen spent saying nothing.

Two honesty bugs found by looking at the result rather than by reasoning about it:

- **Conformance over an undescribed estate is undefined, not perfect.** A full green 100% bar sat
  beside "0% described". There are no conforming instances and no breaking ones; the ratio does
  not exist. It renders as `—`.
- **An undeclared kind is not a broken rule.** The verdict read "100% of that obeys the rules. The
  breaches are listed" — contradicting itself in one sentence, because `kind-undeclared` and
  `relation-undeclared` were counted as breaches while coverage already accounted for them. The
  strip now excludes exactly the two kinds `conformance()` excludes from its own score: two
  definitions of "a breach" on one screen is how the numbers stop agreeing.

The judgements live in `lib/metamodel-board.ts` — pure, and tested, because "which complaint does
this card show" and "which number is the problem" are the design, and a design worth arguing with
belongs somewhere it can be argued with.

Measured after: 62 controls against 81, the page 995px tall against 1170, and the health of the
model readable before a single click.

### 5.67 The triple as the unit of the meta-model (v0.2)

Taken, deliberately and with attribution, from **Ardoq's constraints table** — the best idea in
their product. The unit of a meta-model is not the relationship *type*, it is the **triple**:
source → relationship → target. "An Application uses an IT Component" is a statement an
organisation can agree with or reject. "uses", on its own, is not.

Nexus already computed every part of this. `observedPairs` has carried the from→to pairs with
their counts and a `declared` flag since the meta-model was built, and `relation_rules` has
carried the declarations. What was missing was somewhere to see them together: the information
lived inside one relationship type's detail panel at a time, split across two separate lists, so
the shape of the model's rules was never visible at all.

**Rules is now a third shape on the board** — Types, Rules, Diagram — and the whole screen is one
sentence repeated with a status and a count.

Three statuses, and the third is what this product exists for:

- **in use** — declared, and the estate does it. The model working.
- **unused** — declared, and nothing does it. A rule written for a future that never arrived, or
  a real gap. Worth seeing; never worth deleting on the model's own initiative.
- **observed** — the data does it and nobody declared it. Every other tool in this category
  treats that as a violation to be cleaned up. Here it is the **estate proposing the rest of the
  model**, one click from becoming a rule. That is §2.2 at the grain of a single statement, and
  it is the one place where Nexus and Ardoq disagree about what the same row *means*.

Two things the table gets right that are easy to get wrong:

- **Coverage is measured in connections, not in rows.** One undeclared triple carrying four
  hundred connections matters more than nine carrying one each; counting rows would report the
  opposite and call the model nearly finished.
- **Promotion is blocked while the relationship type itself is undeclared, and says why.** A rule
  constrains a type, so there is nothing to hang one on. That is a real order of operations
  rather than a technicality — you cannot constrain a word the model has not yet agreed is a
  word — and saying it beats a button that fails.

Cardinality, already in the schema since §5.5 and never shown, appears on declared rules.

**Where we deliberately differ.** Ardoq offers Off / Guided / Strict enforcement, and is candid
that Strict "does not retroactively remove or block existing invalid references", with further
gaps in surveys and integrations. Nexus blocks nothing at all: a connection the model does not
allow is still drawn, still saved, still counted, and shows up as *observed* until somebody
decides whether the data is wrong or the model is. If enforcement is added later it will owe the
reader the number Ardoq's does not — how many existing connections a rule would put in breach,
computed before the switch is thrown, which §5.56's conformance report already knows.

### 5.68 The graph explorer becomes an instrument (v0.2)

The explorer had one view — the whole workspace as a force-directed cloud — and one view is the
problem. A cloud of everything answers no question anybody asks. The questions are *what does
this touch*, *what breaks if it goes*, *how are these two connected*, and *what is connected to
nothing at all*; no single layout is the best answer to all four, and a force layout is the best
answer to none of them.

Measured before the rewrite, on the demo workspace: 28 entities, 13 relations, **15 disconnected
groups scattered across the canvas as confetti**, labels overprinting into names of things that
do not exist ("CustomerCRMCloud", "Asset RegisterAsset Register"), 23 of 28 nodes the same
orange so colour carried nothing, and six affordances explained in a single line of 8pt grey at
the bottom of the screen.

**Three views over one graph, and the default is Focus.**

| View | The question |
| --- | --- |
| **Focus** | *What does this touch?* One entity at the centre, its neighbourhood in concentric hop rings, arrows showing which way each relation points. |
| **Map** | *What is the shape of it?* Every connected entity at once, force-directed. |
| **Paths** | *How are these two connected?* Two named pickers, and **every** equally short route, not one. |

Overview-first was the wrong default. You always arrive at a graph with something in mind, so the
explorer opens on the most connected entity — the least arbitrary opening move, and on an estate
nobody has seen before very often the right thing to look at first.

**Focus is SVG, not canvas, and has no camera.** Below the sixty-node ceiling of a bounded
neighbourhood the DOM wins on every axis that matters: real kerned text, hover and click without
hand-written hit-testing, tooltips for free, the app's own stylesheet, and a picture an
end-to-end test can assert against. The viewBox is computed from the layout, so the
neighbourhood is always framed — "Fit" was a button because the old view could be lost; this one
cannot be.

**Radius is hop count**, which is the fact you came for, and each ring grows until every node on
it has room, so nothing can overlap. Nodes on a ring are ordered by their parent's angle so
families stay together and edges mostly stop crossing. A ring's caption goes in its widest gap,
because "the top" is occupied whenever the ring's population divides four.

**Direction is the question, and the old explorer threw it away.** Every edge was undirected, so
"what the CRM depends on" and "what depends on the CRM" produced the same picture. They are
opposite answers and confusing them is how you decommission the wrong system. Connections in the
panel are now grouped by relationship type *and* split into incoming and outgoing, and blast
radius asks for downstream, upstream or either — never all three at once.

**Unconnected entities are a finding, not confetti.** Eleven of this workspace's 28 entities have
no relationships. Laid out with everything else, repulsion spread them evenly and they became
most of the picture, drawn with the same weight as the structure — while being its absence, and
usually the trace of something imported and never modelled. They now have their own section in
the rail, phrased as the finding it is, and the map does not draw them at all.

Four smaller repairs, each of which was quietly making the old view lie:

- **Labels no longer overprint.** Names that would collide with a better-connected one are
  dropped. A missing label is honest; two names printed on top of each other read as one name
  that does not exist.
- **Separately-connected clusters are packed.** A force simulation has no attraction between
  components, so clusters sharing no edge repel each other forever and "fit" ends up framing
  mostly ocean. Once the layout settles the clusters are gathered and the simulation *stops* —
  continuing to tick would shove them apart again in front of the reader.
- **Selecting something no longer greys out the map.** The old view dimmed everything but the
  selection to 16%, in the one view whose whole job is showing the estate. Only a deliberate
  question — a blast radius, a traced route — dims anything now.
- **A repeated name is disambiguated.** Three entities called "Asset Register" is a real estate's
  reality and three identical rows is unnavigable; where a name repeats, the kind is shown.

**Every step is a walk.** Reading a graph is a sequence of hops, and what makes it navigation
rather than wandering is seeing the sequence and stepping back into it. Returning to somewhere
you have been truncates the trail rather than appending, so it never records a journey nobody
took.

Deferred deliberately: an adjacency matrix for dense regions, and layered columns by meta-model
layer. Both are real, and neither is the thing that was wrong.

### 5.69 Evidence gaps: what the model does not know (v0.2)

Taken from **LeanFlow Studio** (`docs/LEANFLOW-GAP.md` §4.1), which is the best idea in that
repository: when a graph question finds nothing, do not say "no results".

"No results" is a statement about the *query*. It is almost never what the reader needs, because
the interesting fact is usually about the **model** — nobody has recorded whether anything
depends on this; this relationship type exists nowhere in the estate; the name you typed is not
a thing here. Those are different findings, and one shrug flattens all of them.

This is **§2.2 at the grain of a question**. Nexus already treats an undeclared type as the
estate *proposing* something rather than violating something. An unanswerable question is the
same kind of event and is owed the same response: say what is missing, and offer the nearest
thing that is not.

Six diagnoses, ordered most specific first, because a query can be wrong several ways at once
and the reader wants the one they can act on:

| Diagnosis | What it means |
| --- | --- |
| **unknown-seed** | The subject does not exist under that name. Offers the names it might have been — plural, half-remembered first word, abbreviation. |
| **unknown-relation** | No relationship in this workspace is called that. Offers the types that actually touch the seed. |
| **unknown-kind** | The type is unused — *not necessarily wrong*, since the meta-model may declare it and the data may not have reached it. |
| **no-evidence** | Subject and vocabulary both exist; nobody has recorded this. Offers the other direction when that is where the evidence is. |
| **over-filtered** | Every clause matches something alone; the combination has no example. Offers each clause dropped, with the count. |
| **empty-workspace** | There is nothing here yet, which is its own answer and not a fault in the question. |

**Every suggestion carries the count it would return, and suggestions that return nothing are
not shown.** Four dead-end suggestions are worse than none: they look like help and fail four
times. The first live version of this made exactly that mistake — it offered the workspace's
busiest relationship types regardless of the seed, and all four came back zero.

To make any of this possible the matcher had to become **pure** (`lib/query-match.ts`). It was
inline in `runQuery`, interleaved with the database reads, which made one thing impossible:
asking the query a second question. Diagnosing an empty result means re-running the same match
with one clause removed, which is trivial against a pure function over data already in memory
and impossible against a function that also does the loading. `runQuery` now loads everything
once — including relations, which it used to skip unless the query mentioned one, an
optimisation that is fatal to explaining an absence.

**Three real bugs fell out of building it**, all of the same shape — a query that silently lied:

- **Curly quotes did not parse.** `related:“Data Lake”` was read as the entity `“Data`, so a
  phrase pasted out of a document or an email failed in the most confusing way available: it
  found nothing, and blamed the estate for it.
- **`rel:` on its own was ignored.** The clause was only consulted inside a `related:` loop, so
  a query naming a relationship type and nothing else returned the entire workspace while
  looking like it had filtered. It now means the obvious thing: what that relationship touches.
- **"0 matches" was printed above the finding.** The header echoed the count the banner exists
  to replace. It now shows only what was asked.

**Not yet: pinning a gap.** LeanFlow lets you pin an evidence gap as a follow-up note that
survives onto a board and into exports. That wants somewhere to live, and the typed annotation
layer (#114) is where it belongs; building private storage for it here would only have to be
torn out. Diagnosis and pivots ship now; the pin follows the annotation layer.

### 5.70 Containment: the one relationship that is not a relation (v0.2)

The Nexus graph was flat. Anything wanting a tree — a capability map, C4's levels, an
organisation, ArchiMate composition — had to express it as an ordinary relation, which loses the
two things containment is actually for:

- **Counts roll up through it.** A capability's weight is its own plus everything beneath it, at
  any depth. No ordinary relation implies that, because no ordinary relation means *part of*.
- **A thing has exactly one parent**, so the structure is a tree: walkable, indentable,
  collapsible, summable. A relation kind called "contains" is a graph edge with none of those
  guarantees — nothing stops two parents, and nothing stops a ring.

So containment is a **column on the entity**, not an edge: `entities.parent_id`, indexed, with
migrations for both dialects. Note the type-level hierarchy on `node_types.parent_id` has existed
since §5.5; this is the missing instance-level twin.

`lib/hierarchy.ts` is the arithmetic, pure and tested: `forest`, `flatten`, `ancestry`,
`descendants`, `reparentProblem`, `reparentOrphans`, `rollUp`, `depth`. Four rules in it are
worth stating, because each is a real corruption rather than a matter of taste:

- **A cycle never hangs the reader.** `forest` and `ancestry` both stop on a revisit. Corrupt
  data should render as something odd, never as a frozen tab.
- **An item whose parent is outside the current filter becomes a root, not a casualty.** A
  filtered tree that silently drops those children under-reports without ever looking wrong,
  which is the failure nobody notices.
- **Deleting a parent lifts its children to the grandparent.** There is deliberately no cascade
  on the column: removing a capability must remove the level, not the estate underneath it. Both
  the single and the bulk delete do this.
- **A move that would make a ring is refused, and says why** — and the interface does not even
  offer it, because a candidate list that contains impossible choices is a list that has to be
  read twice.

In the entity drawer this is **Where it sits**: the chain above, what is directly inside with
each child's own roll-up, the total beneath, and a **Move inside…** control. Every candidate in
that control carries its full path, because three entities called "Asset Register" is ordinary
in a real estate and a list of identical names cannot be chosen from — the same lesson as
rev 102's explorer rail.

The seed now builds a real two-level capability tree over the demo estate, with the applications
sitting inside the capability they realise, so the roll-up has something to add up and the demo
shows what a capability map is for.

Two things were caught by looking at the running app rather than by reasoning about it: the
`<select>` sized itself to its longest option and pushed the drawer's contents past its own
edge (a select must be told twice — `flex: 1 1 0; min-width: 0; width: 100%`), and a stale dev
server served the old `entityDetail` for several minutes while the file on disk was already
correct. **After editing a server module, restart before judging the UI.**

**Not yet, and tracked on #110:** the LeanIX importer still flattens `relToParent` into an
ordinary relation instead of setting the column — that needs a parent column carried through the
batch and staging format. The explorer rail is still a flat list, and a board cannot yet expand
or collapse a parent into its children. The meta-model has nothing to say about which types may
nest inside which; that belongs with the governance work in #128.

### 5.71 Objectives: what the estate is for (v0.2)

The framework catalogue (§5.57) could describe an estate six ways and a strategy in none. That
left a real hole, because most of what an architecture team is actually asked is a question
about the line between an aim and the estate — *why are we spending this*, *what happens to the
plan if this slips*, *which of these applications is anybody funding a change to* — and Nexus
could model both ends and not the line.

**Objectives and initiatives** is a fifth family, **Strategy**, sitting after the portfolio
models in the catalogue for the reason the ordering already implies: how you draw a system, how
you decompose the problem, how the organisation is run, the estate itself, and finally what the
estate is *for*.

Five types — **Objective**, **Key Result**, **Initiative**, and Business Capability and
Application so the rules have somewhere to land — and four relationship types: `measured by`,
`contributes to`, `needs`, `changes`.

Two shape decisions:

- **A Key Result is its own type, not a field on the objective.** An aim is measured several
  ways, the measures change while the aim does not, and a measure has a target and a current
  value of its own. Folding it into a text field is how "how would we know" quietly stops being
  answered.
- **The estate link is the point.** `needs` (Objective → Business Capability) and `changes`
  (Initiative → Application / Business Capability) are what make an objective checkable against
  reality. An objective naming no capability and no system is a sentence in a slide deck, and a
  strategy model that cannot reach the estate is the thing every OKR tool already is.

`contributes to` lets an Objective roll up into another **many-to-one**: several parents is a
tree nobody can read.

The catalogue's own tests caught a real inconsistency while this was being written. The rule is
"no more than two required fields — never require something nobody can know on day one", and
`horizon` was marked required while its own description said an empty value means nobody has
committed to a date. Forcing one produces a fictional date, which is worse than an empty one.

### 5.72 The inventory: browsing one type (v0.2)

Nexus could already filter entities by kind, search them, show them as a table and edit them
inline. What it could not do was the thing LeanIX gets right: **a type is a destination.** A
kind was a chip on a page of everything, so "the application portfolio" was a filter somebody
had to remember to apply rather than a place you go.

`/w/[slug]/type/[kind]` is that place — linkable, bookmarkable, sendable — reachable from the
kind cards on the knowledge graph and from the meta-model's type inspector. An undeclared kind
gets one too: the meta-model grows out of the data (§2.2), so an inventory available only for
declared types would be missing exactly when somebody is trying to make sense of an import.

**The facet rail is built from the type's own fields.** Three rules in it are the difference
between a rail that works and one that quietly misleads:

- **"not set" is a value.** *Which applications have no owner* is the single most useful
  question an inventory answers, and a rail listing only the values present hides it. On the
  demo estate this is immediately the loudest thing on the page: 9 of 23 applications with no
  owner, 9 with no lifecycle, 10 with no end-of-support date.
- **A facet counts against every *other* facet's selection, never its own.** Get this wrong and
  choosing `lifecycle = active` shows every other lifecycle as zero: you can narrow but never
  switch, and the filter is a one-way door. It is the classic faceted-search bug.
- **A declared field with no data still appears.** The model asked for something and nobody
  filled it in; dropping the row because it has no values is how a model and its data drift
  apart unnoticed.

**Values edit as the thing the model says they are.** A declared enum is a dropdown of its
options, a boolean is yes/no, a number takes numbers, a web address gets a link beside it; an
undeclared key stays free text, because the model has no opinion about it. This is the part
that matters most, and the reasoning is uncomfortable: the entity table edited *everything* as
free text, including fields declared as an enum with four options — which is precisely how
`Active` and `active` end up in the same column, and why Nexus grew a proposals system to
normalise a mess it had allowed. **A model that declares a type and then ignores it when the
value is typed is decoration.**

Two things the cell deliberately does not do. It never refuses to clear a value — requiredness
is a statement about a finished record, not about a keystroke, and a field you cannot empty is
a field that stays wrong. And it never silently corrects: a value the model disallows stays in
the box with the reason beside it, and a stored value outside the declared options is shown as
"not a declared option" rather than blanked, because the mismatch is a finding and discarding
it destroys it.

**A gap this exposed.** An enum's allowed values had no interface at all — they could only
arrive by adopting a framework (§5.57), which left a workspace that invented its own types
unable to say what a value may be, and made the typed editing above unreachable on exactly the
path §2.2 calls the default one. The meta-model's field table now carries an allowed-values box
for any declared enum.

Also fixed: `plural()`, because "23 application" is the first thing a reader sees and naive
`+ "s"` turns Business Capability into Business Capabilitys.

### 5.73 Reading a real LeanIX workspace (v0.2)

Rev 97 built the EA-repository door and it had never once run against a real workspace. It was
exercised against a stub written to match its own query — the most comfortable and least useful
kind of test — and the query was wrong in three separate ways, each of which killed the entire
export. Pointed at Energinet's workspace it failed immediately:

1. **`...on FactSheet { updatedAt }` — there is no type called `FactSheet`.** The interface is
   `BaseFactSheet`, and `updatedAt` is on it directly. LeanIX answered
   *Validation error (UnknownType) : Unknown type 'FactSheet'* and returned nothing at all.
2. **Relations were asked for at node level.** `relToChild` and `relToParent` are not on the
   interface; every relation field is named after the pair of types it joins —
   `relApplicationToITComponent`, `relObjectiveToInitiative` — and exists only inside a fragment
   on the concrete type. Every relation in a real workspace was therefore lost.
3. **Per-type fields collide.** `technicalSuitability` returns an
   `ApplicationTechnicalSuitability` on one type and an `ITComponentTechnicalSuitability` on
   another, and GraphQL refuses a query that selects the same field name for two different
   types. Three such conflicts rejected the whole 455-fact-sheet export.

The fix is the one the old comment already claimed and the old code never did: **ask the
workspace what it is shaped like, then build the query from the answer.** `discoverShape` reads
the concrete types off `BaseFactSheet` and, for each, which of its fields are scalars and which
are relation connections; `pageQuery` and `relationsQuery` build fragments from that, aliasing
every per-type selection with its type so nothing can conflict. Introspection refused falls back
to the common fields — a workspace that will not describe itself is still worth reading.

**And the same edge, twice.** LeanIX exposes every relation from both ends under two names, so
Energinet's 1,242 relation rows describe **621 edges**. Importing all of them would put every
connection in the graph twice — visible immediately as doubled degrees in the explorer and
doubled counts on every triple in the meta-model. `dedupeRelations` pairs a name with its
inverse (`relToChild`/`relToParent`, and `relXToY`/`relYToX` derived from the name) and keeps
one direction, chosen by sort order so it is stable: an unstable choice would make a re-import
look like every relation had been reversed. A relation whose inverse cannot be worked out is
kept as it is, because losing a real edge is far worse than keeping a duplicate.

**What Energinet's workspace actually holds**, read on 2026-09-10: 455 fact sheets across 11
types — 192 Business Capability, 86 Application, **55 Objective**, 36 Initiative, 36 IT
Component, 17 Business Context, 8 Platform, 7 each of Interface, Organization and Provider, 4
Technical Stack — and 621 relations, none dropped. Two things worth noting: their metamodel has
**Objective** in it, which rev 108 added a week's worth of coincidence early; and 236 of the
edges are parent/child, which is the capability hierarchy rev 107's containment exists to hold.

`pnpm leanix:read` is the same pull from a terminal. It **reads the token from the environment
and never from argv** — a command line ends up in shell history, in `ps` output for every user
on the box and in the container platform's process listing. It never writes to the graph, and
deliberately does not stage a batch either: staging re-maps every column against the names the
workspace already knows, reads the prose for claims and builds the review record, and
reimplementing a fraction of that would produce a batch the app could not review. `--save`
writes the export to `leanix-export/` (gitignored) as CSVs for the Files door instead.

One more thing this exposed: a `LeanIxError`'s detail is usually the GraphQL `errors` array, and
both the CLI and the in-app door only rendered detail that was already a string — so the one
piece of information the reader needed was dropped, and every failure read as a bare "GraphQL
reported errors."

### 5.74 The hierarchy survives the import (v0.2)

Rev 110 read Energinet's workspace correctly and rev 107 had given the graph containment, and the
two still did not meet: the import landed **202 Business Capabilities flat**. Their hierarchy had
come across as an ordinary relation called "→ child", which is not wrong so much as useless — a
capability map is a tree, roll-up counts through a tree, and an edge named after a schema field is
none of that.

**A parent is a column role, not a relation.** `{ as: "parent" }` joins name, key, attribute,
person and relation as something a column can mean. A staged record carries the *name* of what it
sits inside, because a name is all a file has; approving resolves the names once every row has an
id and writes `entities.parent_id`. Deliberately not an edge as well: the graph already holds
containment as a column, which is what ancestry, roll-up and "where it sits" read, and writing
both would be two facts to keep in step.

Three rules decide which of those names becomes a move (`planParents`, pure and tested):

- **A name that resolves to nothing is not a move.** The object still arrives — at the top, which
  is what an unresolvable parent honestly means. The review has already asked about it as a
  question, never as a blocker: a row is not held hostage to its parent.
- **A move already made is not a move.** Re-importing the same export must read as "nothing
  changed", not as an estate that shuffled.
- **A move that closes a ring is refused**, checked against the tree *including this batch's own
  earlier moves* — two rows that each name the other are exactly how a cycle arrives, and neither
  is a loop against the graph as it was. A cycle is not a wrong answer but an unreadable tree:
  everything that walks it hangs or silently truncates.

Rollback undoes it too, in the shape `__kind` already used: the previous parent is recorded per
entity, and put back only if the object is still where the import left it.

**The mapper only reads a parent from a header that means one.** `parent`, `parent capability`,
`child of` and the like, matched exactly — "parent company" is a different organisation, and the
looser `part of|capability` pattern that reads relations would have swallowed both. A wrong guess
here builds a tree, so it is the one place in the mapper that refuses to be generous.

**For LeanIX specifically**, `relToChild`/`relToParent` are lifted out of the relation columns
into a parent column on the *child's* row, read from whichever end of the pair the dedupe kept,
and only for the types that actually nest. And a nested fact sheet is now named by its own name
rather than by `displayName`, which LeanIX sets to the whole path: 236 of Energinet's 455 objects
were called things like "Electricity System Operation / Operation / Grid Monitoring & Control".
That was the only way to say where something sat while every import landed flat. The tree says it
now, and a name that repeats its ancestors makes a capability map unreadable and a search
unusable.

**And the import grew a second door.** Staging and approving were written as server actions, so
every line of them read the signed-in user from the request, checked a capability against it and
asked Next to revalidate a route — three things only a browser request has. A whole estate could
therefore be imported *only* by somebody clicking a button in a tab, which is the right door for
almost everybody and the wrong one for the first import of a real workspace on a deployed server.
`src/lib/import/run.ts` now holds the work — `stageBatch` and `applyBatch`, taking a database and
the id of whoever is answerable — and the actions are what they should always have been: a guard,
a call, and a revalidation. There is one implementation of "what an approved import does to the
graph", so the terminal and the button cannot drift apart.

`pnpm leanix:into-graph` is that terminal door: host and token from the environment (never argv),
`DATABASE_URL` saying which graph, `--workspace=<slug>` when a deployment has more than one, and
**nothing written without `--approve`** — without it the batch is left on the import page for a
person to look through. Run against Energinet it produces exactly what the browser produced: 452
created, 3 changed, 378 connected, 236 placed in the hierarchy.

**What it does to the real data**: the same 455 fact sheets, imported again, put **236 objects
into the hierarchy** — 172 of 191 Business Capabilities under 19 top-level ones, three levels
deep, "Electricity System Operation › Operation › Balance & System Regulation" — and the relation
count drops from 608 to 378, because 230 of those edges were never relations. The inventory grew
an **Inside** column for types that nest, showing the parent or "top level" with the roll-up count
beside it, so a list of 201 capabilities is legible as the tree it is.

### 5.75 The capability map is of *your* estate (v0.2)

The Capability map starter handed out six invented capabilities — Grid Planning, Grid Operations,
Asset Management, and three more — with a dozen invented applications inside them, and it handed
out the same six whether the workspace held four capabilities or four hundred. It made a good
screenshot. It was also the wrong thing entirely: a capability map is a picture *of an
organisation*, and one that is not of yours is a slide.

So the starter builds the real thing now, and builds **all** of it: every capability in the graph,
nested by containment (§5.70), with the applications that realise each one placed inside it. On
Energinet's estate that is 201 capabilities in 44 frames and 174 cards, three levels deep, from
one click. The fixture is kept for a workspace with no capabilities yet, where it still does the
job it was written for — showing a newcomer what a capability map *is*.

**Frames are measured from their contents.** A capability with three children and two
applications is exactly as big as those five things need; a leaf is a card. Nothing sits on a
fixed grid, because no real capability tree is even — one L1 has 27 children and the next has two,
and a grid would either crop the first or leave a crater around the second.

**An application is drawn once.** Many realise several capabilities, and a card per pairing would
put four cards on the board all claiming to be one object — which the board's own sync would then
have to guess about. It goes inside the first capability it realises, by name so the same estate
always draws the same map, and its description says where else it is used. There are no
connectors: containment carries the meaning here, and three hundred edges would carry only ink.

**A frame can be an object now.** This is the change with teeth. A capability that holds things is
drawn as a frame, and a frame was a label: the entity it stood for was not in the board's index,
not clickable, not renameable from the board. Rev 112 lets a frame carry an `entityId` — but only
to bind to an object that already exists. Renaming the frame renames the object, which is the one
edit a frame can express; it cannot *create* one, because a frame carries no kind and an untyped
object is somebody else's cleanup. Cards remain the full face of an entity.

That change surfaced an older bug worth writing down: the seeded capability tree used ids like
`cap_grid`, and the canvas tests for the `ent_` prefix before treating an element as the face of an
object. Ten seeded capabilities could therefore be drawn on a board and then ignored by the board's
index and by the save. Readable ids are not worth an object the product cannot see.

### 5.76 Objects: a shelf for the whole repository (v0.2)

Rev 109 gave every type a page of its own and left the only way in as a chip on the knowledge
graph. So the product had fact sheets and nowhere to find them: the first thing the owner said on
seeing the inventory was that there was no menu item for it, which was exactly right.

**Objects** is the entry in the rail, and the page behind it is one flat list of everything
the model holds — 478 objects across 12 types on Energinet's estate — with a search across name,
type, description and parent, and each row opening the object's own sheet (§5.77). Every row says
where it sits (§5.70), how many relations it has and how many boards it is on; picking a single
type narrows the list and offers that type's own inventory, with its facets and its declared
fields, one click on.

One flat list on purpose. The question this page answers is "where is that thing", and a search
box over everything answers it in a second; a shape that has to be navigated does not.

### 5.78 The repository asks the other questions (v0.2)

A search box answers *where is that thing* and nothing else, and the first thing 478 real objects
did was ask everything else: which applications are connected to nothing, what sits at the top
level, what did we touch last week, which of these types has nobody declared. The types were a
row of chips above the table, which had already run out of room at twelve — and the rows
themselves had no vertical padding, so a name, its description and the next name shared forty
pixels and the list read as a block of text rather than as rows.

So the page grew **a rail on the left**, which is where a filter belongs, and room to breathe.
The rail carries five facets and the sort:

- **Type**, multi-select, each with its colour and count, undeclared ones marked.
- **Where it sits** — at the top level, or inside something.
- **Connections** — connected, or **connected to nothing**, marked as the finding it is.
- **On a board** — drawn somewhere, or on no board.
- **The meta-model** — type declared, or type not declared: the 52-undeclared-types problem as a
  filter you can act on rather than a number on the health page.
- **Sort** — name, recently changed, most connected, most used on boards, type. Every order falls
  back to the name so the list cannot shuffle between renders.

**One facet never counts against itself.** Each count is taken over everything that survives the
*other* facets and the search, so choosing Application still shows what choosing Business
Capability would give. If a facet counted against its own selection the filter would be a one-way
door — you could narrow but never switch — which is the classic faceted-search bug, and the type
inventory (§5.72) already learned it. A choice that would empty the list is shown disabled rather
than hidden: its absence is an answer, and a rail whose rows come and go cannot be learned.

The logic lives in `src/lib/repository.ts`, out of the component, because the counting rule is
the only interesting thing on the page and it is worth a test.

**Something had to leave the rail to make room.** The rail's rule is frequency (§5.65) and it is
capped at fourteen entries by a test, so adding a daily surface meant moving a monthly one: the
**EA knowledge** library now sits beside Documentation at the foot of the rail, which is where
reference reading belongs. Browsing the repository is something an architect does several times a
day; looking up what TOGAF says about phase B is not.

### 5.77 One object, one page (v0.2)

An object had no address. It opened in a drawer over whatever you were looking at, which is right
beside a canvas — leaving the board to read a fact sheet loses your place — and wrong everywhere
else: an object is not an annotation on a list, and "have a look at this application" should be a
link somebody can send.

`/w/[slug]/fs/[id]` is that link. The page carries the name, the description, the attributes in
their sections, what it is connected to, where it sits, which boards it is on, and everything that
has happened to it. The drawer stays, on the canvas only.

**It opens as a window, not as a navigation.** The first cut made the address a page, and a page
throws the list away: three filters deep in the repository, you open one application to check who
owns it and you come back to an unfiltered list at the top. So the address is *intercepted*
(`@sheet/(.)fs/[entityId]`, a parallel slot on the workspace layout): clicking a row opens the
sheet over the page you were on, in the area right of the menu and nothing of it. The menu stays
reachable, because the next place you are going is usually somewhere else in the product rather
than back where you came from. The address still changes, so the thing is still linkable and still
refreshable, and the ways out are the ones people already try — the ×, Escape, the space around
it, and the back button, which the interception makes the same gesture. A **cold** load of the
same address renders the standalone page instead: there is nothing behind it to overlay, and a
link in a mail has to open something whole.

The window stands *inside* that area rather than filling it, over a light scrim, so the page it
was opened from is visible around its edges — widest on the left, where the list is. That is the
difference between a window and a navigation, and it has to be visible or it is not a claim
anybody can check: you are standing on top of where you were, not somewhere else.

Escape belongs to the field it is pressed in: inside an input it puts back the value before the
edit (below), and only outside one does it close the window. Both the window and the standalone
page scroll in their own column — the shell is a full-height grid, and a column that does not say
it scrolls simply makes the bottom of a long sheet unreachable. The same omission clipped the
repository's own list (§5.76): 478 objects with four hundred of them below the fold and no way
down.

**No save button, and no edit mode.** The value on the page *is* the field: click it, change it,
look away, it is written. The canvas has worked this way since rev 1 — a card's title is a live
field and nobody has ever asked where its save button is — and a fact sheet that behaved
differently would be the odd one out. Three things keep that honest rather than alarming: it
writes on blur rather than on keystroke, so one edit is one entry in the history; it says "saved"
quietly beside the field rather than flashing; and the value before the edit is kept, so **undo**
is there for the four seconds anybody would want it. Every edit lands in the object's history with
the person's name on it, which is what makes an unprompted autosave defensible.

**Attributes are grouped where they belong, and nowhere else.** A declared field names its section
— Lifecycle, Ownership, Fit for purpose — set on the type in the meta-model, and the page renders
the sections in the order the modeller put them in rather than alphabetically: somebody decided
Ownership comes before Cost. A declared field appears **even when it is empty**, because an
unanswered required field is a finding and hiding it makes the page look complete when it is not.
Everything else — the `lxState`, `createdAt`, `rev` that an import brings — goes in one honest
group called *From the data*. Nothing is filed by guesswork: a regex would put `lxCostCentre`
under Lifecycle often enough that nobody would trust any heading on the page.

**What the type does not know is visible as such.** The header counts what is filled against what
is declared — *4/5 declared fields filled* — and says when one is required and empty. An
undeclared type says so, with a link to declare it, because 52 undeclared types is the state of
the model rather than a quirk of one object.

### 5.79 A mark of its own (v0.2)

The mark has been three things. It started as three nodes and two lines — a share glyph, the icon
every collaboration tool puts on its "send this to somebody" menu item, which says the wrong
thing before anybody reads a word. It became an N built out of dots and edges, which was literal
about the graph and read as *playful*, and the owner said so: this product is shown to steering
committees.

It is now a **flat-cut geometric N**: two stems and a diagonal, square apexes, even counters,
drawn on a 24 grid with 4.4-wide stems inset 4 from every edge. A monogram and nothing else — the
mark of a system of record rather than of a drawing tool. The restraint is the point; it has to
sit on a slide next to a utility's own logo without looking like a startup's app icon.

Chosen against four alternatives rather than picked: a layer cake with a spine (read as a list
icon), an N of nine grid cells (fussy below 32px), a building block frame (read as a camera
focus ring), and the dot-and-edge N it replaces. Each was drawn at 16, 20, 24, 32, 48 and 96, on
the tile, on white and reversed, before the choice was made — because a mark is seen at sixteen
pixels far more often than at ninety-six.

It is used in three places from one component (`NexusMark`) — the sidebar, sign in, log in — and
twice more as a file, because a browser will not read a React component: `app/icon.svg` is the
tab icon, a rounded blue tile the framework picks up by convention, and `app/apple-icon.png` is
the home-screen icon, full bleed because iOS applies its own mask and a rounded tile inside it
comes out as a badge on a white square.

### 5.81 Objects, not fact sheets (v0.2)

"Fact sheet" is LeanIX's word. It arrived with the import and settled into the rail, the page and
the documentation before anybody chose it — which is how a product ends up speaking a competitor's
language to its own users, and teaching every new reader a term they will have to unlearn.

The rail now says **Objects**, and an object has an **object page**. Nothing new has to be taught:
the product already said it everywhere the copy was written rather than borrowed — *478 objects
across 12 types* is the line at the top of the list, and the meta-model has always described types
*of objects*. It is vendor-neutral, it is what the database calls them, and it is what somebody
says out loud when they are not reading a screen.

Three things deliberately did not change. The address stays `/w/[slug]/fs/[id]`, because links
already exist and a URL is not vocabulary. The internal names — `FactSheet`, `factsheet.ts`, the
`fs-` class prefix — stay, because renaming an identifier costs a diff across the codebase and
buys a reader nothing. And *fact sheet* stays in the documentation's keywords, so somebody
arriving from LeanIX and searching for what they know still lands on the right page.

### 5.80 Deploying a small change quickly (v0.2)

A one-line change took as long to deploy as a rewrite, and the reason was not the build — a cold
Next build of the whole app is 50 seconds. It was the image.

The runtime stage copied the entire built workspace: `COPY --from=build /app /app`. That is
**617 MB of `node_modules`** — TypeScript, ESLint, Vitest, Playwright, drizzle-kit, every
devDependency the repository has — plus a 206 MB `.next` and the sources, about **836 MB** on top
of the base image. The host pays for that twice on every deploy, once pushing and once pulling,
and none of it is needed to serve a request.

**The image now carries only what the server runs.** `output: "standalone"` makes Next trace what
each route actually imports and emit a tree with a minimal `node_modules` and its own
`server.js`; the runtime stage copies that and nothing else — **96 MB**, and a base image with no
package manager in it, because `node server.js` needs none. Four things tracing cannot know about
are added by `scripts/standalone.mjs`, because nothing imports them: `.next/static` and `public`
(Next assumes a CDN; Nexus serves its own assets and vendors its own fonts, §5.45), the `drizzle`
and `drizzle-pg` folders (the client runs migrations itself from `process.cwd()` — a missing
folder is an empty database), and the EA corpus.

The same script takes three things *out*. Standalone copies the project's own files as well as
the traced modules, and a developer's checkout has a `data/` directory holding the development
database — 26 MB of somebody's workspace, and a genuine leak if an image were ever built without
`.dockerignore` in front of it. `outputFileTracingExcludes` does not cover this; it filters the
traced files, not the project copy. So the pruning is explicit, in the script, where it can be
read and tested.

**Dependencies and the compiler both get a cache.** Installing is a stage of its own over the
manifests alone, so a source-only change never re-resolves anything, and both the pnpm store and
Next's build cache are BuildKit cache mounts — an unchanged lockfile costs nothing and a build
is incremental rather than cold. On Railway a cache mount only persists when its id is scoped to
the service (`id=s/<service-id>-pnpm`); the Dockerfile says so at the top, and without it the
builds are still correct, only colder.

### 5.82 Which ref you are standing on (#135, v0.2)

The first slice of #133. Nexus has had change sets since rev 40 — a named, dated set of
intentions that projects a to-be view without touching the graph — and no way to be *in* one. You
could look at a plan; every page you opened afterwards quietly showed you as-is again. The owner
said it plainly: **you must always be able to see which change set you are on, including inside a
canvas.**

**A checkout, not a toggle.** One row per person per workspace naming the ref they are standing
on; absent means `main`. Per person rather than per board, because two architects being on two
different plans at once is the point of having plans — a board that carried the ref would let the
last person to open it decide for everybody. Absent-means-main is the right default in both
directions: a new workspace needs no row, and losing the row puts you somewhere safe.

**The indicator sits above the navigation**, not in it, because it is not a place you go — it is
the state every place you go is read in. On `main` it says what main *means*
(*the estate as we currently believe it to be*), because that is not obvious and it is the
sentence #133 §7 says the product has to say out loud. On a change set it turns amber, names the
set, and says how far it has moved: *1 added · 1 retired · 2 connected*.

**Divergence is counted by object, not by row.** Two attribute edits to one application are one
changed application; an object that is introduced and then edited is an introduction, not both.
Counting rows would make a plan that renames one system look bigger than one that retires four.
The count comes from the changes themselves rather than from a projection — an indicator that has
to load the whole graph to render is one that gets taken out of the layout the first time
somebody profiles a page.

**Only an open change set is somewhere you can stand.** Delivered is history and abandoned is a
decision; standing in either would be editing the past. A checkout pointing at one that has since
closed resolves to `main` on read rather than leaving somebody working in a world that has gone —
and the row is left alone, because putting them back is the next thing they do, not a write
performed during a read.

Switching is deliberately *not* guarded by `graph.edit`: standing somewhere is not changing
anything, and a viewer entitled to read the estate is entitled to look at a plan from the inside.
What they may do once they are there is decided where it is always decided — at the write.

**A board opens in the world you are standing in.** The canvas has no rail, so it carries the
same fact as a chip in the topbar — quiet on main, amber off it — and the board is *drawn*
through the ref: the change set's overlay is applied on arrival, without anybody choosing a
viewpoint. The rail saying one thing and the picture another was the failure worth preventing.
It is applied once, keyed on the ref alone: somebody who then switches the viewpoint panel to
as-is meant it, and having the board snap back to the plan would be the chrome arguing with the
person. The ref is read on the server with the board, so the chip is right on the first paint
rather than flickering from main to a plan when a request returns.

### 5.83 The model's test suite (#136, v0.2)

The second slice of #133, and the one both halves of it depend on: a campaign's definition of
done (#134) and a merge's admission criteria are the same list, and that list is a **test suite
over the model**.

Nexus already computed most of it — conformance (§5.66), relation rules (§5.67), the orphan count
on the health page, the cycle guard in the reparent path — but each answer lived in its own
screen, in its own shape, with no verdict. A number on a dashboard is something to look at; a
check that passes or fails, with the rows that failed it, is something to gate on.

**Seven checks, two severities.** Types declared (advisory), required fields filled (blocking),
values matching their declared type (blocking), relations allowed by the model (blocking),
containment is a tree (blocking), nothing connected to nothing (advisory), names unique within a
type (advisory). Blocking and advisory are genuinely different: nobody should be stopped from
merging because two applications share a name, and a gate that cannot tell the difference is a
gate that gets switched off.

**The verdict is "not worse", not "clean".** A repository with 52 undeclared types cannot pass a
clean-slate check, and a gate everybody fails is a gate everybody ignores. So the run is
comparable: standing on a change set, the page shows what the proposal **adds** against `main`,
what it **repairs**, and whether anything blocking is among them. That is the question a review
actually asks, and it is the one a merge can fairly refuse on.

**A check is pure over a snapshot** — no database — so the same code runs against `main`, against
a change set's projection, or later against a campaign's scope, with no second implementation of
what conformant means. A change set is checked against the very projection the canvas overlay and
the roadmap already use.

Two details worth recording. An orphan is an object with no relation **and** no place in the
hierarchy: a capability with eleven applications inside it and no edges is not adrift, and calling
it an orphan is how a check becomes something people learn to ignore. And a containment ring is
reported once, keyed by its smallest member, rather than once per member — a two-object loop is
one problem.

**It is not in the rail.** The rail is capped at fourteen and its rule is frequency (§5.65);
checks are consulted when something is about to land, which is exactly when somebody is looking
at the ref menu — so that is where the way in lives.

### 5.84 The tree: every branch and every commit (#133, v0.2)

The owner's requirement, and the gap that made every other part of #133 abstract: *the tree and
the branches must be represented visually somewhere — a drawing of all branches and commits, and
I want to navigate through it.*

Nexus had all the pieces of a version-controlled model and no picture of it. The history page is
a list, the roadmap is a timeline of plans, and nothing showed the **shape** — which branches
exist, where each was cut, what is on it, which have landed. A branching model you cannot see is
one people guess at.

`/w/[slug]/tree` draws it. Time runs down the page, newest first — the direction the history page
already reads, and the direction `git log --graph` runs anyway. `main` is lane 0; every change
set gets a lane of its own, cut from main with a dashed curve and landing back with a solid one
when it is delivered. Plateaus are tags on the trunk. It is a **canvas you move through** rather
than a diagram beside a list — see §5.86.

Three decisions about what the drawing is allowed to claim:

- **A commit on `main` is a *moment*, not an event.** The history already folds edits by the same
  hand in the same place within two minutes into one moment (§5.43); renaming three fields on one
  object is one commit, exactly as it would be in a repository. Two different hands in the same
  minute stay two commits.
- **A branch is cut from the state of main it was written against** — the newest trunk commit no
  later than its creation — not from the tip. Change sets carry no base commit today, so the
  creation time is the truthful approximation, and it is one of the things #138's storage
  decision would make exact.
- **A lane is a ref for the whole height of the drawing.** Reusing a column once a branch ends is
  how git graphs save space and how readers lose the thread. Nexus has tens of change sets, not
  thousands of commits; clarity is affordable.

**It is navigable, which is the point of drawing it.** Click a node to see what it carries and
follow it into the objects it touched; click a branch in the side panel to stand on that ref —
the rail, the boards and the checks all move with it (§5.82).

Two small lies the first drawing told, both now fixed: a plateau dated 2028 read as *just now*,
because `whenWords` had never needed to describe the future — it now does, with five minutes of
slack so a skewed clock still reads as "just now" rather than "in 1 minute". And a change set
written in the same millisecond as its own changes sorted its cut *above* them, so a branch
appeared to start after the work on it.

### 5.85 Campaigns: giving remediation a shape (#134, v0.2)

The part of #133 that would have paid for itself the day the Energinet import landed. An import
ends at *approved*; the actual work — going through the estate, deciding what is true, filling
what is missing, retiring what is dead — has no shape, no owner, no queue and no end.

A **campaign** is a named, scoped, finite piece of validation with a definition of done.

- **Its scope is a query, not a list**, so it stays true as objects arrive. It is stored as the
  very filter shape the objects list already speaks (§5.78) — *every Application with no owner*,
  *everything undeclared* — which means a campaign can be described in the words somebody would
  use to find the objects by hand, and the resolver is code that is already tested.
- **Its definition of done comes from the checks** (§5.83) rather than being written twice. A
  campaign says *which* checks must hold for its scope, not what they are.
- **Its per-object state is the thing the repository has never had.** Untouched, in review,
  needs a decision, validated, waived. A row exists only once somebody has touched the object, so
  a 455-object campaign writes no rows on the day it is created and *absent* means untouched.

**Validation is stamped to a version, not to an object.** This is the one edge the whole process
stands on. A fact sheet validated in March and edited in June is **not** validated: the object's
`updatedAt` at the moment of validation is recorded, and the moment it differs the object goes
back to untouched with `lapsed: "changed"`. The burn-down therefore goes **up** as well as down,
and the page says how many came back. Without it, validation is a badge people stop believing
within a quarter — the version every tool ships first and regrets. A waiver behaves the same way
against its expiry, and a waiver *without* an expiry is refused at the write, because "accepted
as is" with no end date is how a model quietly rots.

Two write rules that live in the action rather than the state machine, because they are about
committing rather than reading: a waiver needs a reason and an expiry, and a question needs to
say what is being asked. And a campaign **closes only when its scope is validated or explicitly
waived** — a campaign that can be closed with work left and nobody's name against it is one
nobody believes the next time.

Nothing here is open to an agent. An agent may clear the mechanical part of a campaign — propose
owners, spot duplicates, flag orphans — and may never validate: validation is somebody putting
their name to it, and an anonymous one is a badge rather than a statement.

**Where the work happens is a queue, not a table.** `/w/[slug]/campaigns/[id]` shows one object
at a time — what it is, where it sits, what it is connected to, whether its type is declared —
and four ways out, which are the four honest ones: *it is right*, *leave it for now* (with a
reason and an expiry), *somebody has to answer* (with the question), and *I am still on it*. The
object you have just judged leaves the queue and the next takes its place, so getting through
ninety applications on a Tuesday is ninety decisions rather than ninety scrolls. A table with a
dropdown per row is a screen people scroll; a queue is something people finish.

**A campaign is started from something you already know how to say.** Four templates rather than
an empty form — describe what the import brought, connect what is connected to nothing, fill the
fields the model asks for, place what never got placed — each one a scope in the objects list's
own filter language, and each one a job the Energinet import actually created.

**And an object's own page says where it stands** in every campaign it is in scope for, including
*it was validated, then edited*. That is the loop closed: the queue sends you to the object, and
the object tells you what the queue thinks of it.

### 5.86 The revision explorer (v0.2)

Rev 126 drew the tree as an SVG gutter beside a list of rows. The owner's verdict was that the
drawing was right and the container was not: what he wanted was *the explorer treatment* — a
canvas you can always get to and move through, the way the graph explorer (§5.68) is moved
through, and the way the figures in the architecture note read.

So the tree wears the explorer's own shell. Branches where the entity directory sits, the drawing
in the middle, the subject on the right; the three columns mean the same things they mean next
door, which is the point of having a shell at all.

**It opens somewhere legible, not zoomed out to everything.** A year of history is a world
thousands of units tall and a few hundred wide, and framing all of it in a wide stage shrinks
every node to a thread and hides every label — a picture of a tree rather than a tree you can
read. So the camera opens at 1:1 on the newest commits, and *Fit* is a button for when the whole
shape is the question. Drag to pan, scroll to zoom about the pointer, and a branch can be hidden
from the rail when the drawing gets busy.

**Labels go under their node, not beside it.** Lanes are about one label's width apart, so a
label to the right of a commit lands on top of the next branch — which is exactly what the first
cut did. Under the node, a label belongs to its own lane and to nothing else; the full text is in
the subject panel, which is what the panel is for.

The camera arithmetic — the world's bounds, the opening view, the fit, and zoom-about-a-point —
lives in `tree.ts` with tests, because *does zoom-to-fit actually frame everything* has a right
answer that does not need a browser to establish. One of those tests exists because the walk
caught a real bug: the zoom limits were absolute, so a view that opened *outside* the readable
range locked the camera where it started. They are directional now — a zoom is allowed whenever
it lands inside the range or moves towards it, so you can always get back and never get lost.

### 5.87 A plan can move and retype (#137, v0.2)

A change set could introduce, retire, re-attribute, connect and disconnect. It could not say
*this capability moves under that one* — and containment is a column on the entity rather than a
relation (§5.70), so there was no way to write it as an `addRelation` either. That mattered the
moment #137 started, because the LeanIX import's third act is 236 reparents: an import that lands
on a branch and cannot carry its own hierarchy is an import that arrives flat.

So `setParent` is the sixth op. An empty destination means the top level, which is a real move
rather than a cleared field — *take this out of where it is* is one of the two moves anybody
actually makes.

**The ring is refused where it is written, not where it lands.** The projection checks each move
against the tree *as the change set leaves it*, so two changes that each put one thing under the
other produce one move and one stale-change problem, and delivery is refused while that problem
stands. It is the same rule the import's containment pass already applies (§5.74) for the same
reason: a cycle in the hierarchy is not a wrong answer, it is a tree that hangs every reader.

**And a plan can say what something *is*.** The kind is a column for the same reason the parent
is, and a re-read of a source that has since typed its rows properly is a retype of two hundred
objects — so `retypeEntity` is the seventh op. It is not an attribute change: everything that
reads the model, the meta-model and the conformance checks and the layers, reads the column.
Retyping with no type is refused rather than blanking the kind.

A move counts as a change *to the object* in the divergence indicator (§5.82) rather than as a
category of its own — reparenting two hundred capabilities is two hundred changed objects, not
two hundred of something nobody has a word for. The check suite (§5.83) now reads parents from
the projection, so *nothing is orphaned* is answered about the estate the ref would leave.

### 5.88 The checks become a gate (#137, v0.2)

§5.83 built the arithmetic and wired it to a page that could only report. A test suite nothing
consults is a dashboard, so delivering a change set now runs it and can say no.

The rule is narrow on purpose. Only findings the ref **adds** count — a plan is not answerable
for the four hundred undeclared types it inherited, and a gate that refused on those would never
open for anybody. Only the **blocking** half of what it adds stops it; a new advisory finding is
worth saying out loud at the moment of merging and is not worth a locked door, so it is counted
in the delivery message instead.

**And it can be overruled, by the person it was shown to.** A model is never clean, and a gate
with no way through is a gate everybody routes around — by editing the graph directly, which is
the thing the branch existed to prevent. So the refusal names up to three of the objects it is
about, links to each one and to the whole run, and puts *Deliver anyway* underneath them rather
than beside the button that was refused. What cannot happen is overruling it without having
been told.

The refusal itself is a pure function (`lib/checks/gate.ts`) over the two runs, so what counts
as a refusal and how it reads are testable without a database. On the seeded workspace both
plans are refused for the same honest reason: they draw relations of a type nobody declared.

### 5.89 An import lands on a branch (#137, v0.2)

The point of the whole epic, on the old storage. Until now approving an import wrote 455 objects
straight into the estate everybody reads, and undoing it meant a rollback mechanism with its own
record, its own pseudo-keys and its own list of things it declined to touch. Now an import can
land on a change set of its own: its creations, field changes, retypes, relations and reparents
become commits on a branch, the checks run against it, and somebody merges — or never merges,
which is what undoing an import has become.

**The judgement moved out of the writer.** `planImport` is pure and is the whole of what an
import decides: which rows are new, which fields on a matched object actually differ, which
relations are already wired, where each object ends up in the tree. Two executors then take the
same list — one writes it to the graph and keeps the rollback record, one writes it as a change
set. Two destinations that are two loops would disagree within a month; two destinations over one
plan cannot.

**The branch is the primary button, and writing straight in stays.** #137 asked whether an import
should *always* get a branch. Always is simpler to explain and wrong for the forty-row correction
to objects you already own — that is a routine update, not a proposal, and making it a review
round would teach people to avoid the import. So both, with the branch first: *Land it on a
branch* is the primary action and *Write it straight in* the secondary one.

**Merging is the ordinary merge.** The batch page's merge button calls the same
`deliverChangeSet` the roadmap does, through the same gate (§5.88) and the same refusal card. An
import is the largest change anybody ever makes to a model, so it should take the *least*
privileged path into it, not a side door with its own rules.

A landed batch cannot be rolled back or deleted — there is nothing to undo, and the branch is the
record. What it says instead names the branch and points at the roadmap, where abandoning a plan
already means something.

### 5.90 Everything arrives as a claim (#139, v0.2)

Rev 133 gave an import two destinations and made a person choose between them. The destinations
were right; the choosing was not. Which one a claim belongs in is not a matter of taste — it
follows from what the claim *is* — and a question asked four hundred times is a question
answered carelessly.

So the two rules of #139 are a function now, not a button:

1. **Anything new lands on a branch.** An object that did not exist before never appears in the
   shared model because a nightly job ran. It waits until somebody works on it, which is what a
   campaign (§5.85) is for.
2. **A known object's new values flow straight through.** Where the object is reconciled and the
   source is the recognised owner of that field, the update lands — recorded, attributed,
   reversible, and breaking the quality seal if somebody had validated it.

**The second rule carries as much weight as the first.** Putting routine updates through a
review queue is how a queue becomes a thing somebody rubber-stamps on a Friday afternoon, and
once that habit exists the first rule protects nothing either. Ceremony for what is new or
contested; silence for what is routine.

Trust is **per source and per field**, because that is how it really is: ServiceNow knows a
system's lifecycle, the CMDB knows where it runs, and neither knows who owns it in the business.
Three things stay out of a source's hands by default whatever it owns — what something *is*
(a retype is a modelling decision), where it sits (unless the source is the tree, which an EA
repository is), and every connection, because structure is a claim rather than a value. A
source that arrives with no standing at all — a block somebody pasted — owns nothing and has
everything held, which is the honest reading of a block of text in a mail.

The routing is pure and every fork is conservative: anything it cannot justify letting through,
it holds. A claim held on a branch costs somebody a click; a claim through the front door costs
the model its credibility.

## 6. Roadmap

### Now (brief 1 — foundation) — done, see §6a
- [x] Living brief + agent instructions.
- [x] Workspace home with teams, spaces and boards (create, rename, favourite, recent).
- [x] Infinite canvas: navigation, minimap, tools, selection, move/resize, inline text,
      connectors, frames, undo/redo, copy/paste, autosave.

### The work ahead, in seven epics

Every open issue now sits under exactly one epic, and every epic sits in one lane. The same
structure is on GitHub — the epics are issues with sub-issues, the lanes are milestones — so this
section and the tracker cannot drift apart without somebody noticing.

#### Now · Trust what landed — *due 31 Oct 2026*

The Energinet pull put 455 objects in the graph in eight seconds and none of it is validated.

- **#142 — Trust the data: sources, provenance and the first real connector.** The connector
  framework exists on paper (#87) and one entry has to be built end to end (#99, #100, #127);
  the importer has to be *proved* read-only rather than believed to be (#111); an object has to
  be able to say where it came from (#121); and a codebase is a source like any other (#125).

#### Next · The model governs itself — *due 19 Dec 2026*

The meta-model describes 0% of what the repository holds — 12 undeclared kinds and 40 undeclared
relation kinds. A model nobody declared is a model nothing can be checked against.

- **#143 — The meta-model means something in practice.** Governing what a board may contain
  (#128), a managed relation-type vocabulary instead of whatever an import wrote (#83), and
  asking in relationship *families* rather than exact type names (#115).
- **#146 — Writing it down: decisions, annotations and the wiki.** Decisions as objects rather
  than prose (#113), a typed annotation layer (#114), and a wiki that sits where the work is
  (#129).

#### Later · Read it, draw it, publish it — *due 31 Mar 2027*

A model is worth what can be got out of it.

- **#144 — Reading the model: search, explore, ask.** Natural-language search (#88), RAG over the
  workspace's own graph (#117), push-to-talk on the canvas (#118), an authored traversal (#122),
  and optics — relation filters and lifecycle/risk/ownership overlays (#84, #85, #101).
- **#145 — The canvas earns its keep.** Lane and radial layouts (#86), templates worth starting
  from (#89), PDF export (#90), off-canvas ghosts (#120), and the canvas agent as a conversation
  rather than a prompt box (#130).

#### Enterprise readiness — *no date*

Nothing here is interesting and all of it is disqualifying if missing.

- **#147 — Run it in an enterprise.** SSO (#81), the sovereign deployment package (#91, #102),
  a setup recipe (#124), web search as a configured capability (#119), the LeanFlow gaps (#123),
  and the dev-server panic everybody hits (#98).

#### Horizon · The versioned repository — *direction, not scheduled*

- **#133 — Git under the model.** The whole direction: campaigns (#134), the branch indicator
  (#135), checks as the model's CI (#136), import landing on a change set (#137), the storage
  decision (#138), a branch per source with drift as a pull request (#139), architecture as
  branches and roadmaps as merge plans (#140), model owners and agents that propose (#141), plus
  the three issues that predate the framing and belong to it (#131, #112, #116, #126).

## 6a. What exists today (v0.2, 2026-09-11 — rev 111)

### Management structure (LeanFlow home shell)
- **Workspace home** (`/w/[slug]`): meta line, title, "Open last board", grid/list toggle
  (remembered), "Create new" (dialog: name, space, template), start panel with search
  (filters boards by name, description, space and object text), four starters (blank,
  capability map, application landscape, integration flows), recent boards strip, board
  browser.
- **Starters**: Blank board, **Capability map** (§5.75 — built from the graph: every capability,
  nested, with the applications that realise them; the fixture only when the workspace has none),
  Application landscape, Integration flows.
- **Board browser** rows: thumbnail, star glyph, name / description / object counts, last
  opened, space; actions star, rename inline, move to another space, duplicate, delete.
- **Spaces** (`/spaces`, `/spaces/[spaceId]`): create (icon, name, description, team,
  open/private), rename inline, settings (description, team, visibility, delete); the
  space page reuses the home shell scoped to that space (starters create boards there).
- **Teams** (`/teams`, `/teams/[teamId]`): create with colour, rename inline, add/remove
  members, delete; team page lists its spaces and members.
- **Sidebar** (§5.65): brand, search (→ home with `?q=`), then 14 entries in 4 labelled groups —
  Home/Recent/Starred/Teams, **Model** (**fact sheets** §5.76, knowledge graph, explorer,
  meta-model, what changed), **Data** (intake, import), **Work** (wiki, roadmap, agents) — SPACES
  list with hover actions, TEAMS list, then EA knowledge, Documentation and Settings pinned above
  the current user.
- **Settings** (`/w/:slug/settings`): its own shell and nav over People, Models and Connections,
  with the platform console below a divider for operators. The rail carries none of them.
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

### Containment (v0.2, rev 107 — §5.70)
- `entities.parent_id`: a thing sits inside exactly one other thing, so capability maps, C4
  levels and organisation trees are expressible at last.
- **Where it sits** in the entity drawer: the chain above, the children with their own roll-ups,
  the total beneath, and a move control whose candidates carry their full path.
- Counts roll up at any depth. Deleting a parent lifts its children to the grandparent. A move
  that would make a ring is neither offered nor accepted.
- The seed builds a two-level capability tree with the applications that realise each capability
  sitting inside it.

### Entity drawer (v0.2)
- Detail drawer for any entity on the Knowledge graph page: edit fields and attributes, navigate
  relations, add / delete relations (board connectors cleaned up), jump to boards, merge
  duplicates, delete — and, since rev 78, a timeline of everything that has happened to it.

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

### Wiki (v0.2)
- `/w/[slug]/wiki`: a tree of markdown pages per workspace, with `:::board`, `:::object` and
  `:::query` embeds resolved against the model when the page is read, `[[wiki links]]` that show
  when they point at nothing yet, a contents list from the headings, and an editor with an Insert
  menu that writes the embed syntax.
- "Write up a board": a deterministic first draft made of references — the board live, objects by
  kind, connections from the graph, the board's notes as prose, structured by the board's frames.
- Guarded by a `wiki.edit` capability; members and above may write.

### Meta-model builder (v0.2)
- `/w/[slug]/meta`: hierarchy of node and relation types with fields and rules; declare, rename,
  restructure and constrain; declared-vs-observed drift and rule violations surfaced.
- Tool rail: four groups (point, make, show, undo), no captions, tooltips carrying the keycap, and
  anchored flyouts for Card, Shape and Connection that remember the last pick and show it on the
  button. A card is placed as a kind. Rail contents are data, held to invariants by tests.
- Diagram tab: the meta-model on a canvas — a box per node type, an arc per relation type,
  coloured by rule / observed / violation, with bundled arcs, self-loops, pan-zoom, focus
  highlighting and click-through to the detail pane. Redraws as the model changes.
- Conformance tab: the estate checked against the declared model — undeclared kinds, missing
  required fields, values outside an enum's vocabulary, values that are not their declared data
  type, undeclared relation types and connections no rule allows. Two headline numbers (of what
  could be checked; of the estate that is typed at all), a plain-English verdict, breaches grouped
  by kind with every offender named and linked, and a by-type table. Nothing is ever blocked.
- Layers tab: an ordered stack grouping object types and relation types, brought by a framework,
  drawn by hand, or **read out of the estate** — the agent ranks the kinds by the direction of the
  connections that actually exist and shows the counts behind every band, the near-ties, the edges
  it dropped to break a loop, and the kinds the data cannot place. Accepting it is additive.
  Once a stack exists, every connection running up it is listed. The type diagram draws the bands.
- Frameworks tab: ten modelling frameworks in four families — ArchiMate (core), C4 and UML class
  (notations), domain-driven design and model-based systems engineering (domain and engineering
  methods), IT4IT and SAFe (operating models), and the three portfolio models. Each carries object types with
  fields, relation types with rules, ordered levels and its provenance. A workspace can adopt
  several at once and says which in a sentence; every type it brought wears the tag of the
  framework that declared it. Adopting adds only what is missing — never renames, deletes or
  touches an object — and a second adopt is a no-op. Stopping removes the statement and leaves the
  types, which may by then hold objects. Free form remains the default.

### Graph explorer (v0.2, rebuilt rev 102 — §5.68)
- `/w/[slug]/explore`: **three views over one graph**, in a three-column shell — the entity
  directory, the view, the subject — none of which floats over the picture it describes.
- **Focus** (the default): one entity at the centre and its neighbourhood in concentric hop
  rings, in SVG with no camera, so it is always framed. Radius is hop count; rings grow until
  nothing overlaps; arrows show direction; 1, 2 or 3 hops.
- **Map**: every *connected* entity at once, force-directed on a canvas, with overprinting
  labels dropped and separately-connected clusters packed rather than flung apart.
- **Paths**: two named pickers and **every** equally short route between them, written out.
- **Blast radius**: downstream, upstream or either way, with hop depth — the directed question
  the old undirected explorer could not ask.
- **The rail**: every entity ordered by connectedness, searchable, filterable by kind and by
  relationship type, with the entities connected to nothing in their own section as a finding.
- **The walk**: every step recorded as a breadcrumb you can step back into and branch from.

### Import preview (v0.2)
- Live dry run in the import dialog: new / existing counts, kinds, attribute columns, relations,
  warnings. Card kind fields suggest the workspace's kinds.

### The object page (v0.2, rev 114–115 — §5.77)
- `/w/[slug]/fs/[id]`: one object, one page — name, description, attributes by section, relations
  grouped by kind, where it sits, boards, and its history.
- Opened from inside the product it is a **window over the page you were on**, filling everything
  right of the menu; the list underneath keeps its scroll and its filters, and the ×, Escape and
  the back button all put it away. A cold load of the address renders the page standing alone.
- Inline editing with no save button: written on blur, "saved" beside the field, undo, and an
  entry in the history with the editor's name.
- Sections come from the type's declared fields (set in the meta-model); undeclared keys land in
  *From the data*; declared fields show even when empty, and a required blank is marked.

### The repository (v0.2, rev 113 + 117 — §5.76, §5.78)
- **Objects** in the rail → `/w/[slug]/repository`: every object the model holds, one list.
- A **filter rail** on the left: type (multi-select, counted, undeclared marked), where it sits,
  connected or orphaned, on a board or not, type declared or not — each counted against the other
  facets but never against itself, and a choice that would empty the list disabled rather than
  hidden.
- **Sort** by name, recently changed, most connected, most used on boards or type, every order
  falling back to the name.
- Search across name, type, description and parent; where each object sits, its relations and
  boards, when it last changed, and the object's own sheet in a window on click.
- Picking a type offers that type's own faceted inventory.

### The inventory (v0.2, rev 109 — §5.72)
- `/w/[slug]/type/[kind]`: one type as a destination, with its own address. Reachable from the
  kind cards and from the meta-model's type inspector.
- A facet rail from the type's declared fields then its discovered keys, each value with a
  count, each facet with a **not set** bucket, counted against the other facets but not itself.
- Search across names, descriptions and values; an empty result says so.
- Cells edit as the type the meta-model declares — enum as a dropdown, boolean as yes/no,
  number as a number, url as a link — and an undeclared key stays free text.
- Allowed values for an enum are editable on the field, which had no interface before.
- An **Inside** column for types that nest (§5.74): what contains each one, or "top level", with
  the number beneath it at any depth.

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

### Graph query (v0.2, evidence gaps rev 106 — §5.69)
- An empty answer is diagnosed rather than shrugged at: unknown seed / unknown relationship /
  unknown kind / no evidence recorded / over-filtered / empty workspace, each with the nearest
  questions that do have answers, each carrying the count it would return.
- The matcher is pure (`lib/query-match.ts`), so a query can be re-run with one clause removed.
- Curly quotes parse. `rel:` on its own filters to what that relationship touches.

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

### Ambient agents and the fleet (v0.2)
- **Ask about these**: select anything on a board and ask about it in the Selection panel. No
  placement, no page, no query — the selection is the scope.
- Answers arrive as prose plus checked citations you can click to fly to; unfindable citations are
  dropped and counted, and an uncited answer is marked as an opinion.
- `/w/:slug/agents`: every agent in the workspace, what it watches, what is waiting, and how often
  people kept what it said — with the verdict in words.
- Deleting an agent does not erase its record.

### Running the platform (v0.2)
- `/admin`, for a **platform operator** only — a role on the account, above every workspace.
  To anybody else the route is 404, and the sidebar does not offer it.
- **Tenants**: every customer with people, owners, boards, objects, relations, and a state —
  empty, dormant or in use — with the reason in words. Create (owner + one space), rename,
  re-address, delete (type the address back; it says what would go with it).
- **People**: every account on the platform, whichever tenants it is in; operator / no password /
  in no tenant / signed-in-now flags; add, change or remove a membership in any tenant; set a
  password (which ends every session that person has); sign somebody out everywhere; make or
  unmake an operator; delete an account (their work stays).
- The last operator cannot stand down or be deleted; nobody can delete their own account here.
- `NEXUS_OWNER_EMAIL`'s account is made an operator on every start; so is the seeded demo owner.

### The meta-model (v0.2, §5.66)
- `/w/:slug/meta` is one surface: a **health strip** (Described / Conforming as bars, a verdict
  naming the binding constraint, and three filter chips), a **board of type cards**, and an
  inspector that appears on selection.
- A card carries name, instance count, declared fields or rules, and **one** nudge. Declared types
  are solid; ones that grew from the data are dashed on a warm ground.
- Group by kind, by layer, or flat; toggle the board for **Rules** or the diagram; Layers,
  Conformance and Frameworks open as drawers over the same view.
- **Rules** (§5.67): every source → relationship → target the model declares or the data
  exhibits, one to a row, with a status — in use, unused, or observed — a connection count, and
  the cardinality a rule declares. An observed pairing is promoted to a rule in one click;
  coverage is measured in connections rather than rows. Nothing is ever blocked.

### Import (v0.2)
- Four ways in: **files**, a **pasted** block (shape sniffed from the content), a **connected
  system** — ask a tool on an MCP server from the import page and stage what it answers — or an
  **EA repository**: a LeanIX host and an API token, read into one staged batch, a file per fact
  sheet type, fields as attributes, subscriptions as people, relations as relations, the LeanIX id
  as the key (§5.63), and its hierarchy as containment rather than as edges (§5.74).
- `/w/:slug/import`: upload a batch of mixed files — CSV, TSV, JSON, Excel, Word, Markdown, text —
  and work on them before anything is written.
- One object per thing across all the files, with per-field provenance and both values kept where
  the sources disagree.
- Graded matching against the model, blockers and questions per row, accept / hold / reject.
- Person-shaped columns excluded by default; what the source has stopped claiming raised, never
  deleted; connections that would go nowhere flagged.
- **A column can mean "parent"** (§5.74): the row names what it sits inside, and approving writes
  it to `parent_id` — resolved once every row has an id, refusing any move that would close a ring,
  leaving an object at the top when its parent names nothing, and undone by rollback.
- `pnpm leanix:into-graph` (§5.74): the same import from a terminal, for a server with no browser
  on it — host and token from the environment, `--workspace=<slug>`, and nothing written until
  `--approve`.
- Each file is asked **what its rows are**, with the answer proposed and settable; a row that
  carries its own kind keeps it.
- **Prose in a batch is read for claims** and folded into the same records, with the sentence each
  value came from shown under it, obeying the same trust order as the tables.
- The staged board comes with an **Import reviewer** beside it: wake it and it says what it would
  question before you accept. The bar counts remarks nobody has answered.
- **Work on the canvas** — the batch laid out in lanes, where the lane a card is in *is* the
  decision. Renaming a card renames the record, drawing a connector adds a relation, deleting a
  card takes it out of the import, and the bar above the board approves.
- Approve writes it and records what it wrote; roll back undoes exactly that and says what it
  would not touch.

### Model providers (v0.2)
- `/w/:slug/settings/models`: add a provider from a preset (Anthropic, OpenAI, Azure OpenAI,
  Ollama, vLLM or llama.cpp, an OpenAI-compatible gateway), correct the base URL and model id,
  add a key if it needs one, and press **Try it** for a real call.
- Two dialects — Anthropic Messages and OpenAI chat completions — so a model your organisation
  hosts needs no special case and no key.
- Each of the four jobs (Compose, intake, the graph agent, board agents) can name its own provider
  and its own model id; unset means "whichever is first".
- Keys encrypted with AES-256-GCM under `NEXUS_SECRET_KEY`, or stored plainly with the page saying
  so; a key never leaves the server.
- The environment (`ANTHROPIC_API_KEY` + `NEXUS_MODEL`) remains the fallback, so nothing that
  worked yesterday stops working.

### Described agents (v0.2)
- `/w/:slug/agents/new`: write an agent down — name, purpose, owning team, a scope query with a live
  count of what it matches, the verbs it may use, grounding, model and budget.
- A new agent is a **draft**: it runs, and its proposals stay on the run so you can read them before
  giving it a voice. Active, paused and retired are the other three states.
- Every run is logged: read, proposed, thrown away in checking, model, duration — including runs a
  budget or a pause refused before they cost anything.
- The review queue names the agent that made each suggestion, and a decision is attributed to it.
- **Ask the agent** on the Knowledge graph page runs the workspace's own *Model reviewer*, which is
  an ordinary described agent.

### Connections — Nexus as an MCP server (v0.2)
- `POST /api/mcp`: JSON-RPC over HTTP, six tools — search the model, describe an object, follow what
  depends on what, read the vocabulary, read estate health, and propose a change.
- `/w/:slug/settings/connections`: issue a key (shown once, stored as a hash), see when each was
  last used, revoke it, and copy the client configuration block with this instance's own address.
- Two scopes: read, or read and propose. Nothing writes: an outside suggestion is validated exactly
  as our own agent's is and waits in the review queue.
- A propose key speaks as a described agent, so what it says is attributed, budgeted and measured.

### Agents that suggest agents (v0.2)
- **Ask what is missing** — on the Agents page (the workspace's reviewer asks) or on one agent's
  page (that agent asks, and its own verbs and budget are the ceiling).
- A suggestion arrives as a **proposed** agent: it cannot run, not even a dry run, until somebody
  approves it — at which point it becomes an ordinary draft.
- No agent may grant a verb or a budget it does not have itself; the refusal is shown in words.
- Suggestions with no reason from this model, duplicate names and empty scopes are refused and
  listed rather than silently dropped.

### Asking other MCP servers (v0.2)
- Add a server under **Settings → Connections**: a name, its MCP URL and a key if it needs one.
- **Ask what it can do** handshakes and lists its tools; pick one, fill in the arguments it asks
  for, and read the answer as text.
- **Keep this as a source** puts it into intake, where it is read for claims and reviewed like any
  document. Nothing a remote server says reaches the graph without that.
- "Any MCP server" is now an available connector in the catalogue.

### Agents that run themselves (v0.2)
- A schedule on any described agent — hourly, daily, weekly — enforced by an in-process clock
  started from `instrumentation.ts`, plus `POST /api/agents/tick` for a platform cron or an
  impatient person.
- Due is computed from the last run in the database, never from a timer, so a restart loses and
  duplicates nothing. One tick runs at most three agents, oldest first, serially.
- An unattended run is the same run: the same status checks, the same budget, the same scope, the
  same refusal written to the log.
- **While you were away** on the workspace home: unattended runs, what they proposed, what has been
  decided since, and refusals first. Silent when nothing happened; counts news rather than open
  work; and only dismissing moves the window.
- The fleet shows which agents are scheduled and when each goes next; the editor warns when a
  schedule wants more runs a day than the budget allows.

### Signing in as yourself (v0.2)
- Email and password, hashed with **scrypt** from Node's standard library — no native module, cost
  parameters stored with each hash so they can be raised without invalidating anybody, and a
  successful sign-in quietly rehashes an old one.
- **Sessions are a table**, so they can be revoked: the cookie is 32 random bytes, the row is their
  SHA-256, and an active session has its expiry pushed forward rather than lapsing mid-sentence.
- The sign-in form never says which half was wrong and takes the same time either way.
- Two gates in order: the optional shared password (§5.12), then a session. The proxy checks only
  that a cookie is present — a forged one fails at `currentUser()` — and machine endpoints
  (`/api/mcp`, `/api/health`) are excluded because they carry their own key or no cookies at all.
- Sign out from the sidebar or the board topbar; the row is deleted, not just the cookie cleared.
- A seeded demo still opens in one step: the four seeded people share a known password, printed on
  the sign-in page in development and in production only with `NEXUS_DEMO_SIGNIN=1` — and never
  once that password has been changed.
- Presence stopped inventing colours: a cursor, a topbar avatar and a sidebar avatar all use the
  person's own `users.color`.

### Two people on one board (v0.2)
- A live channel per board: **server-sent events down, POSTs up** — plain HTTP, no upgrade, no
  custom server, so a corporate proxy that breaks WebSockets does not break the canvas.
- Coloured cursors in world coordinates, an outline round what each person has hold of, initials in
  the topbar, and **Shared** in place of *Saved*.
- Per-element last-writer-wins ordered by the server; patches for different objects commute, and
  the same object is a real conflict with a defined winner.
- A text field somebody is in is **locked** — their colour, read-only for everybody else — because
  last-writer-wins on characters loses them. The lock is presence, so it cannot get stuck.
- The room on the server is the writer while anybody is live: one save, one graph sync, one import
  reconcile per settle, through the ordinary save path. The client's own autosave comes back the
  moment the stream drops, so a blocked stream degrades instead of breaking.
- Approving an import, restoring a version, deleting a relation and an ordinary PUT all hand the
  live room the new document, so a board rewritten from outside simply arrives.
- Undo stays personal: a remote change never lands on your undo stack.

### The graph remembers (v0.2)
- **`entity_events`**: one row per field that moved, with its before and after, the actor (person /
  agent / import / board / rules / system), the context in words, and the time. `entity_id` is not
  a foreign key, so the history of a deleted object survives it, under the name it had.
- **Observed, not declared**: `remembering(db, ctx, scope, write)` snapshots the rows in scope, runs
  the write and diffs. Wrapped round the drawer edits, bulk edits, kind and attribute renames,
  merges, accepted proposals, board saves, meta-model renames, and import approval and rollback.
- **Coalescing**: a change continuing the one before it — same field, same hand, same place, inside
  two minutes — extends that row instead of adding one, and an edit undone within the window leaves
  no row at all. Another person's edit always ends the run.
- Relations are recorded on **both** ends, so either object's own timeline is complete; the
  workspace view drops the second copy so its counts mean something.
- **What changed** in the sidebar: the last 300 changes, grouped by day, folded into moments, with
  filter chips by hand and a text filter over objects, people and fields.
- The same timeline inside the **entity drawer**, for one object.
- The seeded demo ships a fortnight of invented history — a colleague setting owners, an overnight
  agent, a CMDB import — because the page is about the last two weeks and a workspace created a
  minute ago has nothing to show on it.

### Dropping onto the board (v0.2)
- A live preview while you drag: ghost cards in world space, at the size, position and colour the
  real cards will have, laid out by the same function the drop uses.
- A group carries a count; a drop that is entirely already on the board draws nothing.
- Floating panels refuse the drop instead of swallowing the card underneath themselves; new chrome
  opts in with `data-canvas-chrome`.
- A custom drag image — the object in its kind's colour — instead of a snapshot of the list row.
- The full-window dashed border and blue wash are gone; what is left is a hairline.

### Live boards across replicas (v0.2)
- A bus between server processes: Postgres `LISTEN`/`NOTIFY` when the store is Postgres, a
  synchronous function call when it is not, chosen by the same connection string that picks the
  driver.
- A patch is published before it is applied, so every replica applies in the bus's order and
  last-writer-wins means the same thing on all of them.
- Exactly one replica persists per settle — the lowest process id present — so a board with three
  replicas on it still does one save, one graph sync and one import reconcile.
- Presence is the union of every replica's peers, refreshed on a heartbeat and forgotten after
  forty-five seconds, so a crashed replica leaves no ghosts.
- A message too large for `NOTIFY` writes the board down and asks the others to re-read it.

### A canvas with edges (v0.2)
- Each fact is on screen once: the topbar counts objects, the zoom control owns zoom, the map keeps
  the composition and how much is in view. The bottom status line is gone.
- The Selection panel, the map and the zoom control share one width and one margin — a right rail
  rather than three scattered cards.
- The search bar rests as a **⌘ K** pill and opens on the shortcut its keycap always advertised.
- The map starts folded away; its toggle is in the tool rail with an on/off badge. With it away the
  Selection panel is 600px rather than 344 and shows an object's attributes without scrolling.
- Chrome over the canvas at 1280×800: 43% → 32%, across seven pieces instead of nine.

### Chrome that keeps out of its own way (v0.2)
- The property bar sits in the band between the side panels, wrapping rather than sliding under one.
- It is anchored by the edge facing the selection, so however tall it grows it never covers the
  object whose controls it holds.
- One named reserve (`--canvas-bottom-reserve`) keeps a top-anchored panel off the map card.
- The browser suite fails if any two pieces of canvas chrome overlap at 1280×800.

### An answer you can keep (v0.2)
- *Ask about a selection* keeps the exchange on screen and carries it into the next question, so a
  follow-up is a follow-up. Capped at four turns.
- **Keep as a comment** writes the questions, the answers and the words each answer rested on into a
  comment on the board — or on the object, when one object was selected.
- The kept body says a model wrote the prose, once per exchange.

### An agent that accounts for itself (v0.2)
- Selecting an agent outlines every object it would read, in its colour, and it counts them —
  *Reads 6 objects in "OT estate"* — so a scope costs nothing to check.
- After a run it says **Read 14 · said 3 · discarded 1 · 4 min ago**; hovering shows the doctrine
  that run was given. "Read fourteen and said nothing" no longer looks like "saw nothing".
- The remark tally is a button that flies to each object it spoke about, one press at a time.
- Waking an agent with an empty scope is refused before the round trip, and the sentence under the
  button names the fix rather than the symptom.
- An agent can no longer be left *Reading…* for ever by a closed tab.

### Following somebody's viewport (v0.2)
- Click a peer's initials in the topbar and your camera tracks theirs; click again, press Escape,
  press **Stop**, or simply move the board to take it back.
- Presence carries the world **rectangle** a peer can see, not their camera, so a smaller window
  still shows everything they are looking at — at its own zoom.
- The canvas edge takes their colour and a pill names them, so a board moving on its own is never
  a mystery.
- Following somebody who is already following you is refused: the fitting margin would compound and
  zoom the pair off the board.

### Comments (v0.2)
- A conversation about the board, or about one object on it: **Comments** in the topbar with the
  open count, **Comment** on the selection bar, and a pin on any object somebody is still talking
  about.
- Two levels — an opening comment and replies; a reply to a reply joins the same conversation.
- Settled rather than deleted: the tick drops a conversation below the open ones and takes its pin
  off the board, and it stays under *Show settled* with who settled it.
- Rows beside the document, not part of it: they survive the card, the board version and the person.
  A thread about a deleted object says **(deleted)** rather than disappearing.
- `board.comment` is granted to every role including **guest**; editing and deleting are your own
  words only, and not an administrator's power.

### More than one workspace (v0.2)
- A switcher in the sidebar, in place of the static workspace name; creating one makes you its
  owner and gives it a space to start in.
- The workspace layout checks membership: a workspace you are not in answers `notFound`, not a
  refusal, so its existence is not something a URL can teach you.
- The front door sends you to a workspace you belong to.

### Who may do what (v0.2)
- **A coverage test over the write boundary**: every exported action in a `"use server"` module must
  call a guard or be listed as deliberately open with a reason. Forty-nine that were not are now.
- Staging an import is a member's; approving, rolling back and deleting a batch are an
  administrator's. Deleting a space and shaping teams are administrative; committing an intake
  source is the same act as approving an import.
- Four roles — owner, administrator, member, guest — over nine capabilities, in one table
  (`src/lib/auth/roles.ts`) with the matrix asserted by tests rather than discovered in production.
- Guarded: model providers, MCP keys, connected servers, source grants, agent definitions, import
  approval and rollback, change-set delivery, graph deletion and merges, the meta-model, the board
  `PUT` and the live channel's patches.
- **People** under Settings: the roster, a role picker, add a colleague, reset a password, and what
  each role means written where the role is chosen. Anybody can change their own password.
- The last owner cannot be demoted or removed; a reset revokes that person's sessions; removing
  somebody takes their membership and leaves everything they made.
- `mcp_tokens`, `model_providers` and `mcp_servers` gained `created_by_id` — with a hand-written
  SQLite migration, because `ALTER TABLE … ADD COLUMN … REFERENCES` silently drops the delete
  action there and would have left the two dialects behaving differently.

### Running it somewhere real (v0.2)
- **Self-hosted typeface**: IBM Plex committed under `public/fonts` with its OFL licence, faces
  imported with the stylesheet, refreshed by `pnpm fonts:vendor`. No request leaves for a font
  host, and the browser suite fails if one does.
- **`pnpm db:transfer`** moves a database between SQLite and Postgres in either direction: every
  table, parents before children, batched, refusing a destination that is not empty. A test checks
  the order against the schema, so a new table cannot be silently skipped.
- **`pnpm dev:clean`** for the Turbopack first-compile panic, which is upstream and unfixed here.

### Documentation (v0.2)
- Twenty-nine in-app pages, with the three agent surfaces gathered into one **Agents** section under **Documentation**, from a first board through to plateaus, by way of
  importing data, models and connections, with a glossary, a keyboard reference and the questions
  people ask.
- Forty-two screenshots captured from the seeded demo by `pnpm docs:capture` and committed; the run
  takes a name to re-capture only the shots a change made stale. One of them drives **two** browser
  contexts, because a picture of multiplayer with nobody else on the board is a picture of a board.
- Twelve tests over the docs as data: missing screenshots, unrecorded image sizes, missing alt
  text, dead links, duplicate heading ids, orphaned pages, that search finds the page a person
  would be looking for, and that no page uses inline markup the renderer does not understand.
- The renderer reads `**bold**`, `*emphasis*` and `` `code` `` and nothing else — a single asterisk
  only opens a span when a non-space follows it and closes it, so an ordinary asterisk in a
  sentence stays where the author put it.

### Quality gates
- `pnpm typecheck`, `pnpm lint` (Next + TypeScript ESLint), `pnpm test` (Vitest, **641 tests** —
  614 in the app over 60 files, 27 in the knowledge package):
  - *Canvas*: camera math, panel-aware fit, align/distribute, box/resize/connector geometry,
    store history, frame behaviour and frame→board extraction, centre-inside containment,
    lenses (impact / attribute / relation / query), document diff and migration, SVG export and
    PNG sizing, link-to-existing, the timeline layout.
  - *Graph*: sync / hydrate / import / layout, proposal rules incl. attribute normalisation and
    the evidence check, relation create/delete, graph neighbourhood and algorithms, the
    explorer's force layout, the emergent meta-model, estate health, query parsing and
    autocomplete, version checkpoints / restore, incremental board saves, the seed, and Postgres
    schema drift (`schema.pg.ts` regenerated and compared).
  - *Data in*: intake extraction and commit, the model-backed extractor and its validator, the
    source catalogue's discovery rules, reading CSV/TSV/JSON/XLSX/DOCX and pasted blocks, folding
    and provenance, proposing what a file's rows are, and reading a staged board back (the lane
    as the decision, the same containment rule the canvas drags by).
  - *Time and composition*: change-set projection and impact, dependency ordering and refused
    cycles, plateaus and the difference between two of them, the roadmap board, and Compose's
    plan validator and rule compiler.
  - *Agents and models*: the graph agent's plan validator, board-agent remarks and scope,
    described-agent refusals and monotonicity, agents suggesting agents, the fleet's numbers,
    provider translation between the two dialects and key encryption, and the MCP server's
    JSON-RPC dispatch, scopes and tool list.
  - *History*: what a diff of two entity snapshots says happened, the sentence each change makes,
    folding a burst into a moment, coalescing a run of saves into the one change they add up to and
    dropping an edit that was undone — and, against a real database, that the events outlive the
    entity they describe and that recording cannot take an edit down with it.
  - *Access*: the capability matrix role by role, who may hand out which role, what a refusal says,
    and what a signed-out request may still fetch; the last-owner rule, that a reset ends the
    sessions, and that removing somebody keeps what they made.
  - *Deployment*: that the transfer order names every table in the schema and puts parents first,
    that a move keeps ids and booleans and refuses a non-empty destination; which replica writes a
    live board down, and what happens to a message too big for the wire.
  - *Documentation*: twelve tests over the docs as data (see above).
  - Everything that touches the database runs against an in-memory SQLite.
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
  title), drag, zoom, pan, fit, inspector, delete, undo, card, rectangle, connector, context
  menu, command-bar search, structured graph query, viewpoint tab and kind lens, impact lens,
  history checkpoint and compare, export and presentation mode, entity drawer, entity table
  view, entity deep link, drag from the inventory, autosave, reload, graph import, create board
  from a starter — and then, screen by screen, through everything built on top of it: the graph
  explorer and a traced path, estate health with its drill-through and an evidence-backed fix,
  the meta-model tree and diagram, intake and its review, the source catalogue with a grant and
  an unrecognised host registered and removed, writing a board with Compose, change sets with
  impact, dependencies and a refused cycle, plateaus and the difference between two of them, a
  board seen as-is and to-be, the time scrubber, the timeline layout on an ordinary board and
  the roadmap drawn as one, the graph agent's honest refusal with no model, **import end to end**
  (four mixed files including an Excel serial and a Word document, a pasted block, the staged
  board with its lanes and its reviewer, approve and roll back to the graph size it started at),
  agents on the board and asked about a selection, the fleet, the knowledge base and a question
  it has never heard, describing an agent with its refusals and run log, the models screen
  (a key that cannot be read back out, an honest unreachable provider), Nexus answered over MCP
  and Nexus asking an MCP server, and the documentation with its screenshots really loading.
  A failing assertion leaves `e2e/failure.png` and prints where it was.
- The shared-password gate (§5.12) is exercised separately: with NEXUS_ACCESS_PASSWORD set,
  `/api/health` must stay open, protected paths must redirect, a wrong password must be
  rejected and a correct one must land on the originally requested page.

### Known gaps

Every gap this section carried through brief 1 has now been closed (§5.45–§5.50). What is left is
what is honestly still missing, and why.

- **No sign-up and no password-reset email**, by choice. Somebody can change their own password and
  an owner can add a colleague and reset one (§5.46); enterprise SSO is the intended answer to the
  rest, and a mail transport in the middle of an architecture tool is a moving part, a
  deliverability problem and an attack surface nobody asked for.
- **No connector fetches for real.** Seventeen sources are modelled with scope trees down to named
  tables and the grants are enforced (§5.14), but the three doors that actually bring data in are
  files, paste and outbound MCP (§5.37). Which source is built first is a question for the product
  owner.
- **Postgres is exercised, not operated.** One generated schema with drift caught by a test, the
  browser suite run against Postgres 16, and a transfer that moves a database across (§5.45) — but
  nobody has run this under load, and the live bus's ordering guarantee has been reasoned about and
  unit-tested rather than watched under two real replicas.
- **Next.js 16 dev server (Turbopack) occasionally panics** on first compile of a route. 16.3.4 is
  the latest release and still does it; `pnpm dev:clean` clears `.next` and starts again. Not seen
  in production builds.

## 6b. Running it

```bash
pnpm install
pnpm dev            # http://localhost:3000 → redirects to /w/acme-energy
pnpm typecheck && pnpm lint && pnpm test
pnpm e2e            # isolated: its own server, its own database, cleaned up afterwards
pnpm build && pnpm start
```

**Signing in as yourself.** There is no self-signup. Put this in `apps/web/.env.local` (git-ignored)
or in the deployment's variables, and the account is created — and made an owner of every
workspace — on the next start (§5.61):

```
NEXUS_OWNER_EMAIL=you@example.com
NEXUS_OWNER_PASSWORD="your password"     # quote it: an unquoted # starts a comment
NEXUS_OWNER_NAME=Your Name               # optional
```

It never resets an existing password unless `NEXUS_OWNER_PASSWORD_RESET=1` is set too. The seeded
demo people (all with the password `acme-energy`) stay where they are; the sign-in page stops
advertising them once that password has been changed.

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


| 2026-09-06 | The fleet leads with how often people kept what an agent said. | Every other number an agent can report — objects read, runs, tokens, remarks made — measures it talking. Whether a person kept what it said measures it being useful, and it is the one that gets worse when an agent starts padding. An agent nobody keeps is not quiet and cheap; it is noise with a running cost, and the product should say so. |
| 2026-09-06 | The record of how a remark was answered outlives the remark and the agent. | Remarks live in the document and vanish when answered, so the outcome has to be stored elsewhere or the fleet could never say anything. The agent's name is copied into the row because the moment that record is most useful is when somebody is about to write the same agent again. |
| 2026-09-06 | Asking about a selection needs no agent, no placement and no query. | Selection already means "these ones". Making somebody set an agent up before they can ask one question would put the tax before the value, and the point of ambient agents is that the help is there in the middle of the work rather than a page away. |
| 2026-09-06 | An uncited answer is shown, marked, rather than hidden. | "I cannot tell from what is here" is a good answer and a much better one than a plausible guess. Hiding it would push the model towards inventing a citation; marking it leaves the reader in charge of how much weight to give it. |


| 2026-09-06 | The app states a 14px base rather than inheriting the browser's 16px. | Everything drawn with `font: inherit` — navigation, buttons, inputs — was sized by a default nobody had chosen, which is why the shell read as roomier than the work it holds. Stating the base is what makes the rest of the scale a decision instead of a drift. |
| 2026-09-06 | The line above a page title is never uppercased. | It is an eyebrow on most pages and a whole sentence on the Knowledge graph, and there is no way for CSS to tell the difference. Small and quiet works for both; shouting works for one and ruins the other. |


| 2026-09-06 | Eighty lines of ZIP rather than a dependency for .xlsx and .docx. | Both are zip archives of XML and we need two files out of each. A reader that walks the central directory can be read in one sitting and does exactly what we need; a spreadsheet library is a large surface for a small job, and the formats have not changed in fifteen years. |
| 2026-09-06 | Provenance is kept per field, and the losing value with it. | "Who says the owner is Grid Ops" is the question an estate model exists to answer. Storing only the winner turns a disagreement between two systems into an unattributable fact, which is how a model stops being believed. |
| 2026-09-06 | A relation column is one whose values name things, not one whose header sounds like it. | "Hosting" and "Depends on" both read as relations; only one of them points at objects. Once the batch's names are known the difference is decidable, so the mapping runs twice rather than guessing from the header. |
| 2026-09-06 | An ambiguous date column is flagged, not guessed. | 03/04/2027 is March or April depending on where the export came from, and a plan a month out is worse than a blank. The column is judged as a whole first; only a column that genuinely cannot be told is left to a person. |
| 2026-09-06 | Rows that both carry a source key are never folded, however alike their names. | A key is the source's statement that these are different things. Merging two of them is the one action here nobody can undo, so name similarity is not allowed to override it. |
| 2026-09-06 | Columns that name people are excluded until somebody includes them. | An old spreadsheet carries people. Nothing about a person should enter the model because nobody looked, and the cost of the default being wrong is one checkbox. |
| 2026-09-06 | What a source has stopped claiming is raised, never deleted. | A system missing from this month's export has been decommissioned, moved out of scope, or the export was filtered. Three very different facts, and only a person knows which. |
| 2026-09-06 | Rollback reverts only what it wrote, and reports what it would not. | An object somebody has since built on, or a field somebody has since corrected, is now theirs. A rollback that overwrites those is a second unwanted import; one that silently skips them leaves the estate in a state nobody can describe. |

| 2026-09-06 | A provider is described by the dialect it speaks, not by the vendor that sells it. | There are two request shapes that matter and everything else speaks one of them. Modelling the vendor would have made every sovereign endpoint a special case and every new gateway a code change; modelling the dialect makes Ollama, vLLM, Azure and a national cloud all the same row. |
| 2026-09-06 | The one thing the translation must preserve is "answer with exactly this tool". | Every model call in Nexus is a proposal in a closed language that a typed validator then decides on. `tool_choice` is what makes that closed. A dialect adapter that dropped it would leave the same code paths accepting free prose, which is the failure nobody would notice until it mattered. |
| 2026-09-06 | Each job can point at its own model. | Reading a fifty-page transcript and answering a question about two cards are different work with different costs. An organisation that has to choose one model for both will choose the cheap one and get a worse graph agent, or the careful one and stop using board agents. |
| 2026-09-06 | Without NEXUS_SECRET_KEY the key is stored as it is, and the page says so. | The alternative is deriving a key from something already in the same database and storing it beside the ciphertext, which protects nobody and reads as protection. An administrator who is told the truth can fix it in a minute; one who is reassured cannot. |
| 2026-09-06 | A key that cannot be decrypted stops the provider rather than falling through to the next one. | The fallback chain exists for a provider nobody has configured, not for one somebody configured and whose secret has rotated. Silently using a different model — possibly a hosted one, for an organisation that chose a local one — is a worse outcome than an error message naming the key to re-enter. |
| 2026-09-06 | The environment variables stay supported as the last fallback. | They are how every existing deployment is configured, including the one running the tests. A settings page that quietly took a working instance's model away would be a regression dressed as a feature. |

| 2026-09-06 | An agent is a row a person can read, not a module we write. | "What is this thing allowed to do" is the first question anybody asks about a fleet, and it should be answerable from a screen. Every field on the definition — owner, scope, verbs, budget — is the answer to a question a security review will ask. |
| 2026-09-06 | A scope is required, and it is a query. | Defaulting to "the whole model" is exactly how six agents end up all reading everything with no way to say what any of them can see. Writing the query costs a minute and is what makes the rest legible; `*` stays available for an agent that really is the workspace's reviewer. |
| 2026-09-06 | A relation is in scope only when both its ends are. | Otherwise the name of an object the agent may not read arrives in its prompt through the back door. Obvious once written down and invisible otherwise. |
| 2026-09-06 | A new agent starts as a draft, and a draft is a dry run. | Reading what something would have said before letting it say it is what people do with a new colleague. It costs one call, and it is the difference between an agent you trust and an agent you tolerate. |
| 2026-09-06 | Failed and refused runs are logged like any other. | A log that records only what worked is a log that flatters. "It has been refused by its budget eleven times" and "it has failed since the key changed" are the two things somebody actually needs months later. |
| 2026-09-06 | The verbs an agent was given are enforced by the validator, not only by the prompt. | Telling the model what it may not say stops it wasting its answer; it does not stop anything. The validator is the mechanism, and it rejects out-of-scope verbs in the open so an agent's own limits are visible in its run log rather than hidden as silence. |
| 2026-09-06 | A decision copies the agent's name off the proposal before the proposal is deleted. | It is the only moment both facts exist together. Without it the fleet could never say how often people keep what a given agent says, which is the one number that measures an agent being useful rather than talking. |
| 2026-09-06 | Capability monotonicity is built before anything can create an agent. | An agent proposing an agent is safe only if it cannot hand on a verb or a budget it does not have. Writing and testing that rule while nothing depends on it is much cheaper than retrofitting it to the feature that needs it. |

| 2026-09-06 | Nexus is an MCP server before it is an MCP client. | Reading the model is what other people's agents want and what only we can offer; calling out to ServiceNow is work anybody could do. Being the thing that answers is also the position that keeps the boundary ours. |
| 2026-09-06 | No tool on the MCP surface changes the model, and a test asserts it. | The claim "letting an assistant read our architecture is a small decision" is only true while it stays true. Writing it as an assertion means the day somebody adds a convenient write tool, the suite says no. |
| 2026-09-06 | An outside caller gets a described agent of its own. | Otherwise the fleet page quietly under-reports who is working here, and a suggestion from outside would be the one kind nobody could measure or switch off. It is created without `merge`: an outside caller has not seen the boards or the argument that put both objects there. |
| 2026-09-06 | The MCP endpoint sits outside the shared-password gate. | It carries bearer authentication, which is stricter than the shared password, and a machine cannot follow a redirect to a login form. The gate is for browsers. |
| 2026-09-06 | The transport is written by hand rather than taken from an SDK. | A POST that answers with one JSON object is the whole of what request/response tools need, it has to run inside a Next route on either dialect, and a dependency here would sit exactly on the boundary this feature exists to defend. |
| 2026-09-06 | A tool's failure is content marked isError, not a JSON-RPC error. | The thing on the other end is a model. A sentence it can read gets it to try something else; a protocol error gets rendered as "request failed" and stops the conversation. |

| 2026-09-06 | An agent proposing an agent is a proposal, not a creation. | The product already knows how to handle a model's opinion: closed language, typed validator, queue, a person's signature. Reusing that here means "agents building agents" needs no new trust model — and the `proposed` status makes the human step structural rather than a habit. |
| 2026-09-06 | The asking agent's own verbs and budget are the ceiling for what it suggests. | Capability monotonicity is the difference between delegation and privilege escalation. Putting it in `checkDefinition` rather than in a prompt means it holds whatever the model answers, and it is why the button is worth having on a narrow agent's page at all. |
| 2026-09-06 | A suggested agent must name what it read in this model. | "You should have an agent for interfaces" is true of every workspace and useful to none. Requiring the count or the observation makes the suggestion arguable, which is the only thing that makes it worth reading. |

| 2026-09-06 | What a remote MCP server returns becomes an intake source, never a change to the model. | It is text from a system nobody in this workspace controls. Intake already knows how to read text for claims, check each claim against its own words and put the survivors in front of a person; skipping that would make a remote system an author of the architecture, which is exactly the thing the product refuses everywhere else. |
| 2026-09-06 | Calling a tool and keeping its answer are two buttons. | Evidence somebody has looked at is worth more than evidence that arrived. It also means a tool that returns something useless costs nothing but a glance. |
| 2026-09-06 | The argument form is built only from top-level scalar fields. | Generating a form for an arbitrary JSON Schema we have never seen produces something worse than a text box. The simple fields cover most tools, and anything deeper belongs to whoever knows that system. |

| 2026-09-07 | The landing zone becomes Import, and stops being about applications. | Nothing in the machinery ever cared what the rows were about — a row is a claim about a thing. The APM framing narrowed a general capability to one use of it, and the name was the only part that had to change. |
| 2026-09-07 | On a staged board, the lane a card is in is the decision. | This is a canvas product. Making the canvas a picture of decisions taken in a table was backwards: sorting claims into piles is what a canvas is *for*, and a pile that is only a drawing of a pile is a worse table. |
| 2026-09-07 | Saving the board applies it; there is no Apply button. | A second step would mean two places where the truth lives, and a person who dragged five cards and walked away would have decided nothing. The autosave already exists and the containment rule is the one the drag uses, so the save is honest. |
| 2026-09-07 | Held and Rejected are drawn even when empty. | A lane only appears when it has rows, and then holding a card is a thing the canvas cannot express — which is exactly how somebody learns to go back to the table. An empty lane is a landing strip. |
| 2026-09-07 | What a column means stays on the batch page; what happens to an object moves to the board. | They are different kinds of decision. A column's meaning is a property of the file and affects every row; a decision about one object is a property of that object. Putting both on the canvas would make the canvas a form. |
| 2026-09-07 | Each file is asked what its rows are. | Most exports do not say, and the alternative is four hundred untyped objects and somebody typing them afterwards. Proposing it from the file name in the workspace's own vocabulary makes it one click; a kind column always wins, because it knows more than a filename. |

| 2026-09-07 | Paste is a first-class door, not a convenience. | The most common thing somebody has is forty rows in a mail. Requiring a file makes the product's front door narrower than the data, and "save this as a CSV first" is a step that exists only for us. |
| 2026-09-07 | A pasted block's delimiter is counted across the block, not sniffed from the first line. | A CSV whose values contain tabs and a TSV whose values contain commas are both ordinary. The separator every line agrees on is the one that is real; the first one seen is a coin toss. |
| 2026-09-07 | Asking a connected system lives on the import page; configuring one stays on Connections. | They are different jobs done by different people at different times. Somebody importing today should not have to visit the page where servers and keys are set up, and somebody adding a server should not be shown a staging form. |
| 2026-09-07 | `search_model` can answer with rows when asked. | Prose is right for a model summarising to a person, which is the usual caller. But a caller that will process the answer should not have to parse bullets, and offering both is what makes one Nexus able to import from another. |

| 2026-09-07 | Prose in a batch is folded into the same records as the tables. | The document in the batch is about the systems in the export. Reading it in a different part of the product and asking a person to reconcile the two by hand is the product refusing to do the obvious thing. |
| 2026-09-07 | A value read from prose carries the sentence it came from. | A column's provenance can be the column, because anybody can open the file and look at it. A document's cannot: "the review says the owner is Grid Ops" is unarguable without the words, and unarguable claims are how a model stops being believed. |
| 2026-09-07 | A document takes its place in the trust order like any other file. | It is tempting to give prose a special rule — always wins, never wins, wins for dates. All of those are wrong for somebody. Reordering the files is a gesture people already understand, and it makes the answer theirs. |
| 2026-09-07 | Viewpoints stay out of import. | A decision somebody took and a risk somebody raised are not claims about the estate's shape. They have a place on the intake screen; putting them in a staged batch would make the import a meeting record. |
| 2026-09-07 | The extractor may now state values, not only name things. | "Maximo is out of support from December" was being read, quoted, and then discarded because a candidate had nowhere to put a fact. Adding quoted facts to the schema was a smaller change than the workaround, and it improves intake independently of import. |

| 2026-09-07 | The staged board comes with an agent already on it. | Everywhere else an agent is something you place when you want one. Here the moment of need is known in advance and is exactly the moment somebody is least likely to go and set one up — so it arrives placed, and can be deleted like anything else. |
| 2026-09-07 | The import reviewer is an ordinary board agent with a different sentence. | A special "import agent" would need its own remarks, its own review loop and its own measure of whether it helps. The sentence is the only part that is import-specific, and keeping it ordinary means it is governed, measured and switch-off-able like the rest of the fleet. |
| 2026-09-07 | A board agent can see which frame a thing sits in. | People group by frame and the grouping carries meaning; an agent that cannot see it is reading a list where a person is reading a picture. On a staged import the frame *is* the decision, which turns "these two are the same system" into "you have accepted two cards that are the same system". |
| 2026-09-07 | Documentation is checked for staleness on a schedule, not only when the thing it describes changes. | The rule "update the brief with every change" keeps the *sections* honest but not the *counts and summaries* that sit above them, and nothing about editing an import pipeline reminds anybody that the README's feature list is three months old. A read-through of every document outside the code, against the product as it now runs, is its own piece of work and is worth doing whenever the feature list has moved a long way. |
| 2026-09-07 | The documentation renderer reads `*emphasis*`, and the pages are tested against what it reads. | Authors write the markup they are used to; a renderer that silently passes some of it through is a slow leak nobody sees, because the person who wrote the sentence never re-reads the rendered page. Teaching it the span is a five-line change — the test that keeps the pages inside what it knows is the part that stops the leak coming back. |
| 2026-09-08 | Multiplayer merges per element with last-writer-wins, not with a CRDT. | The document is a map of flat objects — nothing nests, nothing is ordered, every field is a value — so patches for different objects already commute and the same object is a real conflict rather than a merge failure. A CRDT would be a dependency, a second document model and a class of bugs nobody on this team could debug, bought to answer a question the data shape has already answered. |
| 2026-09-08 | Text is locked to one person rather than merged. | The one place last-writer-wins is actively wrong: two people typing into a field lose characters, and it reads as the product eating your work. Locking is a smaller promise honestly kept, and it costs a field rather than a document. Making the lock *presence* rather than state is what stops it ever getting stuck. |
| 2026-09-08 | Server-sent events and POSTs, not WebSockets. | The customers are enterprises; corporate proxies and TLS gateways break WebSocket upgrades silently and the failure lands on one team behind one proxy. SSE is a `GET` that does not end — plain HTTP/1.1, nothing added to the Dockerfile or the health check, and no custom server. One extra request per edit is a price a canvas does not notice. |
| 2026-09-08 | While a board is live the server writes it, not the clients. | Several tabs each PUTing a whole document is N races, N graph syncs and a 409 for people who have in fact converged. One room, one document, one debounce down the ordinary save path means a board edited by three people becomes exactly the graph a board edited by one would. The client's autosave stays underneath and comes back the instant the stream drops. |
| 2026-09-08 | A remote change never touches your undo stack. | Ctrl+Z means "undo what I did" everywhere else, and a shared canvas where it silently reverts a colleague's work is worse than one with no undo at all. It is the reason remote changes come in through their own door in the store rather than through the mutation everything else uses. |
| 2026-09-08 | Sessions are rows in a table, not self-describing signed cookies. | A stateless token cannot be taken back, and "sign out", "sign out everywhere" and "that laptop was stolen" all have to end a session before it expires. The cost is one indexed lookup per request, which this product does not notice; the alternative costs the ability to revoke, which is the whole point. |
| 2026-09-08 | The session token is hashed before it is stored, even though it is already random. | Not about guessing — 32 random bytes are not guessable — but about blast radius: a leaked backup or a careless log then contains no usable cookie. It is one line and it turns a database disclosure into something less than a full account takeover. |
| 2026-09-08 | scrypt from the standard library rather than argon2 or bcrypt. | Memory-hard, in Node already, and the whole job is forty lines with the cost parameters stored alongside each hash so they can be raised later. A native module in the image and another supply-chain dependency would buy a difference nobody in this product can measure. |
| 2026-09-08 | The sign-in page refuses to say whether an account exists, and takes the same time either way. | "No account with that address" is an enumeration oracle, and this product knows who works at an organisation. Saying nothing is worth little if the response time says it instead, which is why the unknown-address path still runs a hash. |
| 2026-09-08 | The edge gate checks only that a session cookie is present. | There is no database at the edge, so it cannot do more; pretending otherwise would be the hole. A forged cookie gets past it and fails at `currentUser()`, which does look the session up. The cheap check exists so an ordinary signed-out visitor is redirected once instead of rendering a page that redirects. |
| 2026-09-08 | The seeded demo keeps a published password, shown only where saying it is harmless. | Zero-configuration start was a real property of this product and worth keeping for a database full of invented energy companies. Development shows the hint; production needs `NEXUS_DEMO_SIGNIN=1`; and the hint disappears the moment the seeded password is changed, so a real deployment cannot keep advertising one by accident. |
| 2026-09-08 | An agent's schedule is an interval, not a time of day. | A time needs a timezone, and a workspace is an organisation rather than a place — an EA team at a grid operator is not all in one country, and picking one country's midnight for everybody is a decision disguised as a default. An interval drifts by minutes and never fires twice when the clocks change. |
| 2026-09-08 | Due is computed from the last run row, never held in a timer. | The timer is a nudge that any restart is allowed to lose. Making the database the schedule means a redeploy, a crash or a container that slept costs nothing — and it is what lets a platform cron hitting `/api/agents/tick` be exactly equivalent to the in-process clock rather than a second implementation. |
| 2026-09-08 | An unattended run goes through the same function as a run somebody asked for. | The temptation is a leaner path for the scheduler; the consequence would be two sets of budget checks and, eventually, one of them missing a case. Leaving an agent running overnight is only reasonable if "nobody is watching" changes who is watching and nothing else. |
| 2026-09-08 | The digest is silent when nothing happened. | Most mornings nothing did. A panel that speaks every day is skimmed, then skipped, and is invisible on the one morning it has something to say — so the discipline is that it earns its appearance, and refuses to pad an empty night into three bullet points. |
| 2026-09-08 | The digest counts news, not open work, and only dismissing moves the window. | Two small rules that decide whether it is trusted. Counting everything open means it reappears the instant it is closed, which teaches people it is noise. Moving the window on *reading* means a glance on a phone silently spends the digest somebody meant to read properly. |
| 2026-09-08 | The graph's history is observed from the rows, not declared by the code that writes them. | Twenty-odd call sites write to the graph. Asking each to describe what it did is twenty places to forget and twenty descriptions that can be wrong; diffing a before-and-after snapshot records what actually happened to the database instead. One extra bounded read per write is the right price for a log that agrees with the data rather than with somebody's intentions. |
| 2026-09-08 | `entity_events.entity_id` is not a foreign key. | A deletion is the most interesting thing that can happen to an object, and a cascade would erase exactly the history that makes it worth having. The name is copied onto the row for the same reason: a deleted object still needs to be recognisable in a list. |
| 2026-09-08 | The history folds a run of edits into the one change they add up to. | Autosave means one rename is four saves; four rows saying "renamed" bury the one fact that matters, and an edit that was undone leaves two rows saying opposite things instead of the truth, which is that nothing happened. Folding is limited to one hand in one place inside two minutes — anybody else's edit ends the run, because "Maria changed it and Tobias changed it back" really is two facts. |
| 2026-09-08 | An accepted proposal is attributed to the reviewer, not to the agent that proposed it. | An agent that proposes has not changed anything; the person who clicked Accept has, and pretending otherwise would let a fleet quietly own decisions people made. Which agent asked is already on the decision row, and it is in the context line, so nothing is lost. |
| 2026-09-08 | A live board's saves are attributed to the board, not to a peer. | A room persists on a timer for everybody in it, so there is no one person whose save it is; naming whoever happened to type last would be a guess dressed as a fact. Single-tab saves still carry the person, because there the answer is known. |
| 2026-09-08 | A live patch is published to the bus before it is applied locally. | The obvious implementation — apply, then tell the others — makes each replica apply its own edits first and everybody else's second, so two servers reach different documents for the same pair of edits. Publishing first costs a round trip the origin never notices (its own client already drew the change) and buys one total order for every replica. |
| 2026-09-08 | The lowest process id present writes the board down. | Any replica could, since they converge — but then a settle costs one save per replica. This needs no election, no lock and no new state: presence is already being published, so every replica can compute the same answer, and a dead writer's peers age out and hand it over. |
| 2026-09-08 | A live message too big for NOTIFY persists and asks for a re-read. | 8000 bytes covers essentially every patch. Chunking would be a protocol, with ordering and reassembly and a partial-delivery case, to serve the card with a thousand-word description. Writing the board down and saying "read it again" is three lines and always correct. |
| 2026-09-08 | A workspace you are not a member of answers 404, not 403. | A refusal confirms the workspace exists, and slugs are guessable — an organisation's name is not a secret but the fact that it uses this product might be. Not-found is the same answer a made-up slug gets. |
| 2026-09-09 | Guard coverage is enforced by a test that reads the source, not by review. | Rev 81 guarded the modules a person thinks of as administrative and shipped forty-nine holes in the ones they do not — deleting a board, committing an intake source, editing a change set. Ninety hand-written guards is a coverage problem; a coverage problem is a machine's job, and the list of deliberate exceptions is the part a reviewer can actually argue with. |
| 2026-09-09 | Staging an import is a member's work; approving it is not. | Splitting them is better than either alternative: a member can do the laborious part — reading files, mapping columns, sorting cards into lanes — and an administrator reviews and approves. That is how the work actually divides in an EA team, and it fell out of asking which acts have consequences outside the screen. |
| 2026-09-08 | Authorisation is capabilities in one table, not role checks at the call sites. | Ninety server actions asking `role === "admin"` is ninety chances to be inconsistent, and nobody can answer "what may a member do?" by reading them. One matrix turns a role into sentences about the product, the actions ask the matrix, and a test argues with the matrix. |
| 2026-09-08 | A member may edit the model but not delete from it, approve an import or deliver a plan. | The line is consequence outside the screen you are on. Editing an object is what the model is for; a merge cannot be undone by merging back, an approval rewrites what everybody else is reading, and a delivery moves the estate into the future. Those are the acts a workspace wants somebody accountable for. |
| 2026-09-08 | A guest may join a live board and may not patch it. | Presence is the point of the feature and reading is what a guest is for, so shutting them out of the channel would remove something valuable to prevent nothing. The edit right is decided once when the stream opens and carried on the connection, which keeps the per-patch path free of a lookup. |
| 2026-09-08 | The membership is read on every guarded call rather than cached on the session. | A demotion that only takes effect at the next sign-in means somebody keeps powers for as long as their cookie lasts, which is precisely what revocation exists to prevent. It costs one lookup on a two-column primary key. |
| 2026-09-08 | Removing somebody deletes their membership, never their user row. | Boards, versions, change sets and the graph history all name them. Deleting the person would rewrite the record of what happened, which is the opposite of what rev 78 was for. |
| 2026-09-08 | Still no sign-up and no forgotten-password email. | SSO is the intended answer to both, and building a mail transport to avoid it would add a moving part, a deliverability problem and a new attack surface to an architecture tool. What was actually missing — adding a colleague, and changing your own password — needs neither. |
| 2026-09-08 | The fonts are committed to the repository rather than fetched at build time. | `next/font/google` self-hosts, but it downloads during the build — which means a build machine with no egress produces an image with no typeface, and the sovereign deployment story fails at exactly the step it was supposed to survive. Committing 270KB of woff2 makes the build hermetic and the licence auditable. |
| 2026-09-08 | A transfer refuses a destination that already holds rows. | Merging two databases is a different problem: two objects called Maximo, two workspaces with the same slug, two people with one email. Every answer is a policy decision somebody has to make deliberately, and a script that picks one silently would be the worst possible way to make it. |
| 2026-09-08 | The transfer order is a hand-written list with a test behind it, not a derived sort. | The model is small enough that an explicit, reviewable order is clearer than a topological sort over introspected foreign keys — and the part that actually matters is not the cleverness but the check: `orderGaps()` fails the suite the day somebody adds a table and forgets it, which is the only way the silent-data-loss failure gets caught. |
| 2026-09-08 | The drop affordance is the cards themselves, not a border round the window. | A dashed rectangle answers "may I drop", which the person dragging already knows. Drawing the actual cards where they would land answers "where will it go and will it fit", which is the question — and because the preview and the drop share one layout function, the answer cannot drift from the truth. |
| 2026-09-08 | A drop onto a floating panel is refused rather than passed through to the board. | The panels are children of the canvas element, so the old behaviour created the card underneath one: in the model, invisible on the board, and impossible to find without moving the panel. Refusing it costs one gesture; the alternative costs somebody ten minutes wondering where their object went. |
| 2026-09-08 | Board-only edits — moving, resizing, recolouring — are not graph history. | They are changes to a picture, not to the estate, and boards already keep version history for them. Mixing the two would bury the six changes that mattered under six hundred that did not, which is how an audit trail becomes something nobody opens. |

| 2026-09-09 | A comment is a row beside the board document, not an element inside it. | It has to outlive the thing it is about — you delete the card and the reasoning is exactly what you still want to read — and a version restore that silently deleted three colleagues' questions would be the product losing people's words. Being a row is also what lets a guest write one without being able to write a document. |
| 2026-09-09 | Commenting is its own capability, granted to guests. | The reviewer you invite to look at an architecture is exactly the person with something to say about it. Folding it into `board.edit` would make "come and review this" mean "come and change this", so inviting somebody would cost more than it is worth. |
| 2026-09-09 | Nobody can edit or delete somebody else's comment — not even an owner. | A record an administrator can rewrite is not a record. Every convenience this rule costs is smaller than what the exception would cost, so there is no exception; the only thing anybody else can do to your words is reply to them. |
| 2026-09-09 | No foreign key on `comments.parent_id`, so deleting an opening comment orphans its replies rather than cascading. | Somebody taking back their own question must not silently delete the answers to it. `threadsOf` promotes an orphan to a conversation of its own, which is the behaviour a person would expect and a cascade is the behaviour a schema would default to. |
| 2026-09-09 | Comment pins are one screen-space overlay, not a badge inside each element renderer. | The world layer is scaled, so a pin drawn inside a card is unreadable at 30% zoom and enormous at 300%; and seven element types would each need the same thing. One layer above the board is what the selection outlines already do. |
| 2026-09-09 | The studio grid gets an explicit `minmax(0, 1fr)` column instead of the topbar being trimmed to fit. | An implicit grid track sizes to its widest child's max-content, so *any* future control would silently widen the whole page and move the canvas out from under the pointer. Making the column the window fixes the class of bug; shortening one button would only have moved the threshold. |
| 2026-09-09 | Comments refresh on post and on tab focus rather than riding the live channel. | The live bus carries document patches, and adding a second message shape to it to save a poll that costs nothing is complexity bought early. Coming back to the tab is when somebody has been away long enough for a colleague to have said something, which is exactly when a refresh is worth doing. |

| 2026-09-09 | Presence carries the world rectangle a peer can see, not their camera. | A camera is in their screen units: copying its zoom onto a smaller window shows less of the board than they are looking at, so the corner they were pointing at ends up off your screen — the one thing following must not do. A rectangle is what they can see, and each follower fits it to their own window. |
| 2026-09-09 | Following ends on any camera move of your own, with no button required. | When a canvas starts moving under your hands the reflex is to grab it, not to hunt for an exit. The follow hook flags its own writes and treats every other camera change as the person taking the wheel back, so no other part of the canvas has to know following exists. |
| 2026-09-09 | Following somebody who is already following you is refused. | The fit leaves a 6% margin so their edges sit inside yours; two cameras each fitting the other's rectangle would widen by that margin every round and drift the pair off the board. Presence carries `following` so the loop can be refused at the point of the click rather than discovered as a mystery. |
| 2026-09-09 | A simultaneous mutual follow is broken by peer id, not by refusing both. | The click-time check cannot see a decision still in flight, so both sides can get through it. Dropping both would be safe but leaves nobody following after two people asked to; comparing ids is something both compute identically with nothing to negotiate, so exactly one follow survives — which is what either of them wanted. |

| 2026-09-09 | An agent's scope is drawn on the board rather than described. | Scope is a place, which is the whole reason agents are objects; but the place was never resolved on screen, so the only way to find out what a run would read was to spend one. Outlining the objects is the canvas-native answer, and drawing it from `scopeOf` means it cannot drift from what the run actually sees. |
| 2026-09-09 | The agent shows how many remarks the validator discarded. | It is the unflattering number and that is the argument for it: an agent that keeps quoting words which are not on the object is one to rewrite or delete, and nobody can notice a pattern that is never displayed. Hiding it would make the feature look better and the agent harder to judge. |
| 2026-09-09 | `thinking` is cleared by `migrateDocument` rather than by a timeout or a heartbeat. | A run cannot outlive the page that started it, so loading the document is a moment when the flag is *known* false — no clock to tune and nothing to get wrong. Because the same function runs on the board `PUT`, the flag also stops reaching the database at all, which closes the stuck state twice over. |

| 2026-09-09 | An agent's answer is kept as a comment, not as a note. | A note is a thing on the drawing; a comment is somebody talking about the drawing, which is what an exchange with an agent is. It lands where colleagues already look, keeps who kept it and when, and can be settled — without adding an object nobody drew. |
| 2026-09-09 | Follow-ups are capped at four turns. | A second question is usually a narrowing of the first and is worth carrying. An unbounded transcript is a chat window bolted to a canvas, which is the thing this product deliberately is not: past a few turns, what the exchange wants is to be an agent on the board with a purpose written down. |
| 2026-09-09 | Earlier turns are replayed to the model as prose only, without their citations. | The citations were checked against the same objects, and those objects are already the first message in the conversation. Re-sending them would be telling the model what it is looking at, twice. |

| 2026-09-09 | The property bar asks `fitInsets` where the chrome is, rather than clamping to the window. | There was already one function that answered "where is the chrome", used by zoom-to-fit and carrying a comment asking to be kept in step. A second, private answer inside the toolbar is exactly how the two drift apart; asking the same function is the fix and the prevention. |
| 2026-09-09 | The property bar is anchored by the edge that faces the selection, not by its top. | Positioning it above by `top` needs its height, and that height changes with what is selected — which is how it came to stand on the object it belongs to. Anchoring the bottom edge means the bar grows away from the object and there is no measurement to get wrong. |
| 2026-09-09 | Overlap is checked in the browser suite rather than reviewed. | Three collisions shipped, all present at every window size, none visible to a unit test and all obvious in a window. This is the same argument as the guard-coverage test in §5.49: a class of mistake that review keeps missing wants a machine, not more care. |

| 2026-09-09 | Each fact on the canvas is shown by exactly one piece of chrome. | The object count was on screen three times and the zoom three times, because each piece was added by somebody looking at that piece rather than at the screen. Choosing an owner for each fact — the control you can press owns the number it changes — is a rule that keeps working as more chrome arrives. |
| 2026-09-09 | The search bar rests as a pill and opens on ⌘K. | It held 720×53 of the middle of the board, permanently, while displaying the keyboard shortcut that makes it unnecessary. The documentation already said "press ⌘K"; the bar now matches the documentation rather than the other way round. |
| 2026-09-09 | The map overview starts folded away rather than open. | It was the largest permanently-open thing on the canvas for something you want occasionally and can otherwise get by zooming out. It is one press back from the tool rail, which shows it as off — a default, not a removal. Inventory and Selection stay open because they are the product rather than a convenience. |

| 2026-09-09 | Conformance is a separate idea from estate health, not a seventh health measure. | They answer different questions and a single number would blur both. Health asks whether an estate is in good shape by general standards; conformance asks whether it obeys the rules this organisation wrote for itself. An estate can be in poor health and perfectly conformant, or immaculate and conform to nothing — folding them together would make each less useful and neither actionable. |
| 2026-09-09 | Conformance reports two numbers instead of one. | A score over declared types alone would let a workspace that declares one type and obeys it claim 100% while describing 3% of its estate. Scoring the whole estate instead would punish an organisation for having a small deliberate model. The only honest answer is both numbers side by side, and a sentence saying which one is the problem. |
| 2026-09-09 | A breach names one object and links to it, rather than being counted. | "83% conformant" tells nobody what to do on Monday. The deliverable of a compliance check is the list, and the number is only there to be clicked through — which is the same argument that made estate health's measures fixable rather than scolding (§5.18). |
| 2026-09-09 | Nothing in conformance blocks a write. | The product's premise is that the model grows out of the work; a canvas that refused a card because a required field was empty would stop the drawing that produces the model. When the data and the declaration disagree, which one is wrong is a judgement, and the tool is not in a position to make it. |
| 2026-09-09 | Standard starter models are additive only — never rename, never delete, never touch an object. | It is what makes them safe to offer at any point in a workspace's life rather than only on day one, and it makes "apply" reversible in the only sense that matters: nothing you had is gone. It also makes applying twice a no-op without any bookkeeping about what was applied before. |
| 2026-09-09 | The apply summary is a plan computed against the live model, and recomputed server-side at write time. | Describing the standard would be true of an empty workspace and misleading in every other one. Computing the difference means the sentence is about *this* workspace; recomputing it at write time means a page left open for an hour cannot double-declare. |
| 2026-09-09 | The article in a generated sentence is chosen from how a type name is said, not how it is spelt. | Type names are the user's words and land mid-sentence in every breach. "is a Interface" in a compliance report is the sentence that makes a reader stop trusting the report, and two rules — a leading acronym is read letter by letter, a leading "u" is "yoo" — cover what an estate actually throws at it. |

| 2026-09-09 | A notation (C4, UML) and an operating model (IT4IT, SAFe) are the same kind of thing as a starter type library, and all of them are "frameworks". | They are all answers to "how does this organisation describe things", they all reduce to types, fields, relation types and rules, and treating them separately would mean two panels, two data models and two vocabularies for one idea. Ardoq's framing — a notation is a metamodel you adopt, not a feature of the drawing tool — is the one that makes the product simpler rather than larger. |
| 2026-09-09 | A workspace adopts frameworks (plural), recorded in a table, rather than choosing one. | Real organisations use several at once and mean it: the software in C4, the domain in DDD, the funding in SAFe. A single choice would force a false decision, and a boolean on the workspace could not carry when it was taken up or by whom. |
| 2026-09-09 | A type carries the framework that declared it, and a type that already existed keeps its own provenance. | It answers "who said this was a thing here" a year later, which is the question that makes a model defensible. And a framework must not be able to claim a type the organisation invented for itself just because the names collide — provenance is a fact about history, not a land grab. |
| 2026-09-09 | Stopping a framework deletes the adoption and nothing else. | By the time somebody changes their mind the types it brought may hold hundreds of objects. Deleting them would make an editorial decision destructive, which is the opposite of the additive contract that makes adopting safe in the first place. |
| 2026-09-09 | Levels group *types*, never instances. | The business capability model's "levels" were the depth of a capability in a map — a property of the instance, already carried by its `level` field. Two different ideas wearing one word; the catalogue test caught it. A framework level is C4's Container or SAFe's Portfolio: a band the types themselves live in. |
| 2026-09-09 | MBSE's `verification method` is a closed vocabulary but not required. | Requiring it is true to the discipline and wrong for the tool: no imported requirements register carries it, so every requirement would arrive non-conformant and the conformance report would be red on arrival — which is how a metric teaches people to ignore it (§5.56). |
| 2026-09-09 | The rules a starter template must obey are unit tests over the catalogue, not review. | Nine templates is already more than anybody checks by eye, and two of them broke a rule on the first run. Grounding, no dangling rules, every type levelled, every enum given a vocabulary, no more than two required fields: each is mechanical, and each is exactly what gets skipped when a tenth framework is added in a hurry. |

| 2026-09-09 | A framework's "levels" and a workspace's "layers" are one concept, so §5.57's levels became rows in the new `layers` table. | They were the same idea a week apart: C4's four zoom levels and ArchiMate's four bands are both an ordered grouping of types. Keeping both would have meant a type carrying two kinds of position, and the first person to ask which one the diagram used would have found the answer was "it depends". |
| 2026-09-09 | The layering an agent proposes is derived from the direction of observed connections, never from type names. | It is the one place where §2.2 — the organisation's data describes its meta-model — can be meant completely literally, because dependency direction is already in the graph and nothing has to be guessed. A layering derived from names would be a lookup table with an agent's name on it. |
| 2026-09-09 | A conventional layer name is accepted all-or-nothing, top to bottom. | Dropping only the name that contradicts the order leaves a stack that still reads as the conventional one and is not, which is worse than having no familiar names at all. Either the reading confirms the convention throughout — in which case the familiar words are evidence — or every band is named after its own largest type. |
| 2026-09-09 | Accepting an inferred layering declares the kinds it places. | A kind that only grew from the data has no row to carry a `layer_id`, so placing it means declaring it. Hiding that would make one button do two things silently; saying it makes it the honest consequence of accepting a layering, and it is additive either way. |
| 2026-09-09 | Deleting a layer unplaces its types rather than deleting them. | A layer is an opinion about the model, and withdrawing an opinion must not delete the things it was about — the same rule as abandoning a framework (§5.57). The foreign key does it with `on delete set null`. |
| 2026-09-09 | The type diagram takes its vertical position from the layer and only its horizontal from the force simulation. | A layered model's whole claim is that dependencies run downward, and a scatter cannot show that claim being kept or broken. Once the bands are drawn, an upward edge is visible as an upward edge without anybody reading a list. |

| 2026-09-10 | A flyout is not a panel, and stopped being a `PanelName`. | A panel persists, is toggled from more than one place and has a position of its own; a flyout belongs to one button, closes when you look away and nothing else has an opinion about it. Modelling the shape picker as a panel is exactly how it came to be pinned at an absolute `top: 250px` with no relationship to the button that opened it. |
| 2026-09-10 | A flyout button arms its remembered choice as well as opening the menu. | The two readings of a split button are both right, and doing only one of them makes the other person click twice. Opening the menu costs the person who wanted the remembered choice nothing, because they are already on their way to the canvas. |
| 2026-09-10 | The card kind is armed before placing rather than edited after. | Placing an interface meant placing an Application and retyping it: two steps for a decision that was already made. The kind is what the graph indexes the object under, so getting it right at birth is worth a menu. |
| 2026-09-10 | The rail's contents are data in `toolbar.ts`, with catalogue tests. | Two buttons on one letter, a flyout offering a tool the keyboard cannot reach, a rail advertising a shortcut the key handler does not honour — all mechanical, all invisible in review, and all things a rail accumulates as it is added to. The shortcut map is re-typed in the test on purpose: importing it would make the test agree with itself. |
| 2026-09-10 | Three icons are drawn rather than taken from the icon set. | A 3D cube for an architecture card and a paragraph-heading mark for a section describe the wrong thing, which is worse than a plain square. Where the stock set has no glyph for a domain object, drawing one is cheaper than teaching people to ignore the icon. |

| 2026-09-10 | A wiki page references the model rather than quoting it. | It is the whole reason to have a wiki *inside* the modelling tool rather than beside it in Confluence. A copy is true on the day it is written; a reference cannot go stale. It also means the expensive half of a page — the drawing — is free to maintain. |
| 2026-09-10 | The board write-up is deterministic rather than model-written. | It works with no provider configured and gives the same answer twice, which matches every other first rung in this product. And a model asked to describe a board produces prose that is true today and wrong next month — the exact failure the section exists to avoid. A model improving prose later is additive; a model *being* the feature is not. |
| 2026-09-10 | The markdown parser is written rather than installed. | The output is a typed tree React renders as elements, so the one surface where people paste out of Word has no HTML-string path at all. A library would also not understand the two things this wiki is actually for — embed directives and wiki links — so most of the work would remain either way. |
| 2026-09-10 | A kind with more than six objects is embedded as a query, not tabulated. | A table of six is read; a table of forty is scrolled past, and it is also the part that goes stale fastest. The threshold is a named constant rather than a judgement made once. |
| 2026-09-10 | An embed whose target is gone says so in the page. | Silence is the failure mode being designed out. A missing diagram that announces itself gets fixed; one that vanishes leaves a page that reads as complete and is not. |
| 2026-09-10 | Renaming a page keeps its slug; deleting one re-parents its children. | A wiki's addresses are the half of it people share, and a rename that breaks every link is a rename nobody dares perform. Losing a subtree because somebody tidied its parent is not a trade any writer would accept. |

| 2026-09-10 | The first real account comes from environment variables, checked on every start. | A product with no self-signup has to answer "how does the first person get in", and the honest answer for a self-hosted tool is the deployment's own configuration — the one place the operator already controls and nobody else can reach. Checking on every start rather than only on an empty database is the whole point: the case that strands somebody is a database that was seeded months ago. |
| 2026-09-10 | The bootstrap will not reset an existing password without a second, explicit variable. | A value left behind in a deployment's configuration would otherwise silently undo every password change anybody made, on every restart, with no trace. Requiring `NEXUS_OWNER_PASSWORD_RESET=1` makes resetting an act rather than a side effect. |
| 2026-09-10 | The operator path accepts eight characters where the People page asks for ten. | They are different acts. Ten is a floor under a password one person is choosing *for somebody else*; this is somebody choosing their own, in their own deployment, where refusing it means nobody can sign in at all. The in-app rule is unchanged, and the difference is written down rather than hidden. |
| 2026-09-10 | An EA repository is a *door* into the existing import pipeline, not an importer of its own. | The tempting shape is a LeanIX screen with its own review, matching and conflict rules; three months later there are two pipelines and the newer one has none of the older one's lessons in it. Translating a workspace into `BatchFile[]` is 120 lines and everything after it — mapping, matching, the board, approval, rollback — is already built and already tested. |
| 2026-09-10 | A source that states its own schema is `declared`, and the column guesser leaves it alone. | The mapper exists because a CSV says nothing about itself. An API is the opposite case: letting regexes overwrite what LeanIX stated turns known facts back into inferences, and quietly drops every relation, because relation headers are the source's own names rather than the English the regexes match. |
| 2026-09-10 | One staged file per fact sheet type, not one file for the workspace. | The pipeline reasons per file — a file has a kind — and Applications and IT Components are not one kind. It is also the difference between a review that says "342 Applications, 88 IT Components" and one that shows a pile of 430. |
| 2026-09-10 | Where the repository is reached is a server-side environment variable, never a browser input. | An enterprise gateway in front of the API is a real deployment, and the same override is what lets the e2e exercise the real client. But a caller who can choose the endpoint can choose where the token goes, so the endpoint is the operator's to set and the token is all the page sends. |
| 2026-09-10 | A failed read keeps the host and the token that were typed. | The common failure is a mistyped host, and clearing the field on failure charges the person a second trip to LeanIX's admin page for somebody else's mistake. It is cleared on success, where it has done its one job. |
| 2026-09-10 | The platform operator is a role on the *account*, not a value of `workspace_members.role`. | Every question the console asks — how many tenants are there, who has an account, whose password needs setting — takes no workspace, so no workspace role can answer it. Folding it in would mean a fake workspace to ask about or a capability that ignores its argument, and would make the workspace matrix a worse description of itself. |
| 2026-09-10 | The console answers 404 to everybody who is not an operator, not 403. | The same rule §5.48 applied to workspaces: "this exists and you cannot see it" is itself something a URL should not teach. A refusal would confirm to a curious member that a platform console is there to be attacked. |
| 2026-09-10 | A tenant's "last activity" is its newest board save, not the newest row of anything. | A board is the thing somebody has to open and change by hand. Counting agent runs, scheduled imports or session rows would let an abandoned tenant look busy, which is exactly the signal the list exists to give. |
| 2026-09-10 | Deleting a tenant or an account requires typing its address back. | Not friction for its own sake: the operator is the one person who cannot see inside a tenant, and a confirm button is clicked without reading. Retyping is the step that makes them read which one they are on. |
| 2026-09-10 | Creating a tenant names its first owner explicitly; the operator does not join it. | Being able to administer a customer is not the same as being in their workspace. Silently adding yourself to every tenant you create is the kind of surprise that makes an operator stop trusting the tool. |
| 2026-09-10 | Deleting a person removes their access and memberships, never their work. | Boards, versions, comments and change sets name whoever made them, and those references are `set null` rather than cascading. The record of what happened to an organisation's architecture is not the departing person's to take with them. |
| 2026-09-10 | The guard-coverage test asserts the console uses `denyOperator` and never the workspace `deny`. | A workspace check inside a platform action would pass the generic "is it guarded" scan while refusing the very person the console exists for — an operator acting on a tenant they are not a member of has no role there to check. The failure would look like a permissions bug, not a missing guard. |
| 2026-09-10 | The sidebar is grouped by how often something is used, not by what kind of thing it is. | Frequency is the axis a person actually navigates on. Models, Connections and People are each perfectly good screens and each was visited monthly; between them they took four of nineteen slots from the work somebody opens the tool to do. |
| 2026-09-10 | Settings is one rail entry that redirects to its first page, not a landing page. | A landing page whose only content is the navigation already visible beside it charges a click for nothing. The redirect means "Settings" lands somewhere useful and the nav does the choosing from there. |
| 2026-09-10 | The sidebar's structure is data with a test over it, not JSX. | It reached nineteen entries because nothing said it could not, and each addition looked reasonable on its own. A rule — at most fourteen, nothing administrative, nothing in two groups — is the only thing that survives twenty more revisions of well-meaning additions. |
| 2026-09-10 | The platform console appears in the settings nav under "Above this workspace", never as a peer of the workspace's own settings. | An operator opens settings from inside one tenant. Listing the deployment's console flush with that tenant's People page invites exactly the confusion that ends with somebody administering the wrong thing. |
| 2026-09-10 | The meta-model is cards, not a tree. | A tree is navigation, and five to thirty types do not need navigating. What they need is comparing, and a card can carry state — declared, size, what it needs — where a row can only carry a name. |
| 2026-09-10 | A card shows one nudge, never a list of everything wrong with it. | A card enumerating four problems is a report, and nobody works from a report. Naming the single next action turns the page into a worklist, which is what a meta-model in this state actually is. |
| 2026-09-10 | A nudge every card in a band shares is hoisted into the band heading. | Eighteen copies of a good prompt is wallpaper. Repetition destroys the thing that makes a prompt work, which is that it stands out. |
| 2026-09-10 | Conformance renders as "—" when nothing is described, not as 100%. | There are no conforming instances and no breaking ones, so the ratio is undefined. A full green bar beside "0% described" is the page telling its most flattering possible lie. |
| 2026-09-10 | An undeclared kind is not counted as a breach, matching `conformance()` exactly. | Coverage already says a type is undeclared; counting it again as a broken rule double-counts, and produced a verdict that contradicted itself inside one sentence. Two definitions of "breach" on one screen is how two numbers stop agreeing. |
| 2026-09-10 | Layers became a grouping of the board rather than a tab. | Banding the model by its layers *is* looking at the layers. A tab that shows the same types again in a different arrangement is a second screen maintaining a second copy of the first one's ideas. |
| 2026-09-10 | The inspector appears on selection and takes its space back when nothing is selected. | A permanent right-hand panel whose empty state reads "select a type on the left" spends a third of the screen saying nothing, on the view where the remaining two thirds are what you came for. |
| 2026-09-10 | The unit of the meta-model's relationship half is the triple, not the relationship type. | Borrowed from Ardoq. "An Application uses an IT Component" is a statement somebody can agree with; "uses" is not. Nexus already computed the triples and buried them one relationship type at a time, where the shape of the rules could not be seen. |
| 2026-09-10 | A pairing the data does and nobody declared is shown as a proposal, not a violation. | This is where we differ from every tool in the category, and it is §2.2 at the grain of one statement: the organisation's data is telling you what its meta-model is. Promoting it is one click; scolding somebody for it would be scolding them for having an estate. |
| 2026-09-10 | Rule coverage is a share of connections, never of rows. | One undeclared triple carrying four hundred connections matters more than nine carrying one each. Counting rows reports the opposite and calls the model nearly finished. |
| 2026-09-10 | Promoting a triple is refused while its relationship type is undeclared, with the reason. | A rule constrains a type; an undeclared type has nothing to hang one on. It is an order of operations, not a technicality — you cannot constrain a word the model has not agreed is a word — and saying so beats a button that fails. |
| 2026-09-10 | Nexus still blocks nothing, where Ardoq offers Guided and Strict enforcement. | A connection the model disallows is still real, and the honest response is to show it rather than refuse it. If enforcement is added it owes the reader the number Ardoq's does not: how many existing connections a rule would put in breach, computed before the switch is thrown. §5.56 already knows it. |

| 2026-09-10 | The graph explorer opens on **one entity**, not on the whole graph | Overview-first is the wrong default for a graph: you always arrive with something in mind, and a force-directed cloud of the whole estate is simultaneously the hardest picture to read and the least likely to be the one you wanted. Focus opens on the most connected entity, which is the least arbitrary opening move. §5.68 |
| 2026-09-10 | The focus view is **SVG with no camera**; the map stays canvas | Below the sixty-node ceiling of a bounded neighbourhood the DOM wins on every axis: kerned text, hit-testing, tooltips, the app's stylesheet, and assertions an e2e test can make. Canvas is only worth its hand-written label metrics and hit-testing at the map's 1 500-node cap. Computing the viewBox from the layout removes pan, zoom and "Fit" entirely — the view cannot be lost. §5.68 |
| 2026-09-10 | **Radius is hop count**, and rings grow until nothing overlaps | A force layout places nodes by an accident of physics; a radial one places them by distance from the thing you asked about, which is the fact you came for. Growing the ring to give each node a minimum arc makes overlap impossible by construction rather than by tuning. §5.68 |
| 2026-09-10 | Entities connected to nothing are **listed, not drawn** | Repulsion spreads unconnected nodes evenly across the canvas, where they became most of the picture on the demo workspace (11 of 28) and read as structure while being its absence. A list can also say what they usually mean — imported and never modelled. §5.68 |
| 2026-09-10 | A label that would overlap is **dropped**, never overprinted | Two names printed on top of each other read as one name that does not exist ("CustomerCRMCloud"). A missing label is honest; an invented one is not. §5.68 |
| 2026-09-10 | Separately-connected clusters are **packed once the layout settles, and then the simulation stops** | A force simulation has no attraction between components, so clusters sharing no edge repel each other forever and "fit" frames mostly emptiness. Continuing to tick after packing would shove them apart again in front of the reader. §5.68 |
| 2026-09-10 | Selection **emphasises**; only a question **dims** | The old map dimmed everything but the selection to 16% — in the one view whose entire job is showing the whole estate. A blast radius or a traced route is a question and may dim; clicking something is not. §5.68 |
| 2026-09-10 | Paths returns **every** shortest route, capped | Returning one implies it is *the* one. "These two are connected through the ESB" and "connected three ways, one of which is the ESB" are different findings, and the second is the one that matters when somebody is about to retire the ESB. §5.68 |

| 2026-09-10 | An empty query result is **diagnosed**, never reported as "no results" | "No results" is a statement about the query; the interesting fact is almost always about the model — nobody has recorded this, or that word is not in this estate's vocabulary. Same claim as §2.2, at the grain of a question. Taken from LeanFlow Studio. §5.69 |
| 2026-09-10 | A suggested question that would **return nothing is not shown** | Four dead-end suggestions are worse than none: they look like help and fail four times. The first version offered the workspace's busiest relationship types regardless of the seed, and every one came back zero. Every pivot now carries its count, and zero-count pivots are dropped. §5.69 |
| 2026-09-10 | The query matcher became **pure**, and `runQuery` now always loads relations | Diagnosing an empty result means re-running the match with one clause removed, which is trivial against a pure function over loaded data and impossible against one that also does the loading. Skipping the relations read unless the query mentioned one was a sound optimisation for answering and fatal for explaining. §5.69 |
| 2026-09-10 | Pinning an evidence gap waits for the annotation layer | LeanFlow lets a gap become a follow-up note that survives onto a board and into exports. It needs somewhere to live, and #114's typed annotation layer is where it belongs; private storage built here would only be torn out. §5.69 |

| 2026-09-10 | Containment is a **column**, not a relation kind called "contains" | Two things follow from *part of* that no ordinary relation gives: counts roll up through it, and one parent means the structure is a tree that can be walked, indented and summed. A "contains" edge permits two parents and permits a ring. §5.70 |
| 2026-09-10 | **No database cascade** on `parent_id`; children are lifted to the grandparent | Deleting a capability must remove the level, not the estate underneath it. A cascade would be silent data loss nobody notices for a week. The rule lives in the action, where it is readable and testable. §5.70 |
| 2026-09-10 | An item whose parent is **outside the current filter is a root**, not dropped | A filtered tree that loses those children under-reports while looking perfectly correct — the failure nobody notices. §5.70 |
| 2026-09-10 | Move candidates carry their **full path** | Three entities called "Asset Register" is ordinary in a real estate; a flat list of identical names cannot be chosen from. The same lesson as rev 102's explorer rail, applied to a `<select>`. §5.70 |

| 2026-09-10 | A **Key Result is a type**, not a field on the Objective | An aim is measured several ways, the measures change while the aim does not, and a measure has a target and a current value of its own. A text field cannot carry any of that, and folding it in is how "how would we know" stops being answered. §5.71 |
| 2026-09-10 | Strategy is its **own family**, after the portfolio models | The catalogue's ordering is a reading order — how you draw a system, how you decompose the problem, how the organisation is run, the estate itself, and finally what the estate is for. Objectives are not a portfolio model, and filing them as one would make the family label a lie. §5.71 |

| 2026-09-10 | A type is a **destination**, not a filter chip | "The application portfolio" should be a place you go, with an address you can send somebody, rather than a filter somebody has to remember to apply. Taken from LeanIX, which gets this right. §5.72 |
| 2026-09-10 | **"not set" is a facet value** | *Which applications have no owner* is the most useful question an inventory answers, and a rail listing only the values present hides it. §2.2 again: an absence is a finding, not a blank. §5.72 |
| 2026-09-10 | A facet counts against the **other** facets, never itself | Otherwise choosing a value shows every sibling as zero: you can narrow but never switch, and the filter is a one-way door. The classic faceted-search bug. §5.72 |
| 2026-09-10 | A value edits as the **type the model declares** | Editing a declared enum as free text is exactly how "Active" and "active" both reach the column — and Nexus then needs a proposals system to clean up a mess it allowed. A model that declares a type and ignores it at the keystroke is decoration. §5.72 |
| 2026-09-10 | A disallowed value is **shown, never blanked**; any field can be cleared | The mismatch is a finding and discarding it destroys it. And requiredness is a statement about a finished record, not about a keystroke — a field you cannot empty is one that stays wrong. §5.72 |

| 2026-09-10 | The LeanIX query is **built from introspection**, not hard-coded | Every tenant configures its own metamodel, so a fixed field list is right for one workspace and wrong for the next. The old comment said exactly this; the old code asked for two generic relation fields that do not exist and lost every relation in a real workspace. §5.73 |
| 2026-09-10 | Every per-type selection is **aliased with its type** | GraphQL refuses a query selecting the same field name for two types that return different types, and LeanIX does this constantly. One alias rule sidesteps every such conflict at once. §5.73 |
| 2026-09-10 | Mirrored relations are **deduplicated, with a stable direction** | LeanIX returns each edge from both ends; 1,242 rows were 621 edges. Importing both would double every degree and every triple count. Sort order picks the survivor so a re-import is not a reversal, and an unrecognised inverse is kept rather than risk losing a real edge. §5.73 |
| 2026-09-10 | A stub that agrees with the query is not a test | Rev 97 passed against a stub built to match its own query, and failed on the first real workspace in three independent ways. The stub still earns its place for the plumbing; it cannot vouch for the schema. §5.73 |

| 2026-09-11 | A parent is a column role of its own, and containment is written only to `parent_id` — never also as a relation. | The graph already holds "inside" as a column, which is what ancestry, roll-up and the capability map read. Writing the same fact as an edge too would be two records to keep in step, and the first rename or re-import would put them out of step. |
| 2026-09-11 | An unresolvable parent is a question on the row, never a blocker. | The object is real whatever its parent turns out to be, and holding it back would lose the thing the import was for. Arriving at the top is what an unknown parent honestly means, and the review says so out loud rather than dropping the claim. |
| 2026-09-11 | A nested LeanIX fact sheet is named by its own name, not by the path LeanIX puts in `displayName`. | The path was the only way to say where something sat while every import landed flat. The tree says it now, and 236 names of the form "A / B / C" make a capability map unreadable and a search unusable. |
| 2026-09-11 | The work of an import lives outside the server action: `run.ts` takes a database and a user id, and the action is a guard, a call and a revalidation. | Staging and approving read the session, checked a capability and revalidated routes, so an estate could be imported only from a browser tab. An operator with a shell on the server — which is how a first import of four hundred objects actually happens — had no way in that was not a reimplementation, and a second implementation of "what an approved import writes" is the one thing that must not exist twice. |
| 2026-09-11 | The Capability map starter draws the whole estate from the graph, and falls back to the fixture only when there is nothing to draw. | A template that invents six capabilities teaches a new user that Nexus does not know their organisation. Drawing all of it is the point — a map that quietly showed the first twenty would be worse than none, because it would look right. |
| 2026-09-11 | An application appears once on the map, under the first capability it realises, with a note when it realises more. | Two cards carrying one entity id is a question the board's sync cannot answer: which one is the object? One card, and the truth about the rest in words. |
| 2026-09-11 | A frame may be the face of an object that already exists, and may only rename it. | Every parent capability on a map is a frame; as pure decoration they were missing from the board's index and unclickable. A frame carries no kind, so letting it create an object would mint untyped things — bind, rename, and nothing else. |
| 2026-09-11 | The production image is Next's standalone output, not the built workspace. | 836 MB of the 836 MB copied was devDependencies, sources and build artefacts that never serve a request, and the host pays to push and pull all of it on every deploy. Tracing knows what the server imports; a `COPY /app /app` does not. |
| 2026-09-11 | The runtime image has no package manager in it. | `node server.js` needs none, and every tool that is present in a production image is a tool somebody can run there. |
| 2026-09-11 | What must not ship is pruned in the build script, not only in `.dockerignore`. | A protection that lives in a different file from the thing it protects is a protection that goes missing the first time somebody builds the image another way. A development database in a deployed image is the failure that rule exists to prevent. |
| 2026-09-11 | The campaign surface is a queue, not a table with a dropdown per row. | Ninety applications is ninety decisions. A table is a screen people scroll and abandon; a queue that hands you the next object the moment you judge one is a thing people finish. |
| 2026-09-11 | A campaign is started from a template, never from an empty form. | Nobody should have to design a campaign from nothing, and the four templates are the four jobs the import actually created. An empty form is how a feature ends up used once. |
| 2026-09-11 | A validation is stamped to the object as it was, and lapses the moment the object changes. | A fact sheet validated in March and edited in June is not validated. Without this the burn-down only ever goes one way and the badge is furniture within a quarter — which is what every tool that shipped a boolean `reviewed` flag discovered. |
| 2026-09-11 | A waiver is refused without a reason and an expiry. | "Accepted as is", undated, is how a model rots: the exception outlives everyone who understood it. Making the expiry a write-time requirement means there is no way to create the rot. |
| 2026-09-11 | A campaign's scope is the objects list's own filter shape. | A scope has to stay true as objects arrive, so it must be a query. Reusing the filter people already use to find things by hand means no second query language, no second resolver, and no second set of tests. |
| 2026-09-11 | Untouched is the absence of a row, not a row saying "untouched". | A 455-object campaign would otherwise write 455 rows the moment it is created, most of which say nothing. Absent-means-untouched also makes clearing a decision a delete, which is honest. |
| 2026-09-11 | The tree is a canvas in the explorer's shell, not a diagram beside a list. | A branching model is understood by moving through it. The list version was a picture with rows next to it; the explorer is the surface the product already uses for "go and look at the shape of something", so revisions should be explored the same way the graph is. |
| 2026-09-11 | The camera opens at 1:1 on the newest commits, and fit is a button. | Framing a year of history in a wide stage shrinks every node to a thread and hides every label. An explorer should open somewhere legible and let you move; zoom-to-fit answers a different question, and it is one click away. |
| 2026-09-11 | Zoom limits are directional, not absolute. | An opening view can legitimately sit outside the readable range, and an absolute guard then refuses every zoom and locks the camera where it started. Allowing any zoom that moves towards the range means you can always get back. |
| 2026-09-11 | A commit on main is a folded moment, not a single event. | The history already folds by hand, place and two minutes. Three fields renamed on one object at one sitting is one commit in any repository; drawing three would make the trunk unreadable and the shape untrue. |
| 2026-09-11 | A branch is drawn as cut from the state of main it was written against, not from the tip. | Drawing every branch from the tip would make every plan look like it was written today. Change sets carry no base commit yet, so creation time is the honest approximation — and naming it as an approximation is what #138 would make exact. |
| 2026-09-11 | Each ref keeps its own lane for the whole drawing. | Reusing a column when a branch ends is how git graphs save space and how readers lose the thread. With tens of change sets rather than thousands of commits, clarity costs nothing. |
| 2026-09-11 | A merge is gated on what a change *adds*, not on whether the model is clean. | 52 undeclared types means a clean-slate gate is red forever, and a gate everybody fails is a gate everybody turns off. "Does this make it worse" is answerable and fair. |
| 2026-09-11 | Checks are split into blocking and advisory. | Two applications sharing a name is worth saying and not worth stopping a merge for. A gate that cannot tell an opinion from a defect gets switched off wholesale. |
| 2026-09-11 | The checks are pure over a snapshot, with the database work in a separate module. | The same code has to run against main, against a change set's projection and later against a campaign's scope. Two implementations of "conformant" is the one thing that must not exist twice. |
| 2026-09-11 | An object with children but no relations is not an orphan. | Containment is attachment. A capability with eleven applications inside it is not adrift, and a check that says it is teaches people to ignore the check. |
| 2026-09-11 | Checks get no rail entry; the way in is the ref menu. | The rail is capped at fourteen and ordered by frequency. Checks are read when something is about to land — which is when somebody has the ref menu open. |
| 2026-09-11 | Which change set you are on is a checkout — a row per person per workspace — not a per-board toggle. | Two architects being on two different plans at once is the point of having plans. A board that carried the ref would let whoever opened it last decide for everybody, and a toggle would forget on the next navigation. |
| 2026-09-11 | Divergence is counted by object, not by change row. | Two edits to one application are one changed application. Counting rows makes a plan that renames one system look bigger than one that retires four, which is exactly backwards. |
| 2026-09-11 | A checkout pointing at a closed change set resolves to main on read, and the row is not rewritten. | Delivered is history, abandoned is a decision, and neither is a place to work. Repairing it during a read would be a write on a page load; putting them back is the next thing they do. |
| 2026-09-11 | Opening a board while on a change set draws the board through it, once, on arrival. | The rail saying "you are on the SAP plan" while the picture shows as-is is the exact confusion the checkout exists to remove. Applying it once rather than continuously leaves the viewpoint panel in charge afterwards, so a deliberate switch to as-is is not undone by the chrome. |
| 2026-09-11 | Switching ref is not guarded by `graph.edit`. | Standing somewhere is not changing it. A viewer entitled to read the estate is entitled to see a plan from the inside; what they may *do* there is decided at the write, where it always is. |
| 2026-09-11 | An object is called an object, not a fact sheet. | "Fact sheet" is LeanIX's term; it came in with the import rather than being chosen, and a product that speaks a competitor's language teaches its users a word they will have to unlearn. The product's own copy already said "objects". |
| 2026-09-11 | The rename stops at the vocabulary: the URL, the identifiers and the search keywords keep the old word. | A URL is a link somebody has already sent, an identifier is a diff nobody reads, and a search keyword is how a LeanIX refugee finds the page. None of the three is vocabulary. |
| 2026-09-11 | The mark is a flat-cut geometric N — a monogram, not a picture of the graph. | Two marks were tried and both said the wrong thing to the audience that matters: a share glyph says "send this to somebody", and an N of dots and edges is clever about the product and reads as playful. This is shown to steering committees beside a utility's own logo, and restraint is what earns a place there. |
| 2026-09-11 | The repository's filters are a rail on the left, not chips above the table. | Twelve types already overflowed the chip row, and the cross-cutting questions — orphaned, top level, undeclared — have nowhere to go in a row of type chips. A rail has room, it is where people look for a filter, and it is the shape the type inventory already uses. |
| 2026-09-11 | A facet counts against every other facet's selection and never against its own. | Otherwise choosing a type shows every other type as zero and the filter is a one-way door: you can narrow but never switch. The same rule the type inventory learned, applied to the cross-cutting questions. |
| 2026-09-11 | A filter that would empty the list is shown disabled rather than hidden. | Zero is an answer — *nothing here is undeclared* is worth knowing — and a rail whose rows appear and disappear cannot be learned or clicked from memory. |
| 2026-09-11 | The repository is one flat searchable list, not a tree or a board. | It answers "where is that thing". A tree makes you know the shape before you can look, and a board makes you pan. 490 rows and a search box is faster than either, and the per-type inventory is one click away for the questions that need facets. |
| 2026-09-11 | Adding the objects list to the rail pushed EA knowledge out of it, rather than raising the cap. | The rail is capped at fourteen because past about a dozen a list stops being scanned and starts being searched. The honest axis is frequency: the repository is daily, the knowledge library is monthly, so it moves to the foot of the rail beside Documentation. |
| 2026-09-11 | Editing a fact sheet has no save button: the value is the field, written on blur. | The canvas has always worked this way and nobody misses a save button there. What makes it safe is not a button but a history entry with a name on it, a quiet "saved", and an undo for the seconds that matter. |
| 2026-09-11 | A field's section is declared on the type, never guessed from its key. | A heuristic that files `lxCostCentre` under Lifecycle is wrong often enough to discredit every other heading on the page. Undeclared keys go in one group that says what it is. |
| 2026-09-11 | The drawer stays, but only on the canvas. | Leaving a board to read an object costs you your place; leaving a list does not. One surface where it earns its keep, and a link to the page for everything it cannot show. |
| 2026-09-11 | A fact sheet opens as a window over the page you were on, not as a navigation away from it. | A page throws the list away — the filters, the search, the scroll — and the back button has to rebuild it. Intercepting the route keeps the list mounted underneath while the address still changes, so the sheet is linkable *and* free to leave. |
| 2026-09-11 | The window covers everything right of the menu and nothing of it. | Where people go after reading an object is usually somewhere else in the product, not back where they came from. A modal that hides the rail makes the common case two clicks and adds a dismissal nobody asked for. |
| 2026-09-11 | The window stands inside the content area over a scrim, rather than filling it edge to edge. | A window that covers everything is a page with a close button. Seeing the list you came from around its edges is what tells you the list is still there — and the margin becomes a fourth way out, which is the gesture people try first. |
| 2026-09-11 | The window is positioned against the shell, not placed in its grid. | A grid item with an explicit cell is laid out before the auto-placed ones, so a window in column 2 pushed the page itself onto a second row — the first cut of this shipped a sidebar cut off halfway down. |

| 2026-09-11 | Moving something in the hierarchy is its own change op, not a relation. | Containment is a column, not an edge (§5.70), so there was nothing to add. Writing it as both a column and an edge would be two facts to keep in step, which is the bug this model was shaped to avoid. |
| 2026-09-11 | A move to the top level is written as an empty parent, not as a missing change. | "Take this out of where it is" is one of the two moves people make. Treating it as an absence would make it unplannable. |
| 2026-09-11 | A move that would close a ring becomes a stale-change problem rather than being skipped. | A skipped move is a plan that silently does less than it says. A problem is visible, it is what the delivery gate already refuses on, and the person gets to decide which of the two moves they meant. |
| 2026-09-11 | A move counts as a changed object in the divergence indicator, not as a fifth number. | Moving something is a change to it in every sense the indicator is asked about, and an import that reparents 236 capabilities would otherwise show a number with no word for it. |

| 2026-09-11 | Delivery runs the checks and refuses on new blocking findings. | A suite nothing consults is a dashboard. The merge is the one moment where the answer changes what happens, and it is the moment a reviewer is already paying attention. |
| 2026-09-11 | Only findings the ref adds count, and only the blocking ones stop it. | An estate has hundreds of standing findings that no single plan is answerable for; refusing on those would mean nothing could ever be delivered. Advisory findings are reported at the merge and never block. |
| 2026-09-11 | The gate can be overruled, and the override sits under the reasons rather than beside the button. | A gate nobody can open gets routed around — people edit the graph directly, which is what the branch existed to prevent. Making the override real and making it require reading the refusal first is the honest trade. |
| 2026-09-11 | The refusal names three objects and links to them, rather than reporting a count. | "2 new blocking findings" tells somebody they are stuck. Naming the two relations tells them what to do next, which is the only difference between a gate and a wall. |

| 2026-09-11 | What an import does is a pure plan; writing it to the graph or to a branch are two executors over that one plan. | Two destinations written as two loops disagree within a month, and the disagreement shows up as an import that behaves differently depending on where it lands. One judgement, two mechanical writers. |
| 2026-09-11 | An import does not always get a branch: landing on one is the primary button, writing straight through the secondary. | A 455-object EA repository is somebody else's claim and needs reviewing. A forty-row correction to objects you already own is a routine update, and making it a review round teaches people to avoid the import. |
| 2026-09-11 | A landed batch has no rollback and no delete; abandoning the branch is the undo. | There is nothing to undo — the estate never moved. Keeping a rollback button that did nothing would be the product lying about what happened. |
| 2026-09-11 | Merging a landed import is the same `deliverChangeSet` as any other merge, gate included. | An import is the largest change anybody makes to the model, so it should take the least privileged path in, not a private one. It also means the gate cannot be forgotten on the path that needs it most. |
| 2026-09-11 | The batch's branch pointer is not a foreign key, and is resolved on read. | A deleted change set should leave the batch saying where its work went, rather than silently forgetting. The read decides what to show; the column only remembers. |

| 2026-09-11 | The Dockerfile's cache-mount ids carry Railway's `s/<service id>` prefix, hardcoded. | Railway refuses the Dockerfile outright without it, and had done so for every deploy for five hours. An id is only a cache namespace, so the prefix costs nothing anywhere else — and a portable-looking Dockerfile that does not deploy is not portable, it is broken. |

| 2026-09-11 | Where a claim goes is computed from what it is, not chosen by a person per batch. | The destination follows from the claim — new, or a routine update from the field's owner. Asking somebody four hundred times produces four hundred careless answers, and the button was never the interesting part. |
| 2026-09-11 | Routine updates from a field's owner land without review, deliberately. | It is the half of the model people get wrong. Route everything through a queue and the queue becomes a rubber stamp, after which nothing is reviewed — including the things that needed it. |
| 2026-09-11 | A retype and a move are withheld from a source even when it owns every field. | What something *is*, and where it sits, are modelling decisions rather than values. The exception is a source that *is* the tree — a capability map from an EA repository — which is given the hierarchy explicitly. |
| 2026-09-11 | A source with no declared standing owns nothing. | The safe default. A pasted block has no authority until a person gives it some, and a default of "trusted" is one nobody would ever go back and tighten. |

## 8. Open questions for the product owner

- Which catalogue entry should be built first for real (ServiceNow CMDB? Entra ID app
  registrations? SAP PM)? The scope trees are modelled; the fetching is not.
- Should a granted scope also carry a schedule (read once, nightly, on demand), or is that a
  property of the connection rather than the grant?
- Should optics be user-authored (query + layout), agent-suggested, or both?
- Real-time collaboration: how early is it needed relative to ingestion and agents?
- Sovereign deployment: the endpoint side is settled (§5.31 — anything speaking either dialect,
  no key required). Open: does a sovereign deployment also need the EA knowledge corpus embedded
  locally, and which local model is good enough for intake's long documents?

## 9. Changelog


- **2026-09-11 — Rev 135: everything arrives as a claim (#139, first slice).** The two rules that
  decide where data goes, as a pure function over the import plan: anything new lands on a
  branch, and a known object's new values flow straight through when the source owns that field.
  Trust is per source and per field; a retype, a move and every connection stay out of a source's
  hands by default; a source with no declared standing owns nothing. The split reports itself in
  one sentence — "312 routine updates land; 143 claims wait on a branch" — and counts the
  validated values it would overwrite before it overwrites them. Sixteen tests. Brief §5.90, four
  decision rows. Next: hanging this on the connection record so it is durable, then a branch per
  source and drift as a pull request.

- **2026-09-11 — Rev 134: the deploy has been broken since rev 119, and this is why.** The
  BuildKit cache mounts added to speed the build up (§5.80) used bare ids, and Railway's builder
  rejects a Dockerfile whose cache-mount id has no `s/<service id>` prefix — *before* it builds
  anything. So every deploy from 12:51 on 11 September failed at "unpacking archive" with an
  invalid Dockerfile, the site stayed on the 11:26 image, and revs 122 to 133 never reached it.
  The build was green everywhere else, which is exactly what made it invisible: the gates run the
  tests, not the deploy. Ids are prefixed now. Decision row added; the lesson is that a build
  which passes locally says nothing about a platform that parses the Dockerfile with its own
  rules, and a deploy is not done until the deployment says SUCCESS.

- **2026-09-11 — Rev 133: an import lands on a branch (#137).** The epic's point, on the old
  storage: approving an import can now write a change set of its own instead of the estate. Its
  creations, field changes, retypes, relations and reparents become commits on a branch; the
  checks run against it; merging is `deliverChangeSet` through the same gate as everything else,
  with the same refusal card. Undoing an import is now *don't merge*. What an import does became a
  pure plan (`planImport`) with two executors over it, so the graph and the branch cannot drift
  apart — ten tests hold that plan to what the old writer did. Landing is the primary button and
  writing straight through the secondary, because a forty-row correction is not a proposal. A
  landed batch has no rollback and no delete. Also fixed a duplicate-key warning the walk caught:
  presence merged a relayed peer the process already had, so two cursors were drawn for one
  person. Brief §5.89, five decision rows.

- **2026-09-11 — Rev 132: a plan can retype something (#137).** The seventh op, `retypeEntity`,
  and the last one the import needs before it can land on a branch: a re-read of a source that has
  since typed its rows properly is a retype of two hundred objects, and the kind is a column
  rather than an attribute because that is what the meta-model, the conformance checks and the
  layers read. Retyping with no type is refused rather than blanking the kind. The roadmap
  composer offers "Change what it is". Brief §5.87 extended, two tests.

- **2026-09-11 — Rev 131: the checks become a gate (#137).** Delivering a change set now runs the
  #136 suite against its projection and refuses when the merge would add blocking findings. Only
  what the ref adds counts, and only the blocking half of it stops anything — advisory findings
  are counted in the delivery message instead. The refusal names up to three of the objects, links
  to each and to the whole run, and offers *Deliver anyway* beneath them, because a gate nobody can
  open is a gate everybody routes around. The gate is a pure function with six tests; the walk
  asserts that pressing Deliver on a seeded plan refuses, says why, and leaves the estate where it
  was. Brief §5.88, four decision rows.

- **2026-09-11 — Rev 130: a plan can move something in the tree (#137).** First slice of "import
  lands on a change set": a change set can now hold `setParent`, the sixth op, because the import
  it has to carry does 236 reparents and containment is a column rather than a relation. An empty
  destination is the top level. The projection checks each move against the tree as the change set
  leaves it, so a ring becomes a visible stale-change problem — which delivery already refuses on —
  rather than a silently skipped line; delivery applies the moves, the roadmap composer offers
  "Move it inside something", and the check suite reads parents from the projection. Six tests.
  Brief §5.87, four decision rows.

- **2026-09-11 — Rev 129: the tree becomes an explorer.** The owner liked the drawing and not the
  container: he wanted a canvas he could always get to and move through, like the graph explorer.
  The tree now wears the explorer's shell — branches on the left, the drawing in the middle, the
  subject on the right — with drag to pan, scroll to zoom about the pointer, per-branch hiding,
  and a fit. It opens at 1:1 on the newest commits rather than zoomed out to everything, because
  framing a year of history hides every label. Labels moved under their nodes, since lanes are
  one label's width apart and a label to the right lands on the next branch. Four camera tests,
  one of them for a real bug the walk caught: absolute zoom limits locked the camera whenever the
  opening view sat outside the readable range. Brief §5.86, three decision rows.

- **2026-09-11 — Rev 128: campaigns, the surfaces (#134).** The queue: one object at a time, with
  what it is and where it sits, and four ways out — it is right, leave it for now (reason and
  expiry required), somebody has to answer (question required), I am still on it. A campaign list
  with a burn-down on each, and four templates to start from rather than an empty form. An
  object's own page now says where it stands in every campaign it is in scope for, including *it
  was validated, then edited* — which the walk checks end to end: validate an object, edit it,
  and watch it come back into the queue. Brief §5.85, two decision rows.

- **2026-09-11 — Rev 127: campaigns, the model and the rules (#134).** The data model and the
  state machine for remediation: a campaign with a query scope (the objects list's own filter
  shape), a definition of done taken from the checks (§5.83), and a per-object state — untouched,
  in review, needs a decision, validated, waived. The edge the whole thing stands on is
  implemented and tested: a validation records what the object looked like when it was given, and
  lapses the moment the object changes, so the burn-down goes up as well as down. A waiver is
  refused without a reason and an expiry; a campaign closes only when its scope is validated or
  explicitly waived. 13 new tests, one migration on both dialects, brief §5.85, four decision
  rows. The surfaces come next.

- **2026-09-11 — Rev 126: the tree (#133).** The owner asked to *see* the branches and commits and
  navigate them, and it was the gap that made the rest of #133 abstract. `/w/[slug]/tree` draws it:
  time down the page newest-first, `main` as lane 0, a lane per change set cut from the state of
  main it was written against and landing back when delivered, plateaus as tags. A trunk commit is
  a folded moment rather than a single event. Click a node to see what it carries and follow it
  into the objects; click a branch to stand on it, and the rail, the boards and the checks move
  with you. Two lies the first drawing told are fixed with it: a plateau dated 2028 read as "just
  now" (`whenWords` now describes the future, with five minutes of slack for clock skew), and a
  change set written in the same millisecond as its changes sorted its cut above them. 13 new
  tests, brief §5.84, three decision rows.

- **2026-09-11 — Rev 125a: the checks page reads in the order the reader needs.** Definition
  order put a 39-finding advisory check above the two blocking findings the verdict was actually
  about, and every finding was printed — several hundred of them on a real estate. Checks are now
  ordered blocking-failing, advisory-failing, passing, with the ones carrying new findings first,
  and each shows eight rows and a count.

- **2026-09-11 — Rev 125: the model's test suite (#136).** Conformance, relation rules, orphans
  and the cycle guard each already existed, in their own screens, in their own shapes, with no
  verdict. They are now one suite of seven checks with two severities, pure over a snapshot, plus
  a `/checks` page that runs it against the ref you are standing on. On `main` it lists what is
  failing; on a change set it is a verdict — what this proposal adds against main, what it
  repairs, and whether anything blocking is among them, because a clean-slate gate on a real
  estate is red forever. Every finding is a link to the object that failed it. 15 new tests,
  brief §5.83, five decision rows.

- **2026-09-11 — Rev 124a: the scrubber stops contradicting the board.** Applying the ref's
  overlay on arrival exposed an old assumption in the time scrubber: it derives its position from
  the overlay by looking the overlay up among its own stops, and an overlay it has no stop for
  fell through `Math.max(0, -1)` to index 0 — so it announced *the estate as it is* over a board
  visibly drawing a plan. It now says what is actually being shown. The walk checks that no piece
  of the canvas chrome contradicts another.

- **2026-09-11 — Rev 124: a board opens in the world you are standing in (#135).** The canvas has
  no rail, so the ref is a chip in the board's topbar — quiet on main, amber off it — and the
  board is drawn through the ref: the change set's overlay is applied on arrival, without anybody
  touching the viewpoint panel. Applied once and keyed on the ref alone, so a deliberate switch
  back to as-is is not undone. The ref is read on the server with the board, so the chip is right
  on the first paint. The overlay fetch that the viewpoint panel and the time scrubber each
  carried a copy of is now one function. Brief §5.82, one decision row.

- **2026-09-11 — Rev 123: which ref you are standing on (#135).** The first slice of #133. Change
  sets have existed since rev 40 with no way to be *in* one — you could look at a plan, and the
  next page showed you as-is again. There is now a checkout: one row per person per workspace,
  absent meaning `main`, and an indicator above the navigation that names the ref on every page.
  On main it says what main means; on a change set it turns amber and says how far it has moved,
  counted by object rather than by row. Only open change sets are somewhere you can stand, and a
  checkout pointing at a closed one resolves to main rather than stranding somebody in a world
  that has gone. 11 new tests, one migration, brief §5.82, four decision rows.

- **2026-09-11 — Rev 122: the backlog gets a shape.** Forty-six open issues with no structure
  beyond the order they were filed. Every one now sits under exactly one epic and in one lane:
  seven epics (#133 git under the model, #142 trust the data, #143 the meta-model in practice,
  #144 reading the model, #145 the canvas, #146 writing it down, #147 enterprise readiness) and
  five milestones that read as a roadmap — *Now · Trust what landed*, *Next · The model governs
  itself*, *Later · Read it, draw it, publish it*, *Enterprise readiness*, *Horizon · The
  versioned repository*. #110 (entity hierarchy) was closed: it shipped in revs 107, 111 and 112.
  Brief §6 rewritten around the epics so the tracker and the brief cannot drift apart quietly.

- **2026-09-11 — Rev 121: objects, not fact sheets.** "Fact sheet" is LeanIX's word; it came in
  with the import and settled into the rail, the page and the documentation without anybody
  choosing it. The rail now says **Objects** and an object has an **object page** — which is what
  the product's own copy already said, and what the database has always called them. The URL
  (`/fs/[id]`), the identifiers and the documentation's search keywords keep the old word on
  purpose: a link is already sent, a rename of identifiers is a diff nobody reads, and somebody
  arriving from LeanIX should still find the page by searching what they know. Brief §5.81, two
  decision rows.

- **2026-09-11 — Rev 120: the mark, again.** Rev 118 replaced a share glyph with an N built out
  of nodes and edges; the owner's verdict was that it reads as playful, and this product is put
  in front of steering committees. It is now a flat-cut geometric N — two stems, a diagonal,
  square apexes, even counters — chosen against four alternatives (a layer cake, a nine-cell grid
  N, a building-block frame, and the dot-and-edge N) each drawn at six sizes, on the tile, on
  white and reversed. The tab icon and the home-screen icon were redrawn from the same geometry.
  Brief §5.79, one decision row rewritten.

- **2026-09-11 — Rev 119: deploying a small change stops taking as long as a rewrite.** The build
  was never the problem — a cold Next build is 50 seconds. The image was: the runtime stage copied
  the whole built workspace, 836 MB of devDependencies, sources and build output, pushed and
  pulled on every deploy. It now copies Next's standalone tree and nothing else — 96 MB, on a base
  image with no package manager — with the static assets, `public`, the migration folders and the
  EA corpus added by a post-build script, and the development database, the e2e suite and the
  compiler's bookkeeping pruned out of it. Installing is a stage of its own over the manifests, and
  the pnpm store and Next's build cache are both BuildKit cache mounts. Verified by running the
  standalone server against a fresh database: migrations, seed, pages, assets and fonts all serve.
  Brief §5.80, three decision rows.

- **2026-09-11 — Rev 118: a mark of its own.** The logo was a three-node share glyph — the icon
  every collaboration tool uses for "send this to somebody". It is now an N drawn as a graph: four
  nodes at the corners, three edges between them, legible at sixteen pixels because nothing in it
  is thinner than two pixels of stroke on a 24 grid. One component for the three places in the
  product, plus `app/icon.svg` for the browser tab and a full-bleed `app/apple-icon.png` for the
  home screen, both picked up by convention. The walk now checks that the tab icon exists and can
  be fetched. Brief §5.79, one decision row.

- **2026-09-11 — Rev 117: the repository asks the other questions.** 478 objects made the flat
  list's limits obvious: the types had outgrown the chip row above the table, the cross-cutting
  questions had nowhere to live, and rows with no vertical padding read as one block of text. The
  page now has a filter rail on the left — type (multi-select, counted, undeclared marked), where
  it sits, connected or connected to nothing, on a board or not, declared or not — plus a sort by
  name, recency, connectedness, board use or type. Every facet counts against the *other* facets
  and never against itself, so the filter is not a one-way door, and a choice that would empty the
  list is disabled rather than hidden. The rows got their padding back. The logic is a pure module
  with eleven tests. Brief §5.78, three decision rows.

- **2026-09-11 — Rev 115: the fact sheet is a window, and it scrolls.** Two things were wrong with
  rev 114. A long sheet could not be scrolled: the workspace shell is a full-height grid and the
  sheet's column never said it scrolled, so the bottom of anything past one screen was
  unreachable. And opening an object was a navigation — three filters deep in the repository, one
  click to check an owner and the list was gone. The address is now intercepted by a parallel slot
  on the workspace layout (`@sheet/(.)fs/[entityId]`), so a click opens the sheet in a window over
  the page you were on, in the area right of the menu and nothing of it; the window stands inside
  that area over a light scrim, so the list it came from shows around its edges and the margin is
  itself a way out. The list underneath keeps its scroll and its filters, the address still
  changes, and the ×, Escape, the margin and the back button are the same gesture. Escape inside a
  field still belongs to the field. A cold load of the same address renders the standalone page,
  which now scrolls in its own column — as does the repository's own list, which had the same
  omission and four hundred unreachable rows. Brief §5.77, four decision rows.

- **2026-09-11 — Rev 114: one object, one page.** Every object now has an address —
  `/w/[slug]/fs/[id]` — with its attributes in the sections the type declares, what it is
  connected to, where it sits, its boards and its whole history. Editing is inline and there is no
  save button: click a value, change it, look away, it is written on blur, with a quiet "saved", an
  undo, and an entry in the history carrying the person's name. Declared fields show even when
  empty (a required blank is a finding); keys no field declares go in one *From the data* group
  rather than being filed by guesswork. Fields gained a `section` in the meta-model, set on the
  type. The lists — fact sheets and each type's inventory — now navigate to the page; the drawer
  stays on the canvas, where losing your place would cost something, and links to the page. 9 new
  tests, brief §5.77, three decision rows, one migration.

- **2026-09-11 — Rev 113: Fact sheets in the rail.** The per-type inventory had no way in but a
  chip on another page. There is now a **Fact sheets** entry in the rail and a page behind it
  holding every object in the workspace — types as counted chips, a search across name, type,
  description and parent, where each one sits, its relation and board counts, and the drawer on
  click, with each type's own faceted inventory one step further. EA knowledge moved to the foot
  of the rail beside Documentation to keep the rail at fourteen: the repository is daily, the
  library is monthly. Brief §5.76, two decision rows.

- **2026-09-11 — Rev 112: the capability map is of your estate.** The starter drew six invented
  capabilities for every workspace; it now builds the whole map from the graph — every capability,
  nested by containment, with the applications that realise them placed inside, frames measured
  from their contents rather than laid on a grid. One click on Energinet's estate gives 201
  capabilities in 44 frames and 174 cards, three levels deep. An application is drawn once, under
  the first capability it realises, with a note when it realises more; there are no connectors,
  because containment already says it. A frame can now be the face of an object that already
  exists — it binds and renames, never creates — which is what makes the parents on a map
  clickable, indexed and countable rather than labels. That exposed an older bug: seeded
  capabilities used ids like `cap_grid`, and the canvas only treats `ent_`-prefixed ids as
  objects, so ten seeded capabilities were drawn and then ignored by the board's index. 16 new
  tests, brief §5.75, three decision rows.

- **2026-09-11 — Rev 111a: the import has a terminal door.** Staging and approving moved out of
  the server actions into `src/lib/import/run.ts`, which takes a database and the id of whoever is
  answerable rather than a request; the actions keep the guard, the call and the revalidation. On
  top of that, `pnpm leanix:into-graph` imports a LeanIX workspace straight into the graph from a
  shell — token from the environment, `DATABASE_URL` for the graph, nothing written without
  `--approve` — for the case the in-app door cannot serve: a first import of a real estate on a
  deployed server, by somebody who has a shell and not a session. Same code as the button, and the
  same numbers on Energinet's workspace: 452 created, 3 changed, 378 connected, 236 nested.

- **2026-09-11 — Rev 111: the hierarchy survives the import.** Energinet's 202 Business
  Capabilities landed flat, because LeanIX's `relToChild` came through as an ordinary relation and
  a relation is not containment. A column can now mean **parent**: the staged record carries the
  name of what it sits inside, and approving resolves it to `entities.parent_id` once every row
  has an id — never as an edge as well, because the graph already holds containment as a column.
  `planParents` decides which names become moves: one that resolves to nothing leaves the object
  at the top (a question in the review, never a blocker), one already made writes nothing, and one
  that would close a ring is refused — checked against the batch's own earlier moves, since two
  rows naming each other is how a cycle arrives. Rollback restores the previous parent the same
  way it restores a kind. The LeanIX builder lifts the hierarchy out of the relation columns for
  the types that nest, and a nested fact sheet is named by its own name rather than by LeanIX's
  path-shaped `displayName`. The inventory grew an **Inside** column with the roll-up count. The
  same 455 fact sheets now place **236 objects in the hierarchy** — 172 of 191 capabilities under
  19 roots, three deep — and 230 fewer relations, because they were never relations. 18 new tests
  (1,032 total), brief §5.74, three decision rows.

- **2026-09-10 — Rev 110: the LeanIX importer meets a real workspace.** Rev 97's EA-repository
  door had only ever run against a stub written to match its own query, and failed against
  Energinet's workspace three ways: it asked for `...on FactSheet`, a type that does not exist;
  it asked for relations at node level, where none of them live; and it selected per-type fields
  that collide across types, which GraphQL refuses outright. Replaced with the introspection the
  old comment already promised — `discoverShape` asks the workspace for its types, fields and
  relation fields, and the queries are built from the answer with every per-type selection
  aliased. Mirrored relations are deduplicated with a stable direction: Energinet's 1,242 rows
  are 621 edges, and importing both halves would double every degree in the explorer. Adds
  `pnpm leanix:read`, a terminal pull that takes the token from the environment and never from
  argv, never writes to the graph, and can `--save` the export as CSVs. Error details that
  arrive as a GraphQL `errors` array are now rendered instead of dropped. 15 new tests, brief
  §5.73, four decision rows. First real read: 455 fact sheets, 11 types, 621 relations, none
  dropped.

- **2026-09-10 — Rev 109: the inventory.** Every type with data is now a destination —
  `/w/[slug]/type/[kind]` — with a facet rail built from its own declared fields, a **not set**
  bucket on every facet (9 of 23 applications have no owner, and that is now one click), search,
  and a table whose cells edit as the type the meta-model declares: an enum as a dropdown of its
  options, a boolean as yes/no, a number as a number, a url with a link. The entity table used
  to edit a declared four-option enum as free text, which is exactly how "Active" and "active"
  both reach the column and why Nexus grew a proposals system to normalise a mess it allowed.
  Each facet counts against the *other* facets and never itself, so choosing a value does not
  zero its siblings and the filter is not a one-way door. Building it exposed that an enum's
  allowed values had no interface at all outside adopting a framework, so the meta-model's field
  table gained one. New pure `lib/inventory.ts` with 29 tests, `Inventory` and `InventoryCell`,
  e2e coverage, a docs page, brief §5.72 and five decision rows.

- **2026-09-10 — Rev 108: Objectives.** A fifth framework family, **Strategy**, with
  *Objectives and initiatives*: Objective, Key Result and Initiative, plus Business Capability
  and Application so the rules reach the estate. `measured by`, `contributes to` (an objective
  rolls up into one parent, not several), `needs` and `changes`. A Key Result is its own type
  rather than a field, because an aim is measured several ways and a measure has a target and a
  current value. The estate link is the point: an objective naming no capability and no system
  is a sentence in a slide deck. The catalogue's existing tests caught `horizon` marked required
  against its own description — the rule is never to require something nobody can know on day
  one, and a forced date is a fictional one. Brief §5.71, two decision rows, two new tests.

- **2026-09-10 — Rev 107: containment.** The graph was flat, so a capability map, C4's levels or
  an organisation chart could only be faked as ordinary relations. `entities.parent_id` makes a
  thing sit inside exactly one other thing, which is what lets counts roll up and lets the
  structure be walked. New pure `lib/hierarchy.ts` with 21 tests covering the rules that keep it
  a tree — cycles never hang a reader, a filtered tree does not lose the children of things
  outside the filter, deleting a parent lifts its children to the grandparent rather than taking
  them with it, and a move that would make a ring is refused with the reason. **Where it sits**
  in the entity drawer shows the chain above, the children with their own roll-ups and the total
  beneath, with a move control whose candidates carry their full path. The seed builds a real
  two-level capability tree over the demo estate. Migrations for both dialects; guard coverage,
  e2e, a new docs page, brief §5.70. Part of #110 — the LeanIX importer, the explorer rail tree
  and board expand/collapse are still to come, and are listed there.

- **2026-09-10 — Rev 106: evidence gaps.** A graph question that finds nothing now says what the
  *model* does not know instead of "no results": the name is not a thing here, no relationship
  is called that, the type is unused, nobody has recorded anything in that direction, or the
  clauses are individually fine and jointly impossible. Each diagnosis carries the nearest
  questions that do have answers, with the count each would return — and suggestions that would
  also return nothing are not shown, because four dead ends look like help and fail four times.
  Required extracting the matcher into a pure `lib/query-match.ts` so a query can be re-run with
  one clause removed. Three latent bugs fell out, all of them a query silently lying: curly
  quotes did not parse, `rel:` on its own was ignored and returned the whole workspace, and the
  header printed "0 matches" above the finding. New `lib/query-evidence.ts` with 21 tests, an
  `EvidenceGap` component in the command bar, e2e coverage, docs page, brief §5.69. Closes #109.
  Sourced from the LeanFlow Studio gap analysis (`docs/LEANFLOW-GAP.md`).

- **2026-09-10 — Rev 102: the graph explorer becomes an instrument.** Replaced the single
  force-directed cloud with three views over one graph — **Focus** (one entity and its
  neighbourhood in concentric hop rings, SVG, no camera, radius = hop count), **Map** (every
  connected entity at once, labels de-collided and clusters packed) and **Paths** (two named
  pickers and every equally short route, not one). Direction, which the old undirected view
  threw away, is now the question: connections are split into incoming and outgoing under each
  relationship type, and blast radius asks downstream, upstream or either way. A permanent
  entity rail replaces the floating search card, filters by kind *and* relationship type, and
  gives the eleven entities connected to nothing their own section as the finding they are. Every
  step is recorded as a walk you can step back into. New pure module `lib/explorer-views.ts`
  (rings, radial layout, directed reachability, all-shortest-paths, greedy label placement,
  component packing, the walk) with 33 tests; `MapView`, `FocusView`, `PathsView`, `EntityRail`
  and `SubjectPanel` split out of the old 433-line component. Brief §5.68, decision log, in-product
  docs page rewritten.
- **2026-09-10 — Rev 101: the triple becomes the unit.** Taken, with attribution, from Ardoq's
  constraints table — their best idea. The unit of a meta-model's relationship half is not the
  relationship *type* but the **triple**: source → relationship → target. "An Application uses an
  IT Component" is a statement an organisation can agree with or reject; "uses" alone is not.
  Nexus already computed all of it — `observedPairs` with counts, `relation_rules` with
  declarations — and buried it inside one relationship type's detail panel at a time, split
  across two lists, so the shape of the rules was never visible. **Rules** is a third shape on
  the meta-model board now: one sentence to a row, with a status (in use, unused, observed), a
  connection count and the cardinality a rule declares — cardinality having been in the schema
  since §5.5 and never shown. Coverage is a share of *connections*, not of rows, because one
  undeclared triple carrying four hundred beats nine carrying one. And where every other tool in
  this category reads "the data does something the model does not allow" as a violation, Nexus
  reads it as the estate proposing the rest of the model: an observed pairing becomes a rule in
  one click. Promotion is refused while the relationship type is itself undeclared, and says why
  — a rule constrains a type, and you cannot constrain a word the model has not agreed is a word.
  We keep blocking nothing, where Ardoq offers Guided and Strict; if that ever changes it owes
  the reader the number theirs admits it lacks, which is how many existing connections a rule
  would put in breach. Also fixed a CSS bug this exposed: `header > i` styled the presence tag as
  if it were the 14px colour swatch, crushing "from data" to a sliver in any narrow panel.

- **2026-09-10 — Rev 100: the meta-model becomes one surface.** A file tree beside a five-tab
  inspector — 81 controls at 1440×900, the tab strip wrapping into a ragged three-row block, half
  the viewport empty, and eighteen types rendered as eighteen identical rows. The two facts
  somebody opens the page for were both behind a click: which types are real declarations rather
  than accidents of the data, and whether the data obeys them; forty-one breaches were a badge on
  the fourth tab. It is a **board of cards** now. Declared versus emergent is the strongest signal
  on a card — solid against dashed — because that distinction is what this product is about. Each
  card names **one** next action, ordered by an argument (an undeclared type outranks a broken
  rule, because until something is declared there is no rule to break), and a nudge every card in
  a band shares is hoisted into the heading and said once, since eighteen copies of a good prompt
  is wallpaper. The two numbers moved to the top as bars with a verdict naming which one is the
  constraint, each one a filter. Five tabs became one view: layers are a *grouping* of the board,
  the diagram a shape toggle, and Conformance and Frameworks drawers over the same types. Looking
  at the result found two honesty bugs reasoning had not: conformance over an undescribed estate
  rendered as a green 100% when it is undefined, and undeclared kinds were counted as broken rules
  while coverage already accounted for them — which made the verdict contradict itself inside a
  single sentence. 62 controls now, 995px against 1170, and the model's health readable before
  anybody clicks.

- **2026-09-10 — Rev 99: the sidebar shows the work, not the plumbing.** The rail had reached
  nineteen entries in one flat run, because every revision that added a surface added a line and
  none ever read the whole list. It is 14 now, in four groups with quiet labels — Model, Data,
  Work, and an unlabelled first group for the workspace itself — which turns a search into a scan.
  Models, Connections and People left the rail for a **settings area** with its own shell and nav
  at `/w/:slug/settings`; they were already at that address and shared nothing but the URL, so
  changing a password and then checking a key meant going back out through the sidebar. The
  platform console sits in that nav under a divider reading *Above this workspace*, for operators
  only, because it is the deployment rather than the tenant. Documentation and Settings are pinned
  below the spaces: reachable everywhere, costing the rail nothing. The structure is data with a
  test over it — at most fourteen entries, no group past five, nothing in two groups, and nothing
  under `/settings` or `/admin` in the rail — which is the regression that matters, since nineteen
  is what you get when each addition is reasonable on its own.

- **2026-09-10 — Rev 98: a platform console above the tenants.** Everything in Nexus until now
  happened inside a workspace, and a workspace role answers one question: what may you do here. It
  cannot answer the operator's — how many customers are on this deployment, which of them was
  created and never used, who has an account at all, who is locked out and needs a password. So a
  second, thinner level: one platform role on the account, one guard of its own, and a console at
  `/admin` outside the workspace shell. Tenants, with people, owners, boards, objects, relations
  and a state in one word — empty, dormant, in use — sorted by size rather than alphabetically,
  because the question you open it with is who is actually using it. Create a tenant (an owner and
  one space, nothing else), rename it, re-address it, delete it by typing its address back while
  the dialog counts what would go. People: every account on the platform with the four facts the
  workspace page cannot show — operator, no password, in no tenant, signed in right now — with
  memberships editable across any tenant, and the action this console was asked for: set somebody
  a password, which ends every session they have. To everybody who is not an operator the console
  is 404 rather than a refusal, and the sidebar does not mention it. The last operator cannot stand
  down or be deleted, nobody can delete their own account from here, and deleting a person removes
  their access and memberships but never their work. `NEXUS_OWNER_EMAIL`'s account becomes an
  operator on every start, by the same argument that created it. The guard-coverage test gained a
  clause: a platform action must use `denyOperator` and must never call the workspace `deny`.

- **2026-09-10 — Rev 97: the EA repository becomes the fourth door into import.** Rev 96 got a
  LeanIX workspace onto disk; this puts it into the product, and does it by adding nothing to the
  pipeline. Host and API token on the Import page, and the whole workspace arrives as a staged
  batch that then takes exactly the road a spreadsheet takes: columns shown with their meanings,
  objects matched against what the graph already holds, the deciding done on a board, approved by
  a person, rolled back if it was wrong. One staged file per fact sheet type, so the review says
  "342 Applications, 88 IT Components" rather than showing a pile of 430; fields as attributes,
  subscriptions as people (off by default, like every column that names somebody), relations under
  the names LeanIX gives them, and the LeanIX id as the record's key — which is what makes the
  second read an update rather than a second copy of the estate. `BatchFile.declared` is the whole
  mechanism: a source that states its own schema keeps it, because letting the guesser overwrite
  LeanIX would turn stated facts back into inferences and silently lose every relation. The token
  is used for the one read and never stored, and a failed read keeps what was typed.
  `pnpm e2e` now starts a LeanIX of its own speaking the real two-step auth and a cursor-paged
  GraphQL, and the suite walks the whole road — refused token, two pages, the declared column
  roles, two fact sheets sharing a name, approve, roll back. That found a real bug in rev 96's
  disambiguator: it appended the first eight characters of the id, which for two ids sharing a
  prefix produced the same name twice. The prefix now grows until it separates them.

- **2026-09-10 — Rev 96: getting a LeanIX workspace out.** `pnpm leanix:export` reads a LeanIX
  workspace over its Pathfinder GraphQL and writes it to files: the raw dump, a `nexus-import.json`
  in the Import page's own format, the relations it could not map, and a summary counting what it
  found by kind so the total can be checked against LeanIX itself. The token comes from the
  environment and never from an argument, and the output directory is git-ignored. The mapping is
  pure and separate from the fetching, so the half with judgement in it is tested without a licence:
  it keeps the organisation's own vocabulary rather than renaming everything on the way in, keeps
  the LeanIX id so a second import updates rather than duplicates, turns subscriptions into
  ownership, disambiguates two fact sheets that share a name — and counts the relations whose other
  end was outside the export rather than discarding them, because a relation count that silently
  shrinks is how somebody concludes an export worked. Verified end to end against a stub speaking
  the real two-step auth; not yet run against a live instance, which is what `--dry-run` is for.

- **2026-09-10 — Rev 95: an owner who is not the demo.** Nexus has no self-signup, which is right
  for a workspace tool and leaves exactly one hole: the first real person, who has nobody to ask
  for an account. `NEXUS_OWNER_EMAIL` and `NEXUS_OWNER_PASSWORD` now create that account on every
  start — not only on an empty database, because the case that strands somebody is a deployment
  seeded months ago — and make it an owner of every workspace. It is idempotent, it never throws
  so a typo cannot stop the app booting, and it never logs the password. It will not reset a
  password that already exists unless `NEXUS_OWNER_PASSWORD_RESET=1` says so, because a stale
  variable would otherwise undo every password change on every restart. The floor here is eight
  characters rather than the People page's ten, and the reason is written down: ten is a floor
  under a password one person picks for somebody else, this is somebody picking their own in their
  own deployment. One trap found by walking into it — `#` starts a comment in a `.env` file, so an
  unquoted password containing one is silently truncated; the refusal now names the length it saw.

- **2026-09-10 — Rev 94: the wiki.** Every architecture wiki fails the same way — somebody writes a
  good page, the estate moves, the page stays put, and a year later nobody trusts any of it. That is
  structural rather than a bug: a page in Confluence is a *copy* of what was true when it was
  written. So this one is built the other way round. A page is markdown, and the parts about the
  architecture are references resolved when the page is read: `:::board` draws the board from its
  current document, `:::object` shows an object's attributes as they are now, `:::query` lists
  whatever matches today over the same query language as the graph page. `[[Wiki links]]` resolve
  against the workspace's pages and show as unresolved when they point at nothing yet, so a wiki can
  see what it has promised itself; an embed whose target was deleted says so in place rather than
  vanishing. Because blank pages are how wikis stay empty, a board writes its own first draft: the
  board embedded live, objects grouped by kind, connections taken from the graph rather than the
  drawn lines, the canvas notes carried across as the one part that is already prose, structured by
  the board's own frames, and ending with "Still to write". It is deterministic rather than
  model-written — a model asked to describe a board writes prose that is true today and wrong next
  month, which is the failure being designed out. The markdown is ours, parsing to a typed tree
  React renders as elements, so the one surface where people paste out of Word has no HTML-string
  path; two properties are tested harder than the syntax, that nothing disappears and that the
  parser terminates — the second because the fence branch never advanced its cursor, and the first
  version of the property test was too weak to reach it. Also in this change: the seeded owner is
  Jesper Olesen, which is his name.

- **2026-09-10 — Rev 93: the tool rail earns its place.** The rail down the left had been added to
  and never looked at. Every button wore a permanent 8px caption — "card", "note", "on", "off" —
  positioned into the gap below it so the column read as crowded, which is the duplication rev 89
  spent a whole revision removing from everywhere else on the canvas. The shortcuts, the thing a
  returning user actually wants, were hidden in native `title` attributes. And the single submenu
  was a floating card pinned at an absolute `top: 250px`, pointing at whichever button happened to
  be there — the same mistake rev 88 fixed for the property bar, in the one place it had missed.
  So: four groups, no captions, a styled tooltip carrying the keycap, and flyouts anchored to the
  button that opens them. A flyout also stopped being a `PanelName`, because a panel persists and a
  flyout closes when you look away. Two icons described the wrong thing — a 3D cube for an
  architecture card, a paragraph-heading mark for a section — and are now drawn. The part that adds
  rather than removes is three flyouts that remember: **Card** offers the eight kinds with their
  colours and arms the kind *before* placing, so an interface arrives as an interface instead of as
  an Application you retype; **Shape** and **Connection** show the last thing you picked and re-arm
  it on one click. The rail's contents are data in `toolbar.ts`, held to invariants by tests — every
  button in exactly one group, no two on one letter, every advertised shortcut one the key handler
  honours, and every toggle saying something different in its two states. Measured in the browser,
  the rail is 44×559 with fifteen buttons and no text on any of them, against fourteen buttons
  carrying ten captions in a 52px column before.

- **2026-09-09 — Rev 92: layers, and a stack the data can propose.** Layers group object types and
  relation types into an ordered pile — the business-over-application-over-technology idea everybody
  arrives with. Three things can create a band and the row says which: somebody typed it, a
  framework brought it (§5.57's per-framework levels were always layers, and are now the same rows),
  or **the agent read it out of the estate**. The last is the point. Direction of dependency is
  already in the graph, so if nineteen connections run Application → Server and none run back, Server
  is underneath — a fact about edges rather than a guess about names. The engine sums the observed
  connections between every ordered pair of kinds, keeps the dominant direction, breaks a cycle by
  dropping its weakest edge, and ranks by longest path; every band shows the counts that put it
  there, and it reports the near-ties, the edges it had to drop and the kinds nothing connects. Under
  six connections it declines rather than doing arithmetic on noise. A small word list may put
  Business or Technology on a band, but it can never decide what is *in* one, and the familiar names
  are accepted only if the whole reading agrees with the conventional order — otherwise every band is
  named after its own largest type, which is duller and always true. Accepting is additive: a band
  you have is reused, a type you placed yourself stays put, and a kind that was never declared is
  declared, because a kind that is not a type cannot be in a layer. The mirror is the more useful
  half — once a stack exists, every connection running *up* it is listed with its count, and nothing
  is blocked. The type diagram now draws the bands, so an upward edge looks upward. ArchiMate (core)
  joins the framework catalogue as the tenth entry. Two bugs came out of the browser and are now
  tests: two bands given the same name, which a unique index refuses, and an adoption that placed
  nothing because every kind in the seed was undeclared.

- **2026-09-09 — Rev 91: modelling frameworks.** Rev 90's three "standard models" turn out to be a
  small case of a bigger idea, and Ardoq names it: a notation is not a feature of the drawing tool,
  it is *a metamodel you adopt*. So there are now nine frameworks in four families — C4 and UML class
  as notations, domain-driven design and model-based systems engineering as domain and engineering
  methods, IT4IT and SAFe as operating models, and the three portfolio models from rev 90 — each
  with its object types, fields, relation types, rules, **ordered levels** and a note on where its
  practice comes from. A workspace adopts as many as it likes, because real organisations use
  several at once and mean it: the software in C4, the domain in DDD, the funding in SAFe. Every
  type carries the framework that declared it, so a year later the model can still say who said an
  Aggregate was a thing here; a type that already existed keeps its own provenance, because a
  framework does not get to claim what the organisation invented for itself. Free form stays the
  default and is a real answer. Adopting is additive as before — nothing renamed, nothing deleted,
  no object touched, a second adopt a no-op — and stopping removes only the statement, never the
  types, which by then may hold hundreds of objects. Nine templates needed rules rather than review,
  so the rules are unit tests over the catalogue itself: grounding, no dangling relation rules, every
  type at one of its own levels, every enum given a vocabulary, no more than two required fields.
  Two failed on the first run and both times the template was wrong — MBSE required a verification
  method no imported requirements register carries, and the business capability model declared
  "levels" that were a property of instances rather than of types. Schema: `framework` and `level`
  on node types, `framework` on relation types, and a `framework_adoptions` table (migration 0026,
  pg 0019). What it does not do yet is change how a Container is *drawn* — that is the next piece,
  and direction 4 of the design mocks shows it.

- **2026-09-09 — Rev 90: the meta-model means something.** §5.14 let an organisation declare its
  types, fields, data types, required flags, enum vocabularies and relation rules — and then checked
  almost none of it: only rule violations, and only as a count. A field could be required and missing
  everywhere, an enum could list four options and the data hold nine, a date field could hold "Q3".
  Conformance now checks the estate against every claim the declaration makes, in six kinds of
  breach, and the output is a list rather than a number: each breach names one object, links to it,
  and says what is wrong in a sentence — *"Maximo" has no owner, and Application requires one.* Two
  headline numbers rather than one, because either alone lies: the share of *declared-type* instances
  that break no rule, beside the share of the estate the model describes at all, with a plain-English
  verdict beneath them. It is deliberately not estate health, which asks whether an estate is in good
  shape by standards nobody here chose; this asks whether the data obeys the rules these people wrote
  for themselves, and each screen links to the other. Nothing is ever blocked — the model grows out of
  the work, and when the data and the declaration disagree either can be the one that is wrong. The
  other half is where a model starts: three additive starter meta-models (application portfolio,
  business capability, integration and data flow), each small enough to be useful rather than
  imposed, each saying what it answers and where the practice comes from. Applying one only ever
  adds — nothing renamed, nothing deleted, no object touched — and the summary above the button is a
  plan computed against this workspace's live model, so it says what would change *here* and a
  second apply is a no-op that says so before you click. On the seeded estate the numbers go from
  100% / 0% to 48% / 61% on applying one, which is the feature working: the breaches were always
  there, and until something was declared there were no rules to see them against.

- **2026-09-09 — Rev 89: say it once, and give the canvas edges.** Where rev 88 stopped the chrome
  landing on itself, this asks how much of it should be there at all — measured again rather than
  judged. The object count was on screen three times, the zoom three times, and "autosaved" twice;
  each fact now has one owner, the control that can change it, and the bottom status line is gone.
  The three right-hand cards were 234, 174 and 231 wide at margins of 12, 10 and 10 — individually
  reasonable, together three scattered cards rather than a rail; they now share one width and one
  margin. The search bar held 720×53 of the middle of the board while displaying the ⌘K shortcut
  that makes it unnecessary, so it rests as a pill in the same place with the same keycap and opens
  on the shortcut its own documentation already told people to press. And the map — the largest
  permanently-open thing on the canvas, for a view you can otherwise get by zooming out — starts
  folded, one press from the tool rail which shows it as off. The reserve a panel keeps for the map
  follows whether the map is there, so with it away the Selection panel is 600px instead of 344 and
  shows an object's attributes without scrolling: the declutter gave the remaining panel its content
  back. At 1280×800 with a card selected, chrome over the canvas went from 43% to 32%, across seven
  pieces instead of nine.

- **2026-09-09 — Rev 88: the chrome stops landing on itself.** Measuring the canvas at 1280×800
  rather than looking at it turned up three overlapping pieces of floating chrome — all present at
  every window size up to 1920×1080, and all three the same shape: a hard-coded offset that assumed
  a smaller version of something that had since grown. The property bar clamped to the raw window
  and slid under the Graph panel by up to 184px; the Selection panel reserved 230px for the map
  card, which grows a *Fit selection* button exactly when something is selected — exactly when the
  Selection panel is also at its tallest; and the bar was placed 64px above a selection while
  standing 86px tall, so it sat on the top 22px of the object whose controls it held. Each fix
  removes a guess: the bar asks `fitInsets`, the one function that already answers "where is the
  chrome" for zoom-to-fit; it is anchored by the edge facing the selection so its height cannot
  matter; and the bottom reserve is a named custom property beside the topbar height rather than a
  magic 360. Objects hidden behind the bar fell from five, four and three to one at every size, and
  chrome-on-chrome overlap to zero. The durable part is the check: the browser suite now resizes to
  1280×800 and fails if any two pieces of chrome overlap, or if the property bar is standing on its
  own object — none of which a unit test can see.

- **2026-09-09 — Rev 87: an answer you can keep.** *Ask about a selection* answered well and then
  threw the answer away: click anywhere else and it was gone. Remarks have had *keep as a note*
  since rev 27; an answer had nothing, so the better it was the more that hurt. **Keep as a
  comment** now writes the exchange — questions, answers, and the words on the objects each answer
  rested on — into a comment on the board, or on the object if that is all that was selected. A
  comment rather than a note because a note is a thing on the drawing and a comment is somebody
  talking about it; it also lands where colleagues already look and can be settled when it stops
  mattering. The body says once, plainly, that a model wrote the prose: an agent's answer read as a
  colleague's is the worst thing this feature could do. The second half is follow-ups — each ask
  used to replace the last, which is the wrong shape for a question like "and which of those are
  customer-facing?" The exchange now stays on screen and carries into the next question, capped at
  four turns, because past that what it wants to be is an agent on the board with a purpose written
  down rather than a chat window bolted to a canvas. Building it turned up a real trap: the comments
  context falls back to a no-op outside a board, and a no-op `say` returns null — the success
  value — so anything asking outside a board would have reported keeping a comment it never wrote.
  The fallback refuses in a sentence now.

- **2026-09-09 — Rev 86: an agent that accounts for itself.** Using a board agent for an afternoon
  shows what §5.27 and §5.28 left out: it was a black box with a Wake button, and everything missing
  was already known to the code and thrown away by the screen. Selecting an agent now outlines every
  object it would read, in its colour, and counts them in a sentence — drawn from `scopeOf`, the
  same function the run uses, so it is what the agent sees rather than an approximation of it. After
  a run the agent says **Read 14 · said 3 · discarded 1 · 4 min ago**: the server always computed
  those and the view kept only the remarks, so "I read fourteen and none needed saying about" and "I
  could not see anything" rendered identically as silence. `discarded` is deliberately included
  because it is the unflattering one — an agent that keeps quoting words that are not there is one
  to rewrite, and nobody notices a pattern that is never shown. The remark tally became a button
  that flies to each object it spoke about. `BoardScope` gained `total`, so the 120-object cap stops
  being a silent truncation that reads like having nothing to say — both on screen and in the digest
  the model is given. And an agent can no longer be stuck *Reading…* for ever by a closed tab:
  `migrateDocument` clears the flag, and since that runs on the board `PUT` as well as on every
  read, the flag never reaches the database at all.

- **2026-09-09 — Rev 85: following somebody's viewport.** The smallest missing thing on a shared
  board: *look at this corner*. Click somebody's initials and your camera tracks theirs. What
  travels is the world **rectangle** they can see rather than their camera — a camera is in their
  screen units, so copying its zoom onto a smaller window shows less of the board than they are
  looking at, and the corner being pointed at ends up off your screen. Each follower fits the
  rectangle to their own window: in the browser test a 1400×900 leader at 392% and a 1600×1000
  follower at 413% have the same world point at the centre of both screens. Following ends the
  moment you move the board yourself, with nothing to press, because the reflex when a canvas moves
  under your hands is to grab it; the hook flags its own camera writes and treats everything else
  as the person taking the wheel back, so no other part of the canvas has to know following exists.
  The edge of the canvas takes their colour and a pill names them. One loop had to be made
  unreachable: the fit leaves a 6% margin, so two people each following the other would widen by
  6% every round and drift off the board — presence therefore also carries who you are following,
  and following somebody who is following you is refused with their initials saying why.

- **2026-09-09 — Rev 84: talking about a board.** The last real gap in the product: a board is a
  thing two people stand in front of and the one thing they could not do on it was talk. Comments
  are rows beside the document rather than objects inside it — they have to outlive the card they
  are about, and a version restore that deleted three colleagues' questions would be the product
  losing people's words. A conversation is two levels, never three; a reply to a reply joins the
  same one. `board.comment` is a capability of its own granted to **guests**, because the reviewer
  you invite to look at an architecture is exactly the person with something to say about it —
  while editing and deleting are your own words only, and deliberately not an administrator's
  power: a record somebody can rewrite is not a record. Most of the design is about what survives a
  deletion. There is no foreign key on `parent_id`, so withdrawing your own question promotes the
  answers to conversations of their own instead of deleting them; a thread about a deleted object
  says **(deleted)** next to the name it had, because hiding it throws the reasoning away at the
  moment it became history; and the author's name is copied at write time so a conversation still
  says who said it after somebody leaves. On the board, an object somebody is still talking about
  carries a pin, drawn in one screen-space overlay rather than inside each of the seven element
  renderers so it is the same size at any zoom. Settling a conversation does not delete it. What is
  honestly missing: comments do not ride the live channel, so they refresh when you post and when
  the tab comes back to the front rather than the second somebody else writes one. The new button
  also uncovered an older bug: `.miro-studio` is a grid with no explicit column, so its track sized
  to the topbar's max-content and a sixth control made the whole studio wider than the window —
  the page scrolled sideways and a drag aimed at a card landed on the connector behind it. The bar
  had already been twelve pixels over. The column is now the window and the breadcrumb gives way
  first; the browser suite is what caught it, which is the argument for having one.

- **2026-09-09 — Rev 83: the guard, actually everywhere.** Rev 81 said the write boundary was closed
  and it was not: an audit found forty-nine exported actions that changed something and asked
  nobody — bulk attribute edits, committing an intake source into the model, deleting a board or a
  space, every change-set edit, four meta-model actions — all of them reachable by a guest. The
  guards are now in place, and so is the thing that should have been there first: a test that reads
  every `"use server"` module and fails unless each exported action either calls a guard or is named
  in a list of deliberate exceptions with its reason. Ninety hand-written guards is a coverage
  problem and a coverage problem wants a machine. Writing the scanner produced its own lesson — the
  first version counted braces from the `export` keyword, so a multi-line `Promise<{ … }>` return
  type ended the scan at the signature and reported two *guarded* actions as unguarded; a test that
  errs towards false alarms is tolerable, one that errs the other way is worse than none. Two
  actions stay deliberately open and say why. The same review caught a real bug in rev 82: the live
  bus's oversized-message path persisted through the ordinary path, which declines unless the
  replica is the elected writer, so a patch too large for `NOTIFY` could be followed by every
  replica re-reading a document without it. That write is now forced.

- **2026-09-08 — Rev 82: the last two gaps.** A live board now works across more than one server
  process, and there can be more than one workspace. Rooms lived in one heap, so a second replica
  was a second set of rooms — two people on one board could land in different ones and take turns
  overwriting each other. The fix is the one rev 75 named: a bus, Postgres `LISTEN`/`NOTIFY` where
  the store is Postgres and a synchronous function call where it is not. The one real change to the
  room is that a patch is *published before it is applied* and applied when it comes back, so every
  replica applies in the bus's order and last-writer-wins is one rule rather than a race between two
  servers' clocks. Exactly one replica writes the board down — the lowest process id present, which
  needs no election and no lock because presence is already being published — and presence itself is
  the union of every replica's peers, forgotten after forty-five seconds so a crash leaves no
  ghosts. A message too large for `NOTIFY` persists and asks the others to re-read, which is three
  lines against a chunking protocol for the card with a thousand-word description. Alongside it,
  more than one workspace: a switcher where the workspace name already was, creating one makes you
  its owner and gives it a space, and — the part that matters — the layout now checks membership. A
  workspace you are not in answers `notFound` rather than a refusal, because a refusal confirms it
  exists and slugs are guessable.

- **2026-09-08 — Rev 81: who may do what.** `workspace_members.role` had been in the schema since
  the first week and nothing read it: since rev 76 everybody signed in as themselves and then every
  one of them could issue an MCP key, repoint the product at a different model, grant a system
  access to the estate, approve an import, deliver a change set and delete an object from the graph.
  Authorisation is now a capability matrix in one table rather than role checks at ninety call
  sites, because ninety call sites are ninety chances to be inconsistent and nobody can answer "what
  may a member do?" by reading them. The line the roles are drawn along is consequence outside the
  screen you are on: a guest reads, a member draws and edits, an administrator approves, delivers,
  deletes and configures, an owner also manages people. Hiding a button is a courtesy — the server
  re-checks, including the board `PUT` and the live channel, where a guest is welcome to watch a
  board with their cursor showing and may not change it. Two rules that the matrix cannot express
  sit with the people actions: the last owner cannot be demoted or removed, and a password reset
  ends that person's sessions. A **People** page under Settings does the roster, the roles, adding a
  colleague and resetting a password, and says what each role means where the role is chosen.
  Alongside it, keys, providers and connected servers now record who set them up, and anybody can
  change their own password — sign-up and password-reset email stay deliberately unbuilt, because
  SSO is the answer to both.

- **2026-09-08 — Rev 80: closing the deployment gaps.** Three of the gaps the brief admitted to were
  about running this somewhere real rather than about what it does, so they are closed together. The
  typeface is now served from the deployment: IBM Plex committed under `public/fonts` with its OFL
  licence and its faces imported with the stylesheet, because fetching it from Google at runtime
  meant an air-gapped installation silently fell back to the system stack and did not look like
  itself in the environment this product is most aimed at — the browser suite now fails if anything
  asks a font host for anything. A database can move between dialects: `pnpm db:transfer` copies
  every table parents-first in batches, in either direction, and refuses a destination that is not
  empty, because merging two estates is a different problem whose every answer is somebody's policy
  decision. The order it writes in is checked against the schema by a test — a table added next year
  and left out would make a move that reports success while an organisation's change sets are gone.
  And the Turbopack first-compile panic got the only honest treatment available: 16.3.4 is the
  latest release and still does it, so there is `pnpm dev:clean` and a note that says as much.

- **2026-09-08 — Rev 79: dropping an object onto the board.** Dragging a system out of the Graph
  inventory worked and looked wrong, in three ways that are the same mistake three times: the
  interface kept answering a question nobody was asking. The affordance was a dashed border round
  the whole viewport with a blue wash behind every panel — it said "you may drop something
  somewhere", when the question is where it lands and how big it is. So the affordance is now the
  cards themselves, drawn in world space at their real size and colour, laid out by the same
  function the drop uses; a group shows the grid with a count above it. The floating panels were
  silently drop targets, because they are children of the canvas element — dropping on the Graph
  panel created a card underneath it, in the model and invisible on the board — so a drop over
  chrome is now refused and the cursor says so. And the thing following the cursor was a snapshot of
  the list row, "+" button and all; it is now a chip naming the object in its kind's colour. On the
  way the drop stopped special-casing a single object: a 1×1 grid is a card centred on the pointer,
  so there is one path, with a test that the preview and the drop agree.

- **2026-09-08 — Rev 78: the graph remembers.** Boards have had version history since rev 9; the
  graph, which is the product, had none — and since rev 77 agents write to it overnight with nobody
  watching. Every change to an entity is now a row: the field, its before and after, the hand that
  made it, and where. The design decision worth the log is that history is **observed rather than
  declared** — `remembering()` snapshots the rows in scope, runs the write and diffs, so what is
  recorded is what happened to the database rather than what the calling code believed it was
  doing; a merge that also inherits a description turns up in the history whether or not anybody
  thought about it. `entity_id` is deliberately not a foreign key, because a deletion is the single
  most interesting thing that can happen to an object and a cascade would erase exactly that. The
  history also refuses to record typing: a change continuing the one before it, by the same hand in
  the same place inside two minutes, extends that row, and an edit undone inside the window leaves
  nothing at all — while anybody else's edit always ends the run. Two places read it: a timeline in
  the entity drawer, and **What changed** in the sidebar, grouped by day and filterable by hand,
  because "show me only what the agents did" is the question people actually ask the morning after
  turning a fleet on. Instrumented at the real seams — drawer edits, bulk edits, kind and attribute
  renames, merges, accepted proposals, board saves, meta-model renames, import approval and
  rollback — with relations recorded on both ends. Thirty-one new tests, an in-product
  documentation page, and a fortnight of invented history in the seed so the demo has something to
  show.

- **2026-09-08 — Rev 77: agents that run themselves, and a digest.** `definition.ts` had carried a
  line for two revisions saying *"a schedule is a trigger, and a trigger needs a runtime; both come
  later"*. Later arrived. Any described agent can now be hourly, daily or weekly, and an in-process
  clock — started from `instrumentation.ts`, mirrored by `POST /api/agents/tick` for hosts that
  recycle containers — runs the ones that are due. Intervals rather than times of day, because a
  time needs a timezone and a workspace is an organisation rather than a place; due computed from
  the last run row rather than from a timer, so a restart loses nothing; at most three agents a
  tick, oldest first, serially, because unattended work that fans out is how you discover a bill.
  An unattended run is emphatically not a privileged one — it goes through the same function, the
  same status checks, the same budget and the same refusal log as a run somebody asked for.
  The other half is that a person coming back finds out, so the workspace home now opens with
  **While you were away**: the runs nobody asked for, what they proposed, what has been decided
  since, and refusals first because that is the fact people least expect. It is silent when nothing
  happened — most mornings nothing did, and a panel that speaks every day is invisible on the
  morning it matters. Building it turned up its own bug: counting *every* open proposal made the
  panel reappear the instant it was dismissed, because something already seen was still open, so it
  now counts news rather than work. The fleet shows which agents are scheduled and when each goes
  next, and the editor says out loud that an hourly agent wants 24 runs a day against a budget of
  12 — obvious in a table, invisible in a form, and otherwise discovered a week later from a log
  full of refusals.

- **2026-09-08 — Rev 76: signing in as yourself.** Rev 75 shared a board and then had to admit, in
  its own known gaps, that the cursors were honest about *how many* people were on it and not about
  *who* — everybody was the seeded demo user, so two colleagues got the same initials in the same
  colour. Presence that cannot tell people apart is half a feature. The data model turned out to be
  ready: `users` has had a name, an email and a colour since the first week, `workspace_members`
  has had a role, and boards, versions, change sets and agent runs have all recorded a
  `createdById` — every one of them holding the same value, because `currentUser()` returned the
  demo user. So this was one function, a sign-in page and a session, not a new model. Passwords are
  **scrypt** from Node's standard library, with the cost stored alongside each hash so it can be
  raised later and a successful sign-in quietly rewrites an old one; the only rule on what people
  may choose is length, because composition rules push people towards `Password1!`. Sessions are a
  **table** rather than a signed cookie, because "sign out everywhere" has to be able to end one
  early — the cookie is 32 random bytes and the row is their SHA-256, so a leaked backup holds no
  usable session. The form never says which half was wrong and takes the same time either way, since
  "no account with that address" is a way to find out who works somewhere. Two gates now sit in
  order: the optional shared password, then a session; the proxy checks only that a cookie is
  present, because there is no database at the edge, and a forged one fails at `currentUser()`.
  A demo instance still opens in one step — the four seeded people share a published password,
  printed on the sign-in page in development, in production only with `NEXUS_DEMO_SIGNIN=1`, and
  never once it has been changed. Writing the tests turned up a real hole in the hashing before it
  shipped: a stored hash with an empty digest verified *any* password, because comparing two
  zero-length buffers trivially succeeds. And presence stopped inventing colours — a person already
  had one, so the cursor, the topbar avatar and the sidebar now agree. Three more came from the
  browser suite rather than from reading: a warm-up that spent 343 seconds being redirected, test
  fetches that had no session, and — the one that would have shipped — every documentation
  screenshot failing to render, because the image optimiser fetches its source over HTTP and
  `public/` was behind the gate.

- **2026-09-08 — Rev 75: two people on one board.** The honest answer to "we both opened it" used
  to be to refuse the second save — *Changed elsewhere — reload*. Right answer, wrong question: an
  architecture canvas is a thing two people stand in front of. Boards are now shared live. Open one
  somebody else has open and you see their cursor, in board coordinates so a colleague zoomed out
  still points at the same card; an outline round what they have selected; their initials in the
  topbar; and everything they change as they change it. The merge is small because the document is
  a map of flat objects: per-element last-writer-wins ordered by the server, so patches for
  different objects commute and the same object is a real conflict with a defined winner. No CRDT,
  no operational transform, no vendor. The exception is text, which is not merged at all — a field
  somebody is in turns their colour and goes read-only for everybody else, because last-writer-wins
  on characters loses them; the lock is presence, so it lifts when they blur, close the tab or drop
  the connection and can never get stuck. The transport is **server-sent events down and POSTs
  up**, chosen over WebSockets because enterprise proxies break upgrades silently and the failure
  lands on exactly one team; SSE needs no upgrade, no custom server and nothing new in the
  Dockerfile. While anybody is live, a room on the server owns the document and persists it once
  the board goes quiet, down the ordinary save path — one save, one graph sync, one import
  reconcile, instead of one per tab — and the client's own autosave comes straight back if the
  stream drops, so a blocked proxy degrades to the old behaviour rather than to a board that
  quietly stops saving. Approving an import, restoring a version, deleting a relation and a plain
  PUT now all hand the live room the new document, which was the other case that used to require a
  reload. Undo stayed personal. Twenty-four unit tests over the merge rules and the room, a browser
  check that drives **two** contexts at once, and a documentation page and screenshot that do the
  same — a picture of multiplayer with nobody else on the board is a picture of a board.

- **2026-09-07 — Rev 74: the documentation caught up with the product.** Nine revisions of feature
  work had left the writing *around* the product behind the writing *inside* it: the in-app pages
  were kept current change by change, but `README.md` still described roughly rev 20 — no intake,
  no import, no agents, no models, no MCP, no knowledge base — and the brief's own numbers had
  drifted (twenty-four pages when there are twenty-seven, thirty-three screenshots when there are
  forty, sixty-nine tests when there are five hundred and three). The README's "what it does today"
  was rewritten against rev 73, its scripts table now lists `docs:capture`, `db:seed` and the two
  knowledge commands and stops claiming `pnpm e2e` needs a dev server (it brings its own), and its
  layout block names the directories somebody actually has to find. In the brief, the quality-gates
  section now describes what the 503 unit tests and the browser suite really cover, and the known
  gaps admit that Postgres has been exercised rather than pretending it has not. `docs/API.md`
  gained `search_model`'s table format, the prose leg of an import, and what `meta.importBatch` on
  a board document means. `docs/AGENT-FRAMEWORK.md` stopped describing itself as a note about what
  does not exist yet, stopped counting six reading tools where there are five, and recorded that a
  remote server's rows now become an import batch and that rev 73 placed the first agent the
  product offers unasked. `docs/DEPLOY.md` gained the branch-deploy path (`railway up --detach`)
  with the two things worth checking before pointing it at a service that already holds data. The
  navigation screenshot was re-captured, because it still showed a sidebar with no Import and no
  Connections in it. Reading every page in the browser to check it also turned up a defect nobody
  had noticed: the in-product renderer knew `**bold**` and `` `code` `` but not `*emphasis*`, so a
  hundred-odd emphasised phrases were reaching readers with their asterisks showing. The renderer
  learned the span — carefully, so a lone asterisk in a sentence is still a lone asterisk — and a
  twelfth docs test now holds the pages to markup the renderer actually understands.

- **2026-09-07 — Rev 73: an agent beside the import.** A staged batch is where a second opinion is
  worth most and hardest to get, so the staged board now arrives with an **Import reviewer** already
  placed beside the lanes. It is an ordinary board agent — same remarks, same quoting, same "keep as
  a note", same acceptance rate in the fleet, changes nothing by speaking — with a sentence written
  for this job: these cards are claims and the lane each sits in is what would happen to it, so say
  what you would question before a person accepts them. Two cards that look like the same system
  under two names, a date already past, a value that disagrees with the rest of the batch, something
  accepted that reads like test data. The bar above the board counts remarks nobody has answered,
  because that matters most in the moment before Approve. On the way, **board agents learned to see
  the grouping**: a scope item now carries the frame it sits in, by the same rule a drag uses, which
  is what turns "these two are the same system" into "you have *accepted* two cards that are the
  same system" — and helps every board agent, not only this one.

- **2026-09-07 — Rev 72: prose and tables as one pipeline.** A batch could contain a Word document
  and did nothing with it — two ingestion pipelines side by side for one obvious job, since the
  governance review in the batch is *about* the systems in the export next to it. The prose in a
  batch is now read by intake's extractor and folded into the same staged records: same folding by
  name, same trust order, same conflict display. "Maximo is out of support from December" lands on
  the Maximo record beside the ServiceNow row — and **carries its sentence**, because a document's
  provenance has to be the words. A document takes its place in the file order like any other
  source, so putting the review above the 2019 spreadsheet is the same gesture as reordering two
  spreadsheets; below it, its answer is kept beside the winner rather than dropped. It can also
  introduce an object no export mentioned. Viewpoints — decisions, actions, risks — stay on the
  intake screen, because an import is about what the model should contain. Reading happens once and
  is stored, so re-mapping a column never re-reads a document. And the extractor learned to **state
  values**: an object may carry quoted facts, each checked against the passages, which is what makes
  the whole thing possible and is a better intake regardless. 4 new unit tests over the fold and the
  trust order; the e2e checks the document appears as a source of a record the tables created.

- **2026-09-07 — Rev 71: three doors into import.** A file is one of the three ways data actually
  arrives. **Paste** takes a block of anything — its shape worked out from the content, with the
  delimiter counted across the block rather than guessed from the first line, so a CSV containing
  tabs is still a CSV. **A connected system** puts the MCP call on the import page itself: pick a
  system, pick a tool, fill in what it wants, read the answer, stage it; prose goes to intake
  instead and the refusal says why. And Nexus now answers rows when asked — `search_model` takes
  `format: "table"` — which is what lets one Nexus import from another, and is how the e2e proves
  the door: it asks this instance for its own applications as a table, stages them, and every row
  matches itself. All three doors converge on one staging function, and a batch records which door
  it came through. 5 new unit tests over the paste sniffing.

- **2026-09-07 — Rev 70: import, and the canvas as the place it happens.** The landing zone was two
  things it should not have been: shaped around application portfolio management, and a table with
  a canvas bolted on for looking at. It is now **Import** — `/w/:slug/import`, `lib/import`, no
  framing that assumes applications, and the old address redirects — and the canvas is where the
  work is done. **The lane a card is in is the decision.** Saving a staged board reads it back:
  which lane each card's centre is in (the same rule a drag uses, so what you see is what is
  written), what you renamed, what kind you set, what you connected, what you deleted. Held and
  Rejected are drawn even when empty, because a decision you cannot drag to is one the canvas cannot
  express. There is no Apply button — the save is the apply — and a bar above the board counts the
  lanes live and approves from there. Drawing a connector between two staged cards now creates that
  relation on approval, named by record so a rename cannot repoint it. The batch page keeps what
  belongs to the *files* — what a column means, the trust order, whether people come in — and the two
  surfaces are views of one batch, computed with the board's edits applied so they cannot disagree.
  And because most exports never say what they are *of*, each file is now asked **what its rows
  are**, proposed from a kind column, the file name or the columns, in the workspace's own spelling.
  15 new unit tests over the containment and edit rules, an e2e that drags a card into Held on the
  canvas and then checks the batch page agrees, and the documentation page rewritten around the
  board.

- **2026-09-06 — Rev 69: Nexus asks back.** The other direction of MCP, and the last piece of the
  agent framework. A system of yours that speaks MCP — a CMDB, a wiki, a ticket tracker — can now be
  added under **Settings → Connections**; *Ask what it can do* shakes hands and lists its tools;
  Nexus builds a form from the fields a person can reasonably fill in, calls the tool, and shows what
  came back. Then it stops. Keeping the answer is a second button, and what it keeps is an **intake
  source** — read for claims, every claim quoted and checked against the words it came from, and
  reviewed by a person before any of it touches the model. There is no path from a remote server to
  the graph that skips that, because a one-click sync would quietly make somebody else's system an
  author of this organisation's architecture. Failures say which failure they are, in words: a
  refused key, an address that answered with HTML and is probably not an MCP endpoint, a host that
  is not reachable *from the server Nexus runs on*. Both JSON and a single SSE frame are read,
  because real servers use both. "Any MCP server" is now an available connector in the catalogue.
  5 new unit tests over the client against a stubbed transport, and an e2e that points this instance
  at **its own endpoint**, calls estate_health through the full outbound path and checks the answer
  lands as a source.

- **2026-09-06 — Rev 68: agents that suggest agents.** The last piece of the framework, and the one
  that needed the most care. **Ask what is missing** hands a model the shape of the estate and the
  fleet already watching it, and it comes back with agents nobody has written — each with the thing
  in *this* model that says it is needed. What arrives is a proposal in exactly the sense everything
  else here is: it is stored as **proposed**, which cannot run at all — not a run, not even a dry
  run — until a person approves it, and approving only makes it a draft, so its first opinions are
  still read before it is given a voice. **No agent may grant a verb or a budget it does not have
  itself**: an agent that may only fill in attributes cannot propose one that merges objects, and
  the refusal is shown in the parent's own words rather than hidden. That rule lives in the same
  function a person's form goes through, so it holds whatever the model answers. The button sits on
  the Agents page, where the workspace's reviewer asks, and on each agent's own page, where that
  agent asks under its own ceiling — a narrow agent can only ever propose a narrower one.
  Suggestions with no reason, duplicate names or empty scopes are refused and listed rather than
  quietly dropped. 9 new unit tests written as the rules, e2e over the honest no-model path, and a
  new section in the documentation.

- **2026-09-06 — Rev 67: Nexus speaks MCP.** The model of an organisation's estate is the thing other
  people's agents most want to read, so Nexus now answers them directly. One endpoint, JSON-RPC over
  HTTP, six tools: search the model in the workspace's own query language, describe an object with
  its relations and provenance, follow what depends on what, read the vocabulary, read the health
  score — and, with a key that allows it, leave a suggestion. **Nothing writes.** There is no tool
  that changes the model, and the test suite asserts the tool list so it stays that way; a
  suggestion from outside goes through the same validator our own agent's does, quoting the object
  it names or being discarded, and then waits for a person. A key that may propose speaks as a
  described agent (rev 66) with an owner, a budget and an acceptance rate, so what arrives from
  outside is measured exactly like what arrives from inside and appears in the review queue under
  its own name. Keys are minted here, hashed, shown once and never recoverable — the mirror of the
  provider keys in rev 65, where the secret is somebody else's. **Settings → Connections** issues
  them, shows when each was last used, and prints the client configuration block with this
  instance's own address. 17 new unit tests over the protocol and the boundary, an e2e that issues a
  key, proves the page cannot print it back, talks JSON-RPC to the endpoint and checks a revoked key
  stops being answered, and a documentation page.

- **2026-09-06 — Rev 66: an agent you can read.** Agents in Nexus were hand-written modules: the one
  that reviews the graph read the whole workspace, could propose anything, and answered to nobody. An
  agent is now **described** — a name, a purpose in your own words, an owning team, a scope query
  that decides what it may read, the verbs it may use, grounding, a model and a budget in runs a day
  and proposals a run. Four things are refused outright, and each is a way a fleet becomes
  unaccountable: no scope, no owner, no verbs, and a budget bigger than the ceiling. A new agent is a
  **draft**, and a draft runs as a **dry run**: you read exactly what it would have proposed before
  pressing *Give it a voice*, which costs one call and is the same courtesy you would extend to a new
  colleague. Every run is written down — read, proposed, thrown away in checking and why, which model
  answered, how long — including runs a pause or a budget refused before they cost anything, because
  a log that only records successes flatters. The verbs are enforced by the validator as well as told
  to the model, and a proposal now carries the agent that made it all the way to the review queue,
  where it appears under that agent's name; the decision copies the name before the proposal is
  deleted, so acceptance stays measurable per agent. *Ask the agent* on the Knowledge graph page now
  runs the workspace's own **Model reviewer**, an ordinary definition like any other. Capability
  monotonicity — no agent may create an agent that can do what it cannot — is written and tested
  ahead of the feature that will need it. 18 new unit tests, an e2e over the refusals and the run
  log, and a documentation page.

- **2026-09-06 — Rev 65: where the thinking happens.** A model was two environment variables, which
  meant one provider chosen at deploy time for everything, no way to run a model on your own
  hardware without a redeploy, and no way to tell from inside the product what it was talking to.
  **Settings → Models** replaces that. A provider is described by the *dialect* it speaks — Anthropic
  Messages or OpenAI chat completions — which makes Ollama, vLLM, llama.cpp, Azure, a LiteLLM
  gateway and a national cloud the same kind of row rather than six special cases, and makes a
  model that needs no key and never leaves your network an ordinary choice. Presets fill in the
  base URLs; **Try it** makes a real call, because a reachable host and a well-shaped key answer a
  question nobody asked. Each of the four jobs — Compose, intake, the graph agent, board agents —
  can name its own provider and its own model id, so one endpoint can be used at two sizes. Keys
  are encrypted with AES-256-GCM under `NEXUS_SECRET_KEY`; when that is not set they are stored as
  they are and the page says so at the top, because the alternative is encryption theatre. A key
  that can no longer be read stops its provider instead of quietly falling through to another one.
  Every model call in the product now goes through a single function, and the environment variables
  remain the last fallback so no running instance loses its model. 20 new unit tests over the
  translation, the key handling and the order of preference, and a documentation page.

- **2026-09-06 — Rev 64: the landing zone.** Real portfolio data arrives as a ServiceNow export, a
  spreadsheet somebody has maintained since 2019, a SharePoint list and a Word document — four files
  that disagree with each other and with the model. All four now go into one batch, are read (quoted
  CSV, UTF-16, ServiceNow's JSON wrapper, .xlsx and .docx, both opened by eighty lines of ZIP rather
  than a dependency), folded into one object per thing with provenance kept per *field*, matched
  against the model in grades from "the source's own key" down to "near name, which is a question",
  and checked into blockers, questions and notes. Columns that name people are held out until
  somebody ticks a box. What the export has stopped claiming is raised and never deleted. A relation
  column is decided by whether its values name things, not by whether its header sounds like one, and
  an ambiguous date column is flagged rather than guessed. **Draw it on a board** lays the batch out
  by outcome as planned cards you can walk around. Approving writes it and records exactly what it
  wrote; rolling back reverts only that, refuses to touch anything somebody has since built on, and
  names what it left alone. 48 new unit tests and an e2e that takes four real files in, approves
  them, and checks the graph is exactly the size it started at after the rollback.

- **2026-09-06 — Rev 63: tightening the ship.** A craft pass over the shell, keeping the visual
  language and changing its weight. The app had never stated a base font size, so everything drawn
  with `font: inherit` rendered at the browser's 16px — which is why the navigation read as a
  consumer app rather than a tool somebody spends a day in. `body` now states 14px/1.5, and the shell
  is tuned around it: a narrower sidebar, navigation at 13px with tight gaps and muted icons that
  take the accent colour only when active, a 23px page title, ledes capped at 68 characters, and the
  documentation's scale brought into line with the rest. Two things only looking would have caught:
  the line above a page title is an eyebrow on most pages and a sentence on one, so it is no longer
  uppercased anywhere; and the "no model is configured" explanation had been borrowing a class meant
  for a two-word legend, turning an honest sentence into four lines of shouting in a corner. Every
  committed documentation screenshot was re-captured, because a type-scale change makes all of them
  wrong at once.

- **2026-09-06 — Rev 62: ambient agents, and the fleet.** Two more places for an agent to be useful,
  and one place to see them all. **Ask about these** puts an agent in the Selection panel: select any
  objects on a board and ask, with no placement, no page and no query — the selection is the scope.
  It answers in prose plus citations, each one checked against the object it names, clickable to fly
  to that object; unfindable citations are dropped and counted, and an answer with nothing left to
  cite is shown but marked as an opinion rather than a reading. **`/w/:slug/agents`** is the fleet:
  every agent in the workspace, what it watches, what is still waiting, and the number that actually
  matters — how often a person kept what it said, with the verdict in words rather than a colour.
  Answering a remark now leaves a trace that outlives both the remark and the agent, so deleting an
  agent does not erase how it did. The remark popover moved into a portal after the selection toolbar
  was found covering the remark you had just clicked to read. 14 new tests, two new documentation
  pages' worth of content with the three agent surfaces gathered into one section, and e2e over the
  ask panel and the fleet.

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
