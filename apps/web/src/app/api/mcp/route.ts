import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { handleBody, LATEST, SERVER_INFO } from "@/lib/mcp/server";
import { authenticate, bearer, touch } from "@/lib/mcp/tokens";
import type { ToolContext } from "@/lib/mcp/tools";

/**
 * Nexus, as an MCP server (§5.33).
 *
 * One endpoint. A key in the Authorization header says which workspace is being asked and what the
 * caller may do; everything else is JSON-RPC. There is no session to establish and nothing to keep
 * alive, because every tool here is a question with an answer.
 *
 * The 401 is deliberately a JSON-RPC error rather than a bare status: the thing on the other end is
 * a model, and a sentence it can read gets a person to the settings page faster than a status code
 * its client will render as "request failed".
 */

const unauthorised = () =>
  NextResponse.json(
    {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32001,
        message:
          "This endpoint needs a Nexus key. Ask the workspace's owner for one — Settings → Connections in Nexus — and send it as “Authorization: Bearer nxs_…”.",
      },
    },
    { status: 401, headers: { "www-authenticate": 'Bearer realm="nexus"' } },
  );

export async function POST(req: NextRequest) {
  const db = await getDb();
  const token = await authenticate(db, bearer(req.headers));
  if (!token) return unauthorised();

  const workspace = await db.query.workspaces.findFirst({ where: eq(s.workspaces.id, token.workspaceId) });
  if (!workspace) return unauthorised();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "That was not JSON." } }, { status: 400 });
  }

  const ctx: ToolContext = {
    db,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    scope: token.scope,
    tokenName: token.name,
    tokenId: token.id,
    agentId: token.agentId,
  };

  const answer = await handleBody(body, ctx);
  // Last used is what tells somebody months later whether a key is still in anything's config.
  await touch(db, token.id);
  if (answer === null) return new NextResponse(null, { status: 202 });
  return NextResponse.json(answer);
}

/**
 * A GET is not part of what this server offers — there is no stream to open — but a person will
 * paste the URL into a browser, so it answers with what it is and how to reach it.
 */
export async function GET() {
  return NextResponse.json({
    server: SERVER_INFO,
    protocol: { name: "Model Context Protocol", version: LATEST, transport: "POST JSON-RPC to this URL" },
    authentication: "Authorization: Bearer <a Nexus key>",
    note: "Reading tools answer questions about one workspace's architecture model. Nothing here changes it: the most a caller can do is leave a suggestion in the review queue for a person to accept.",
  });
}
