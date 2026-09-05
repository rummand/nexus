import type { Candidate, CandidateRelation, Confidence, Mention, Passage, Viewpoint, ViewpointType } from "./types";
import type { Vocabulary } from "./extract";

/**
 * What a model is allowed to claim about a source.
 *
 * The rule extractor could only find what a rule described; a model can read. The price is that it
 * can also invent, so nothing it returns is taken on trust. Every claim must cite a passage and
 * quote it, and **the quote is checked against the passage** — not the shape of the citation, the
 * text itself. A candidate whose evidence cannot be found in the source is dropped and reported as
 * dropped.
 *
 * That check is what makes a model safe here in a way it is not elsewhere: unlike a board script,
 * an extraction is a claim about a document that is right there to compare against.
 */

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
const keyOf = (kind: string, name: string) => `${norm(kind)}|${norm(name)}`;
const str = (v: unknown, max = 400) => (typeof v === "string" ? v.trim().slice(0, max) : "");

const MAX_OBJECTS = 120;
const MAX_RELATIONS = 200;
const MAX_VIEWPOINTS = 80;
const VIEWPOINT_TYPES: ViewpointType[] = ["decision", "action", "risk", "question", "need"];

export interface ModelExtraction {
  candidates: Candidate[];
  relations: CandidateRelation[];
  viewpoints: Viewpoint[];
  /** Claims that were thrown away, and why. Surfaced, never swallowed. */
  rejected: string[];
}

/** Loose comparison: the model may re-wrap whitespace or change case when it quotes. */
function quoteIsIn(passage: Passage, quote: string): boolean {
  const haystack = norm(passage.text);
  const needle = norm(quote);
  if (needle.length < 8) return false; // too short to be evidence of anything
  if (haystack.includes(needle)) return true;
  // Allow an elided middle ("A … B"), which is how a careful quoter shortens a long sentence.
  const parts = needle.split(/\s*(?:…|\.\.\.)\s*/).filter((p) => p.length >= 8);
  return parts.length > 1 && parts.every((p) => haystack.includes(p));
}

function snap(value: string, options: string[]): string {
  const v = value.trim();
  if (!v) return "";
  return options.find((o) => norm(o) === norm(v)) ?? v;
}

const confidenceOf = (v: unknown): Confidence =>
  v === "high" || v === "medium" || v === "low" ? v : "medium";

