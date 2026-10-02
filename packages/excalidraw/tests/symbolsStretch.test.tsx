import React from "react";

import { reseed } from "@excalidraw/common";
import { getCommonBounds } from "@excalidraw/element";

import { Excalidraw } from "../index";
import { buildElements } from "../symbols/build";
import { collectCodeItems } from "../symbols/codeItems";
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
    id,
    { ...defaultsOf(def), ...values },
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

describe("symbols standing in for shapes", () => {
  const setup = async () => {
    await render(<Excalidraw />);
    const box = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 220,
      height: 56,
      boundElements: null,
    } as any);
    const label = API.createElement({
      type: "text",
      text: "Add to cart",
      containerId: box.id,
      x: 110,
      y: 110,
    } as any);
    API.setElements([
      { ...box, boundElements: [{ type: "text", id: label.id }] } as any,
      label,
    ]);
    API.setSelectedElements([box] as any);
    return { box, label };
  };

  it("replaces a shape with a component that carries its text, and keeps the shape as an anchor", async () => {
    const { box } = await setup();
    const n = h.app.symbols.replace("button", { look: "primary" }, night);
    expect(n).toBe(1);
    const live = h.elements.filter((e) => !e.isDeleted);
    const texts = live.filter(
      (e: any) => e.type === "text" && e.text === "Add to cart",
    );
    // the symbol's own label, plus the anchor's hidden one
    expect(texts.length).toBe(2);
    const anchor = live.find((e) => e.id === box.id) as any;
    expect(anchor.strokeColor).toBe("transparent");
    expect(anchor.customData.symbol.anchor).toBe(true);
    // the symbol fills the shape's box
    const pill = live.find((e) => e.type === "path") as any;
    expect(Math.round(pill.width)).toBe(220);
    expect(Math.round(pill.height)).toBe(56);
    expect(new Set(live.map((e) => e.groupIds[0])).size).toBe(1);
  });

  it("redraws the symbol when the text of the shape changes", async () => {
    const { box, label } = await setup();
    h.app.symbols.replace("button", {}, night);
    act(() => {
      h.app.scene.mutateElement(
        h.elements.find((e) => e.id === label.id) as any,
        { text: "Pay now", originalText: "Pay now" },
      );
    });
    h.app.symbols.sync();
    const live = h.elements.filter((e) => !e.isDeleted);
    expect(
      live.some(
        (e: any) =>
          e.type === "text" && e.text === "Pay now" && e.id !== label.id,
      ),
    ).toBe(true);
    expect(
      live.filter(
        (e: any) =>
          e.type === "text" && e.text === "Add to cart" && e.id !== label.id,
      ),
    ).toHaveLength(0);
    expect(live.some((e) => e.id === box.id)).toBe(true);
  });

  it("locks a background to the clipping zone", () => {
    const els = make("card").map((e) => e);
    const inner = els.find((e) => e.type === "rectangle" && e.height === 80)!;
    const marked = els.map((e) =>
      e.id === inner.id
        ? {
            ...e,
            customData: {
              ...e.customData,
              symbol: { ...e.customData!.symbol, cover: true },
            },
          }
        : e,
    );
    const from = frameOf(marked);
    const pins = inferPins(marked, from, getLayout(marked));
    const to = { ...from, x1: from.x1 + 120, y1: from.y1 + 60 };
    const up = stretchUpdates(marked, pins, from, to);
    expect(up.get(inner.id)).toMatchObject({
      x: to.x0,
      y: to.y0,
      width: to.x1 - to.x0,
      height: to.y1 - to.y0,
    });
  });
});

describe("copies of a symbol", () => {
  it("a duplicate, or an item back from the library, is its own component", () => {
    const original = make("button", { x: 0, y: 0 });
    // what duplicating does: new ids and new groups, the stored meta stays as it was
    const copy = original.map((e, k) => ({
      ...e,
      id: `copy${k}`,
      groupIds: ["fresh-group"],
    }));
    const all = [...original, ...copy] as any[];
    expect(getSelectedSymbol(copy as any, all)?.members).toHaveLength(
      copy.length,
    );
    expect(getSelectedSymbol(original as any, all)?.members).toHaveLength(
      original.length,
    );
    expect(collectCodeItems(all)).toHaveLength(2);
  });
});
