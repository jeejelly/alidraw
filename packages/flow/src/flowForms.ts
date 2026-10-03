import type { FlowShape } from "./flowGraph";

/**
 * The Mermaid shapes of a flowchart node. A form is how the node is written;
 * `shape` is the box it is drawn as on the canvas (rectangle, rounded box,
 * diamond or ellipse), so a form survives a round trip without new drawing code.
 */
export type FlowForm =
  | "stadium"
  | "subroutine"
  | "cylinder"
  | "double-circle"
  | "hexagon"
  | "parallelogram"
  | "parallelogram-alt"
  | "trapezoid"
  | "trapezoid-alt"
  | "asymmetric"
  | "document"
  | "multi-document"
  | "delay"
  | "display"
  | "manual-input"
  | "internal-storage"
  | "stored-data"
  | "card"
  | "lined-process"
  | "loop-limit"
  | "cloud"
  | "hourglass"
  | "start"
  | "stop"
  | "junction"
  | "summary"
  | "fork"
  | "comment";

type FormInfo = {
  /** the box it is drawn as */
  shape: FlowShape;
  /** `[open, close]` when Mermaid has the classic bracket syntax for it */
  classic?: [string, string];
  /** names accepted in `A@{ shape: … }` (the first one is written) */
  names: string[];
};

export const FORMS: Record<FlowForm, FormInfo> = {
  stadium: {
    shape: "round",
    classic: ["([", "])"],
    names: ["stadium", "pill", "terminal"],
  },
  subroutine: {
    shape: "rect",
    classic: ["[[", "]]"],
    names: ["subroutine", "subproc", "fr-rect"],
  },
  cylinder: {
    shape: "rect",
    classic: ["[(", ")]"],
    names: ["cylinder", "cyl", "database", "db"],
  },
  "double-circle": {
    shape: "ellipse",
    classic: ["(((", ")))"],
    names: ["dbl-circ", "double-circle"],
  },
  hexagon: {
    shape: "rect",
    classic: ["{{", "}}"],
    names: ["hex", "hexagon", "prepare"],
  },
  parallelogram: {
    shape: "rect",
    classic: ["[/", "/]"],
    names: ["lean-r", "lean-right", "in-out"],
  },
  "parallelogram-alt": {
    shape: "rect",
    classic: ["[\\", "\\]"],
    names: ["lean-l", "lean-left", "out-in"],
  },
  trapezoid: {
    shape: "rect",
    classic: ["[/", "\\]"],
    names: ["trap-b", "trapezoid-bottom", "priority"],
  },
  "trapezoid-alt": {
    shape: "rect",
    classic: ["[\\", "/]"],
    names: ["trap-t", "trapezoid-top", "manual"],
  },
  asymmetric: { shape: "rect", classic: [">", "]"], names: ["odd"] },
  document: { shape: "rect", names: ["doc", "document"] },
  "multi-document": { shape: "rect", names: ["docs", "documents", "st-doc"] },
  delay: { shape: "rect", names: ["delay", "half-rounded-rectangle"] },
  display: { shape: "rect", names: ["curv-trap", "display"] },
  "manual-input": { shape: "rect", names: ["sl-rect", "manual-input"] },
  "internal-storage": {
    shape: "rect",
    names: ["win-pane", "internal-storage"],
  },
  "stored-data": { shape: "rect", names: ["bow-rect", "stored-data"] },
  card: { shape: "rect", names: ["notch-rect", "card"] },
  "lined-process": { shape: "rect", names: ["lin-rect", "lined-process"] },
  "loop-limit": { shape: "rect", names: ["notch-pent", "loop-limit"] },
  cloud: { shape: "ellipse", names: ["cloud"] },
  hourglass: { shape: "diamond", names: ["hourglass", "collate"] },
  start: { shape: "ellipse", names: ["sm-circ", "small-circle", "start"] },
  stop: { shape: "ellipse", names: ["fr-circ", "framed-circle", "stop"] },
  junction: {
    shape: "ellipse",
    names: ["f-circ", "filled-circle", "junction"],
  },
  summary: {
    shape: "ellipse",
    names: ["cross-circ", "crossed-circle", "summary"],
  },
  fork: { shape: "rect", names: ["fork", "join"] },
  comment: { shape: "rect", names: ["brace", "comment"] },
};

/** the shapes Mermaid writes with plain brackets, and the box each is drawn as */
export const BASIC_BRACKETS: Record<FlowShape, [string, string]> = {
  rect: ["[", "]"],
  round: ["(", ")"],
  diamond: ["{", "}"],
  ellipse: ["((", "))"],
};

const FORM_BY_NAME = new Map<string, FlowForm | FlowShape>();
for (const [form, info] of Object.entries(FORMS)) {
  for (const name of info.names) {
    FORM_BY_NAME.set(name, form as FlowForm);
  }
}
for (const [name, shape] of [
  ["rect", "rect"],
  ["rectangle", "rect"],
  ["process", "rect"],
  ["rounded", "round"],
  ["event", "round"],
  ["circle", "ellipse"],
  ["circ", "ellipse"],
  ["diam", "diamond"],
  ["diamond", "diamond"],
  ["decision", "diamond"],
  ["question", "diamond"],
] as const) {
  FORM_BY_NAME.set(name, shape);
}

/** a name from `@{ shape: … }`: a form, a plain shape, or nothing known */
export const formFromName = (name: string) => FORM_BY_NAME.get(name) ?? null;

export const isForm = (value: string): value is FlowForm => value in FORMS;
