import React from "react";

import { reseed } from "@excalidraw/common";

import { Excalidraw } from "../index";
import { serializeAsJSON } from "../data/json";
import { restoreAppState, restoreElements } from "../data/restore";
import { getLayerId } from "../layers";

import { API } from "./helpers/api";
import {
  act,
  fireEvent,
  render,
  screen,
  unmountComponent,
  mockBoundingClientRect,
  restoreOriginalGetBoundingClientRect,
} from "./test-utils";

unmountComponent();

const { h } = window;

beforeEach(() => {
  localStorage.clear();
  reseed(7);
});

const live = () => h.elements.filter((e) => !e.isDeleted);
const ids = () => live().map((e) => e.id);

const setup = async () => {
  await render(<Excalidraw />);
  const a = API.createElement({
    type: "rectangle",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    backgroundColor: "#ff0000",
  });
  const b = API.createElement({
    type: "ellipse",
    x: 200,
    y: 0,
    width: 100,
    height: 100,
    backgroundColor: "#00ff00",
  });
  API.setElements([a, b]);
  return { a, b };
};

const addLayer = (name?: string) => {
  let layer: any;
  act(() => {
    layer = h.app.layers.add(name);
  });
  return layer;
};

describe("layers", () => {
  it("the first layer takes what is drawn, a new one becomes active", async () => {
    const { a, b } = await setup();
    const second = addLayer("Buttons");
    expect(h.state.layers.map((l) => l.name)).toEqual(["Layer 1", "Buttons"]);
    expect(h.state.activeLayerId).toBe(second.id);
    const first = h.state.layers[0];
    expect(getLayerId(h.elements.find((e) => e.id === a.id)!)).toBe(first.id);
    expect(getLayerId(h.elements.find((e) => e.id === b.id)!)).toBe(first.id);
    // what is drawn next goes to the active layer
    const c = API.createElement({ type: "diamond", x: 0, y: 300 });
    act(() => {
      API.updateScene({ elements: [...h.elements, c] });
    });
    expect(getLayerId(h.elements.find((e) => e.id === c.id)!)).toBe(second.id);
  });

  it("a layer is a block of the stack: reordering layers reorders objects", async () => {
    const { a, b } = await setup();
    const top = addLayer("Top");
    const c = API.createElement({ type: "diamond", x: 0, y: 300 });
    act(() => {
      API.updateScene({ elements: [...h.elements, c] });
    });
    expect(ids()).toEqual([a.id, b.id, c.id]);
    act(() => h.app.layers.move(top.id, 0));
    expect(ids()).toEqual([c.id, a.id, b.id]);
  });

  it("moving objects to another layer puts them on top of its block", async () => {
    const { a, b } = await setup();
    addLayer("Top");
    const [l1, l2] = h.state.layers;
    act(() => h.app.layers.moveObjects([a.id], l2.id));
    expect(getLayerId(h.elements.find((e) => e.id === a.id)!)).toBe(l2.id);
    expect(ids()).toEqual([b.id, a.id]);
    expect(h.app.layers.getObjects(l1.id).map((e) => e.id)).toEqual([b.id]);
  });

  it("hiding a layer hides, unselects and unpicks its objects", async () => {
    const { a, b } = await setup();
    addLayer("Top");
    const l1 = h.state.layers[0];
    API.setSelectedElements([a]);
    act(() => h.app.layers.setVisible(l1.id, false));
    expect(h.state.selectedElementIds[a.id]).toBeFalsy();
    expect(h.app.getElementsAtPosition(50, 50)).toHaveLength(0);
    expect(h.app.getElementsAtPosition(250, 50)).toHaveLength(0);
    // the data stays
    expect(live()).toHaveLength(2);
    act(() => h.app.layers.setVisible(l1.id, true));
    expect(h.app.getElementsAtPosition(50, 50).map((e) => e.id)).toEqual([
      a.id,
    ]);
    expect(h.app.getElementsAtPosition(250, 50).map((e) => e.id)).toEqual([
      b.id,
    ]);
  });

  it("locking a layer locks its objects, unlocking frees them", async () => {
    await setup();
    addLayer();
    const l1 = h.state.layers[0];
    act(() => h.app.layers.setLocked(l1.id, true));
    expect(live().every((e) => e.locked)).toBe(true);
    act(() => h.app.layers.setLocked(l1.id, false));
    expect(live().some((e) => e.locked)).toBe(false);
  });

  it("the layer style restyles every object of the layer at once", async () => {
    const { a, b } = await setup();
    addLayer();
    const l1 = h.state.layers[0];
    expect(h.app.layers.getSharedStyle(l1.id, "backgroundColor")).toBeNull();
    act(() =>
      h.app.layers.setStyle(l1.id, {
        backgroundColor: "#123456",
        strokeColor: "#abcdef",
      }),
    );
    for (const id of [a.id, b.id]) {
      const el = h.elements.find((e) => e.id === id)!;
      expect(el.backgroundColor).toBe("#123456");
      expect(el.strokeColor).toBe("#abcdef");
    }
    expect(h.app.layers.getSharedStyle(l1.id, "backgroundColor")).toBe(
      "#123456",
    );
  });

  it("deleting a layer deletes the objects it owns", async () => {
    const { a } = await setup();
    addLayer();
    const [l1, l2] = h.state.layers;
    act(() => h.app.layers.moveObjects([a.id], l2.id));
    act(() => h.app.layers.remove(l2.id));
    expect(h.state.layers.map((l) => l.id)).toEqual([l1.id]);
    expect(h.elements.find((e) => e.id === a.id)!.isDeleted).toBe(true);
    expect(live()).toHaveLength(1);
    expect(h.state.activeLayerId).toBe(l1.id);
  });

  it("survives save and restore", async () => {
    await setup();
    addLayer("Buttons");
    act(() => h.app.layers.setVisible(h.state.layers[0].id, false));
    const json = JSON.parse(serializeAsJSON(h.elements, h.state, {}, "local"));
    const appState = restoreAppState(json.appState, null);
    expect(appState.layers.map((l) => [l.name, l.visible])).toEqual([
      ["Layer 1", false],
      ["Buttons", true],
    ]);
    expect(appState.activeLayerId).toBe(h.state.layers[1].id);
    const els = restoreElements(json.elements, null);
    expect(els.map((e) => getLayerId(e))).toEqual([
      h.state.layers[0].id,
      h.state.layers[0].id,
    ]);
    // junk is dropped
    expect(
      restoreAppState(
        { layers: [{ id: 3 }, { id: "x", color: "red" }] } as any,
        null,
      ).layers,
    ).toHaveLength(1);
  });
});

