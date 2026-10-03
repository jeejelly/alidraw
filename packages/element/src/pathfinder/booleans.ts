import { isEmpty, loadPaper, shapesOf, toPaper } from "./paperBridge";

import type { Outline, PathfinderOp } from "./operands";

const combine = (
  op: Exclude<PathfinderOp, "divide">,
  items: paper.PathItem[],
): paper.PathItem =>
  items.slice(1).reduce((accumulated, next) => {
    switch (op) {
      case "unite":
        return accumulated.unite(next);
      case "intersect":
        return accumulated.intersect(next);
      case "subtract":
        return accumulated.subtract(next);
      case "exclude":
        return accumulated.exclude(next);
      default:
        return accumulated;
    }
  }, items[0]);

/** every region of the arrangement, as separate pieces */
const divide = (items: paper.PathItem[]): paper.PathItem[] => {
  let faces: paper.PathItem[] = [items[0]];
  for (const next of items.slice(1)) {
    const split: paper.PathItem[] = [];
    let covered: paper.PathItem | null = null;
    for (const face of faces) {
      const inside = face.intersect(next);
      const outside = face.subtract(next);
      if (!isEmpty(inside)) {
        split.push(inside);
      }
      if (!isEmpty(outside)) {
        split.push(outside);
      }
      covered = covered ? covered.unite(face) : face;
    }
    const rest = covered ? next.subtract(covered) : next;
    if (!isEmpty(rest)) {
      split.push(rest);
    }
    faces = split;
  }
  return faces;
};

/**
 * Boolean operation on closed outlines, given bottom to top. Subtract takes
 * the top shapes out of the bottom one ("Minus Front").
 * @returns the loops of the result, each closed, in scene coordinates
 */
export const runPathfinder = async (
  op: PathfinderOp,
  outlines: readonly Outline[],
): Promise<Outline[]> => {
  if (outlines.length < 2) {
    return [];
  }
  const context = await loadPaper();
  const items = outlines.map((outline) => toPaper(context, outline));
  const results = op === "divide" ? divide(items) : [combine(op, items)];
  return results.flatMap((result) => shapesOf(context, result));
};
