import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import { isLive, len, sub } from "./shared";

import type { ExcalidrawPathElement, PathPointHandles } from "../types";

import type { PathGeometry } from "./shared";

/** how close the two ends of a path must be to count as the same point */
const COINCIDENT_DISTANCE = 0.5;

const hasHandle = (
  handle: LocalPoint | null | undefined,
): handle is LocalPoint => isLive(handle ?? null);

const negate = (handle: LocalPoint) =>
  pointFrom<LocalPoint>(-handle[0], -handle[1]);

/**
 * Makes the joint where a path closes smooth: a smooth end point that has a
 * tangent on one side only gets the mirrored tangent on the other. Hard
 * (corner) points are left as they are.
 */
const smoothSeam = (handles: readonly PathPointHandles[]) => {
  const next = [...handles];
  const smoothen = (index: number) => {
    const current = next[index];
    if (!current || current.mode === "corner") {
      return;
    }
    if (hasHandle(current.out) && !hasHandle(current.in)) {
      next[index] = { ...current, mode: "smooth", in: negate(current.out) };
    } else if (hasHandle(current.in) && !hasHandle(current.out)) {
      next[index] = { ...current, mode: "smooth", out: negate(current.in) };
    }
  };
  smoothen(0);
  smoothen(next.length - 1);
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
  const count = points.length;
  if (
    count >= 3 &&
    len(sub(points[count - 1], points[0])) < COINCIDENT_DISTANCE
  ) {
    // the last point is the first one again: its incoming tangent is the
    // closing segment's
    const last = handles[count - 1];
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
  const count = element.points.length;
  if (index < 0 || index >= count) {
    return null;
  }
  if (!element.closed) {
    if (index === 0 || index === count - 1) {
      return null;
    }
    const before = {
      points: element.points.slice(0, index + 1),
      handles: element.handles
        .slice(0, index + 1)
        .map((handles, handlesIndex) =>
          handlesIndex === index ? { ...handles, out: null } : handles,
        ),
    };
    const after = {
      points: element.points.slice(index),
      handles: element.handles
        .slice(index)
        .map((handles, handlesIndex) =>
          handlesIndex === 0 ? { ...handles, in: null } : handles,
        ),
    };
    return [before, after];
  }
  const order = [...Array(count).keys()].map(
    (offset) => (offset + index) % count,
  );
  const points = [
    ...order.map((pointIndex) => element.points[pointIndex]),
    element.points[index],
  ];
  const handles = [
    ...order.map((pointIndex) => element.handles[pointIndex]),
    element.handles[index],
  ].map((current, position, all) =>
    position === 0
      ? { ...current, in: null }
      : position === all.length - 1
      ? { ...current, out: null }
      : current,
  );
  return [{ points, handles }];
};

/** the same path walked the other way round */
export const reversePathGeometry = (geometry: PathGeometry): PathGeometry => ({
  points: [...geometry.points].reverse(),
  handles: [...geometry.handles]
    .reverse()
    .map((handles) => ({ ...handles, in: handles.out, out: handles.in })),
});

/**
 * Joins the end of `first` to the start of `second`. End points that coincide
 * are merged into one (keeping the tangent of each side); others are bridged
 * by a straight segment.
 */
export const joinPathGeometries = (
  first: PathGeometry,
  second: PathGeometry,
): PathGeometry => {
  const firstLast = first.points.length - 1;
  if (
    len(sub(first.points[firstLast], second.points[0])) < COINCIDENT_DISTANCE
  ) {
    const firstHandles = first.handles[firstLast];
    const secondHandles = second.handles[0];
    const merged: PathPointHandles = {
      mode:
        firstHandles.mode === "corner" && secondHandles.mode === "corner"
          ? "corner"
          : "broken",
      in: firstHandles.in,
      out: secondHandles.out,
    };
    return {
      points: [...first.points, ...second.points.slice(1)],
      handles: [
        ...first.handles.slice(0, firstLast),
        merged,
        ...second.handles.slice(1),
      ],
    };
  }
  return {
    points: [...first.points, ...second.points],
    handles: [...first.handles, ...second.handles],
  };
};
