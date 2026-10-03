import { getCornerRadius } from "../utils";
import { getPathGeometryFromShape, getPathSceneGeometry } from "../path";

import type { PathGeometry } from "../path";
import type { ExcalidrawElement, ExcalidrawPathElement } from "../types";

export type PathfinderOp =
  | "unite"
  | "intersect"
  | "subtract"
  | "exclude"
  | "divide";

export const PATHFINDER_OPS: readonly PathfinderOp[] = [
  "unite",
  "intersect",
  "subtract",
  "exclude",
  "divide",
];

/** a closed outline in scene coordinates: anchors and handle vectors */
export type Outline = PathGeometry;

const isPrimitiveShape = (
  element: ExcalidrawElement,
): element is ExcalidrawElement & {
  type: "rectangle" | "diamond" | "ellipse";
} =>
  element.type === "rectangle" ||
  element.type === "diamond" ||
  element.type === "ellipse";

/** an element a boolean operation can take: a closed shape without labels */
export const isPathfinderOperand = (element: ExcalidrawElement) =>
  !element.isDeleted &&
  !(element.boundElements?.length ?? 0) &&
  (isPrimitiveShape(element) ||
    (element.type === "path" && element.closed && element.points.length >= 3));

/** the outline of an operand, in scene coordinates (rotation applied) */
export const getOutline = (element: ExcalidrawElement): Outline | null => {
  if (!isPathfinderOperand(element)) {
    return null;
  }
  if (element.type === "path") {
    return getPathSceneGeometry(element);
  }
  if (!isPrimitiveShape(element)) {
    return null;
  }
  const base = getPathGeometryFromShape(element);
  // a rounded rectangle or diamond takes its rounding along as a bevel, so
  // the pieces of a cut keep their rounded corners
  const radius =
    element.type === "ellipse"
      ? 0
      : getCornerRadius(Math.min(element.width, element.height), element);
  const geometry = radius
    ? {
        ...base,
        handles: base.handles.map((handles) => ({ ...handles, radius })),
      }
    : base;
  const asPath = {
    ...element,
    type: "path",
    ...geometry,
    closed: true,
  } as unknown as ExcalidrawPathElement;
  return getPathSceneGeometry(asPath);
};

/** signed area of an outline's anchors (shoelace): positive when they wind clockwise on screen */
export const outlineArea = (outline: Outline) => {
  let area = 0;
  const { points } = outline;
  for (let index = 0; index < points.length; index++) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[(index + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
};
