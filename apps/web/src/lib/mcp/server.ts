import { PROTOCOL_VERSIONS, LATEST, SERVER_INFO } from "./protocol";
import { toolByName, toolsFor, type ToolContext } from "./tools";

/**
 * MCP, over one HTTP endpoint.
 *
 * The protocol is JSON-RPC 2.0; the transport is a POST that answers with a single JSON object.
 * That is the simple half of MCP's Streamable HTTP transport, and it is all a server offering
 * plain request/response tools needs — no streaming, no sessions, no server-initiated messages, so
 * nothing to keep alive and nothing to expire.
 *
 * Written by hand rather than with an SDK for the same reason the rest of this codebase is: the
 * whole thing is a hundred lines of dispatch, it has to run inside a Next route on either dialect,
 * and a dependency here would sit exactly on the boundary this feature exists to defend.
 */

export { LATEST, PROTOCOL_VERSIONS, SERVER_INFO } from "./protocol";

export interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const ok = (id: string | number | null, result: unknown): JsonRpcResponse => ({ jsonrpc: "2.0", id, result });
const fail = (id: string | number | null, code: number, message: string): JsonRpcResponse => ({ jsonrpc: "2.0", id, error: { code, message } });

/** JSON-RPC's own codes, plus -32002 for "you are not allowed to call that". */
export const CODES = { parse: -32700, invalid: -32600, noMethod: -32601, badParams: -32602, internal: -32603, denied: -32002 };

/**
 * Handle one message.
 *
 * Returns null for a notification (a message with no id), which the transport answers with 202 and
 * an empty body — that is how `notifications/initialized` is meant to be treated, and answering it
 * with a result is the most common way a hand-written server confuses a client.
 */
export async function handle(message: JsonRpcRequest, ctx: ToolContext): Promise<JsonRpcResponse | null> {
  const id = message.id ?? null;
  const method = typeof message.method === "string" ? message.method : "";
  const isNotification = message.id === undefined || message.id === null;

  if (method.startsWith("notifications/")) return null;

  switch (method) {
    case "initialize": {
      const asked = (message.params?.protocolVersion as string) ?? "";
      return ok(id, {
        protocolVersion: (PROTOCOL_VERSIONS as readonly string[]).includes(asked) ? asked : LATEST,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          `This is ${ctx.workspaceName}'s architecture model in Nexus. Ask list_kinds first to learn the ` +
          `vocabulary this organisation uses, then search_model. Nothing you call changes anything: ` +
          `propose_change puts a suggestion in front of an architect, who decides.`,
      });
    }

    case "ping":
      return ok(id, {});

    case "tools/list":
      return ok(id, {
        tools: toolsFor(ctx.scope).map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
      });

    case "tools/call": {
      const name = String(message.params?.name ?? "");
      const args = (message.params?.arguments ?? {}) as Record<string, unknown>;
      const tool = toolByName(name);
      if (!tool) return fail(id, CODES.badParams, `There is no tool called “${name}”. Call tools/list to see what this key can do.`);
      if (tool.needs && tool.needs !== ctx.scope) {
        return fail(id, CODES.denied, `This key may read the model but not propose changes to it. Ask the workspace's owner for a key with the “propose” scope.`);
      }
      try {
        const text = await tool.run(args, ctx);
        // A tool's own failure is content with isError, not a protocol error: the model on the
        // other end can read it and try again, which a JSON-RPC error does not let it do.
        return ok(id, { content: [{ type: "text", text }], isError: false });
      } catch (error) {
        const text = error instanceof Error ? error.message : "that could not be answered";
        return ok(id, { content: [{ type: "text", text: `That did not work: ${text}` }], isError: true });
      }
    }

    // Declared as unsupported rather than silently empty, so a client stops asking.
    case "resources/list":
    case "prompts/list":
      return fail(id, CODES.noMethod, `Nexus offers tools, not ${method.split("/")[0]}.`);

    default:
      return isNotification ? null : fail(id, CODES.noMethod, `Nexus does not implement “${method}”.`);
  }
}

/** A batch is a list; a single message is an object. Both are legal JSON-RPC. */
export async function handleBody(body: unknown, ctx: ToolContext): Promise<JsonRpcResponse[] | JsonRpcResponse | null> {
  if (Array.isArray(body)) {
    const answers = await Promise.all(body.map((m) => handle(m as JsonRpcRequest, ctx)));
    const kept = answers.filter((a): a is JsonRpcResponse => a !== null);
    return kept.length ? kept : null;
  }
  if (!body || typeof body !== "object") return fail(null, CODES.invalid, "Expected a JSON-RPC message.");
  return handle(body as JsonRpcRequest, ctx);
}
