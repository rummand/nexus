import { fromWire, splitToolResults, toWire, wireFor, type CallRequest, type CallResponse } from "./translate";
import type { ModelChoice } from "./types";

/**
 * The one place Nexus talks to a model.
 *
 * Every agent, the planner and the extractor come through here, which is what makes "point the
 * whole product at your own gateway" a setting rather than a rewrite. The caller always speaks
 * Anthropic's shape; `translate.ts` puts it into whatever the endpoint expects and brings the
 * answer back.
 */

const TIMEOUT_MS = 25_000;

export async function callModel(choice: ModelChoice, request: CallRequest): Promise<CallResponse> {
  const { url, headers } = wireFor(choice.dialect, choice.baseUrl, choice.apiKey);
  const body = toWire(choice.dialect, choice.model, expand(choice, request));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: "POST", signal: controller.signal, headers, body: JSON.stringify(body) });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      /*
       * Name the provider in the error. With one hard-coded endpoint "the model refused the
       * request (401)" was enough; with four possible endpoints, half of them inside somebody's own
       * network, the first question is always *which one*.
       */
      throw new Error(`${choice.providerName} refused the request (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
    }
    return fromWire(choice.dialect, await res.json());
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${choice.providerName} did not answer within ${TIMEOUT_MS / 1000} seconds.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A message carrying several tool results becomes several messages in OpenAI's dialect.
 *
 * Compose's inspect loop answers two or three looks at once; Anthropic takes that as one user
 * message of blocks and OpenAI takes one message per result. Doing it here rather than in every
 * caller keeps the callers speaking one language.
 */
function expand(choice: ModelChoice, request: CallRequest): CallRequest {
  if (choice.dialect === "anthropic") return request;
  const messages: CallRequest["messages"] = [];
  for (const message of request.messages) {
    const split = splitToolResults(message);
    if (split) for (const one of split) messages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: one.tool_call_id, content: one.content }] });
    else messages.push(message);
  }
  return { ...request, messages };
}

/**
 * Is it there, and will it talk to us?
 *
 * A deliberately tiny call rather than a models-list endpoint, because a gateway may not have one
 * and because the question worth answering is "will the thing Nexus actually does work", not "does
 * this host respond".
 */
export async function probe(choice: ModelChoice): Promise<{ status: "ok" | "unauthorised" | "unreachable"; detail: string; ms: number }> {
  const started = Date.now();
  try {
    const { url, headers } = wireFor(choice.dialect, choice.baseUrl, choice.apiKey);
    const body = toWire(choice.dialect, choice.model, { messages: [{ role: "user", content: "Reply with the single word: ready." }], max_tokens: 16 });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch(url, { method: "POST", signal: controller.signal, headers, body: JSON.stringify(body) });
      const ms = Date.now() - started;
      if (res.ok) return { status: "ok", detail: `answered in ${ms}ms as ${choice.model}`, ms };
      const text = (await res.text().catch(() => "")).slice(0, 160);
      if (res.status === 401 || res.status === 403) return { status: "unauthorised", detail: `${res.status}: the key was refused. ${text}`.trim(), ms };
      return { status: "unreachable", detail: `${res.status}: ${text || "no detail"}`, ms };
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    const ms = Date.now() - started;
    const message = error instanceof Error ? error.message : "could not be reached";
    return {
      status: "unreachable",
      // The commonest failure for a sovereign deployment is a base URL pointing at nothing, and the
      // raw fetch error for that is famously unhelpful.
      detail: /fetch failed|ENOTFOUND|ECONNREFUSED/i.test(message)
        ? `Nothing answered at ${choice.baseUrl || "the default endpoint"}. Check the base URL and that the host is reachable from the server.`
        : message,
      ms,
    };
  }
}
