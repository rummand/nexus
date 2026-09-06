/**
 * Laying cards out along a date axis.
 *
 * This is a *canvas* capability, not a roadmap feature. Anything on a board with something
 * date-shaped in an attribute can be put on a time axis: contract end dates, lifecycle dates,
 * support windows, the dates a plan lands. Lanes come from any other attribute. A roadmap is then
 * one thing you can express with it rather than a screen of its own — which is the difference
 * between a canvas that grows and a product that accumulates special cases.
 *
 * Everything here is pure over boxes, so the layout can be tested without a browser and reused by
 * the Viewpoint panel, Compose and anything else that wants it.
 */

import type { BoxElement, CardElement } from "./document";

export const CARD_W = 236;
export const CARD_H = 124;
const GAP_Y = 18;
const LANE_PAD = 20;
const LANE_TITLE = 46;
const LANE_GAP = 28;
const AXIS_HEIGHT = 64;
/** Minimum horizontal room per card, so two things a week apart do not sit on top of each other. */
const MIN_STEP = CARD_W + 28;

export type Granularity = "month" | "quarter" | "year";

export interface TimelineOptions {
  /** Attribute to read the date from. */
  dateKey: string;
  /** Attribute to make lanes from. Omitted, everything shares one lane. */
  laneKey?: string;
  /** Lane by the card's kind instead of an attribute — the grouping people reach for first. */
  laneByKind?: boolean;
  /** Top-left of the layout in world coordinates. */
  origin?: { x: number; y: number };
  /** Forced granularity; otherwise chosen from the span. */
  granularity?: Granularity;
}

export interface TimelinePlan {
  positions: Record<string, { x: number; y: number }>;
  lanes: Array<{ title: string; color: string; x: number; y: number; w: number; h: number }>;
  /** Period labels along the top: "2027 Q1", "March 2027", "2028". */
  periods: Array<{ label: string; x: number; y: number; w: number; h: number }>;
  /** Cards with no readable date, laid out in a lane of their own so they are not silently lost. */
  undated: string[];
  granularity: Granularity;
  /** The span the axis covers, for a caption. */
  span: { from: number; to: number } | null;
  width: number;
  height: number;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_INDEX = new Map(MONTHS.flatMap((m, i) => [[m.toLowerCase(), i], [m.slice(0, 3).toLowerCase(), i]] as Array<[string, number]>));

/**
 * Read a date out of whatever somebody typed.
 *
 * Deliberately forgiving about form and strict about ambiguity: `2027-03-14`, `2027-03`, `2027`,
 * `2027 Q3`, `Q3 2027`, `March 2027` and `Mar 2027` all work, and anything else is treated as
 * having no date rather than guessed at. A card parked in the "no date" lane is a question
 * somebody can answer; a card silently placed in 1970 is a lie.
 */
export function parseWhen(raw: string | undefined | null): number | null {
  const value = (raw ?? "").trim();
  if (!value) return null;

  const iso = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value);
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3] ?? "1"));

  const quarter = /^(?:(\d{4})[\s-]*q([1-4])|q([1-4])[\s-]*(\d{4}))$/i.exec(value);
  if (quarter) {
    const year = Number(quarter[1] ?? quarter[4]);
    const q = Number(quarter[2] ?? quarter[3]);
    return Date.UTC(year, (q - 1) * 3, 1);
  }

  const monthName = /^([a-z]+)\.?\s+(\d{4})$/i.exec(value);
  if (monthName) {
    const month = MONTH_INDEX.get(monthName[1]!.toLowerCase());
    if (month !== undefined) return Date.UTC(Number(monthName[2]), month, 1);
  }

  const year = /^(\d{4})$/.exec(value);
  if (year) {
    const n = Number(year[1]);
    // A bare number is only a year if it could plausibly be one; "1200" is a cost, not a date.
    if (n >= 1970 && n <= 2200) return Date.UTC(n, 0, 1);
  }

  return null;
}

