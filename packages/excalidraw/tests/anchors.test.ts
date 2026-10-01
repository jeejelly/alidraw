import {
  fitBoundsToGrid,
  getAnchor,
  pointOnBounds,
  solveElementAnchor,
  solveGuideAnchor,
  withAnchor,
} from "../anchors";

describe("anchor points", () => {
  const box: [number, number, number, number] = [100, 200, 300, 260];
  it("names the nine points of a box", () => {
    expect(pointOnBounds(box, "tl")).toEqual([100, 200]);
    expect(pointOnBounds(box, "tc")).toEqual([200, 200]);
    expect(pointOnBounds(box, "tr")).toEqual([300, 200]);
    expect(pointOnBounds(box, "ml")).toEqual([100, 230]);
    expect(pointOnBounds(box, "c")).toEqual([200, 230]);
    expect(pointOnBounds(box, "mr")).toEqual([300, 230]);
    expect(pointOnBounds(box, "bl")).toEqual([100, 260]);
    expect(pointOnBounds(box, "bc")).toEqual([200, 260]);
    expect(pointOnBounds(box, "br")).toEqual([300, 260]);
  });
});

describe("solving anchors", () => {
  it("hangs an element's point off a target's point, with a gap", () => {
    // the follower's top-left sits 16 right of the target's top-right
    const move = solveElementAnchor([0, 0, 50, 50], [200, 100, 300, 180], {
      to: "t",
      from: "tr",
      at: "tl",
      dx: 16,
      dy: 0,
    });
    expect(move).toEqual({ x: 316, y: 100 });
  });

  it("is a no-op once satisfied", () => {
    expect(
      solveElementAnchor([316, 100, 366, 150], [200, 100, 300, 180], {
        to: "t",
        from: "tr",
        at: "tl",
        dx: 16,
        dy: 0,
      }),
    ).toEqual({ x: 0, y: 0 });
  });

  it("pins an edge to a guide on one axis only", () => {
    expect(
      solveGuideAnchor(
        [10, 20, 60, 80],
        { axis: "x", position: 100 },
        { guide: "g", edge: "end", offset: 0 },
      ),
    ).toEqual({ x: 40, y: 0 });
    expect(
      solveGuideAnchor(
        [10, 20, 60, 80],
        { axis: "y", position: 100 },
        { guide: "g", edge: "center", offset: 5 },
      ),
    ).toEqual({ x: 0, y: 55 });
  });
});

describe("anchor data", () => {
  it("round-trips through customData and repairs junk", () => {
    const data = withAnchor(
      { other: 1 },
      {
        to: "a",
        from: "tr",
        at: "tl",
        dx: 4,
        dy: 8,
      },
    );
    expect(data?.other).toBe(1);
    expect(getAnchor({ customData: data })).toEqual({
      to: "a",
      from: "tr",
      at: "tl",
      dx: 4,
      dy: 8,
    });
    expect(
      getAnchor({ customData: { anchor: { to: "a", from: "zz", dx: "x" } } }),
    ).toEqual({ to: "a", from: "c", at: "c", dx: 0, dy: 0 });
    expect(
      getAnchor({ customData: { anchor: { guide: "g", edge: "?" } } }),
    ).toEqual({
      guide: "g",
      edge: "start",
      offset: 0,
    });
    expect(getAnchor({})).toBeNull();
    expect(withAnchor({ anchor: 1 }, null)).toEqual({});
  });
});

describe("fit to grid", () => {
  it("rounds position and size to grid lines, at least one cell", () => {
    expect(fitBoundsToGrid([13, 27, 88, 61], 20, { keepSize: false })).toEqual([
      20, 20, 80, 60,
    ]);
    expect(fitBoundsToGrid([13, 27, 15, 28], 20, { keepSize: false })).toEqual([
      20, 20, 40, 40,
    ]);
  });
  it("can keep the size and only move", () => {
    expect(fitBoundsToGrid([13, 27, 88, 61], 20, { keepSize: true })).toEqual([
      20, 20, 95, 54,
    ]);
  });
});
