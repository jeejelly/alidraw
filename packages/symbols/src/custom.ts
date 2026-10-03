import { randomId } from "@excalidraw/common";
import { getBoundTextElement } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { getSymbolMeta, symbolGroupOf } from "./build";

import type { SymbolMeta } from "./build";

/**
 * A custom symbol: a drawing kept as ordinary elements plus a group and a list
 * of parameters. The parameters live in the elements, so copies carry them.
 */
export const CUSTOM_PREFIX = "custom:";

export type CustomProp =
  | "backgroundColor"
  | "strokeColor"
  | "text"
  | "opacity"
  | "strokeWidth"
  | "visible";

export type CustomTarget = { part: number; prop: CustomProp };

export type CustomParam = {
  key: string;
  label: string;
  kind: "color" | "text" | "number" | "toggle";
  targets: CustomTarget[];
  value: string | number | boolean;
  min?: number;
  max?: number;
};

export type CustomMeta = SymbolMeta & {
  /** the position of this element in the symbol, to find it again after copies */
  part?: number;
  /** only on part 0: what can be set */
  params?: CustomParam[];
  name?: string;
};

export const isCustom = (el: {
  customData?: ExcalidrawElement["customData"];
}) => !!getSymbolMeta(el)?.component?.startsWith(CUSTOM_PREFIX);

const area = (element: ExcalidrawElement) => element.width * element.height;
const solid = (color: string) => !!color && color !== "transparent";

const PROP_LABEL: Record<CustomProp, string> = {
  backgroundColor: "Fill",
  strokeColor: "Outline",
  text: "Text",
  opacity: "Opacity",
  strokeWidth: "Line width",
  visible: "Shown",
};

const KIND_OF: Record<CustomProp, CustomParam["kind"]> = {
  backgroundColor: "color",
  strokeColor: "color",
  text: "text",
  opacity: "number",
  strokeWidth: "number",
  visible: "toggle",
};

/** the value a part has now for a property */
export const readProp = (
  el: ExcalidrawElement,
  prop: CustomProp,
): string | number | boolean => {
  switch (prop) {
    case "text":
      return el.type === "text" ? (el as any).text : "";
    case "visible":
      return el.opacity > 0;
    default:
      return (el as any)[prop];
  }
};

export const makeParam = (
  key: string,
  label: string,
  prop: CustomProp,
  parts: readonly ExcalidrawElement[],
  partIndexes: number[],
): CustomParam => ({
  key,
  label,
  kind: KIND_OF[prop],
  targets: partIndexes.map((part) => ({ part, prop })),
  value: readProp(parts[partIndexes[0]], prop),
  ...(prop === "opacity" ? { min: 0, max: 100 } : {}),
  ...(prop === "strokeWidth" ? { min: 0, max: 20 } : {}),
});

/** Suggested parameters: the dominant fill, the shared outline, the text colour and each text (up to eight). */
export const detectParams = (
  parts: readonly ExcalidrawElement[],
): CustomParam[] => {
  const params: CustomParam[] = [];
  const shapes = parts
    .map((element, index) => ({ e: element, i: index }))
    .filter(
      ({ e: element }) => element.type !== "text" && element.type !== "arrow",
    );
  // the fill that spans the largest area: the symbol's "background"
  const fills = new Map<string, { area: number; idx: number[] }>();
  for (const { e: element, i: index } of shapes) {
    if (solid(element.backgroundColor)) {
      const fill = fills.get(element.backgroundColor) ?? { area: 0, idx: [] };
      fill.area += area(element);
      fill.idx.push(index);
      fills.set(element.backgroundColor, fill);
    }
  }
  const ranked = [...fills.entries()].sort(
    (first, second) => second[1].area - first[1].area,
  );
  if (ranked.length) {
    params.push(
      makeParam(
        "background",
        "Background",
        "backgroundColor",
        parts,
        ranked[0][1].idx,
      ),
    );
  }
  if (ranked.length > 1) {
    params.push(
      makeParam("accent", "Accent", "backgroundColor", parts, ranked[1][1].idx),
    );
  }
  const strokes = new Map<string, number[]>();
  for (const { e: element, i: index } of shapes) {
    if (solid(element.strokeColor) && element.strokeWidth > 0) {
      strokes.set(element.strokeColor, [
        ...(strokes.get(element.strokeColor) ?? []),
        index,
      ]);
    }
  }
  const outline = [...strokes.entries()].sort(
    (first, second) => second[1].length - first[1].length,
  )[0];
  if (outline) {
    params.push(
      makeParam("outline", "Outline", "strokeColor", parts, outline[1]),
    );
  }
  const texts = parts
    .map((element, index) => ({ e: element, i: index }))
    .filter(({ e: element }) => element.type === "text");
  if (texts.length) {
    params.push(
      makeParam(
        "ink",
        "Text colour",
        "strokeColor",
        parts,
        texts.map(({ i: index }) => index),
      ),
    );
  }
  // reading order: top to bottom, left to right
  [...texts]
    .sort((first, second) => first.e.y - second.e.y || first.e.x - second.e.x)
    .slice(0, 8)
    .forEach(({ i: index }, order) => {
      const text = String((parts[index] as any).text)
        .split("\n")[0]
        .slice(0, 24);
      params.push(
        makeParam(
          `text${order + 1}`,
          texts.length > 1 ? `Text ${order + 1}` : "Text",
          "text",
          parts,
          [index],
        ),
      );
      void text;
    });
  return params;
};

