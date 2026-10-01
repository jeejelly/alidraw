import React from "react";

import { KEYS, reseed } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  isPathElement,
  isPointInElement,
} from "@excalidraw/element";
import { pointFrom, type GlobalPoint, type LocalPoint } from "@excalidraw/math";

import type { ExcalidrawPathElement } from "@excalidraw/element/types";

import { actionConvertShapeToPath, actionEditPath } from "../actions";
import { restoreElements } from "../data/restore";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import {
  act,
  render,
  fireEvent,
  screen,
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

const getPath = () => {
  const el = h.elements.find((e) => !e.isDeleted && e.type === "path");
  return el as ExcalidrawPathElement;
};

describe("path tool", () => {
  beforeAll(() => {
    mockBoundingClientRect({ width: 1000, height: 1000 });
  });
  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  const click = (canvas: Element, x: number, y: number) => {
    fireEvent.pointerDown(canvas, { clientX: x, clientY: y });
    fireEvent.pointerUp(window, { clientX: x, clientY: y });
  };

  it("draws a path: click for corners, drag for curves, Enter to finish", async () => {
    const { container } = await render(<Excalidraw handleKeyboardGlobally />);
    const canvas = container.querySelector("canvas.interactive")!;
    act(() => h.app.setActiveTool({ type: "path" }));

    click(canvas, 100, 100);
    fireEvent.pointerMove(window, { clientX: 150, clientY: 100 });
    // press, drag out a tangent, release
    fireEvent.pointerDown(canvas, { clientX: 200, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 220, clientY: 160 });
    fireEvent.pointerUp(window, { clientX: 220, clientY: 160 });
    fireEvent.pointerMove(window, { clientX: 300, clientY: 200 });
    click(canvas, 300, 200);
    Keyboard.keyPress(KEYS.ENTER);

    const path = getPath();
    expect(path).toBeDefined();
    expect(path.points).toHaveLength(3);
    expect(path.closed).toBe(false);
    // the dragged point is smooth with collinear handles
    const h1 = path.handles[1];
    expect(h1.mode).toBe("smooth");
    expect(h1.out![0]).toBeCloseTo(20);
    expect(h1.out![1]).toBeCloseTo(60);
    expect(h1.in![0]).toBeCloseTo(-20);
    expect(h1.in![1]).toBeCloseTo(-60);
    // corner points have none
    expect(path.handles[0].out).toBeNull();
    expect(path.handles[2].mode).toBe("corner");
    // finished: selection tool, the path selected
    expect(h.state.activeTool.type).toBe("selection");
    expect(h.state.selectedElementIds[path.id]).toBe(true);
    expect([path.x + path.points[0][0], path.y + path.points[0][1]]).toEqual([
      100, 100,
    ]);
  });

  it("clicking the first point closes the path", async () => {
    const { container } = await render(<Excalidraw handleKeyboardGlobally />);
    const canvas = container.querySelector("canvas.interactive")!;
    act(() => h.app.setActiveTool({ type: "path" }));

    click(canvas, 100, 100);
    click(canvas, 200, 100);
    click(canvas, 200, 200);
    click(canvas, 101, 101);

    const path = getPath();
    expect(path.closed).toBe(true);
    expect(path.points).toHaveLength(3);
  });

  it("a double click finishes without a duplicate point", async () => {
    const { container } = await render(<Excalidraw handleKeyboardGlobally />);
    const canvas = container.querySelector("canvas.interactive")!;
    act(() => h.app.setActiveTool({ type: "path" }));

    click(canvas, 100, 100);
    click(canvas, 200, 100);
    click(canvas, 300, 250);
    click(canvas, 300, 250);

    expect(getPath().points).toHaveLength(3);
    expect(h.state.activeTool.type).toBe("selection");
  });

  it("a lone click leaves nothing behind", async () => {
    const { container } = await render(<Excalidraw handleKeyboardGlobally />);
    const canvas = container.querySelector("canvas.interactive")!;
    act(() => h.app.setActiveTool({ type: "path" }));
    click(canvas, 100, 100);
    Keyboard.keyPress(KEYS.ESCAPE);
    expect(h.elements.filter((e) => !e.isDeleted)).toHaveLength(0);
  });
});

describe("path editing", () => {
  beforeAll(() => {
    mockBoundingClientRect({ width: 1000, height: 1000 });
  });
  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  const setup = async () => {
    const utils = await render(<Excalidraw handleKeyboardGlobally />);
    const canvas = utils.container.querySelector("canvas.interactive")!;
    const path = API.createElement({
      type: "path",
      x: 100,
      y: 100,
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(100, 0),
        pointFrom<LocalPoint>(100, 100),
      ],
    });
    API.updateScene({
      elements: [path],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    API.setSelectedElements([path]);
    return { canvas, id: path.id };
  };

  const click = (canvas: Element, x: number, y: number) => {
    fireEvent.pointerDown(canvas, { clientX: x, clientY: y });
    fireEvent.pointerUp(window, { clientX: x, clientY: y });
  };

  it("an edit action enters the editor, Escape leaves it", async () => {
    await setup();
    API.executeAction(actionEditPath);
    expect(h.state.editingPath?.elementId).toBe(getPath().id);
    Keyboard.keyPress(KEYS.ESCAPE);
    expect(h.state.editingPath).toBeNull();
  });

  it("drags an anchor", async () => {
    const { canvas } = await setup();
    API.executeAction(actionEditPath);
    fireEvent.pointerDown(canvas, { clientX: 200, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 240, clientY: 130 });
    fireEvent.pointerUp(window, { clientX: 240, clientY: 130 });
    const path = getPath();
    expect(h.state.editingPath?.selectedPoint).toBe(1);
    // points are relative to the top-left of the curve
    const abs = path.points.map((p) => [path.x + p[0], path.y + p[1]]);
    expect(abs[0]).toEqual([100, 100]);
    expect(abs[1]).toEqual([240, 130]);
    expect(abs[2]).toEqual([200, 200]);
  });

  it("a smooth point is given handles, which can then be dragged", async () => {
    const { canvas } = await setup();
    API.executeAction(actionEditPath);
    click(canvas, 200, 100);
    act(() => h.app.path.setPointMode("smooth"));
    let path = getPath();
    expect(path.handles[1].mode).toBe("smooth");
    expect(path.handles[1].out).not.toBeNull();
    expect(path.handles[1].in).not.toBeNull();

    // drag the outgoing handle somewhere else
    const out = path.handles[1].out!;
    const hx = path.x + path.points[1][0] + out[0];
    const hy = path.y + path.points[1][1] + out[1];
    fireEvent.pointerDown(canvas, { clientX: hx, clientY: hy });
    fireEvent.pointerMove(window, { clientX: 260, clientY: 140 });
    fireEvent.pointerUp(window, { clientX: 260, clientY: 140 });
    path = getPath();
    const anchor = [path.x + path.points[1][0], path.y + path.points[1][1]];
    const o = path.handles[1].out!;
    const i = path.handles[1].in!;
    expect([anchor[0] + o[0], anchor[1] + o[1]]).toEqual([260, 140]);
    // `in` stays collinear, on the other side
    expect(o[0] * i[1] - o[1] * i[0]).toBeCloseTo(0);
    expect(o[0] * i[0] + o[1] * i[1]).toBeLessThan(0);
  });

  it("a double click on a segment inserts a point, Delete removes it", async () => {
    const { canvas } = await setup();
    API.executeAction(actionEditPath);
    const before = flat(getPath());
    // middle of the first segment
    click(canvas, 150, 100);
    click(canvas, 150, 100);
    expect(getPath().points).toHaveLength(4);
    expect(h.state.editingPath?.selectedPoint).toBe(1);
    // the geometry did not move
    const after = flat(getPath());
    expect(after.slice(0, 2)).toEqual(before.slice(0, 2));

    Keyboard.keyPress(KEYS.DELETE);
    const path = getPath();
    expect(path.points).toHaveLength(3);
    expect([path.x, path.y]).toEqual([100, 100]);
  });

  it("Illustrator keys: Shift+C flips corner/smooth, - deletes the anchor", async () => {
    const { canvas } = await setup();
    API.executeAction(actionEditPath);
    click(canvas, 200, 100);
    Keyboard.withModifierKeys({ shift: true }, () => Keyboard.keyPress("C"));
    expect(getPath().handles[1].mode).toBe("smooth");
    Keyboard.withModifierKeys({ shift: true }, () => Keyboard.keyPress("C"));
    expect(getPath().handles[1].mode).toBe("corner");
    Keyboard.keyPress("-");
    expect(getPath().points).toHaveLength(2);
  });

  it("clicking elsewhere leaves the editor", async () => {
    const { canvas } = await setup();
    API.executeAction(actionEditPath);
    click(canvas, 600, 600);
    expect(h.state.editingPath).toBeNull();
  });

  it("undo restores the previous geometry", async () => {
    const { canvas } = await setup();
    API.executeAction(actionEditPath);
    fireEvent.pointerDown(canvas, { clientX: 200, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 240, clientY: 130 });
    fireEvent.pointerUp(window, { clientX: 240, clientY: 130 });
    expect(flat(getPath())).not.toEqual([100, 100, 200, 100, 200, 200]);
    Keyboard.withModifierKeys({ ctrl: true }, () => Keyboard.keyPress(KEYS.Z));
    expect(flat(getPath())).toEqual([100, 100, 200, 100, 200, 200]);
  });
});

describe("open, close, split and join in the editor", () => {
  beforeAll(() => {
    mockBoundingClientRect({ width: 1000, height: 1000 });
  });
  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  const mk = (x: number, y: number, pts: [number, number][]) =>
    API.createElement({
      type: "path",
      x,
      y,
      points: pts.map(([a, b]) => pointFrom<LocalPoint>(a, b)),
    });

  it("toggles closed and back", async () => {
    await render(<Excalidraw />);
    const p = mk(100, 100, [
      [0, 0],
      [100, 0],
      [100, 100],
    ]);
    API.setElements([p]);
    API.setSelectedElements([p]);
    API.executeAction(actionEditPath);
    act(() => h.app.path.toggleClosed());
    expect(getPath().closed).toBe(true);
    act(() => h.app.path.toggleClosed());
    expect(getPath().closed).toBe(false);
    expect(getPath().points).toHaveLength(3);
  });

  it("splits at the selected point into two paths", async () => {
    await render(<Excalidraw />);
    const p = mk(100, 100, [
      [0, 0],
      [100, 0],
      [100, 100],
    ]);
    API.setElements([p]);
    API.setSelectedElements([p]);
    API.setAppState({ editingPath: { elementId: p.id, selectedPoint: 1 } });
    act(() => h.app.path.splitAtSelectedPoint());
    const paths = h.elements.filter(
      (e) => e.type === "path" && !e.isDeleted,
    ) as ExcalidrawPathElement[];
    expect(paths).toHaveLength(2);
    expect(paths.map((q) => q.points.length).sort()).toEqual([2, 2]);
    // the pieces stay where they were
    const abs = paths.map((q) =>
      q.points.map((pt) => [q.x + pt[0], q.y + pt[1]]),
    );
    expect(abs).toContainEqual([
      [100, 100],
      [200, 100],
    ]);
    expect(abs).toContainEqual([
      [200, 100],
      [200, 200],
    ]);
  });

  it("joins two selected open paths at their nearest ends", async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
    const a = mk(0, 0, [
      [0, 0],
      [100, 0],
    ]);
    const b = mk(300, 0, [
      [0, 0],
      [100, 0],
    ]);
    API.setElements([a, b]);
    API.setSelectedElements([a, b]);
    Keyboard.withModifierKeys({ ctrl: true }, () => Keyboard.codePress("KeyJ"));
    const live = h.elements.filter(
      (e) => !e.isDeleted,
    ) as ExcalidrawPathElement[];
    expect(live).toHaveLength(1);
    const abs = live[0].points.map((pt) => [
      live[0].x + pt[0],
      live[0].y + pt[1],
    ]);
    expect(abs).toEqual([
      [0, 0],
      [100, 0],
      [300, 0],
      [400, 0],
    ]);
  });
});

const flat = (p: ExcalidrawPathElement) =>
  p.points.flatMap((pt) => [p.x + pt[0], p.y + pt[1]]);

describe("shape to path", () => {
  it.each(["rectangle", "diamond", "ellipse"] as const)(
    "converts a %s",
    async (type) => {
      await render(<Excalidraw handleKeyboardGlobally />);
      const shape = API.createElement({
        type,
        x: 10,
        y: 20,
        width: 200,
        height: 100,
        strokeColor: "#ff0000",
        backgroundColor: "#00ff00",
      });
      API.setElements([shape]);
      API.setSelectedElements([shape]);
      API.executeAction(actionConvertShapeToPath);

      const path = h.elements[0];
      expect(isPathElement(path)).toBe(true);
      expect(path.id).toBe(shape.id);
      expect(path.strokeColor).toBe("#ff0000");
      expect(path.backgroundColor).toBe("#00ff00");
      expect((path as ExcalidrawPathElement).closed).toBe(true);
      expect([path.x, path.y, path.width, path.height]).toEqual([
        10, 20, 200, 100,
      ]);
    },
  );

  it("leaves shapes with bound text alone", async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
    const rect = API.createElement({
      type: "rectangle",
      boundElements: [{ id: "t", type: "text" }],
    });
    API.setElements([rect]);
    API.setSelectedElements([rect]);
    API.executeAction(actionConvertShapeToPath);
    expect(h.elements[0].type).toBe("rectangle");
  });
});

