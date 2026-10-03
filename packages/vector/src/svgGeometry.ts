import { pointFrom, type LocalPoint } from "@excalidraw/math";

import type { PathPointHandles } from "@excalidraw/element/types";

import { apply, applyVec, type Matrix } from "./svgTransform";

import type { SubPath } from "./svgPath";

export const area = (subPath: SubPath) => {
  let sum = 0;
  const anchors = subPath.anchors;
  for (let index = 0; index < anchors.length; index++) {
    const next = anchors[(index + 1) % anchors.length];
    sum += anchors[index].x * next.y - next.x * anchors[index].y;
  }
  return Math.abs(sum / 2);
};

/** sub-paths through a transform, as the geometry a path element stores */
export const geometry = (subs: SubPath[], matrix: Matrix) =>
  subs.map((subPath) => {
    const pts = subPath.anchors.map((anchor) =>
      apply(matrix, anchor.x, anchor.y),
    );
    const handles: PathPointHandles[] = subPath.anchors.map((anchor) =>
      anchor.in || anchor.out
        ? {
            mode: "broken",
            in: anchor.in
              ? pointFrom<LocalPoint>(
                  ...applyVec(matrix, anchor.in[0], anchor.in[1]),
                )
              : null,
            out: anchor.out
              ? pointFrom<LocalPoint>(
                  ...applyVec(matrix, anchor.out[0], anchor.out[1]),
                )
              : null,
          }
        : { mode: "corner", in: null, out: null },
    );
    return { pts, handles, closed: subPath.closed };
  });
