import { randomId } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

/**
 * A layer is a named container that owns objects (the usual design-tool model): it
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
    .filter((layer) => !layer.visible)
    .map((layer) => layer.id)
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
  const rank = new Map(layers.map((layer, index) => [layer.id, index]));
  const byId = new Map(elements.map((element) => [element.id, element]));
  const rankOf = (element: ExcalidrawElement): number => {
    const owner =
      element.type === "text" && element.containerId
        ? byId.get(element.containerId) ?? element
        : element;
    return rank.get(getLayerId(owner) ?? fallbackLayerId) ?? 0;
  };
  return elements
    .map((element, index) => ({ element, index, rank: rankOf(element) }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map(({ element }) => element);
};

export const sanitizeLayers = (raw: unknown): Layer[] => {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const out: Layer[] = [];
  for (const entry of raw) {
    if (
      !entry ||
      typeof entry.id !== "string" ||
      !entry.id ||
      seen.has(entry.id)
    ) {
      continue;
    }
    seen.add(entry.id);
    out.push({
      id: entry.id,
      name: typeof entry.name === "string" && entry.name ? entry.name : "Layer",
      color:
        typeof entry.color === "string" && /^#[0-9a-f]{3,8}$/i.test(entry.color)
          ? entry.color
          : LAYER_COLORS[out.length % LAYER_COLORS.length],
      visible: entry.visible !== false,
      locked: entry.locked === true,
      collapsed: entry.collapsed === true,
    });
  }
  return out;
};

/** the sanitized layers and the active one (the topmost when it is gone) */
export const restoreLayers = (rawLayers: unknown, activeLayerId: unknown) => {
  const layers = sanitizeLayers(rawLayers);
  const active = layers.find((layer) => layer.id === activeLayerId);
  return {
    layers,
    activeLayerId: active?.id ?? layers[layers.length - 1]?.id ?? null,
  };
};
