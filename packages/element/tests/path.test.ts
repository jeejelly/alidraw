import { pointFrom, type LocalPoint } from "@excalidraw/math";

import {
  NO_HANDLES,
  deletePathPoint,
  dragPathHandle,
  flattenPath,
  getPathGeometryFromShape,
  getPathLocalBounds,
  getPathSegments,
  getPathSvgD,
  getPathUpdate,
  insertPathPoint,
  movePathPoint,
  scalePathGeometry,
  setPathHandle,
  setPathPointMode,
} from "../src/path";
import { newPathElement } from "../src/newElement";

import type { ExcalidrawPathElement } from "../src/types";

const P = (x: number, y: number) => pointFrom<LocalPoint>(x, y);

const makePath = (
  opts: Partial<Pick<ExcalidrawPathElement, "points" | "handles" | "closed">>,
) =>
  newPathElement({
    x: 100,
    y: 50,
    strokeColor: "#000",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    roundness: null,
    ...opts,
  }) as ExcalidrawPathElement;

describe("path geometry", () => {
  it("a point without handles gives straight segments", () => {
    const el = makePath({ points: [P(0, 0), P(10, 0), P(10, 10)] });
    expect(getPathSegments(el).every((s) => s.straight)).toBe(true);
    expect(getPathSvgD(el)).toBe("M 0 0 L 10 0 L 10 10");
    expect(getPathLocalBounds(el)).toEqual([0, 0, 10, 10]);
  });

  it("draws the cubic defined by the handles", () => {
    const el = makePath({
      points: [P(0, 0), P(100, 0)],
      handles: [
        { mode: "broken", in: null, out: P(0, 50) },
        { mode: "broken", in: P(0, 50), out: null },
      ],
    });
    expect(getPathSvgD(el)).toBe("M 0 0 C 0 50 100 50 100 0");
    const [, minY, , maxY] = getPathLocalBounds(el);
    expect(minY).toBe(0);
    // the curve bulges to 3/4 of the control height
    expect(maxY).toBeCloseTo(37.5, 1);
  });

  it("closed paths add the closing segment", () => {
    const el = makePath({
      points: [P(0, 0), P(10, 0), P(10, 10)],
      closed: true,
    });
    expect(getPathSegments(el)).toHaveLength(3);
    expect(getPathSvgD(el).endsWith("Z")).toBe(true);
  });

  it("a shape converts to a path with the same outline", () => {
    const rect = getPathGeometryFromShape({
      type: "rectangle",
      width: 40,
      height: 20,
    });
    expect(rect.points).toEqual([P(0, 0), P(40, 0), P(40, 20), P(0, 20)]);

    const ellipse = getPathGeometryFromShape({
      type: "ellipse",
      width: 40,
      height: 20,
    });
    const el = makePath({ ...ellipse, closed: true });
    const [minX, minY, maxX, maxY] = getPathLocalBounds(el);
    expect(minX).toBeCloseTo(0, 1);
    expect(minY).toBeCloseTo(0, 1);
    expect(maxX).toBeCloseTo(40, 1);
    expect(maxY).toBeCloseTo(20, 1);
    // every flattened point sits on the ellipse
    for (const [x, y] of flattenPath(el)) {
      const v = ((x - 20) / 20) ** 2 + ((y - 10) / 10) ** 2;
      expect(v).toBeCloseTo(1, 2);
    }
  });
});

