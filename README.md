# Nexus

**AI-native enterprise architecture canvas.** Feed Nexus everything your organisation has —
portfolios, processes, CMDBs, OT data, wikis, meeting notes — and its agents grow the
meta-model from the data instead of forcing the data into a vendor's model. Everything
lives in one graph and is touchable on an infinite, Mural-like canvas.

> Read **[`docs/BRIEF.md`](docs/BRIEF.md)** first. It is the living product brief: vision,
> architecture, what exists, roadmap, decisions. Every change updates it.

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

## Layout

```
apps/web/          Next.js 16 app — routes, canvas engine, database
docs/BRIEF.md      living product brief (read me first)
CLAUDE.md          rules for agents working in this repo
```
