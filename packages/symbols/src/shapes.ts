import { radiusOf, type SymbolTheme, type Token } from "./theme";

/** Components as shapes in theme tokens; the same list draws the preview and builds the canvas elements. */
export type Radius = "ctl" | "card" | "pill" | number;

type Common = {
  s?: Token | null;
  f?: Token | null;
  sw?: number;
  dash?: boolean;
};

export type Shape =
  | ({
      t: "rect";
      x: number;
      y: number;
      w: number;
      h: number;
      r?: Radius;
    } & Common)
  | ({ t: "ellipse"; x: number; y: number; w: number; h: number } & Common)
  | ({ t: "line"; pts: [number, number][] } & Common)
  | ({ t: "icon"; name: string; x: number; y: number; size: number } & Common)
  | {
      t: "text";
      x: number;
      y: number;
      text: string;
      size: number;
      s: Token;
      anchor?: "start" | "middle" | "end";
    };

export type ComponentCategory =
  | "Buttons"
  | "Inputs"
  | "Pickers"
  | "Display"
  | "Lists"
  | "Navigation"
  | "Overlays"
  | "Screens"
  | "Grids";

export const COMPONENT_CATEGORIES: readonly ComponentCategory[] = [
  "Buttons",
  "Inputs",
  "Pickers",
  "Display",
  "Lists",
  "Navigation",
  "Overlays",
  "Screens",
  "Grids",
];

export type Param = {
  key: string;
  label: string;
  kind: "number" | "bool" | "text" | "choice";
  def: number | boolean | string;
  min?: number;
  max?: number;
  options?: readonly string[];
};

export type Values = Record<string, any>;

export type ComponentDef = {
  id: string;
  name: string;
  category: ComponentCategory;
  w: number;
  h: number;
  tags?: string;
  params?: readonly Param[];
  shapes: (theme: SymbolTheme, values: Values) => Shape[];
};

export const defaultsOf = (def: ComponentDef): Values =>
  Object.fromEntries((def.params ?? []).map((param) => [param.key, param.def]));

/** a parametric component: `shapes` reads its values, `w` and `h` come from the shapes */
export const defineParametric = (
  id: string,
  name: string,
  category: ComponentCategory,
  params: readonly Param[],
  shapes: ComponentDef["shapes"],
  tags = "",
): ComponentDef => ({ id, name, category, w: 0, h: 0, params, shapes, tags });

export const resolveRadius = (
  radius: Radius | undefined,
  height: number,
  width: number,
  theme: SymbolTheme,
) => {
  const max = Math.min(width, height) / 2;
  if (typeof radius === "number") {
    return Math.min(radius, max);
  }
  if (radius === "pill") {
    return theme.radius === 0 ? 0 : max;
  }
  if (radius === "card") {
    return Math.min(radiusOf(theme, "card", height), max);
  }
  if (radius === "ctl") {
    return Math.min(radiusOf(theme, "ctl", height), max);
  }
  return 0;
};

export const rectShape = (
  x: number,
  y: number,
  width: number,
  height: number,
  overrides: Partial<Extract<Shape, { t: "rect" }>> = {},
): Shape => ({ t: "rect", x, y, w: width, h: height, ...overrides });
export const ellipseShape = (
  x: number,
  y: number,
  width: number,
  height: number,
  overrides: Partial<Extract<Shape, { t: "ellipse" }>> = {},
): Shape => ({ t: "ellipse", x, y, w: width, h: height, ...overrides });
export const lineShape = (
  pts: [number, number][],
  overrides: Partial<Common> = {},
): Shape => ({
  t: "line",
  pts,
  s: "text",
  ...overrides,
});
export const iconShape = (
  name: string,
  x: number,
  y: number,
  size: number,
  stroke: Token = "text",
): Shape => ({ t: "icon", name, x, y, size, s: stroke });
export const textShape = (
  text: string,
  x: number,
  y: number,
  size: number,
  stroke: Token = "text",
  anchor: "start" | "middle" | "end" = "start",
): Shape => ({ t: "text", text, x, y, size, s: stroke, anchor });

export const arcPts = (
  cx: number,
  cy: number,
  radius: number,
  a0: number,
  a1: number,
  segments = 18,
): [number, number][] =>
  Array.from({ length: segments + 1 }, (_, index) => {
    const angle = a0 + ((a1 - a0) * index) / segments;
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
  });

export const deg = (degrees: number) => (degrees * Math.PI) / 180;

export const defineComponent = (
  id: string,
  name: string,
  category: ComponentCategory,
  width: number,
  height: number,
  shapes: ComponentDef["shapes"],
  tags = "",
): ComponentDef => ({ id, name, category, w: width, h: height, shapes, tags });

const textWidth = (shape: string, size: number) => shape.length * size * 0.62;

/** the box the shapes fill */
export const boundsOf = (shapes: readonly Shape[]) => {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const add = (x: number, y: number) => {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  };
  for (const shape of shapes) {
    if (shape.t === "line") {
      shape.pts.forEach(([x, y]) => add(x, y));
    } else if (shape.t === "text") {
      const width = textWidth(shape.text, shape.size);
      const left =
        shape.anchor === "middle"
          ? shape.x - width / 2
          : shape.anchor === "end"
          ? shape.x - width
          : shape.x;
      add(left, shape.y - shape.size * 0.62);
      add(left + width, shape.y + shape.size * 0.62);
    } else if (shape.t === "icon") {
      add(shape.x, shape.y);
      add(shape.x + shape.size, shape.y + shape.size);
    } else {
      add(shape.x, shape.y);
      add(shape.x + shape.w, shape.y + shape.h);
    }
  }
  return Number.isFinite(x0)
    ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
    : { x: 0, y: 0, w: 0, h: 0 };
};
