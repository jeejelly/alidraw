import React from "react";

import { getGridPoint } from "@excalidraw/common";

import { getAnchor } from "../anchors";
import { actionFitToGrid } from "../actions";

import { Excalidraw } from "../index";

import { resetTestState } from "./helpers/fixtures";
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

beforeEach(resetTestState);

const move = (id: string, patch: { x?: number; y?: number; width?: number }) =>
  act(() => {
    const el = handle.app.scene.getNonDeletedElement(id)!;
    handle.app.scene.mutateElement(el, patch);
  });

const get = (id: string) =>
  handle.elements.find((element) => element.id === id)!;

describe("anchors between elements", () => {
  const setup = async () => {
    await render(<Excalidraw />);
    const first = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    });
    const second = API.createElement({
      type: "rectangle",
      x: 200,
      y: 300,
      width: 40,
      height: 40,
    });
    API.setElements([first, second]);
    return { first, second };
  };

  it("the follower keeps its gap when the target moves", async () => {
    const { first, second } = await setup();
    // the follower's top-left hangs off the target's top-right, with the gap it has now
    act(() => {
      handle.app.anchors.setElementAnchor(second.id, first.id, "tr", "tl");
    });
    expect(getAnchor(get(second.id))).toMatchObject({
      to: first.id,
      dx: 100,
      dy: 300,
    });

    move(first.id, { x: 50, y: 20 });
    expect([get(second.id).x, get(second.id).y]).toEqual([250, 320]);
    move(first.id, { width: 160 });
    // the target's right edge moved: the follower with it
    expect(get(second.id).x).toBe(50 + 160 + 100);
  });

  it("snapping puts the point exactly on the anchor, gap zero", async () => {
    const { first, second } = await setup();
    act(() => {
      handle.app.anchors.setElementAnchor(
        second.id,
        first.id,
        "br",
        "tl",
        true,
      );
    });
    expect([get(second.id).x, get(second.id).y]).toEqual([100, 50]);
    move(first.id, { x: 10 });
    expect(get(second.id).x).toBe(110);
  });

  it("moving the follower on purpose changes the gap, not the anchor", async () => {
    const { first, second } = await setup();
    act(() => {
      handle.app.anchors.setElementAnchor(second.id, first.id, "tr", "tl");
    });
    move(second.id, { x: 260, y: 310 });
    expect(getAnchor(get(second.id))).toMatchObject({ dx: 160, dy: 310 });
    move(first.id, { x: 10 });
    expect(get(second.id).x).toBe(270);
  });

  it("chains follow end to end, and a loop is refused", async () => {
    await render(<Excalidraw />);
    const first = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
    const second = API.createElement({
      type: "rectangle",
      x: 100,
      y: 0,
      width: 10,
      height: 10,
    });
    const third = API.createElement({
      type: "rectangle",
      x: 200,
      y: 0,
      width: 10,
      height: 10,
    });
    API.setElements([first, second, third]);
    act(() => {
      handle.app.anchors.setElementAnchor(second.id, first.id, "tl", "tl");
      handle.app.anchors.setElementAnchor(third.id, second.id, "tl", "tl");
    });
    move(first.id, { x: 40 });
    expect([get(second.id).x, get(third.id).x]).toEqual([140, 240]);
    let ok = true;
    act(() => {
      ok = handle.app.anchors.setElementAnchor(first.id, third.id, "tl", "tl");
    });
    expect(ok).toBe(false);
    expect(getAnchor(get(first.id))).toBeNull();
  });

  it("releasing frees the element", async () => {
    const { first, second } = await setup();
    act(() => {
      handle.app.anchors.setElementAnchor(second.id, first.id, "tr", "tl");
      handle.app.anchors.release(second.id);
    });
    expect(getAnchor(get(second.id))).toBeNull();
    move(first.id, { x: 500 });
    expect(get(second.id).x).toBe(200);
  });

  it("an anchor to a deleted element is ignored", async () => {
    const { first, second } = await setup();
    act(() => {
      handle.app.anchors.setElementAnchor(second.id, first.id, "tr", "tl");
    });
    act(() => {
      handle.app.scene.mutateElement(
        handle.app.scene.getNonDeletedElement(first.id)!,
        {
          isDeleted: true,
        } as any,
      );
    });
    expect(get(second.id).x).toBe(200);
  });
});

describe("pinning to a guide", () => {
  it("an edge follows the guide, offset included", async () => {
    await render(<Excalidraw />);
    const first = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 40,
      height: 20,
    });
    API.setElements([first]);
    API.setAppState({ guides: [{ id: "g", axis: "x", position: 100 }] });
    act(() => {
      handle.app.anchors.setGuideAnchor(first.id, "g", "end", true);
    });
    expect(get(first.id).x).toBe(60); // right edge on the guide
    API.setAppState({ guides: [{ id: "g", axis: "x", position: 300 }] });
    expect(get(first.id).x).toBe(260);
    act(() => handle.app.anchors.setGap(first.id, { offset: -10 }));
    expect(get(first.id).x).toBe(250);
  });
});

