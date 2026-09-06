import { LATEST, SERVER_INFO } from "./protocol";

/**
 * Nexus asking somebody else's MCP server.
 *
 * The other direction of §5.33, and the cheapest possible answer to the catalogue's unbuilt half
 * (§5.16): an organisation's CMDB, wiki or ticket tracker increasingly speaks MCP already, and a
 * server that does needs no connector written for it.
 *
 * What comes back is **text, not truth**. It goes into the intake pipeline (§5.15), which reads it
 * for claims, checks every claim against the words it came from, and puts what survives in front of
 * a person. There is deliberately no path from a tool's answer to the graph that does not pass
 * through that review — a remote server is an unreliable narrator with an API, and treating it as
 * an authority would undo the discipline the rest of the product is built on.
 */

export interface RemoteTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface RemoteServer {
  url: string;
  apiKey: string;
}

export interface RemoteResult {
  ok: boolean;
  /** What the tool said, flattened to text. */
  text: string;
  /** What went wrong, in words a person can act on. */
  error?: string;
  status?: "ok" | "unauthorised" | "unreachable";
}

const TIMEOUT = 30_000;

function headers(apiKey: string): Record<string, string> {
  return {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
  };
}

/**
 * One JSON-RPC call.
 *
 * Servers legitimately answer either `application/json` or a single SSE frame (the Streamable HTTP
 * transport allows both), so both are read. Anything else is reported as text rather than parsed
 * hopefully — a proxy's HTML error page is a common answer here and "unexpected token <" helps
 * nobody.
 */
export async function rpc(server: RemoteServer, method: string, params?: Record<string, unknown>): Promise<
  { ok: true; result: Record<string, unknown> } | { ok: false; error: string; status: "unauthorised" | "unreachable" }
> {
  let response: Response;
  try {
    response = await fetch(server.url, {
      method: "POST",
      headers: headers(server.apiKey),
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, ...(params ? { params } : {}) }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, status: "unreachable", error: `Nothing answered at ${server.url} (${detail}). Check the address, and that the host is reachable from the server Nexus runs on.` };
  }

  if (response.status === 401 || response.status === 403) {
    return { ok: false, status: "unauthorised", error: "That server refused the key. It may need a different one, or none at all." };
  }

  const body = await response.text();
  const json = parseBody(body);
  if (!json) {
    return {
      ok: false,
      status: "unreachable",
      error: `That address answered with ${response.status} and something that is not JSON-RPC — it is probably not an MCP endpoint.`,
    };
  }
  if (json.error) {
    const message = typeof json.error === "object" && json.error && "message" in json.error ? String((json.error as { message: unknown }).message) : "the server refused";
    return { ok: false, status: response.status === 401 ? "unauthorised" : "unreachable", error: message };
  }
  return { ok: true, result: (json.result ?? {}) as Record<string, unknown> };
}

/** JSON, or one SSE frame carrying JSON. Both are legal answers to a Streamable HTTP POST. */
function parseBody(body: string): { result?: unknown; error?: unknown } | null {
  const text = body.trim();
  if (!text) return null;
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(text);
      return Array.isArray(parsed) ? ((parsed[0] ?? null) as { result?: unknown } | null) : (parsed as { result?: unknown });
    } catch {
      return null;
    }
  }
  for (const line of text.split("\n")) {
    if (!line.startsWith("data:")) continue;
    try {
      return JSON.parse(line.slice(5).trim()) as { result?: unknown };
    } catch {
      /* keep looking */
    }
  }
  return null;
}

/**
 * Say hello and ask what it can do.
 *
 * The handshake is not optional politeness: several servers refuse `tools/list` until they have
 * been initialised, so a client that skips it sees an empty toolbox and blames the server.
 */
export async function listTools(server: RemoteServer): Promise<{ ok: true; tools: RemoteTool[]; server: string } | { ok: false; error: string; status: "unauthorised" | "unreachable" }> {
  const hello = await rpc(server, "initialize", {
    protocolVersion: LATEST,
    capabilities: {},
    clientInfo: { name: SERVER_INFO.name, version: SERVER_INFO.version },
  });
  if (!hello.ok) return hello;

  const info = hello.result.serverInfo as { name?: string; title?: string } | undefined;
  const listed = await rpc(server, "tools/list");
  if (!listed.ok) return listed;

  const raw = Array.isArray(listed.result.tools) ? listed.result.tools : [];
  const tools: RemoteTool[] = raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const t = item as Record<string, unknown>;
    const name = typeof t.name === "string" ? t.name : "";
    if (!name) return [];
    return [{
      name,
      description: typeof t.description === "string" ? t.description.slice(0, 600) : "",
      inputSchema: (t.inputSchema ?? t.input_schema ?? {}) as Record<string, unknown>,
    }];
  });
  return { ok: true, tools, server: info?.title || info?.name || "" };
}

/** Call one tool and flatten its answer to text — which is all intake wants. */
export async function callTool(server: RemoteServer, name: string, args: Record<string, unknown>): Promise<RemoteResult> {
  const hello = await rpc(server, "initialize", {
    protocolVersion: LATEST,
    capabilities: {},
    clientInfo: { name: SERVER_INFO.name, version: SERVER_INFO.version },
  });
  if (!hello.ok) return { ok: false, text: "", error: hello.error, status: hello.status };

  const called = await rpc(server, "tools/call", { name, arguments: args });
  if (!called.ok) return { ok: false, text: "", error: called.error, status: called.status };

  const content = Array.isArray(called.result.content) ? called.result.content : [];
  const text = content
    .flatMap((part) => {
      if (!part || typeof part !== "object") return [];
      const p = part as Record<string, unknown>;
      if (typeof p.text === "string") return [p.text];
      // A resource or an image is not something intake can read; say so rather than dropping it.
      if (p.type === "resource" || p.type === "image") return [`[${String(p.type)} returned, which cannot be read as text]`];
      return [];
    })
    .join("\n\n")
    .trim();

  if (called.result.isError) {
    return { ok: false, text, error: text || "That tool reported a problem.", status: "ok" };
  }
  return { ok: true, text, status: "ok" };
}

export { coerce, simpleFields } from "./protocol";
