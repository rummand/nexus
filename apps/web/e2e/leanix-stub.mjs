/**
 * A LeanIX that the suite can actually reach.
 *
 * The import door (§5.63) authenticates against the MTM service and pages Pathfinder's GraphQL.
 * Neither is something a test run can have — a licence is not a test fixture — so the suite
 * points the server at this instead, through `NEXUS_LEANIX_BASE_URL`. It speaks the two-step
 * exactly: an API token exchanged for a bearer, and a cursor-paged connection, so what the test
 * exercises is the real client rather than a mock of it.
 *
 * Deliberately a little awkward, because real exports are: two fact sheet types, two fact sheets
 * that share a name, one relation whose other end was never exported, and a fact sheet with no
 * subscriptions at all.
 */
import { createServer } from "node:http";

export const STUB_TOKEN = "e2e-leanix-token";

const SHEETS = [
  {
    id: "1a2b3c4d-1111-4aaa-8000-00000000cafe", type: "Application", name: "Customer Portal", description: "Where customers see their meters.",
    lifecycle: "active", updatedAt: "2026-02-01", tags: [{ name: "customer" }],
    subscriptions: { edges: [{ node: { user: { email: "jes@acme-energy.example" }, roles: [{ name: "Owner" }] } }] },
    relToChild: { edges: [{ node: { factSheet: { id: "4d5e6f70-4444-4ddd-8000-00000000f00d" } } }, { node: { factSheet: { id: "9999ffff-9999-4fff-8000-0000000000ff" } } }] },
    relToParent: { edges: [] },
  },
  {
    id: "2b3c4d5e-2222-4bbb-8000-00000000beef", type: "Application", name: "Billing", description: "Invoices and settlement.",
    lifecycle: "active", updatedAt: "2026-02-02", tags: [],
    subscriptions: { edges: [{ node: { user: { email: "maria@acme-energy.example" }, roles: [{ name: "Owner" }] } }] },
    relToChild: { edges: [] }, relToParent: { edges: [] },
  },
  {
    id: "3c4d5e6f-3333-4ccc-8000-00000000dead", type: "Application", name: "Billing", description: "The one being retired.",
    lifecycle: "endOfLife", updatedAt: "2026-02-03", tags: [],
    subscriptions: { edges: [] },
    relToChild: { edges: [] }, relToParent: { edges: [] },
  },
  {
    id: "4d5e6f70-4444-4ddd-8000-00000000f00d", type: "ITComponent", name: "PostgreSQL", description: "The database under the portal.",
    lifecycle: "active", updatedAt: "2026-02-04", tags: [],
    subscriptions: { edges: [] },
    relToChild: { edges: [] }, relToParent: { edges: [] },
  },
];

/** Start the stub on a port of its own. Returns `{ baseUrl, close }`. */
export function startLeanIxStub() {
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      if (req.url.includes("/oauth2/token")) {
        const auth = req.headers.authorization ?? "";
        const [user, token] = Buffer.from(auth.replace(/^Basic /, ""), "base64").toString().split(":");
        if (user !== "apitoken" || token !== STUB_TOKEN) {
          res.writeHead(401, { "content-type": "text/plain" }).end("that token is not valid here");
          return;
        }
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ access_token: "e2e-bearer" }));
        return;
      }
      if (req.url.includes("/graphql")) {
        if (req.headers.authorization !== "Bearer e2e-bearer") {
          res.writeHead(401, { "content-type": "text/plain" }).end("no bearer");
          return;
        }
        // Two pages, so the client's cursor handling is exercised rather than assumed.
        const { variables = {} } = JSON.parse(body || "{}");
        const start = variables.after ? Number(variables.after) : 0;
        const slice = SHEETS.slice(start, start + 3);
        const more = start + 3 < SHEETS.length;
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({
          data: {
            allFactSheets: {
              totalCount: SHEETS.length,
              pageInfo: { hasNextPage: more, endCursor: more ? String(start + 3) : null },
              edges: slice.map((node) => ({ node })),
            },
          },
        }));
        return;
      }
      res.writeHead(404, { "content-type": "text/plain" }).end("not a LeanIX endpoint");
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}
