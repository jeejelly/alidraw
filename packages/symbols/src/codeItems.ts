import { getCommonBounds } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { getSymbolMeta, symbolGroupOf } from "./build";

import type { CodeItem } from "./codegen";

/** the components among some elements: one item per group that remembers what it is */
export const collectCodeItems = (
  elements: readonly ExcalidrawElement[],
): CodeItem[] => {
  const groups = new Map<string, ExcalidrawElement[]>();
  for (const el of elements) {
    const m = getSymbolMeta(el);
    const g = symbolGroupOf(el);
    if (m?.component && g && !el.isDeleted) {
      groups.set(g, [...(groups.get(g) ?? []), el]);
    }
  }
  return [...groups.values()].map((members) => {
    const m = getSymbolMeta(members[0])!;
    const [x0, y0, x1, y1] = getCommonBounds(members);
    return {
      component: m.component!,
      values: m.values ?? {},
      width: x1 - x0,
      height: y1 - y0,
      x: x0,
      y: y0,
    };
  });
};