/** Which attributes on these cards look like dates — used to offer the reader a sensible choice. */
export function dateAttributeKeys(cards: CardElement[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const card of cards) {
    for (const [key, value] of Object.entries(card.attributes ?? {})) {
      if (parseWhen(value) === null) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function chooseGranularity(from: number, to: number): Granularity {
  const days = (to - from) / 86_400_000;
  if (days > 365 * 3) return "year";
  if (days > 200) return "quarter";
  return "month";
}

function periodStart(t: number, granularity: Granularity): number {
  const d = new Date(t);
  const y = d.getUTCFullYear();
  if (granularity === "year") return Date.UTC(y, 0, 1);
  if (granularity === "quarter") return Date.UTC(y, Math.floor(d.getUTCMonth() / 3) * 3, 1);
  return Date.UTC(y, d.getUTCMonth(), 1);
}

function nextPeriod(t: number, granularity: Granularity): number {
  const d = new Date(t);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  if (granularity === "year") return Date.UTC(y + 1, 0, 1);
  if (granularity === "quarter") return Date.UTC(y, m + 3, 1);
  return Date.UTC(y, m + 1, 1);
}

export function periodLabel(t: number, granularity: Granularity): string {
  const d = new Date(t);
  const y = d.getUTCFullYear();
  if (granularity === "year") return String(y);
  if (granularity === "quarter") return `${y} Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
  return `${MONTHS[d.getUTCMonth()]} ${y}`;
}

const LANE_COLOURS = ["#1376d4", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#0ea5e9", "#ef4444", "#64748b"];

/**
 * Work out where everything goes.
 *
 * The x axis is periods of equal width rather than a linear time scale. A linear scale spends most
 * of the board on the gap between two clusters and squeezes the clusters into nothing — which is
 * accurate and unreadable. Equal periods keep every card legible and still put earlier things to
 * the left, which is all anybody reads off a roadmap.
 */
export function planTimeline(cards: CardElement[], options: TimelineOptions): TimelinePlan {
  const origin = options.origin ?? { x: 0, y: 0 };
  const dated: Array<{ card: CardElement; when: number }> = [];
  const undated: CardElement[] = [];
  for (const card of cards) {
    const when = parseWhen(card.attributes?.[options.dateKey]);
    if (when === null) undated.push(card);
    else dated.push({ card, when });
  }

  const empty: TimelinePlan = { positions: {}, lanes: [], periods: [], undated: undated.map((c) => c.id), granularity: "quarter", span: null, width: 0, height: 0 };
  if (!dated.length) return empty;

  const from = Math.min(...dated.map((d) => d.when));
  const to = Math.max(...dated.map((d) => d.when));
  const granularity = options.granularity ?? chooseGranularity(from, to);

  // The columns: every period from the first to the last, so an empty quarter still takes up room
  // and the gap is visible rather than closed up.
  const columns: number[] = [];
  for (let t = periodStart(from, granularity); t <= to; t = nextPeriod(t, granularity)) columns.push(t);
  if (!columns.length) columns.push(periodStart(from, granularity));
  const columnOf = (when: number) => {
    const start = periodStart(when, granularity);
    const i = columns.indexOf(start);
    return i === -1 ? columns.length - 1 : i;
  };

  // Lanes, in order of size so the busiest is at the top and the reader starts where the work is.
  const laneOf = (card: CardElement) => (options.laneByKind ? card.kind : options.laneKey ? (card.attributes?.[options.laneKey] ?? "") : "");
  const laneNames = new Map<string, number>();
  for (const { card } of dated) {
    const name = laneOf(card);
    laneNames.set(name, (laneNames.get(name) ?? 0) + 1);
  }
  const laneOrder = [...laneNames.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name);
  if (undated.length) laneOrder.push(UNDATED_LANE);

  const stepX = MIN_STEP;
  const width = Math.max(columns.length, 1) * stepX;
  const positions: TimelinePlan["positions"] = {};
  const lanes: TimelinePlan["lanes"] = [];
  let y = origin.y + AXIS_HEIGHT;

  for (const [laneIndex, name] of laneOrder.entries()) {
    const members = name === UNDATED_LANE
      ? undated.map((card) => ({ card, when: null as number | null }))
      : dated.filter((d) => laneOf(d.card) === name);
    // How many cards share the busiest column decides how tall this lane has to be.
    const perColumn = new Map<number, number>();
    for (const m of members) {
      const col = m.when === null ? 0 : columnOf(m.when);
      perColumn.set(col, (perColumn.get(col) ?? 0) + 1);
    }
    const deepest = Math.max(1, ...perColumn.values());
    const laneH = LANE_TITLE + LANE_PAD + deepest * CARD_H + (deepest - 1) * GAP_Y;

    const used = new Map<number, number>();
    for (const m of members) {
      // Undated cards run along their own lane in order rather than stacking in one column.
      const col = m.when === null ? (used.get(-1) ?? 0) : columnOf(m.when);
      if (m.when === null) used.set(-1, col + 1);
      const row = m.when === null ? 0 : (used.get(col) ?? 0);
      if (m.when !== null) used.set(col, row + 1);
      positions[m.card.id] = {
        x: origin.x + col * stepX + (stepX - CARD_W) / 2,
        y: y + LANE_TITLE + row * (CARD_H + GAP_Y),
      };
    }

    lanes.push({
      title: name === UNDATED_LANE
        ? `no ${options.dateKey}`
        : name || (options.laneByKind ? "Untyped" : options.laneKey ? `no ${options.laneKey}` : "Timeline"),
      color: name === UNDATED_LANE ? "#94a3b8" : LANE_COLOURS[laneIndex % LANE_COLOURS.length]!,
      x: origin.x - LANE_PAD,
      y,
      w: Math.max(width, stepX) + LANE_PAD * 2,
      h: laneH,
    });
    y += laneH + LANE_GAP;
  }

  const periods = columns.map((t, i) => ({
    label: periodLabel(t, granularity),
    x: origin.x + i * stepX,
    y: origin.y,
    w: stepX,
    h: AXIS_HEIGHT - 12,
  }));

  return { positions, lanes, periods, undated: undated.map((c) => c.id), granularity, span: { from, to }, width, height: y - origin.y };
}

/** The lane name used for cards with no readable date. Not a value anybody would type. */
export const UNDATED_LANE = " undated";

/** Where a plan should start, given what is already on the board: below everything, aligned left. */
export function originBelow(boxes: BoxElement[], gap = 120): { x: number; y: number } {
  if (!boxes.length) return { x: 0, y: 0 };
  return { x: Math.min(...boxes.map((b) => b.x)), y: Math.max(...boxes.map((b) => b.y + b.h)) + gap };
}
