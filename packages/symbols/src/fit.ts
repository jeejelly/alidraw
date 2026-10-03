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

/** Fits elements into a box: symbols stretch like Ctrl + drag, other shapes scale in proportion. */
export const fitIntoBox = (
  elements: readonly ExcalidrawElement[],
  box: Frame,
): ExcalidrawElement[] => {
  const els = elements.filter((element) => !element.isDeleted);
  if (!els.length) {
    return [];
  }
  const from = frameOf(els);
  const symbolic = els.every((element) => !!getSymbolMeta(element));
  let to: Frame = box;
  let pins: Map<string, Pin>;
  if (symbolic) {
    pins = inferPins(els, from, getLayout(els));
  } else {
    const fw = from.x1 - from.x0 || 1;
    const fh = from.y1 - from.y0 || 1;
    const scale = Math.min((box.x1 - box.x0) / fw, (box.y1 - box.y0) / fh);
    const width = fw * scale;
    const height = fh * scale;
    const cx = (box.x0 + box.x1) / 2;
    const cy = (box.y0 + box.y1) / 2;
    to = {
      x0: cx - width / 2,
      y0: cy - height / 2,
      x1: cx + width / 2,
      y1: cy + height / 2,
    };
    pins = new Map(
      els.map((element) => [element.id, { x: "p", y: "p" } as Pin]),
    );
  }
  const updates = stretchUpdates(els, pins, from, to);
  return els.map(
    (element) =>
      ({ ...element, ...(updates.get(element.id) ?? {}) } as ExcalidrawElement),
  );
};
