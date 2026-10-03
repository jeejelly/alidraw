import { pointFrom, pointRotateRads } from "@excalidraw/math";

import type { GlobalPoint, LocalPoint, Radians } from "@excalidraw/math";

import { getPathLocalBounds, getPathSegments } from "./geometry";
import { NO_HANDLES, activeHandle, bezierAt, len, lerp, sub } from "./shared";

import type { ExcalidrawPathElement, PathPointHandles } from "../types";

import type { PathGeometry, Pt } from "./shared";

const CLOSEST_SEGMENT_STEPS = 48;

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
  const [oldMinX, oldMinY, oldMaxX, oldMaxY] = getPathLocalBounds(element);
  const [minX, minY, maxX, maxY] = getPathLocalBounds({
    ...next,
    contours,
    closed: element.closed,
  });
  const oldCenter = pointFrom<GlobalPoint>(
    element.x + (oldMinX + oldMaxX) / 2,
    element.y + (oldMinY + oldMaxY) / 2,
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
  const shift = (point: LocalPoint) =>
    pointFrom<LocalPoint>(point[0] - minX, point[1] - minY);
  // the local frame starts at the top-left of the curve (minX/minY become
  // the new x/y), which is what the generic resize and flip code assume
  return {
    points: next.points.map(shift),
    handles: next.handles,
    ...(contours
      ? {
          contours: contours.map((contour) => ({
            points: contour.points.map(shift),
            handles: contour.handles,
          })),
        }
      : {}),
    x: element.x + (shifted[0] - newCenter[0]) + minX,
    y: element.y + (shifted[1] - newCenter[1]) + minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

export const movePathPoint = (
  element: ExcalidrawPathElement,
  index: number,
  to: LocalPoint,
): PathGeometry => ({
  points: element.points.map((point, pointIndex) =>
    pointIndex === index ? to : point,
  ),
  // handles are offsets, so they travel with their anchor
  handles: element.handles,
});

/**
 * Inserts a point on segment `segmentIndex` (the one leaving point
 * `segmentIndex`) at parameter `t`. The curve is split with de Casteljau, so
 * the path keeps its exact shape.
 */
export const insertPathPoint = (
  element: ExcalidrawPathElement,
  segmentIndex: number,
  ratio: number,
): (PathGeometry & { index: number }) | null => {
  const segment = getPathSegments(element).find(
    (candidate) => candidate.from === segmentIndex,
  );
  if (!segment || ratio <= 0 || ratio >= 1) {
    return null;
  }
  const { p0, c1, c2, p1 } = segment;
  const firstLeft = lerp(p0, c1, ratio);
  const middle = lerp(c1, c2, ratio);
  const lastRight = lerp(c2, p1, ratio);
  const secondLeft = lerp(firstLeft, middle, ratio);
  const secondRight = lerp(middle, lastRight, ratio);
  const splitPoint = lerp(secondLeft, secondRight, ratio);

  const prevHandles = element.handles[segment.from] ?? NO_HANDLES;
  const nextHandles = element.handles[segment.to] ?? NO_HANDLES;

  const newHandles: PathPointHandles = segment.straight
    ? NO_HANDLES
    : {
        mode: "smooth",
        in: sub(secondLeft, splitPoint),
        out: sub(secondRight, splitPoint),
      };

  const insertAt = segment.from + 1;
  const points = [...element.points];
  const handles = [...element.handles];
  points.splice(insertAt, 0, splitPoint);
  handles.splice(insertAt, 0, newHandles);

  if (!segment.straight) {
    handles[segment.from] = {
      ...prevHandles,
      out: activeHandle(prevHandles, "out")
        ? sub(firstLeft, p0)
        : prevHandles.out,
    };
    const toIndex = segment.to === 0 ? 0 : segment.to + 1;
    handles[toIndex] = {
      ...nextHandles,
      in: activeHandle(nextHandles, "in") ? sub(lastRight, p1) : nextHandles.in,
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
  const count = element.points.length;
  const previous = index > 0 ? index - 1 : element.closed ? count - 1 : null;
  const next = index < count - 1 ? index + 1 : element.closed ? 0 : null;
  const handles = [...element.handles];

  // an interior point: refit the two neighbouring handles so the curve keeps
  // its shape, the inverse of splitting it at that point
  if (previous !== null && next !== null) {
    const previousLength = len(
      sub(element.points[index], element.points[previous]),
    );
    const nextLength = len(sub(element.points[next], element.points[index]));
    const ratio =
      previousLength + nextLength > 0
        ? previousLength / (previousLength + nextLength)
        : 0.5;
    const outHandle = handles[previous]?.out;
    const inHandle = handles[next]?.in;
    if (outHandle && ratio > 0) {
      handles[previous] = {
        ...handles[previous],
        out: pointFrom<LocalPoint>(outHandle[0] / ratio, outHandle[1] / ratio),
      };
    }
    if (inHandle && ratio < 1) {
      handles[next] = {
        ...handles[next],
        in: pointFrom<LocalPoint>(
          inHandle[0] / (1 - ratio),
          inHandle[1] / (1 - ratio),
        ),
      };
    }
  }
  return {
    points: element.points.filter((_, pointIndex) => pointIndex !== index),
    handles: handles.filter((_, handlesIndex) => handlesIndex !== index),
  };
};

type ClosestSegment = { segmentIndex: number; t: number; distance: number };

/** @returns the closest segment to a local point and its parameter */
export const getClosestPathSegment = (
  element: ExcalidrawPathElement,
  local: Pt,
): ClosestSegment | null => {
  let best: ClosestSegment | null = null;
  for (const segment of getPathSegments(element)) {
    const steps = segment.straight ? 1 : CLOSEST_SEGMENT_STEPS;
    for (let step = 0; step < steps; step++) {
      const start = bezierAt(segment, step / steps);
      const end = bezierAt(segment, (step + 1) / steps);
      const chordX = end[0] - start[0];
      const chordY = end[1] - start[1];
      const chordLengthSquared = chordX * chordX + chordY * chordY;
      const along = chordLengthSquared
        ? Math.max(
            0,
            Math.min(
              1,
              ((local[0] - start[0]) * chordX +
                (local[1] - start[1]) * chordY) /
                chordLengthSquared,
            ),
          )
        : 0;
      const distance = Math.hypot(
        local[0] - (start[0] + chordX * along),
        local[1] - (start[1] + chordY * along),
      );
      if (!best || distance < best.distance) {
        best = {
          segmentIndex: segment.from,
          t: (step + along) / steps,
          distance,
        };
      }
    }
  }
  return best;
};
