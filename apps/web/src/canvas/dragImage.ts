import { cardColorForKind } from "./document";
import type { EntityLike } from "./entityCard";

/**
 * The thing that follows the cursor while you drag (§5.44).
 *
 * Without this the browser drags a snapshot of the list row — a white strip with a "+" button on
 * it, which is a picture of the control you clicked rather than of the thing you are moving. A
 * small chip naming the object, in its kind's colour, says what is in your hand.
 *
 * The node has to be in the document when `setDragImage` is called and is no use afterwards, so it
 * is appended off-screen and removed on the next tick; removing it synchronously loses the image
 * in every browser that snapshots asynchronously.
 */
export function setEntityDragImage(dt: DataTransfer, entities: EntityLike[]) {
  if (typeof document === "undefined" || entities.length === 0) return;
  const first = entities[0]!;
  const node = document.createElement("div");
  node.className = "entity-drag-chip";
  node.style.setProperty("--card-color", cardColorForKind(first.kind));

  const swatch = document.createElement("i");
  node.appendChild(swatch);

  const label = document.createElement("b");
  label.textContent = entities.length === 1 ? first.name || "(unnamed)" : `${entities.length} ${first.kind || "objects"}`;
  node.appendChild(label);

  if (entities.length === 1 && first.kind) {
    const kind = document.createElement("small");
    kind.textContent = first.kind;
    node.appendChild(kind);
  }

  document.body.appendChild(node);
  dt.setDragImage(node, 16, 16);
  setTimeout(() => node.remove(), 0);
}
