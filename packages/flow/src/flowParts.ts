import type {
  ExcalidrawArrowElement,
  ExcalidrawElement,
  ExcalidrawFrameElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { getFlowMeta, isNodeType } from "./flowMeta";

import type { FlowEdge, FlowNode } from "./flowGraph";

export type FlowParts = {
  live: ExcalidrawElement[];
  map: Map<string, ExcalidrawElement>;
  nodes: Map<string, ExcalidrawElement>;
  screens: Map<string, ExcalidrawFrameElement>;
  keyOfId: Map<string, string>;
  arrows: ExcalidrawArrowElement[];
  /** flow elements that hold other flow elements: screens made of objects */
  wrapScreens: Map<string, ExcalidrawElement>;
  /** every outline of a flow element, by key */
  wraps: Map<string, ExcalidrawElement>;
  /** the flow element an outline sits in, by key */
  wrapParent: Map<string, string>;
  labels: Map<string, ExcalidrawTextElement>;
  handles: Map<string, ExcalidrawElement>;
  /** every step, container or not, by key */
  byKey: Map<string, ExcalidrawElement>;
};

export const shapeOf = (element: ExcalidrawElement): FlowNode["shape"] =>
  element.type === "diamond"
    ? "diamond"
    : element.type === "ellipse"
    ? "ellipse"
    : // thin corners are a box's own look; only a big radius makes a rounded step
    element.roundness && (element.roundness.value ?? 32) > 16
    ? "round"
    : "rect";

export const edgeStyleOf = (element: ExcalidrawElement): FlowEdge["style"] =>
  element.strokeStyle !== "solid"
    ? "dashed"
    : element.strokeWidth >= 4
    ? "thick"
    : "solid";

/** which flow element sits in which: the outer one is a screen of objects */
const findWrapParents = (wraps: Map<string, ExcalidrawElement>) => {
  const keyOfGroup = new Map<string, string>();
  for (const [key, element] of wraps) {
    const groupId = getFlowMeta(element)!.group;
    if (groupId) {
      keyOfGroup.set(groupId, key);
    }
  }
  const wrapParent = new Map<string, string>();
  for (const [key, element] of wraps) {
    const own = getFlowMeta(element)!.group;
    const from = own
      ? element.groupIds.indexOf(own) + 1
      : element.groupIds.length;
    for (const groupId of element.groupIds.slice(from)) {
      const outer = keyOfGroup.get(groupId);
      if (outer && outer !== key) {
        wrapParent.set(key, outer);
        break;
      }
    }
  }
  return wrapParent;
};

export const partsOf = (
  elements: readonly ExcalidrawElement[],
  flowId: string,
): FlowParts => {
  const live = elements.filter((element) => !element.isDeleted);
  const map = new Map(live.map((element) => [element.id, element]));
  const nodes = new Map<string, ExcalidrawElement>();
  const screens = new Map<string, ExcalidrawFrameElement>();
  const keyOfId = new Map<string, string>();
  const wraps = new Map<string, ExcalidrawElement>();
  const labels = new Map<string, ExcalidrawTextElement>();
  const handles = new Map<string, ExcalidrawElement>();
  for (const element of live) {
    const flowMeta = getFlowMeta(element);
    if (!flowMeta || flowMeta.id !== flowId) {
      continue;
    }
    if (flowMeta.kind === "label" && element.type === "text") {
      labels.set(flowMeta.key, element as ExcalidrawTextElement);
    } else if (flowMeta.kind === "handle") {
      handles.set(flowMeta.key, element);
    } else if (flowMeta.kind === "node" && isNodeType(element.type)) {
      nodes.set(flowMeta.key, element);
      keyOfId.set(element.id, flowMeta.key);
      if (flowMeta.wrap) {
        wraps.set(flowMeta.key, element);
      }
    } else if (flowMeta.kind === "screen" && element.type === "frame") {
      screens.set(flowMeta.key, element as ExcalidrawFrameElement);
    }
  }
  const wrapParent = findWrapParents(wraps);
  const wrapScreens = new Map<string, ExcalidrawElement>();
  for (const parent of new Set(wrapParent.values())) {
    wrapScreens.set(parent, nodes.get(parent)!);
    nodes.delete(parent);
  }
  const byKey = new Map([...nodes, ...wrapScreens]);
  const arrows = live.filter(
    (element): element is ExcalidrawArrowElement =>
      element.type === "arrow" &&
      !!element.startBinding &&
      !!element.endBinding &&
      keyOfId.has(element.startBinding.elementId) &&
      keyOfId.has(element.endBinding.elementId),
  );
  return {
    live,
    map,
    nodes,
    screens,
    keyOfId,
    arrows,
    wrapScreens,
    wraps,
    wrapParent,
    labels,
    handles,
    byKey,
  };
};
