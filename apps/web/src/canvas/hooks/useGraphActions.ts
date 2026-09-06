"use client";

import { useCallback, useState } from "react";
import { nanoid } from "nanoid";
import { cardColorForKind, isBoxElement, type CanvasElement, type CardElement } from "../document";
import { boxContainsBox } from "../geometry";
import { LENS_PALETTE } from "../lens";
import { CARD_H, CARD_W, originBelow, planTimeline } from "../timeline";
import { useCanvasStore } from "../store";
import { isEntityId, type NeighborhoodResponse } from "@/lib/graph-types";

/**
 * Viewpoint actions: bring graph structure onto the board.
 * Cards placed here are linked (meta.entityId) and connectors are relations (meta.relationId),
 * so everything round-trips through the normal save → graph sync.
 */
export function useGraphActions() {
  const store = useCanvasStore();
  const [busy, setBusy] = useState(false);

  const fetchNeighborhood = useCallback(
    async (entityIds: string[], depth: number, direction: "both" | "out" | "in", relationKinds?: string[]): Promise<NeighborhoodResponse> => {
      const res = await fetch("/api/graph/neighborhood", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: store.getState().workspaceId, entityIds, depth, direction, relationKinds }),
      });
      if (!res.ok) throw new Error(`neighbourhood failed: ${res.status}`);
      return (await res.json()) as NeighborhoodResponse;
    },
    [store],
  );

  /** Cards on the board keyed by entity id. */
  const entityCards = useCallback(() => {
    const map = new Map<string, CardElement>();
    for (const el of Object.values(store.getState().elements)) if (el.type === "card" && isEntityId(el.meta?.entityId)) map.set(el.meta.entityId, el);
    return map;
  }, [store]);

  /** Connectors that already represent a relation id or connect the same two cards. */
  const missingRelationConnectors = useCallback(
    (relations: NeighborhoodResponse["relations"], cards: Map<string, CardElement>): CanvasElement[] => {
      const s = store.getState();
      const existingRel = new Set<string>();
      const existingPair = new Set<string>();
      for (const el of Object.values(s.elements)) {
        if (el.type !== "connector") continue;
        if (typeof el.meta?.relationId === "string") existingRel.add(el.meta.relationId);
        if ("elementId" in el.from && "elementId" in el.to) existingPair.add(`${el.from.elementId}>${el.to.elementId}`);
      }
      const out: CanvasElement[] = [];
      for (const r of relations) {
        const from = cards.get(r.fromEntityId);
        const to = cards.get(r.toEntityId);
        if (!from || !to || existingRel.has(r.id) || existingPair.has(`${from.id}>${to.id}`)) continue;
        existingPair.add(`${from.id}>${to.id}`);
        out.push({ id: nanoid(10), type: "connector", from: { elementId: from.id }, to: { elementId: to.id }, label: r.kind, stroke: "#475569", style: "solid", route: "curved", arrowEnd: true, arrowStart: false, z: 0, meta: { relationId: r.id } });
      }
      return out;
    },
    [store],
  );

  /** Draw connectors for every graph relation between cards already on the board. */
  const showRelations = useCallback(async () => {
    setBusy(true);
    try {
      const cards = entityCards();
      if (cards.size < 2) return 0;
      const { relations } = await fetchNeighborhood([...cards.keys()], 0, "both");
      const connectors = missingRelationConnectors(relations, cards);
      if (connectors.length) store.getState().addElements(connectors, { select: false });
      return connectors.length;
    } finally {
      setBusy(false);
    }
  }, [entityCards, fetchNeighborhood, missingRelationConnectors, store]);

  /** Expand the selected cards: place their graph neighbours around them and connect. */
  const expandSelection = useCallback(
    async (depth: number, direction: "both" | "out" | "in", relationKinds?: string[]) => {
      setBusy(true);
      try {
        const s = store.getState();
        const selected = s.selection.map((id) => s.elements[id]).filter((el): el is CardElement => !!el && el.type === "card" && isEntityId(el.meta?.entityId));
        if (selected.length === 0) return 0;
        const cards = entityCards();
        const seeds = selected.map((c) => c.meta!.entityId as string);
        const { entities, relations } = await fetchNeighborhood(seeds, depth, direction, relationKinds);
        const fresh = entities.filter((e) => !cards.has(e.id));
        // radial placement around the centroid of the selection, skipping occupied spots
        const cx = selected.reduce((a, c) => a + c.x + c.w / 2, 0) / selected.length;
        const cy = selected.reduce((a, c) => a + c.y + c.h / 2, 0) / selected.length;
        const w = 236, h = 124, margin = 24;
        const occupied = Object.values(s.elements).filter(isBoxElement).map((b) => ({ x: b.x - margin, y: b.y - margin, w: b.w + margin * 2, h: b.h + margin * 2 }));
        const free = (x: number, y: number) => !occupied.some((o) => x < o.x + o.w && x + w > o.x && y < o.y + o.h && y + h > o.y);
        const newCards: CardElement[] = [];
        fresh.forEach((e, i) => {
          const baseAngle = -Math.PI / 2 + (i / Math.max(1, fresh.length)) * Math.PI * 2;
          let placed: { x: number; y: number } | null = null;
          for (let ring = 0; ring < 6 && !placed; ring++) {
            const radius = 360 + ring * 190;
            for (let k = 0; k < 8 && !placed; k++) {
              const angle = baseAngle + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.22;
              const x = cx + Math.cos(angle) * radius - w / 2;
              const y = cy + Math.sin(angle) * radius * 0.7 - h / 2;
              if (free(x, y)) placed = { x, y };
            }
          }
          const pos = placed ?? { x: cx + 400 + i * 40, y: cy + 400 + i * 40 };
          occupied.push({ x: pos.x - margin, y: pos.y - margin, w: w + margin * 2, h: h + margin * 2 });
          newCards.push({ id: nanoid(10), type: "card", x: pos.x, y: pos.y, w, h, kind: e.kind, color: cardColorForKind(e.kind), title: e.name, description: e.description, attributes: e.attributes, z: 0, meta: { entityId: e.id } });
        });
        for (const c of newCards) cards.set(c.meta!.entityId as string, c);
        if (newCards.length) s.addElements(newCards, { select: false });
        const connectors = missingRelationConnectors(relations, cards);
        if (connectors.length) store.getState().addElements(connectors, { select: false });
        store.getState().select([...selected.map((c) => c.id), ...newCards.map((c) => c.id)]);
        return newCards.length;
      } finally {
        setBusy(false);
      }
    },
    [entityCards, fetchNeighborhood, missingRelationConnectors, store],
  );

  /** Group the board's cards into one frame per kind (existing frames are left alone). */
  /** Lay every card out in one frame per group (kind, or an attribute's values). */
  const arrangeBy = useCallback((groupOf: (c: CardElement) => string, frameOf: (group: string) => { title: string; color: string }) => {
    const s = store.getState();
    const cards = Object.values(s.elements).filter((el): el is CardElement => el.type === "card");
    if (cards.length === 0) return 0;
    const byKind = new Map<string, CardElement[]>();
    for (const c of cards) byKind.set(groupOf(c), [...(byKind.get(groupOf(c)) ?? []), c]);
    const kinds = [...byKind.entries()].sort((a, b) => b[1].length - a[1].length);
    const boxes = Object.values(s.elements).filter(isBoxElement);
    const startX = Math.min(...boxes.map((b) => b.x));
    const startY = Math.max(...boxes.map((b) => b.y + b.h)) + 120;
    const cardW = 236, cardH = 124, gapX = 24, gapY = 22, pad = 24, frameGap = 60, titleRoom = 50;
    let x = startX, y = startY, rowH = 0, col = 0;
    const patch: Record<string, Partial<CanvasElement>> = {};
    const frames: CanvasElement[] = [];
    for (const [kind, list] of kinds) {
      const perRow = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(list.length))));
      const rows = Math.ceil(list.length / perRow);
      const fw = pad * 2 + perRow * cardW + (perRow - 1) * gapX;
      const fh = titleRoom + pad + rows * cardH + (rows - 1) * gapY;
      if (col >= 2) { col = 0; x = startX; y += rowH + frameGap; rowH = 0; }
      const f = frameOf(kind);
      frames.push({ id: nanoid(10), type: "frame", x, y, w: fw, h: fh, title: f.title, color: f.color, z: 0 });
      list.forEach((c, i) => {
        patch[c.id] = { x: x + pad + (i % perRow) * (cardW + gapX), y: y + titleRoom + Math.floor(i / perRow) * (cardH + gapY), w: cardW, h: cardH };
      });
      x += fw + frameGap;
      rowH = Math.max(rowH, fh);
      col++;
    }
    // frames that only held cards we just moved out are now empty — drop them rather than leave husks
    const moved = new Set(Object.keys(patch));
    const emptyFrames = boxes
      .filter((b) => b.type === "frame")
      .filter((f) => !boxes.some((b) => b.id !== f.id && !moved.has(b.id) && b.type !== "frame" && boxContainsBox(f, b)))
      .filter((f) => boxes.some((b) => moved.has(b.id) && boxContainsBox(f, b)))
      .map((f) => f.id);
    s.pushHistory();
    s.addElements(frames, { select: false, history: false });
    s.updateElements(patch);
    if (emptyFrames.length) s.deleteElements(emptyFrames, { history: false });
    s.zoomToFit();
    return kinds.length;
  }, [store]);

  const arrangeByKind = useCallback(() => arrangeBy((c) => c.kind, (kind) => ({ title: kind || "Untyped", color: cardColorForKind(kind) })), [arrangeBy]);

  /** One frame per value of `key` (cards without the attribute land in a "no <key>" frame). */
  const arrangeByAttribute = useCallback((key: string) => {
    const values = new Map<string, number>();
    for (const el of Object.values(store.getState().elements)) if (el.type === "card") { const v = el.attributes?.[key] ?? ""; values.set(v, (values.get(v) ?? 0) + 1); }
    const order = [...values.entries()].filter(([v]) => v).sort((a, b) => b[1] - a[1]).map(([v]) => v);
    return arrangeBy((c) => c.attributes?.[key] ?? "", (v) => ({ title: v ? `${key}: ${v}` : `no ${key}`, color: v ? LENS_PALETTE[order.indexOf(v) % LENS_PALETTE.length]! : "#94a3b8" }));
  }, [arrangeBy, store]);

  /**
   * Lay the board out on a time axis.
   *
   * Generic on purpose: any attribute that reads as a date can be the axis and any other can be
   * the lanes, so this serves contract renewals and support windows as readily as a roadmap.
   * The lanes and the period labels are ordinary frames and section blocks — once it has run, the
   * result is a board somebody can rearrange by hand like any other.
   */
  const arrangeOnTimeline = useCallback((dateKey: string, laneKey?: string, laneByKind = false) => {
    const s = store.getState();
    const cards = Object.values(s.elements).filter((el): el is CardElement => el.type === "card");
    if (!cards.length) return 0;
    const boxes = Object.values(s.elements).filter(isBoxElement);
    const plan = planTimeline(cards, { dateKey, laneKey, laneByKind, origin: originBelow(boxes) });
    if (!plan.lanes.length) return 0;

    const created: CanvasElement[] = [
      ...plan.lanes.map((lane) => ({ id: nanoid(10), type: "frame" as const, x: lane.x, y: lane.y, w: lane.w, h: lane.h, title: lane.title, color: lane.color, z: 0 })),
      ...plan.periods.map((period) => ({
        id: nanoid(10), type: "text" as const, variant: "section" as const,
        x: period.x, y: period.y, w: period.w, h: period.h,
        title: period.label, text: "", color: "#1376d4", z: 0,
      })),
    ];
    const patch: Record<string, Partial<CanvasElement>> = {};
    for (const [id, at] of Object.entries(plan.positions)) patch[id] = { x: at.x, y: at.y, w: CARD_W, h: CARD_H };

    s.pushHistory();
    s.addElements(created, { select: false, history: false });
    s.updateElements(patch);
    s.zoomToFit();
    return Object.keys(plan.positions).length;
  }, [store]);

  /** Lay the selected box elements out on a grid. */
  const distributeSelection = useCallback(() => {
    const s = store.getState();
    const items = s.selection.map((id) => s.elements[id]).filter((el): el is Exclude<CanvasElement, { type: "connector" }> => !!el && isBoxElement(el));
    if (items.length < 2) return;
    const minX = Math.min(...items.map((i) => i.x));
    const minY = Math.min(...items.map((i) => i.y));
    const perRow = Math.ceil(Math.sqrt(items.length));
    const w = Math.max(...items.map((i) => i.w)) + 24;
    const h = Math.max(...items.map((i) => i.h)) + 22;
    const patch: Record<string, Partial<CanvasElement>> = {};
    items.forEach((it, i) => { patch[it.id] = { x: minX + (i % perRow) * w, y: minY + Math.floor(i / perRow) * h }; });
    s.updateElements(patch, { history: true });
  }, [store]);

  return { busy, showRelations, expandSelection, arrangeByKind, arrangeByAttribute, arrangeOnTimeline, distributeSelection };
}
