# What LeanFlow Studio has that Nexus does not

A feature-by-feature reading of `rummand/leanflow-studio` (@ `3f96537`) against Nexus as of
rev 102, listing only what LeanFlow Studio does and Nexus does **not**.

The two products are not the same shape, and that matters when reading this list. LeanFlow
Studio is a **local-first mirror of a LeanIX workspace**: LeanIX is the source of truth, the
mirror is read-only, and everything you do happens on a local branch beside it. Nexus is the
**system of record itself**: the graph is authoritative, it is built by agents and by people,
and imports are one of four doors into it. So a few of the items below are not simply missing
features — they are consequences of a different contract, and adopting them means deciding
which contract Nexus wants. Those are flagged.

Where Nexus already has something close, it is named, so nothing here gets built twice.

---

## 1. Branching and time — the biggest gap

LeanFlow Studio has a Git-like model for architecture data. Nexus has history and planned
change, but no branching.

### 1.1 Environments as branches
Each workspace has multiple **environments** — `prod`, `baseline`, `sandbox` — that behave as
branches of the architecture data. Nexus has exactly one live graph per workspace.

- **LeanFlow**: `/api/workspaces/:id/environments/...`, an environment switcher in the canvas
  topbar, "Local workspace environments" panel.
- **Nexus today**: one graph. `spaces` group *boards*, not data. Change sets and plateaus
  (§5.36–§5.40) model *planned future* change, which is a different axis.
- **Note**: this interacts directly with the rev 103 decision about meta-model scoping. If
  sandbox spaces are built as decided, an environment is the data-side twin of that idea.

### 1.2 Snapshots, and an environment head
Every extraction materialises a dated **snapshot** of nodes and edges; the environment points at
a head snapshot; previous snapshots are kept.

- **LeanFlow**: `sync run → snapshot → graph nodes/edges → environment head`.
- **Nexus today**: `entity_events` (§5.34, "the graph remembers") is an append-only event log —
  you can read *what changed*, but you cannot address "the graph as it stood on 3 March" as a
  first-class object, or pin work to it.

### 1.3 Checkout a snapshot
`POST /api/workspaces/:w/environments/:e/snapshots/:s/checkout` — move the environment back to a
previous snapshot.

- **Nexus today**: nothing. Board versions can be restored (§5.9); the graph cannot.

### 1.4 Diff two snapshots
`GET .../snapshots/:s/diff`, with an "Active checkpoint diff" panel and a "Checkpoint trail".

- **Nexus today**: the closest thing is the as-is/to-be board toggle (§5.38) and the change-set
  projection, both of which diff *plans*, not two states of the imported estate.

### 1.5 Derive a workspace from a baseline
`POST /api/workspaces/:id/derive-from-baseline` — fork a whole local workspace from a trusted
snapshot, and "Open existing local branch".

- **Nexus today**: workspaces are tenants (rev 98). You cannot fork one.

### 1.6 Branch delta / extension ledger
"Show local changes in this branch" as a query, plus a **branch extension ledger** listing
everything the branch added over the baseline.

- **Nexus today**: `source` on each entity/relation records *where* it came from
  (`canvas`, `import:x`, `connector:x`), which is the raw material — but there is no "what has
  this branch added since the import" view.

---

## 2. Provenance and the read-only contract

### 2.1 A trusted baseline that cannot be written
LeanFlow separates **imported LeanIX data** from **local Flow Studio objects**, and enforces it:
local ids carry a `flow-studio/` prefix, local kinds a `FlowStudio` prefix, local payloads are
stamped `localOnly=true` and `source="LeanIX Flow Studio"`. The baseline environment refuses
local writes ("No local writes are allowed on the trusted baseline", "Baseline locked").

- **Nexus today**: everything lands in the same `entities`/`relations` tables and can be edited
  by anyone with the capability. `source` is recorded but is not a boundary.
- **Contract question**: this is the local-first mirror contract. Nexus is the source of truth,
  so a *locked* baseline may be the wrong idea — but "these 4,000 objects came from LeanIX and
  nobody has touched them since" is a claim Nexus currently cannot make either.

### 2.2 Backend-enforced read-only guard on the source
`server/leanix-readonly-guard.ts` plus `GET /api/safety/read-only` and a **"Local-first safety
audit"** panel in the UI: the app can *prove* it never writes to LeanIX.

- **Nexus today**: the LeanIX importer (rev 97) only reads, but nothing enforces or displays
  that. A customer asking "can this tool change my LeanIX?" gets an assurance, not evidence.
- **Worth taking regardless of the rest.** It is cheap and it is the question every EA tooling
  buyer asks first.

### 2.3 Import provenance record
Each import records source profile, workspace, mode, scope, sync-run id, timestamps, fact-sheet
and relation counts, and the read-only contract that applied.

