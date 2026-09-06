import { nanoid } from "nanoid";
import type * as s from "@/db/schema";
import { cardColorForKind, type CanvasElement, type CanvasDocument } from "@/canvas/document";
import { planTimeline, CARD_H, CARD_W } from "@/canvas/timeline";
import { deliveryOrder, type Dependency } from "./order";
import { project } from "./project";
import type { ChangeSet } from "./types";

/**
 * A roadmap, as a board.
 *
 * The roadmap page is a list, and a list is not how anybody presents a plan. This turns the same
 * change sets into an ordinary board: one card per system a plan touches, an attribute saying when
 * and what happens to it, and then the *generic* timeline layout does the drawing.
 *
 * That last part is the point. Nothing here knows how to draw a roadmap — it prepares cards with
 * attributes and hands them to a canvas capability any board can use. The result is a board like
 * any other: you can drag it, relabel it, add a note to it, export it, and it does not stop being
 * a roadmap when you do.
 */

/** What a plan does to one system, in the words the lanes are labelled with. */
export type Effect = "introduced" | "retired" | "changed" | "connected";

const EFFECT_ORDER: Effect[] = ["retired", "introduced", "changed", "connected"];

export interface RoadmapBoardOptions {
  /** Only these change sets; otherwise everything not delivered or abandoned. */
  changeSetIds?: string[];
  /** Lane by what happens, or by the plan responsible. */
  lanesBy?: "effect" | "change set";
  title?: string;
}

export interface Touch {
  entityId: string;
  name: string;
  kind: string;
  effect: Effect;
  when: string;
  changeName: string;
  /** True when this system does not exist yet: the plan introduces it. */
  planned: boolean;
  note: string;
}

/**
 * Which systems each plan touches, earliest first.
 *
 * A system touched by two plans appears once, at the first one that touches it: a card is one
 * object in one place, and showing it twice would make the board disagree with the model. The
 * later plans are named on the card instead.
 */
export function touches(entities: s.Entity[], relations: s.Relation[], sets: ChangeSet[], deps: Dependency[]): Touch[] {
  const byId = new Map(entities.map((e) => [e.id, e]));
  const order = deliveryOrder(sets, deps);
  const bySetId = new Map(sets.map((set) => [set.id, set]));
  const seen = new Map<string, Touch>();

  for (const id of order) {
    const set = bySetId.get(id);
    if (!set) continue;
    const projection = project(entities, relations, set.changes);
    const projected = new Map(projection.entities.map((e) => [e.id, e]));

    const record = (entityId: string, effect: Effect, note: string) => {
      const existing = seen.get(entityId);
      if (existing) {
        // Already on the board from an earlier plan: say that this one touches it too.
        existing.note = existing.note ? `${existing.note} · also ${set.name}` : `also ${set.name}`;
        return;
      }
      const entity = projected.get(entityId) ?? byId.get(entityId);
      if (!entity) return;
      seen.set(entityId, {
        entityId,
        name: entity.name || "Unnamed",
        kind: entity.kind || "",
        effect,
        when: set.targetDate,
        changeName: set.name,
        planned: !byId.has(entityId),
        note,
      });
    };

    for (const change of set.changes) {
      switch (change.op) {
        case "addEntity":
          if (change.entityId) record(change.entityId, "introduced", change.note);
          break;
        case "retireEntity":
          if (change.entityId) record(change.entityId, "retired", change.note);
          break;
        case "setAttribute":
          if (change.entityId) record(change.entityId, "changed", change.note);
          break;
        case "addRelation": {
          const payload = change.payload as { fromEntityId?: string; toEntityId?: string };
          for (const end of [payload.fromEntityId, payload.toEntityId]) if (end) record(end, "connected", change.note);
          break;
        }
        default:
          break;
      }
    }
  }

  return [...seen.values()].sort(
    (a, b) => (a.when || "9999").localeCompare(b.when || "9999") || EFFECT_ORDER.indexOf(a.effect) - EFFECT_ORDER.indexOf(b.effect) || a.name.localeCompare(b.name),
  );
}

