import type { ExcalidrawElement } from "@excalidraw/element/types";

import { getSymbolMeta } from "./build";
import {
  frameOf,
  getLayout,
  inferPins,
  stretchUpdates,
  type Frame,
  type Pin,
} from "./stretch";

/**
 * An item (a symbol, or any shapes) fitted into a box: a component stretches
 * the way it does with Ctrl + drag, other shapes scale in proportion and sit
 * in the middle of the box.
 */
export const fitIntoBox = (
  elements: readonly ExcalidrawElement[],
  box: Frame,
): ExcalidrawElement[] => {
  const els = elements.filter((e) => !e.isDeleted);
  if (!els.length) {
    return [];
  }
  const from = frameOf(els);
  const symbolic = els.every((e) => !!getSymbolMeta(e));
  let to: Frame = box;
  let pins: Map<string, Pin>;
  if (symbolic) {
    pins = inferPins(els, from, getLayout(els));
  } else {
    const fw = from.x1 - from.x0 || 1;
    const fh = from.y1 - from.y0 || 1;
    const k = Math.min((box.x1 - box.x0) / fw, (box.y1 - box.y0) / fh);
    const w = fw * k;
    const h = fh * k;
    const cx = (box.x0 + box.x1) / 2;
    const cy = (box.y0 + box.y1) / 2;
    to = { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
    pins = new Map(els.map((e) => [e.id, { x: "p", y: "p" } as Pin]));
  }
  const updates = stretchUpdates(els, pins, from, to);
  return els.map(
    (e) => ({ ...e, ...(updates.get(e.id) ?? {}) } as ExcalidrawElement),
  );
};