export function validateExtraction(raw: unknown, passages: Passage[], vocab: Vocabulary): ModelExtraction {
  const rejected: string[] = [];
  const byId = new Map(passages.map((p) => [p.id, p]));
  const speakers = new Set(passages.map((p) => p.speaker).filter(Boolean));
  const out: ModelExtraction = { candidates: [], relations: [], viewpoints: [], rejected };
  if (!raw || typeof raw !== "object") {
    rejected.push("the extraction was not an object");
    return out;
  }
  const body = raw as { objects?: unknown; connections?: unknown; viewpoints?: unknown };

  /** Turn a claimed citation into a mention, or say why it is not one. */
  const mentionsFrom = (claimed: unknown, label: string): Mention[] => {
    if (!Array.isArray(claimed)) return [];
    const mentions: Mention[] = [];
    for (const item of claimed.slice(0, 6)) {
      if (!item || typeof item !== "object") continue;
      const cite = item as { passage?: unknown; text?: unknown };
      const passage = byId.get(str(cite.passage, 40));
      const quote = str(cite.text, 400);
      if (!passage) { rejected.push(`${label}: cited a passage that does not exist`); continue; }
      if (!quoteIsIn(passage, quote)) { rejected.push(`${label}: quoted words that are not in ${passage.id}`); continue; }
      mentions.push({ passageId: passage.id, speaker: passage.speaker, quote });
    }
    return mentions;
  };

  // ---- objects ------------------------------------------------------------------------------
  const byKey = new Map<string, Candidate>();
  if (Array.isArray(body.objects)) {
    for (const item of body.objects.slice(0, MAX_OBJECTS)) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const name = str(o.name, 120);
      if (!name) { rejected.push("an object with no name"); continue; }
      const kind = snap(str(o.kind, 60), vocab.kinds);
      const mentions = mentionsFrom(o.quotes, `“${name}”`);
      if (mentions.length === 0) { rejected.push(`“${name}”: nothing in the source says so`); continue; }
      const key = keyOf(kind, name);
      if (byKey.has(key)) continue;
      byKey.set(key, {
        key,
        kind,
        name,
        description: str(o.description, 400),
        attributes: {},
        confidence: confidenceOf(o.confidence),
        reason: str(o.why, 200) || "read from the source",
        mentions,
      });
    }
  }
  out.candidates = [...byKey.values()];

  /** Resolve a name the model used back to something it actually proposed. */
  const findCandidate = (name: string): Candidate | undefined => {
    const n = norm(name);
    return out.candidates.find((c) => norm(c.name) === n) ?? out.candidates.find((c) => norm(c.name).includes(n) && n.length > 3);
  };

  // ---- connections --------------------------------------------------------------------------
  if (Array.isArray(body.connections)) {
    const seen = new Set<string>();
    for (const item of body.connections.slice(0, MAX_RELATIONS)) {
      if (!item || typeof item !== "object") continue;
      const r = item as Record<string, unknown>;
      const from = findCandidate(str(r.from, 120));
      const to = findCandidate(str(r.to, 120));
      const kind = snap(str(r.kind, 60), vocab.relationKinds);
      if (!from || !to) { rejected.push(`a connection between things it did not propose (${str(r.from, 60)} → ${str(r.to, 60)})`); continue; }
      if (from.key === to.key) continue;
      if (!kind) { rejected.push(`a connection with no relation type (${from.name} → ${to.name})`); continue; }
      const mentions = mentionsFrom(r.quotes, `${from.name} → ${to.name}`);
      if (mentions.length === 0) { rejected.push(`${from.name} → ${to.name}: nothing in the source says so`); continue; }
      const key = `${from.key}>${norm(kind)}>${to.key}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.relations.push({
        key, from: from.key, to: to.key, kind,
        confidence: confidenceOf(r.confidence),
        reason: str(r.why, 200) || "read from the source",
        mentions,
      });
    }
  }

  // ---- viewpoints ---------------------------------------------------------------------------
  if (Array.isArray(body.viewpoints)) {
    const seen = new Set<string>();
    for (const item of body.viewpoints.slice(0, MAX_VIEWPOINTS)) {
      if (!item || typeof item !== "object") continue;
      const v = item as Record<string, unknown>;
      const type = VIEWPOINT_TYPES.find((t) => t === norm(str(v.type, 20)));
      const text = str(v.text, 400);
      const passage = byId.get(str(v.passage, 40));
      if (!type) { rejected.push(`a viewpoint of a type that does not exist (${str(v.type, 30)})`); continue; }
      if (!passage) { rejected.push(`a ${type} citing a passage that does not exist`); continue; }
      if (!quoteIsIn(passage, text)) { rejected.push(`a ${type} whose words are not in ${passage.id}`); continue; }
      // The speaker is whoever actually spoke that passage, not whoever the model named.
      const speaker = passage.speaker || (speakers.has(str(v.speaker, 80)) ? str(v.speaker, 80) : "");
      const key = `${type}:${norm(text).slice(0, 80)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const about = Array.isArray(v.about)
        ? v.about.map((a) => findCandidate(str(a, 120))?.key).filter((k): k is string => !!k)
        : [];
      out.viewpoints.push({ key, type, speaker, text, passageId: passage.id, about, confidence: confidenceOf(v.confidence) });
    }
  }

  return out;
}

/** The shape a planner must return. Mirrors the internal types, minus anything it should not set. */
export const EXTRACTION_SCHEMA = {
  type: "object" as const,
  properties: {
    objects: {
      type: "array",
      description: "The things this source is about: systems, capabilities, people, subjects. Not the statements made about them.",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "What it is called, as the source calls it." },
          kind: { type: "string", description: "Its type. Prefer a kind this workspace already uses." },
          description: { type: "string" },
          why: { type: "string", description: "One short line on why you believe it exists." },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          quotes: {
            type: "array",
            description: "Verbatim evidence. Every object needs at least one; anything you cannot quote is dropped.",
            items: {
              type: "object",
              properties: { passage: { type: "string", description: "The passage id, e.g. p3." }, text: { type: "string", description: "The words, copied exactly from that passage." } },
              required: ["passage", "text"],
            },
          },
        },
        required: ["name", "quotes"],
      },
    },
    connections: {
      type: "array",
      description: "Relations the source states between two of the objects above.",
      items: {
        type: "object",
        properties: {
          from: { type: "string" }, to: { type: "string" },
          kind: { type: "string", description: "The relation type, e.g. 'depends on'. Prefer one this workspace already uses." },
          why: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          quotes: { type: "array", items: { type: "object", properties: { passage: { type: "string" }, text: { type: "string" } }, required: ["passage", "text"] } },
        },
        required: ["from", "to", "kind", "quotes"],
      },
    },
    viewpoints: {
      type: "array",
      description: "What people made of it: decisions taken, actions owed, risks raised, questions left open, needs stated.",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["decision", "action", "risk", "question", "need"] },
          text: { type: "string", description: "The words themselves, copied from the passage." },
          passage: { type: "string", description: "The passage id they were said in." },
          about: { type: "array", items: { type: "string" }, description: "Names of objects above that this concerns." },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["type", "text", "passage"],
      },
    },
  },
  required: ["objects"],
};
