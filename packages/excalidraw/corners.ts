import {
  pointFrom,
  pointRotateRads,
  type GlobalPoint,
  type LocalPoint,
} from "@excalidraw/math";
import {
  allContours,
  getCornerRadius,
  getElementAbsoluteCoords,
  getPathGeometryFromShape,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  PathPointHandles,
} from "@excalidraw/element/types";

/**
 * The live corners of a shape: where each straight corner can be rounded, and
 * the grab point of its gizmo. The grab point is the centre of the circle that
 * rounds the corner (it sits on the bisector, `radius / sin(a/2)` from the
 * corner), so dragging it along the bisector is the radius.
 */
export type CornerHandle = {
  loop: number;
  index: number;
  /** the anchor, scene coordinates */
  corner: { x: number; y: number };
  /** unit vector from the corner into the shape */
  dir: { x: number; y: number };
  /** sin of half the interior angle: radius = distance * sinHalf */
  sinHalf: number;
  radius: number;
  maxRadius: number;
  /** centre of the rounding circle */
  center: { x: number; y: number };
};

export const canEditCorners = (el: ExcalidrawElement | undefined | null) =>
  !!el &&
  !el.isDeleted &&
  (el.type === "rectangle" ||
    el.type === "diamond" ||
    (el.type === "path" && el.points.length >= 3));

const live = (v: LocalPoint | null) => !!v && (v[0] !== 0 || v[1] !== 0);
const curved = (h: PathPointHandles | undefined) =>
  !!h && h.mode !== "corner" && (live(h.in) || live(h.out));
const curvedOut = (h: PathPointHandles | undefined) =>
  !!h && h.mode !== "corner" && live(h.out);
const curvedIn = (h: PathPointHandles | undefined) =>
  !!h && h.mode !== "corner" && live(h.in);

type Loop = {
  points: readonly LocalPoint[];
  handles: readonly PathPointHandles[];
  closed: boolean;
};

const loopsOf = (el: ExcalidrawElement): Loop[] => {
  if (el.type === "path") {
    return allContours(el);
  }
  if (el.type === "rectangle" || el.type === "diamond") {
    const g = getPathGeometryFromShape(el);
    const radius = getCornerRadius(Math.min(el.width, el.height), el);
    return [
      {
        points: g.points,
        handles: g.handles.map((h) => (radius ? { ...h, radius } : h)),
        closed: true,
      },
    ];
  }
  return [];
};

export const getCornerHandles = (
  el: ExcalidrawElement,
  elementsMap: Parameters<typeof getElementAbsoluteCoords>[1],
): CornerHandle[] => {
  const [, , , , cx, cy] = getElementAbsoluteCoords(el, elementsMap);
  const center = pointFrom<GlobalPoint>(cx, cy);
  const toScene = (p: LocalPoint) => {
    const r = pointRotateRads(
      pointFrom<GlobalPoint>(el.x + p[0], el.y + p[1]),
      center,
      el.angle,
    );
    return { x: r[0], y: r[1] };
  };
  const out: CornerHandle[] = [];
  loopsOf(el).forEach((loop, li) => {
    const n = loop.points.length;
    for (let i = 0; i < n; i++) {
      const hasPrev = loop.closed || i > 0;
      const hasNext = loop.closed || i < n - 1;
      const pi = (i - 1 + n) % n;
      const ni = (i + 1) % n;
      if (
        !hasPrev ||
        !hasNext ||
        n < 3 ||
        curved(loop.handles[i]) ||
        curvedOut(loop.handles[pi]) ||
        curvedIn(loop.handles[ni])
      ) {
        continue;
      }
      const c = toScene(loop.points[i]);
      const a = toScene(loop.points[pi]);
      const b = toScene(loop.points[ni]);
      const ax = a.x - c.x;
      const ay = a.y - c.y;
      const bx = b.x - c.x;
      const by = b.y - c.y;
      const la = Math.hypot(ax, ay);
      const lb = Math.hypot(bx, by);
      if (la < 1e-6 || lb < 1e-6) {
        continue;
      }
      const cos = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)));
      const alpha = Math.acos(cos);
      if (alpha < 1e-3 || Math.PI - alpha < 1e-3) {
        continue;
      }
      let dx = ax / la + bx / lb;
      let dy = ay / la + by / lb;
      const dl = Math.hypot(dx, dy) || 1;
      dx /= dl;
      dy /= dl;
      const sinHalf = Math.sin(alpha / 2);
      const maxRadius = (Math.min(la, lb) / 2) * Math.tan(alpha / 2);
      const radius = Math.min(loop.handles[i]?.radius ?? 0, maxRadius);
      const dist = radius / sinHalf;
      out.push({
        loop: li,
        index: i,
        corner: c,
        dir: { x: dx, y: dy },
        sinHalf,
        radius,
        maxRadius,
        center: { x: c.x + dx * dist, y: c.y + dy * dist },
      });
    }
  });
  return out;
};

/** the radius a pointer position asks for along a corner's bisector */
export const radiusAt = (
  h: CornerHandle,
  p: { x: number; y: number },
): number => {
  const t = (p.x - h.corner.x) * h.dir.x + (p.y - h.corner.y) * h.dir.y;
  return Math.max(0, Math.min(h.maxRadius, t * h.sinHalf));
};
