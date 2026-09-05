import type { Passage, SourceKind } from "./types";

/**
 * Turning a raw upload into passages.
 *
 * Meeting exports are a small zoo — Teams and Zoom each write two or three shapes, and half the
 * time what arrives is a pasted block with no timestamps at all — so this recognises the common
 * forms rather than demanding one. Anything it cannot read as a conversation falls back to
 * paragraphs, which is the right answer for a document.
 */

const VTT_TIME = /^(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?\s*-->\s*(?:\d{1,2}:)?\d{1,2}:\d{2}/;
/** "Jesper Solberg:" or "Jesper Solberg (Energinet):" at the head of a line. */
const INLINE_SPEAKER = /^([\p{Lu}][\p{L}.'-]*(?:\s+[\p{L}.'()-]+){0,4})\s*:\s*(.*)$/u;
/** "Jesper Solberg   0:12" — a speaker header with the time and nothing else. */
const HEADER_SPEAKER = /^([\p{Lu}][\p{L}.'-]*(?:\s+[\p{L}.'()-]+){0,4})\s{2,}((?:\d{1,2}:)?\d{1,2}:\d{2})\s*$/u;
/** "[00:12] Jesper Solberg: …" */
const BRACKET_SPEAKER = /^\[((?:\d{1,2}:)?\d{1,2}:\d{2}(?::\d{2})?)\]\s*([\p{L}][\p{L}.'-]*(?:\s+[\p{L}.'()-]+){0,4})\s*:\s*(.*)$/u;

/** Words that end a line but are not a speaker, so "Note:" or "Agenda:" is not read as a person. */
const NOT_A_SPEAKER = new Set([
  "note", "notes", "agenda", "attendees", "participants", "summary", "action", "actions",
  "decision", "decisions", "topic", "subject", "date", "time", "location", "next steps", "todo",
]);

/**
 * A conversation, or a document with colons in it?
 *
 * Two different people talking is the giveaway — a memo can easily contain three "Something:"
 * lines, but rarely two names that each speak. Three speaker lines settle it either way, so a
 * monologue still reads as a transcript.
 */
export function looksLikeTranscript(text: string): boolean {
  const head = text.slice(0, 4000);
  if (/^﻿?WEBVTT/.test(head)) return true;
  let hits = 0;
  const names = new Set<string>();
  for (const line of head.split(/\r?\n/)) {
    const l = line.trim();
    if (!l) continue;
    const header = HEADER_SPEAKER.exec(l);
    const bracket = BRACKET_SPEAKER.exec(l);
    const inline = INLINE_SPEAKER.exec(l);
    const name = header?.[1] ?? bracket?.[2] ?? (inline && !NOT_A_SPEAKER.has(inline[1]!.trim().toLowerCase()) ? inline[1] : undefined);
    if (!name) continue;
    hits++;
    names.add(cleanSpeaker(name));
    if (hits >= 3 || names.size >= 2) return true;
  }
  return false;
}

export function detectSourceKind(text: string): SourceKind {
  if (looksLikeTranscript(text)) return "transcript";
  const head = text.trim().slice(0, 400);
  if (head.startsWith("{") || head.startsWith("[")) return "table";
  if (/^(kind|from)\s*[,;]/i.test(head)) return "table";
  return "document";
}

/** Split a source into passages: speaker turns for a transcript, paragraphs for a document. */
export function parsePassages(text: string): Passage[] {
  const clean = text.replace(/﻿/g, "");
  const turns = /^\s*WEBVTT/.test(clean) ? parseVtt(clean) : parseLines(clean);
  const merged = mergeTurns(turns);
  if (merged.length > 0) return merged.map((t, i) => ({ id: `p${i + 1}`, index: i, ...t }));
  return paragraphs(clean).map((t, i) => ({ id: `p${i + 1}`, index: i, speaker: "", at: "", text: t }));
}

interface Turn { speaker: string; at: string; text: string }

