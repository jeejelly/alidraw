import { pointFrom, type LocalPoint } from "@excalidraw/math";

import type { PathContour, PathPointHandles } from "../types";
import type { Outline } from "./operands";

type Paper = typeof paper;

export type PaperContext = { paper: Paper; scope: paper.PaperScope };

/** below this a handle vector counts as absent */
const HANDLE_EPSILON = 1e-9;
/** loops with a smaller area are degenerate */
const AREA_EPSILON = 1e-6;
/** relative size of the cross product below which two handles are parallel */
const PARALLEL_EPSILON = 1e-6;

let paperPromise: Promise<PaperContext> | null = null;

// the boolean engine is large: it is loaded the first time a boolean operation runs
export const loadPaper = () =>
  (paperPromise ??= import("paper/dist/paper-core").then((paperModule: any) => {
    const paperLib: Paper = paperModule.default ?? paperModule;
    const scope = new paperLib.PaperScope();
    // no canvas: the booleans need only the geometry
    scope.project = new scope.Project(undefined as any);
    return { paper: paperLib, scope };
  }));

const contourToPaper = ({ scope }: PaperContext, contour: PathContour) => {
  const path = new scope.Path({ insert: false });
  contour.points.forEach((point, index) => {
    const handles = contour.handles[index];
    path.add(
      new scope.Segment(
        new scope.Point(point[0], point[1]),
        handles?.in ? new scope.Point(handles.in[0], handles.in[1]) : undefined,
        handles?.out
          ? new scope.Point(handles.out[0], handles.out[1])
          : undefined,
      ),
    );
  });
  path.closed = true;
  return path;
};

/** a shape: one outline, or a compound path when it has more (holes) */
export const toPaper = (
  context: PaperContext,
  outline: Outline,
): paper.PathItem => {
  const main = contourToPaper(context, outline);
  if (!outline.contours?.length) {
    return main;
  }
  return new context.scope.CompoundPath({
    insert: false,
    children: [
      main,
      ...outline.contours.map((contour) => contourToPaper(context, contour)),
    ],
  });
};

export const isEmpty = (item: paper.PathItem | null) =>
  !item ||
  (((item as paper.Path).segments?.length ?? 0) === 0 &&
    ((item as paper.CompoundPath).children?.length ?? 0) === 0);

/** the closed loops of a boolean result */
const loopsOf = (context: PaperContext, item: paper.PathItem): paper.Path[] => {
  if (isEmpty(item)) {
    return [];
  }
  const loops =
    item instanceof context.paper.CompoundPath
      ? (item.children as paper.Path[])
      : [item as paper.Path];
  return loops.filter(
    (loop) => loop.segments.length >= 2 && Math.abs(loop.area) > AREA_EPSILON,
  );
};

const modeOf = (
  handleIn: paper.Point,
  handleOut: paper.Point,
): PathPointHandles["mode"] => {
  const hasIn = handleIn.length > HANDLE_EPSILON;
  const hasOut = handleOut.length > HANDLE_EPSILON;
  if (!hasIn && !hasOut) {
    return "corner";
  }
  if (hasIn && hasOut) {
    const cross = handleIn.x * handleOut.y - handleIn.y * handleOut.x;
    const dot = handleIn.x * handleOut.x + handleIn.y * handleOut.y;
    if (
      Math.abs(cross) < PARALLEL_EPSILON * handleIn.length * handleOut.length &&
      dot < 0
    ) {
      return "smooth";
    }
  }
  return "broken";
};

const fromPaper = (path: paper.Path): Outline => {
  const points: LocalPoint[] = [];
  const handles: PathPointHandles[] = [];
  for (const segment of path.segments) {
    points.push(pointFrom<LocalPoint>(segment.point.x, segment.point.y));
    const handleIn = segment.handleIn;
    const handleOut = segment.handleOut;
    handles.push({
      mode: modeOf(handleIn, handleOut),
      in:
        handleIn.length > HANDLE_EPSILON
          ? pointFrom<LocalPoint>(handleIn.x, handleIn.y)
          : null,
      out:
        handleOut.length > HANDLE_EPSILON
          ? pointFrom<LocalPoint>(handleOut.x, handleOut.y)
          : null,
    });
  }
  return { points, handles };
};

/**
 * The shapes of a boolean result: each outer outline with the outlines
 * inside it (holes) as its contours. Outlines nest: inside a hole there can be
 * an island, which is a shape of its own.
 */
export const shapesOf = (
  context: PaperContext,
  item: paper.PathItem,
): Outline[] => {
  const loops = loopsOf(context, item).sort(
    (first, second) => Math.abs(second.area) - Math.abs(first.area),
  );
  const parent = loops.map((loop, index) => {
    let best = -1;
    for (let candidate = 0; candidate < index; candidate++) {
      if (loops[candidate].contains(loop.interiorPoint)) {
        best = candidate; // the later container in this order is the smaller one
      }
    }
    return best;
  });
  const depth = (index: number): number =>
    parent[index] < 0 ? 0 : 1 + depth(parent[index]);
  const shapes = new Map<number, Outline>();
  loops.forEach((loop, index) => {
    if (depth(index) % 2 === 0) {
      shapes.set(index, fromPaper(loop));
    }
  });
  loops.forEach((loop, index) => {
    if (depth(index) % 2 === 1) {
      const outer = shapes.get(parent[index]);
      if (outer) {
        shapes.set(parent[index], {
          ...outer,
          contours: [...(outer.contours ?? []), fromPaper(loop)],
        });
      }
    }
  });
  return [...shapes.values()];
};
