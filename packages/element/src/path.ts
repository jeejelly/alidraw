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
  PathContour,
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
  /** a shape's further outlines (see `ExcalidrawPathElement.contours`) */
  contours?: readonly PathContour[];
};

type Contoured = Pick<
  ExcalidrawPathElement,
  "points" | "handles" | "closed" | "contours"
>;

/** the main outline and every further one, each with its own closed flag */
export const allContours = (
  element: Contoured,
): {
  points: readonly LocalPoint[];
  handles: readonly PathPointHandles[];
  closed: boolean;
}[] => [
  { points: element.points, handles: element.handles, closed: element.closed },
  ...(element.contours ?? []).map((c) => ({ ...c, closed: true })),
];

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

/**
 * The handle that shapes the curve: a corner point keeps its handles (so
 * switching back restores the curve) but does not use them.
 */
const activeHandle = (
  h: PathPointHandles | undefined,
  side: "in" | "out",
): LocalPoint | null => {
  const offset = h && h.mode !== "corner" ? h[side] : null;
  return isLive(offset) ? offset : null;
};

export const getPathSegments = (
  element: Pick<ExcalidrawPathElement, "points" | "handles" | "closed">,
): PathSegment[] => {
  const { points, handles, closed } = element;
  const n = points.length;
  const count = closed ? n : n - 1;
  const segments: PathSegment[] = [];

  for (let i = 0; i < count; i++) {
    const j = (i + 1) % n;
    const out = activeHandle(handles[i], "out");
    const inn = activeHandle(handles[j], "in");
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
  element: Pick<ExcalidrawPathElement, "points" | "handles" | "closed"> &
    Partial<Pick<ExcalidrawPathElement, "contours">>,
): string => {
  const f = (n: number) => +n.toFixed(3);
  const parts: string[] = [];
  for (const contour of allContours(element as Contoured)) {
    if (contour.points.length < 2) {
      continue;
    }
    const d = [`M ${f(contour.points[0][0])} ${f(contour.points[0][1])}`];
    for (const s of getPathSegments(contour)) {
      d.push(
        s.straight
          ? `L ${f(s.p1[0])} ${f(s.p1[1])}`
          : `C ${f(s.c1[0])} ${f(s.c1[1])} ${f(s.c2[0])} ${f(s.c2[1])} ${f(
              s.p1[0],
            )} ${f(s.p1[1])}`,
      );
    }
    if (contour.closed) {
      d.push("Z");
    }
    parts.push(d.join(" "));
  }
  return parts.join(" ");
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

/** every outline as a polyline, element-local */
export const flattenPathContours = (
  element: Pick<ExcalidrawPathElement, "points" | "handles" | "closed"> &
    Partial<Pick<ExcalidrawPathElement, "contours">>,
  steps = FLATTEN_STEPS,
): LocalPoint[][] =>
  allContours(element as Contoured).map((c) => flattenPath(c, steps));

/** local bounds of the drawn curve (every outline of a shape) */
export const getPathLocalBounds = (
  element: Pick<ExcalidrawPathElement, "points" | "handles" | "closed"> &
    Partial<Pick<ExcalidrawPathElement, "contours">>,
): [number, number, number, number] => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const pts = flattenPathContours(element).flat();
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
  for (const s of allContours(element).flatMap((c) => getPathSegments(c))) {
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
  // geometry that does not mention contours leaves a shape's contours alone
  const contours = next.contours ?? element.contours;
  const [oMinX, oMinY, oMaxX, oMaxY] = getPathLocalBounds(element);
  const [minX, minY, maxX, maxY] = getPathLocalBounds({
    ...next,
    contours,
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
  const shift = (pt: LocalPoint) =>
    pointFrom<LocalPoint>(pt[0] - minX, pt[1] - minY);
  // the local frame starts at the top-left of the curve (minX/minY become
  // the new x/y), which is what the generic resize and flip code assume
  return {
    points: next.points.map(shift),
    handles: next.handles,
    ...(contours
      ? {
          contours: contours.map((c) => ({
            points: c.points.map(shift),
            handles: c.handles,
          })),
        }
      : {}),
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
    // a hard point: the handles are kept out of sight, not thrown away
    next = { ...current, mode };
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
      out: activeHandle(prevHandles, "out") ? sub(a, p0) : prevHandles.out,
    };
    const toIndex = segment.to === 0 ? 0 : segment.to + 1;
    handles[toIndex] = {
      ...nextHandles,
      in: activeHandle(nextHandles, "in") ? sub(c, p1) : nextHandles.in,
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
  const n = element.points.length;
  const prev = index > 0 ? index - 1 : element.closed ? n - 1 : null;
  const next = index < n - 1 ? index + 1 : element.closed ? 0 : null;
  const handles = [...element.handles];

  // an interior point: refit the two neighbouring handles so the curve keeps
  // its shape, the inverse of splitting it at that point
  if (prev !== null && next !== null) {
    const l1 = len(sub(element.points[index], element.points[prev]));
    const l2 = len(sub(element.points[next], element.points[index]));
    const t = l1 + l2 > 0 ? l1 / (l1 + l2) : 0.5;
    const out = handles[prev]?.out;
    const inn = handles[next]?.in;
    if (out && t > 0) {
      handles[prev] = {
        ...handles[prev],
        out: pointFrom<LocalPoint>(out[0] / t, out[1] / t),
      };
    }
    if (inn && t < 1) {
      handles[next] = {
        ...handles[next],
        in: pointFrom<LocalPoint>(inn[0] / (1 - t), inn[1] / (1 - t)),
      };
    }
  }
  return {
    points: element.points.filter((_, i) => i !== index),
    handles: handles.filter((_, i) => i !== index),
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
  element: Pick<ExcalidrawPathElement, "points" | "handles" | "closed"> &
    Partial<Pick<ExcalidrawPathElement, "contours">>,
  sx: number,
  sy: number,
): PathGeometry => {
  const scale = (c: {
    points: readonly LocalPoint[];
    handles: readonly PathPointHandles[];
  }) => ({
    points: c.points.map((p) => pointFrom<LocalPoint>(p[0] * sx, p[1] * sy)),
    handles: c.handles.map((h) => ({
      mode: h.mode,
      in: h.in ? pointFrom<LocalPoint>(h.in[0] * sx, h.in[1] * sy) : null,
      out: h.out ? pointFrom<LocalPoint>(h.out[0] * sx, h.out[1] * sy) : null,
    })),
  });
  const main = scale(element);
  const contours = element.contours?.map(scale);
  const [minX, minY] = getPathLocalBounds({
    ...main,
    contours,
    closed: element.closed,
  });
  const shift = (p: LocalPoint) =>
    pointFrom<LocalPoint>(p[0] - minX, p[1] - minY);
  return {
    points: main.points.map(shift),
    handles: main.handles,
    ...(contours
      ? {
          contours: contours.map((c) => ({
            points: c.points.map(shift),
            handles: c.handles,
          })),
        }
      : {}),
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

// -----------------------------------------------------------------------------
//                          open / close, split, join
// -----------------------------------------------------------------------------

const hasHandle = (h: LocalPoint | null | undefined): h is LocalPoint =>
  isLive(h ?? null);

const neg = (h: LocalPoint) => pointFrom<LocalPoint>(-h[0], -h[1]);

/**
 * Makes the joint where a path closes smooth: a smooth end point that has a
 * tangent on one side only gets the mirrored tangent on the other. Hard
 * (corner) points are left as they are.
 */
const smoothSeam = (handles: readonly PathPointHandles[]) => {
  const next = [...handles];
  const n = next.length;
  const fix = (i: number) => {
    const h = next[i];
    if (!h || h.mode === "corner") {
      return;
    }
    if (hasHandle(h.out) && !hasHandle(h.in)) {
      next[i] = { ...h, mode: "smooth", in: neg(h.out) };
    } else if (hasHandle(h.in) && !hasHandle(h.out)) {
      next[i] = { ...h, mode: "smooth", out: neg(h.in) };
    }
  };
  fix(0);
  fix(n - 1);
  return next;
};

/**
 * Closes or opens a path. Closing folds an end point lying on the start point
 * into it, and smooths the seam; opening just drops the closing segment.
 * @returns null when the path is too short to close
 */
export const setPathClosed = (
  element: ExcalidrawPathElement,
  closed: boolean,
): (PathGeometry & { closed: boolean }) | null => {
  if (element.closed === closed) {
    return null;
  }
  if (!closed) {
    return {
      points: element.points,
      handles: element.handles,
      closed: false,
    };
  }
  let points = [...element.points];
  let handles = [...element.handles];
  const n = points.length;
  if (n >= 3 && len(sub(points[n - 1], points[0])) < 0.5) {
    // the last point is the first one again: its incoming tangent is the
    // closing segment's
    const last = handles[n - 1];
    handles[0] = {
      ...handles[0],
      mode: last.mode === "corner" ? handles[0].mode : last.mode,
      in: last.in ?? handles[0].in,
    };
    points = points.slice(0, -1);
    handles = handles.slice(0, -1);
  }
  if (points.length < 3) {
    return null;
  }
  return { points, handles: smoothSeam(handles), closed: true };
};

/**
 * Cuts a path at a point. An open path gives two (sharing that point); a
 * closed one becomes a single open path starting and ending there.
 * @returns null when there is nothing to cut (an end point of an open path)
 */
export const splitPathAt = (
  element: ExcalidrawPathElement,
  index: number,
): PathGeometry[] | null => {
  const n = element.points.length;
  if (index < 0 || index >= n) {
    return null;
  }
  if (!element.closed) {
    if (index === 0 || index === n - 1) {
      return null;
    }
    const a = {
      points: element.points.slice(0, index + 1),
      handles: element.handles
        .slice(0, index + 1)
        .map((h, i) => (i === index ? { ...h, out: null } : h)),
    };
    const b = {
      points: element.points.slice(index),
      handles: element.handles
        .slice(index)
        .map((h, i) => (i === 0 ? { ...h, in: null } : h)),
    };
    return [a, b];
  }
  const order = [...Array(n).keys()].map((k) => (k + index) % n);
  const points = [
    ...order.map((i) => element.points[i]),
    element.points[index],
  ];
  const handles = [
    ...order.map((i) => element.handles[i]),
    element.handles[index],
  ].map((h, i, all) =>
    i === 0
      ? { ...h, in: null }
      : i === all.length - 1
      ? { ...h, out: null }
      : h,
  );
  return [{ points, handles }];
};

/** the same path walked the other way round */
export const reversePathGeometry = (g: PathGeometry): PathGeometry => ({
  points: [...g.points].reverse(),
  handles: [...g.handles]
    .reverse()
    .map((h) => ({ mode: h.mode, in: h.out, out: h.in })),
});

/**
 * Joins the end of `a` to the start of `b`. End points that coincide are
 * merged into one (keeping the tangent of each side); others are bridged by a
 * straight segment.
 */
export const joinPathGeometries = (
  a: PathGeometry,
  b: PathGeometry,
): PathGeometry => {
  const aLast = a.points.length - 1;
  if (len(sub(a.points[aLast], b.points[0])) < 0.5) {
    const ha = a.handles[aLast];
    const hb = b.handles[0];
    const merged: PathPointHandles = {
      mode: ha.mode === "corner" && hb.mode === "corner" ? "corner" : "broken",
      in: ha.in,
      out: hb.out,
    };
    return {
      points: [...a.points, ...b.points.slice(1)],
      handles: [...a.handles.slice(0, aLast), merged, ...b.handles.slice(1)],
    };
  }
  return {
    points: [...a.points, ...b.points],
    handles: [...a.handles, ...b.handles],
  };
};

/**
 * Anchors and handles of a path in scene coordinates (handles stay offsets,
 * turned by the element angle).
 */
export const getPathSceneGeometry = (
  element: ExcalidrawPathElement,
): PathGeometry => {
  const [minX, minY, maxX, maxY] = getPathLocalBounds(element);
  const center = pointFrom<GlobalPoint>(
    element.x + (minX + maxX) / 2,
    element.y + (minY + maxY) / 2,
  );
  const rot = (p: Pt) =>
    pointRotateRads(
      pointFrom<GlobalPoint>(center[0] + p[0], center[1] + p[1]),
      center,
      element.angle,
    );
  const turn = (h: LocalPoint | null) => {
    if (!h) {
      return null;
    }
    const r = rot(pointFrom<LocalPoint>(h[0], h[1]));
    return pointFrom<LocalPoint>(r[0] - center[0], r[1] - center[1]);
  };
  const toScene = (c: {
    points: readonly LocalPoint[];
    handles: readonly PathPointHandles[];
  }) => ({
    points: c.points.map((p) => {
      const r = rot(
        pointFrom<LocalPoint>(
          element.x + p[0] - center[0],
          element.y + p[1] - center[1],
        ),
      );
      return pointFrom<LocalPoint>(r[0], r[1]);
    }),
    handles: c.handles.map((h) => ({
      mode: h.mode,
      in: turn(h.in),
      out: turn(h.out),
    })),
  });
  return {
    ...toScene(element),
    ...(element.contours ? { contours: element.contours.map(toScene) } : {}),
  };
};

// -----------------------------------------------------------------------------
//                                    skew
// -----------------------------------------------------------------------------

/**
 * Shears a path around its centre, in the element's own (unrotated) frame.
 * `axis: "x"` slides points sideways in proportion to their height (tan k),
 * `"y"` slides them up/down in proportion to their x. Handles are vectors, so
 * only the linear part applies to them.
 */
export const shearPathGeometry = (
  element: Pick<
    ExcalidrawPathElement,
    "points" | "handles" | "width" | "height"
  > &
    Partial<Pick<ExcalidrawPathElement, "contours">>,
  axis: "x" | "y",
  k: number,
  /** the line (in centre-relative local coordinates) that does not move */
  pivot = 0,
): PathGeometry => {
  const cx = element.width / 2;
  const cy = element.height / 2;
  const move = (qx: number, qy: number): [number, number] =>
    axis === "x" ? [qx + k * (qy - pivot), qy] : [qx, qy + k * (qx - pivot)];
  const turn = (v: LocalPoint | null) =>
    v
      ? pointFrom<LocalPoint>(
          axis === "x" ? v[0] + k * v[1] : v[0],
          axis === "y" ? v[1] + k * v[0] : v[1],
        )
      : null;
  const shear = (c: {
    points: readonly LocalPoint[];
    handles: readonly PathPointHandles[];
  }) => ({
    points: c.points.map((p) => {
      const [x, y] = move(p[0] - cx, p[1] - cy);
      return pointFrom<LocalPoint>(x + cx, y + cy);
    }),
    handles: c.handles.map((h) => ({
      mode: h.mode,
      in: turn(h.in),
      out: turn(h.out),
    })),
  });
  return {
    ...shear(element),
    ...(element.contours ? { contours: element.contours.map(shear) } : {}),
  };
};

/**
 * One outline of a shape as a path of its own: loop 0 is the main outline,
 * loop k the (k-1)th contour. Contours are always closed.
 */
export const getPathLoopView = (
  element: ExcalidrawPathElement,
  loop: number,
): ExcalidrawPathElement => {
  const contour = loop > 0 ? element.contours?.[loop - 1] : null;
  return contour
    ? {
        ...element,
        points: contour.points,
        handles: contour.handles,
        closed: true,
      }
    : element;
};

/** the geometry of the whole shape once one of its outlines is replaced */
export const withPathLoopGeometry = (
  element: ExcalidrawPathElement,
  loop: number,
  geometry: PathGeometry,
): PathGeometry => {
  if (loop <= 0 || !element.contours?.[loop - 1]) {
    return { ...geometry, contours: element.contours };
  }
  return {
    points: element.points,
    handles: element.handles,
    contours: element.contours.map((c, i) =>
      i === loop - 1
        ? { points: geometry.points, handles: geometry.handles }
        : c,
    ),
  };
};

/** the closest segment over every outline of the shape */
export const getClosestPathLoopSegment = (
  element: ExcalidrawPathElement,
  local: Pt,
) => {
  let best: {
    loop: number;
    segmentIndex: number;
    t: number;
    distance: number;
  } | null = null;
  const count = 1 + (element.contours?.length ?? 0);
  for (let loop = 0; loop < count; loop++) {
    const hit = getClosestPathSegment(getPathLoopView(element, loop), local);
    if (hit && (!best || hit.distance < best.distance)) {
      best = { loop, ...hit };
    }
  }
  return best;
};
