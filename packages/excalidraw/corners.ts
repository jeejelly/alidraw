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

const live = (point: LocalPoint | null) =>
  !!point && (point[0] !== 0 || point[1] !== 0);
const curved = (handles: PathPointHandles | undefined) =>
  !!handles &&
  handles.mode !== "corner" &&
  (live(handles.in) || live(handles.out));
const curvedOut = (handles: PathPointHandles | undefined) =>
  !!handles && handles.mode !== "corner" && live(handles.out);
const curvedIn = (handles: PathPointHandles | undefined) =>
  !!handles && handles.mode !== "corner" && live(handles.in);

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
    const geometry = getPathGeometryFromShape(el);
    const radius = getCornerRadius(Math.min(el.width, el.height), el);
    return [
      {
        points: geometry.points,
        handles: geometry.handles.map((handle) =>
          radius ? { ...handle, radius } : handle,
        ),
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
  const toScene = (point: LocalPoint) => {
    const rotated = pointRotateRads(
      pointFrom<GlobalPoint>(el.x + point[0], el.y + point[1]),
      center,
      el.angle,
    );
    return { x: rotated[0], y: rotated[1] };
  };
  const out: CornerHandle[] = [];
  loopsOf(el).forEach((loop, li) => {
    const count = loop.points.length;
    for (let index = 0; index < count; index++) {
      const hasPrev = loop.closed || index > 0;
      const hasNext = loop.closed || index < count - 1;
      const pi = (index - 1 + count) % count;
      const ni = (index + 1) % count;
      if (
        !hasPrev ||
        !hasNext ||
        count < 3 ||
        curved(loop.handles[index]) ||
        curvedOut(loop.handles[pi]) ||
        curvedIn(loop.handles[ni])
      ) {
        continue;
      }
      const current = toScene(loop.points[index]);
      const previous = toScene(loop.points[pi]);
      const next = toScene(loop.points[ni]);
      const ax = previous.x - current.x;
      const ay = previous.y - current.y;
      const bx = next.x - current.x;
      const by = next.y - current.y;
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
      const radius = Math.min(loop.handles[index]?.radius ?? 0, maxRadius);
      const dist = radius / sinHalf;
      out.push({
        loop: li,
        index,
        corner: current,
        dir: { x: dx, y: dy },
        sinHalf,
        radius,
        maxRadius,
        center: { x: current.x + dx * dist, y: current.y + dy * dist },
      });
    }
  });
  return out;
};

/** the radius a pointer position asks for along a corner's bisector */
export const radiusAt = (
  handle: CornerHandle,
  point: { x: number; y: number },
): number => {
  const distance =
    (point.x - handle.corner.x) * handle.dir.x +
    (point.y - handle.corner.y) * handle.dir.y;
  return Math.max(0, Math.min(handle.maxRadius, distance * handle.sinHalf));
};
