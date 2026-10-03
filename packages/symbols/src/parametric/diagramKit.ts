import {
  defineParametric,
  lineShape,
  rectShape,
  textShape,
  type ComponentCategory,
  type ComponentFlow,
  type ComponentDef,
  type Param,
  type Shape,
  type SymbolFlowPort,
} from "../shapes";

import { num, pick, text } from "./helpers";

import type { Token } from "../theme";

/** the outcomes of a decision; a mirror of the flow package's defaults */
export const DECISION_PORTS: SymbolFlowPort[] = [
  { name: "in", at: [0.5, 0] },
  { name: "yes", at: [0.5, 1] },
  { name: "no", at: [1, 0.5] },
  { name: "other", at: [0, 0.5] },
];

export const FORK_PORTS: SymbolFlowPort[] = [
  { name: "in", at: [0.5, 0] },
  { name: "first", at: [0.2, 1] },
  { name: "second", at: [0.5, 1] },
  { name: "third", at: [0.8, 1] },
];

const ACCENTS: readonly Token[] = [
  "accent",
  "success",
  "danger",
  "muted",
  "text",
];

export const accentParam: Param = pick("accent", "Accent", "accent", ACCENTS);

export const sizeParams = (width: number, height: number): Param[] => [
  num("width", "Width", width, 24, 600),
  num("height", "Height", height, 24, 600),
];

/** a closed outline, filled with the surface colour unless `fill` says otherwise */
export const closed = (
  points: [number, number][],
  ink: Token,
  fill: Token | null = "surface",
): Shape => lineShape([...points, points[0]], { s: ink, f: fill });

/** points along an elliptical arc, angles in radians */
export const ellipseArc = (
  cx: number,
  cy: number,
  radiusX: number,
  radiusY: number,
  from: number,
  to: number,
  segments = 16,
): [number, number][] =>
  Array.from({ length: segments + 1 }, (_, index) => {
    const angle = from + ((to - from) * index) / segments;
    return [cx + Math.cos(angle) * radiusX, cy + Math.sin(angle) * radiusY];
  });

export const cylinder = (width: number, height: number, ink: Token) => {
  const cap = Math.min(height / 4, 16);
  return [
    rectShape(0, cap, width, height - 2 * cap, { f: "surface", s: null }),
    lineShape(ellipseArc(width / 2, height - cap, width / 2, cap, 0, Math.PI), {
      s: ink,
    }),
    lineShape(
      [
        [0, cap],
        [0, height - cap],
      ],
      { s: ink },
    ),
    lineShape(
      [
        [width, cap],
        [width, height - cap],
      ],
      { s: ink },
    ),
    // drawn last so the rim covers the side lines
    { t: "ellipse", x: 0, y: 0, w: width, h: cap * 2, f: "surface", s: ink },
  ] as Shape[];
};

type NodeSpec = {
  id: string;
  name: string;
  category: ComponentCategory;
  tags: string;
  width: number;
  height: number;
  /** the text param and its default */
  labelParam?: string;
  label: string;
  flow: Omit<ComponentFlow, "labelParam">;
  /** the outline, in the accent colour */
  body: (width: number, height: number, ink: Token) => Shape[];
  /** where the label goes; centred by default */
  place?: (
    width: number,
    height: number,
  ) => [number, number, "start" | "middle"];
  /** more params than label, size and accent */
  extra?: Param[];
};

/** A flow-ready symbol: label, size and accent, drawn by `body`. */
export const nodeDef = (spec: NodeSpec): ComponentDef => {
  const labelParam = spec.labelParam ?? "label";
  const def = defineParametric(
    spec.id,
    spec.name,
    spec.category,
    [
      text(labelParam, "Label", spec.label),
      ...sizeParams(spec.width, spec.height),
      accentParam,
      ...(spec.extra ?? []),
    ],
    (_theme, values) => {
      const { width, height } = values;
      const [x, y, anchor] = spec.place?.(width, height) ?? [
        width / 2,
        height / 2,
        "middle",
      ];
      return [
        ...spec.body(width, height, values.accent as Token),
        textShape(values[labelParam], x, y, 14, "text", anchor),
      ];
    },
    spec.tags,
  );
  return { ...def, flow: { ...spec.flow, labelParam } };
};

export const withFlow = (
  def: ComponentDef,
  flow: ComponentFlow,
): ComponentDef => ({
  ...def,
  flow,
});
