import type { Framework, FrameworkFamily } from "./types";
import { ARCHIMATE, C4, UML_CLASS } from "./notations";
import { DDD, MBSE } from "./domain";
import { IT4IT, SAFE } from "./operating";
import { PORTFOLIO_FRAMEWORKS } from "./portfolio";
import { STRATEGY_FRAMEWORKS } from "./strategy";

export * from "./types";

/**
 * The catalogue (§5.57).
 *
 * Ordered the way somebody choosing would read it: how you draw a system, how you decompose the
 * problem, how the organisation is run, the estate itself, and finally what the estate is for. Nothing here is required — a
 * workspace that adopts none of it and lets the model grow from the work is using the product as
 * designed (§2.2).
 */
export const FRAMEWORKS: Framework[] = [ARCHIMATE, C4, UML_CLASS, DDD, MBSE, IT4IT, SAFE, ...PORTFOLIO_FRAMEWORKS, ...STRATEGY_FRAMEWORKS];

export function framework(id: string): Framework | null {
  return FRAMEWORKS.find((f) => f.id === id) ?? null;
}

/** The catalogue grouped for display, skipping a family with nothing in it. */
export function byFamily(): Array<{ family: FrameworkFamily; frameworks: Framework[] }> {
  const order: FrameworkFamily[] = ["notation", "domain", "operating-model", "portfolio", "strategy"];
  return order
    .map((family) => ({ family, frameworks: FRAMEWORKS.filter((f) => f.family === family) }))
    .filter((g) => g.frameworks.length > 0);
}

/** Which layer of its own framework a type sits in, for the metamodel tree. */
export function layerOf(fw: Framework, typeName: string): string {
  const t = fw.nodeTypes.find((n) => n.name.trim().toLowerCase() === typeName.trim().toLowerCase());
  return t?.layer ?? "";
}

/**
 * "C4 model and two others", for a sentence about a workspace.
 *
 * A list of ids is not a sentence, and every screen that wants to say what a workspace models with
 * would otherwise invent its own comma handling.
 */
export function adoptedLine(ids: string[]): string {
  const names = ids.map((id) => framework(id)?.name).filter((n): n is string => Boolean(n));
  if (names.length === 0) return "Free form — no framework adopted.";
  if (names.length === 1) return `Models with ${names[0]}.`;
  if (names.length === 2) return `Models with ${names[0]} and ${names[1]}.`;
  return `Models with ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}.`;
}
