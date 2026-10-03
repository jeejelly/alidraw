import type { ExcalidrawElement } from "@excalidraw/element/types";

/**
 * How a diagram on the canvas belongs to a flow: `customData.flow` on the
 * element. Nodes are rectangles, diamonds and ellipses (a screen's buttons and
 * steps), screens are frames, links are arrows glued to two nodes.
 */
export type FlowMeta = {
  id: string;
  key: string;
  /**
   * `label` and `handle` are the parts a flow element wears around what it
   * wraps; `node` with `wrap` is its outline.
   */
  kind: "node" | "screen" | "edge" | "label" | "handle";
  /** a flow element: this outline wraps a group of drawn objects */
  wrap?: boolean;
  /** the group that holds the wrapped objects, the outline, label and handle */
  group?: string;
  /** a box standing in for what is not drawn yet */
  placeholder?: boolean;
};

export const getFlowMeta = (element: {
  customData?: ExcalidrawElement["customData"];
}): FlowMeta | null => {
  const flow = element.customData?.flow;
  return flow && typeof flow.id === "string" && typeof flow.key === "string"
    ? (flow as FlowMeta)
    : null;
};

export const withFlow = (element: ExcalidrawElement, meta: FlowMeta) => ({
  ...element.customData,
  flow: meta,
});

export const isNodeType = (type: string) =>
  type === "rectangle" || type === "diamond" || type === "ellipse";

export const listFlows = (elements: readonly ExcalidrawElement[]) => {
  const ids: string[] = [];
  for (const element of elements) {
    const flowMeta = !element.isDeleted ? getFlowMeta(element) : null;
    if (flowMeta && !ids.includes(flowMeta.id)) {
      ids.push(flowMeta.id);
    }
  }
  return ids;
};
