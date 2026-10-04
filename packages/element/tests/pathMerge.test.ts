import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import { NO_HANDLES, mergeOpenPaths } from "../src/path";

const line = (...coords: [number, number][]) => ({
  points: coords.map(([x, y]) => pointFrom<LocalPoint>(x, y)),
  handles: coords.map(() => NO_HANDLES),
});

describe("mergeOpenPaths", () => {
  it("chains paths whose ends are near, reversing where needed", () => {
    const merged = mergeOpenPaths(
      [line([0, 0], [10, 0]), line([20, 0], [10, 3]), line([30, 0], [20, 2])],
      5,
      5,
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].members).toEqual([0, 1, 2]);
    expect(merged[0].closed).toBe(false);
  });

  it("leaves paths whose ends are far apart", () => {
    const merged = mergeOpenPaths(
      [line([0, 0], [10, 0]), line([100, 0], [110, 0])],
      5,
      5,
    );
    expect(merged.map((chain) => chain.members)).toEqual([[0], [1]]);
  });

  it("closes a chain whose ends meet", () => {
    const merged = mergeOpenPaths(
      [
        line([0, 0], [10, 0]),
        line([10, 1], [10, 10]),
        line([10, 10], [0, 10]),
        line([0, 11], [0, 1]),
      ],
      5,
      5,
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].closed).toBe(true);
    expect(merged[0].members).toEqual([0, 1, 2, 3]);
  });
});
