import { radiusOf, type SymbolTheme, type Token } from "./theme";

/**
 * UI components as a short list of shapes in theme tokens. The same list
 * draws the preview in the panel and builds the editable shapes on the canvas.
 */
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
  | "Screens";

export const COMPONENT_CATEGORIES: readonly ComponentCategory[] = [
  "Buttons",
  "Inputs",
  "Pickers",
  "Display",
  "Lists",
  "Navigation",
  "Overlays",
  "Screens",
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
  Object.fromEntries((def.params ?? []).map((p) => [p.key, p.def]));

/** a parametric component: `shapes` reads its values, `w` and `h` come from the shapes */
export const p = (
  id: string,
  name: string,
  category: ComponentCategory,
  params: readonly Param[],
  shapes: ComponentDef["shapes"],
  tags = "",
): ComponentDef => ({ id, name, category, w: 0, h: 0, params, shapes, tags });

export const resolveRadius = (
  r: Radius | undefined,
  h: number,
  w: number,
  theme: SymbolTheme,
) => {
  const max = Math.min(w, h) / 2;
  if (typeof r === "number") {
    return Math.min(r, max);
  }
  if (r === "pill") {
    return theme.radius === "sharp" ? 0 : max;
  }
  if (r === "card") {
    return Math.min(radiusOf(theme, "card", h), max);
  }
  if (r === "ctl") {
    return Math.min(radiusOf(theme, "ctl", h), max);
  }
  return 0;
};

export const R = (
  x: number,
  y: number,
  w: number,
  h: number,
  o: Partial<Extract<Shape, { t: "rect" }>> = {},
): Shape => ({ t: "rect", x, y, w, h, ...o });
export const E = (
  x: number,
  y: number,
  w: number,
  h: number,
  o: Partial<Extract<Shape, { t: "ellipse" }>> = {},
): Shape => ({ t: "ellipse", x, y, w, h, ...o });
export const L = (pts: [number, number][], o: Partial<Common> = {}): Shape => ({
  t: "line",
  pts,
  s: "text",
  ...o,
});
export const I = (
  name: string,
  x: number,
  y: number,
  size: number,
  s: Token = "text",
): Shape => ({ t: "icon", name, x, y, size, s });
export const T = (
  text: string,
  x: number,
  y: number,
  size: number,
  s: Token = "text",
  anchor: "start" | "middle" | "end" = "start",
): Shape => ({ t: "text", text, x, y, size, s, anchor });

export const arcPts = (
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  n = 18,
): [number, number][] =>
  Array.from({ length: n + 1 }, (_, k) => {
    const a = a0 + ((a1 - a0) * k) / n;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });

export const deg = (d: number) => (d * Math.PI) / 180;

export const c = (
  id: string,
  name: string,
  category: ComponentCategory,
  w: number,
  h: number,
  shapes: ComponentDef["shapes"],
  tags = "",
): ComponentDef => ({ id, name, category, w, h, shapes, tags });

const textWidth = (s: string, size: number) => s.length * size * 0.62;

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
  for (const s of shapes) {
    if (s.t === "line") {
      s.pts.forEach(([x, y]) => add(x, y));
    } else if (s.t === "text") {
      const w = textWidth(s.text, s.size);
      const left =
        s.anchor === "middle"
          ? s.x - w / 2
          : s.anchor === "end"
          ? s.x - w
          : s.x;
      add(left, s.y - s.size * 0.62);
      add(left + w, s.y + s.size * 0.62);
    } else if (s.t === "icon") {
      add(s.x, s.y);
      add(s.x + s.size, s.y + s.size);
    } else {
      add(s.x, s.y);
      add(s.x + s.w, s.y + s.h);
    }
  }
  return Number.isFinite(x0)
    ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
    : { x: 0, y: 0, w: 0, h: 0 };
};
