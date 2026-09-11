import { callModel } from "@/lib/models/call";
import type { ModelChoice } from "@/lib/models/types";
import type { ProseClaim } from "./stage";

/**
 * Reading an architecture out of a picture (§5.91).
 *
 * The fifth thing an architect has, after the ServiceNow export, the old spreadsheet, the Word
 * documents and the SharePoint dump: a diagram. Usually the *only* record of a solution
 * architecture, usually in a slide deck, and usually the thing somebody is looking at while they
 * tell you the model is wrong.
 *
 * A diagram is a source of claims like any other, so it joins the pipeline at exactly the point
 * prose does (§5.38) and everything downstream is unchanged: folded with the tables, matched
 * against the graph, reviewed row by row, laid out on a board, routed by the rules (§5.90). What
 * is new is one step at the front, and the discipline around it is the same discipline intake
 * already has — **nothing the model says is taken on trust.**
 *
 * Three validations, each one a way this goes wrong in practice:
 *
 * - A box with no readable label is not an object. Vision models will happily name an arrowhead.
 * - A connection may only join two boxes the model itself named. An edge to something it did not
 *   list is a hallucinated end, and half a relation is worse than none.
 * - Everything is bounded. A busy slide has forty boxes; four hundred means it has misread a
 *   table or a legend, and the honest answer is to stop rather than to stage four hundred rows.
 *
 * The claim carries the *label as drawn* as its quote, so the review can show what it read and a
 * person can disagree with the picture rather than with the machine.
 */

export interface DiagramImage {
  name: string;
  mediaType: string;
  /** Base64, as read from the file. */
  data: string;
}

/** What came out, and one sentence about how it went. */
export interface DiagramRead {
  claims: ProseClaim[];
  note: string;
}

/** A busy architecture slide. Past this it has misread a table, a legend or a backlog. */
const MAX_OBJECTS = 120;
const MAX_RELATIONS = 240;

const TOOL = {
  name: "record_diagram",
  description: "Record the architecture drawn in this picture: the boxes, what each one is, and the lines between them.",
  input_schema: {
    type: "object" as const,
    properties: {
      objects: {
        type: "array",
        description: "One entry per box, node or labelled shape that names a real thing. Skip titles, legends, keys and decoration.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "The label exactly as drawn." },
            kind: { type: "string", description: "What sort of thing it is, in the vocabulary given, or your best reading of the drawing." },
            description: { type: "string", description: "Anything else the picture says about it: a subtitle, a note, a technology in brackets." },
            group: { type: "string", description: "The label of the box or swimlane it is drawn inside, if any." },
          },
          required: ["name"],
        },
      },
      relations: {
        type: "array",
        description: "One entry per line or arrow between two boxes you listed.",
        items: {
          type: "object",
          properties: {
            from: { type: "string", description: "The label the line starts at." },
            to: { type: "string", description: "The label it ends at." },
            kind: { type: "string", description: "What the line is labelled, or how it reads: depends on, sends data to, calls." },
          },
          required: ["from", "to"],
        },
      },
      note: { type: "string", description: "One sentence: what kind of diagram this is and anything you could not read." },
    },
    required: ["objects"],
  },
};

const SYSTEM = [
  "You are reading an architecture diagram for an enterprise architecture repository.",
  "Record what is drawn, not what you would expect to be drawn: if a box says SAP PM, it says SAP PM.",
  "A label you cannot read is not a box. A line whose ends you cannot identify is not a relation.",
  "Do not invent systems that are implied but not drawn, and do not expand abbreviations.",
].join(" ");

/** What the model is asked, given what this workspace already calls things. */
export function promptFor(image: DiagramImage, vocabulary: string[]): string {
  const known = vocabulary.filter(Boolean).slice(0, 60);
  return [
    `This picture is called “${image.name}”.`,
    known.length
      ? `This organisation already uses these type names: ${known.join(", ")}. Use them where one fits; use your own reading where none does.`
      : "There is no type vocabulary yet, so use your own reading of the drawing.",
    "Record every box you can read a label on, and every line between two of them.",
  ].join(" ");
}

/** Everything the model may return, before any of it is believed. */
interface RawDiagram {
  objects?: Array<{ name?: unknown; kind?: unknown; description?: unknown; group?: unknown }>;
  relations?: Array<{ from?: unknown; to?: unknown; kind?: unknown }>;
  note?: unknown;
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * The model's answer, validated into claims. Pure, so every rule above is testable without a
 * model, a network or a picture.
 */
export function claimsFromDiagram(raw: RawDiagram, source: string): DiagramRead {
  const objects = (Array.isArray(raw.objects) ? raw.objects : []).slice(0, MAX_OBJECTS);
  const byName = new Map<string, ProseClaim>();
  let unnamed = 0;

  for (const object of objects) {
    const name = text(object.name, 160);
    if (!name) { unnamed++; continue; }
    if (byName.has(norm(name))) continue; // the same box read twice is one box
    const group = text(object.group, 160);
    byName.set(norm(name), {
      name,
      kind: text(object.kind, 60),
      description: text(object.description, 400),
      attributes: {},
      // The claim says where it was read from, in the words of the picture: "drawn in <source>".
      relations: group && norm(group) !== norm(name) ? [{ kind: "part of", target: group, quote: `drawn inside “${group}” in ${source}` }] : [],
      confidence: "read from a diagram",
    });
  }

  let dangling = 0;
  const relations = (Array.isArray(raw.relations) ? raw.relations : []).slice(0, MAX_RELATIONS);
  for (const relation of relations) {
    const from = byName.get(norm(text(relation.from, 160)));
    const toName = text(relation.to, 160);
    const to = byName.get(norm(toName));
    // Both ends must be boxes the model itself listed: an edge into thin air is a hallucination,
    // and half a relation is worse than no relation.
    if (!from || !to || from === to) { dangling++; continue; }
    from.relations.push({ kind: text(relation.kind, 60) || "connects to", target: toName, quote: `a line from “${from.name}” to “${toName}” in ${source}` });
  }

  const claims = [...byName.values()];
  const parts = [`Read ${claims.length} object${claims.length === 1 ? "" : "s"} and ${claims.reduce((n, c) => n + c.relations.length, 0)} connection${claims.reduce((n, c) => n + c.relations.length, 0) === 1 ? "" : "s"} from the picture.`];
  const said = text(raw.note, 300);
  if (said) parts.push(said);
  if (unnamed) parts.push(`${unnamed} shape${unnamed === 1 ? "" : "s"} had no readable label and ${unnamed === 1 ? "was" : "were"} left out.`);
  if (dangling) parts.push(`${dangling} line${dangling === 1 ? "" : "s"} did not join two boxes it had named, so ${dangling === 1 ? "it was" : "they were"} dropped.`);
  return { claims, note: parts.join(" ") };
}

/** Show the picture to the model and read what it says. The one step here that costs money. */
export async function readDiagram(image: DiagramImage, vocabulary: string[], choice: ModelChoice): Promise<DiagramRead> {
  const answer = await callModel(choice, {
    system: SYSTEM,
    max_tokens: 4000,
    tools: [TOOL],
    // The whole safety mechanism (§5.17): one tool, forced, so the answer is a shape rather than
    // a paragraph somebody has to parse.
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
        { type: "text", text: promptFor(image, vocabulary) },
      ],
    }],
  });

  const used = (answer.content ?? []).find((block) => block.type === "tool_use" && block.name === TOOL.name);
  if (!used?.input) return { claims: [], note: "The model looked at the picture and did not record anything from it." };
  return claimsFromDiagram(used.input as RawDiagram, image.name);
}