function parseVtt(text: string): Turn[] {
  const out: Turn[] = [];
  let at = "";
  let buffer: string[] = [];
  let speaker = "";
  const flush = () => {
    const body = buffer.join(" ").trim();
    if (body) out.push({ speaker, at, text: body });
    buffer = [];
    speaker = "";
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /^WEBVTT/.test(line) || /^(NOTE|STYLE|REGION)\b/.test(line)) { flush(); continue; }
    if (VTT_TIME.test(line)) { flush(); at = line.split("-->")[0]!.trim(); continue; }
    if (/^\d+$/.test(line)) continue; // cue number
    // <v Jesper Solberg>text</v>, or "Jesper Solberg: text" inside the cue
    const voice = /^<v\s+([^>]+)>(.*?)(?:<\/v>)?$/.exec(line);
    if (voice) {
      speaker = cleanSpeaker(voice[1]!);
      buffer.push(voice[2]!.trim());
      continue;
    }
    const inline = INLINE_SPEAKER.exec(line);
    if (inline && !NOT_A_SPEAKER.has(inline[1]!.trim().toLowerCase()) && buffer.length === 0) {
      speaker = cleanSpeaker(inline[1]!);
      buffer.push(inline[2]!.trim());
      continue;
    }
    buffer.push(stripTags(line));
  }
  flush();
  return out;
}

function parseLines(text: string): Turn[] {
  const out: Turn[] = [];
  let speaker = "";
  let at = "";
  let buffer: string[] = [];
  const flush = () => {
    const body = buffer.join(" ").trim();
    if (body && speaker) out.push({ speaker, at, text: body });
    buffer = [];
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { flush(); continue; }

    const bracket = BRACKET_SPEAKER.exec(line);
    if (bracket) {
      flush();
      at = bracket[1]!;
      speaker = cleanSpeaker(bracket[2]!);
      if (bracket[3]!.trim()) buffer.push(bracket[3]!.trim());
      continue;
    }
    const header = HEADER_SPEAKER.exec(line);
    if (header && !NOT_A_SPEAKER.has(header[1]!.trim().toLowerCase())) {
      flush();
      speaker = cleanSpeaker(header[1]!);
      at = header[2]!;
      continue;
    }
    const inline = INLINE_SPEAKER.exec(line);
    // A speaker line names a person and then talks; "Risk: the licence expires" does not.
    if (inline && !NOT_A_SPEAKER.has(inline[1]!.trim().toLowerCase()) && inline[1]!.split(/\s+/).length <= 5) {
      flush();
      speaker = cleanSpeaker(inline[1]!);
      if (inline[2]!.trim()) buffer.push(inline[2]!.trim());
      continue;
    }
    if (speaker) buffer.push(line);
  }
  flush();
  return out;
}

/** Consecutive turns by the same speaker are one contribution, not several. */
function mergeTurns(turns: Turn[]): Turn[] {
  const out: Turn[] = [];
  for (const t of turns) {
    const last = out[out.length - 1];
    if (last && last.speaker === t.speaker) last.text = `${last.text} ${t.text}`.trim();
    else out.push({ ...t });
  }
  return out;
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);
}

const stripTags = (v: string) => v.replace(/<[^>]*>/g, "").trim();

/** "JESPER SOLBERG (Energinet)" → "Jesper Solberg". */
function cleanSpeaker(raw: string): string {
  const name = raw.replace(/\s*\([^)]*\)\s*$/, "").replace(/\s+/g, " ").trim();
  if (name === name.toUpperCase() && /[\p{L}]/u.test(name)) {
    return name.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, p, c: string) => p + c.toUpperCase());
  }
  return name;
}

/** Speakers in first-appearance order. */
export function speakersOf(passages: Passage[]): string[] {
  const seen: string[] = [];
  for (const p of passages) if (p.speaker && !seen.includes(p.speaker)) seen.push(p.speaker);
  return seen;
}
