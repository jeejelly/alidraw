import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import {
  NO_HANDLES,
  applyMirror,
  centerMirrorLine,
  findMirrorPairs,
  reflectHandles,
} from "../src/path";

const point = (x: number, y: number) => pointFrom<LocalPoint>(x, y);

// a down arrow, symmetric about x = 50
const arrow = [
  point(40, 0),
  point(60, 0),
  point(60, 50),
  point(100, 50),
  point(50, 100),
  point(0, 50),
  point(40, 50),
];

describe("mirror pairs", () => {
  it("centres the line on the points", () => {
    expect(centerMirrorLine(arrow, "x")).toEqual({ axis: "x", at: 50 });
  });

  it("pairs each point with its reflection and keeps the axis points alone", () => {
    const pairs = findMirrorPairs(arrow, { axis: "x", at: 50 });
    expect(pairs.get(0)).toBe(1);
    expect(pairs.get(2)).toBe(6);
    expect(pairs.get(3)).toBe(5);
    expect(pairs.get(4)).toBe(4);
  });

  it("forgives a hand-drawn shape that is not quite symmetric", () => {
    const sloppy = arrow.map((p, index) => (index === 1 ? point(62, 1) : p));
    expect(findMirrorPairs(sloppy, { axis: "x", at: 50 }).get(0)).toBe(1);
  });

  it("works on a horizontal line too", () => {
    const pairs = findMirrorPairs([point(0, 0), point(0, 100), point(50, 50)], {
      axis: "y",
      at: 50,
    });
    expect(pairs.get(0)).toBe(1);
    expect(pairs.get(2)).toBe(2);
  });
});

describe("applying a mirror", () => {
  const handles = arrow.map(() => NO_HANDLES);
  const line = { axis: "x", at: 50 } as const;
  const pairs = findMirrorPairs(arrow, line);

  it("moves the sibling to the reflection of the moved point", () => {
    const moved = arrow.map((p, index) => (index === 3 ? point(110, 60) : p));
    const result = applyMirror({ points: moved, handles }, line, pairs, [3]);
    expect(result.points[5]).toEqual([-10, 60]);
    expect(result.points[3]).toEqual([110, 60]);
  });

  it("slides a point on the line along it", () => {
    const moved = arrow.map((p, index) => (index === 4 ? point(58, 120) : p));
    const result = applyMirror({ points: moved, handles }, line, pairs, [4]);
    expect(result.points[4]).toEqual([50, 120]);
  });

  it("mirrors the handles, swapping in and out", () => {
    const smooth = reflectHandles(
      { mode: "smooth", in: point(-5, 2), out: point(7, 3) },
      line,
    );
    expect(smooth.in).toEqual([-7, 3]);
    expect(smooth.out).toEqual([5, 2]);
  });

  it("leaves points without a sibling alone", () => {
    const result = applyMirror({ points: arrow, handles }, line, new Map(), [
      3,
    ]);
    expect(result.points).toEqual(arrow);
  });
});
