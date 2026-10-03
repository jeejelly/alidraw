import { FONT_FAMILY, randomId, ROUNDNESS } from "@excalidraw/common";
import {
  getPathUpdate,
  newElement,
  newLinearElement,
  newPathElement,
  newTextElement,
} from "@excalidraw/element";
import { pointFrom, type LocalPoint } from "@excalidraw/math";

import { parsePath } from "@excalidraw/vector";

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
  const meta = el.customData?.symbol;
  return meta && typeof meta.group === "string" ? (meta as SymbolMeta) : null;
};

export const shapesOf = (
  id: string,
  theme: SymbolTheme,
  values?: Values,
): Shape[] => {
  const def = COMPONENTS.find((component) => component.id === id);
  return def ? def.shapes(theme, { ...defaultsOf(def), ...values }) : [];
};

const NONE = "transparent";

const handlesOf = (
  anchor: ReturnType<typeof parsePath>[number]["anchors"][number],
): PathPointHandles =>
  anchor.in || anchor.out
    ? {
        mode: "broken",
        in: anchor.in
          ? pointFrom<LocalPoint>(anchor.in[0], anchor.in[1])
          : null,
        out: anchor.out
          ? pointFrom<LocalPoint>(anchor.out[0], anchor.out[1])
          : null,
      }
    : { mode: "corner", in: null, out: null };

/** one path element from sub-path data, scaled and placed */
const pathElement = (
  sub: ReturnType<typeof parsePath>[number],
  index: number,
  ox: number,
  oy: number,
  common: Record<string, any>,
) => {
  const points = sub.anchors.map((anchor) =>
    pointFrom<LocalPoint>(anchor.x * index, anchor.y * index),
  );
  const handles = sub.anchors.map((anchor) =>
    handlesOf({
      ...anchor,
      in: anchor.in && [anchor.in[0] * index, anchor.in[1] * index],
      out: anchor.out && [anchor.out[0] * index, anchor.out[1] * index],
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
  shape: Extract<Shape, { t: "rect" }>,
  theme: SymbolTheme,
  common: Record<string, any>,
): ExcalidrawElement[] => {
  const radius = resolveRadius(shape.r, shape.h, shape.w, theme);
  if (radius <= 0 || Math.min(shape.w, shape.h) >= 4 * radius) {
    return [
      newElement({
        ...common,
        type: "rectangle",
        x: shape.x,
        y: shape.y,
        width: shape.w,
        height: shape.h,
        roundness:
          radius > 0
            ? { type: ROUNDNESS.ADAPTIVE_RADIUS, value: radius }
            : null,
      }),
    ];
  }
  const points = [
    pointFrom<LocalPoint>(0, 0),
    pointFrom<LocalPoint>(shape.w, 0),
    pointFrom<LocalPoint>(shape.w, shape.h),
    pointFrom<LocalPoint>(0, shape.h),
  ];
  const handles: PathPointHandles[] = points.map(() => ({
    mode: "corner",
    in: null,
    out: null,
    radius,
  }));
  const path = newPathElement({
    ...common,
    x: shape.x,
    y: shape.y,
    points,
    handles,
    closed: true,
  });
  return [{ ...path, ...getPathUpdate(path, { points, handles }) }];
};

/** Editable elements for shapes, in one group; each element keeps its tokens. */
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
    const shape: Shape =
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
    if (shape.t === "rect") {
      const meta = { s: shape.s ?? null, f: shape.f ?? null, r: shape.r };
      out.push(
        ...rectElements(
          shape,
          theme,
          base(meta, { strokeWidth: shape.sw ?? 1, dash: shape.dash }),
        ),
      );
    } else if (shape.t === "ellipse") {
      out.push(
        newElement({
          ...base(
            { s: shape.s ?? null, f: shape.f ?? null },
            { strokeWidth: shape.sw ?? 1, dash: shape.dash },
          ),
          type: "ellipse",
          x: shape.x,
          y: shape.y,
          width: shape.w,
          height: shape.h,
        }),
      );
    } else if (shape.t === "line") {
      const [first, ...rest] = shape.pts;
      const sw = shape.sw ?? theme.stroke;
      out.push(
        newLinearElement({
          ...base(
            { s: shape.s ?? "text", f: shape.f ?? null },
            { strokeWidth: sw, dash: shape.dash },
          ),
          type: "line",
          polygon: !!shape.f,
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
    } else if (shape.t === "icon") {
      const icon = getIcon(shape.name);
      if (!icon) {
        continue;
      }
      const scale = shape.size / 24;
      const sw = Math.max(1, theme.stroke * scale);
      for (const sub of parsePath(icon.d)) {
        out.push(
          pathElement(sub, scale, shape.x, shape.y, {
            ...base(
              { s: shape.s ?? "text", f: null, sw: scale },
              { strokeWidth: sw },
            ),
          }),
        );
      }
    } else if (shape.t === "text") {
      const el = newTextElement({
        ...base({ s: shape.s, f: null }),
        text: shape.text,
        fontSize: shape.size,
        fontFamily: shape.mono ? FONT_FAMILY.Cascadia : FONT_FAMILY.Nunito,
        x: shape.x,
        y: shape.y,
        strokeWidth: 1,
      });
      const left =
        shape.anchor === "middle"
          ? shape.x - el.width / 2
          : shape.anchor === "end"
          ? shape.x - el.width
          : shape.x;
      out.push({ ...el, x: left, y: shape.y - el.height / 2 });
    }
  }
  return out;
};

/** Colours, stroke widths and corner radii to update when the theme changes. */
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
      const radius = resolveRadius(meta.r, el.height, el.width, theme);
      if (el.type === "rectangle") {
        if (radius <= 0) {
          updates.roundness = null;
        } else if (Math.min(el.width, el.height) >= 4 * radius) {
          updates.roundness = {
            type: ROUNDNESS.ADAPTIVE_RADIUS,
            value: radius,
          };
        }
      } else if (el.type === "path") {
        updates.handles = el.handles.map((handle) => ({
          ...handle,
          radius,
        }));
      }
    }
    result.push({ element: el, updates });
  }
  return result;
};

/** The innermost canvas group; the id stored at build time goes stale when a symbol is copied. */
export const symbolGroupOf = (el: {
  groupIds: readonly string[];
  customData?: ExcalidrawElement["customData"];
}): string | null => {
  const meta = getSymbolMeta(el);
  return meta ? el.groupIds[0] ?? meta.group : null;
};

/** which text parameter of a component is its label */
export const labelKeyOf = (id: string): string | null => {
  const def = COMPONENTS.find((component) => component.id === id);
  const keys = ["label", "title", "text", "message", "value", "placeholder"];
  return (
    keys.find((key) =>
      def?.params?.some((param) => param.key === key && param.kind === "text"),
    ) ?? null
  );
};
