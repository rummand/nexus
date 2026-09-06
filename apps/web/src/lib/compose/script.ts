/**
 * Writing a board.
 *
 * The board is the output of a script: you write lines, each line compiles to an instruction, and
 * the document is built from them. No dragging, no placing — the text *is* the layout, so a board
 * can be reasoned about, re-run, diffed and handed to someone else as three sentences.
 *
 * Every line compiles down to the query grammar in src/lib/query.ts, and the compiled form is
 * shown back. That is the whole trick: the English is a convenience, the query is the truth, and
 * you can always see which is which. When a line cannot be understood it says so and suggests the
 * nearest thing it does understand, rather than silently doing nothing.
 */

export interface Vocabulary {
  kinds: string[];
  relationKinds: string[];
  attributeKeys: string[];
}

export type LayoutStyle = "grid" | "columns" | "rows" | "circle" | "flow" | "timeline";

export type Instruction =
  | { verb: "clear" }
  | { verb: "add"; query: string; limit: number }
  | { verb: "remove"; query: string }
  | { verb: "expand"; hops: number; relationKinds: string[]; direction: "both" | "out" | "in" }
  | { verb: "connect"; relationKinds: string[] }
  | { verb: "group"; by: string; isAttribute: boolean }
  | { verb: "layout"; style: LayoutStyle; by?: string; lanes?: string }
  | { verb: "colour"; by: string; isAttribute: boolean }
  | { verb: "title"; text: string }
  | { verb: "note"; text: string }
  | { verb: "unknown"; hint: string };

export interface ParsedLine {
  raw: string;
  instruction: Instruction;
  /** What the line was understood to mean, in the reader's words. */
  echo: string;
}

const DEFAULT_LIMIT = 60;

/** Lines a person writes in a list: bullets, numbers, trailing punctuation. */
function tidy(raw: string): string {
  return raw.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/[.;]+\s*$/, "").trim();
}

/** English plurals, the handful that matter when someone types "people" or "capabilities". */
const IRREGULAR: Record<string, string> = {
  people: "person", men: "man", women: "woman", children: "child", data: "data",
  criteria: "criterion", analyses: "analysis", indices: "index", schemata: "schema",
};
const singular = (v: string) => {
  const w = v.toLowerCase();
  if (IRREGULAR[w]) return IRREGULAR[w];
  if (/(ss|is|us|ata)$/i.test(v)) return v;
  return v.replace(/ies$/i, "y").replace(/s$/i, "");
};
const norm = (v: string) => v.trim().toLowerCase();

/** Exactly this word, allowing for a plural on either side. */
function resolveExact(word: string, options: string[]): string | null {
  const w = norm(singular(word));
  if (!w) return null;
  return options.find((o) => norm(o) === w || norm(singular(o)) === w) ?? null;
}

/**
 * Resolve a spoken word to something the workspace actually uses, falling back to a substring
 * match. The fallback is single-word only: over a phrase it would swallow "applications
 * criticality:high" whole, because the phrase contains "application".
 */
function resolve(word: string, options: string[]): string | null {
  const exact = resolveExact(word, options);
  if (exact) return exact;
  if (/\s/.test(word.trim())) return null;
  const w = norm(singular(word));
  return options.find((o) => norm(o).includes(w) || w.includes(norm(o))) ?? null;
}

const quote = (v: string) => (/\s/.test(v) ? `"${v}"` : v);

/**
 * Turn a phrase into the query grammar.
 *
 * Anything already written in the grammar (`kind:Application`) passes straight through, so the
 * shorthand and the English are the same language and can be mixed on one line.
 */
