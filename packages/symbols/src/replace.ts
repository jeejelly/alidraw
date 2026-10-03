import { getBoundTextElement, isTextElement } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { buildElements, getSymbolMeta, labelKeyOf } from "./build";
import { COMPONENTS, defaultsOf, type Values } from "./components";
import { frameOf, getLayout, inferPins, stretchUpdates } from "./stretch";

import type { SymbolTheme } from "./theme";

const NODE_TYPES = new Set(["rectangle", "diamond", "ellipse"]);

/** the label of a shape: its bound text, or the text itself */
export const labelOf = (
  el: ExcalidrawElement,
  map: Parameters<typeof getBoundTextElement>[1],
): string => {
  if (isTextElement(el)) {
    return el.text;
  }
  return getBoundTextElement(el, map)?.text ?? "";
};

/** the shapes of a component, stretched to fill a box */
export const symbolInBox = (
  componentId: string,
  values: Values,
  theme: SymbolTheme,
  box: { x: number; y: number; width: number; height: number },
  label: string,
): ExcalidrawElement[] => {
  const def = COMPONENTS.find((component) => component.id === componentId);
  if (!def) {
    return [];
  }
  const key = labelKeyOf(componentId);
  const merged = {
    ...defaultsOf(def),
    ...values,
    ...(key && label ? { [key]: label } : {}),
  };
  const els = buildElements(
    def.shapes(theme, merged),
    theme,
    { x: 0, y: 0 },
    def.id,
  );
  const from = frameOf(els);
  const to = {
    x0: box.x,
    y0: box.y,
    x1: box.x + Math.max(box.width, 24),
    y1: box.y + Math.max(box.height, 24),
  };
  const pins = inferPins(els, from, getLayout(els));
  const updates = stretchUpdates(els, pins, from, to);
  return els.map((element) => {
    const update = updates.get(element.id) ?? {};
    return {
      ...element,
      ...update,
      customData: {
        ...element.customData,
        symbol: {
          ...element.customData?.symbol,
          component: componentId,
          values,
        },
      },
    } as ExcalidrawElement;
  });
};

export const isReplaceable = (el: ExcalidrawElement) =>
  !el.isDeleted &&
  (NODE_TYPES.has(el.type) || isTextElement(el)) &&
  !getSymbolMeta(el);
