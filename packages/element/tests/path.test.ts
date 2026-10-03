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
  setPathClosed,
  splitPathAt,
  joinPathGeometries,
  reversePathGeometry,
  getPathSceneGeometry,
  setPathHandle,
  setPathPointMode,
  bevelLoop,
  setPathBevel,
} from "../src/path";
import { newPathElement } from "../src/newElement";

import type { ExcalidrawPathElement } from "../src/types";

const localPoint = (x: number, y: number) => pointFrom<LocalPoint>(x, y);

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
    const el = makePath({
      points: [localPoint(0, 0), localPoint(10, 0), localPoint(10, 10)],
    });
    expect(getPathSegments(el).every((segment) => segment.straight)).toBe(true);
    expect(getPathSvgD(el)).toBe("M 0 0 L 10 0 L 10 10");
    expect(getPathLocalBounds(el)).toEqual([0, 0, 10, 10]);
  });

  it("draws the cubic defined by the handles", () => {
    const el = makePath({
      points: [localPoint(0, 0), localPoint(100, 0)],
      handles: [
        { mode: "broken", in: null, out: localPoint(0, 50) },
        { mode: "broken", in: localPoint(0, 50), out: null },
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
      points: [localPoint(0, 0), localPoint(10, 0), localPoint(10, 10)],
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
    expect(rect.points).toEqual([
      localPoint(0, 0),
      localPoint(40, 0),
      localPoint(40, 20),
      localPoint(0, 20),
    ]);

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
      const ellipseValue = ((x - 20) / 20) ** 2 + ((y - 10) / 10) ** 2;
      expect(ellipseValue).toBeCloseTo(1, 2);
    }
  });
});

