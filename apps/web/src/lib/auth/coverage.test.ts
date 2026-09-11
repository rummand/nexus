import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every action that changes something asks permission first (§5.49).
 *
 * Rev 81 introduced the capability matrix and guarded the administrative modules, and the report
 * said the boundary was closed. It was not: a later audit found roughly forty exported actions —
 * bulk attribute edits, committing an intake source, deleting a board, renaming a relation type —
 * that changed the model or the workspace and asked nobody. Every one of them was reachable by a
 * guest.
 *
 * The lesson is not "be more careful". Ninety actions guarded by hand is a coverage problem, and a
 * coverage problem wants a machine. So this test reads the action modules, finds every exported
 * async function, and fails unless each one either calls a guard or is named below as deliberately
 * open — with the reason written down, which is the part a reviewer can argue with.
 *
 * It is a coarse check: it proves a guard is *called*, not that the right capability was chosen.
 * That still turns "somebody forgot" from a silent hole into a failing build, which is the failure
 * mode that actually happened.
 */

const SRC = path.resolve(__dirname, "..", "..");  // …/src

/** Anything that mentions a guard: the shared helpers, or a module's own wrapper around them. */
const GUARD = /\b(deny|must|can|viewer)\s*\(|\bdeny[A-Z]\w*\s*\(/;

/**
 * Actions that deliberately ask nobody, and why.
 *
 * Every entry is a decision, not an exemption granted to make the test pass. Reads are open
 * because the workspace layout has already established membership (§5.48) and nothing here shows
 * one workspace's data to another's. The rest are about the person themselves.
 */
const OPEN: Record<string, string> = {
  // Reads. Membership is checked by the layout; these show nothing across a workspace boundary.
  "models/actions.ts:modelSettings": "reads the settings page's own data; returns no key",
  "models/actions.ts:tidyTasks": "removes task rows pointing at providers that no longer exist",
  "mcp/actions.ts:connectionSettings": "lists keys by prefix; the keys themselves are unrecoverable",
  "mcp/server-actions.ts:listServers": "lists the connected servers, without their keys",
  "import/actions.ts:targetsFor": "reads the model to match against; a read of this workspace",
  "agent/definition-actions.ts:scopeSize": "counts what a scope would match, so the form can say so",

  // Per-person conveniences. Both write a row about *you* rather than about the model, and a
  // guest — who is entitled to read a board — is entitled to have opened one.
  "actions.ts:toggleFavorite": "your own star on a board you can already read",
  "actions.ts:markBoardOpened": "the recently-opened sort key; a read, recorded",
  "change/actions.ts:switchRefAction": "which change set *you* are standing on; checks membership itself, and standing somewhere is not writing to it",
  /*
   * Approving is a standing the MODELOWNERS rule itself confers (§5.93), not a capability.
   * Guarding it with `graph.edit` would let every editor approve their own work, and guarding it
   * with an administrative one would mean an administrator could sign on an owner's behalf —
   * which is exactly the conflation of approval with permission the design refuses. Both check
   * membership and then check the rule against the person signing.
   */
  "govern/actions.ts:approveChangeSet": "the entitlement is the rule; membership and `maySign` are both checked inside",
  "govern/actions.ts:withdrawApproval": "takes your own signature off; refuses somebody else's",

  // The person, for themselves.
  "auth/people-actions.ts:changeMyPassword": "your own password, with your own current one",
  "workspace-actions.ts:createWorkspace": "anybody may make a workspace; they become its owner",
};

interface Action {
  key: string;
  file: string;
  name: string;
  guarded: boolean;
}

/**
 * Split a module into its exported async functions.
 *
 * The body runs to the next line that is exactly `}` at column zero, which is where prettier puts
 * the end of a top-level function. Counting braces from the `export` keyword was the obvious
 * approach and it was wrong: a multi-line `Promise<{ … } | { error: string }>` return type opens
 * and closes a brace before the body starts, so the scan ended at the signature and reported a
 * guarded function as unguarded. A test that lies in the safe direction is bad; one that lies in
 * the other direction — and this one did, for two actions — is worse.
 */
function actions(file: string, source: string): Action[] {
  const out: Action[] = [];
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const match = /^export async function (\w+)/.exec(lines[i]!);
    if (!match) continue;
    const body: string[] = [];
    for (let j = i; j < lines.length; j++) {
      body.push(lines[j]!);
      if (j > i && lines[j] === "}") break;
    }
    out.push({ key: `${file}:${match[1]}`, file, name: match[1]!, guarded: GUARD.test(body.join("\n")) });
  }
  return out;
}

/** Every `"use server"` module under src/lib, plus the actions that live in src/app. */
function serverModules(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) continue;
      const source = readFileSync(full, "utf8");
      if (/^["']use server["'];/m.test(source)) found.push(full);
    }
  };
  walk(path.join(SRC, "lib"));
  return found.sort();
}

const all = serverModules().flatMap((full) => actions(path.relative(path.join(SRC, "lib"), full), readFileSync(full, "utf8")));

describe("the guard covers the write boundary", () => {
  it("found the action modules at all", () => {
    // A scan that silently matches nothing is a test that always passes.
    expect(all.length).toBeGreaterThan(60);
    expect(all.some((a) => a.key.endsWith(":deleteEntity"))).toBe(true);
  });

  it("guards every action that is not deliberately open", () => {
    const unguarded = all.filter((a) => !a.guarded && !(a.key in OPEN)).map((a) => a.key).sort();
    expect(unguarded, `these change something and ask nobody — guard them, or add them to OPEN with a reason:\n  ${unguarded.join("\n  ")}`).toEqual([]);
  });

  /*
   * The platform console is above the workspace, so the workspace guard cannot cover it: an
   * operator acting on a tenant they are not a member of has no role there to check. Its actions
   * must therefore use `denyOperator` specifically — a `deny(workspaceId, …)` that happened to
   * appear in one would pass the check above while refusing the very person it is built for.
   */
  it("guards the platform console with the operator guard, not the workspace one", () => {
    const console_ = all.filter((a) => a.file === "admin/actions.ts");
    expect(console_.length).toBeGreaterThan(5);
    const sources = new Map(serverModules().map((f) => [path.relative(path.join(SRC, "lib"), f), readFileSync(f, "utf8")]));
    const body = sources.get("admin/actions.ts") ?? "";
    expect(body).toMatch(/denyOperator/);
    expect(body, "an admin action must not ask the workspace matrix — the operator is not a member")
      .not.toMatch(/\bdeny\(/);
  });

  it("has no stale entries in the list of deliberate exceptions", () => {
    // An exception for an action that no longer exists is an exception nobody is checking.
    const known = new Set(all.map((a) => a.key));
    expect(Object.keys(OPEN).filter((k) => !known.has(k))).toEqual([]);
  });

  it("does not let an exception hide behind a rename", () => {
    // Every exception must still be genuinely unguarded; if one grew a guard, drop the entry.
    const pointless = Object.keys(OPEN).filter((k) => all.find((a) => a.key === k)?.guarded);
    expect(pointless).toEqual([]);
  });
});
