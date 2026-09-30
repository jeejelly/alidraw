import React from "react";

import { reseed } from "@excalidraw/common";
import { pointFrom, type LocalPoint } from "@excalidraw/math";

import type { ExcalidrawPathElement } from "@excalidraw/element/types";

import { actionToggleGuidesSnap, actionToggleRulers } from "../actions";
import { restoreAppState } from "../data/restore";
import { formatRulerValue, getGuideSnap, getRulerStep } from "../guides";
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

describe("guide math", () => {
  const guides = [
    { id: "a", axis: "x", position: 100 },
    { id: "b", axis: "y", position: 50 },
  ] as const;

  it("pulls the nearest point onto a guide within the snap distance", () => {
    const snap = getGuideSnap(
      [
        [95, 0],
        [130, 200],
      ],
      guides,
      1,
    );
    expect(snap.x).toBe(5);
    expect(snap.y).toBe(0);
    expect(snap.guides.map((g) => g.id)).toEqual(["a"]);
  });

  it("does not snap beyond the distance, which shrinks with zoom", () => {
    expect(getGuideSnap([[90, 0]], guides, 1).x).toBe(0);
    expect(getGuideSnap([[97, 0]], guides, 4).x).toBe(0);
    expect(getGuideSnap([[97, 0]], guides, 4).guides).toEqual([]);
  });

  it("ticks get sparser as the zoom drops", () => {
    expect(getRulerStep(1)).toBe(100);
    expect(getRulerStep(4)).toBe(20);
    expect(getRulerStep(0.1)).toBe(1000);
    expect(formatRulerValue(12.3456789)).toBe("12.346");
  });
});

describe("guides in files", () => {
  it("are restored, and malformed ones dropped", () => {
    const state = restoreAppState(
      {
        guides: [
          { id: "a", axis: "x", position: 10 },
          { id: "a", axis: "x", position: 11 },
          { id: "b", axis: "z", position: 1 },
          { id: "c", axis: "y", position: "5" },
          null,
          { id: "d", axis: "y", position: 7.5 },
        ],
      } as any,
      null,
    );
    expect(state.guides).toEqual([
      { id: "a", axis: "x", position: 10 },
      { id: "d", axis: "y", position: 7.5 },
    ]);
  });

  it("default to none, magnet on", () => {
    const state = restoreAppState({}, null);
    expect(state.guides).toEqual([]);
    expect(state.guidesSnapEnabled).toBe(true);
    expect(state.rulersEnabled).toBe(false);
  });
});

describe("rulers and guides", () => {
  beforeAll(() => {
    mockBoundingClientRect({ width: 1000, height: 1000 });
  });
  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("drags a guide off a ruler, to a whole px, deleting it back on the ruler", async () => {
    await render(<Excalidraw />);
    API.executeAction(actionToggleRulers);
    expect(h.state.rulersEnabled).toBe(true);
    const ruler = document.querySelector('[data-testid="ruler-left"]')!;

    fireEvent.pointerDown(ruler, { clientX: 5, clientY: 300 });
    fireEvent.pointerMove(window, { clientX: 250.4, clientY: 300 });
    expect(h.state.guides).toHaveLength(1);
    expect(
      document.querySelector('[data-testid="guide-readout"]'),
    ).not.toBeNull();
    fireEvent.pointerUp(window, { clientX: 250.4, clientY: 300 });
    expect(h.state.guides).toEqual([
      expect.objectContaining({ axis: "x", position: 250 }),
    ]);

    // drag it back onto the ruler: deleted
    const canvas = document.querySelector("canvas.interactive")!;
    fireEvent.pointerDown(canvas, { clientX: 250, clientY: 400 });
    fireEvent.pointerMove(window, { clientX: 8, clientY: 400 });
    fireEvent.pointerUp(window, { clientX: 8, clientY: 400 });
    expect(h.state.guides).toEqual([]);
  });

  const setupRect = () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 100,
      height: 100,
    });
    API.setElements([rect]);
    API.setSelectedElements([rect]);
    API.setAppState({
      guides: [{ id: "g", axis: "x", position: 303 }],
    });
    return rect;
  };

  const drag = (from: [number, number], to: [number, number]) => {
    const canvas = document.querySelector("canvas.interactive")!;
    fireEvent.pointerDown(canvas, { clientX: from[0], clientY: from[1] });
    fireEvent.pointerMove(canvas, { clientX: to[0], clientY: to[1] });
    fireEvent.pointerUp(canvas, { clientX: to[0], clientY: to[1] });
  };

  it("a dragged element snaps to a guide", async () => {
    await render(<Excalidraw />);
    const rect = setupRect();
    // right edge would land on 300; the guide at 303 attracts it
    drag([150, 150], [250, 150]);
    expect(h.elements.find((e) => e.id === rect.id)!.x).toBe(203);
  });

  it("the magnet can be turned off", async () => {
    await render(<Excalidraw />);
    const rect = setupRect();
    API.executeAction(actionToggleGuidesSnap);
    expect(h.state.guidesSnapEnabled).toBe(false);
    drag([150, 150], [250, 150]);
    expect(h.elements.find((e) => e.id === rect.id)!.x).toBe(200);
  });

  it("an anchor of a path snaps to a guide while it is edited", async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
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
    API.setElements([path]);
    API.setSelectedElements([path]);
    API.setAppState({
      guides: [{ id: "g", axis: "x", position: 303 }],
      editingPath: { elementId: path.id, selectedPoint: null },
    });
    const canvas = document.querySelector("canvas.interactive")!;
    fireEvent.pointerDown(canvas, { clientX: 200, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 298, clientY: 100 });
    fireEvent.pointerUp(window, { clientX: 298, clientY: 100 });
    const el = h.elements[0] as ExcalidrawPathElement;
    expect(el.x + el.points[1][0]).toBeCloseTo(303);
  });
});