describe("path editing", () => {
  const curved = () =>
    makePath({
      points: [localPoint(0, 0), localPoint(100, 0)],
      handles: [
        { mode: "broken", in: null, out: localPoint(0, 60) },
        { mode: "broken", in: localPoint(0, 60), out: null },
      ],
    });

  it("a smooth point keeps its handles collinear while one is dragged", () => {
    const next = dragPathHandle(
      { mode: "smooth", in: localPoint(-10, 0), out: localPoint(20, 0) },
      "out",
      localPoint(0, 30),
    );
    expect(next.out).toEqual(localPoint(0, 30));
    // `in` turns around, and keeps its own length
    expect(next.in![0]).toBeCloseTo(0);
    expect(next.in![1]).toBeCloseTo(-10);
  });

  it("dragging a handle out of a corner makes the point broken", () => {
    const next = dragPathHandle(NO_HANDLES, "out", localPoint(5, 5));
    expect(next.mode).toBe("broken");
    expect(next.out).toEqual(localPoint(5, 5));
    expect(next.in).toBeNull();
  });

  it("switches a point between corner, smooth and broken", () => {
    const el = makePath({
      points: [localPoint(0, 0), localPoint(50, 0), localPoint(100, 50)],
    });
    const smooth = setPathPointMode(el, 1, "smooth");
    const pointHandles = smooth.handles[1];
    expect(pointHandles.mode).toBe("smooth");
    // tangent follows the neighbours and both handles are collinear
    expect(
      pointHandles.in![0] * pointHandles.out![1] -
        pointHandles.in![1] * pointHandles.out![0],
    ).toBeCloseTo(0);
    expect(
      pointHandles.in![0] * pointHandles.out![0] +
        pointHandles.in![1] * pointHandles.out![1],
    ).toBeLessThan(0);

    const corner = setPathPointMode(
      { ...el, handles: smooth.handles },
      1,
      "corner",
    );
    // hard, but the tangents are kept out of sight
    expect(corner.handles[1].mode).toBe("corner");
    expect(
      getPathSegments({ ...el, handles: corner.handles })[0].straight,
    ).toBe(true);
    const back = setPathPointMode(
      { ...el, handles: corner.handles },
      1,
      "smooth",
    );
    expect(back.handles[1].out).toEqual(smooth.handles[1].out);
    expect(back.handles[1].in).toEqual(smooth.handles[1].in);

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
    const el = makePath({ points: [localPoint(0, 0), localPoint(10, 0)] });
    const inserted = insertPathPoint(el, 0, 0.5)!;
    expect(inserted.points[1]).toEqual(localPoint(5, 0));
    expect(inserted.handles[1]).toEqual(NO_HANDLES);
  });

  it("deleting a point leaves the others where they are", () => {
    const el = makePath({
      points: [
        localPoint(0, 0),
        localPoint(10, 0),
        localPoint(20, 5),
        localPoint(30, 0),
      ],
    });
    const next = deletePathPoint(el, 1)!;
    expect(next.points).toEqual([
      localPoint(0, 0),
      localPoint(20, 5),
      localPoint(30, 0),
    ]);
    expect(next.handles).toHaveLength(3);
  });

  it("never deletes below two points (three when closed)", () => {
    expect(
      deletePathPoint(
        makePath({ points: [localPoint(0, 0), localPoint(1, 1)] }),
        0,
      ),
    ).toBeNull();
    expect(
      deletePathPoint(
        makePath({
          points: [localPoint(0, 0), localPoint(1, 1), localPoint(2, 0)],
          closed: true,
        }),
        0,
      ),
    ).toBeNull();
  });

  it("moving an anchor carries its handles along", () => {
    const el = curved();
    const next = movePathPoint(el, 0, localPoint(10, 10));
    expect(next.points[0]).toEqual(localPoint(10, 10));
    expect(next.handles).toEqual(el.handles);
  });

  it("normalizes the element frame after an edit", () => {
    const el = makePath({ points: [localPoint(0, 0), localPoint(10, 0)] });
    const update = getPathUpdate(el, movePathPoint(el, 0, localPoint(-5, -5)));
    expect(update.points).toEqual([localPoint(0, 0), localPoint(15, 5)]);
    expect(update.x).toBe(95);
    expect(update.y).toBe(45);
    expect(update.width).toBe(15);
    expect(update.height).toBe(5);
  });

  it("keeps unmoved anchors in place on a rotated element", () => {
    const el = {
      ...makePath({
        points: [localPoint(0, 0), localPoint(100, 0), localPoint(100, 40)],
      }),
      angle: 0.7 as any,
    };
    const toScene = (
      element: {
        x: number;
        y: number;
        angle: number;
        points: readonly LocalPoint[];
      },
      index: number,
    ) => {
      const [minX, minY, maxX, maxY] = getPathLocalBounds({
        points: element.points,
        handles: element.points.map(() => NO_HANDLES),
        closed: false,
      });
      const cx = element.x + (minX + maxX) / 2;
      const cy = element.y + (minY + maxY) / 2;
      const dx = element.x + element.points[index][0] - cx;
      const dy = element.y + element.points[index][1] - cy;
      const cos = Math.cos(element.angle);
      const sin = Math.sin(element.angle);
      return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
    };
    const geometry = movePathPoint(el, 2, localPoint(100, 200));
    const update = getPathUpdate(el, geometry);
    const next = { ...el, ...update };
    for (const index of [0, 1]) {
      const [ax, ay] = toScene(el, index);
      const [bx, by] = toScene(next, index);
      expect(bx).toBeCloseTo(ax, 6);
      expect(by).toBeCloseTo(ay, 6);
    }
  });

  it("setPathHandle updates the handle of one point only", () => {
    const el = curved();
    const next = setPathHandle(el, 1, "in", localPoint(0, 20));
    expect(next.handles[0]).toEqual(el.handles[0]);
    expect(next.handles[1].in).toEqual(localPoint(0, 20));
  });

  it("scaling mirrors points and handles, keeping the curve at the origin", () => {
    const el = curved();
    const next = scalePathGeometry({ ...el, closed: false }, -1, 2);
    const bounds = getPathLocalBounds({ ...next, closed: false });
    expect(bounds[0]).toBeCloseTo(0);
    expect(bounds[1]).toBeCloseTo(0);
    expect(next.handles[0].out).toEqual(localPoint(-0, 120));
  });
});

describe("hard and soft points in one path", () => {
  it("a hard point next to a smooth one curves on the smooth side only", () => {
    const el = makePath({
      points: [localPoint(0, 0), localPoint(100, 0), localPoint(200, 0)],
      handles: [
        { mode: "corner", in: null, out: null },
        { mode: "smooth", in: localPoint(-30, 0), out: localPoint(30, 40) },
        { mode: "corner", in: localPoint(0, 20), out: null },
      ],
    });
    const [s1, s2] = getPathSegments(el);
    // corner -> smooth: bends toward the smooth point's incoming tangent
    expect(s1.c1).toEqual(s1.p0);
    expect(s1.c2).toEqual(localPoint(70, 0));
    // smooth -> corner: the corner's hidden tangent is not used
    expect(s2.c1).toEqual(localPoint(130, 40));
    expect(s2.c2).toEqual(s2.p1);
  });
});

