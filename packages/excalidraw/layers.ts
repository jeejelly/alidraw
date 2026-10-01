import { randomId } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

/**
 * A layer is a named container that owns objects (Illustrator's model): it
 * orders them as a block in the z stack, hides/locks them together and styles
 * them together. Membership lives on the element (`customData.layerId`), the
 * ordered list of layers (bottom to top) in the app state.
 */
export type Layer = {
  id: string;
  name: string;
  /** the colour of its row and selection square */
  color: string;
  visible: boolean;
  locked: boolean;
  collapsed: boolean;
};

export const LAYER_COLORS = [
  "#4f80ff",
  "#ff4f4f",
  "#3fbf5f",
  "#ff9f1a",
  "#a259ff",
  "#00b8d9",
  "#e6c200",
  "#ff5fa2",
  "#7a8699",
];

export const getLayerId = (element: {
  customData?: ExcalidrawElement["customData"];
}): string | null =>
  typeof element.customData?.layerId === "string"
    ? element.customData.layerId
    : null;

/** `customData` with the element put in a layer, other keys kept */
export const withLayer = (
  element: { customData?: ExcalidrawElement["customData"] },
  layerId: string,
) => ({ ...element.customData, layerId });

export const newLayer = (layers: readonly Layer[], name?: string): Layer => ({
  id: randomId(),
  name: name ?? `Layer ${layers.length + 1}`,
  color: LAYER_COLORS[layers.length % LAYER_COLORS.length],
  visible: true,
  locked: false,
  collapsed: false,
});

/** the ids of the layers that are switched off, as a stable key */
export const getHiddenLayerKey = (layers: readonly Layer[]) =>
  layers
    .filter((l) => !l.visible)
    .map((l) => l.id)
    .join(",");

export const isInHiddenLayer = (
  element: { customData?: ExcalidrawElement["customData"] },
  hidden: ReadonlySet<string>,
) => {
  const id = getLayerId(element);
  return id !== null && hidden.has(id);
};

/**
 * The stack order the layers impose: every object of a layer is above every
 * object of the layers below it; inside a layer the order is kept. Bound
 * labels follow their container.
 */
export const orderByLayers = <T extends ExcalidrawElement>(
  elements: readonly T[],
  layers: readonly Layer[],
  fallbackLayerId: string,
): T[] => {
  const rank = new Map(layers.map((l, i) => [l.id, i]));
  const byId = new Map(elements.map((e) => [e.id, e]));
  const rankOf = (e: ExcalidrawElement): number => {
    const owner =
      e.type === "text" && e.containerId ? byId.get(e.containerId) ?? e : e;
    return rank.get(getLayerId(owner) ?? fallbackLayerId) ?? 0;
  };
  return elements
    .map((e, i) => ({ e, i, r: rankOf(e) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(({ e }) => e);
};

export const sanitizeLayers = (raw: unknown): Layer[] => {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const out: Layer[] = [];
  for (const l of raw) {
    if (!l || typeof l.id !== "string" || !l.id || seen.has(l.id)) {
      continue;
    }
    seen.add(l.id);
    out.push({
      id: l.id,
      name: typeof l.name === "string" && l.name ? l.name : "Layer",
      color:
        typeof l.color === "string" && /^#[0-9a-f]{3,8}$/i.test(l.color)
          ? l.color
          : LAYER_COLORS[out.length % LAYER_COLORS.length],
      visible: l.visible !== false,
      locked: l.locked === true,
      collapsed: l.collapsed === true,
    });
  }
  return out;
};