- **Nexus today**: `sources` / `source_runs` / `import_batches` capture much of this. The gap is
  smaller than it looks — mainly that it is not surfaced as a provenance statement you can read
  or export.

### 2.4 Provenance export
"Local provenance export actions" — export where everything came from.

- **Nexus today**: nothing.

---

## 3. Modelling gaps

### 3.1 Fact sheet hierarchy
LeanIX fact sheets are hierarchical (a Business Capability tree, applications with children),
and LeanFlow has a **"FactSheet hierarchy"** panel to navigate it.

- **Nexus today**: `entities` has **no parent** — the graph is flat. Containment can only be
  expressed as an ordinary relation, which means no tree navigation, no roll-up, no "everything
  under this capability".
- **This is the most structural gap in the list.** Capability maps, C4 levels and
  organisation trees all want it, and Nexus's meta-model (§5.66) has no notion of it either.

### 3.2 Architecture decisions as graph objects
`FlowStudioDecision` and `FlowStudioDecisionRelatesTo` are real node and edge types: a decision
is a thing in the graph, linked to the fact sheets it concerns, with `State draft` /
`State approved`.

- **Nexus today**: decisions live in the wiki (§5.62) as prose, and ADR repos with PR-style
  approval are on the roadmap but not started. Nothing links a decision to the entities it
  affects.

### 3.3 An annotation layer: notes, risks, decisions
An **annotation drawer** with **annotation filters**, and "Search local notes, risks, decisions"
across them. Annotations are typed and searchable, separate from both the graph and the board.

- **Nexus today**: comments (§5.63) are threads on boards and objects; the wiki holds prose.
  There is no typed, filterable annotation layer, and no notion of a **risk** as an object.

---

## 4. Asking questions

### 4.1 Evidence gaps and pivot suggestions
When a graph query finds no matching relation evidence, LeanFlow does not say "no results". It
shows a **no-evidence banner**, explains that the *snapshot* lacks matching evidence for that
seed/direction/relation family, and **suggests pivot queries** built from the relation families
that do exist near the seed. You can then **"Pin evidence gap"** — turning the missing evidence
into a local follow-up note that survives in the board and in exports.

- **Nexus today**: graph query (§5.24) returns what it finds. An empty result is an empty result.
- **This is the best single idea in the repo.** "The model does not know" is a finding about the
  model, and Nexus's whole thesis (§2.2 — undeclared things are proposals, not violations) says
  exactly the same thing in a different place. It belongs in Nexus.

### 4.2 Relation-family language mapping
A documented mapping of human architecture language onto relation evidence: *blocking /
blocked by / requires / dependencies* → dependency intent; *supports / enables* → support;
*integrates / interfaces with* → integration; *uses / consumes*; *provides / serves*; *owner /
responsible / accountable*. So "show applications blocking Target Data Platform" works without
knowing the relation type names.

- **Nexus today**: Compose (§5.44) has a closed verb set (`add`, `expand`, `connect`, `group
  by`, `lay out`, `colour by`) but no synonym layer over the *relationship* vocabulary.

### 4.3 A relation path builder
"Relation path builder" — compose a traversal by picking relation types and directions.

- **Nexus today**: rev 102 added **Paths** (every shortest route between two entities), which is
  the *query* version. The builder is the *authoring* version — "follow `hosted on`, then
  `depends on`, twice" — and is not there.

### 4.4 Runnable query examples in the UI
"Runnable graph query examples", "Suggested graph queries" — clickable, not documentation.

- **Nexus today**: Compose lists example prompts as text. Close, but they are not one-click.

---

## 5. Local intelligence

### 5.1 Push-to-talk voice query
Hold **Ctrl-M** on the canvas to record, release to transcribe locally into the command bar.
Runs `faster-whisper` as a local subprocess; audio never leaves the machine.
`/api/speech/{settings,status,transcribe}`, with provider/command/model/language settings in
admin.

- **Nexus today**: nothing. No speech anywhere.

### 5.2 Web search as a configured runtime
`/api/knowledge/web/{settings,status,test,search}` — web search as an admin-configured tool with
a test button, alongside the LLM.

- **Nexus today**: model providers (§5.31) and MCP servers (§5.50) exist; web search is not a
  configured capability.

