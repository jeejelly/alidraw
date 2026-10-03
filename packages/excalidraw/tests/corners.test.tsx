import React from "react";

import { KEYS, ROUNDNESS } from "@excalidraw/common";

import { actionConvertShapeToPath } from "../actions";
import { getCornerHandles, radiusAt } from "../corners";
import { Excalidraw } from "../index";

import { resetTestState } from "./helpers/fixtures";
import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import {
  act,
  fireEvent,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  screen,
  unmountComponent,
} from "./test-utils";

unmountComponent();

const handle = window.h;

beforeEach(resetTestState);

const rect = (extra: { roundness?: { type: number; value?: number } } = {}) => {
  const { roundness, ...rest } = extra;
  const el = API.createElement({
    type: "rectangle",
    x: 100,
    y: 100,
    width: 200,
    height: 100,
    ...rest,
  } as any);
  // the test helper keeps only the kind of rounding, not its radius
  return roundness ? ({ ...el, roundness } as typeof el) : el;
};

describe("live corners geometry", () => {
  it("a rectangle has four corners, the grab point on the bisector", async () => {
    await render(<Excalidraw />);
    const rectangle = rect({
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS, value: 20 },
    });
    API.setElements([rectangle]);
    const hs = getCornerHandles(
      rectangle,
      handle.app.scene.getNonDeletedElementsMap(),
    );
    expect(hs).toHaveLength(4);
    const tl = hs.find((corner) => corner.index === 0)!;
    expect(tl.corner).toEqual({ x: 100, y: 100 });
    expect(tl.radius).toBe(20);
    // the centre of the rounding circle is r from both sides
    expect(tl.center.x).toBeCloseTo(120);
    expect(tl.center.y).toBeCloseTo(120);
    // dragging to that point asks for the same radius back
    expect(radiusAt(tl, tl.center)).toBeCloseTo(20);
    // never past what the sides allow
    expect(radiusAt(tl, { x: 400, y: 400 })).toBeCloseTo(tl.maxRadius);
  });

  it("skips curved corners", async () => {
    await render(<Excalidraw />);
    const element = API.createElement({
      type: "ellipse",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    API.setElements([element]);
    expect(
      getCornerHandles(element, handle.app.scene.getNonDeletedElementsMap()),
    ).toHaveLength(0);
  });
});

describe("live corners in the editor", () => {
  beforeAll(() => {
    mockBoundingClientRect({ width: 1000, height: 1000 });
  });
  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  const setup = async () => {
    const utils = await render(<Excalidraw handleKeyboardGlobally />);
    API.setAppState({ paletteOpen: true });
    const rectangle = rect();
    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);
    return {
      canvas: utils.container.querySelector("canvas.interactive")!,
      id: rectangle.id,
    };
  };

  it("the palette button and Shift+B toggle the mode, Escape leaves it", async () => {
    await setup();
    fireEvent.click(screen.getByTestId("corner-mode"));
    expect(handle.state.cornerMode).toBe(true);
    Keyboard.keyPress(KEYS.ESCAPE);
    expect(handle.state.cornerMode).toBe(false);
    Keyboard.withModifierKeys({ shift: true }, () => {
      Keyboard.codePress("KeyB");
    });
    expect(handle.state.cornerMode).toBe(true);
  });

  it("dragging a corner's circle rounds that corner only, and turns the shape into a path", async () => {
    const { canvas, id } = await setup();
    act(() => handle.app.corners.toggle());
    // the grab point of the top-left corner, 14px along the diagonal
    const grab = 14 / Math.SQRT2;
    fireEvent.pointerDown(canvas, { clientX: 100 + grab, clientY: 100 + grab });
    fireEvent.pointerMove(window, { clientX: 130, clientY: 130 });
    fireEvent.pointerUp(window, { clientX: 130, clientY: 130 });
    const path = handle.elements.find((element) => element.id === id) as any;
    expect(path.type).toBe("path");
    expect(path.handles[0].radius).toBe(30);
    expect(path.handles.slice(1).every((hd: any) => !hd.radius)).toBe(true);
    // anchors stayed where the corners were
    expect([path.x + path.points[0][0], path.y + path.points[0][1]]).toEqual([
      100, 100,
    ]);
  });

  it("Shift rounds every corner alike", async () => {
    const { canvas, id } = await setup();
    act(() => handle.app.corners.toggle());
    const grab = 14 / Math.SQRT2;
    fireEvent.pointerDown(canvas, {
      clientX: 100 + grab,
      clientY: 100 + grab,
      shiftKey: true,
    });
    fireEvent.pointerMove(window, {
      clientX: 120,
      clientY: 120,
      shiftKey: true,
    });
    fireEvent.pointerUp(window, { clientX: 120, clientY: 120 });
    const path = handle.elements.find((element) => element.id === id) as any;
    expect(path.handles.map((hd: any) => hd.radius)).toEqual([20, 20, 20, 20]);
  });

  it("converting a rounded rectangle to a path keeps its rounding", async () => {
    await render(<Excalidraw />);
    const rectangle = rect({
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS, value: 16 },
    });
    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);
    API.executeAction(actionConvertShapeToPath);
    const path = handle.elements[0] as any;
    expect(path.type).toBe("path");
    expect(path.handles.every((hd: any) => hd.radius === 16)).toBe(true);
  });
});