/** a key not used by the parameters yet */
export const freshKey = (params: readonly CustomParam[], base: string) => {
  const used = new Set(params.map((param) => param.key));
  let key = base;
  for (let suffix = 2; used.has(key); suffix++) {
    key = `${base}${suffix}`;
  }
  return key;
};

export const labelFor = (prop: CustomProp) => PROP_LABEL[prop];

/** Tags the elements with a group, their part index and the parameters; returns the copies and the group. */
export const makeCustomSymbol = (
  elements: readonly ExcalidrawElement[],
  name: string,
  params: CustomParam[] = detectParams(elements),
) => {
  const group = randomId();
  const id = `${CUSTOM_PREFIX}${randomId().slice(0, 8)}`;
  const values = Object.fromEntries(
    params.map((param) => [param.key, param.value]),
  );
  const tagged = elements.map((element, part) => {
    const meta: CustomMeta = {
      group,
      component: id,
      part,
      name,
      values,
      ...(part === 0 ? { params } : {}),
    };
    return {
      ...element,
      // the symbol's own group is the innermost one
      groupIds: [group, ...element.groupIds],
      customData: { ...element.customData, symbol: meta },
    } as ExcalidrawElement;
  });
  return { elements: tagged, group, id, params };
};

/** the parts of a symbol in order, and its parameters */
export const customOf = (members: readonly ExcalidrawElement[]) => {
  const sorted = [...members].sort(
    (first, second) =>
      ((getSymbolMeta(first) as CustomMeta | null)?.part ?? 0) -
      ((getSymbolMeta(second) as CustomMeta | null)?.part ?? 0),
  );
  const root = sorted.find(
    (element) => (getSymbolMeta(element) as CustomMeta | null)?.params,
  );
  const meta = root ? (getSymbolMeta(root) as CustomMeta) : null;
  return {
    parts: sorted,
    root,
    params: meta?.params ?? [],
    name: meta?.name ?? "Symbol",
    values: meta?.values ?? {},
  };
};

/** the updates a value of a parameter makes: element id → changes */
export const paramUpdates = (
  members: readonly ExcalidrawElement[],
  param: CustomParam,
  value: string | number | boolean,
) => {
  const byPart = new Map(
    members.map((element) => [
      (getSymbolMeta(element) as CustomMeta | null)?.part ?? -1,
      element,
    ]),
  );
  const updates = new Map<string, Record<string, unknown>>();
  for (const { part, prop } of param.targets) {
    const el = byPart.get(part);
    if (!el) {
      continue;
    }
    const update = updates.get(el.id) ?? {};
    switch (prop) {
      case "text":
        if (el.type === "text") {
          update.text = String(value);
          update.originalText = String(value);
        }
        break;
      case "visible":
        // hidden parts keep their opacity in the symbol's values, shown ones get it back
        update.opacity = value ? 100 : 0;
        break;
      case "opacity":
      case "strokeWidth":
        update[prop] = Number(value);
        break;
      default:
        update[prop] = String(value);
    }
    updates.set(el.id, update);
  }
  return updates;
};

/** members of the symbol a part belongs to */
export const membersOf = (
  all: readonly ExcalidrawElement[],
  el: ExcalidrawElement,
) => {
  const group = symbolGroupOf(el);
  return group
    ? all.filter(
        (element) => !element.isDeleted && symbolGroupOf(element) === group,
      )
    : [];
};

/** the bound text of a part, when it is a shape with a label */
export const textOfPart = (
  el: ExcalidrawElement,
  map: Parameters<typeof getBoundTextElement>[1],
) => (el.type === "text" ? el : getBoundTextElement(el, map));
