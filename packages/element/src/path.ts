import { lineSegment, pointFrom, pointRotateRads } from "@excalidraw/math";

import type {
  GlobalPoint,
  LocalPoint,
  Radians,
  Curve,
  LineSegment,
} from "@excalidraw/math";

import type {
  ExcalidrawElement,
  ExcalidrawPathElement,
  PathPointHandles,
  PathPointMode,
} from "./types";

type Pt = readonly [number, number];

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
};

/** distance of a fresh handle, as a fraction of the segment it leans on */
const DEFAULT_HANDLE_RATIO = 1 / 3;
/** cubic bezier control distance of a quarter circle */
const KAPPA = 0.5522847498;
const FLATTEN_STEPS = 24;

export const NO_HANDLES: PathPointHandles = {
  mode: "corner",
  in: null,
  out: null,
};

const add = (a: Pt, b: Pt) => pointFrom<LocalPoint>(a[0] + b[0], a[1] + b[1]);
const sub = (a: Pt, b: Pt) => pointFrom<LocalPoint>(a[0] - b[0], a[1] - b[1]);
const len = (a: Pt) => Math.hypot(a[0], a[1]);
const lerp = (a: Pt, b: Pt, t: number) =>
  pointFrom<LocalPoint>(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);

/** a handle is a zero-length tangent when it sits on its anchor */
const isLive = (h: LocalPoint | null): h is LocalPoint =>
  h != null && (h[0] !== 0 || h[1] !== 0);

export const getPathSegments = (
  element: Pick<ExcalidrawPathElement, "points" | "handles" | "closed">,
): PathSegment[] => {
  const { points, handles, closed } = element;
  const n = points.length;
  const count = closed ? n : n - 1;
  const segments: PathSegment[] = [];

  for (let i = 0; i < count; i++) {
    const j = (i + 1) % n;
    const out = handles[i]?.out ?? null;
    const inn = handles[j]?.in ?? null;
    const p0 = points[i];
    const p1 = points[j];
    segments.push({
      from: i,
      to: j,
      p0,
      c1: isLive(out) ? add(p0, out) : p0,
      c2: isLive(inn) ? add(p1, inn) : p1,
      p1,
      straight: !isLive(out) && !isLive(inn),
    });
  }
  return segments;
};

const bezierAt = (s: PathSegment, t: number): LocalPoint => {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return pointFrom<LocalPoint>(
    a * s.p0[0] + b * s.c1[0] + c * s.c2[0] + d * s.p1[0],
    a * s.p0[1] + b * s.c1[1] + c * s.c2[1] + d * s.p1[1],
  );
};

/** the path as an SVG `d` string, in element-local coordinates */
export const getPathSvgD = (
  element: Pick<ExcalidrawPathElement, "points" | "handles" | "closed">,
): string => {
  if (element.points.length < 2) {
    return "";
  }
  const f = (n: number) => +n.toFixed(3);
  const d = [`M ${f(element.points[0][0])} ${f(element.points[0][1])}`];
  for (const s of getPathSegments(element)) {
    d.push(
      s.straight
        ? `L ${f(s.p1[0])} ${f(s.p1[1])}`
        : `C ${f(s.c1[0])} ${f(s.c1[1])} ${f(s.c2[0])} ${f(s.c2[1])} ${f(
            s.p1[0],
          )} ${f(s.p1[1])}`,
    );
  }
  if (element.closed) {
    d.push("Z");
  }
  return d.join(" ");
};

/** polyline approximating the path, in element-local coordinates */
export const flattenPath = (
  element: Pick<ExcalidrawPathElement, "points" | "handles" | "closed">,
  steps = FLATTEN_STEPS,
): LocalPoint[] => {
  const out: LocalPoint[] = [];
  const segments = getPathSegments(element);
  if (!segments.length) {
    return [...element.points];
  }
  out.push(segments[0].p0);
  for (const s of segments) {
    if (s.straight) {
      out.push(s.p1);
    } else {
      for (let k = 1; k <= steps; k++) {
        out.push(bezierAt(s, k / steps));
      }
    }
  }
  return out;
};

/** local bounds of the drawn curve (anchors and the curve between them) */
export const getPathLocalBounds = (
  element: Pick<ExcalidrawPathElement, "points" | "handles" | "closed">,
): [number, number, number, number] => {
  const pts = flattenPath(element);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts.length ? pts : [[0, 0]]) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return [minX, minY, maxX, maxY];
};

