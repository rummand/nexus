import { beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import path from "node:path";
import * as s from "@/db/schema";
import type { Db } from "@/db/client";
import { CODES, handle, handleBody, LATEST } from "./server";
import { authenticate, bearer, createToken, hashToken, mintToken, revokeToken } from "./tokens";
import { toolsFor, type ToolContext } from "./tools";

/**
 * Nexus as something other people's agents can call.
 *
 * Two things are worth pinning down, and they are the two a hand-written server gets wrong. The
 * **protocol**, because a client that cannot initialise sees nothing at all and a notification
 * answered with a result confuses several of them. And the **boundary**, because the whole claim
 * of this feature is that reading is generous and writing does not exist — a read key that can
 * reach `propose_change` would make that claim false.
 */

let db: Db;

beforeEach(async () => {
  db = drizzle(createClient({ url: ":memory:" }), { schema: s });
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../../../drizzle") });
  await db.insert(s.workspaces).values({ id: "ws", slug: "acme", name: "Acme Energy" });
});

const ctx = (over: Partial<ToolContext> = {}): ToolContext => ({
  db,
  workspaceId: "ws",
  workspaceName: "Acme Energy",
  scope: "propose",
  tokenName: "a key",
  tokenId: "mcp_1",
  agentId: null,
  ...over,
});

describe("speaking MCP", () => {
  it("initialises, echoing a version it knows and falling back to its latest", async () => {
    const known = await handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05" } }, ctx());
    expect((known?.result as { protocolVersion: string }).protocolVersion).toBe("2024-11-05");

    const strange = await handle({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "1999-01-01" } }, ctx());
    expect((strange?.result as { protocolVersion: string }).protocolVersion).toBe(LATEST);
    expect((strange?.result as { serverInfo: { name: string } }).serverInfo.name).toBe("nexus");
  });

  it("answers a notification with nothing at all", async () => {
    // A result here is the most common way a hand-written server confuses a real client.
    expect(await handle({ jsonrpc: "2.0", method: "notifications/initialized" }, ctx())).toBeNull();
  });

  it("says plainly what it does not implement", async () => {
    const answer = await handle({ jsonrpc: "2.0", id: 3, method: "resources/list" }, ctx());
    expect(answer?.error?.code).toBe(CODES.noMethod);
    expect(answer?.error?.message).toMatch(/tools, not resources/);
  });

  it("handles a batch, and drops the notifications from the answer", async () => {
    const answers = await handleBody(
      [
        { jsonrpc: "2.0", id: 1, method: "ping" },
        { jsonrpc: "2.0", method: "notifications/initialized" },
        { jsonrpc: "2.0", id: 2, method: "ping" },
      ],
      ctx(),
    );
    expect(Array.isArray(answers) && answers.length).toBe(2);
  });
});

describe("what a key may do", () => {
  it("offers a read key everything except proposing", async () => {
    expect(toolsFor("read").map((t) => t.name)).not.toContain("propose_change");
    expect(toolsFor("propose").map((t) => t.name)).toContain("propose_change");
    expect(toolsFor("read").length).toBe(toolsFor("propose").length - 1);
  });

  it("refuses a read key that calls it anyway, and says how to get one that can", async () => {
    const answer = await handle(
      { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "propose_change", arguments: {} } },
      ctx({ scope: "read" }),
    );
    expect(answer?.error?.code).toBe(CODES.denied);
    expect(answer?.error?.message).toMatch(/not propose changes/);
  });

  it("has no tool that changes the model", async () => {
    // The claim this whole feature rests on, asserted rather than assumed.
    const answer = await handle({ jsonrpc: "2.0", id: 5, method: "tools/list" }, ctx());
    const names = (answer?.result as { tools: Array<{ name: string }> }).tools.map((t) => t.name);
    expect(names.filter((n) => /^(set|delete|update|create|merge|apply|write)/.test(n))).toEqual([]);
    expect(names).toEqual(["search_model", "describe_object", "what_depends_on", "list_kinds", "estate_health", "propose_change"]);
  });

  it("names an unknown tool rather than failing silently", async () => {
    const answer = await handle({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "delete_everything" } }, ctx());
    expect(answer?.error?.code).toBe(CODES.badParams);
  });
});