describe("path editing", () => {
  const curved = () =>
    makePath({
      points: [P(0, 0), P(100, 0)],
      handles: [
        { mode: "broken", in: null, out: P(0, 60) },
        { mode: "broken", in: P(0, 60), out: null },
      ],
    });

  it("a smooth point keeps its handles collinear while one is dragged", () => {
    const next = dragPathHandle(
      { mode: "smooth", in: P(-10, 0), out: P(20, 0) },
      "out",
      P(0, 30),
    );
    expect(next.out).toEqual(P(0, 30));
    // `in` turns around, and keeps its own length
    expect(next.in![0]).toBeCloseTo(0);
    expect(next.in![1]).toBeCloseTo(-10);
  });

  it("dragging a handle out of a corner makes the point broken", () => {
    const next = dragPathHandle(NO_HANDLES, "out", P(5, 5));
    expect(next.mode).toBe("broken");
    expect(next.out).toEqual(P(5, 5));
    expect(next.in).toBeNull();
  });

  it("switches a point between corner, smooth and broken", () => {
    const el = makePath({ points: [P(0, 0), P(50, 0), P(100, 50)] });
    const smooth = setPathPointMode(el, 1, "smooth");
    const h = smooth.handles[1];
    expect(h.mode).toBe("smooth");
    // tangent follows the neighbours and both handles are collinear
    expect(h.in![0] * h.out![1] - h.in![1] * h.out![0]).toBeCloseTo(0);
    expect(h.in![0] * h.out![0] + h.in![1] * h.out![1]).toBeLessThan(0);

    const corner = setPathPointMode(
      { ...el, handles: smooth.handles },
      1,
      "corner",
    );
    expect(corner.handles[1]).toEqual({ mode: "corner", in: null, out: null });

    const broken = setPathPointMode(
      { ...el, handles: smooth.handles },
      1,
      "broken",
    );
    expect(broken.handles[1]).toEqual({ ...smooth.handles[1], mode: "broken" });
  });

  it("inserts a point without changing the curve", () => {
    const el = curved();
    const before = flattenPath(el, 200);
    const inserted = insertPathPoint(el, 0, 0.4)!;
    expect(inserted.points).toHaveLength(3);
    expect(inserted.index).toBe(1);
    const after = flattenPath(
      makePath({ points: inserted.points, handles: inserted.handles }),
      200,
    );
    // every point of the new curve lies on the old one
    for (const [x, y] of after) {
      const nearest = Math.min(
        ...before.map(([bx, by]) => Math.hypot(bx - x, by - y)),
      );
      expect(nearest).toBeLessThan(0.5);
    }
  });

  it("inserting on a straight segment adds a corner point", () => {
    const el = makePath({ points: [P(0, 0), P(10, 0)] });
    const inserted = insertPathPoint(el, 0, 0.5)!;
    expect(inserted.points[1]).toEqual(P(5, 0));
    expect(inserted.handles[1]).toEqual(NO_HANDLES);
  });

  it("deleting a point leaves the others where they are", () => {
    const el = makePath({ points: [P(0, 0), P(10, 0), P(20, 5), P(30, 0)] });
    const next = deletePathPoint(el, 1)!;
    expect(next.points).toEqual([P(0, 0), P(20, 5), P(30, 0)]);
    expect(next.handles).toHaveLength(3);
  });

  it("never deletes below two points (three when closed)", () => {
    expect(
      deletePathPoint(makePath({ points: [P(0, 0), P(1, 1)] }), 0),
    ).toBeNull();
    expect(
      deletePathPoint(
        makePath({ points: [P(0, 0), P(1, 1), P(2, 0)], closed: true }),
        0,
      ),
    ).toBeNull();
  });

  it("moving an anchor carries its handles along", () => {
    const el = curved();
    const next = movePathPoint(el, 0, P(10, 10));
    expect(next.points[0]).toEqual(P(10, 10));
    expect(next.handles).toEqual(el.handles);
  });

  it("normalizes the element frame after an edit", () => {
    const el = makePath({ points: [P(0, 0), P(10, 0)] });
    const update = getPathUpdate(el, movePathPoint(el, 0, P(-5, -5)));
    expect(update.points).toEqual([P(0, 0), P(15, 5)]);
    expect(update.x).toBe(95);
    expect(update.y).toBe(45);
    expect(update.width).toBe(15);
    expect(update.height).toBe(5);
  });

  it("keeps unmoved anchors in place on a rotated element", () => {
    const el = {
      ...makePath({ points: [P(0, 0), P(100, 0), P(100, 40)] }),
      angle: 0.7 as any,
    };
    const toScene = (
      e: { x: number; y: number; angle: number; points: readonly LocalPoint[] },
      i: number,
    ) => {
      const [minX, minY, maxX, maxY] = getPathLocalBounds({
        points: e.points,
        handles: e.points.map(() => NO_HANDLES),
        closed: false,
      });
      const cx = e.x + (minX + maxX) / 2;
      const cy = e.y + (minY + maxY) / 2;
      const dx = e.x + e.points[i][0] - cx;
      const dy = e.y + e.points[i][1] - cy;
      const cos = Math.cos(e.angle);
      const sin = Math.sin(e.angle);
      return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
    };
    const geometry = movePathPoint(el, 2, P(100, 200));
    const update = getPathUpdate(el, geometry);
    const next = { ...el, ...update };
    for (const i of [0, 1]) {
      const [ax, ay] = toScene(el, i);
      const [bx, by] = toScene(next, i);
      expect(bx).toBeCloseTo(ax, 6);
      expect(by).toBeCloseTo(ay, 6);
    }
  });

  it("setPathHandle updates the handle of one point only", () => {
    const el = curved();
    const next = setPathHandle(el, 1, "in", P(0, 20));
    expect(next.handles[0]).toEqual(el.handles[0]);
    expect(next.handles[1].in).toEqual(P(0, 20));
  });

  it("scaling mirrors points and handles, keeping the curve at the origin", () => {
    const el = curved();
    const next = scalePathGeometry({ ...el, closed: false }, -1, 2);
    const bounds = getPathLocalBounds({ ...next, closed: false });
    expect(bounds[0]).toBeCloseTo(0);
    expect(bounds[1]).toBeCloseTo(0);
    expect(next.handles[0].out).toEqual(P(-0, 120));
  });
});
