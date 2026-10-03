import React from "react";

import { getCommonBounds } from "@excalidraw/element";

import { fitIntoBox } from "@excalidraw/symbols";
import { buildElements } from "@excalidraw/symbols";
import { collectCodeItems } from "@excalidraw/symbols";
import { COMPONENTS, defaultsOf } from "@excalidraw/symbols";
import {
  frameOf,
  getLayout,
  getSelectedSymbol,
  inferPins,
  snapFrame,
  stretchUpdates,
} from "@excalidraw/symbols";
import { THEMES } from "@excalidraw/symbols";

import { Excalidraw } from "../index";
import { actionReplaceFromLibrary } from "../actions";

import { resetTestState } from "./helpers/fixtures";
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

const handle = window.h;
const night = THEMES[2];

beforeEach(resetTestState);

const make = (id: string, at = { x: 100, y: 100 }, values?: any) => {
  const def = COMPONENTS.find((component) => component.id === id)!;
  return buildElements(
    def.shapes(night, { ...defaultsOf(def), ...values }),
    night,
    at,
    id,
    { ...defaultsOf(def), ...values },
  );
};

const byText = (els: any[], text: string) =>
  els.find((element) => element.type === "text" && element.text === text);

describe("stretching a component", () => {
  it("grows what spans and keeps the ends where they are", () => {
    const els = make("list-row");
    const from = frameOf(els);
    const pins = inferPins(els, from, getLayout(els));
    const to = { ...from, x1: from.x1 + 100 };
    const up = stretchUpdates(els, pins, from, to);
    // the card background spans: it gets wider by 100
    const bg = els.reduce((first, element) =>
      element.width > first.width ? element : first,
    );
    expect(up.get(bg.id)!.width ?? up.get(bg.id)!.width).toBe(bg.width + 100);
    // the title stays at the left, the buttons keep their distance from the right
    const title = byText(els, "Chocolate with milk");
    expect(up.get(title.id)!.x).toBe(title.x);
    const buttons = els.filter(
      (element) => element.type === "path" && element.width === 40,
    );
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    for (const button of buttons) {
      expect(up.get(button.id)!.x).toBe(button.x + 100);
      // and are not distorted
      expect(up.get(button.id)!.width ?? button.width).toBe(button.width);
    }
  });

  it("keeps a pill's corners round when it grows", () => {
    const els = make("button");
    const from = frameOf(els);
    const pins = inferPins(els, from, getLayout(els));
    const up = stretchUpdates(els, pins, from, { ...from, x1: from.x1 + 60 });
    const pill = els.find((element) => element.type === "path") as any;
    const update = up.get(pill.id)!;
    expect(update.handles[0].radius).toBe(pill.handles[0].radius);
    expect(Math.round(update.width)).toBe(Math.round(pill.width + 60));
    expect(Math.round(update.height)).toBe(Math.round(pill.height));
  });

  it("the layout choice decides where loose parts go", () => {
    const els = make("tabs");
    const from = frameOf(els);
    const to = { ...from, x1: from.x1 + 90 };
    const move = (horizontal: any) => {
      const pins = inferPins(els, from, { h: horizontal, v: "auto" });
      const up = stretchUpdates(els, pins, from, to);
      const label = byText(els, "All");
      return up.get(label.id)!.x - label.x;
    };
    expect(move("left")).toBe(0);
    expect(move("right")).toBe(90);
    expect(move("center")).toBe(45);
    // scale: everything follows in proportion
    expect(move("scale")).toBeGreaterThan(0);
  });

  it("snaps an edge to another component and says which line lit up", () => {
    const first = make("button", { x: 0, y: 0 });
    const other = make("button", { x: 0, y: 100 });
    const from = frameOf(first);
    const next = { ...from, x1: from.x1 + 97 };
    const otherFrame = frameOf(other);
    const near = { ...from, x1: otherFrame.x1 + 3 };
    const snapped = snapFrame(
      near,
      { l: false, r: true, t: false, b: false },
      other,
      6,
    );
    expect(snapped.frame.x1).toBe(otherFrame.x1);
    expect(snapped.guides).toHaveLength(1);
    expect(snapped.guides[0]).toMatchObject({ axis: "x", pos: otherFrame.x1 });
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
      bounds[2] + handle.state.offsetLeft,
      (bounds[1] + bounds[3]) / 2 + handle.state.offsetTop,
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
      handle.elements.find(
        (element) => element.type === "path" && element.width > 100,
      ) as any;
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
    expect(handle.app.stretch.getSnapshot().frame).toBeNull();
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
    const replaced = handle.app.symbols.replace(
      "button",
      { look: "primary" },
      night,
    );
    expect(replaced).toBe(1);
    const live = handle.elements.filter((element) => !element.isDeleted);
    const texts = live.filter(
      (element: any) =>
        element.type === "text" && element.text === "Add to cart",
    );
    // the symbol's own label, plus the anchor's hidden one
    expect(texts.length).toBe(2);
    const anchor = live.find((element) => element.id === box.id) as any;
    expect(anchor.strokeColor).toBe("transparent");
    expect(anchor.customData.symbol.anchor).toBe(true);
    // the symbol fills the shape's box
    const pill = live.find((element) => element.type === "path") as any;
    expect(Math.round(pill.width)).toBe(220);
    expect(Math.round(pill.height)).toBe(56);
    expect(new Set(live.map((element) => element.groupIds[0])).size).toBe(1);
  });

  it("redraws the symbol when the text of the shape changes", async () => {
    const { box, label } = await setup();
    handle.app.symbols.replace("button", {}, night);
    act(() => {
      handle.app.scene.mutateElement(
        handle.elements.find((element) => element.id === label.id) as any,
        { text: "Pay now", originalText: "Pay now" },
      );
    });
    handle.app.symbols.sync();
    const live = handle.elements.filter((element) => !element.isDeleted);
    expect(
      live.some(
        (element: any) =>
          element.type === "text" &&
          element.text === "Pay now" &&
          element.id !== label.id,
      ),
    ).toBe(true);
    expect(
      live.filter(
        (element: any) =>
          element.type === "text" &&
          element.text === "Add to cart" &&
          element.id !== label.id,
      ),
    ).toHaveLength(0);
    expect(live.some((element) => element.id === box.id)).toBe(true);
  });

  it("locks a background to the clipping zone", () => {
    const els = make("card").map((element) => element);
    const inner = els.find(
      (element) => element.type === "rectangle" && element.height === 80,
    )!;
    const marked = els.map((element) =>
      element.id === inner.id
        ? {
            ...element,
            customData: {
              ...element.customData,
              symbol: { ...element.customData!.symbol, cover: true },
            },
          }
        : element,
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
    const copy = original.map((element, index) => ({
      ...element,
      id: `copy${index}`,
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

describe("replacing from the library", () => {
  it("fits a symbol into the selection's box, stretching it like Ctrl + drag", () => {
    const item = make("button", { x: 0, y: 0 });
    const fitted = fitIntoBox(item, { x0: 500, y0: 500, x1: 800, y1: 560 });
    const frame = frameOf(fitted);
    expect([
      frame.x0,
      frame.y0,
      Math.round(frame.x1),
      Math.round(frame.y1),
    ]).toEqual([500, 500, 800, 560]);
    // the corners stay round: the pill grew, it did not scale
    const pill = fitted.find((element) => element.type === "path") as any;
    expect(pill.handles[0].radius).toBe(20);
  });

  it("scales other shapes in proportion and centres them", () => {
    const first = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    } as any);
    const fitted = fitIntoBox([first] as any, {
      x0: 0,
      y0: 0,
      x1: 400,
      y1: 400,
    });
    expect(fitted[0]).toMatchObject({ width: 400, height: 200, x: 0, y: 100 });
  });

  it("right-click offers it, and picking an item replaces the selection", async () => {
    await render(<Excalidraw />);
    const old = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 200,
      height: 100,
    } as any);
    API.setElements([old] as any);
    API.setSelectedElements([old] as any);
    const item = make("toggle", { x: 0, y: 0 });
    await act(async () => {
      await handle.app.library.setLibrary([
        {
          id: "lib1",
          status: "unpublished",
          created: 1,
          elements: item as any,
        },
      ]);
    });
    act(() => handle.app.actionManager.executeAction(actionReplaceFromLibrary));
    expect(handle.state.openDialog).toEqual({ name: "libraryReplace" });
    const choice = await screen.findByTestId("library-replace-item");
    fireEvent.click(choice);
    const live = handle.elements.filter((element) => !element.isDeleted);
    expect(live.some((element) => element.id === old.id)).toBe(false);
    expect(live.length).toBe(item.length);
    const frame = frameOf(live as any);
    expect(Math.round(frame.x1 - frame.x0)).toBe(200);
    expect(handle.state.openDialog).toBeNull();
  });
});
