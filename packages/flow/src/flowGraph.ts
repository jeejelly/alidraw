import type { FlowForm } from "./flowForms";

/**
 * A flow: screens, steps (hotspots) and the links between them, with a
 * Mermaid flowchart as its text form. The parser reads the part of Mermaid
 * flowcharts that describes this (nodes, shapes, subgraphs, links with
 * labels, dotted and thick styles); anything else is reported and left out.
 */
export type FlowShape = "rect" | "round" | "diamond" | "ellipse";
export type FlowDirection = "TD" | "BT" | "LR" | "RL";
export type FlowEdgeStyle = "solid" | "dashed" | "thick" | "invisible";
/** how a link ends: the arrow head, `x` (cross) or `o` (circle) */
export type FlowEnd = "arrow" | "cross" | "circle";

/** where something sits on the canvas, kept in `%% @layout` comments */
export type FlowBox = { x: number; y: number; w: number; h: number };

export type FlowNode = {
  key: string;
  label: string;
  /** the box it is drawn as */
  shape: FlowShape;
  /** how Mermaid writes it, when that is more than the box (cylinder, hexagon…) */
  form?: FlowForm;
  /** `A:::name` */
  classes?: string[];
  /** the screen (subgraph) it sits in */
  screen?: string;
  at?: FlowBox;
};
export type FlowScreen = {
  key: string;
  label: string;
  /** the screen it is nested in (a screen can hold screens) */
  parent?: string;
  /** `direction LR` inside the subgraph */
  direction?: FlowDirection;
  at?: FlowBox;
};
export type FlowEdge = {
  from: string;
  to: string;
  label: string;
  style: FlowEdgeStyle;
  head: boolean;
  tail: boolean;
  /** the kind of end, when it is not the plain arrow */
  headEnd?: FlowEnd;
  tailEnd?: FlowEnd;
  /** extra dashes of a longer link (`---->`): the link spans more ranks */
  length?: number;
};
export type FlowGraph = {
  direction: FlowDirection;
  nodes: FlowNode[];
  screens: FlowScreen[];
  edges: FlowEdge[];
  /** `%%{init…}%%` directives, written before the header */
  preamble: string[];
  /** statements the canvas does not draw (classDef, style, click…), kept as written */
  trailer: string[];
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
  preamble: [],
  trailer: [],
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