### 5.3 A RAG index per snapshot, with status and rebuild
`/api/knowledge/{status,rebuild,query,settings}` — the RAG index is built over the *current
snapshot*, the UI says whether it is indexed ("RAG ready" / "Local RAG index not built for this
snapshot yet"), and you can rebuild it.

- **Nexus today**: the EA knowledge base (§5.28, `packages/ea-knowledge`) is RAG over a *doctrine
  corpus* — TOGAF and friends — not over the workspace's own graph. Retrieval over your own
  estate is not there.

### 5.4 A symbolic answer path when no model is configured
"Built-in symbolic RAG fallback" / "Symbolic local answer": with no LLM, questions are still
answered by rules, and the UI says which path answered.

- **Nexus today**: Compose has a rule compiler fallback and says so — this one is largely
  covered. Listed for completeness.

### 5.5 LLM test and status actions in admin
"Test LLM", "Save LLM", "Make local LLM usable", "Ready for model-written answers" —
configuration you can verify from the settings page.

- **Nexus today**: model providers can be configured; there is no *test this connection now*
  button. Small, and worth having.

---

## 6. Canvas and board

### 6.1 Off-canvas ghost fact sheets
Connected objects that are outside the viewport are drawn as **ghosts at the edge**, so you can
see that the thing you are looking at continues off-screen.

- **Nexus today**: the minimap (§5.3) shows where things are; nothing indicates *connected*
  things just out of view.

### 6.2 Presentation frames
"Add resizable presentation frame" — frames that define what a presentation shows.

- **Nexus today**: frames exist; presentations built from boards are task #39, not started.

### 6.3 Board cleanup tools
"Board cleanup tools", "Reset board layout and view".

- **Nexus today**: alignment and distribution exist (§5.20); a one-action tidy/reset does not.

### 6.4 Complete workspace pull
"Complete workspace pull" — one action that extracts the entire source workspace, as opposed to
a scoped import.

- **Nexus today**: LeanIX import (rev 97) stages by fact-sheet type through the batch pipeline.
  Functionally similar; the difference is that it is not one button with a progress contract.

---

## 7. Setup and admin

### 7.1 Integration credentials as admin profiles
Stored API profiles per integration, with status ("No LeanIX API profile configured", "Admin
token needed") and a test action.

- **Nexus today**: connections (§5.48) cover MCP and catalogue sources; the LeanIX token is
  entered per-import and deliberately never stored. **Deliberate difference** — storing it is a
  security decision, not an oversight — but a saved, testable, admin-owned profile is what a
  real deployment wants.

### 7.2 A setup recipe
"Setup recipe" — a guided checklist that gets a new install to a working state.

- **Nexus today**: nothing. New workspaces get seed data and are left to it.

---

## 8. Outside the product

### 8.1 Graphify — the codebase as a graph
`npm run graphify` runs an AST-first Python script over the repository and emits
`graphify-out/graph.json`, an interactive `index.html`, and `GRAPH_REPORT.md`, so the
implementation itself can be navigated as a graph.

- **Nexus today**: nothing ingests code. The roadmap has "reference architectures as code /
  developer portal", which is adjacent but not this.
- Worth noting that Nexus's own graph engine could host this: a codebase is a graph of modules
  and imports, and Nexus already draws those.

---

## What Nexus has that LeanFlow Studio does not

For balance, and because it decides how much of the above is worth taking. Nexus has:
multi-tenancy and a platform console; sign-in, roles and a capability matrix; real-time
collaboration, presence and viewport following; comments; a wiki with live embeds; agents —
described, ambient, on the board, and accounting for themselves; MCP in both directions; model
providers including sovereign endpoints; an intake pipeline for prose and tables; four import
doors; change sets, plateaus and a roadmap; estate health and conformance; a meta-model with
layers, frameworks, declared/observed triples and cardinality; in-product documentation with
captured screenshots; the graph's own event history; Postgres as well as SQLite; and a
deployment.

LeanFlow Studio is one 11,597-line `App.tsx` and a 753-line Express server, with LeanIX as its
only source. Most of what it does that Nexus does not, it does because it made the opposite bet:
**mirror, branch, and never write back**.

---

## Recommended order, if you want one

1. **Evidence gaps and pivot suggestions** (§4.1) — the best idea here, small, and it is already
   Nexus's philosophy applied to queries instead of to types.
2. **Entity hierarchy** (§3.1) — the most structural gap; capability maps and C4 both need it.
3. **The read-only safety audit** (§2.2) — cheap, and it answers the first question every buyer
   asks.
4. **Snapshots, checkout and diff** (§1.2–§1.4) — the foundation the rest of the branching model
   needs, and useful on its own.
5. **Decisions and a typed annotation layer** (§3.2, §3.3) — the roadmap already wants ADRs.
6. **Relation-family language** (§4.2) and **runnable examples** (§4.4) — cheap Compose wins.
7. **Environments and branching** (§1.1, §1.5, §1.6) — big, and worth deciding alongside rev 103's
   sandbox spaces rather than separately.
8. **Voice** (§5.1) and **web search** (§5.2) — genuinely nice, genuinely optional.

Items **2.1** (a locked baseline) and **7.1** (stored credentials) should be decided as contract
questions before being built.
