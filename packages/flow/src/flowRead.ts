import type { ExcalidrawElement } from "@excalidraw/element/types";

import { emptyFlow, type FlowGraph } from "./flowGraph";
import { getFlowMeta } from "./flowMeta";
import { edgeStyleOf, partsOf, shapeOf } from "./flowParts";
import { textOf } from "./flowText";

/** the flow as drawn: what the Source view shows */
export const readFlow = (
  elements: readonly ExcalidrawElement[],
  flowId: string,
): FlowGraph => {
  const {
    map,
    nodes,
    screens,
    keyOfId,
    arrows,
    wrapScreens,
    wrapParent,
    labels,
    byKey,
  } = partsOf(elements, flowId);
  const graph = emptyFlow();
  const screenKeyOfFrame = new Map(
    [...screens].map(([key, frame]) => [frame.id, key]),
  );
  const labelOf = (key: string, element: ExcalidrawElement) =>
    getFlowMeta(element)?.wrap
      ? labels.get(key)?.text ?? ""
      : textOf(element, map)?.text ?? "";
  const frameKeyOf = (element: ExcalidrawElement) =>
    element.frameId ? screenKeyOfFrame.get(element.frameId) : undefined;
  for (const [key, frame] of screens) {
    graph.screens.push({ key, label: frame.name || key });
  }
  for (const [key, element] of wrapScreens) {
    graph.screens.push({
      key,
      label: labelOf(key, element) || key,
      parent: wrapParent.get(key) ?? frameKeyOf(element),
    });
  }
  for (const [key, element] of nodes) {
    graph.nodes.push({
      key,
      label: labelOf(key, element),
      shape: shapeOf(element),
      screen: wrapParent.get(key) ?? frameKeyOf(element),
    });
  }
  let spreadX = 0;
  let spreadY = 0;
  for (const arrow of arrows) {
    const from = keyOfId.get(arrow.startBinding!.elementId)!;
    const to = keyOfId.get(arrow.endBinding!.elementId)!;
    graph.edges.push({
      from,
      to,
      label: textOf(arrow, map)?.text ?? "",
      style: edgeStyleOf(arrow),
      head: !!arrow.endArrowhead,
      tail: !!arrow.startArrowhead,
    });
    const fromElement = byKey.get(from)!;
    const toElement = byKey.get(to)!;
    spreadX += Math.abs(
      toElement.x +
        toElement.width / 2 -
        (fromElement.x + fromElement.width / 2),
    );
    spreadY += Math.abs(
      toElement.y +
        toElement.height / 2 -
        (fromElement.y + fromElement.height / 2),
    );
  }
  graph.direction = spreadX > spreadY ? "LR" : "TD";
  return graph;
};