describe("answering questions about the model", () => {
  beforeEach(async () => {
    await db.insert(s.entities).values([
      { id: "ent_a", workspaceId: "ws", kind: "Application", name: "Maximo", description: "Work-order management.", attributes: "{}", source: "seed" },
      { id: "ent_b", workspaceId: "ws", kind: "Application", name: "PI Server", description: "The process historian.", attributes: '{"owner":"Grid Operations"}', source: "seed" },
    ]);
    await db.insert(s.relations_).values({ id: "rel_1", workspaceId: "ws", fromEntityId: "ent_a", toEntityId: "ent_b", kind: "feeds" });
  });

  const text = async (name: string, args: Record<string, unknown>, c = ctx()) => {
    const answer = await handle({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name, arguments: args } }, c);
    return ((answer?.result as { content: Array<{ text: string }> }).content[0]?.text ?? "");
  };

  it("searches the model in the workspace's own language", async () => {
    expect(await text("search_model", { query: "kind:Application" })).toMatch(/Maximo/);
    expect(await text("search_model", { query: "missing:owner" })).toMatch(/Maximo/);
    expect(await text("search_model", { query: "kind:Nonsense" })).toMatch(/Nothing in Acme Energy matches/);
  });

  it("describes an object with its relations and where the record came from", async () => {
    const answer = await text("describe_object", { object: "Maximo" });
    expect(answer).toMatch(/Work-order management/);
    expect(answer).toMatch(/Maximo —feeds→ PI Server/);
    expect(answer).toMatch(/Where it came from: seed/);
  });

  it("refuses to guess when a name is ambiguous", async () => {
    await db.insert(s.entities).values({ id: "ent_c", workspaceId: "ws", kind: "Application", name: "Maximo", description: "The other one.", attributes: "{}", source: "import" });
    const answer = await text("describe_object", { object: "Maximo" });
    expect(answer).toMatch(/matches 2 objects/);
    expect(answer).toMatch(/ent_c/);
  });

  it("follows what depends on what", async () => {
    expect(await text("what_depends_on", { object: "Maximo", hops: 2 })).toMatch(/1 hop: PI Server/);
  });

  it("tells the truth about a tool that breaks, as content the caller can read", async () => {
    const broken = await handle(
      { jsonrpc: "2.0", id: 10, method: "tools/call", params: { name: "search_model", arguments: { query: "x" } } },
      ctx({ db: {} as unknown as Db }),
    );
    expect((broken?.result as { isError: boolean }).isError).toBe(true);
    // Not a JSON-RPC error: the model on the other end can read this one and try something else.
    expect(broken?.error).toBeUndefined();
  });

  it("puts a quoted suggestion in the review queue, and throws away one it cannot quote", async () => {
    await db.insert(s.teams).values({ id: "team_ea", workspaceId: "ws", slug: "ea", name: "Enterprise Architecture" });
    const { id } = await createToken(db, "ws", "an outside agent", "propose", null);
    const c = ctx({ tokenId: id, tokenName: "an outside agent" });

    const invented = await text("propose_change", {
      change: "setAttribute", entityId: "ent_a", key: "owner", to: "Finance",
      why: "It seems right.", readFrom: "ent_a", quote: "owned by finance",
    }, c);
    expect(invented).toMatch(/Nothing was recorded/);
    expect(await db.select().from(s.agentProposals)).toHaveLength(0);

    const quoted = await text("propose_change", {
      change: "setAttribute", entityId: "ent_a", key: "owner", to: "Asset Management",
      why: "Its description is about work orders, which Asset Management runs.", readFrom: "ent_a", quote: "Work-order management",
    }, c);
    expect(quoted).toMatch(/Recorded/);
    const queued = await db.select().from(s.agentProposals);
    expect(queued).toHaveLength(1);
    // Attributed to an agent, so the fleet can measure it like any other (§5.32).
    expect(queued[0]!.agentId).toBeTruthy();
  });
});

describe("keys", () => {
  it("mints a key it can recognise and never has to store", () => {
    const { token, prefix, hash } = mintToken();
    expect(token.startsWith("nxs_")).toBe(true);
    expect(prefix.length).toBeLessThan(token.length);
    expect(hash).toBe(hashToken(token));
    expect(hash).not.toContain(token.slice(4));
  });

  it("recognises a key, and stops recognising a revoked one", async () => {
    const { id } = await createToken(db, "ws", "laptop", "read", null);
    const row = await db.query.mcpTokens.findFirst({ where: eq(s.mcpTokens.id, id) });
    expect(row?.hash).toBeTruthy();

    // The real key is only returned by createToken; nothing else can produce it.
    const { token } = mintToken();
    expect(await authenticate(db, token)).toBeNull();

    const issued = await createToken(db, "ws", "second", "propose", null);
    expect((await authenticate(db, issued.token))?.scope).toBe("propose");
    await revokeToken(db, issued.id);
    expect(await authenticate(db, issued.token)).toBeNull();
  });

  it("reads a bearer header however it is written, and rejects what is not a key", async () => {
    expect(bearer(new Headers({ authorization: "Bearer nxs_abc" }))).toBe("nxs_abc");
    expect(bearer(new Headers({ authorization: "bearer nxs_abc" }))).toBe("nxs_abc");
    expect(bearer(new Headers({ "x-api-key": "nxs_abc" }))).toBe("nxs_abc");
    expect(await authenticate(db, "hunter2")).toBeNull();
  });
});