describe("layers panel", () => {
  beforeAll(() => {
    mockBoundingClientRect({ width: 1000, height: 1000 });
  });
  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  const open = async () => {
    const els = await setup();
    API.setAppState({ paletteOpen: true });
    fireEvent.click(screen.getByText("Layers"));
    return els;
  };

  it("adds, renames, hides and deletes layers", async () => {
    await open();
    fireEvent.click(screen.getByTestId("layer-add"));
    expect(screen.getAllByTestId("layer")).toHaveLength(2);

    const names = screen.getAllByTestId("layer-name");
    // top first: the new layer
    expect(names[0].textContent).toBe("Layer 2");
    fireEvent.doubleClick(names[0]);
    const input = screen.getByTestId("layer-name-input");
    fireEvent.change(input, { target: { value: "Buttons" } });
    fireEvent.blur(input);
    expect(h.state.layers[1].name).toBe("Buttons");

    fireEvent.click(screen.getAllByTestId("layer-visible")[0]);
    expect(h.state.layers[1].visible).toBe(false);

    fireEvent.click(screen.getByTestId("layer-delete"));
    expect(h.state.layers).toHaveLength(1);
  });

  it("clicking the square selects every object of the layer", async () => {
    const { a, b } = await open();
    fireEvent.click(screen.getByTestId("layer-add"));
    fireEvent.click(screen.getAllByTestId("layer-select")[1]);
    expect(Object.keys(h.state.selectedElementIds).sort()).toEqual(
      [a.id, b.id].sort(),
    );
  });

  it("dragging a layer row reorders the layers", async () => {
    await open();
    fireEvent.click(screen.getByTestId("layer-add"));
    const [bottom, top] = h.state.layers;
    const rows = screen.getAllByTestId("layer-row");
    const store: Record<string, string> = {};
    const dataTransfer = {
      setData: (k: string, v: string) => (store[k] = v),
      getData: (k: string) => store[k],
      effectAllowed: "",
    };
    // the bottom row dropped on the upper half of the top one goes above it
    fireEvent.dragStart(rows[1], { dataTransfer });
    fireEvent.drop(rows[0], { dataTransfer });
    expect(h.state.layers.map((l) => l.id)).toEqual([top.id, bottom.id]);
  });

  it("the layer fill colour restyles its objects", async () => {
    const { a, b } = await open();
    fireEvent.click(screen.getByTestId("layer-add"));
    fireEvent.click(screen.getAllByTestId("layer-row")[1]);
    fireEvent.change(screen.getByTestId("layer-fill"), {
      target: { value: "#0000ff" },
    });
    for (const id of [a.id, b.id]) {
      expect(h.elements.find((e) => e.id === id)!.backgroundColor).toBe(
        "#0000ff",
      );
    }
  });
});
