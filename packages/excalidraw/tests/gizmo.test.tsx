import React from "react";

import { reseed } from "@excalidraw/common";

import { shearPathGeometry, getPathLocalBounds } from "@excalidraw/element";
import { pointFrom, type LocalPoint } from "@excalidraw/math";

import {
  getGizmoZone,
  getSkewFactor,
  skewPivot,
  snapAngle,
  canSkewWithGizmo,
  snapToAlignment,
} from "../gizmo";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import {
  render,
  fireEvent,
  mockBoundingClientRect,
  restoreOriginalGetBoundingClientRect,
  unmountComponent,
} from "./test-utils";

unmountComponent();

const { h } = window;

beforeEach(() => {
  localStorage.clear();
  reseed(7);
});

describe("gizmo zones", () => {
  // a 200 x 100 box: half sizes 100 / 50
  const zone = (x: number, y: number, skewable = true) =>
    getGizmoZone(x, y, 100, 50, 1, skewable);

  it("rotates from just outside a corner", () => {
    expect(zone(125, 75)).toEqual({ kind: "rotate", corner: "se" });
    expect(zone(-125, -75)).toEqual({ kind: "rotate", corner: "nw" });
    expect(zone(125, -75)).toEqual({ kind: "rotate", corner: "ne" });
    expect(zone(-125, 75)).toEqual({ kind: "rotate", corner: "sw" });
  });

  it("skews from just outside an edge, leaving the rotation handle's spot", () => {
    expect(zone(0, 75)).toEqual({ kind: "skew", edge: "s" });
    expect(zone(130, 0)).toEqual({ kind: "skew", edge: "e" });
    expect(zone(-130, 10)).toEqual({ kind: "skew", edge: "w" });
    expect(zone(0, -75)).toBeNull();
    expect(zone(60, -75)).toEqual({ kind: "skew", edge: "n" });
  });

  it("does nothing inside, far outside, or for non-skewable elements", () => {
    expect(zone(0, 0)).toBeNull();
    expect(zone(60, 40)).toBeNull();
    expect(zone(300, 300)).toBeNull();
    expect(zone(0, 75, false)).toBeNull();
    expect(zone(125, 75, false)).toEqual({ kind: "rotate", corner: "se" });
  });

  it("zones keep their screen size when zoomed", () => {
    expect(getGizmoZone(0, 50 + 25 / 2, 100, 50, 2, true)).toEqual({
      kind: "skew",
      edge: "s",
    });
  });
});

