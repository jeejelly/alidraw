import { newElementWith } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { getFlowMeta, withFlow, type FlowGraphMeta } from "./flowMeta";

import type { FlowGraph } from "./flowGraph";

const graphMetaOf = (graph: FlowGraph): FlowGraphMeta => ({
  direction: graph.direction,
  preamble: graph.preamble,
  trailer: graph.trailer,
  invisible: graph.edges.filter((edge) => edge.style === "invisible"),
});

const isEmpty = (meta: FlowGraphMeta) =>
  meta.direction === "TD" &&
  !meta.preamble.length &&
  !meta.trailer.length &&
  !meta.invisible.length;

const holdsGraph = (element: ExcalidrawElement, flowId: string) => {
  const meta = getFlowMeta(element);
  return (
    !element.isDeleted &&
    meta?.id === flowId &&
    (meta.kind === "node" || meta.kind === "screen")
  );
};

/** The whole-diagram data lives on the first step or screen of the flow. */
export const storeGraphMeta = (
  elements: readonly ExcalidrawElement[],
  flowId: string,
  graph: FlowGraph,
) => {
  const meta = graphMetaOf(graph);
  const anchor = elements.find((element) => holdsGraph(element, flowId));
  return elements.map((element) => {
    const current = getFlowMeta(element);
    if (!current || current.id !== flowId) {
      return element;
    }
    const { graph: previous, ...rest } = current;
    if (element === anchor && !isEmpty(meta)) {
      return newElementWith(element, {
        customData: withFlow(element, { ...rest, graph: meta }),
      });
    }
    return previous
      ? newElementWith(element, { customData: withFlow(element, rest) })
      : element;
  });
};

export const readGraphMeta = (
  elements: readonly ExcalidrawElement[],
  flowId: string,
): FlowGraphMeta | null => {
  const holder = elements.find(
    (element) => holdsGraph(element, flowId) && getFlowMeta(element)?.graph,
  );
  return holder ? getFlowMeta(holder)!.graph! : null;
};
