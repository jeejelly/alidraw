import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import { NO_HANDLES, isLive, len, sub } from "./shared";

import type {
  ExcalidrawPathElement,
  PathPointHandles,
  PathPointMode,
} from "../types";

import type { PathGeometry, Pt } from "./shared";

/** distance of a fresh handle, as a fraction of the segment it leans on */
const DEFAULT_HANDLE_RATIO = 1 / 3;

const withHandle = (
  handles: PathPointHandles,
  side: "in" | "out",
  value: LocalPoint | null,
): PathPointHandles => ({ ...handles, [side]: value });

/** the handle opposite to `offset`, same direction flipped, given length */
const opposite = (offset: Pt, length: number): LocalPoint | null => {
  const offsetLength = len(offset);
  return offsetLength === 0
    ? null
    : pointFrom<LocalPoint>(
        (-offset[0] / offsetLength) * length,
        (-offset[1] / offsetLength) * length,
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

const replaceHandlesAt = (
  element: ExcalidrawPathElement,
  index: number,
  replacement: PathPointHandles,
): PathGeometry => ({
  points: element.points,
  handles: element.handles.map((handles, handlesIndex) =>
    handlesIndex === index ? replacement : handles,
  ),
});

export const setPathHandle = (
  element: ExcalidrawPathElement,
  index: number,
  side: "in" | "out",
  offset: LocalPoint,
): PathGeometry => ({
  points: element.points,
  handles: element.handles.map((handles, handlesIndex) =>
    handlesIndex === index ? dragPathHandle(handles, side, offset) : handles,
  ),
});

/** neighbours of a point, used to aim default handles */
const neighbours = (
  element: Pick<ExcalidrawPathElement, "points" | "closed">,
  index: number,
) => {
  const count = element.points.length;
  const previous =
    index > 0
      ? element.points[index - 1]
      : element.closed
      ? element.points[count - 1]
      : null;
  const next =
    index < count - 1
      ? element.points[index + 1]
      : element.closed
      ? element.points[0]
      : null;
  return { previous, next };
};

/** the tangent a smooth point should follow: its own, else along the neighbours */
const smoothDirection = (
  current: PathPointHandles,
  point: LocalPoint,
  previous: LocalPoint | null,
  next: LocalPoint | null,
): LocalPoint | null => {
  if (isLive(current.out)) {
    return current.out;
  }
  if (isLive(current.in)) {
    return pointFrom<LocalPoint>(-current.in[0], -current.in[1]);
  }
  if (previous && next) {
    return sub(next, previous);
  }
  if (next) {
    return sub(next, point);
  }
  return previous ? sub(point, previous) : null;
};

const toSmooth = (
  element: ExcalidrawPathElement,
  index: number,
  current: PathPointHandles,
): PathPointHandles => {
  const point = element.points[index];
  const { previous, next } = neighbours(element, index);
  const direction = smoothDirection(current, point, previous, next);
  const directionLength = direction ? len(direction) : 0;
  if (!direction || directionLength === 0) {
    return { ...current, mode: "smooth" };
  }
  const unit = pointFrom<LocalPoint>(
    direction[0] / directionLength,
    direction[1] / directionLength,
  );
  const lengthOut = isLive(current.out)
    ? len(current.out)
    : next
    ? len(sub(next, point)) * DEFAULT_HANDLE_RATIO
    : 0;
  const lengthIn = isLive(current.in)
    ? len(current.in)
    : previous
    ? len(sub(point, previous)) * DEFAULT_HANDLE_RATIO
    : 0;
  return {
    mode: "smooth",
    out: lengthOut
      ? pointFrom<LocalPoint>(unit[0] * lengthOut, unit[1] * lengthOut)
      : null,
    in: lengthIn
      ? pointFrom<LocalPoint>(-unit[0] * lengthIn, -unit[1] * lengthIn)
      : null,
  };
};

export const setPathPointMode = (
  element: ExcalidrawPathElement,
  index: number,
  mode: PathPointMode,
): PathGeometry => {
  const current = element.handles[index] ?? NO_HANDLES;
  // corner and broken keep the handles: a corner hides them, not drops them
  const next =
    mode === "smooth"
      ? toSmooth(element, index, current)
      : { ...current, mode };
  return replaceHandlesAt(element, index, next);
};
