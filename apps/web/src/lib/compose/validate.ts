import type { Instruction, LayoutStyle, Vocabulary } from "./script";

/**
 * The boundary between the planner and the board.
 *
 * A model proposes; this decides what is allowed through. Everything the planner returns is
 * validated into the same closed instruction set the rule compiler produces, so the executor
 * never sees anything it does not understand, and a prompt-injected instruction has nothing to
 * inject *into* — the vocabulary of possible actions is fixed here, in code, and none of it
 * touches the graph itself. A board script can only ever read entities and rearrange a document.
 */

const LAYOUTS: LayoutStyle[] = ["grid", "columns", "rows", "circle", "flow", "timeline"];
const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

/** Snap a proposed value to something the workspace actually has, or keep it as written. */
function snap(value: unknown, options: string[]): string {
  const v = String(value ?? "").trim();
  if (!v) return "";
  const hit = options.find((o) => norm(o) === norm(v)) ?? options.find((o) => norm(o).includes(norm(v)));
  return hit ?? v;
}

const str = (v: unknown, max = 400): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => str(x, 80)).filter(Boolean) : []);

export interface ValidationResult {
  instructions: Instruction[];
  /** Steps that were thrown away, with why — surfaced, never swallowed. */
  rejected: string[];
}

/** Turn whatever the planner returned into instructions this codebase can execute. */
export function validateInstructions(raw: unknown, vocab: Vocabulary, max = 24): ValidationResult {
  const rejected: string[] = [];
  const instructions: Instruction[] = [];
  if (!Array.isArray(raw)) return { instructions, rejected: ["the plan was not a list of steps"] };

  for (const step of raw.slice(0, max)) {
    if (!step || typeof step !== "object") { rejected.push("a step that was not an object"); continue; }
    const s = step as Record<string, unknown>;
    const verb = norm(s.verb);

    switch (verb) {
      case "clear":
        instructions.push({ verb: "clear" });
        break;

      case "add": {
        const query = str(s.query, 300);
        if (!query) { rejected.push("add without a query"); continue; }
        const limit = Number(s.limit);
        instructions.push({ verb: "add", query, limit: Number.isFinite(limit) ? Math.min(200, Math.max(1, Math.round(limit))) : 60 });
        break;
      }

      case "remove": {
        const query = str(s.query, 300);
        if (!query) { rejected.push("remove without a query"); continue; }
        instructions.push({ verb: "remove", query });
        break;
      }

      case "expand": {
        const hops = Number(s.hops);
        const direction = ["both", "out", "in"].includes(norm(s.direction)) ? (norm(s.direction) as "both" | "out" | "in") : "both";
        instructions.push({
          verb: "expand",
          hops: Number.isFinite(hops) ? Math.min(4, Math.max(1, Math.round(hops))) : 1,
          relationKinds: list(s.relationKinds).map((k) => snap(k, vocab.relationKinds)),
          direction,
        });
        break;
      }

      case "connect":
        instructions.push({ verb: "connect", relationKinds: list(s.relationKinds).map((k) => snap(k, vocab.relationKinds)) });
        break;

      case "group":
      case "colour":
      case "color": {
        const by = str(s.by, 80) || "kind";
        const isAttribute = !/^(kind|type)s?$/i.test(by);
        instructions.push({
          verb: verb === "group" ? "group" : "colour",
          by: isAttribute ? snap(by, vocab.attributeKeys) : "kind",
          isAttribute,
        });
        break;
      }

      case "layout": {
        const style = LAYOUTS.includes(norm(s.style) as LayoutStyle) ? (norm(s.style) as LayoutStyle) : "grid";
        const by = str(s.by, 80);
        const lanes = str(s.lanes, 80);
        // A timeline needs its axis; the other styles only take a grouping, and only some of them.
        const wantsBy = style === "columns" || style === "rows" || style === "timeline";
        if (style === "timeline" && !by) {
          rejected.push("a timeline with no date attribute to lay out along");
          break;
        }
        instructions.push({
          verb: "layout",
          style,
          by: by && wantsBy ? (/^(kind|type)s?$/i.test(by) ? "kind" : snap(by, vocab.attributeKeys)) : undefined,
          ...(style === "timeline" && lanes ? { lanes: /^(kind|type)s?$/i.test(lanes) ? "kind" : snap(lanes, vocab.attributeKeys) } : {}),
        });
        break;
      }

      case "title":
      case "note": {
        const text = str(s.text, 280);
        if (!text) { rejected.push(`${verb} without any text`); continue; }
        instructions.push({ verb: verb === "title" ? "title" : "note", text });
        break;
      }

      default:
        rejected.push(`“${String(s.verb ?? "")}” is not something a board script can do`);
    }
  }

  if (Array.isArray(raw) && raw.length > max) rejected.push(`only the first ${max} steps were kept`);
  return { instructions, rejected };
}

/** The instruction set, as a JSON schema — what the planner is allowed to return. */
export const PLAN_SCHEMA = {
  type: "object" as const,
  properties: {
    reply: {
      type: "string",
      description: "One or two sentences answering the person, in plain English. Say what the board will show and anything they should know — an assumption you made, or something their question implies that the data cannot answer.",
    },
    steps: {
      type: "array",
      description: "The board script, in order.",
      items: {
        type: "object",
        properties: {
          verb: { type: "string", enum: ["clear", "add", "remove", "expand", "connect", "group", "colour", "layout", "title", "note"] },
          query: { type: "string", description: "For add and remove: a query in the Nexus grammar." },
          limit: { type: "integer", description: "For add: how many objects at most. Default 60." },
          hops: { type: "integer", description: "For expand: 1 to 4." },
          direction: { type: "string", enum: ["both", "out", "in"], description: "For expand." },
          relationKinds: { type: "array", items: { type: "string" }, description: "For expand and connect: restrict to these relation types." },
          by: { type: "string", description: "For group, colour and layout: an attribute key, or 'kind'." },
          style: { type: "string", enum: ["grid", "columns", "rows", "circle", "flow", "timeline"], description: "For layout. 'timeline' lays cards along a date attribute." },
          lanes: { type: "string", description: "For a timeline layout: an attribute key, or 'kind', to make lanes from." },
          text: { type: "string", description: "For title and note." },
        },
        required: ["verb"],
      },
    },
  },
  required: ["reply", "steps"],
};
