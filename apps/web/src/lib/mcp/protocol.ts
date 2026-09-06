/**
 * The parts of MCP that are neither client nor server.
 *
 * Kept in their own module with no imports, because both directions need them and because the
 * settings page renders a form from a remote tool's schema — which must not drag the server's
 * tool implementations, and with them the database, into the browser bundle.
 */

/** The revisions we answer to. A client asking for something else is given our latest. */
export const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;
export const LATEST = PROTOCOL_VERSIONS[0];

export const SERVER_INFO = { name: "nexus", title: "Nexus — enterprise architecture", version: "0.2.0" };

/**
 * The arguments a person can reasonably be asked for: top-level string, number and boolean fields.
 * Anything deeper is left to whoever knows the server, rather than generating a form for a schema
 * we have never seen.
 */
export function simpleFields(schema: Record<string, unknown>): Array<{ key: string; type: string; description: string; required: boolean }> {
  const properties = (schema.properties ?? {}) as Record<string, unknown>;
  const required = new Set(Array.isArray(schema.required) ? schema.required.filter((r): r is string => typeof r === "string") : []);
  return Object.entries(properties).flatMap(([key, value]) => {
    if (!value || typeof value !== "object") return [];
    const field = value as { type?: unknown; description?: unknown };
    const type = typeof field.type === "string" ? field.type : "string";
    if (!["string", "number", "integer", "boolean"].includes(type)) return [];
    return [{ key, type, description: typeof field.description === "string" ? field.description : "", required: required.has(key) }];
  });
}

/** Turn what a form collected into arguments of the types the schema asks for. */
export function coerce(fields: ReturnType<typeof simpleFields>, values: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = (values[field.key] ?? "").trim();
    if (!raw) continue;
    if (field.type === "number" || field.type === "integer") {
      const n = Number(raw);
      if (Number.isFinite(n)) out[field.key] = n;
    } else if (field.type === "boolean") {
      out[field.key] = raw === "true" || raw === "yes" || raw === "on";
    } else {
      out[field.key] = raw;
    }
  }
  return out;
}
