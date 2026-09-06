/**
 * @nexus/ea-knowledge — a standalone enterprise-architecture knowledge base.
 *
 * Three things, usable separately:
 *   • a curated, openly-licensed corpus (`corpus/`), with a licence recorded per source;
 *   • lexical retrieval that works with no model API key and always returns citations;
 *   • the doctrine agents are grounded in, every rule quoting a passage that is really there.
 *
 * Nothing here imports Nexus. The web app is one caller; the CLI is another.
 */

export * from "./types";
export { LICENSES, license, attributionLine } from "./licenses";
export { SOURCES, REFERENCES } from "./sources";
export { tokenize, stem, words, isStopword } from "./tokenize";
export { chunkDocument, blocks, citationLabel } from "./chunk";
export { Bm25Index, diversify } from "./bm25";
export { retrieve, formatHit, groundingBlock, type Answer, type Citation, type RetrieveOptions } from "./retrieve";
export { knowledgeBase, buildKnowledgeBase, loadCorpus, loadDocuments, loadManifest, resolveCorpusDir, type KnowledgeBase } from "./corpus";
export { allLessons, lessonsFor, rankLessons, groundingFor } from "./lessons";
export { ingest, hashText, readDocuments, type IngestReport, type Manifest } from "./ingest";
export { markdownToText, normalise, USER_AGENT } from "./fetchers";
