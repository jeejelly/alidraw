import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import { NO_HANDLES } from "./shared";

import type {
  ExcalidrawElement,
  ExcalidrawLineElement,
  PathPointHandles,
} from "../types";

import type { PathGeometry } from "./shared";

/** cubic bezier control distance of a quarter circle */
const KAPPA = 0.5522847498;

export const isConvertibleToPath = (
  element: ExcalidrawElement,
): element is ExcalidrawElement & {
  type: "rectangle" | "diamond" | "ellipse";
} =>
  element.type === "rectangle" ||
  element.type === "diamond" ||
  element.type === "ellipse";

/** a straight line (polyline or polygon) can become a path as it is */
export const isLineConvertibleToPath = (
  element: ExcalidrawElement,
): element is ExcalidrawLineElement =>
  element.type === "line" && element.points.length >= 2;

/**
 * The points and handles of a path that draws the same outline as a
 * rectangle, diamond or ellipse (a rectangle's corner rounding is dropped).
 */
export const getPathGeometryFromShape = (element: {
  type: "rectangle" | "diamond" | "ellipse";
  width: number;
  height: number;
}): PathGeometry => {
  const { width, height } = element;
  const local = (x: number, y: number) => pointFrom<LocalPoint>(x, y);
  const edgeMiddles = [
    local(width / 2, 0),
    local(width, height / 2),
    local(width / 2, height),
    local(0, height / 2),
  ];

  if (element.type === "rectangle") {
    return {
      points: [
        local(0, 0),
        local(width, 0),
        local(width, height),
        local(0, height),
      ],
      handles: [NO_HANDLES, NO_HANDLES, NO_HANDLES, NO_HANDLES],
    };
  }
  if (element.type === "diamond") {
    return {
      points: edgeMiddles,
      handles: [NO_HANDLES, NO_HANDLES, NO_HANDLES, NO_HANDLES],
    };
  }
  const offsetX = (width / 2) * KAPPA;
  const offsetY = (height / 2) * KAPPA;
  const smooth = (
    inHandle: LocalPoint,
    outHandle: LocalPoint,
  ): PathPointHandles => ({
    mode: "smooth",
    in: inHandle,
    out: outHandle,
  });
  return {
    points: edgeMiddles,
    handles: [
      smooth(local(-offsetX, 0), local(offsetX, 0)),
      smooth(local(0, -offsetY), local(0, offsetY)),
      smooth(local(offsetX, 0), local(-offsetX, 0)),
      smooth(local(0, offsetY), local(0, -offsetY)),
    ],
  };
};
