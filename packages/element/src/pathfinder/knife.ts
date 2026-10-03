import { loadPaper, shapesOf, toPaper } from "./paperBridge";

import type { Outline } from "./operands";

/** below this length (scene px) a cut line has no direction */
const MIN_CUT_LENGTH = 1e-6;

/**
 * Cuts closed outlines along the segment p0 -> p1. An outline is cut only when
 * the segment really goes through it: every crossing of the line with the
 * outline lies on the drawn segment, and there are at least two. Pieces keep
 * their curves.
 * @returns one entry per outline: its pieces, or null when it was not cut
 */
export const cutOutlines = async (
  outlines: readonly Outline[],
  p0: [number, number],
  p1: [number, number],
): Promise<(Outline[] | null)[]> => {
  const context = await loadPaper();
  const { scope } = context;
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const length = Math.hypot(dx, dy);
  if (length < MIN_CUT_LENGTH) {
    return outlines.map(() => null);
  }
  const ux = dx / length;
  const uy = dy / length;
  const nx = -uy;
  const ny = ux;

  return outlines.map((outline) => {
    const path = toPaper(context, outline);
    // size the cutting planes to the outline and the line
    const reach =
      Math.max(
        Math.abs(path.bounds.width),
        Math.abs(path.bounds.height),
        length,
        Math.hypot(path.bounds.center.x - p0[0], path.bounds.center.y - p0[1]),
      ) *
        4 +
      1000;
    const lineStart = new scope.Point(p0[0] - ux * reach, p0[1] - uy * reach);
    const lineEnd = new scope.Point(p0[0] + ux * reach, p0[1] + uy * reach);
    const line = new scope.Path.Line({
      from: lineStart,
      to: lineEnd,
      insert: false,
    });
    const hits = path.getIntersections(line);
    if (hits.length < 2) {
      return null;
    }
    // the segment must cover every crossing
    const tolerance = 1e-6 * (1 + length);
    for (const hit of hits) {
      const along = (hit.point.x - p0[0]) * ux + (hit.point.y - p0[1]) * uy;
      if (along < -tolerance || along > length + tolerance) {
        return null;
      }
    }
    // a half plane on one side of the line
    const halfPlane = (side: 1 | -1) => {
      const polygon = new scope.Path({ insert: false, closed: true });
      polygon.add(lineStart, lineEnd);
      polygon.add(
        new scope.Point(
          lineEnd.x + nx * reach * side,
          lineEnd.y + ny * reach * side,
        ),
        new scope.Point(
          lineStart.x + nx * reach * side,
          lineStart.y + ny * reach * side,
        ),
      );
      return polygon;
    };
    const left = path.intersect(halfPlane(1));
    const right = path.intersect(halfPlane(-1));
    const pieces = [...shapesOf(context, left), ...shapesOf(context, right)];
    return pieces.length >= 2 ? pieces : null;
  });
};
