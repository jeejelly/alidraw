/**
 * A flow: screens, steps (hotspots) and the links between them, with a
 * Mermaid flowchart as its text form. The parser reads the part of Mermaid
 * flowcharts that describes this (nodes, shapes, subgraphs, links with
 * labels, dotted and thick styles); anything else is reported and left out.
 */
export type FlowShape = "rect" | "round" | "diamond" | "ellipse";
export type FlowDirection = "TD" | "BT" | "LR" | "RL";
export type FlowEdgeStyle = "solid" | "dashed" | "thick";

export type FlowNode = {
  key: string;
  label: string;
  shape: FlowShape;
  /** the screen (subgraph) it sits in */
  screen?: string;
};
export type FlowScreen = {
  key: string;
  label: string;
  /** the screen it is nested in (a screen can hold screens) */
  parent?: string;
};
export type FlowEdge = {
  from: string;
  to: string;
  label: string;
  style: FlowEdgeStyle;
  head: boolean;
  tail: boolean;
};
export type FlowGraph = {
  direction: FlowDirection;
  nodes: FlowNode[];
  screens: FlowScreen[];
  edges: FlowEdge[];
};
export type FlowIssue = {
  line: number;
  message: string;
  /** left out, but the rest is still usable */
  warn?: boolean;
};

export const emptyFlow = (): FlowGraph => ({
  direction: "TD",
  nodes: [],
  screens: [],
  edges: [],
});

/** a Mermaid-safe id from a label: "Pay now!" -> "pay_now" */
export const slugKey = (label: string, taken: ReadonlySet<string>) => {
  const base =
    label
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 24) || "step";
  let key = /^[a-z_]/.test(base) ? base : `n_${base}`;
  for (let suffix = 2; taken.has(key) || key === "end"; suffix++) {
    key = `${base}_${suffix}`;
  }
  return key;
};
