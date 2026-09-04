# Nexus — agent instructions

Nexus is an AI-native enterprise architecture platform: an infinite canvas where an
organisation's data becomes a living, agent-built graph.

## Read this first

`docs/BRIEF.md` is the single source of truth for the product vision, the current
architecture, the roadmap and the decision log. **Read it before doing any work.**

## Keep the brief alive (mandatory)

Every time you add, change or remove functionality you MUST update `docs/BRIEF.md`
in the same change:

1. Update the relevant section (architecture, data model, canvas engine, UI).
2. Move roadmap items you completed into "What exists today".
3. Append an entry to the changelog at the bottom (date + one-paragraph summary).
4. Record any non-obvious decision in the decision log with the reasoning.

A change without a brief update is incomplete.

## Repository layout

- `apps/web` — Next.js 16 app (App Router, React 19, TypeScript, Tailwind v4).
  - `src/app` — routes (workspace management + board canvas + API).
  - `src/canvas` — the infinite-canvas engine (store, geometry, interaction, rendering).
  - `src/db` — Drizzle ORM schema, client, migrations, seed.
  - `src/components` — shared UI.
- `docs/` — product brief and design notes.
- `packages/` — reserved for shared packages (canvas core, meta-model, connectors).

## Conventions

- TypeScript strict. No `any` unless justified in a comment.
- Server components by default; `"use client"` only where interaction is needed.
- Canvas coordinates: world space is the document; screen space is the viewport.
  Never store screen coordinates in the document.
- Persisted board documents are versioned JSON (`version` field). Add a migration
  when the shape changes.
- Run `pnpm typecheck && pnpm lint && pnpm test` before committing.
