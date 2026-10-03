import {
  getFlowMeta,
  flowKeyAt,
  partsOf,
  selfAndAncestors,
} from "@excalidraw/flow";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type App from "../App";

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };

export type FlowHit =
  | { kind: "flow"; key: string; rect: Rect }
  | { kind: "object"; element: ExcalidrawElement; rect: Rect }
  | null;

const rectOf = (element: ExcalidrawElement): Rect => ({
  x: element.x,
  y: element.y,
  w: element.width,
  h: element.height,
});

const contains = (element: ExcalidrawElement, point: Point) =>
  point.x >= element.x &&
  point.x <= element.x + element.width &&
  point.y >= element.y &&
  point.y <= element.y + element.height;

const isFillableShape = (element: ExcalidrawElement) =>
  element.type === "rectangle" ||
  element.type === "ellipse" ||
  element.type === "diamond";

/**
 * What a link dragged from the handle of flow element `key` of `flowId` would
 * reach at `point`: another flow element, an object to wrap, or nothing.
 */
export const resolveFlowTarget = (
  app: App,
  point: Point,
  flowId: string,
  key: string,
): FlowHit => {
  const all = app.scene.getElementsIncludingDeleted();
  const excluded = selfAndAncestors(all, flowId, key);
  const parts = partsOf(all, flowId);
  const flowHit = (flowKey: string): FlowHit => ({
    kind: "flow",
    key: flowKey,
    rect: rectOf(parts.byKey.get(flowKey)!),
  });

  // what is drawn under the pointer, topmost first
  const hits = app.getElementsAtPosition(point.x, point.y);
  for (let index = hits.length - 1; index >= 0; index--) {
    const element = hits[index];
    if (element.type === "frame" || element.type === "magicframe") {
      continue;
    }
    const at = flowKeyAt(all, element, flowId, excluded);
    if (at.key) {
      return flowHit(at.key);
    }
    if (at.onlyExcluded || element.type === "arrow") {
      continue;
    }
    return { kind: "object", element, rect: rectOf(element) };
  }

  // the room inside an outline or an unfilled shape: the smallest around
  let best: { hit: FlowHit; area: number } | null = null;
  const consider = (hit: FlowHit, element: ExcalidrawElement) => {
    const area = element.width * element.height;
    if (!best || area < best.area) {
      best = { hit, area };
    }
  };
  for (const [flowKey, element] of parts.byKey) {
    if (!excluded.has(flowKey) && contains(element, point)) {
      consider(flowHit(flowKey), element);
    }
  }
  for (const element of app.scene.getNonDeletedElements()) {
    if (
      !isFillableShape(element) ||
      getFlowMeta(element) ||
      !contains(element, point)
    ) {
      continue;
    }
    const at = flowKeyAt(all, element, flowId, excluded);
    if (at.key) {
      consider(flowHit(at.key), element);
    } else if (!at.onlyExcluded) {
      consider({ kind: "object", element, rect: rectOf(element) }, element);
    }
  }
  return (best as { hit: FlowHit } | null)?.hit ?? null;
};
