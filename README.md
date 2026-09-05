# Nexus

**AI-native enterprise architecture canvas.** Feed Nexus everything your organisation has —
portfolios, processes, CMDBs, OT data, wikis, meeting notes — and its agents grow the
meta-model from the data instead of forcing the data into a vendor's model. Everything
lives in one graph and is touchable on an infinite, Miro-like canvas. The look and feel
follows the LeanFlow Studio reference design.

> Read **[`docs/BRIEF.md`](docs/BRIEF.md)** first. It is the living product brief: vision,
> architecture, what exists, roadmap, decisions. Every change updates it.
> The HTTP contract and server actions are described in **[`docs/API.md`](docs/API.md)**.

## What it does today

- **Miro-like structure** — workspace home, teams, spaces, boards (starters, favourites, recents,
  move / duplicate / delete), all in the LeanFlow Studio design language.
- **Infinite canvas** — cards, notes, text, sections, shapes, frames, connectors (straight /
  curved / elbow); smart guides, alignment tools, context menu, undo / redo, autosave, version
  history with compare and restore, SVG export, presentation mode. Smooth at 400+ cards.
- **Knowledge graph** — every card is an entity, every connector between cards a relation. The
  meta-model (kinds, relation types, attribute schema) *emerges* from what is on boards and what
  you import (CSV / JSON). Graph page with kind cards, entity list / table / drawer, layout onto
  a new board.
- **Agent proposals** — deterministic, explainable suggestions with accept / dismiss memory:
  merge duplicates, unify kind and attribute vocabularies, type the untyped, label relations,
  fill missing attributes, clean orphans.
- **Optics** — viewpoints (expand neighbours, show relations, group by kind / attribute, kind
  lens, saved views) and lenses (impact reachability, colour by attribute, relation types).
- **Query** — a small structured language in the command bar (`kind:`, `attr:value`,
  `related:` / `from:` / `to:`, `rel:`, `has:` / `missing:`, `on:`, free text) that places or
  highlights results on the board.

## Quick start

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

The app runs against a local SQLite file with a seeded demo workspace (Acme Energy).
No configuration needed.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js dev server / production build / serve |
| `pnpm typecheck` · `pnpm lint` · `pnpm test` | TypeScript, ESLint, Vitest unit tests |
| `pnpm e2e` | Playwright browser smoke test (needs `pnpm dev` running) |
| `pnpm db:generate` | Generate a Drizzle migration after editing the schema |
| `pnpm db:reset` | Delete the local SQLite file (stop the dev server first); the next start re-seeds the demo |

## Deploy

Railway: deploy the repo, add a volume mounted at `/data`, set `DATABASE_URL=file:/data/nexus.db`,
generate a domain. Details in [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Layout

```
apps/web/          Next.js 16 app — routes, canvas engine, database
docs/BRIEF.md      living product brief (read me first)
docs/API.md        HTTP routes, server actions, query and import formats
docs/DEPLOY.md     deploying to Railway / Docker (persistent SQLite volume)
Dockerfile         production image; railway.json sets the health check
CLAUDE.md          rules for agents working in this repo
```