describe("skew math", () => {
  it("the opposite edge stays put; from the centre both move", () => {
    // dragging the bottom edge of a 100 tall box by 50: tan = 0.5
    expect(
      getSkewFactor("s", 50, 100, 50, { fromCenter: false, snap: false }),
    ).toBeCloseTo(0.5);
    // dragging the top edge the same way tips the other direction
    expect(
      getSkewFactor("n", 50, 100, 50, { fromCenter: false, snap: false }),
    ).toBeCloseTo(-0.5);
    // from the centre the lever is half as long
    expect(
      getSkewFactor("s", 25, 100, 50, { fromCenter: true, snap: false }),
    ).toBeCloseTo(0.5);
    expect(skewPivot("s", 100, 50, false)).toBe(-50);
    expect(skewPivot("s", 100, 50, true)).toBe(0);
  });

  it("Shift steps by 15 degrees and the angle is capped", () => {
    const k = getSkewFactor("s", 50, 100, 50, {
      fromCenter: false,
      snap: true,
    });
    expect(Math.atan(k)).toBeCloseTo((30 * Math.PI) / 180, 5);
    const big = getSkewFactor("s", 1e6, 100, 50, {
      fromCenter: false,
      snap: false,
    });
    expect(Math.atan(big)).toBeLessThan((80.001 * Math.PI) / 180);
    expect(snapAngle((40 * Math.PI) / 180)).toBeCloseTo((45 * Math.PI) / 180);
  });

  it("shears points and handle vectors about the chosen line", () => {
    const g = shearPathGeometry(
      {
        width: 100,
        height: 100,
        points: [
          pointFrom<LocalPoint>(0, 0),
          pointFrom<LocalPoint>(100, 0),
          pointFrom<LocalPoint>(100, 100),
          pointFrom<LocalPoint>(0, 100),
        ],
        handles: [
          { mode: "broken", in: null, out: pointFrom<LocalPoint>(0, 10) },
          ...Array(3).fill({ mode: "corner", in: null, out: null }),
        ],
      },
      "x",
      0.5,
      -50, // the top edge is the fixed one
    );
    // top row stays, bottom row slides by 0.5 * 100
    expect(g.points[0]).toEqual([0, 0]);
    expect(g.points[3]).toEqual([50, 100]);
    expect(g.points[2]).toEqual([150, 100]);
    // a handle pointing down leans with the shear
    expect(g.handles[0].out).toEqual([5, 10]);
    const b = getPathLocalBounds({ ...g, closed: true });
    expect(b[2] - b[0]).toBeGreaterThan(100);
  });

  it("only paths and plain shapes can skew", () => {
    const base = { locked: false, boundElements: null };
    expect(canSkewWithGizmo({ ...base, type: "rectangle" })).toBe(true);
    expect(canSkewWithGizmo({ ...base, type: "path" })).toBe(true);
    expect(canSkewWithGizmo({ ...base, type: "text" })).toBe(false);
    expect(canSkewWithGizmo({ ...base, type: "rectangle", locked: true })).toBe(
      false,
    );
    expect(
      canSkewWithGizmo({ ...base, type: "rectangle", boundElements: [{}] }),
    ).toBe(false);
  });
});

describe("angle alignment", () => {
  const deg = (d: number) => (d * Math.PI) / 180;
  const other = { angle: deg(20), x: 500, y: 300 };

  it("locks onto another element's axis within a few degrees", () => {
    const r = snapToAlignment(deg(22), [other]);
    expect(r.angle).toBeCloseTo(deg(20));
    expect(r.matches).toEqual([other]);
  });

  it("also matches the perpendicular axis (a quarter turn away)", () => {
    expect(snapToAlignment(deg(111.5), [other]).angle).toBeCloseTo(deg(110));
    expect(snapToAlignment(deg(200.8), [other]).angle).toBeCloseTo(deg(200));
  });

  it("leaves the angle alone beyond the tolerance", () => {
    const r = snapToAlignment(deg(26), [other]);
    expect(r.angle).toBeCloseTo(deg(26));
    expect(r.matches).toEqual([]);
  });

  it("picks the nearest of several axes", () => {
    const a = { angle: deg(10), x: 0, y: 0 };
    const b = { angle: deg(14), x: 1, y: 1 };
    expect(snapToAlignment(deg(13), [a, b]).angle).toBeCloseTo(deg(14));
  });
});

