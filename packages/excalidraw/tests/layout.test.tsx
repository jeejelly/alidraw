import React from "react";

import { reseed } from "@excalidraw/common";

import { getAnchor } from "../anchors";
import { actionFitToGrid } from "../actions";
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

const { h } = window;

beforeEach(() => {
  localStorage.clear();
  reseed(7);
});

const move = (id: string, patch: { x?: number; y?: number; width?: number }) =>
  act(() => {
    const el = h.app.scene.getNonDeletedElement(id)!;
    h.app.scene.mutateElement(el, patch);
  });

const get = (id: string) => h.elements.find((e) => e.id === id)!;

describe("anchors between elements", () => {
  const setup = async () => {
    await render(<Excalidraw />);
    const a = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    });
    const b = API.createElement({
      type: "rectangle",
      x: 200,
      y: 300,
      width: 40,
      height: 40,
    });
    API.setElements([a, b]);
    return { a, b };
  };

  it("the follower keeps its gap when the target moves", async () => {
    const { a, b } = await setup();
    // b's top-left hangs off a's top-right, with the gap it has now
    act(() => {
      h.app.anchors.setElementAnchor(b.id, a.id, "tr", "tl");
    });
    expect(getAnchor(get(b.id))).toMatchObject({ to: a.id, dx: 100, dy: 300 });

    move(a.id, { x: 50, y: 20 });
    expect([get(b.id).x, get(b.id).y]).toEqual([250, 320]);
    move(a.id, { width: 160 });
    // the target's right edge moved: the follower with it
    expect(get(b.id).x).toBe(50 + 160 + 100);
  });

  it("snapping puts the point exactly on the anchor, gap zero", async () => {
    const { a, b } = await setup();
    act(() => {
      h.app.anchors.setElementAnchor(b.id, a.id, "br", "tl", true);
    });
    expect([get(b.id).x, get(b.id).y]).toEqual([100, 50]);
    move(a.id, { x: 10 });
    expect(get(b.id).x).toBe(110);
  });

  it("moving the follower on purpose changes the gap, not the anchor", async () => {
    const { a, b } = await setup();
    act(() => {
      h.app.anchors.setElementAnchor(b.id, a.id, "tr", "tl");
    });
    move(b.id, { x: 260, y: 310 });
    expect(getAnchor(get(b.id))).toMatchObject({ dx: 160, dy: 310 });
    move(a.id, { x: 10 });
    expect(get(b.id).x).toBe(270);
  });

  it("chains follow end to end, and a loop is refused", async () => {
    await render(<Excalidraw />);
    const a = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
    const b = API.createElement({
      type: "rectangle",
      x: 100,
      y: 0,
      width: 10,
      height: 10,
    });
    const c = API.createElement({
      type: "rectangle",
      x: 200,
      y: 0,
      width: 10,
      height: 10,
    });
    API.setElements([a, b, c]);
    act(() => {
      h.app.anchors.setElementAnchor(b.id, a.id, "tl", "tl");
      h.app.anchors.setElementAnchor(c.id, b.id, "tl", "tl");
    });
    move(a.id, { x: 40 });
    expect([get(b.id).x, get(c.id).x]).toEqual([140, 240]);
    let ok = true;
    act(() => {
      ok = h.app.anchors.setElementAnchor(a.id, c.id, "tl", "tl");
    });
    expect(ok).toBe(false);
    expect(getAnchor(get(a.id))).toBeNull();
  });

  it("releasing frees the element", async () => {
    const { a, b } = await setup();
    act(() => {
      h.app.anchors.setElementAnchor(b.id, a.id, "tr", "tl");
      h.app.anchors.release(b.id);
    });
    expect(getAnchor(get(b.id))).toBeNull();
    move(a.id, { x: 500 });
    expect(get(b.id).x).toBe(200);
  });

  it("an anchor to a deleted element is ignored", async () => {
    const { a, b } = await setup();
    act(() => {
      h.app.anchors.setElementAnchor(b.id, a.id, "tr", "tl");
    });
    act(() => {
      h.app.scene.mutateElement(h.app.scene.getNonDeletedElement(a.id)!, {
        isDeleted: true,
      } as any);
    });
    expect(get(b.id).x).toBe(200);
  });
});

