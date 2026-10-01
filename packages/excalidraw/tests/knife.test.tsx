import React from "react";

import { reseed } from "@excalidraw/common";

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
  waitFor,
} from "./test-utils";

unmountComponent();

const { h } = window;

beforeEach(() => {
  localStorage.clear();
  reseed(7);
});

describe("knife tool", () => {
  beforeAll(() => {
    mockBoundingClientRect({ width: 1000, height: 1000 });
  });
  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  const setup = async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
    const rect = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 200,
      height: 100,
      backgroundColor: "#ff0000",
    });
    API.setElements([rect]);
    act(() => h.app.setActiveTool({ type: "knife" }));
    return {
      id: rect.id,
      canvas: document.querySelector("canvas.interactive")!,
    };
  };

  const live = () => h.elements.filter((e) => !e.isDeleted);

  it("cuts a shape along the dragged line into two pieces", async () => {
    const { canvas, id } = await setup();
    fireEvent.pointerDown(canvas, { clientX: 200, clientY: 50 });
    fireEvent.pointerMove(window, { clientX: 200, clientY: 250 });
    fireEvent.pointerUp(window, { clientX: 200, clientY: 250 });
    await waitFor(() => expect(live()).toHaveLength(2));
    const pieces = live() as any[];
    expect(pieces.every((p) => p.type === "path" && p.closed)).toBe(true);
    expect(pieces.every((p) => p.backgroundColor === "#ff0000")).toBe(true);
    expect(h.elements.find((e) => e.id === id)!.isDeleted).toBe(true);
    const widths = pieces.map((p) => Math.round(p.width)).sort();
    expect(widths).toEqual([100, 100]);
    // back to the selection tool, the pieces selected
    expect(h.state.activeTool.type).toBe("selection");
    expect(Object.keys(h.state.selectedElementIds)).toHaveLength(2);
  });

  it("a held number key locks the line's angle, and the helper lights it", async () => {
    const { canvas } = await setup();
    fireEvent.pointerDown(canvas, { clientX: 200, clientY: 100 });
    expect(screen.getByTestId("angle-helper")).toBeTruthy();
    fireEvent.keyDown(window, { key: "6" });
    // pointer drifts roughly rightwards; the key makes it 60 degrees
    fireEvent.pointerMove(window, { clientX: 400, clientY: 120 });
    const knife = h.state.knife!;
    // counter-clockwise from the right: the line rises to the right
    const angle =
      (Math.atan2(-(knife.to.y - knife.from.y), knife.to.x - knife.from.x) *
        180) /
      Math.PI;
    expect(Math.round(angle)).toBe(60);
    expect(knife.label).toContain("60");
    expect(screen.getByTestId("angle-key-6").getAttribute("aria-current")).toBe(
      "true",
    );
    fireEvent.keyUp(window, { key: "6" });
    fireEvent.pointerUp(window, { clientX: 400, clientY: 120 });
    expect(h.state.knife).toBeNull();
    expect(h.state.angleHelper).toBeNull();
  });

  it("the magnet catches 45 degrees, Alt leaves the line free, Escape cancels", async () => {
    const { canvas } = await setup();
    fireEvent.pointerDown(canvas, { clientX: 200, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 300, clientY: 201 });
    const k = h.state.knife!;
    expect(
      Math.abs(
        Math.round(
          (Math.atan2(k.to.y - k.from.y, k.to.x - k.from.x) * 180) / Math.PI,
        ),
      ),
    ).toBe(45);
    fireEvent.pointerMove(window, { clientX: 300, clientY: 201, altKey: true });
    const free = h.state.knife!;
    expect(free.to.y - free.from.y).toBeCloseTo(101, 3);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(h.state.knife).toBeNull();
    expect(live()).toHaveLength(1);
  });

  it("a stray click or a line that misses cuts nothing", async () => {
    const { canvas } = await setup();
    fireEvent.pointerDown(canvas, { clientX: 700, clientY: 700 });
    fireEvent.pointerUp(window, { clientX: 701, clientY: 701 });
    fireEvent.pointerDown(canvas, { clientX: 600, clientY: 50 });
    fireEvent.pointerMove(window, { clientX: 600, clientY: 250 });
    fireEvent.pointerUp(window, { clientX: 600, clientY: 250 });
    await new Promise((r) => setTimeout(r, 60));
    expect(live()).toHaveLength(1);
    expect(live()[0].type).toBe("rectangle");
  });

  it("with a selection, only the selected shapes are cut", async () => {
    await render(<Excalidraw />);
    const a = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 200,
      height: 100,
    });
    const b = API.createElement({
      type: "rectangle",
      x: 100,
      y: 300,
      width: 200,
      height: 100,
    });
    API.setElements([a, b]);
    API.setSelectedElements([a]);
    act(() => h.app.setActiveTool({ type: "knife" }, { keepSelection: true }));
    const canvas = document.querySelector("canvas.interactive")!;
    fireEvent.pointerDown(canvas, { clientX: 200, clientY: 50 });
    fireEvent.pointerMove(window, { clientX: 200, clientY: 450 });
    fireEvent.pointerUp(window, { clientX: 200, clientY: 450 });
    await waitFor(() => expect(live()).toHaveLength(3));
    expect(live().filter((e) => e.type === "rectangle")).toHaveLength(1);
  });
});

describe("rotation uses the same angle keys", () => {
  beforeAll(() => {
    mockBoundingClientRect({ width: 1000, height: 1000 });
  });
  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("holding 4 while rotating sets 45 degrees (and the helper shows)", async () => {
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
    const canvas = document.querySelector("canvas.interactive")!;
    fireEvent.pointerDown(canvas, { clientX: 325, clientY: 225 });
    expect(screen.getByTestId("angle-helper")).toBeTruthy();
    fireEvent.keyDown(window, { key: "4" });
    fireEvent.pointerMove(window, { clientX: 230, clientY: 290 });
    const deg = (h.elements[0].angle * 180) / Math.PI;
    // 45 plus a quarter-turn multiple: a rectangle looks the same
    expect(Math.round(deg) % 90).toBe(45);
    fireEvent.keyUp(window, { key: "4" });
    fireEvent.pointerUp(window, { clientX: 230, clientY: 290 });
    expect(h.state.angleHelper).toBeNull();
  });

  it("without a key the magnet catches 60 degrees", async () => {
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
    const canvas = document.querySelector("canvas.interactive")!;
    fireEvent.pointerDown(canvas, { clientX: 325, clientY: 225 });
    const start = Math.atan2(75, 125);
    const target = start + (61 * Math.PI) / 180;
    fireEvent.pointerMove(window, {
      clientX: 200 + 200 * Math.cos(target),
      clientY: 150 + 200 * Math.sin(target),
    });
    expect((h.elements[0].angle * 180) / Math.PI).toBeCloseTo(60, 5);
    fireEvent.pointerUp(window, { clientX: 0, clientY: 0 });
  });
});