describe("gizmo in the editor", () => {
  beforeAll(() => {
    mockBoundingClientRect({ width: 1000, height: 1000 });
  });
  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  const setup = async () => {
    await render(<Excalidraw />);
    const rect = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 200,
      height: 100,
    });
    API.setElements([rect]);
    API.setSelectedElements([rect]);
    return {
      id: rect.id,
      canvas: document.querySelector("canvas.interactive")!,
    };
  };

  const drag = (
    canvas: Element,
    from: [number, number],
    to: [number, number],
    mods: { shiftKey?: boolean; altKey?: boolean } = {},
  ) => {
    fireEvent.pointerDown(canvas, {
      clientX: from[0],
      clientY: from[1],
      ...mods,
    });
    fireEvent.pointerMove(window, { clientX: to[0], clientY: to[1], ...mods });
    fireEvent.pointerUp(window, { clientX: to[0], clientY: to[1], ...mods });
  };

  it("rotates around the centre, relative to where the drag began", async () => {
    const { canvas, id } = await setup();
    // outside the south-east corner, then turned by 25 degrees (clear of the magnet angles)
    const start = Math.atan2(75, 125);
    const target = start + (25 * Math.PI) / 180;
    drag(
      canvas,
      [325, 225],
      [200 + 200 * Math.cos(target), 150 + 200 * Math.sin(target)],
    );
    const el = h.elements.find((e) => e.id === id)!;
    expect(el.angle).toBeCloseTo((25 * Math.PI) / 180, 3);
    expect(el.type).toBe("rectangle");
    expect([el.x, el.y]).toEqual([100, 100]);
  });

  it("rotation locks onto the angle of another element and shows its axis", async () => {
    const { canvas, id } = await setup();
    const other = API.createElement({
      type: "rectangle",
      x: 600,
      y: 100,
      width: 80,
      height: 80,
      angle: ((20 * Math.PI) / 180) as any,
    });
    API.setElements([h.elements[0], other]);
    // aim for about 21 degrees: close enough to lock onto 20
    const target = (21 * Math.PI) / 180;
    const start = Math.atan2(75, 125);
    const r = 200;
    const to: [number, number] = [
      200 + r * Math.cos(start + target),
      150 + r * Math.sin(start + target),
    ];
    fireEvent.pointerDown(canvas, { clientX: 325, clientY: 225 });
    fireEvent.pointerMove(window, { clientX: to[0], clientY: to[1] });
    const el = h.elements.find((e) => e.id === id)!;
    expect((el.angle * 180) / Math.PI).toBeCloseTo(20, 5);
    expect(h.state.gizmo?.align.length).toBeGreaterThan(0);
    fireEvent.pointerUp(window, { clientX: to[0], clientY: to[1] });
    expect(h.state.gizmo?.align).toEqual([]);
  });

  it("Shift rotates in 15 degree steps", async () => {
    const { canvas, id } = await setup();
    drag(canvas, [325, 225], [200, 300], { shiftKey: true });
    const deg = (h.elements.find((e) => e.id === id)!.angle * 180) / Math.PI;
    expect(Math.round(deg) % 15).toBe(0);
  });

  it("skews a rectangle into a path, the far edge staying put", async () => {
    const { canvas, id } = await setup();
    // just below the bottom edge, dragged 50 to the right
    drag(canvas, [200, 225], [250, 225]);
    const el = h.elements.find((e) => e.id === id) as any;
    expect(el.type).toBe("path");
    expect(el.closed).toBe(true);
    // 100 px tall, the bottom edge slid 50: the box is 50 wider
    expect(el.width).toBeCloseTo(250);
    expect(el.height).toBeCloseTo(100);
    const abs = el.points.map((p: number[]) => [el.x + p[0], el.y + p[1]]);
    // top edge (the pivot) is where it was
    expect(abs[0]).toEqual([100, 100]);
    expect(abs[1]).toEqual([300, 100]);
    // bottom edge moved right by 50
    expect(abs[2][0]).toBeCloseTo(350);
    expect(abs[3][0]).toBeCloseTo(150);
  });

  it("Alt skews about the centre, so both edges move", async () => {
    const { canvas, id } = await setup();
    drag(canvas, [200, 225], [225, 225], { altKey: true });
    const el = h.elements.find((e) => e.id === id) as any;
    const abs = el.points.map((p: number[]) => [el.x + p[0], el.y + p[1]]);
    // lever is half as long: 25 at the bottom, -25 at the top
    expect(abs[2][0] - 300).toBeCloseTo(25);
    expect(abs[0][0] - 100).toBeCloseTo(-25);
  });

  const setupGroup = async () => {
    await render(<Excalidraw />);
    const a = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 100,
      height: 100,
    });
    const b = API.createElement({
      type: "rectangle",
      x: 300,
      y: 100,
      width: 100,
      height: 100,
    });
    API.setElements([a, b]);
    API.setSelectedElements([a, b]);
    return {
      ids: [a.id, b.id],
      canvas: document.querySelector("canvas.interactive")!,
    };
  };

  it("a group rotates as one with the same gizmo: every shape about the box's centre", async () => {
    const { canvas, ids } = await setupGroup();
    // the box is (100,100)-(400,200), centre (250,150); outside its south-east corner
    const start = Math.atan2(75, 175);
    const target = start + (25 * Math.PI) / 180;
    drag(
      canvas,
      [425, 225],
      [250 + 250 * Math.cos(target), 150 + 250 * Math.sin(target)],
    );
    const [a, b] = ids.map((id) => h.elements.find((e) => e.id === id)!);
    expect(a.angle).toBeCloseTo((25 * Math.PI) / 180, 3);
    expect(b.angle).toBeCloseTo((25 * Math.PI) / 180, 3);
    // the centres turned about (250, 150)
    const rot = (x: number, y: number) => {
      const t = (25 * Math.PI) / 180;
      const dx = x - 250;
      const dy = y - 150;
      return [
        250 + dx * Math.cos(t) - dy * Math.sin(t),
        150 + dx * Math.sin(t) + dy * Math.cos(t),
      ];
    };
    const [ax, ay] = rot(150, 150);
    const [bx, by] = rot(350, 150);
    expect(a.x + 50).toBeCloseTo(ax, 2);
    expect(a.y + 50).toBeCloseTo(ay, 2);
    expect(b.x + 50).toBeCloseTo(bx, 2);
    expect(b.y + 50).toBeCloseTo(by, 2);
  });

  it("Escape in the middle of turning a group puts everything back", async () => {
    const { canvas, ids } = await setupGroup();
    fireEvent.pointerDown(canvas, { clientX: 425, clientY: 225 });
    fireEvent.pointerMove(window, { clientX: 300, clientY: 400 });
    fireEvent.keyDown(window, { key: "Escape" });
    for (const [i, id] of ids.entries()) {
      const el = h.elements.find((e) => e.id === id)!;
      expect(el.angle).toBe(0);
      expect([el.x, el.y]).toEqual([i ? 300 : 100, 100]);
    }
  });

  it("a group skews about one shared line", async () => {
    const { canvas, ids } = await setupGroup();
    // below the bottom edge's middle, 50 to the right
    drag(canvas, [250, 225], [300, 225]);
    for (const [i, id] of ids.entries()) {
      const el = h.elements.find((e) => e.id === id) as any;
      expect(el.type).toBe("path");
      const abs = el.points.map((p: number[]) => [el.x + p[0], el.y + p[1]]);
      const left = i ? 300 : 100;
      // the top edge is the pivot, the bottom slid by 50
      expect(abs[0][0]).toBeCloseTo(left);
      expect(abs[2][0]).toBeCloseTo(left + 100 + 50);
      expect(abs[3][0]).toBeCloseTo(left + 50);
    }
  });

  it("a plain click just outside the selection still deselects", async () => {
    const { canvas } = await setup();
    fireEvent.pointerDown(canvas, { clientX: 325, clientY: 225 });
    fireEvent.pointerUp(window, { clientX: 325, clientY: 225 });
    expect(h.state.selectedElementIds).toEqual({});
    expect(h.elements[0].angle).toBe(0);
  });

  it("Escape in the middle of a skew restores the shape", async () => {
    const { canvas, id } = await setup();
    fireEvent.pointerDown(canvas, { clientX: 200, clientY: 225 });
    fireEvent.pointerMove(window, { clientX: 260, clientY: 225 });
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerUp(window, { clientX: 260, clientY: 225 });
    const el = h.elements.find((e) => e.id === id) as any;
    expect(el.width).toBeCloseTo(200);
    expect(el.points[0]).toEqual([0, 0]);
  });
});
