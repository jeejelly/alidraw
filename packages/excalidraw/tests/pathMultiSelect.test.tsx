import React from "react";

import { KEYS } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";
import { pointFrom, type LocalPoint } from "@excalidraw/math";

import type { ExcalidrawPathElement } from "@excalidraw/element/types";

import { actionEditPath } from "../actions";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import {
  act,
  fireEvent,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  unmountComponent,
} from "./test-utils";

unmountComponent();

const handle = window.h;

const getPath = () =>
  handle.elements.find(
    (element) => !element.isDeleted && element.type === "path",
  ) as ExcalidrawPathElement;

const sceneOf = (path: ExcalidrawPathElement) =>
  path.points.map((point) => [path.x + point[0], path.y + point[1]]);

describe("selecting several path points", () => {
  let canvas: Element;

  beforeAll(() => {
    mockBoundingClientRect({ width: 1000, height: 1000 });
  });
  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  // a square at (100,100)-(300,300), one point per corner
  beforeEach(async () => {
    const utils = await render(<Excalidraw handleKeyboardGlobally />);
    canvas = utils.container.querySelector("canvas.interactive")!;
    const path = API.createElement({
      type: "path",
      x: 100,
      y: 100,
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(200, 0),
        pointFrom<LocalPoint>(200, 200),
        pointFrom<LocalPoint>(0, 200),
      ],
    });
    API.updateScene({
      elements: [path],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    API.setSelectedElements([path]);
    API.executeAction(actionEditPath);
  });

  const press = (x: number, y: number, shiftKey = false) => {
    fireEvent.pointerDown(canvas, { clientX: x, clientY: y, shiftKey });
    fireEvent.pointerUp(window, { clientX: x, clientY: y, shiftKey });
  };

  it("shift-click adds and removes points from the selection", () => {
    press(100, 100);
    press(300, 100, true);
    expect(handle.state.editingPath?.selectedPoints).toEqual([0, 1]);
    press(100, 100, true);
    expect(handle.state.editingPath?.selectedPoints).toEqual([1]);
  });

  it("dragging one selected point moves them all", () => {
    press(100, 100);
    press(300, 100, true);
    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 120, clientY: 130 });
    fireEvent.pointerUp(window, { clientX: 120, clientY: 130 });
    expect(sceneOf(getPath())).toEqual([
      [120, 130],
      [320, 130],
      [300, 300],
      [100, 300],
    ]);
    expect(handle.state.editingPath?.selectedPoints).toEqual([0, 1]);
  });

  it("a plain press on an unselected point selects only it", () => {
    press(100, 100);
    press(300, 100, true);
    press(300, 300);
    expect(handle.state.editingPath?.selectedPoints).toBeUndefined();
    expect(handle.state.editingPath?.selectedPoint).toBe(2);
  });

  it("shift-dragging on empty space selects the points inside the box", () => {
    fireEvent.pointerDown(canvas, { clientX: 50, clientY: 50, shiftKey: true });
    fireEvent.pointerMove(window, {
      clientX: 350,
      clientY: 150,
      shiftKey: true,
    });
    expect(handle.state.editingPath?.marquee).not.toBeNull();
    fireEvent.pointerUp(window, { clientX: 350, clientY: 150, shiftKey: true });
    expect(handle.state.editingPath?.marquee).toBeNull();
    expect(handle.state.editingPath?.selectedPoints).toEqual([0, 1]);
  });

  it("Ctrl+A selects every point", () => {
    press(100, 100);
    Keyboard.withModifierKeys({ ctrl: true }, () => Keyboard.keyPress("a"));
    expect(handle.state.editingPath?.selectedPoints).toEqual([0, 1, 2, 3]);
  });

  it("Delete removes the selected points together", () => {
    press(300, 100);
    press(300, 300, true);
    // a closed shape keeps three points; this one is open, two remain
    Keyboard.keyPress(KEYS.DELETE);
    expect(getPath().points).toHaveLength(2);
    expect(sceneOf(getPath())).toEqual([
      [100, 100],
      [100, 300],
    ]);
  });

  it("a point mode applies to all selected points", () => {
    press(100, 100);
    press(300, 100, true);
    act(() => handle.app.path.setPointMode("smooth"));
    expect(getPath().handles.map((handles) => handles.mode)).toEqual([
      "smooth",
      "smooth",
      "corner",
      "corner",
    ]);
  });
});
