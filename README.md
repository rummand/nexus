# Nexus

**AI-native enterprise architecture canvas.** Feed Nexus everything your organisation has —
portfolios, processes, CMDBs, OT data, wikis, meeting notes — and its agents grow the
meta-model from the data instead of forcing the data into a vendor's model. Everything
lives in one graph and is touchable on an infinite, Miro-like canvas. The look and feel
follows the LeanFlow Studio reference design.

> Read **[`docs/BRIEF.md`](docs/BRIEF.md)** first. It is the living product brief: vision,
> architecture, what exists, roadmap, decisions. Every change updates it.
> The HTTP contract and server actions are described in **[`docs/API.md`](docs/API.md)**;
> the agent design in **[`docs/AGENT-FRAMEWORK.md`](docs/AGENT-FRAMEWORK.md)**.
> There is also documentation *inside* the product, at `/w/<slug>/docs`.

## What it does today

- **Miro-like structure** — workspace home, teams, spaces, boards (starters, favourites, recents,
  move / duplicate / delete), all in the LeanFlow Studio design language.
- **Infinite canvas** — cards, notes, text, sections, shapes, frames, connectors (straight /
  curved / elbow); smart guides, alignment tools, context menu, undo / redo, autosave, version
  history with compare and restore, SVG export, presentation mode. Smooth at 400+ cards.
- **Knowledge graph** — every card is an entity, every connector between cards a relation. The
  meta-model (kinds, relation types, attribute schema) *emerges* from what is on boards and what
  you bring in. Graph page with kind cards, entity list / table / drawer, explorer, meta-model
  builder, estate health with drill-through and fixes.
- **Import** — the canvas *is* the import tool. Files (CSV / TSV / JSON / XLSX / DOCX / Markdown),
  a pasted block, or an answer from a connected MCP server become a staged batch: columns are
  read and explained, rows folded into one object per thing with provenance per field, matched
  against the model, and laid out on a board in lanes. **The lane a card is in is the decision.**
  Prose in the same batch is read for claims and folded into the same records, every value
  carrying the sentence it came from. Approve writes; rollback reverts what it wrote and says
  what it would not touch.
- **Intake** — meetings, mails and documents become checked, quotable claims that wait in a
  review queue, plus a catalogue of the systems an organisation actually has.
- **Agents** — deterministic proposals (merge duplicates, unify vocabularies, type the untyped,
  fill attributes, clean orphans); a model-backed agent that reads the graph and proposes
  corrections that must quote their object; agents that live *on* a board and remark on their
  scope; agents described in words with a scope, verbs, an owner and a budget; agents that
  suggest agents; one fleet page for all of them, with an acceptance rate.
- **Time** — change sets, to-be boards, dependencies, plateaus, a roadmap page, a timeline
  layout, and a scrubber that drags a board through the plan.
- **Compose** — write what you want on a board in plain English; a model plans it and a typed
  validator decides what executes.
- **Models** — providers configured in the app (Anthropic-style and OpenAI-compatible,
  self-hosted included), a different model per job, keys encrypted at rest.
- **MCP, both directions** — Nexus is an MCP server (five read tools plus a validated
  `propose_change`, keys scoped read or propose), and it can ask other people's servers and keep
  what they answer as an import batch or an intake source.
- **Query** — a small structured language in the command bar (`kind:`, `attr:value`,
  `related:` / `from:` / `to:`, `rel:`, `has:` / `missing:`, `on:`, free text) that places or
  highlights results on the board.
- **Documentation in the product** — 27 pages with 40 screenshots captured from the running app,
  searchable, tested as data.
- **EA knowledge base** — a standalone corpus (`packages/ea-knowledge`) with lexical retrieval
  and doctrine, which imports nothing from Nexus.

## Quick start

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

The app runs against a local SQLite file with a seeded demo workspace (Acme Energy).
No configuration needed. A model is optional: without one, Compose falls back to a rule
compiler, intake and import fall back to rules, and every screen says so.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js dev server / production build / serve |
| `pnpm typecheck` · `pnpm lint` · `pnpm test` | TypeScript, ESLint, Vitest unit tests |
| `pnpm e2e` | Playwright browser suite — brings **its own server and database** (temporary SQLite file, free port, migrations and seed), so nothing needs to be running |
| `pnpm docs:capture [name]` | Re-capture the in-product documentation screenshots from the seeded demo; a name narrows it to matching shots |
| `pnpm db:generate` | Generate a Drizzle migration after editing the schema |
| `pnpm db:seed` | Seed the demo workspace into the current database |
| `pnpm db:reset` | Delete the local SQLite file (stop the dev server first); the next start re-seeds the demo |
| `pnpm kb:ingest` · `pnpm kb:ask` | Build and query the standalone EA knowledge corpus |

## Deploy

Railway: deploy the repo, add a volume mounted at `/data`, set `DATABASE_URL=file:/data/nexus.db`,
generate a domain. Point `DATABASE_URL` at Postgres instead to leave the single-volume limit
behind. Details, variables and how to deploy a branch in [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Layout

```
apps/web/              Next.js 16 app — routes, canvas engine, database
  src/canvas           the infinite-canvas engine (store, geometry, interaction, rendering)
  src/lib/import       reading, staging, reconciling and approving a batch
  src/lib/intake       prose → checked, quotable claims
  src/lib/agent        proposals, board agents, described agents, the fleet
  src/lib/mcp          Nexus as an MCP server, and the client that asks other servers
  src/lib/docs         the in-product documentation (pages + shots.json)
  src/db               Drizzle schema, client, migrations, seed
packages/ea-knowledge  standalone EA knowledge base (corpus, retrieval, doctrine, CLI)
docs/BRIEF.md          living product brief (read me first)
docs/API.md            HTTP routes, server actions, MCP, query and import formats
docs/AGENT-FRAMEWORK.md  how agents are bounded, budgeted and checked
docs/DEPLOY.md         deploying to Railway / Docker (SQLite volume or Postgres)
Dockerfile             production image; railway.json sets the health check
CLAUDE.md              rules for agents working in this repo
```
