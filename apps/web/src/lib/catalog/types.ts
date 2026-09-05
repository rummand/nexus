/**
 * The source catalogue.
 *
 * Not a list of connectors — a negotiation surface. An agent finds a system, argues for the
 * parts of it that would be worth reading, and a human grants scope. Three things are therefore
 * first-class and none of them is the connection itself:
 *
 *   evidence — how the agent knows this system exists here. A DNS record, an app registration,
 *              four meetings that talked about it. No proposal without it.
 *   scope    — what may be read, as a tree: system → module → object. Granted node by node,
 *              never as one switch.
 *   purpose  — what Nexus can answer if the scope is granted, in the architect's words. A scope
 *              nobody can justify is a scope nobody should grant.
 */

import type { Fingerprint, Signal } from "./signals";

export type ProviderCategory = "conversations" | "files" | "systems" | "repositories" | "operations";

/** Built and usable, on the roadmap, or reachable only by upload today. */
export type ProviderStatus = "available" | "planned";

/** How data gets in: a file a human brings, or an API the agent reads. */
export type ProviderMode = "upload" | "api";

export type Sensitivity = "open" | "internal" | "confidential" | "personal";

/**
 * One grantable node. Modules contain objects; both are grantable, and granting a module means
 * granting the objects under it unless they are picked individually.
 */
export interface ScopeNode {
  /** Stable path, "sap/pm/equi" — what a grant stores. */
  path: string;
  name: string;
  /** The vendor's own word for it, when there is one: "EQUI", "cmdb_ci". */
  technical?: string;
  description: string;
  /** What appears in the Nexus graph if this is granted. */
  yields: string[];
  /** What the organisation can then ask. The reason to say yes. */
  enables?: string;
  sensitivity: Sensitivity;
  /** Rough row count, for a sense of weight rather than precision. */
  volume?: string;
  children?: ScopeNode[];
}

export interface Provider {
  id: string;
  name: string;
  vendor: string;
  category: ProviderCategory;
  status: ProviderStatus;
  mode: ProviderMode;
  /** One line, in the words an architect would use. */
  summary: string;
  /** Why an EA platform wants this system at all. */
  rationale: string;
  /** How a connection authenticates, said plainly. */
  auth: string;
  /** The source kind a sync produces (see src/lib/intake/types.ts). */
  produces: "transcript" | "document" | "table" | "connector";
  scopes: ScopeNode[];
  /** Names the discovery agent looks for, matched whole-word. */
  signals: string[];
  /**
   * How the system gives itself away when nobody wrote its name: hostnames, table names,
   * transaction codes, files only its toolchain produces. See src/lib/catalog/signals.ts.
   */
  fingerprints: Fingerprint[];
}

export interface Discovery {
  providerId: string;
  confidence: "high" | "medium" | "low";
  /** Summed signal weight — what the confidence is derived from. */
  score: number;
  /** The agent's case, in one sentence. */
  reason: string;
  /** The strongest signals, verbatim. Never summarised away. */
  signals: Signal[];
  /** Scope paths the agent would like, and would justify. */
  wants: string[];
}

/** Flatten a scope tree depth-first. */
export function flattenScopes(nodes: ScopeNode[]): ScopeNode[] {
  return nodes.flatMap((n) => [n, ...flattenScopes(n.children ?? [])]);
}

export function findScope(nodes: ScopeNode[], path: string): ScopeNode | undefined {
  return flattenScopes(nodes).find((n) => n.path === path);
}

/** A grant on a parent covers its children unless a child is granted in its own right. */
export function isGranted(granted: Set<string>, path: string): boolean {
  if (granted.has(path)) return true;
  const parts = path.split("/");
  for (let i = parts.length - 1; i > 0; i--) if (granted.has(parts.slice(0, i).join("/"))) return true;
  return false;
}

/**
 * A grant on a module means its objects, so ticks are materialised: the stored grant lists every
 * path it covers. Keeping only the parent would be more compact, and would read on screen as a
 * narrower grant than it is — the wrong direction in which to be imprecise.
 */
export function expandScopes(nodes: ScopeNode[], paths: string[]): Set<string> {
  const all = flattenScopes(nodes);
  const out = new Set<string>();
  for (const path of paths) {
    out.add(path);
    for (const node of all) if (node.path.startsWith(`${path}/`)) out.add(node.path);
  }
  return out;
}

/**
 * Tick or untick one node. Ticking takes the subtree with it; unticking clears the subtree *and*
 * every ancestor, because a module whose objects are not all granted is not itself granted.
 */
export function toggleScope(nodes: ScopeNode[], picked: Set<string>, path: string, on: boolean): Set<string> {
  const node = findScope(nodes, path);
  if (!node) return picked;
  const next = new Set(picked);
  for (const p of flattenScopes([node]).map((n) => n.path)) {
    if (on) next.add(p); else next.delete(p);
  }
  if (!on) {
    const parts = path.split("/");
    for (let i = parts.length - 1; i > 0; i--) next.delete(parts.slice(0, i).join("/"));
  }
  return next;
}