describe("pinning to a guide", () => {
  it("an edge follows the guide, offset included", async () => {
    await render(<Excalidraw />);
    const a = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 40,
      height: 20,
    });
    API.setElements([a]);
    API.setAppState({ guides: [{ id: "g", axis: "x", position: 100 }] });
    act(() => {
      h.app.anchors.setGuideAnchor(a.id, "g", "end", true);
    });
    expect(get(a.id).x).toBe(60); // right edge on the guide
    API.setAppState({ guides: [{ id: "g", axis: "x", position: 300 }] });
    expect(get(a.id).x).toBe(260);
    act(() => h.app.anchors.setGap(a.id, { offset: -10 }));
    expect(get(a.id).x).toBe(250);
  });
});

describe("fit to grid", () => {
  it("rounds a shape's edges to the grid and never makes it smaller than a cell", async () => {
    await render(<Excalidraw />);
    const a = API.createElement({
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
    API.setElements([a, tiny]);
    API.setAppState({ gridSize: 20 });
    API.setSelectedElements([a, tiny]);
    API.executeAction(actionFitToGrid);
    expect([
      get(a.id).x,
      get(a.id).y,
      get(a.id).width,
      get(a.id).height,
    ]).toEqual([20, 20, 60, 40]);
    expect(get(tiny.id).width).toBe(20);
    expect(get(tiny.id).height).toBe(20);
  });

  it("text and rotated shapes only move", async () => {
    await render(<Excalidraw />);
    const r = API.createElement({
      type: "rectangle",
      x: 13,
      y: 27,
      width: 75,
      height: 34,
      angle: 0.5 as any,
    });
    API.setElements([r]);
    API.setAppState({ gridSize: 20 });
    API.setSelectedElements([r]);
    API.executeAction(actionFitToGrid);
    expect([get(r.id).width, get(r.id).height]).toEqual([75, 34]);
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
    expect(h.state.gridSize).toBe(8);
    const sub = screen.getByTestId("grid-subdivisions");
    fireEvent.change(sub, { target: { value: "4" } });
    fireEvent.blur(sub);
    expect(h.state.gridStep).toBe(4);
    fireEvent.click(screen.getByTestId("grid-toggle"));
    expect(h.state.gridModeEnabled).toBe(true);
  });

  it("anchors the selection to the next element clicked", async () => {
    await open();
    const a = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 100,
      height: 60,
    });
    const b = API.createElement({
      type: "rectangle",
      x: 400,
      y: 400,
      width: 40,
      height: 40,
    });
    API.setElements([a, b]);
    API.setSelectedElements([b]);
    fireEvent.click(screen.getByTestId("anchor-from-br"));
    fireEvent.click(screen.getByTestId("anchor-at-tl"));
    fireEvent.click(screen.getByTestId("anchor-pick"));
    expect(h.state.anchorPick).toMatchObject({
      sourceId: b.id,
      from: "br",
      at: "tl",
    });

    const canvas = document.querySelector("canvas.interactive")!;
    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 130 });
    fireEvent.pointerUp(window, { clientX: 100, clientY: 130 });
    expect(h.state.anchorPick).toBeNull();
    expect(getAnchor(get(b.id))).toMatchObject({
      to: a.id,
      from: "br",
      at: "tl",
    });
    expect(screen.getByTestId("anchor-summary")).toBeTruthy();

    // typing a gap moves the follower
    const dx = screen.getByTestId("anchor-dx");
    fireEvent.change(dx, { target: { value: "16" } });
    fireEvent.blur(dx);
    expect(get(b.id).x).toBe(100 + 100 + 16);
    fireEvent.click(screen.getByTestId("anchor-release"));
    expect(getAnchor(get(b.id))).toBeNull();
  });

  it("align buttons need a selection of two (three to distribute)", async () => {
    await open();
    const a = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
    const b = API.createElement({
      type: "rectangle",
      x: 50,
      y: 30,
      width: 10,
      height: 10,
    });
    API.setElements([a, b]);
    API.setSelectedElements([a]);
    expect(
      (screen.getByTestId("align-alignLeft") as HTMLButtonElement).disabled,
    ).toBe(true);
    API.setSelectedElements([a, b]);
    const left = screen.getByTestId("align-alignLeft") as HTMLButtonElement;
    expect(left.disabled).toBe(false);
    fireEvent.click(left);
    expect(get(b.id).x).toBe(0);
    expect(
      (screen.getByTestId("align-distributeHorizontally") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
