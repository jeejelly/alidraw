import {
  cutOutlines,
  getOutline,
  isPathfinderOperand,
  outlineArea,
  runPathfinder,
  type Outline,
} from "../src/pathfinder";
import { flattenPath, getPathLocalBounds } from "../src/path";
import { newElement } from "../src/newElement";

const rect = (
  x: number,
  y: number,
  width: number,
  height: number,
): Outline => ({
  points: [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
  ] as any,
  handles: Array(4).fill({ mode: "corner", in: null, out: null }),
});

const bounds = (outline: Outline) =>
  getPathLocalBounds({
    points: outline.points,
    handles: outline.handles,
    closed: true,
  });

const area = (os: Outline[]) =>
  os.reduce((total, outline) => total + Math.abs(outlineArea(outline)), 0);

describe("pathfinder booleans", () => {
  const first = rect(0, 0, 100, 100);
  const second = rect(50, 50, 100, 100);

  it("unite: one outline covering both", async () => {
    const result = await runPathfinder("unite", [first, second]);
    expect(result).toHaveLength(1);
    expect(area(result)).toBeCloseTo(100 * 100 * 2 - 50 * 50, 3);
    expect(bounds(result[0])).toEqual([0, 0, 150, 150]);
  });

  it("intersect: the overlap, exactly", async () => {
    const result = await runPathfinder("intersect", [first, second]);
    expect(result).toHaveLength(1);
    expect(bounds(result[0])).toEqual([50, 50, 100, 100]);
    expect(area(result)).toBeCloseTo(2500, 3);
  });

  it("subtract: the bottom shape minus the top", async () => {
    const result = await runPathfinder("subtract", [first, second]);
    expect(area(result)).toBeCloseTo(10000 - 2500, 3);
    expect(bounds(result[0])).toEqual([0, 0, 100, 100]);
  });

  it("exclude: everything but the overlap", async () => {
    const result = await runPathfinder("exclude", [first, second]);
    expect(area(result)).toBeCloseTo(20000 - 2 * 2500, 3);
  });

  it("divide: every region, as separate closed pieces", async () => {
    const result = await runPathfinder("divide", [first, second]);
    expect(result).toHaveLength(3);
    // the pieces tile the union
    expect(area(result)).toBeCloseTo(17500, 3);
  });

  it("curves stay curves: a circle cut from a square keeps its arc", async () => {
    const handleLength = 0.5522847498 * 40;
    const circle: Outline = {
      points: [
        [100, 10],
        [140, 50],
        [100, 90],
        [60, 50],
      ] as any,
      handles: [
        {
          mode: "smooth",
          in: [-handleLength, 0] as any,
          out: [handleLength, 0] as any,
        },
        {
          mode: "smooth",
          in: [0, -handleLength] as any,
          out: [0, handleLength] as any,
        },
        {
          mode: "smooth",
          in: [handleLength, 0] as any,
          out: [-handleLength, 0] as any,
        },
        {
          mode: "smooth",
          in: [0, handleLength] as any,
          out: [0, -handleLength] as any,
        },
      ],
    };
    const result = await runPathfinder("subtract", [
      rect(0, 0, 100, 100),
      circle,
    ]);
    expect(result).toHaveLength(1);
    // the arc survived as handles, not as a polyline
    expect(
      result[0].handles.some(
        (pointHandles) => pointHandles.out || pointHandles.in,
      ),
    ).toBe(true);
    // the real (curved) area, from a fine flattening
    const poly = flattenPath({ ...result[0], closed: true }, 200);
    let a2 = 0;
    for (let index = 0; index < poly.length; index++) {
      const [x1, y1] = poly[index];
      const [x2, y2] = poly[(index + 1) % poly.length];
      a2 += x1 * y2 - x2 * y1;
    }
    expect(Math.abs(a2 / 2)).toBeCloseTo(10000 - (Math.PI * 1600) / 2, -1);
  });

  it("folds over more than two shapes, and refuses fewer", async () => {
    const third = rect(100, 0, 50, 50);
    const result = await runPathfinder("unite", [first, second, third]);
    expect(result).toHaveLength(1);
    expect(await runPathfinder("unite", [first])).toEqual([]);
  });

  it("disjoint intersect has nothing in it", async () => {
    expect(
      await runPathfinder("intersect", [first, rect(500, 500, 10, 10)]),
    ).toEqual([]);
  });
});