describe("path in files", () => {
  it("survives restore", () => {
    const path = API.createElement({
      type: "path",
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(50, 50)],
    }) as ExcalidrawPathElement;
    const withHandles = {
      ...path,
      handles: [
        { mode: "broken", in: null, out: [10, 0] },
        { mode: "smooth", in: [-10, 0], out: [10, 0] },
      ],
      closed: false,
    } as unknown as ExcalidrawPathElement;
    const [restored] = restoreElements([withHandles], null) as [
      ExcalidrawPathElement,
    ];
    expect(restored.type).toBe("path");
    expect(restored.handles).toEqual(withHandles.handles);
  });

  it("repairs malformed paths", () => {
    const path = API.createElement({ type: "path" }) as ExcalidrawPathElement;
    const [restored] = restoreElements(
      [
        {
          ...path,
          points: [
            [0, 0],
            ["x", 1],
            [5, 5],
          ],
          handles: [null, { mode: "weird", in: [1, 1] }, undefined],
        } as any,
      ],
      null,
    ) as [ExcalidrawPathElement];
    expect(restored.points).toHaveLength(2);
    expect(restored.handles).toHaveLength(2);
    expect(restored.handles.every((hd) => hd.mode === "corner")).toBe(true);
  });
});

describe("shape with a hole", () => {
  beforeAll(() => {
    mockBoundingClientRect({ width: 1000, height: 1000 });
  });
  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  const square = (x: number, y: number, s: number) => {
    const points = [
      pointFrom<LocalPoint>(x, y),
      pointFrom<LocalPoint>(x + s, y),
      pointFrom<LocalPoint>(x + s, y + s),
      pointFrom<LocalPoint>(x, y + s),
    ];
    return {
      points,
      handles: points.map(() => ({
        mode: "corner" as const,
        in: null,
        out: null,
      })),
    };
  };

  const setup = async () => {
    const utils = await render(<Excalidraw handleKeyboardGlobally />);
    const canvas = utils.container.querySelector("canvas.interactive")!;
    const outer = square(0, 0, 300);
    const path = API.createElement({
      type: "path",
      x: 100,
      y: 100,
      width: 300,
      height: 300,
      points: outer.points,
      backgroundColor: "#ff0000",
    });
    const shape = {
      ...path,
      handles: outer.handles,
      closed: true,
      contours: [square(100, 100, 100)],
    } as ExcalidrawPathElement;
    API.updateScene({
      elements: [shape],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    API.setSelectedElements([shape as any]);
    return { canvas };
  };

  it("a click inside the hole does not hit the shape, one on the fill does", async () => {
    await setup();
    const shape = getPath();
    const map = h.app.scene.getNonDeletedElementsMap();
    const at = (x: number, y: number) =>
      isPointInElement(pointFrom<GlobalPoint>(x, y), shape, map);
    expect(at(150, 150)).toBe(true);
    expect(at(250, 250)).toBe(false);
  });

  it("drags a point of the hole", async () => {
    const { canvas } = await setup();
    API.executeAction(actionEditPath);
    fireEvent.pointerDown(canvas, { clientX: 200, clientY: 200 });
    expect(h.state.editingPath?.loop).toBe(1);
    fireEvent.pointerMove(window, { clientX: 220, clientY: 230 });
    fireEvent.pointerUp(window, { clientX: 220, clientY: 230 });
    const shape = getPath();
    const hole = shape.contours![0].points;
    expect([shape.x + hole[0][0], shape.y + hole[0][1]]).toEqual([220, 230]);
    // the main outline did not move
    expect([shape.x, shape.y]).toEqual([100, 100]);
    expect(shape.points[0]).toEqual([0, 0]);
  });

  it("inserts and deletes a point on the hole", async () => {
    const { canvas } = await setup();
    API.executeAction(actionEditPath);
    const dbl = (x: number, y: number) => {
      fireEvent.pointerDown(canvas, {
        clientX: x,
        clientY: y,
        timeStamp: 1000,
      });
      fireEvent.pointerUp(window, { clientX: x, clientY: y });
      fireEvent.pointerDown(canvas, {
        clientX: x,
        clientY: y,
        timeStamp: 1100,
      });
      fireEvent.pointerUp(window, { clientX: x, clientY: y });
    };
    dbl(250, 200);
    expect(getPath().contours![0].points).toHaveLength(5);
    expect(getPath().points).toHaveLength(4);
    expect(h.state.editingPath?.loop).toBe(1);
    Keyboard.keyPress(KEYS.DELETE);
    expect(getPath().contours![0].points).toHaveLength(4);
  });
});

describe("path tools in the inspector", () => {
  beforeAll(() => {
    mockBoundingClientRect({ width: 1000, height: 1000 });
  });
  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("the pen and the knife are one click away", async () => {
    await render(<Excalidraw />);
    API.setAppState({ paletteOpen: true });
    fireEvent.click(screen.getByTestId("path-tool-pen"));
    expect(h.state.activeTool.type).toBe("path");
    fireEvent.click(screen.getByTestId("path-tool-knife"));
    expect(h.state.activeTool.type).toBe("knife");
  });

  it("converts a straight line into a path as drawn", async () => {
    await render(<Excalidraw />);
    API.setAppState({ paletteOpen: true });
    const line = API.createElement({
      type: "line",
      x: 50,
      y: 60,
      points: [pointFrom(0, 0), pointFrom(100, 0), pointFrom(100, 80)] as any,
    });
    API.setElements([line]);
    API.setSelectedElements([line]);
    fireEvent.click(screen.getByTestId("path-convert"));
    const path = getPath();
    expect(path.id).toBe(line.id);
    expect(path.type).toBe("path");
    expect(path.closed).toBe(false);
    const abs = path.points.map((p) => [path.x + p[0], path.y + p[1]]);
    expect(abs).toEqual([
      [50, 60],
      [150, 60],
      [150, 140],
    ]);
  });

  it("bevels all the corners of a path, and one corner while editing", async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
    API.setAppState({ paletteOpen: true });
    const pts = [
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(100, 0),
      pointFrom<LocalPoint>(100, 100),
      pointFrom<LocalPoint>(0, 100),
    ];
    const path = {
      ...API.createElement({
        type: "path",
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        points: pts,
      }),
      handles: pts.map(() => ({
        mode: "corner" as const,
        in: null,
        out: null,
      })),
      closed: true,
    } as ExcalidrawPathElement;
    API.setElements([path]);
    API.setSelectedElements([path as any]);

    const all = screen.getByTestId("path-bevel-all-value");
    fireEvent.change(all, { target: { value: "12" } });
    fireEvent.blur(all);
    expect(getPath().handles.every((hd) => hd.radius === 12)).toBe(true);
    // the anchors did not move
    expect(getPath().points).toEqual(pts);

    API.executeAction(actionEditPath);
    API.setAppState({
      editingPath: { elementId: path.id, selectedPoint: 2, loop: 0 },
    });
    const local = screen.getByTestId("path-bevel-point");
    fireEvent.change(local, { target: { value: "30" } });
    fireEvent.blur(local);
    expect(getPath().handles.map((hd) => hd.radius)).toEqual([12, 12, 30, 12]);
  });
});

describe("edges", () => {
  it("sharp and round are in the inspector", async () => {
    await render(<Excalidraw />);
    API.setAppState({ paletteOpen: true });
    const r = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    });
    API.setElements([r]);
    API.setSelectedElements([r]);
    fireEvent.click(screen.getByTestId("edges-round"));
    expect(h.elements[0].roundness).not.toBeNull();
    fireEvent.click(screen.getByTestId("edges-sharp"));
    expect(h.elements[0].roundness).toBeNull();
  });
});

