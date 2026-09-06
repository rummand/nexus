# @nexus/ea-knowledge

A standalone enterprise-architecture knowledge base: a curated, openly-licensed corpus, lexical
retrieval that always answers with citations, and the doctrine agents are grounded in.

It has no dependency on Nexus. The web app is one caller; the CLI in this package is another, and
either can be removed without touching the other.

## Why it is built this way

**A curated corpus, not a crawl.** Every source is registered by hand in `src/sources.ts` with a
licence, a set of topics and a sentence saying what it is good for. A corpus assembled by scraping
whatever is free retrieves badly — the index cannot tell an article that *defines* a term from one
that mentions it in passing — and it cannot be shipped, because nobody checked the terms.

**Licence first.** The corpus is committed to this repository and served from a product, which is
redistribution. So the test is not "can I read it" but "may I ship it". Wikipedia (CC BY-SA 4.0)
and the Twelve-Factor App (MIT) pass. TOGAF, ArchiMate, the BIZBOK and every architecture textbook
do not, so they are listed in `REFERENCES` — cited and linked, never ingested. The ingester
refuses any source whose licence is not on the redistributable list.

**Lexical retrieval, not embeddings.** BM25 over the corpus, with a phrase boost and a cap of two
passages per document. This works with no model API key at all, which is the difference between a
module that stands alone and one that quietly does nothing when a key is missing. It is also
explainable: every hit says which of your words matched, and every passage carries its source,
section, licence and link.

**Two layers: evidence and doctrine.** Retrieval gives an agent evidence. What actually changes an
agent's behaviour is a short rule applied at the moment it decides something — "a capability is
what the organisation does, not the team that does it". Those live in `src/lesson-data.ts`, and
every one of them must quote a passage that is really in the corpus. `lessons.test.ts` checks each
quote against the fetched text and fails if it is not there, which is what stops that file drifting
into folklore that merely sounds like knowledge.

## Using it

```bash
pnpm --filter @nexus/ea-knowledge ingest              # fetch the registered sources into corpus/
pnpm --filter @nexus/ea-knowledge ingest --only togaf # refresh one of them
pnpm --filter @nexus/ea-knowledge ask "capability versus process"
tsx src/cli.ts stats
tsx src/cli.ts lessons compose
tsx src/cli.ts ground compose "group the applications by capability"
```

From code:

```ts
import { retrieve, groundingFor } from "@nexus/ea-knowledge";

const answer = retrieve("how do you rationalise an application portfolio");
for (const hit of answer.hits) console.log(hit.chunk.title, hit.chunk.url);

const prompt = `${SYSTEM}\n\n${groundingFor("compose", userRequest)}`;
```

## Ingesting

The ingest is deliberately slow: one request at a time, a real User-Agent, `Retry-After` honoured,
exponential backoff on 429. Wikimedia rate-limits anonymous traffic hard and a shared egress IP is
usually already hot, so a full run takes on the order of an hour. It writes after every fetch and
skips sources whose text has not changed, so it is resumable and a re-run produces a small diff.

Node's global `fetch` ignores `HTTPS_PROXY` unless told to use it, so the `ingest` script sets
`NODE_USE_ENV_PROXY=1`. That is harmless when there is no proxy and necessary when there is.

A source that cannot be fetched is recorded in `corpus/manifest.json` under `unreachable` and the
run continues. Half a corpus that says which half is missing beats a failed run.

## Layout

| File | What it is |
|---|---|
| `src/sources.ts` | The registry: what to ingest, under which licence, and why. Plus the works we deliberately do not ingest. |
| `src/licenses.ts` | The licences we may redistribute under, and how to attribute each. |
| `src/fetchers.ts` | Reading a source politely; MediaWiki and plain text/Markdown. |
| `src/ingest.ts` | Fetch → normalise → `corpus/documents.jsonl` + `corpus/manifest.json`. |
| `src/chunk.ts` | Documents into passages, carrying the heading path for the citation. |
| `src/tokenize.ts` | Stopping and a deliberately timid stemmer. |
| `src/bm25.ts` | The index, the boosts, and the per-source cap. |
| `src/retrieve.ts` | The public retrieval API and prompt-grounding blocks. |
| `src/lessons.ts`, `src/lesson-data.ts` | The doctrine, each rule quoting the corpus. |
| `src/corpus.ts` | Loading the shipped corpus; the process-wide cached index. |
| `src/cli.ts` | `ea-kb` — the module without the product around it. |
| `corpus/` | The shipped text and its manifest. Generated, but committed on purpose. |

## Adding a source

1. Check the licence. If it does not permit redistribution, add it to `REFERENCES` instead.
2. Add it to the right group in `src/sources.ts` with topics and a one-line reason.
3. `pnpm --filter @nexus/ea-knowledge ingest --only "your title"`.
4. Commit `corpus/documents.jsonl` and `corpus/manifest.json` with the registry change.
