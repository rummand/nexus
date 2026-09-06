#!/usr/bin/env tsx
/**
 * `ea-kb` — the knowledge base without the product around it.
 *
 * This exists so the module can be shown to be standalone rather than merely described that way:
 * ingest, search, inspect and ground, from a terminal, with no database, no server and no model
 * API key. If any of these needed Nexus, the separation would be a fiction.
 *
 *   pnpm --filter @nexus/ea-knowledge ingest [--only togaf] [--delay 1500]
 *   pnpm --filter @nexus/ea-knowledge ask "what is a business capability"
 *   pnpm --filter @nexus/ea-knowledge stats
 *   tsx src/cli.ts lessons [scope]
 *   tsx src/cli.ts ground compose "group applications by capability"
 */

import { buildKnowledgeBase, loadCorpus, resolveCorpusDir } from "./corpus";
import { citationLabel } from "./chunk";
import { ingest } from "./ingest";
import { LICENSES } from "./licenses";
import { REFERENCES, SOURCES } from "./sources";
import { retrieve } from "./retrieve";
import { lessonsFor, allLessons, groundingFor } from "./lessons";
import type { LessonScope } from "./types";

const [command, ...rest] = process.argv.slice(2);

function flag(name: string): string | undefined {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
}
const positional = () => rest.filter((a, i) => !a.startsWith("--") && !(i > 0 && rest[i - 1]!.startsWith("--"))).join(" ");

async function main() {
  switch (command) {
    case "ingest": {
      const report = await ingest({
        only: flag("only"),
        delayMs: Number(flag("delay") ?? 1200),
        log: (line) => console.log(line),
      });
      console.log(
        `\n${report.fetched.length} fetched, ${report.unchanged.length} unchanged, ${report.failed.length} failed, ${report.skipped.length} skipped by licence.`,
      );
      console.log(`corpus: ${report.documents} documents, ${report.characters.toLocaleString()} characters`);
      for (const f of report.failed) console.log(`  unreachable: ${f.id} — ${f.error}`);
      break;
    }
    case "ask": {
      const query = positional();
      if (!query) return console.error('usage: ask "your question"');
      const answer = retrieve(query, { limit: Number(flag("limit") ?? 5) });
      if (answer.empty) return console.error("no corpus on disk — run `ingest` first");
      if (!answer.hits.length) {
        console.log(`nothing matched.${answer.unknownTerms.length ? ` The corpus has never seen: ${answer.unknownTerms.join(", ")}` : ""}`);
        return;
      }
      for (const [i, hit] of answer.hits.entries()) {
        console.log(`\n[${i + 1}] ${citationLabel(hit.chunk)}  (score ${hit.score.toFixed(2)}, matched ${hit.matched.join(", ")})`);
        console.log(hit.chunk.text);
        console.log(`    ${hit.chunk.url} — ${LICENSES[hit.chunk.license]?.name}`);
      }
      break;
    }
    case "stats": {
      const dir = resolveCorpusDir();
      const kb = buildKnowledgeBase(loadCorpus());
      console.log(`corpus directory : ${dir ?? "(none found)"}`);
      console.log(`documents        : ${kb.corpus.documents.length} of ${SOURCES.length} registered sources`);
      console.log(`passages         : ${kb.chunks.length}`);
      console.log(`characters       : ${kb.corpus.documents.reduce((n, d) => n + d.text.length, 0).toLocaleString()}`);
      console.log(`lessons          : ${allLessons().length}`);
      const byLicense = new Map<string, number>();
      for (const d of kb.corpus.documents) byLicense.set(d.license, (byLicense.get(d.license) ?? 0) + 1);
      console.log(`licences         : ${[...byLicense].map(([l, n]) => `${n}× ${l}`).join(", ")}`);
      console.log(`referenced only  : ${REFERENCES.length} works that cannot be redistributed`);
      break;
    }
    case "lessons": {
      const scope = rest[0] as LessonScope | undefined;
      const lessons = scope ? lessonsFor(scope) : allLessons();
      for (const lesson of lessons) {
        console.log(`\n• ${lesson.statement}`);
        console.log(`  ${lesson.detail}`);
        console.log(`  cites ${lesson.citation.sourceId}: “${lesson.citation.quote.slice(0, 120)}…”`);
      }
      console.log(`\n${lessons.length} lesson(s)${scope ? ` for ${scope}` : ""}.`);
      break;
    }
    case "ground": {
      const scope = (rest[0] ?? "compose") as LessonScope;
      const task = rest.slice(1).join(" ");
      console.log(groundingFor(scope, task));
      break;
    }
    default:
      console.log(`ea-kb — the Nexus enterprise-architecture knowledge base

  ingest [--only <text>] [--delay <ms>]   fetch the registered sources into corpus/
  ask "<question>" [--limit n]            search the corpus, with citations
  stats                                   what is in the corpus right now
  lessons [scope]                         the doctrine agents are grounded in
  ground <scope> <task>                   the grounding block for a task`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