describe("fit to grid", () => {
  it("rounds a shape's edges to the grid and never makes it smaller than a cell", async () => {
    await render(<Excalidraw />);
    const first = API.createElement({
      type: "rectangle",
      x: 13,
      y: 27,
      width: 75,
      height: 34,
    });
    const tiny = API.createElement({
      type: "rectangle",
      x: 105,
      y: 105,
      width: 3,
      height: 2,
    });
    API.setElements([first, tiny]);
    API.setAppState({ gridSize: 20 });
    API.setSelectedElements([first, tiny]);
    API.executeAction(actionFitToGrid);
    expect([
      get(first.id).x,
      get(first.id).y,
      get(first.id).width,
      get(first.id).height,
    ]).toEqual([20, 20, 60, 40]);
    expect(get(tiny.id).width).toBe(20);
    expect(get(tiny.id).height).toBe(20);
  });

  it("text and rotated shapes only move", async () => {
    await render(<Excalidraw />);
    const rectangle = API.createElement({
      type: "rectangle",
      x: 13,
      y: 27,
      width: 75,
      height: 34,
      angle: 0.5 as any,
    });
    API.setElements([rectangle]);
    API.setAppState({ gridSize: 20 });
    API.setSelectedElements([rectangle]);
    API.executeAction(actionFitToGrid);
    expect([get(rectangle.id).width, get(rectangle.id).height]).toEqual([
      75, 34,
    ]);
  });
});

describe("layout controls in the inspector", () => {
  beforeAll(() => {
    mockBoundingClientRect({ width: 1000, height: 1000 });
  });
  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  const open = async () => {
    await render(<Excalidraw />);
    API.setAppState({ paletteOpen: true });
  };

  it("sets the grid spacing and subdivisions", async () => {
    await open();
    const spacing = screen.getByTestId("grid-spacing");
    fireEvent.change(spacing, { target: { value: "8" } });
    fireEvent.blur(spacing);
    expect(handle.state.gridSize).toBe(8);
    const sub = screen.getByTestId("grid-subdivisions");
    fireEvent.change(sub, { target: { value: "4" } });
    fireEvent.blur(sub);
    expect(handle.state.gridStep).toBe(4);
    fireEvent.click(screen.getByTestId("grid-toggle"));
    expect(handle.state.gridModeEnabled).toBe(true);
  });

  it("moves the grid origin, and fit to grid counts from it", async () => {
    await open();
    const rectangle = API.createElement({
      type: "rectangle",
      x: 13,
      y: 27,
      width: 75,
      height: 34,
    });
    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);
    API.setAppState({ gridSize: 20 });
    fireEvent.click(screen.getByTestId("grid-origin-selection"));
    expect(handle.state.gridOrigin).toEqual({ x: 13, y: 27 });
    // already on the shifted grid: nothing moves
    API.executeAction(actionFitToGrid);
    expect([get(rectangle.id).x, get(rectangle.id).y]).toEqual([13, 27]);
    expect([get(rectangle.id).width, get(rectangle.id).height]).toEqual([
      80, 40,
    ]);
    // magnet points follow the origin too
    expect(getGridPoint(34, 49, 20 as any)).toEqual([33, 47]);
    fireEvent.click(screen.getByTestId("grid-origin-reset"));
    expect(handle.state.gridOrigin).toEqual({ x: 0, y: 0 });
    expect(getGridPoint(34, 49, 20 as any)).toEqual([40, 40]);
  });

  it("anchors the selection to the next element clicked", async () => {
    await open();
    const first = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 100,
      height: 60,
    });
    const second = API.createElement({
      type: "rectangle",
      x: 400,
      y: 400,
      width: 40,
      height: 40,
    });
    API.setElements([first, second]);
    API.setSelectedElements([second]);
    fireEvent.click(screen.getByTestId("anchor-from-br"));
    fireEvent.click(screen.getByTestId("anchor-at-tl"));
    fireEvent.click(screen.getByTestId("anchor-pick"));
    expect(handle.state.anchorPick).toMatchObject({
      sourceId: second.id,
      from: "br",
      at: "tl",
    });

    const canvas = document.querySelector("canvas.interactive")!;
    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 130 });
    fireEvent.pointerUp(window, { clientX: 100, clientY: 130 });
    expect(handle.state.anchorPick).toBeNull();
    expect(getAnchor(get(second.id))).toMatchObject({
      to: first.id,
      from: "br",
      at: "tl",
    });
    expect(screen.getByTestId("anchor-summary")).toBeTruthy();

    // typing a gap moves the follower
    const dx = screen.getByTestId("anchor-dx");
    fireEvent.change(dx, { target: { value: "16" } });
    fireEvent.blur(dx);
    expect(get(second.id).x).toBe(100 + 100 + 16);
    fireEvent.click(screen.getByTestId("anchor-release"));
    expect(getAnchor(get(second.id))).toBeNull();
  });

  it("align buttons need a selection of two (three to distribute)", async () => {
    await open();
    const first = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
    const second = API.createElement({
      type: "rectangle",
      x: 50,
      y: 30,
      width: 10,
      height: 10,
    });
    API.setElements([first, second]);
    API.setSelectedElements([first]);
    expect(
      (screen.getByTestId("align-alignLeft") as HTMLButtonElement).disabled,
    ).toBe(true);
    API.setSelectedElements([first, second]);
    const left = screen.getByTestId("align-alignLeft") as HTMLButtonElement;
    expect(left.disabled).toBe(false);
    fireEvent.click(left);
    expect(get(second.id).x).toBe(0);
    expect(
      (screen.getByTestId("align-distributeHorizontally") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