describe("pathfinder operands", () => {
  const base = { x: 10, y: 20, width: 100, height: 50 } as any;
  it("takes closed shapes, with rotation applied", () => {
    const el = {
      ...newElement({ type: "rectangle", ...base }),
      angle: Math.PI / 2,
    } as any;
    expect(isPathfinderOperand(el)).toBe(true);
    const outline = getOutline(el)!;
    // a quarter turn about the centre (60, 45): the corner (10,20) goes to (85, -5)
    expect(outline.points[0][0]).toBeCloseTo(85, 5);
    expect(outline.points[0][1]).toBeCloseTo(-5, 5);
  });
  it("leaves out text, lines and labelled shapes", () => {
    expect(isPathfinderOperand({ type: "text", isDeleted: false } as any)).toBe(
      false,
    );
    expect(
      isPathfinderOperand({
        type: "rectangle",
        isDeleted: false,
        boundElements: [{}],
      } as any),
    ).toBe(false);
    expect(
      isPathfinderOperand({
        type: "path",
        isDeleted: false,
        closed: false,
        points: [1, 2, 3],
      } as any),
    ).toBe(false);
  });
});

describe("knife cuts", () => {
  const first = rect(0, 0, 100, 100);

  it("a line through the shape gives two pieces that tile it", async () => {
    const [pieces] = await cutOutlines([first], [50, -20], [50, 120]);
    expect(pieces).toHaveLength(2);
    expect(area(pieces!)).toBeCloseTo(10000, 3);
    const boxes = pieces!.map(bounds).sort((left, right) => left[0] - right[0]);
    expect(boxes[0].map(Math.round)).toEqual([0, 0, 50, 100]);
    expect(boxes[1].map(Math.round)).toEqual([50, 0, 100, 100]);
  });

  it("a slanted line cuts at that angle", async () => {
    const [pieces] = await cutOutlines([first], [-20, -20], [120, 120]);
    expect(pieces).toHaveLength(2);
    expect(area(pieces!)).toBeCloseTo(10000, 3);
    // the diagonal splits a square into two equal triangles
    expect(area([pieces![0]])).toBeCloseTo(5000, 3);
  });

  it("a segment that stops inside the shape cuts nothing", async () => {
    expect((await cutOutlines([first], [50, 20], [50, 80]))[0]).toBeNull();
    expect((await cutOutlines([first], [50, -20], [50, 60]))[0]).toBeNull();
  });

  it("a line beside the shape cuts nothing; others in the batch still do", async () => {
    const far = rect(500, 0, 50, 50);
    const results = await cutOutlines([first, far], [50, -20], [50, 120]);
    expect(results[0]).toHaveLength(2);
    expect(results[1]).toBeNull();
  });

  it("curves survive the cut", async () => {
    const handleLength = 0.5522847498 * 50;
    const circle: Outline = {
      points: [
        [50, 0],
        [100, 50],
        [50, 100],
        [0, 50],
      ] as any,
      handles: [
        {
          mode: "smooth",
          in: [-handleLength, 0] as any,
          out: [handleLength, 0] as any,
        },
        {
          mode: "smooth",
          in: [0, -handleLength] as any,
          out: [0, handleLength] as any,
        },
        {
          mode: "smooth",
          in: [handleLength, 0] as any,
          out: [-handleLength, 0] as any,
        },
        {
          mode: "smooth",
          in: [0, handleLength] as any,
          out: [0, -handleLength] as any,
        },
      ],
    };
    const [pieces] = await cutOutlines([circle], [50, -20], [50, 120]);
    expect(pieces).toHaveLength(2);
    expect(
      pieces!.every((piece) =>
        piece.handles.some(
          (pointHandles) => pointHandles.in || pointHandles.out,
        ),
      ),
    ).toBe(true);
  });
});

describe("rounded shapes", () => {
  it("a rounded rectangle cut by a card leaves two boxes that keep their rounded outer corners", async () => {
    const rounded = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 400,
      height: 200,
      roundness: { type: 3 },
    } as any);
    const card = newElement({
      type: "rectangle",
      x: 100,
      y: -50,
      width: 200,
      height: 300,
    } as any);
    const bottom = getOutline(rounded)!;
    const top = getOutline(card)!;
    // the rounding is part of the outline
    expect(bottom.points.length).toBeGreaterThan(4);
    const pieces = await runPathfinder("subtract", [bottom, top]);
    expect(pieces).toHaveLength(2);
    const boxes = pieces
      .map((piece) => bounds(piece))
      .sort((x, y) => x[0] - y[0]);
    expect(boxes[0].map((value) => Math.round(value) + 0)).toEqual([
      0, 0, 100, 200,
    ]);
    expect(boxes[1].map(Math.round)).toEqual([300, 0, 400, 200]);
    // each piece: two straight cut corners, two rounded outer ones
    for (const piece of pieces) {
      const curved = piece.handles.filter(
        (pointHandles) => pointHandles.in || pointHandles.out,
      ).length;
      expect(curved).toBeGreaterThanOrEqual(2);
    }
    // and no area beyond a sharp-cornered box
    expect(area(pieces)).toBeLessThan(2 * 100 * 200);
  });
});
