import React from "react";

import { reseed } from "@excalidraw/common";
import { getCommonBounds } from "@excalidraw/element";

import { Excalidraw } from "../index";
import { buildElements } from "../symbols/build";
import { COMPONENTS, defaultsOf } from "../symbols/components";
import {
  frameOf,
  getLayout,
  getSelectedSymbol,
  inferPins,
  snapFrame,
  stretchUpdates,
} from "../symbols/stretch";
import { THEMES } from "../symbols/theme";

import { API } from "./helpers/api";
import {
  act,
  fireEvent,
  mockBoundingClientRect,
  restoreOriginalGetBoundingClientRect,
  render,
  screen,
  unmountComponent,
} from "./test-utils";

unmountComponent();

const { h } = window;
const night = THEMES[2];

beforeEach(() => {
  localStorage.clear();
  reseed(7);
});

const make = (id: string, at = { x: 100, y: 100 }, values?: any) => {
  const def = COMPONENTS.find((c) => c.id === id)!;
  return buildElements(
    def.shapes(night, { ...defaultsOf(def), ...values }),
    night,
    at,
  );
};

const byText = (els: any[], text: string) =>
  els.find((e) => e.type === "text" && e.text === text);

describe("stretching a component", () => {
  it("grows what spans and keeps the ends where they are", () => {
    const els = make("list-row");
    const from = frameOf(els);
    const pins = inferPins(els, from, getLayout(els));
    const to = { ...from, x1: from.x1 + 100 };
    const up = stretchUpdates(els, pins, from, to);
    // the card background spans: it gets wider by 100
    const bg = els.reduce((a, e) => (e.width > a.width ? e : a));
    expect(up.get(bg.id)!.width ?? up.get(bg.id)!.width).toBe(bg.width + 100);
    // the title stays at the left, the buttons keep their distance from the right
    const title = byText(els, "Chocolate with milk");
    expect(up.get(title.id)!.x).toBe(title.x);
    const buttons = els.filter((e) => e.type === "path" && e.width === 40);
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    for (const b of buttons) {
      expect(up.get(b.id)!.x).toBe(b.x + 100);
      // and are not distorted
      expect(up.get(b.id)!.width ?? b.width).toBe(b.width);
    }
  });

  it("keeps a pill's corners round when it grows", () => {
    const els = make("button");
    const from = frameOf(els);
    const pins = inferPins(els, from, getLayout(els));
    const up = stretchUpdates(els, pins, from, { ...from, x1: from.x1 + 60 });
    const pill = els.find((e) => e.type === "path") as any;
    const u = up.get(pill.id)!;
    expect(u.handles[0].radius).toBe(pill.handles[0].radius);
    expect(Math.round(u.width)).toBe(Math.round(pill.width + 60));
    expect(Math.round(u.height)).toBe(Math.round(pill.height));
  });

  it("the layout choice decides where loose parts go", () => {
    const els = make("tabs");
    const from = frameOf(els);
    const to = { ...from, x1: from.x1 + 90 };
    const move = (h: any) => {
      const pins = inferPins(els, from, { h, v: "auto" });
      const up = stretchUpdates(els, pins, from, to);
      const t = byText(els, "All");
      return up.get(t.id)!.x - t.x;
    };
    expect(move("left")).toBe(0);
    expect(move("right")).toBe(90);
    expect(move("center")).toBe(45);
    // scale: everything follows in proportion
    expect(move("scale")).toBeGreaterThan(0);
  });

  it("snaps an edge to another component and says which line lit up", () => {
    const a = make("button", { x: 0, y: 0 });
    const other = make("button", { x: 0, y: 100 });
    const from = frameOf(a);
    const next = { ...from, x1: from.x1 + 97 }; // near 140 + 100 = 240? other ends at 140
    const o = frameOf(other);
    const near = { ...from, x1: o.x1 + 3 };
    const r = snapFrame(
      near,
      { l: false, r: true, t: false, b: false },
      other,
      6,
    );
    expect(r.frame.x1).toBe(o.x1);
    expect(r.guides).toHaveLength(1);
    expect(r.guides[0]).toMatchObject({ axis: "x", pos: o.x1 });
    const far = snapFrame(
      next,
      { l: false, r: true, t: false, b: false },
      other,
      6,
    );
    expect(far.guides).toHaveLength(0);
  });

  it("only a whole component counts as one", () => {
    const els = make("button");
    expect(getSelectedSymbol(els, els)?.members).toHaveLength(els.length);
    expect(getSelectedSymbol(els.slice(1), els)).toBeNull();
  });
});

describe("Ctrl + drag on the canvas", () => {
  beforeAll(() => {
    mockBoundingClientRect();
  });
  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("stretches the selected component, flashes on alignment, and Escape undoes it", async () => {
    const utils = await render(<Excalidraw handleKeyboardGlobally />);
    const canvas = utils.container.querySelector("canvas.interactive")!;
    const els = make("button", { x: 100, y: 100 });
    // another component whose right edge is at 300
    const other = make("button", { x: 160, y: 300 });
    API.setElements([...els, ...other] as any);
    API.setSelectedElements(els as any);
    const bounds = getCommonBounds(els);
    // anywhere along the right edge of the component
    const from = [
      bounds[2] + h.state.offsetLeft,
      (bounds[1] + bounds[3]) / 2 + h.state.offsetTop,
    ];

    fireEvent.pointerDown(canvas, {
      clientX: from[0],
      clientY: from[1],
      ctrlKey: true,
    });
    // 100 + 140 = 240 is the right edge; the other ends at 300: drag to near it
    fireEvent.pointerMove(window, {
      clientX: from[0] + 62,
      clientY: from[1],
      ctrlKey: true,
    });
    expect(screen.getByTestId("stretch-overlay")).toBeTruthy();
    expect(screen.getAllByTestId("stretch-guide").length).toBeGreaterThan(0);
    const pill = () =>
      h.elements.find((e) => e.type === "path" && e.width > 100) as any;
    expect(Math.round(pill().width)).toBe(200);
    fireEvent.pointerUp(window, { clientX: from[0] + 62, clientY: from[1] });
    expect(screen.queryByTestId("stretch-overlay")).toBeNull();
    expect(Math.round(pill().width)).toBe(200);

    // Escape during a second drag puts it back
    fireEvent.pointerDown(canvas, {
      clientX: from[0] + 62,
      clientY: from[1],
      ctrlKey: true,
    });
    fireEvent.pointerMove(window, {
      clientX: from[0] + 20,
      clientY: from[1],
      ctrlKey: true,
    });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(Math.round(pill().width)).toBe(200);
  });

  it("without Ctrl the usual resize runs, and a plain rectangle is untouched", async () => {
    const utils = await render(<Excalidraw />);
    expect(utils.container.querySelector("canvas.interactive")).toBeTruthy();
    expect(h.app.stretch.getSnapshot().frame).toBeNull();
    act(() => undefined);
  });
});
