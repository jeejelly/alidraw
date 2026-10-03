import { pointFrom, pointRotateRads } from "@excalidraw/math";

import type { GlobalPoint, LocalPoint } from "@excalidraw/math";

import { bevelLoop } from "./bevel";
import { getPathLocalBounds } from "./geometry";
import { allContours, mapOutline } from "./shared";

import type { ExcalidrawPathElement, PathContour } from "../types";

import type { PathGeometry, PathOutlines, Pt } from "./shared";

/** a handle is a vector, so a shear only applies its linear part to it */
const shearHandle =
  (axis: "x" | "y", factor: number) => (handle: LocalPoint | null) =>
    handle
      ? pointFrom<LocalPoint>(
          axis === "x" ? handle[0] + factor * handle[1] : handle[0],
          axis === "y" ? handle[1] + factor * handle[0] : handle[1],
        )
      : null;

const withContours = (
  main: Pick<PathGeometry, "points" | "handles">,
  contours: readonly PathContour[] | undefined,
): PathGeometry => ({
  ...main,
  ...(contours ? { contours } : {}),
});

/**
 * Scales anchors and handles for a resize (a negative factor mirrors), then
 * puts the top-left of the curve back on the local origin.
 */
export const scalePathGeometry = (
  element: PathOutlines,
  scaleX: number,
  scaleY: number,
): PathGeometry => {
  const scale = (outline: PathContour) => ({
    points: outline.points.map((point) =>
      pointFrom<LocalPoint>(point[0] * scaleX, point[1] * scaleY),
    ),
    handles: outline.handles.map((handles) => ({
      ...handles,
      in: handles.in
        ? pointFrom<LocalPoint>(handles.in[0] * scaleX, handles.in[1] * scaleY)
        : null,
      out: handles.out
        ? pointFrom<LocalPoint>(
            handles.out[0] * scaleX,
            handles.out[1] * scaleY,
          )
        : null,
      ...(handles.radius
        ? {
            radius:
              handles.radius * Math.min(Math.abs(scaleX), Math.abs(scaleY)),
          }
        : {}),
    })),
  });
  const main = scale(element);
  const contours = element.contours?.map(scale);
  const [minX, minY] = getPathLocalBounds({
    ...main,
    contours,
    closed: element.closed,
  });
  const shift = (point: LocalPoint) =>
    pointFrom<LocalPoint>(point[0] - minX, point[1] - minY);
  return withContours(
    { points: main.points.map(shift), handles: main.handles },
    contours?.map((contour) => ({
      points: contour.points.map(shift),
      handles: contour.handles,
    })),
  );
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
  const rotate = (point: Pt) =>
    pointRotateRads(
      pointFrom<GlobalPoint>(center[0] + point[0], center[1] + point[1]),
      center,
      element.angle,
    );
  const turnHandle = (handle: LocalPoint | null) => {
    if (!handle) {
      return null;
    }
    const rotated = rotate(pointFrom<LocalPoint>(handle[0], handle[1]));
    return pointFrom<LocalPoint>(
      rotated[0] - center[0],
      rotated[1] - center[1],
    );
  };
  const toScene = (outline: PathContour) =>
    mapOutline(
      outline,
      (point) => {
        const rotated = rotate(
          pointFrom<LocalPoint>(
            element.x + point[0] - center[0],
            element.y + point[1] - center[1],
          ),
        );
        return pointFrom<LocalPoint>(rotated[0], rotated[1]);
      },
      turnHandle,
    );
  const [main, ...rest] = allContours(element).map(bevelLoop);
  return {
    ...toScene(main),
    ...(rest.length ? { contours: rest.map(toScene) } : {}),
  };
};

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
  factor: number,
  /** the line (in centre-relative local coordinates) that does not move */
  pivot = 0,
): PathGeometry => {
  const centerX = element.width / 2;
  const centerY = element.height / 2;
  const move = (x: number, y: number): [number, number] =>
    axis === "x"
      ? [x + factor * (y - pivot), y]
      : [x, y + factor * (x - pivot)];
  const shear = (outline: PathContour) =>
    mapOutline(
      outline,
      (point) => {
        const [x, y] = move(point[0] - centerX, point[1] - centerY);
        return pointFrom<LocalPoint>(x + centerX, y + centerY);
      },
      shearHandle(axis, factor),
    );
  return withContours(shear(element), element.contours?.map(shear));
};

/**
 * Shears a path that is already in scene coordinates (no rotation, origin
 * anywhere): `axis: "x"` slides points sideways in proportion to their
 * distance from `pivot` along y, `"y"` the other way round. Used to skew
 * several elements about one shared line.
 */
export const shearSceneGeometry = (
  geometry: PathGeometry,
  axis: "x" | "y",
  factor: number,
  pivot: number,
): PathGeometry => {
  const move = (point: LocalPoint) =>
    axis === "x"
      ? pointFrom<LocalPoint>(point[0] + factor * (point[1] - pivot), point[1])
      : pointFrom<LocalPoint>(point[0], point[1] + factor * (point[0] - pivot));
  const shear = (outline: PathContour) =>
    mapOutline(outline, move, shearHandle(axis, factor));
  return withContours(shear(geometry), geometry.contours?.map(shear));
};
