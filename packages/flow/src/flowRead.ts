import type { ExcalidrawElement } from "@excalidraw/element/types";

import { emptyFlow, type FlowEnd, type FlowGraph } from "./flowGraph";
import { readGraphMeta } from "./flowGraphMeta";
import { getFlowMeta } from "./flowMeta";
import { edgeStyleOf, partsOf, shapeOf } from "./flowParts";
import { textOf } from "./flowText";

const endOf = (arrowhead: string | null | undefined): FlowEnd | undefined =>
  arrowhead === "bar"
    ? "cross"
    : arrowhead === "circle" || arrowhead === "circle_outline"
    ? "circle"
    : undefined;

const boxOf = (element: ExcalidrawElement) => ({
  x: element.x,
  y: element.y,
  w: element.width,
  h: element.height,
});

export type ReadOptions = {
  /** also read where each step and screen sits */
  layout?: boolean;
};

/** the flow as drawn: what the Source view shows */
export const readFlow = (
  elements: readonly ExcalidrawElement[],
  flowId: string,
  options: ReadOptions = {},
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
  const stored = readGraphMeta(elements, flowId);
  for (const [key, frame] of screens) {
    graph.screens.push({
      key,
      label: frame.name || key,
      ...(getFlowMeta(frame)?.direction
        ? { direction: getFlowMeta(frame)!.direction }
        : {}),
      ...(options.layout ? { at: boxOf(frame) } : {}),
    });
  }
  for (const [key, element] of wrapScreens) {
    graph.screens.push({
      key,
      label: labelOf(key, element) || key,
      parent: wrapParent.get(key) ?? frameKeyOf(element),
      ...(getFlowMeta(element)?.direction
        ? { direction: getFlowMeta(element)!.direction }
        : {}),
      ...(options.layout ? { at: boxOf(element) } : {}),
    });
  }
  for (const [key, element] of nodes) {
    graph.nodes.push({
      key,
      label: labelOf(key, element),
      shape: shapeOf(element),
      ...(getFlowMeta(element)?.form
        ? { form: getFlowMeta(element)!.form }
        : {}),
      ...(getFlowMeta(element)?.classes?.length
        ? { classes: getFlowMeta(element)!.classes }
        : {}),
      ...(getFlowMeta(element)?.ports?.length
        ? { ports: getFlowMeta(element)!.ports }
        : {}),
      screen: wrapParent.get(key) ?? frameKeyOf(element),
      ...(options.layout ? { at: boxOf(element) } : {}),
    });
  }
  let spreadX = 0;
  let spreadY = 0;
  for (const arrow of arrows) {
    const from = keyOfId.get(arrow.startBinding!.elementId)!;
    const to = keyOfId.get(arrow.endBinding!.elementId)!;
    const link = getFlowMeta(arrow)?.link;
    const fromPort = link?.fromPort;
    const toPort = link?.toPort;
    const headEnd = link?.headEnd ?? endOf(arrow.endArrowhead);
    const tailEnd = link?.tailEnd ?? endOf(arrow.startArrowhead);
    graph.edges.push({
      from,
      to,
      label: textOf(arrow, map)?.text ?? "",
      style: edgeStyleOf(arrow),
      head: !!arrow.endArrowhead,
      tail: !!arrow.startArrowhead,
      ...(headEnd ? { headEnd } : {}),
      ...(tailEnd ? { tailEnd } : {}),
      ...(link?.length ? { length: link.length } : {}),
      ...(fromPort ? { fromPort } : {}),
      ...(toPort ? { toPort } : {}),
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
  graph.direction = stored?.direction ?? (spreadX > spreadY ? "LR" : "TD");
  if (stored?.layout) {
    graph.layout = stored.layout;
  }
  graph.preamble = stored?.preamble ?? [];
  graph.trailer = stored?.trailer ?? [];
  graph.edges.push(...(stored?.invisible ?? []));
  return graph;
};