/** How the effect reads on a card and on a lane. Title case, because people read these out loud. */
const EFFECT_LABEL: Record<Effect, string> = {
  retired: "Retired",
  introduced: "Introduced",
  changed: "Changed",
  connected: "Connected",
};

const EFFECT_COLOUR: Record<string, string> = {
  Retired: "#ef4444",
  Introduced: "#10b981",
  Changed: "#1376d4",
  Connected: "#8b5cf6",
};

/**
 * Build the document.
 *
 * Cards carry `when`, `change` and `effect` as ordinary attributes — so the reader can re-lay the
 * board out by any of them afterwards, colour by them, or query them. The roadmap is not encoded
 * anywhere except in the attributes, which is what keeps it a board rather than a picture of one.
 */
export function roadmapDocument(
  entities: s.Entity[],
  relations: s.Relation[],
  sets: ChangeSet[],
  deps: Dependency[],
  options: RoadmapBoardOptions = {},
): { document: CanvasDocument; placed: number; undated: number } {
  const wanted = options.changeSetIds
    ? sets.filter((set) => options.changeSetIds!.includes(set.id))
    : sets.filter((set) => set.status === "draft" || set.status === "planned");
  const list = touches(entities, relations, wanted, deps);

  const elements: Record<string, CanvasElement> = {};
  const cards = list.map((touch) => {
    const id = nanoid(10);
    const card = {
      id,
      type: "card" as const,
      x: 0, y: 0, w: CARD_W, h: CARD_H,
      kind: touch.kind,
      color: cardColorForKind(touch.kind),
      title: touch.name,
      description: touch.note,
      z: 1,
      attributes: {
        when: touch.when || "",
        change: touch.changeName,
        effect: EFFECT_LABEL[touch.effect],
      },
      /**
       * `about`, deliberately not `entityId`.
       *
       * An entity-backed card is kept in step with its entity in both directions: opening the
       * board would overwrite these attributes with the system's own, and saving it would write
       * "out of support" into Maximo's description. A roadmap card is a statement about a system
       * at a date, not the system — so it records which one it means and stays out of the graph.
       */
      meta: { about: touch.entityId, planned: touch.planned },
    };
    elements[id] = card;
    return card;
  });

  const plan = planTimeline(cards, { dateKey: "when", laneKey: options.lanesBy === "change set" ? "change" : "effect", origin: { x: 0, y: 140 } });
  for (const [id, at] of Object.entries(plan.positions)) {
    const card = elements[id];
    if (card && card.type === "card") elements[id] = { ...card, x: at.x, y: at.y };
  }
  for (const lane of plan.lanes) {
    const id = nanoid(10);
    elements[id] = {
      id, type: "frame", x: lane.x, y: lane.y, w: lane.w, h: lane.h,
      title: lane.title,
      color: EFFECT_COLOUR[lane.title] ?? lane.color,
      z: 0,
    };
  }
  for (const period of plan.periods) {
    const id = nanoid(10);
    elements[id] = { id, type: "text", variant: "section", x: period.x, y: period.y, w: period.w, h: period.h, title: period.label, text: "", color: "#1376d4", z: 0 };
  }

  const titleId = nanoid(10);
  elements[titleId] = {
    id: titleId, type: "text", variant: "section",
    x: 0, y: 0, w: 780, h: 96, z: 1, color: "#1376d4",
    title: options.title ?? "Roadmap",
    text: `${cards.length} object${cards.length === 1 ? "" : "s"} across ${wanted.length} change set${wanted.length === 1 ? "" : "s"}. Lanes are what happens; the axis is when. Rearrange it — it is an ordinary board.`,
  };

  return { document: { version: 2, elements }, placed: Object.keys(plan.positions).length, undated: plan.undated.length };
}
