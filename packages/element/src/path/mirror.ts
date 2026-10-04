import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import type { PathPointHandles } from "../types";

import type { PathGeometry } from "./shared";

/** `x`: a vertical line at local x = `at`; `y`: a horizontal line at local y = `at` */
export type MirrorLine = { axis: "x" | "y"; at: number };

const distanceToLine = (point: LocalPoint, line: MirrorLine) =>
  Math.abs((line.axis === "x" ? point[0] : point[1]) - line.at);

export const reflectPoint = (point: LocalPoint, line: MirrorLine) =>
  line.axis === "x"
    ? pointFrom<LocalPoint>(2 * line.at - point[0], point[1])
    : pointFrom<LocalPoint>(point[0], 2 * line.at - point[1]);

const reflectOffset = (offset: LocalPoint | null, line: MirrorLine) =>
  offset
    ? pointFrom<LocalPoint>(
        line.axis === "x" ? -offset[0] : offset[0],
        line.axis === "y" ? -offset[1] : offset[1],
      )
    : null;

/** a reflection runs the path the other way round, so `in` and `out` trade places */
export const reflectHandles = (
  handles: PathPointHandles,
  line: MirrorLine,
): PathPointHandles => ({
  mode: handles.mode,
  in: reflectOffset(handles.out, line),
  out: reflectOffset(handles.in, line),
});

const spanOf = (points: readonly LocalPoint[], axis: MirrorLine["axis"]) => {
  const values = points.map((point) => (axis === "x" ? point[0] : point[1]));
  return {
    min: Math.min(...values),
    size: Math.max(...values) - Math.min(...values),
  };
};

/**
 * Where the line sits as a fraction of the points' extent (0 at one edge, 1
 * at the other): it survives moving, resizing and rotating the path.
 */
export const mirrorFraction = (
  points: readonly LocalPoint[],
  line: MirrorLine,
): number => {
  const { min, size } = spanOf(points, line.axis);
  return size ? (line.at - min) / size : 0.5;
};

export const mirrorAtFraction = (
  points: readonly LocalPoint[],
  axis: MirrorLine["axis"],
  fraction: number,
): MirrorLine => {
  const { min, size } = spanOf(points, axis);
  return { axis, at: min + fraction * size };
};

/** the line through the middle of the points */
export const centerMirrorLine = (
  points: readonly LocalPoint[],
  axis: MirrorLine["axis"],
): MirrorLine => {
  const values = points.map((point) => (axis === "x" ? point[0] : point[1]));
  return { axis, at: (Math.min(...values) + Math.max(...values)) / 2 };
};

/**
 * Pairs each point with its sibling on the other side of the line (the point
 * nearest to its reflection, within a tolerance relative to the shape's
 * size). A point on the line is its own sibling.
 * @returns index -> sibling index
 */
export const findMirrorPairs = (
  points: readonly LocalPoint[],
  line: MirrorLine,
): Map<number, number> => {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const size = Math.max(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
  );
  const onLine = Math.max(1, size * 0.015);
  const reach = Math.max(2, size * 0.08);
  const pairs = new Map<number, number>();
  const candidates: { from: number; to: number; gap: number }[] = [];
  points.forEach((point, from) => {
    if (distanceToLine(point, line) <= onLine) {
      pairs.set(from, from);
      return;
    }
    const reflected = reflectPoint(point, line);
    points.forEach((other, to) => {
      const sameSide =
        (line.axis === "x" ? other[0] - line.at : other[1] - line.at) *
          (line.axis === "x" ? point[0] - line.at : point[1] - line.at) >
        0;
      const gap = Math.hypot(other[0] - reflected[0], other[1] - reflected[1]);
      if (to !== from && !sameSide && gap <= reach) {
        candidates.push({ from, to, gap });
      }
    });
  });
  for (const { from, to } of candidates.sort(
    (first, second) => first.gap - second.gap,
  )) {
    if (!pairs.has(from) && !pairs.has(to)) {
      pairs.set(from, to);
      pairs.set(to, from);
    }
  }
  return pairs;
};

/**
 * Makes the siblings of the `moved` points follow them: each sibling takes
 * the reflection of its partner. Later entries of `moved` win when both
 * partners moved. Points on the line slide along it.
 */
export const applyMirror = (
  geometry: PathGeometry,
  line: MirrorLine,
  pairs: ReadonlyMap<number, number>,
  moved: readonly number[],
): PathGeometry => {
  const points = [...geometry.points];
  const handles = [...geometry.handles];
  for (const index of moved) {
    const sibling = pairs.get(index);
    if (sibling === undefined) {
      continue;
    }
    if (sibling === index) {
      points[index] =
        line.axis === "x"
          ? pointFrom<LocalPoint>(line.at, points[index][1])
          : pointFrom<LocalPoint>(points[index][0], line.at);
      continue;
    }
    points[sibling] = reflectPoint(points[index], line);
    handles[sibling] = reflectHandles(handles[index], line);
  }
  return { points, handles };
};