export function toQuery(phrase: string, vocab: Vocabulary): { query: string; note: string } {
  let rest = phrase.trim();
  const parts: string[] = [];
  const notes: string[] = [];

  // strip the quantifiers that mean "no constraint"
  rest = rest.replace(/^\s*(all|every|any|the|each|some)\s+/i, "").trim();
  if (/^(everything|anything|it|them|these|those)\b/i.test(rest)) rest = rest.replace(/^\S+\s*/, "").trim();

  const eat = (re: RegExp, take: (m: RegExpMatchArray) => void) => {
    const m = rest.match(re);
    if (!m) return;
    take(m);
    rest = (rest.slice(0, m.index).trim() + " " + rest.slice(m.index! + m[0].length).trim()).trim();
  };

  // relation clauses, most specific first
  eat(/\b(?:that\s+)?(?:depends?|depending)\s+(?:up)?on\s+(.+?)(?=$|,| and | with | without | that | which | on the )/i, (m) => {
    parts.push(`to:${quote(m[1]!.trim())}`, `rel:${quote(resolve("depends on", vocab.relationKinds) ?? "depends on")}`);
    notes.push(`things pointing at ${m[1]!.trim()} via “depends on”`);
  });
  eat(/\b(?:that\s+)?(?:feeds?|sends?\s+data\s+to|supplies)\s+(.+?)(?=$|,| and | with | without | that | which | on the )/i, (m) => {
    parts.push(`to:${quote(m[1]!.trim())}`);
    notes.push(`things feeding ${m[1]!.trim()}`);
  });
  eat(/\b(?:connected|related|linked)\s+to\s+(.+?)(?=$|,| and | with | without | that | which | on the )/i, (m) => {
    parts.push(`related:${quote(m[1]!.trim())}`);
    notes.push(`anything joined to ${m[1]!.trim()}`);
  });
  eat(/\b(?:around|near|about)\s+(.+?)(?=$|,| and | with | without | that | which | on the )/i, (m) => {
    parts.push(`related:${quote(m[1]!.trim())}`);
    notes.push(`the neighbourhood of ${m[1]!.trim()}`);
  });
  eat(/\bowned\s+by\s+(.+?)(?=$|,| and | with | without | that | which | on the )/i, (m) => {
    const key = resolve("owner", vocab.attributeKeys) ?? "owner";
    parts.push(`${key}:${quote(m[1]!.trim())}`);
    notes.push(`owned by ${m[1]!.trim()}`);
  });
  eat(/\bon\s+the\s+(.+?)\s+board\b/i, (m) => {
    parts.push(`on:${quote(m[1]!.trim())}`);
    notes.push(`already on the ${m[1]!.trim()} board`);
  });
  eat(/\b(?:with(?:out)?|having|has|missing|no)\s+(?:an?\s+)?([\p{L}_][\p{L}\d _-]*)\b/iu, (m) => {
    const key = resolve(m[1]!.trim(), vocab.attributeKeys);
    if (!key) return;
    const negative = /^(without|missing|no)\b/i.test(m[0]!.trim());
    parts.push(`${negative ? "missing" : "has"}:${quote(key)}`);
    notes.push(negative ? `with no ${key}` : `that have a ${key}`);
  });

  // Whatever is left: a kind, an attribute value, or free text. Longest run of words first, so
  // "business capabilities" resolves once as one kind rather than twice as two.
  const words = rest.split(/\s+(?:and|,)\s+|\s+/).map((w) => w.trim()).filter(Boolean);
  for (let i = 0; i < words.length; ) {
    if (words[i]!.includes(":")) { parts.push(words[i]!); i++; continue; } // already the grammar
    let taken = 0;
    for (let span = Math.min(4, words.length - i); span >= 1; span--) {
      const run = words.slice(i, i + span);
      if (run.some((w) => w.includes(":"))) continue; // a grammar token is not part of a kind
      const phrase = run.join(" ");
      const kind = span === 1 ? resolve(phrase, vocab.kinds) : resolveExact(phrase, vocab.kinds);
      if (!kind) continue;
      parts.push(`kind:${quote(kind)}`);
      notes.push(`of kind ${kind}`);
      taken = span;
      break;
    }
    if (taken === 0) { parts.push(quote(words[i]!)); taken = 1; }
    i += taken;
  }

  return { query: [...new Set(parts)].join(" ").trim(), note: [...new Set(notes)].join(", ") };
}

