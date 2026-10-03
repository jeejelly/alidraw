import { isFiniteNumber, pointFrom, type LocalPoint } from "@excalidraw/math";

import type {
  ExcalidrawPathElement,
  PathPointHandles,
} from "@excalidraw/element/types";

const toPoint = (value: unknown): LocalPoint | null =>
  Array.isArray(value) && isFiniteNumber(value[0]) && isFiniteNumber(value[1])
    ? pointFrom<LocalPoint>(value[0], value[1])
    : null;

/** the points that are well formed, each with its handles (corner by default) */
const restoreLoop = (loop: {
  points?: unknown;
  handles?: readonly unknown[];
}) => {
  const points: LocalPoint[] = [];
  const handles: PathPointHandles[] = [];
  (Array.isArray(loop.points) ? loop.points : []).forEach((rawPoint, index) => {
    const point = toPoint(rawPoint);
    if (!point) {
      return;
    }
    const rawHandles = loop.handles?.[index] as
      | Partial<PathPointHandles>
      | undefined;
    points.push(point);
    handles.push({
      mode:
        rawHandles?.mode === "smooth" || rawHandles?.mode === "broken"
          ? rawHandles.mode
          : "corner",
      in: toPoint(rawHandles?.in),
      out: toPoint(rawHandles?.out),
      ...(isFiniteNumber(rawHandles?.radius) && rawHandles.radius > 0
        ? { radius: rawHandles.radius }
        : {}),
    });
  });
  return { points, handles };
};

/** the main outline and its holes; a hole needs at least three points */
export const restorePathGeometry = (path: ExcalidrawPathElement) => {
  const contours = (Array.isArray(path.contours) ? path.contours : [])
    .map(restoreLoop)
    .filter((contour) => contour.points.length >= 3);
  return {
    ...restoreLoop(path),
    closed: !!path.closed,
    contours: contours.length ? contours : undefined,
  };
};
