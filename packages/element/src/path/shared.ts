import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import type {
  ExcalidrawPathElement,
  PathContour,
  PathPointHandles,
} from "../types";

export type Pt = readonly [number, number];

export type PathSegment = {
  from: number;
  to: number;
  p0: LocalPoint;
  c1: LocalPoint;
  c2: LocalPoint;
  p1: LocalPoint;
  /** neither side carries a handle, so the segment is a straight line */
  straight: boolean;
};

export type PathGeometry = {
  points: readonly LocalPoint[];
  handles: readonly PathPointHandles[];
  /** a shape's further outlines (see `ExcalidrawPathElement.contours`) */
  contours?: readonly PathContour[];
};

export type PathLoop = PathContour & { closed: boolean };

/** the fields of a path element that describe its outlines */
export type PathOutlines = Pick<
  ExcalidrawPathElement,
  "points" | "handles" | "closed"
> &
  Partial<Pick<ExcalidrawPathElement, "contours">>;

export const NO_HANDLES: PathPointHandles = {
  mode: "corner",
  in: null,
  out: null,
};

/** the main outline and every further one, each with its own closed flag */
export const allContours = (element: PathOutlines): PathLoop[] => [
  { points: element.points, handles: element.handles, closed: element.closed },
  ...(element.contours ?? []).map((contour) => ({ ...contour, closed: true })),
];

export const add = (first: Pt, second: Pt) =>
  pointFrom<LocalPoint>(first[0] + second[0], first[1] + second[1]);

export const sub = (first: Pt, second: Pt) =>
  pointFrom<LocalPoint>(first[0] - second[0], first[1] - second[1]);

export const len = (vector: Pt) => Math.hypot(vector[0], vector[1]);

export const lerp = (from: Pt, to: Pt, ratio: number) =>
  pointFrom<LocalPoint>(
    from[0] + (to[0] - from[0]) * ratio,
    from[1] + (to[1] - from[1]) * ratio,
  );

/** a handle is a zero-length tangent when it sits on its anchor */
export const isLive = (handle: LocalPoint | null): handle is LocalPoint =>
  handle != null && (handle[0] !== 0 || handle[1] !== 0);

/**
 * The handle that shapes the curve: a corner point keeps its handles (so
 * switching back restores the curve) but does not use them.
 */
export const activeHandle = (
  handles: PathPointHandles | undefined,
  side: "in" | "out",
): LocalPoint | null => {
  const offset = handles && handles.mode !== "corner" ? handles[side] : null;
  return isLive(offset) ? offset : null;
};

export const bezierAt = (segment: PathSegment, ratio: number): LocalPoint => {
  const inverse = 1 - ratio;
  const weightStart = inverse * inverse * inverse;
  const weightFirst = 3 * inverse * inverse * ratio;
  const weightSecond = 3 * inverse * ratio * ratio;
  const weightEnd = ratio * ratio * ratio;
  return pointFrom<LocalPoint>(
    weightStart * segment.p0[0] +
      weightFirst * segment.c1[0] +
      weightSecond * segment.c2[0] +
      weightEnd * segment.p1[0],
    weightStart * segment.p0[1] +
      weightFirst * segment.c1[1] +
      weightSecond * segment.c2[1] +
      weightEnd * segment.p1[1],
  );
};

/** maps the anchors and the handle offsets of an outline */
export const mapOutline = (
  outline: PathContour,
  mapPoint: (point: LocalPoint) => LocalPoint,
  mapHandle: (handle: LocalPoint | null) => LocalPoint | null,
) => ({
  points: outline.points.map(mapPoint),
  handles: outline.handles.map((handles) => ({
    ...handles,
    in: mapHandle(handles.in),
    out: mapHandle(handles.out),
  })),
});
