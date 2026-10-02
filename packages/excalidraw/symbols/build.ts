import { FONT_FAMILY, randomId, ROUNDNESS } from "@excalidraw/common";
import {
  getPathUpdate,
  newElement,
  newLinearElement,
  newPathElement,
  newTextElement,
} from "@excalidraw/element";
import { pointFrom, type LocalPoint } from "@excalidraw/math";

import type {
  ExcalidrawElement,
  PathPointHandles,
} from "@excalidraw/element/types";

import {
  boundsOf,
  COMPONENTS,
  defaultsOf,
  resolveRadius,
  type Shape,
  type Values,
} from "./components";
import { getIcon } from "./icons";
import { parsePath } from "./svgPath";

import type { SymbolTheme, Token } from "./theme";

export { boundsOf };

/** what a symbol element remembers of its theme: tokens, so a new theme can recolour it */
export type SymbolMeta = {
  s?: Token | null;
  f?: Token | null;
  /** stroke follows the theme's stroke width, scaled by this */
  sw?: number;
  r?: any;
  /** how the component re-lays out when it is stretched */
  layout?: { h: string; v: string };
  /** always covers the whole component, whatever its size */
  cover?: boolean;
  /** the component this part belongs to, and its settings */
  component?: string;
  values?: Record<string, any>;
  /** a shape of a diagram a symbol stands in for; `label` is its text as last drawn */
  anchor?: boolean;
  label?: string;
  group: string;
};

export const getSymbolMeta = (el: {
  customData?: ExcalidrawElement["customData"];
}): SymbolMeta | null => {
  const m = el.customData?.symbol;
  return m && typeof m.group === "string" ? (m as SymbolMeta) : null;
};

export const shapesOf = (
  id: string,
  theme: SymbolTheme,
  values?: Values,
): Shape[] => {
  const def = COMPONENTS.find((c) => c.id === id);
  return def ? def.shapes(theme, { ...defaultsOf(def), ...values }) : [];
};

const NONE = "transparent";

const handlesOf = (
  a: ReturnType<typeof parsePath>[number]["anchors"][number],
): PathPointHandles =>
  a.in || a.out
    ? {
        mode: "broken",
        in: a.in ? pointFrom<LocalPoint>(a.in[0], a.in[1]) : null,
        out: a.out ? pointFrom<LocalPoint>(a.out[0], a.out[1]) : null,
      }
    : { mode: "corner", in: null, out: null };

/** one path element from sub-path data, scaled and placed */
const pathElement = (
  sub: ReturnType<typeof parsePath>[number],
  k: number,
  ox: number,
  oy: number,
  common: Record<string, any>,
) => {
  const points = sub.anchors.map((a) =>
    pointFrom<LocalPoint>(a.x * k, a.y * k),
  );
  const handles = sub.anchors.map((a) =>
    handlesOf({
      ...a,
      in: a.in && [a.in[0] * k, a.in[1] * k],
      out: a.out && [a.out[0] * k, a.out[1] * k],
    }),
  );
  const base = newPathElement({
    ...common,
    x: ox,
    y: oy,
    points,
    handles,
    closed: sub.closed,
  });
  return { ...base, ...getPathUpdate(base, { points, handles }) };
};

/** a rectangle, as a path when its radius is more than a rectangle element can draw */
const rectElements = (
  s: Extract<Shape, { t: "rect" }>,
  theme: SymbolTheme,
  common: Record<string, any>,
): ExcalidrawElement[] => {
  const r = resolveRadius(s.r, s.h, s.w, theme);
  if (r <= 0 || Math.min(s.w, s.h) >= 4 * r) {
    return [
      newElement({
        ...common,
        type: "rectangle",
        x: s.x,
        y: s.y,
        width: s.w,
        height: s.h,
        roundness: r > 0 ? { type: ROUNDNESS.ADAPTIVE_RADIUS, value: r } : null,
      }),
    ];
  }
  const points = [
    pointFrom<LocalPoint>(0, 0),
    pointFrom<LocalPoint>(s.w, 0),
    pointFrom<LocalPoint>(s.w, s.h),
    pointFrom<LocalPoint>(0, s.h),
  ];
  const handles: PathPointHandles[] = points.map(() => ({
    mode: "corner",
    in: null,
    out: null,
    radius: r,
  }));
  const path = newPathElement({
    ...common,
    x: s.x,
    y: s.y,
    points,
    handles,
    closed: true,
  });
  return [{ ...path, ...getPathUpdate(path, { points, handles }) }];
};

/**
 * Editable elements for a list of shapes, in one group: rectangles, ellipses,
 * lines, text, and icons as paths. Every element keeps its tokens.
 */
