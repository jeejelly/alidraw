import { pointFrom, type LocalPoint } from "@excalidraw/math";

import { getCornerRadius } from "./utils";
import { getPathGeometryFromShape, getPathSceneGeometry } from "./path";

import type { PathGeometry } from "./path";
import type {
  ExcalidrawElement,
  ExcalidrawPathElement,
  PathPointHandles,
} from "./types";

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

/** an element a boolean operation can take: a closed shape without labels */
export const isPathfinderOperand = (element: ExcalidrawElement) =>
  !element.isDeleted &&
  !(element.boundElements?.length ?? 0) &&
  (element.type === "rectangle" ||
    element.type === "diamond" ||
    element.type === "ellipse" ||
    (element.type === "path" && element.closed && element.points.length >= 3));

/** the outline of an operand, in scene coordinates (rotation applied) */
export const getOutline = (element: ExcalidrawElement): Outline | null => {
  if (!isPathfinderOperand(element)) {
    return null;
  }
  if (element.type === "path") {
    return getPathSceneGeometry(element);
  }
  if (
    element.type === "rectangle" ||
    element.type === "diamond" ||
    element.type === "ellipse"
  ) {
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
          handles: base.handles.map((h) => ({ ...h, radius })),
        }
      : base;
    const asPath = {
      ...element,
      type: "path",
      ...geometry,
      closed: true,
    } as unknown as ExcalidrawPathElement;
    return getPathSceneGeometry(asPath);
  }
  return null;
};

// -----------------------------------------------------------------------------

// paper.js is large: it is loaded the first time a boolean operation runs
type Paper = typeof paper;
let paperPromise: Promise<{
  paper: Paper;
  scope: paper.PaperScope;
}> | null = null;
const loadPaper = () =>
  (paperPromise ??= import("paper/dist/paper-core").then((m: any) => {
    const paper: Paper = m.default ?? m;
    const scope = new paper.PaperScope();
    // no canvas: the booleans need only the geometry
    scope.project = new scope.Project(undefined as any);
    return { paper, scope };
  }));

type Ctx = { paper: Paper; scope: paper.PaperScope };

const loopToPaper = (
  { scope: s }: Ctx,
  loop: {
    points: readonly LocalPoint[];
    handles: readonly PathPointHandles[];
  },
): paper.Path => {
  const path = new s.Path({ insert: false });
  loop.points.forEach((p, i) => {
    const h = loop.handles[i];
    path.add(
      new s.Segment(
        new s.Point(p[0], p[1]),
        h?.in ? new s.Point(h.in[0], h.in[1]) : undefined,
        h?.out ? new s.Point(h.out[0], h.out[1]) : undefined,
      ),
    );
  });
  path.closed = true;
  return path;
};

/** a shape: one outline, or a compound path when it has more (holes) */
const toPaper = (ctx: Ctx, outline: Outline): paper.PathItem => {
  const main = loopToPaper(ctx, outline);
  if (!outline.contours?.length) {
    return main;
  }
  return new ctx.scope.CompoundPath({
    insert: false,
    children: [main, ...outline.contours.map((c) => loopToPaper(ctx, c))],
  });
};

const isEmpty = (item: paper.PathItem | null) =>
  !item ||
  (((item as paper.Path).segments?.length ?? 0) === 0 &&
    ((item as paper.CompoundPath).children?.length ?? 0) === 0);

/** the closed loops of a boolean result */
const loopsOf = (ctx: Ctx, item: paper.PathItem): paper.Path[] => {
  if (isEmpty(item)) {
    return [];
  }
  const loops =
    item instanceof ctx.paper.CompoundPath
      ? (item.children as paper.Path[])
      : [item as paper.Path];
  return loops.filter((p) => p.segments.length >= 2 && Math.abs(p.area) > 1e-6);
};

const modeOf = (
  hin: paper.Point,
  hout: paper.Point,
): PathPointHandles["mode"] => {
  const a = hin.length > 1e-9;
  const b = hout.length > 1e-9;
  if (!a && !b) {
    return "corner";
  }
  if (a && b) {
    const cross = hin.x * hout.y - hin.y * hout.x;
    const dot = hin.x * hout.x + hin.y * hout.y;
    if (Math.abs(cross) < 1e-6 * hin.length * hout.length && dot < 0) {
      return "smooth";
    }
  }
  return "broken";
};

const fromPaper = (path: paper.Path): Outline => {
  const points: LocalPoint[] = [];
  const handles: PathPointHandles[] = [];
  for (const seg of path.segments) {
    points.push(pointFrom<LocalPoint>(seg.point.x, seg.point.y));
    const hin = seg.handleIn;
    const hout = seg.handleOut;
    handles.push({
      mode: modeOf(hin, hout),
      in: hin.length > 1e-9 ? pointFrom<LocalPoint>(hin.x, hin.y) : null,
      out: hout.length > 1e-9 ? pointFrom<LocalPoint>(hout.x, hout.y) : null,
    });
  }
  return { points, handles };
};