/**
 * the path as straight sides and curves in scene coordinates, rotated by
 * the element angle around `center`
 */
export const deconstructPath = (
  element: ExcalidrawPathElement,
  center: GlobalPoint,
): [LineSegment<GlobalPoint>[], Curve<GlobalPoint>[]] => {
  const toGlobal = (p: LocalPoint) =>
    pointRotateRads(
      pointFrom<GlobalPoint>(p[0] + element.x, p[1] + element.y),
      center,
      element.angle,
    );
  const lines: LineSegment<GlobalPoint>[] = [];
  const curves: Curve<GlobalPoint>[] = [];
  for (const s of getPathSegments(element)) {
    if (s.straight) {
      lines.push(lineSegment(toGlobal(s.p0), toGlobal(s.p1)));
    } else {
      curves.push([
        toGlobal(s.p0),
        toGlobal(s.c1),
        toGlobal(s.c2),
        toGlobal(s.p1),
      ] as Curve<GlobalPoint>);
    }
  }
  return [lines, curves];
};

// -----------------------------------------------------------------------------
//                                  editing
// -----------------------------------------------------------------------------

/**
 * The element update that follows a change of `points` / `handles`: new
 * size, and `x`/`y` shifted so that the unmoved anchors keep their place on
 * the canvas even when the element is rotated.
 */
