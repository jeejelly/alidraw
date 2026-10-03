import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import { activeHandle, add, len, sub } from "./shared";

import type { PathPointHandles } from "../types";

import type { PathLoop } from "./shared";

/** a corner cut into an arc: the two new anchors and the cubic handle factor */
type Bevel = { start: LocalPoint; end: LocalPoint; handleFactor: number };

const EPSILON_LENGTH = 1e-6;
const EPSILON_ANGLE = 1e-3;

/** @returns null when the corner is a straight run, so there is nothing to round */
const computeBevel = (
  corner: LocalPoint,
  previous: LocalPoint,
  next: LocalPoint,
  radius: number,
): Bevel | null => {
  const toPrevious = sub(previous, corner);
  const toNext = sub(next, corner);
  const previousLength = len(toPrevious);
  const nextLength = len(toNext);
  if (previousLength <= EPSILON_LENGTH || nextLength <= EPSILON_LENGTH) {
    return null;
  }
  const cosine = Math.max(
    -1,
    Math.min(
      1,
      (toPrevious[0] * toNext[0] + toPrevious[1] * toNext[1]) /
        (previousLength * nextLength),
    ),
  );
  const alpha = Math.acos(cosine);
  const sweep = Math.PI - alpha;
  if (sweep <= EPSILON_ANGLE || alpha <= EPSILON_ANGLE) {
    return null;
  }
  const cut = Math.min(
    radius / Math.tan(alpha / 2),
    Math.min(previousLength, nextLength) / 2,
  );
  return {
    start: add(corner, [
      (toPrevious[0] / previousLength) * cut,
      (toPrevious[1] / previousLength) * cut,
    ]),
    end: add(corner, [
      (toNext[0] / nextLength) * cut,
      (toNext[1] / nextLength) * cut,
    ]),
    handleFactor: ((4 / 3) * Math.tan(sweep / 4)) / Math.tan(sweep / 2),
  };
};

/**
 * The outline that is drawn: every straight corner with a `radius` is cut
 * into an arc (two points and a cubic between them). Anchors keep their place
 * in the editable geometry; only what is rendered, hit and combined is
 * rounded. The radius is limited so neighbouring bevels cannot overlap.
 */
export const bevelLoop = (loop: PathLoop): PathLoop => {
  const { points, handles, closed } = loop;
  if (!handles.some((anchorHandles) => (anchorHandles?.radius ?? 0) > 0)) {
    return loop;
  }
  const count = points.length;
  const outPoints: LocalPoint[] = [];
  const outHandles: PathPointHandles[] = [];
  const straightAt = (index: number, side: "in" | "out") =>
    !activeHandle(handles[index], side);

  for (let index = 0; index < count; index++) {
    const radius = handles[index]?.radius ?? 0;
    const hasPrevious = closed || index > 0;
    const hasNext = closed || index < count - 1;
    const previousIndex = (index - 1 + count) % count;
    const nextIndex = (index + 1) % count;
    const point = points[index];
    const isBevelable =
      radius > 0 &&
      hasPrevious &&
      hasNext &&
      count >= 3 &&
      straightAt(index, "in") &&
      straightAt(index, "out") &&
      straightAt(previousIndex, "out") &&
      straightAt(nextIndex, "in");
    const bevel = isBevelable
      ? computeBevel(point, points[previousIndex], points[nextIndex], radius)
      : null;

    if (!bevel) {
      outPoints.push(point);
      outHandles.push(handles[index]);
      continue;
    }
    outPoints.push(bevel.start, bevel.end);
    outHandles.push(
      {
        mode: "broken",
        in: null,
        out: pointFrom<LocalPoint>(
          (point[0] - bevel.start[0]) * bevel.handleFactor,
          (point[1] - bevel.start[1]) * bevel.handleFactor,
        ),
      },
      {
        mode: "broken",
        in: pointFrom<LocalPoint>(
          (point[0] - bevel.end[0]) * bevel.handleFactor,
          (point[1] - bevel.end[1]) * bevel.handleFactor,
        ),
        out: null,
      },
    );
  }
  return { points: outPoints, handles: outHandles, closed };
};
