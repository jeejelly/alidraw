import { getCommonBounds } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { getSymbolMeta, symbolGroupOf } from "../build";
import { isMapped } from "../codegen";

import type { CodeItem } from "../codegen";

export type Unit =
  | { kind: "symbol"; item: CodeItem }
  | { kind: "element"; el: ExcalidrawElement };

export const unitsOf = (elements: readonly ExcalidrawElement[]): Unit[] => {
  const all = elements.filter((element) => !element.isDeleted);
  const symbolGroups = new Map<string, ExcalidrawElement[]>();
  const loose: ExcalidrawElement[] = [];
  for (const el of all) {
    const group = symbolGroupOf(el);
    const component = getSymbolMeta(el)?.component ?? "";
    if (group && (isMapped(component) || component.startsWith("icon:"))) {
      symbolGroups.set(group, [...(symbolGroups.get(group) ?? []), el]);
    } else {
      loose.push(el);
    }
  }
  const units: Unit[] = [];
  for (const members of symbolGroups.values()) {
    const meta = getSymbolMeta(members[0])!;
    const [x0, y0, x1, y1] = getCommonBounds(members);
    units.push({
      kind: "symbol",
      item: {
        component: meta.component!,
        values: meta.values ?? {},
        width: x1 - x0,
        height: y1 - y0,
        x: x0,
        y: y0,
      },
    });
  }
  for (const el of loose) {
    units.push({ kind: "element", el });
  }
  return units;
};

export const boundsOfUnit = (unit: Unit) =>
  unit.kind === "symbol"
    ? {
        x: unit.item.x,
        y: unit.item.y,
        w: unit.item.width,
        h: unit.item.height,
      }
    : { x: unit.el.x, y: unit.el.y, w: unit.el.width, h: unit.el.height };