export const getPathUpdate = (
  element: ExcalidrawPathElement,
  next: PathGeometry,
) => {
  const [oMinX, oMinY, oMaxX, oMaxY] = getPathLocalBounds(element);
  const [minX, minY, maxX, maxY] = getPathLocalBounds({
    ...next,
    closed: element.closed,
  });
  const oldCenter = pointFrom<GlobalPoint>(
    element.x + (oMinX + oMaxX) / 2,
    element.y + (oMinY + oMaxY) / 2,
  );
  const newCenter = pointFrom<GlobalPoint>(
    element.x + (minX + maxX) / 2,
    element.y + (minY + maxY) / 2,
  );
  const shifted = pointRotateRads(
    newCenter,
    oldCenter,
    element.angle as Radians,
  );
  // the local frame starts at the top-left of the curve (minX/minY become
  // the new x/y), which is what the generic resize and flip code assume
  return {
    points: next.points.map((pt) =>
      pointFrom<LocalPoint>(pt[0] - minX, pt[1] - minY),
    ),
    handles: next.handles,
    x: element.x + (shifted[0] - newCenter[0]) + minX,
    y: element.y + (shifted[1] - newCenter[1]) + minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

const withHandle = (
  h: PathPointHandles,
  side: "in" | "out",
  value: LocalPoint | null,
): PathPointHandles => ({ ...h, [side]: value });

/** the handle opposite to `offset`, same direction flipped, given length */
const opposite = (offset: Pt, length: number): LocalPoint | null => {
  const l = len(offset);
  return l === 0
    ? null
    : pointFrom<LocalPoint>(
        (-offset[0] / l) * length,
        (-offset[1] / l) * length,
      );
};

/** @returns the handle offsets after the `side` handle of a point is dragged */
export const dragPathHandle = (
  current: PathPointHandles,
  side: "in" | "out",
  offset: LocalPoint,
): PathPointHandles => {
  const other = side === "in" ? "out" : "in";
  // pulling a handle out of a corner point makes the point broken, unless
  // it is already smooth, in which case both stay collinear
  const mode: PathPointMode = current.mode === "smooth" ? "smooth" : "broken";
  let next: PathPointHandles = withHandle({ ...current, mode }, side, offset);
  if (mode === "smooth") {
    const otherHandle = current[other];
    const length = otherHandle ? len(otherHandle) : len(offset);
    next = withHandle(next, other, opposite(offset, length));
  }
  return next;
};

export const movePathPoint = (
  element: ExcalidrawPathElement,
  index: number,
  to: LocalPoint,
): PathGeometry => ({
  points: element.points.map((p, i) => (i === index ? to : p)),
  // handles are offsets, so they travel with their anchor
  handles: element.handles,
});

export const setPathHandle = (
  element: ExcalidrawPathElement,
  index: number,
  side: "in" | "out",
  offset: LocalPoint,
): PathGeometry => ({
  points: element.points,
  handles: element.handles.map((h, i) =>
    i === index ? dragPathHandle(h, side, offset) : h,
  ),
});

/** neighbours of a point, used to aim default handles */
const neighbours = (
  element: Pick<ExcalidrawPathElement, "points" | "closed">,
  index: number,
) => {
  const n = element.points.length;
  const prev =
    index > 0
      ? element.points[index - 1]
      : element.closed
      ? element.points[n - 1]
      : null;
  const next =
    index < n - 1
      ? element.points[index + 1]
      : element.closed
      ? element.points[0]
      : null;
  return { prev, next };
};

export const setPathPointMode = (
  element: ExcalidrawPathElement,
  index: number,
  mode: PathPointMode,
): PathGeometry => {
  const current = element.handles[index] ?? NO_HANDLES;
  const point = element.points[index];
  let next: PathPointHandles;

  if (mode === "corner") {
    // a corner has no tangent handle
    next = { mode, in: null, out: null };
  } else if (mode === "broken") {
    next = { ...current, mode };
  } else {
    // smooth: keep an existing tangent, else aim along the neighbours
    const { prev, next: following } = neighbours(element, index);
    let direction: LocalPoint | null = null;
    if (isLive(current.out)) {
      direction = current.out;
    } else if (isLive(current.in)) {
      direction = pointFrom<LocalPoint>(-current.in[0], -current.in[1]);
    } else if (prev && following) {
      direction = sub(following, prev);
    } else if (following) {
      direction = sub(following, point);
    } else if (prev) {
      direction = sub(point, prev);
    }
    const dl = direction ? len(direction) : 0;
    if (!direction || dl === 0) {
      next = { ...current, mode };
    } else {
      const unit = pointFrom<LocalPoint>(direction[0] / dl, direction[1] / dl);
      const lengthOut = isLive(current.out)
        ? len(current.out)
        : following
        ? len(sub(following, point)) * DEFAULT_HANDLE_RATIO
        : 0;
      const lengthIn = isLive(current.in)
        ? len(current.in)
        : prev
        ? len(sub(point, prev)) * DEFAULT_HANDLE_RATIO
        : 0;
      next = {
        mode,
        out: lengthOut
          ? pointFrom<LocalPoint>(unit[0] * lengthOut, unit[1] * lengthOut)
          : null,
        in: lengthIn
          ? pointFrom<LocalPoint>(-unit[0] * lengthIn, -unit[1] * lengthIn)
          : null,
      };
    }
  }
  return {
    points: element.points,
    handles: element.handles.map((h, i) => (i === index ? next : h)),
  };
};

/**
 * Inserts a point on segment `segmentIndex` (the one leaving point
 * `segmentIndex`) at parameter `t`. The curve is split with de Casteljau, so
 * the path keeps its exact shape.
 */
export const insertPathPoint = (
  element: ExcalidrawPathElement,
  segmentIndex: number,
  t: number,
): (PathGeometry & { index: number }) | null => {
  const segment = getPathSegments(element).find((s) => s.from === segmentIndex);
  if (!segment || t <= 0 || t >= 1) {
    return null;
  }
  const { p0, c1, c2, p1 } = segment;
  const a = lerp(p0, c1, t);
  const b = lerp(c1, c2, t);
  const c = lerp(c2, p1, t);
  const d = lerp(a, b, t);
  const e = lerp(b, c, t);
  const m = lerp(d, e, t);

  const prevHandles = element.handles[segment.from] ?? NO_HANDLES;
  const nextHandles = element.handles[segment.to] ?? NO_HANDLES;

  const newHandles: PathPointHandles = segment.straight
    ? NO_HANDLES
    : { mode: "smooth", in: sub(d, m), out: sub(e, m) };

  const insertAt = segment.from + 1;
  const points = [...element.points];
  const handles = [...element.handles];
  points.splice(insertAt, 0, m);
  handles.splice(insertAt, 0, newHandles);

  if (!segment.straight) {
    handles[segment.from] = {
      ...prevHandles,
      out: isLive(prevHandles.out) ? sub(a, p0) : null,
    };
    const toIndex = segment.to === 0 ? 0 : segment.to + 1;
    handles[toIndex] = {
      ...nextHandles,
      in: isLive(nextHandles.in) ? sub(c, p1) : null,
    };
  }
  return { points, handles, index: insertAt };
};

/** removes a point; the remaining anchors and handles do not move */
export const deletePathPoint = (
  element: ExcalidrawPathElement,
  index: number,
): PathGeometry | null => {
  const minimum = element.closed ? 3 : 2;
  if (element.points.length <= minimum) {
    return null;
  }
  return {
    points: element.points.filter((_, i) => i !== index),
    handles: element.handles.filter((_, i) => i !== index),
  };
};

/** @returns the closest segment to a local point and its parameter */
export const getClosestPathSegment = (
  element: ExcalidrawPathElement,
  local: Pt,
): { segmentIndex: number; t: number; distance: number } | null => {
  let best: { segmentIndex: number; t: number; distance: number } | null = null;
  for (const s of getPathSegments(element)) {
    const steps = s.straight ? 1 : 48;
    for (let k = 0; k < steps; k++) {
      const a = bezierAt(s, k / steps);
      const b = bezierAt(s, (k + 1) / steps);
      const abx = b[0] - a[0];
      const aby = b[1] - a[1];
      const l2 = abx * abx + aby * aby;
      const u = l2
        ? Math.max(
            0,
            Math.min(
              1,
              ((local[0] - a[0]) * abx + (local[1] - a[1]) * aby) / l2,
            ),
          )
        : 0;
      const distance = Math.hypot(
        local[0] - (a[0] + abx * u),
        local[1] - (a[1] + aby * u),
      );
      if (!best || distance < best.distance) {
        best = {
          segmentIndex: s.from,
          t: (k + u) / steps,
          distance,
        };
      }
    }
  }
  return best;
};

/**
 * Scales anchors and handles for a resize (a negative factor mirrors), then
 * puts the top-left of the curve back on the local origin.
 */
export const scalePathGeometry = (
  element: Pick<ExcalidrawPathElement, "points" | "handles" | "closed">,
  sx: number,
  sy: number,
): PathGeometry => {
  const points = element.points.map((p) =>
    pointFrom<LocalPoint>(p[0] * sx, p[1] * sy),
  );
  const handles = element.handles.map((h) => ({
    mode: h.mode,
    in: h.in ? pointFrom<LocalPoint>(h.in[0] * sx, h.in[1] * sy) : null,
    out: h.out ? pointFrom<LocalPoint>(h.out[0] * sx, h.out[1] * sy) : null,
  }));
  const [minX, minY] = getPathLocalBounds({
    points,
    handles,
    closed: element.closed,
  });
  return {
    points: points.map((p) => pointFrom<LocalPoint>(p[0] - minX, p[1] - minY)),
    handles,
  };
};

// -----------------------------------------------------------------------------
//                              shape to path
// -----------------------------------------------------------------------------

export const isConvertibleToPath = (
  element: ExcalidrawElement,
): element is ExcalidrawElement & {
  type: "rectangle" | "diamond" | "ellipse";
} =>
  element.type === "rectangle" ||
  element.type === "diamond" ||
  element.type === "ellipse";

/**
 * The points and handles of a path that draws the same outline as a
 * rectangle, diamond or ellipse (a rectangle's corner rounding is dropped).
 */
export const getPathGeometryFromShape = (element: {
  type: "rectangle" | "diamond" | "ellipse";
  width: number;
  height: number;
}): PathGeometry => {
  const { width: w, height: h } = element;
  const P = (x: number, y: number) => pointFrom<LocalPoint>(x, y);

  if (element.type === "rectangle") {
    return {
      points: [P(0, 0), P(w, 0), P(w, h), P(0, h)],
      handles: [NO_HANDLES, NO_HANDLES, NO_HANDLES, NO_HANDLES],
    };
  }
  if (element.type === "diamond") {
    return {
      points: [P(w / 2, 0), P(w, h / 2), P(w / 2, h), P(0, h / 2)],
      handles: [NO_HANDLES, NO_HANDLES, NO_HANDLES, NO_HANDLES],
    };
  }
  const kx = (w / 2) * KAPPA;
  const ky = (h / 2) * KAPPA;
  const smooth = (i: LocalPoint, o: LocalPoint): PathPointHandles => ({
    mode: "smooth",
    in: i,
    out: o,
  });
  return {
    points: [P(w / 2, 0), P(w, h / 2), P(w / 2, h), P(0, h / 2)],
    handles: [
      smooth(P(-kx, 0), P(kx, 0)),
      smooth(P(0, -ky), P(0, ky)),
      smooth(P(kx, 0), P(-kx, 0)),
      smooth(P(0, ky), P(0, -ky)),
    ],
  };
};
