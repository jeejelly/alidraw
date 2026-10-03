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
    const meta = getSymbolMeta(el);
    const group = symbolGroupOf(el);
    if (meta?.component && group && !el.isDeleted) {
      groups.set(group, [...(groups.get(group) ?? []), el]);
    }
  }
  return [...groups.values()].map((members) => {
    const meta = getSymbolMeta(members[0])!;
    const [x0, y0, x1, y1] = getCommonBounds(members);
    return {
      component: meta.component!,
      values: meta.values ?? {},
      width: x1 - x0,
      height: y1 - y0,
      x: x0,
      y: y0,
    };
  });
};
