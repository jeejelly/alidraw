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
    // outside the south-east corner; a quarter of the way round
    drag(canvas, [325, 225], [200, 300]);
    const el = h.elements.find((e) => e.id === id)!;
    const expected = Math.PI / 2 - Math.atan2(75, 125);
    expect(el.angle).toBeCloseTo(expected, 3);
    expect(el.type).toBe("rectangle");
    expect([el.x, el.y]).toEqual([100, 100]);
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
