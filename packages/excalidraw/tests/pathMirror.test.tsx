import React from "react";

import { CaptureUpdateAction } from "@excalidraw/element";
import { pointFrom, type LocalPoint } from "@excalidraw/math";

import type { ExcalidrawPathElement } from "@excalidraw/element/types";

import { actionEditPath } from "../actions";
import { restoreElements } from "../data/restore";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
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

const getPath = () =>
  handle.elements.find(
    (element) => !element.isDeleted && element.type === "path",
  ) as ExcalidrawPathElement & { isDeleted: false };

const sceneOf = (path: ExcalidrawPathElement) =>
  path.points.map((point) => [path.x + point[0], path.y + point[1]]);

describe("mirror editing", () => {
  let canvas: Element;

  beforeAll(() => {
    mockBoundingClientRect({ width: 1000, height: 1000 });
  });
  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  // a down arrow, symmetric about x = 200 (scene)
  beforeEach(async () => {
    const utils = await render(<Excalidraw handleKeyboardGlobally />);
    canvas = utils.container.querySelector("canvas.interactive")!;
    const path = API.createElement({
      type: "path",
      x: 100,
      y: 100,
      points: [
        pointFrom<LocalPoint>(50, 0),
        pointFrom<LocalPoint>(150, 0),
        pointFrom<LocalPoint>(150, 100),
        pointFrom<LocalPoint>(200, 100),
        pointFrom<LocalPoint>(100, 200),
        pointFrom<LocalPoint>(0, 100),
        pointFrom<LocalPoint>(50, 100),
      ],
    });
    API.updateScene({
      elements: [path],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    API.setSelectedElements([path]);
    API.executeAction(actionEditPath);
  });

  const drag = (from: [number, number], to: [number, number]) => {
    fireEvent.pointerDown(canvas, { clientX: from[0], clientY: from[1] });
    fireEvent.pointerMove(window, { clientX: to[0], clientY: to[1] });
    fireEvent.pointerUp(window, { clientX: to[0], clientY: to[1] });
  };

  it("adds the line in the middle of the shape, and removes it", () => {
    expect(handle.state.editingPath?.mirror).toBeFalsy();
    fireEvent.click(screen.getByTestId("path-mirror-x"));
    expect(handle.state.editingPath?.mirror).toEqual({ axis: "x", at: 200 });
    fireEvent.click(screen.getByTestId("path-mirror-x"));
    expect(handle.state.editingPath?.mirror).toBeNull();
    fireEvent.click(screen.getByTestId("path-mirror-y"));
    expect(handle.state.editingPath?.mirror).toEqual({ axis: "y", at: 200 });
  });

  it("the sibling across the line follows a dragged point", () => {
    fireEvent.click(screen.getByTestId("path-mirror-x"));
    // the right wing tip (300, 200) pulled out and down
    drag([300, 200], [320, 230]);
    const points = sceneOf(getPath());
    expect(points[3]).toEqual([320, 230]);
    expect(points[5]).toEqual([80, 230]);
    // the line is still where it was
    expect(handle.state.editingPath?.mirror?.at).toBe(200);
  });

  it("a point on the line only slides along it", () => {
    fireEvent.click(screen.getByTestId("path-mirror-x"));
    drag([200, 300], [230, 340]);
    expect(sceneOf(getPath())[4]).toEqual([200, 340]);
  });

  it("the line stays put while the path's bounds change under it", () => {
    fireEvent.click(screen.getByTestId("path-mirror-x"));
    drag([300, 200], [400, 230]);
    expect(handle.state.editingPath?.mirror?.at).toBe(200);
    // the wing keeps following across the unchanged line
    expect(sceneOf(getPath())[5]).toEqual([0, 230]);
    drag([400, 230], [380, 250]);
    expect(sceneOf(getPath())[5]).toEqual([20, 250]);
  });

  it("the line is saved with the path and comes back on the next edit", () => {
    fireEvent.click(screen.getByTestId("path-mirror-x"));
    drag([200, 250], [210, 250]);
    expect(getPath().customData?.pathMirror).toEqual({
      axis: "x",
      position: 0.55,
    });
    // leaving the editor hides the line, the path keeps it
    fireEvent.click(screen.getByTestId("path-editor-done"));
    expect(handle.state.editingPath).toBeNull();
    // it survives a save and a reload
    const reloaded = restoreElements(
      [getPath()],
      null,
    )[0] as ExcalidrawPathElement;
    expect(reloaded.customData?.pathMirror).toEqual({
      axis: "x",
      position: 0.55,
    });
    API.setSelectedElements([getPath()]);
    API.executeAction(actionEditPath);
    expect(handle.state.editingPath?.mirror).toEqual({ axis: "x", at: 210 });
  });

  it("the saved line follows the path when it is moved or resized", () => {
    fireEvent.click(screen.getByTestId("path-mirror-x"));
    fireEvent.click(screen.getByTestId("path-editor-done"));
    const path = getPath();
    act(() => handle.app.scene.mutateElement(path, { x: path.x + 50 }));
    API.setSelectedElements([getPath()]);
    API.executeAction(actionEditPath);
    expect(handle.state.editingPath?.mirror).toEqual({ axis: "x", at: 250 });
  });

  it("removing the line removes it from the file too", () => {
    fireEvent.click(screen.getByTestId("path-mirror-x"));
    expect(getPath().customData?.pathMirror).toBeDefined();
    fireEvent.click(screen.getByTestId("path-mirror-x"));
    expect(getPath().customData?.pathMirror).toBeUndefined();
  });

  it("without the line, points move alone", () => {
    drag([300, 200], [320, 230]);
    expect(sceneOf(getPath())[5]).toEqual([100, 200]);
  });

  it("the line itself can be dragged to a new place", () => {
    fireEvent.click(screen.getByTestId("path-mirror-x"));
    drag([200, 250], [210, 250]);
    expect(handle.state.editingPath?.mirror?.at).toBe(210);
    // the path did not change
    expect(sceneOf(getPath())[3]).toEqual([300, 200]);
  });

  it("handles are mirrored too", () => {
    act(() => handle.app.path.setPointMode("smooth", 3));
    fireEvent.click(screen.getByTestId("path-mirror-x"));
    const before = getPath().handles[3];
    const out = before.out!;
    const tip = [300 + out[0], 200 + out[1]] as [number, number];
    // select the point, then drag its outgoing handle
    fireEvent.pointerDown(canvas, { clientX: 300, clientY: 200 });
    fireEvent.pointerUp(window, { clientX: 300, clientY: 200 });
    drag(tip, [tip[0] + 10, tip[1] + 20]);
    const handles = getPath().handles;
    expect(handles[5].in![0]).toBeCloseTo(-handles[3].out![0], 5);
    expect(handles[5].in![1]).toBeCloseTo(handles[3].out![1], 5);
  });
});