const RELATION_TAIL = /\s+(?:via|through|along|by|using)\s+(.+)$/i;

export function parseLine(raw: string, vocab: Vocabulary): ParsedLine {
  const line = tidy(raw);
  const fail = (hint: string): ParsedLine => ({ raw, instruction: { verb: "unknown", hint }, echo: hint });
  if (!line || line.startsWith("#")) return { raw, instruction: { verb: "unknown", hint: "" }, echo: "" };

  if (/^(clear|start over|empty(\s+the\s+board)?|blank)$/i.test(line)) {
    return { raw, instruction: { verb: "clear" }, echo: "Empty the board" };
  }

  let m: RegExpMatchArray | null;

  if ((m = line.match(/^(?:title|heading|call\s+it)\s+(.+)$/i))) {
    const text = m[1]!.replace(/^["']|["']$/g, "");
    return { raw, instruction: { verb: "title", text }, echo: `Put “${text}” at the top` };
  }

  if ((m = line.match(/^(?:note|say|write|remark)\s+(.+)$/i))) {
    const text = m[1]!.replace(/^["']|["']$/g, "");
    return { raw, instruction: { verb: "note", text }, echo: `Add a note: “${text}”` };
  }

  if ((m = line.match(/^(?:add|show|put|include|bring(?:\s+in)?|place|find)\s+(.+)$/i))) {
    const limitMatch = m[1]!.match(/\b(?:top|first|max(?:imum)?)\s+(\d{1,3})\b/i);
    const phrase = limitMatch ? m[1]!.replace(limitMatch[0], "").trim() : m[1]!;
    const { query, note } = toQuery(phrase, vocab);
    if (!query) return fail(`I could not tell what to add from “${line}”`);
    return {
      raw,
      instruction: { verb: "add", query, limit: limitMatch ? Number(limitMatch[1]) : DEFAULT_LIMIT },
      echo: `Add ${note || `matching ${query}`} → ${query}`,
    };
  }

  if ((m = line.match(/^(?:remove|drop|hide|exclude|take\s+out|delete)\s+(.+)$/i))) {
    const { query, note } = toQuery(m[1]!, vocab);
    if (!query) return fail(`I could not tell what to remove from “${line}”`);
    return { raw, instruction: { verb: "remove", query }, echo: `Remove ${note || `matching ${query}`} → ${query}` };
  }

  if ((m = line.match(/^(?:expand|follow|walk|explore|extend)\b(.*)$/i))) {
    const tail = m[1]!.trim();
    const hops = Number(tail.match(/(\d+)\s*hops?/i)?.[1] ?? 1);
    const viaMatch = tail.match(RELATION_TAIL);
    const relationKinds = viaMatch ? splitList(viaMatch[1]!).map((v) => resolve(v, vocab.relationKinds) ?? v) : [];
    const direction = /\b(upstream|incoming|into)\b/i.test(tail) ? "in" : /\b(downstream|outgoing|out of)\b/i.test(tail) ? "out" : "both";
    return {
      raw,
      instruction: { verb: "expand", hops: Math.min(4, Math.max(1, hops)), relationKinds, direction },
      echo: `Follow ${hops} hop${hops === 1 ? "" : "s"}${relationKinds.length ? ` via ${relationKinds.join(", ")}` : ""}${direction !== "both" ? ` (${direction})` : ""} from what is already here`,
    };
  }

  if ((m = line.match(/^(?:connect|link|join|draw(?:\s+the)?\s+relations?|show(?:\s+the)?\s+relations?)\b(.*)$/i))) {
    const viaMatch = m[1]!.match(RELATION_TAIL);
    const relationKinds = viaMatch ? splitList(viaMatch[1]!).map((v) => resolve(v, vocab.relationKinds) ?? v) : [];
    return {
      raw,
      instruction: { verb: "connect", relationKinds },
      echo: relationKinds.length ? `Draw the ${relationKinds.join(", ")} relations between what is here` : "Draw every relation between what is here",
    };
  }

  if ((m = line.match(/^(?:group|cluster|organi[sz]e|split)\s+by\s+(.+)$/i))) {
    const by = m[1]!.trim();
    const kindish = /^kinds?$|^types?$/i.test(by);
    const attribute = kindish ? null : resolve(by, vocab.attributeKeys);
    return {
      raw,
      instruction: { verb: "group", by: attribute ?? "kind", isAttribute: !!attribute },
      echo: `Group into frames by ${attribute ?? "kind"}`,
    };
  }

  if ((m = line.match(/^(?:colou?r|shade|tint)\s+by\s+(.+)$/i))) {
    const by = m[1]!.trim();
    const attribute = /^kinds?$|^types?$/i.test(by) ? null : resolve(by, vocab.attributeKeys);
    return { raw, instruction: { verb: "colour", by: attribute ?? "kind", isAttribute: !!attribute }, echo: `Colour by ${attribute ?? "kind"}` };
  }

  if ((m = line.match(/^(?:lay\s?out|arrange|line\s+up|order)\b(.*)$/i))) {
    const tail = m[1]!.trim();
    const by = tail.match(/\bby\s+(.+)$/i)?.[1]?.trim();
    const attribute = by ? resolve(by, vocab.attributeKeys) ?? (/(kind|type)/i.test(by) ? "kind" : by) : undefined;
    const style: LayoutStyle =
      /\btime\s?line|over\s+time|chronolog|roadmap\b/i.test(tail) ? "timeline"
      : /\bcircle|ring\b/i.test(tail) ? "circle"
      : /\brows?\b/i.test(tail) ? "rows"
      : /\bflow|hierarch|layer|tree|chain\b/i.test(tail) ? "flow"
      : /\bcolumns?\b/i.test(tail) || by ? "columns"
      : "grid";

    if (style === "timeline") {
      /*
       * "lay out on a timeline by end of support in lanes by owner". The axis is whichever
       * attribute follows "by", the lanes whatever follows "in lanes by" — both resolved against
       * the workspace's real attribute keys, so a near miss lands on the key somebody meant.
       */
      const lanePhrase = tail.match(/\b(?:in\s+)?lanes?\s+(?:by\s+)?(.+)$/i)?.[1]?.trim();
      const axisPhrase = tail.replace(/\b(?:in\s+)?lanes?\s+(?:by\s+)?.+$/i, "").match(/\bby\s+(.+)$/i)?.[1]?.trim();
      const axis = axisPhrase ? resolve(axisPhrase, vocab.attributeKeys) ?? axisPhrase : undefined;
      const lanes = lanePhrase
        ? (/(kind|type)/i.test(lanePhrase) ? "kind" : resolve(lanePhrase, vocab.attributeKeys) ?? lanePhrase)
        : undefined;
      if (!axis) return fail("A timeline needs a date to lay out along. Try: lay out on a timeline by lifecycle date.");
      return {
        raw,
        instruction: { verb: "layout", style, by: axis, lanes },
        echo: `Lay it out on a timeline by ${axis}${lanes ? ` in lanes by ${lanes}` : ""}`,
      };
    }

    return {
      raw,
      instruction: { verb: "layout", style, by: style === "columns" || style === "rows" ? attribute : undefined },
      echo: `Lay it out as ${style}${attribute && (style === "columns" || style === "rows") ? ` by ${attribute}` : ""}`,
    };
  }

  return fail(`I do not understand “${line}”. Try: add, remove, expand, connect, group by, colour by, lay out, title, note, clear.`);
}

function splitList(v: string): string[] {
  return v.split(/\s*(?:,|and|\+)\s*/i).map((x) => x.replace(/^["']|["']$/g, "").trim()).filter(Boolean);
}

export function parseScript(text: string, vocab: Vocabulary): ParsedLine[] {
  return text.split(/\r?\n/).map((line) => parseLine(line, vocab)).filter((l) => l.raw.trim() !== "" && !l.raw.trim().startsWith("#"));
}