describe("deleting a point keeps the curve", () => {
  it("refits the neighbours after a split point is removed", () => {
    const el = makePath({
      points: [localPoint(0, 0), localPoint(100, 0)],
      handles: [
        { mode: "broken", in: null, out: localPoint(0, 60) },
        { mode: "broken", in: localPoint(0, 60), out: null },
      ],
    });
    const before = flattenPath(el, 100);
    const split = insertPathPoint(el, 0, 0.5)!;
    const withPoint = makePath({
      points: split.points,
      handles: split.handles,
    });
    const healed = deletePathPoint(withPoint, 1)!;
    const after = flattenPath(
      makePath({ points: healed.points, handles: healed.handles }),
      100,
    );
    for (const [x, y] of after) {
      const nearest = Math.min(
        ...before.map(([bx, by]) => Math.hypot(bx - x, by - y)),
      );
      expect(nearest).toBeLessThan(0.6);
    }
  });
});

describe("opening and closing", () => {
  it("closing smooths the seam of a smooth end point", () => {
    const el = makePath({
      points: [localPoint(0, 0), localPoint(100, 0), localPoint(100, 100)],
      handles: [
        { mode: "smooth", in: null, out: localPoint(20, -20) },
        NO_HANDLES,
        NO_HANDLES,
      ],
    });
    const closed = setPathClosed(el, true)!;
    expect(closed.closed).toBe(true);
    expect(closed.handles[0].in).toEqual(localPoint(-20, 20));
  });

  it("closing leaves a hard start a corner", () => {
    const el = makePath({
      points: [localPoint(0, 0), localPoint(100, 0), localPoint(100, 100)],
    });
    const closed = setPathClosed(el, true)!;
    expect(closed.handles[0]).toEqual(NO_HANDLES);
  });

  it("closing folds a last point that sits on the first", () => {
    const el = makePath({
      points: [
        localPoint(0, 0),
        localPoint(100, 0),
        localPoint(100, 100),
        localPoint(0.2, 0.1),
      ],
      handles: [
        NO_HANDLES,
        NO_HANDLES,
        NO_HANDLES,
        { mode: "smooth", in: localPoint(-5, 5), out: null },
      ],
    });
    const closed = setPathClosed(el, true)!;
    expect(closed.points).toHaveLength(3);
    expect(closed.handles[0].in).toEqual(localPoint(-5, 5));
  });

  it("opening keeps every point, and too short paths cannot close", () => {
    const el = makePath({
      points: [localPoint(0, 0), localPoint(100, 0), localPoint(100, 100)],
      closed: true,
    });
    const open = setPathClosed(el, false)!;
    expect(open.closed).toBe(false);
    expect(open.points).toHaveLength(3);
    expect(
      setPathClosed(
        makePath({ points: [localPoint(0, 0), localPoint(1, 1)] }),
        true,
      ),
    ).toBeNull();
    expect(setPathClosed(el, true)).toBeNull(); // already closed
  });
});

describe("split and join", () => {
  const open = () =>
    makePath({
      points: [
        localPoint(0, 0),
        localPoint(50, 0),
        localPoint(100, 50),
        localPoint(150, 0),
      ],
    });

  it("splits an open path in two sharing the cut point", () => {
    const [first, second] = splitPathAt(open(), 2)!;
    expect(first.points).toEqual([
      localPoint(0, 0),
      localPoint(50, 0),
      localPoint(100, 50),
    ]);
    expect(second.points).toEqual([localPoint(100, 50), localPoint(150, 0)]);
    expect(splitPathAt(open(), 0)).toBeNull();
    expect(splitPathAt(open(), 3)).toBeNull();
  });

  it("a closed path cut at a point becomes one open path from there back to there", () => {
    const el = makePath({
      points: [localPoint(0, 0), localPoint(10, 0), localPoint(10, 10)],
      closed: true,
    });
    const [only] = splitPathAt(el, 1)!;
    expect(only.points).toEqual([
      localPoint(10, 0),
      localPoint(10, 10),
      localPoint(0, 0),
      localPoint(10, 0),
    ]);
  });

  it("joins two paths, merging ends that coincide", () => {
    const [first, second] = splitPathAt(open(), 2)!;
    const joined = joinPathGeometries(first, second);
    expect(joined.points).toEqual(open().points);
  });

  it("bridges ends that do not meet, and reverses a path", () => {
    const first = {
      points: [localPoint(0, 0), localPoint(10, 0)],
      handles: [NO_HANDLES, NO_HANDLES],
    };
    const second = {
      points: [localPoint(30, 0), localPoint(40, 0)],
      handles: [NO_HANDLES, NO_HANDLES],
    };
    expect(joinPathGeometries(first, second).points).toHaveLength(4);
    const reversed = reversePathGeometry({
      points: [localPoint(0, 0), localPoint(10, 0)],
      handles: [
        { mode: "broken", in: null, out: localPoint(1, 1) },
        { mode: "broken", in: localPoint(2, 2), out: null },
      ],
    });
    expect(reversed.points).toEqual([localPoint(10, 0), localPoint(0, 0)]);
    expect(reversed.handles[0]).toEqual({
      mode: "broken",
      in: null,
      out: localPoint(2, 2),
    });
    expect(reversed.handles[1]).toEqual({
      mode: "broken",
      in: localPoint(1, 1),
      out: null,
    });
  });

  it("scene geometry turns points and handles with the element", () => {
    const el = {
      ...makePath({
        points: [localPoint(0, 0), localPoint(100, 0)],
        handles: [
          { mode: "broken", in: null, out: localPoint(10, 0) },
          NO_HANDLES,
        ],
      }),
      angle: (Math.PI / 2) as any,
    };
    const geometry = getPathSceneGeometry(el);
    // a quarter turn about the middle of the path
    expect(geometry.points[0][0]).toBeCloseTo(150, 5);
    expect(geometry.points[0][1]).toBeCloseTo(0, 5);
    expect(geometry.handles[0].out![0]).toBeCloseTo(0, 5);
    expect(geometry.handles[0].out![1]).toBeCloseTo(10, 5);
  });
});

