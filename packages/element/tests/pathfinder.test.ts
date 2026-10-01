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

const rect = (x: number, y: number, w: number, h: number): Outline => ({
  points: [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ] as any,
  handles: Array(4).fill({ mode: "corner", in: null, out: null }),
});

const bounds = (o: Outline) =>
  getPathLocalBounds({ points: o.points, handles: o.handles, closed: true });

const area = (os: Outline[]) =>
  os.reduce((a, o) => a + Math.abs(outlineArea(o)), 0);

describe("pathfinder booleans", () => {
  const a = rect(0, 0, 100, 100);
  const b = rect(50, 50, 100, 100);

  it("unite: one outline covering both", async () => {
    const r = await runPathfinder("unite", [a, b]);
    expect(r).toHaveLength(1);
    expect(area(r)).toBeCloseTo(100 * 100 * 2 - 50 * 50, 3);
    expect(bounds(r[0])).toEqual([0, 0, 150, 150]);
  });

  it("intersect: the overlap, exactly", async () => {
    const r = await runPathfinder("intersect", [a, b]);
    expect(r).toHaveLength(1);
    expect(bounds(r[0])).toEqual([50, 50, 100, 100]);
    expect(area(r)).toBeCloseTo(2500, 3);
  });

  it("subtract: the bottom shape minus the top", async () => {
    const r = await runPathfinder("subtract", [a, b]);
    expect(area(r)).toBeCloseTo(10000 - 2500, 3);
    expect(bounds(r[0])).toEqual([0, 0, 100, 100]);
  });

  it("exclude: everything but the overlap", async () => {
    const r = await runPathfinder("exclude", [a, b]);
    expect(area(r)).toBeCloseTo(20000 - 2 * 2500, 3);
  });

  it("divide: every region, as separate closed pieces", async () => {
    const r = await runPathfinder("divide", [a, b]);
    expect(r).toHaveLength(3);
    // the pieces tile the union
    expect(area(r)).toBeCloseTo(17500, 3);
  });

  it("curves stay curves: a circle cut from a square keeps its arc", async () => {
    const k = 0.5522847498 * 40;
    const circle: Outline = {
      points: [
        [100, 10],
        [140, 50],
        [100, 90],
        [60, 50],
      ] as any,
      handles: [
        { mode: "smooth", in: [-k, 0] as any, out: [k, 0] as any },
        { mode: "smooth", in: [0, -k] as any, out: [0, k] as any },
        { mode: "smooth", in: [k, 0] as any, out: [-k, 0] as any },
        { mode: "smooth", in: [0, k] as any, out: [0, -k] as any },
      ],
    };
    const r = await runPathfinder("subtract", [rect(0, 0, 100, 100), circle]);
    expect(r).toHaveLength(1);
    // the arc survived as handles, not as a polyline
    expect(r[0].handles.some((h) => h.out || h.in)).toBe(true);
    // the real (curved) area, from a fine flattening
    const poly = flattenPath({ ...r[0], closed: true }, 200);
    let a2 = 0;
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % poly.length];
      a2 += x1 * y2 - x2 * y1;
    }
    expect(Math.abs(a2 / 2)).toBeCloseTo(10000 - (Math.PI * 1600) / 2, -1);
  });

  it("folds over more than two shapes, and refuses fewer", async () => {
    const c = rect(100, 0, 50, 50);
    const r = await runPathfinder("unite", [a, b, c]);
    expect(r).toHaveLength(1);
    expect(await runPathfinder("unite", [a])).toEqual([]);
  });

  it("disjoint intersect has nothing in it", async () => {
    expect(
      await runPathfinder("intersect", [a, rect(500, 500, 10, 10)]),
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
    const o = getOutline(el)!;
    // a quarter turn about the centre (60, 45): the corner (10,20) goes to (85, -5)
    expect(o.points[0][0]).toBeCloseTo(85, 5);
    expect(o.points[0][1]).toBeCloseTo(-5, 5);
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
  const a = rect(0, 0, 100, 100);

  it("a line through the shape gives two pieces that tile it", async () => {
    const [pieces] = await cutOutlines([a], [50, -20], [50, 120]);
    expect(pieces).toHaveLength(2);
    expect(area(pieces!)).toBeCloseTo(10000, 3);
    const boxes = pieces!.map(bounds).sort((p, q) => p[0] - q[0]);
    expect(boxes[0].map(Math.round)).toEqual([0, 0, 50, 100]);
    expect(boxes[1].map(Math.round)).toEqual([50, 0, 100, 100]);
  });

  it("a slanted line cuts at that angle", async () => {
    const [pieces] = await cutOutlines([a], [-20, -20], [120, 120]);
    expect(pieces).toHaveLength(2);
    expect(area(pieces!)).toBeCloseTo(10000, 3);
    // the diagonal splits a square into two equal triangles
    expect(area([pieces![0]])).toBeCloseTo(5000, 3);
  });

  it("a segment that stops inside the shape cuts nothing", async () => {
    expect((await cutOutlines([a], [50, 20], [50, 80]))[0]).toBeNull();
    expect((await cutOutlines([a], [50, -20], [50, 60]))[0]).toBeNull();
  });

  it("a line beside the shape cuts nothing; others in the batch still do", async () => {
    const far = rect(500, 0, 50, 50);
    const r = await cutOutlines([a, far], [50, -20], [50, 120]);
    expect(r[0]).toHaveLength(2);
    expect(r[1]).toBeNull();
  });

  it("curves survive the cut", async () => {
    const k = 0.5522847498 * 50;
    const circle: Outline = {
      points: [
        [50, 0],
        [100, 50],
        [50, 100],
        [0, 50],
      ] as any,
      handles: [
        { mode: "smooth", in: [-k, 0] as any, out: [k, 0] as any },
        { mode: "smooth", in: [0, -k] as any, out: [0, k] as any },
        { mode: "smooth", in: [k, 0] as any, out: [-k, 0] as any },
        { mode: "smooth", in: [0, k] as any, out: [0, -k] as any },
      ],
    };
    const [pieces] = await cutOutlines([circle], [50, -20], [50, 120]);
    expect(pieces).toHaveLength(2);
    expect(pieces!.every((p) => p.handles.some((h) => h.in || h.out))).toBe(
      true,
    );
  });
});
