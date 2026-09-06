import { afterEach, describe, expect, it } from "vitest";
import type * as s from "@/db/schema";
import { fromWire, toWire, wireFor } from "./translate";
import { hint, isSealed, open, seal, secretConfigured } from "./secret";
import { chooseFrom, fromEnvironment, whyNoModel, type Configured } from "./resolve";

/**
 * Pointing Nexus at a model.
 *
 * Two things are worth pinning down. The **translation**, because it is what makes a model on the
 * organisation's own hardware a first-class option rather than a special case — and because the
 * one thing that must survive it is "answer with exactly this tool", which is the whole safety
 * mechanism. And the **order of preference**, because "why is it not using the provider I set up"
 * is the question this feature will be asked most.
 */

const env = { ...process.env };
afterEach(() => { process.env = { ...env }; });

const REQUEST = {
  system: "You are careful.",
  messages: [{ role: "user" as const, content: "What is out of support?" }],
  tools: [{ name: "answer", description: "Answer it.", input_schema: { type: "object", properties: { text: { type: "string" } } } }],
  tool_choice: { type: "tool" as const, name: "answer" },
  max_tokens: 900,
};

describe("speaking to something that is not Anthropic", () => {
  it("moves the system prompt into the messages and wraps the tool", () => {
    const body = toWire("openai", "llama3.3", REQUEST) as Record<string, never>;
    expect(body.messages).toEqual([
      { role: "system", content: "You are careful." },
      { role: "user", content: "What is out of support?" },
    ]);
    expect(body.tools).toEqual([{
      type: "function",
      function: { name: "answer", description: "Answer it.", parameters: REQUEST.tools[0]!.input_schema },
    }]);
  });

  it("keeps “answer with exactly this tool”, which is the whole safety mechanism", () => {
    expect((toWire("openai", "m", REQUEST) as Record<string, never>).tool_choice).toEqual({ type: "function", function: { name: "answer" } });
    expect((toWire("openai", "m", { ...REQUEST, tool_choice: { type: "any" } }) as Record<string, never>).tool_choice).toBe("required");
  });

  it("leaves an Anthropic request alone", () => {
    const body = toWire("anthropic", "claude", REQUEST) as Record<string, never>;
    expect(body).toMatchObject({ model: "claude", system: "You are careful.", tool_choice: { type: "tool", name: "answer" } });
  });

  it("reads a tool call back into the shape every caller here expects", () => {
    const answer = fromWire("openai", {
      choices: [{ message: { content: null, tool_calls: [{ id: "c1", function: { name: "answer", arguments: '{"text":"Maximo"}' } }] } }],
    });
    expect(answer.content).toEqual([{ type: "tool_use", id: "c1", name: "answer", input: { text: "Maximo" } }]);
  });

  it("salvages a small model that fences its JSON, and gives up rather than throwing", () => {
    const fenced = fromWire("openai", {
      choices: [{ message: { tool_calls: [{ id: "c1", function: { name: "answer", arguments: 'Sure!\n```json\n{"text":"ok"}\n```' } }] } }],
    });
    expect(fenced.content?.[0]?.input).toEqual({ text: "ok" });

    const rubbish = fromWire("openai", { choices: [{ message: { tool_calls: [{ id: "c1", function: { name: "answer", arguments: "not json" } }] } }] });
    expect(rubbish.content?.[0]?.input).toEqual({});
  });

  it("carries an assistant's tool call back for a second round", () => {
    const body = toWire("openai", "m", {
      messages: [
        { role: "user", content: "look" },
        { role: "assistant", content: [{ type: "tool_use", id: "t1", name: "inspect", input: { of: "kinds" } }] },
        { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "5 kinds" }] },
      ],
    }) as Record<string, never>;
    expect(body.messages).toEqual([
      { role: "user", content: "look" },
      { role: "assistant", content: null, tool_calls: [{ id: "t1", type: "function", function: { name: "inspect", arguments: '{"of":"kinds"}' } }] },
      { role: "tool", tool_call_id: "t1", content: "5 kinds" },
    ]);
  });
});

describe("where to send it", () => {
  it("uses each dialect's path and headers", () => {
    expect(wireFor("anthropic", "https://api.anthropic.com", "k")).toEqual({
      url: "https://api.anthropic.com/v1/messages",
      headers: { "content-type": "application/json", "x-api-key": "k", "anthropic-version": "2023-06-01" },
    });
    expect(wireFor("openai", "https://api.openai.com", "k").url).toBe("https://api.openai.com/v1/chat/completions");
  });

  it("does not add a second /v1 to a gateway URL that already has one", () => {
    expect(wireFor("openai", "http://localhost:11434/v1", "").url).toBe("http://localhost:11434/v1/chat/completions");
    expect(wireFor("openai", "http://localhost:11434/v1/", "").url).toBe("http://localhost:11434/v1/chat/completions");
  });

  it("sends no authorisation header to a local model that has no key", () => {
    expect(wireFor("openai", "http://localhost:11434/v1", "").headers.authorization).toBeUndefined();
    expect(wireFor("openai", "http://x/v1", "k").headers.authorization).toBe("Bearer k");
  });
});

