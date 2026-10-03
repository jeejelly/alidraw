import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { FlowForm } from "./flowForms";
import type { FlowPort } from "./flowPorts";
import type { FlowDirection, FlowEdge, FlowEnd } from "./flowGraph";

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
  /** a node: how Mermaid writes it, and its `:::classes` */
  form?: FlowForm;
  classes?: string[];
  ports?: FlowPort[];
  /** a screen: `direction LR` inside its subgraph */
  direction?: FlowDirection;
  /** a link: the ends and length that the drawn arrow cannot say */
  link?: {
    headEnd?: FlowEnd;
    tailEnd?: FlowEnd;
    length?: number;
    fromPort?: string;
    toPort?: string;
  };
  /** on one element per flow: what belongs to the whole diagram */
  graph?: FlowGraphMeta;
};

/** the parts of a flowchart the drawing itself does not hold */
export type FlowGraphMeta = {
  direction: FlowDirection;
  preamble: string[];
  trailer: string[];
  /** `a ~~~ b`: layout hints, not drawn */
  invisible: FlowEdge[];
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