export const buildElements = (
  shapes: readonly Shape[],
  theme: SymbolTheme,
  origin = { x: 0, y: 0 },
  name?: string,
  values?: Record<string, any>,
): ExcalidrawElement[] => {
  const group = randomId();
  const color = (tk: Token | null | undefined) =>
    tk ? theme.colors[tk] : NONE;
  const out: ExcalidrawElement[] = [];
  const base = (
    meta: Omit<SymbolMeta, "group">,
    extra: Record<string, any> = {},
  ) => ({
    strokeColor: color(meta.s),
    backgroundColor: color(meta.f),
    fillStyle: "solid" as const,
    strokeWidth: extra.strokeWidth ?? 1,
    roughness: 0,
    opacity: 100,
    strokeStyle: extra.dash ? ("dashed" as const) : ("solid" as const),
    groupIds: [group],
    customData: {
      symbol: {
        ...meta,
        group,
        ...(name ? { name, component: name } : {}),
        ...(values ? { values } : {}),
      },
    },
  });
  for (const raw of shapes) {
    const s: Shape =
      raw.t === "line"
        ? {
            ...raw,
            pts: raw.pts.map(
              ([x, y]) => [x + origin.x, y + origin.y] as [number, number],
            ),
          }
        : ({
            ...raw,
            x: (raw as any).x + origin.x,
            y: (raw as any).y + origin.y,
          } as Shape);
    if (s.t === "rect") {
      const meta = { s: s.s ?? null, f: s.f ?? null, r: s.r };
      out.push(
        ...rectElements(
          s,
          theme,
          base(meta, { strokeWidth: s.sw ?? 1, dash: s.dash }),
        ),
      );
    } else if (s.t === "ellipse") {
      out.push(
        newElement({
          ...base(
            { s: s.s ?? null, f: s.f ?? null },
            { strokeWidth: s.sw ?? 1, dash: s.dash },
          ),
          type: "ellipse",
          x: s.x,
          y: s.y,
          width: s.w,
          height: s.h,
        }),
      );
    } else if (s.t === "line") {
      const [first, ...rest] = s.pts;
      const sw = s.sw ?? theme.stroke;
      out.push(
        newLinearElement({
          ...base(
            { s: s.s ?? "text", f: null },
            { strokeWidth: sw, dash: s.dash },
          ),
          type: "line",
          x: first[0],
          y: first[1],
          points: [
            pointFrom<LocalPoint>(0, 0),
            ...rest.map(([x, y]) =>
              pointFrom<LocalPoint>(x - first[0], y - first[1]),
            ),
          ],
        }),
      );
    } else if (s.t === "icon") {
      const icon = getIcon(s.name);
      if (!icon) {
        continue;
      }
      const k = s.size / 24;
      const sw = Math.max(1, theme.stroke * k);
      for (const sub of parsePath(icon.d)) {
        out.push(
          pathElement(sub, k, s.x, s.y, {
            ...base({ s: s.s ?? "text", f: null, sw: k }, { strokeWidth: sw }),
          }),
        );
      }
    } else if (s.t === "text") {
      const el = newTextElement({
        ...base({ s: s.s, f: null }),
        text: s.text,
        fontSize: s.size,
        fontFamily: FONT_FAMILY.Nunito,
        x: s.x,
        y: s.y,
        strokeWidth: 1,
      });
      const left =
        s.anchor === "middle"
          ? s.x - el.width / 2
          : s.anchor === "end"
          ? s.x - el.width
          : s.x;
      out.push({ ...el, x: left, y: s.y - el.height / 2 });
    }
  }
  return out;
};

/**
 * What changes when the theme changes: the colours of every element that
 * remembers its tokens, stroke widths, and the radius of rounded shapes.
 */
export const themeUpdates = (
  elements: readonly ExcalidrawElement[],
  theme: SymbolTheme,
): { element: ExcalidrawElement; updates: Record<string, any> }[] => {
  const result: { element: ExcalidrawElement; updates: Record<string, any> }[] =
    [];
  for (const el of elements) {
    const meta = getSymbolMeta(el);
    if (!meta || el.isDeleted) {
      continue;
    }
    const updates: Record<string, any> = {};
    if (meta.s !== undefined) {
      updates.strokeColor = meta.s ? theme.colors[meta.s] : NONE;
    }
    if (meta.f !== undefined) {
      updates.backgroundColor = meta.f ? theme.colors[meta.f] : NONE;
    }
    if (meta.sw) {
      updates.strokeWidth = Math.max(1, theme.stroke * meta.sw);
    }
    if (meta.r !== undefined && meta.r !== null) {
      const r = resolveRadius(meta.r, el.height, el.width, theme);
      if (el.type === "rectangle") {
        if (r <= 0) {
          updates.roundness = null;
        } else if (Math.min(el.width, el.height) >= 4 * r) {
          updates.roundness = { type: ROUNDNESS.ADAPTIVE_RADIUS, value: r };
        }
      } else if (el.type === "path") {
        updates.handles = el.handles.map((h) => ({ ...h, radius: r }));
      }
    }
    result.push({ element: el, updates });
  }
  return result;
};

/**
 * The group a symbol part belongs to: its innermost group on the canvas. (The
 * id stored when it was built goes stale when a symbol is duplicated or comes
 * back from the library, which gives its copies new groups.)
 */
export const symbolGroupOf = (el: {
  groupIds: readonly string[];
  customData?: ExcalidrawElement["customData"];
}): string | null => {
  const m = getSymbolMeta(el);
  return m ? el.groupIds[0] ?? m.group : null;
};

/** which text parameter of a component is its label */
export const labelKeyOf = (id: string): string | null => {
  const def = COMPONENTS.find((c) => c.id === id);
  const keys = ["label", "title", "text", "message", "value", "placeholder"];
  return (
    keys.find((k) =>
      def?.params?.some((p) => p.key === k && p.kind === "text"),
    ) ?? null
  );
};