/**
 * The shapes of a boolean result: each outer outline with the outlines
 * inside it (holes) as its contours. Outlines nest: inside a hole there can be
 * an island, which is a shape of its own.
 */
const shapesOf = (ctx: Ctx, item: paper.PathItem): Outline[] => {
  const loops = loopsOf(ctx, item).sort(
    (a, b) => Math.abs(b.area) - Math.abs(a.area),
  );
  const parent = loops.map((loop, i) => {
    let best = -1;
    for (let k = 0; k < i; k++) {
      if (loops[k].contains(loop.interiorPoint)) {
        best = k; // the later container in this order is the smaller one
      }
    }
    return best;
  });
  const depth = (i: number): number =>
    parent[i] < 0 ? 0 : 1 + depth(parent[i]);
  const shapes = new Map<number, Outline>();
  loops.forEach((loop, i) => {
    if (depth(i) % 2 === 0) {
      shapes.set(i, fromPaper(loop));
    }
  });
  loops.forEach((loop, i) => {
    if (depth(i) % 2 === 1) {
      const outer = shapes.get(parent[i]);
      if (outer) {
        shapes.set(parent[i], {
          ...outer,
          contours: [...(outer.contours ?? []), fromPaper(loop)],
        });
      }
    }
  });
  return [...shapes.values()];
};

const combine = (
  op: Exclude<PathfinderOp, "divide">,
  items: paper.PathItem[],
): paper.PathItem =>
  items.slice(1).reduce((acc, next) => {
    switch (op) {
      case "unite":
        return acc.unite(next);
      case "intersect":
        return acc.intersect(next);
      case "subtract":
        return acc.subtract(next);
      case "exclude":
        return acc.exclude(next);
      default:
        return acc;
    }
  }, items[0]);

/** every region of the arrangement, as separate pieces */
const divide = (items: paper.PathItem[]): paper.PathItem[] => {
  let faces: paper.PathItem[] = [items[0]];
  for (const next of items.slice(1)) {
    const out: paper.PathItem[] = [];
    let covered: paper.PathItem | null = null;
    for (const face of faces) {
      const inside = face.intersect(next);
      const outside = face.subtract(next);
      if (!isEmpty(inside)) {
        out.push(inside);
      }
      if (!isEmpty(outside)) {
        out.push(outside);
      }
      covered = covered ? covered.unite(face) : face;
    }
    const rest = covered ? next.subtract(covered) : next;
    if (!isEmpty(rest)) {
      out.push(rest);
    }
    faces = out;
  }
  return faces;
};

/**
 * Boolean operation on closed outlines, given bottom to top. Subtract takes
 * the top shapes out of the bottom one (Illustrator's "Minus Front").
 * @returns the loops of the result, each closed, in scene coordinates
 */
export const runPathfinder = async (
  op: PathfinderOp,
  outlines: readonly Outline[],
): Promise<Outline[]> => {
  if (outlines.length < 2) {
    return [];
  }
  const ctx = await loadPaper();
  const items = outlines.map((o) => toPaper(ctx, o));
  const result = op === "divide" ? divide(items) : [combine(op, items)];
  return result.flatMap((r) => shapesOf(ctx, r));
};

/** 1 for counter-clockwise loops, -1 for clockwise (holes wind opposite) */
export const outlineArea = (outline: Outline) => {
  let area = 0;
  const { points } = outline;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
};

// -----------------------------------------------------------------------------
//                                   knife
// -----------------------------------------------------------------------------

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
  const ctx = await loadPaper();
  const { scope: s } = ctx;
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) {
    return outlines.map(() => null);
  }
  const ux = dx / length;
  const uy = dy / length;
  const nx = -uy;
  const ny = ux;

  return outlines.map((outline) => {
    const path = toPaper(ctx, outline);
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
    const a = new s.Point(p0[0] - ux * reach, p0[1] - uy * reach);
    const b = new s.Point(p0[0] + ux * reach, p0[1] + uy * reach);
    const line = new s.Path.Line({ from: a, to: b, insert: false });
    const hits = path.getIntersections(line);
    if (hits.length < 2) {
      return null;
    }
    // the segment must cover every crossing
    const eps = 1e-6 * (1 + length);
    for (const hit of hits) {
      const t = (hit.point.x - p0[0]) * ux + (hit.point.y - p0[1]) * uy;
      if (t < -eps || t > length + eps) {
        return null;
      }
    }
    const half = (side: 1 | -1) => {
      const poly = new s.Path({ insert: false, closed: true });
      poly.add(a, b);
      poly.add(
        new s.Point(b.x + nx * reach * side, b.y + ny * reach * side),
        new s.Point(a.x + nx * reach * side, a.y + ny * reach * side),
      );
      return poly;
    };
    const left = path.intersect(half(1));
    const right = path.intersect(half(-1));
    const pieces = [...shapesOf(ctx, left), ...shapesOf(ctx, right)];
    return pieces.length >= 2 ? pieces : null;
  });
};