describe("bevel", () => {
  const square = (radius?: number) => {
    const pts = [
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(100, 0),
      pointFrom<LocalPoint>(100, 100),
      pointFrom<LocalPoint>(0, 100),
    ];
    return {
      points: pts,
      handles: pts.map(() => ({
        ...NO_HANDLES,
        ...(radius ? { radius } : {}),
      })),
      closed: true,
    };
  };
  const area = (poly: readonly LocalPoint[]) =>
    Math.abs(
      poly.reduce((sum, point, index) => {
        const next = poly[(index + 1) % poly.length];
        return sum + (point[0] * next[1] - next[0] * point[1]);
      }, 0) / 2,
    );

  it("rounds a right-angle corner into a quarter circle", () => {
    const sharp = area(flattenPath(square()));
    const rounded = area(flattenPath(square(20)));
    // four corners lose (1 - pi/4) r^2 each
    const expected = sharp - 4 * (1 - Math.PI / 4) * 20 * 20;
    // the arc is a cubic approximation
    expect(Math.abs(rounded - expected)).toBeLessThan(1);
  });

  it("keeps the anchors and the size, only the drawn outline changes", () => {
    const geometry = square(20);
    expect(bevelLoop(geometry).points).toHaveLength(8);
    expect(geometry.points).toHaveLength(4);
    const [x1, y1, x2, y2] = getPathLocalBounds(geometry);
    expect([x1, y1, x2, y2]).toEqual([0, 0, 100, 100]);
    expect(getPathSvgD(geometry)).toContain("C");
  });

  it("limits the radius to what the sides allow", () => {
    const huge = area(flattenPath(square(500)));
    // a circle of radius 50 at most
    expect(huge).toBeLessThan(Math.PI * 50 * 50 + 5);
    expect(huge).toBeGreaterThan(Math.PI * 50 * 50 - 120);
  });

  it("leaves curved corners and open ends alone", () => {
    const open = { ...square(20), closed: false };
    expect(bevelLoop(open).points).toHaveLength(6);
    const curved = square(20);
    curved.handles[1] = {
      mode: "smooth",
      in: pointFrom<LocalPoint>(-10, 0),
      out: pointFrom<LocalPoint>(10, 0),
      radius: 20,
    };
    // only the corner between two straight sides is rounded
    expect(bevelLoop(curved).points).toHaveLength(5);
  });

  it("setPathBevel sets and clears radii", () => {
    const geometry = square();
    expect(
      setPathBevel(geometry, 8).handles.every(
        (pointHandles) => pointHandles.radius === 8,
      ),
    ).toBe(true);
    expect(
      setPathBevel(geometry, 8, [1]).handles.map(
        (pointHandles) => pointHandles.radius,
      ),
    ).toEqual([undefined, 8, undefined, undefined]);
    expect(
      setPathBevel(setPathBevel(geometry, 8), 0).handles.some(
        (pointHandles) => "radius" in pointHandles,
      ),
    ).toBe(false);
  });
});
