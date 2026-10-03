import { lineSegment, pointFrom, pointRotateRads } from "@excalidraw/math";

import type {
  Curve,
  GlobalPoint,
  LineSegment,
  LocalPoint,
} from "@excalidraw/math";

import { bevelLoop } from "./bevel";
import {
  activeHandle,
  add,
  allContours,
  bezierAt,
  isLive,
  type PathOutlines,
  type PathSegment,
} from "./shared";

import type { ExcalidrawPathElement } from "../types";

const FLATTEN_STEPS = 24;

export const getPathSegments = (
  element: Pick<ExcalidrawPathElement, "points" | "handles" | "closed">,
): PathSegment[] => {
  const { points, handles, closed } = element;
  const count = points.length;
  const segmentCount = closed ? count : count - 1;
  const segments: PathSegment[] = [];

  for (let from = 0; from < segmentCount; from++) {
    const to = (from + 1) % count;
    const outHandle = activeHandle(handles[from], "out");
    const inHandle = activeHandle(handles[to], "in");
    const p0 = points[from];
    const p1 = points[to];
    segments.push({
      from,
      to,
      p0,
      c1: isLive(outHandle) ? add(p0, outHandle) : p0,
      c2: isLive(inHandle) ? add(p1, inHandle) : p1,
      p1,
      straight: !isLive(outHandle) && !isLive(inHandle),
    });
  }
  return segments;
};

/** the path as an SVG `d` string, in element-local coordinates */
export const getPathSvgD = (element: PathOutlines): string => {
  const round = (value: number) => +value.toFixed(3);
  const commands: string[] = [];
  for (const contour of allContours(element).map(bevelLoop)) {
    if (contour.points.length < 2) {
      continue;
    }
    const [startX, startY] = contour.points[0];
    const parts = [`M ${round(startX)} ${round(startY)}`];
    for (const segment of getPathSegments(contour)) {
      const { c1, c2, p1 } = segment;
      parts.push(
        segment.straight
          ? `L ${round(p1[0])} ${round(p1[1])}`
          : `C ${round(c1[0])} ${round(c1[1])} ${round(c2[0])} ${round(
              c2[1],
            )} ${round(p1[0])} ${round(p1[1])}`,
      );
    }
    if (contour.closed) {
      parts.push("Z");
    }
    commands.push(parts.join(" "));
  }
  return commands.join(" ");
};

/** polyline approximating the path, in element-local coordinates */
export const flattenPath = (
  element: Pick<ExcalidrawPathElement, "points" | "handles" | "closed">,
  steps = FLATTEN_STEPS,
): LocalPoint[] => {
  const segments = getPathSegments(bevelLoop(element));
  if (!segments.length) {
    return [...element.points];
  }
  const polyline: LocalPoint[] = [segments[0].p0];
  for (const segment of segments) {
    if (segment.straight) {
      polyline.push(segment.p1);
      continue;
    }
    for (let step = 1; step <= steps; step++) {
      polyline.push(bezierAt(segment, step / steps));
    }
  }
  return polyline;
};

/** every outline as a polyline, element-local */
export const flattenPathContours = (
  element: PathOutlines,
  steps = FLATTEN_STEPS,
): LocalPoint[][] =>
  allContours(element).map((contour) => flattenPath(contour, steps));

/** local bounds of the drawn curve (every outline of a shape) */
export const getPathLocalBounds = (
  element: PathOutlines,
): [number, number, number, number] => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const polylinePoints = flattenPathContours(element).flat();
  for (const [x, y] of polylinePoints.length ? polylinePoints : [[0, 0]]) {
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
  const toGlobal = (point: LocalPoint) =>
    pointRotateRads(
      pointFrom<GlobalPoint>(point[0] + element.x, point[1] + element.y),
      center,
      element.angle,
    );
  const lines: LineSegment<GlobalPoint>[] = [];
  const curves: Curve<GlobalPoint>[] = [];
  const segments = allContours(element).flatMap((contour) =>
    getPathSegments(bevelLoop(contour)),
  );
  for (const segment of segments) {
    if (segment.straight) {
      lines.push(lineSegment(toGlobal(segment.p0), toGlobal(segment.p1)));
    } else {
      curves.push([
        toGlobal(segment.p0),
        toGlobal(segment.c1),
        toGlobal(segment.c2),
        toGlobal(segment.p1),
      ] as Curve<GlobalPoint>);
    }
  }
  return [lines, curves];
};
