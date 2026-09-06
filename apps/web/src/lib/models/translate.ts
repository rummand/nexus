import type { Dialect } from "./types";

/**
 * One request shape, two dialects.
 *
 * Everything in Nexus asks a model the same way: a system prompt, some messages, a closed tool
 * schema, and an instruction to answer with that tool. That shape is Anthropic's, because it is
 * where the product started — and translating it to OpenAI's chat completions is what makes a
 * self-hosted Ollama, a vLLM server or an organisation's own gateway a first-class option rather
 * than a rewrite.
 *
 * The translation is pure both ways, so a sovereign deployment is testable without a sovereign
 * deployment.
 */

export interface ToolSpec {
  name: string;
  description?: string;
  input_schema: unknown;
}

export interface CallRequest {
  system?: string;
  messages: Array<{ role: "user" | "assistant"; content: unknown }>;
  tools?: ToolSpec[];
  /** Anthropic's shape: force a tool, allow any, or leave it. */
  tool_choice?: { type: "tool"; name: string } | { type: "any" } | { type: "auto" };
  max_tokens?: number;
}

/** What every caller here reads back: Anthropic's content blocks. */
export interface ToolUseBlock {
  type: string;
  id?: string;
  name?: string;
  input?: unknown;
  text?: string;
}

export interface CallResponse {
  content?: ToolUseBlock[];
}

/** The wire body for one dialect. */
export function toWire(dialect: Dialect, model: string, request: CallRequest): Record<string, unknown> {
  if (dialect === "anthropic") {
    return { model, max_tokens: request.max_tokens ?? 1600, ...strip(request) };
  }

  /*
   * OpenAI puts the system prompt in the message list and wraps every tool in a `function`
   * envelope. The one thing worth being careful about is `tool_choice`: "answer with exactly this
   * tool" is the whole safety mechanism here (§5.17), so it has to survive the translation intact
   * rather than degrading to "you may use a tool if you like".
   */
  const messages: Array<Record<string, unknown>> = [];
  if (request.system) messages.push({ role: "system", content: request.system });
  for (const message of request.messages) messages.push(fromAnthropicMessage(message));

  const body: Record<string, unknown> = { model, messages, max_tokens: request.max_tokens ?? 1600 };
  if (request.tools?.length) {
    body.tools = request.tools.map((tool) => ({
      type: "function",
      function: { name: tool.name, description: tool.description ?? "", parameters: tool.input_schema },
    }));
    if (request.tool_choice?.type === "tool") body.tool_choice = { type: "function", function: { name: request.tool_choice.name } };
    else if (request.tool_choice?.type === "any") body.tool_choice = "required";
  }
  return body;
}

/**
 * An Anthropic message, in OpenAI's shape.
 *
 * The interesting case is a tool result: Anthropic sends it as a user message containing
 * `tool_result` blocks, OpenAI as one message per result with `role: "tool"`. Compose's inspect
 * loop depends on this, so it is translated rather than dropped.
 */
function fromAnthropicMessage(message: { role: "user" | "assistant"; content: unknown }): Record<string, unknown> {
  if (typeof message.content === "string") return { role: message.role, content: message.content };
  const blocks = Array.isArray(message.content) ? (message.content as Array<Record<string, unknown>>) : [];

  if (message.role === "assistant") {
    const calls = blocks.filter((b) => b.type === "tool_use").map((b) => ({
      id: String(b.id ?? ""),
      type: "function",
      function: { name: String(b.name ?? ""), arguments: JSON.stringify(b.input ?? {}) },
    }));
    const text = blocks.filter((b) => b.type === "text").map((b) => String(b.text ?? "")).join("");
    return calls.length ? { role: "assistant", content: text || null, tool_calls: calls } : { role: "assistant", content: text };
  }

  const results = blocks.filter((b) => b.type === "tool_result");
  if (results.length) {
    // One OpenAI message per result; the caller sends an array and gets an array back.
    return { role: "tool", tool_call_id: String(results[0]!.tool_use_id ?? ""), content: String(results[0]!.content ?? "") };
  }
  const text = blocks.map((b) => String(b.text ?? "")).join("");
  return { role: "user", content: text };
}

/** Every tool result in a message, as separate OpenAI messages. */
export function splitToolResults(message: { role: "user" | "assistant"; content: unknown }): Array<Record<string, unknown>> | null {
  if (message.role !== "user" || !Array.isArray(message.content)) return null;
  const blocks = message.content as Array<Record<string, unknown>>;
  const results = blocks.filter((b) => b.type === "tool_result");
  if (results.length < 2) return null;
  return results.map((b) => ({ role: "tool", tool_call_id: String(b.tool_use_id ?? ""), content: String(b.content ?? "") }));
}

/**
 * The response, back in Anthropic's shape.
 *
 * A model behind an OpenAI-compatible endpoint returns tool arguments as a *string* of JSON, and a
 * small local model sometimes returns a string that is not quite JSON. That is parsed here and a
 * failure becomes no tool call rather than an exception — the validators downstream already know
 * what to do with an answer they cannot read, and they say so better than a stack trace does.
 */
export function fromWire(dialect: Dialect, body: unknown): CallResponse {
  if (dialect === "anthropic") return (body ?? {}) as CallResponse;
  const message = (body as { choices?: Array<{ message?: Record<string, unknown> }> })?.choices?.[0]?.message;
  if (!message) return { content: [] };
  const content: ToolUseBlock[] = [];
  if (typeof message.content === "string" && message.content.trim()) content.push({ type: "text", text: message.content });
  const calls = Array.isArray(message.tool_calls) ? (message.tool_calls as Array<Record<string, unknown>>) : [];
  for (const call of calls) {
    const fn = call.function as { name?: string; arguments?: unknown } | undefined;
    if (!fn?.name) continue;
    content.push({ type: "tool_use", id: String(call.id ?? ""), name: fn.name, input: parseArguments(fn.arguments) });
  }
  return { content };
}

function parseArguments(raw: unknown): unknown {
  if (raw && typeof raw === "object") return raw;
  if (typeof raw !== "string") return {};
  try {
    return JSON.parse(raw);
  } catch {
    // Some small models wrap the JSON in prose or a fence. One salvage attempt, then give up.
    const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(raw)?.[1] ?? raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    try {
      return JSON.parse(fenced);
    } catch {
      return {};
    }
  }
}

/** The path and headers for one dialect. */
export function wireFor(dialect: Dialect, baseUrl: string, apiKey: string): { url: string; headers: Record<string, string> } {
  const root = baseUrl.replace(/\/+$/, "");
  if (dialect === "anthropic") {
    return {
      url: `${root}/v1/messages`,
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    };
  }
  // A gateway's base URL usually already ends in /v1; adding a second one is the commonest mistake.
  const url = /\/v\d+$/.test(root) ? `${root}/chat/completions` : `${root}/v1/chat/completions`;
  const headers: Record<string, string> = { "content-type": "application/json" };
  // A local model needs no key, and sending "Bearer undefined" makes some servers refuse outright.
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  return { url, headers };
}

function strip(request: CallRequest): Record<string, unknown> {
  const { system, messages, tools, tool_choice } = request;
  const out: Record<string, unknown> = { messages };
  if (system) out.system = system;
  if (tools?.length) out.tools = tools;
  if (tool_choice) out.tool_choice = tool_choice;
  return out;
}