describe("keeping a key", () => {
  it("encrypts and decrypts when there is a secret", () => {
    process.env = { ...env, NEXUS_SECRET_KEY: "a-long-enough-secret-value" };
    expect(secretConfigured()).toBe(true);
    const { stored, encrypted } = seal("sk-ant-secret");
    expect(encrypted).toBe(true);
    expect(stored).not.toContain("sk-ant-secret");
    expect(isSealed(stored)).toBe(true);
    expect(open(stored)).toBe("sk-ant-secret");
  });

  it("stores the key as it is, and says so, rather than pretending", () => {
    // Deriving a key from something already in the database and storing it beside the ciphertext
    // is theatre. Being told the truth is what lets an administrator decide what to do about it.
    process.env = { ...env, NEXUS_SECRET_KEY: "" };
    const { stored, encrypted } = seal("sk-ant-secret");
    expect(encrypted).toBe(false);
    expect(stored).toBe("sk-ant-secret");
    expect(isSealed(stored)).toBe(false);
  });

  it("returns nothing rather than throwing when the secret has changed", () => {
    process.env = { ...env, NEXUS_SECRET_KEY: "the-original-secret-value" };
    const { stored } = seal("sk-ant-secret");
    process.env = { ...env, NEXUS_SECRET_KEY: "a-different-secret-value!" };
    expect(open(stored)).toBe("");
  });

  it("shows enough of a key to recognise it and never enough to use it", () => {
    expect(hint("sk-ant-api03-abcdefghijklmnop")).toBe("sk-a…mnop");
    expect(hint("short")).toBe("•••••");
    expect(hint("")).toBe("");
  });
});

describe("which model answers this job", () => {
  const row = (over: Partial<s.ModelProviderRow> = {}): s.ModelProviderRow => ({
    id: "p1", workspaceId: "ws", name: "Anthropic", dialect: "anthropic", baseUrl: "", model: "claude-sonnet-4-5",
    apiKey: "sk-test", keyEncrypted: false, enabled: true, status: "unknown", statusDetail: "", checkedAt: null,
    createdAt: "2026-01-01", updatedAt: "2026-01-01", ...over,
  });
  const config = (tasks: Configured["tasks"] = {}): Configured => ({ providers: [], tasks });

  it("prefers the provider set for this job", () => {
    const rows = [row(), row({ id: "p2", name: "Ollama", dialect: "openai", baseUrl: "http://localhost:11434/v1", model: "llama3.3", apiKey: "" })];
    const choice = chooseFrom(config({ intake: { providerId: "p2", model: "" } }), rows, "intake");
    expect(choice).toMatchObject({ providerName: "Ollama", dialect: "openai", model: "llama3.3", apiKey: "", from: "provider" });
  });

  it("falls back to the first enabled provider, then to the environment", () => {
    const rows = [row({ enabled: false }), row({ id: "p2", name: "Second" })];
    expect(chooseFrom(config(), rows, "compose")?.providerName).toBe("Second");

    process.env = { ...env, ANTHROPIC_API_KEY: "k", NEXUS_MODEL: "m" };
    expect(chooseFrom(config(), [], "compose")).toMatchObject({ from: "environment", model: "m" });

    process.env = { ...env, ANTHROPIC_API_KEY: "", NEXUS_MODEL: "" };
    expect(chooseFrom(config(), [], "compose")).toBeNull();
  });

  it("lets one endpoint be used at two sizes", () => {
    const rows = [row({ model: "claude-opus-4-5" })];
    expect(chooseFrom(config({ intake: { providerId: "p1", model: "claude-haiku-4-5" } }), rows, "intake")?.model).toBe("claude-haiku-4-5");
  });

  it("fills in the dialect's public endpoint when none is given", () => {
    expect(chooseFrom(config(), [row()], "compose")?.baseUrl).toBe("https://api.anthropic.com");
    expect(chooseFrom(config(), [row({ dialect: "openai" })], "compose")?.baseUrl).toBe("https://api.openai.com");
  });

  it("refuses rather than quietly using something else when a key cannot be read", () => {
    process.env = { ...env, NEXUS_SECRET_KEY: "one-secret-value-here-ok", ANTHROPIC_API_KEY: "k", NEXUS_MODEL: "m" };
    const sealed = seal("sk-real").stored;
    process.env = { ...env, NEXUS_SECRET_KEY: "another-secret-value-x", ANTHROPIC_API_KEY: "k", NEXUS_MODEL: "m" };
    expect(chooseFrom(config(), [row({ apiKey: sealed })], "compose")).toBeNull();
  });

  it("says which of the three ways it is unconfigured", () => {
    process.env = { ...env, ANTHROPIC_API_KEY: "", NEXUS_MODEL: "" };
    expect(whyNoModel(config(), [], "compose")).toMatch(/No model is configured/);

    process.env = { ...env, ANTHROPIC_API_KEY: "k", NEXUS_MODEL: "" };
    expect(whyNoModel(config(), [], "compose")).toMatch(/only half a model/);

    expect(whyNoModel(config(), [row({ model: "" })], "compose")).toMatch(/has no model id/);

    process.env = { ...env, NEXUS_SECRET_KEY: "one-secret-value-here-ok" };
    const sealed = seal("sk-real").stored;
    process.env = { ...env, NEXUS_SECRET_KEY: "another-secret-value-x" };
    expect(whyNoModel(config(), [row({ apiKey: sealed })], "compose")).toMatch(/NEXUS_SECRET_KEY has probably changed/);
  });

  it("reads the environment's own base URL, so a proxy keeps working", () => {
    process.env = { ...env, ANTHROPIC_API_KEY: "k", NEXUS_MODEL: "m", NEXUS_MODEL_BASE_URL: "http://127.0.0.1:4599" };
    expect(fromEnvironment()).toMatchObject({ baseUrl: "http://127.0.0.1:4599", from: "environment" });
  });
});