describe("per-corner rounding", () => {
  beforeAll(() => {
    mockBoundingClientRect({ width: 1000, height: 1000 });
  });
  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("a rectangle takes a radius on one corner only, then any corner of the path", async () => {
    await render(<Excalidraw />);
    API.setAppState({ paletteOpen: true });
    const r = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 200,
      height: 100,
    });
    API.setElements([r]);
    API.setSelectedElements([r]);
    const tr = screen.getByTestId("corner-1");
    fireEvent.change(tr, { target: { value: "30" } });
    fireEvent.blur(tr);
    const p = getPath();
    expect(p.type).toBe("path");
    expect(p.id).toBe(r.id);
    expect(p.handles.map((hd) => hd.radius)).toEqual([
      undefined,
      30,
      undefined,
      undefined,
    ]);
    // the same path now offers its corners
    const bl = screen.getByTestId("path-corner-3");
    fireEvent.change(bl, { target: { value: "12" } });
    fireEvent.blur(bl);
    expect(getPath().handles.map((hd) => hd.radius)).toEqual([
      undefined,
      30,
      undefined,
      12,
    ]);
    // anchors and size are unchanged
    expect([
      getPath().x,
      getPath().y,
      getPath().width,
      getPath().height,
    ]).toEqual([100, 100, 200, 100]);
  });
});

describe("corner radius slider", () => {
  it("sets a parametric radius on rectangles, and 0 makes them sharp again", async () => {
    await render(<Excalidraw />);
    API.setAppState({ paletteOpen: true });
    const r = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 200,
      height: 100,
    });
    API.setElements([r]);
    API.setSelectedElements([r]);
    const pill = screen.getByTestId("corner-radius-value");
    fireEvent.change(pill, { target: { value: "24" } });
    fireEvent.blur(pill);
    expect(h.elements[0].roundness).toMatchObject({ value: 24 });
    fireEvent.change(screen.getByTestId("corner-radius-slider"), {
      target: { value: "10" },
    });
    expect(h.elements[0].roundness).toMatchObject({ value: 10 });
    fireEvent.change(screen.getByTestId("corner-radius-slider"), {
      target: { value: "0" },
    });
    expect(h.elements[0].roundness).toBeNull();
  });
});
