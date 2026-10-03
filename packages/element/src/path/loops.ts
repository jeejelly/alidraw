import type { LocalPoint } from "@excalidraw/math";

import { getClosestPathSegment } from "./points";

import type { ExcalidrawPathElement, PathPointHandles } from "../types";

import type { PathGeometry, Pt } from "./shared";

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
    contours: element.contours.map((contour, contourIndex) =>
      contourIndex === loop - 1
        ? { points: geometry.points, handles: geometry.handles }
        : contour,
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

/**
 * Bevels corners: sets the radius of the given anchors of an outline (every
 * anchor when `indices` is omitted); 0 takes the bevel away.
 */
export const setPathBevel = (
  loop: {
    points: readonly LocalPoint[];
    handles: readonly PathPointHandles[];
  },
  radius: number,
  indices?: readonly number[],
): PathGeometry => {
  const only = indices ? new Set(indices) : null;
  return {
    points: loop.points,
    handles: loop.handles.map((handles, index) => {
      if (only && !only.has(index)) {
        return handles;
      }
      const { radius: _drop, ...rest } = handles;
      return radius > 0 ? { ...rest, radius } : rest;
    }),
  };
};
