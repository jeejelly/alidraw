import React from "react";

import { Excalidraw } from "../index";
import { serializeAsJSON } from "../data/json";
import { restoreAppState, restoreElements } from "../data/restore";
import { getLayerId } from "../layers";

import { liveElements, resetTestState } from "./helpers/fixtures";
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

const handle = window.h;

beforeEach(resetTestState);

const ids = () => liveElements().map((element) => element.id);

const setup = async () => {
  await render(<Excalidraw />);
  const first = API.createElement({
    type: "rectangle",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    backgroundColor: "#ff0000",
  });
  const second = API.createElement({
    type: "ellipse",
    x: 200,
    y: 0,
    width: 100,
    height: 100,
    backgroundColor: "#00ff00",
  });
  API.setElements([first, second]);
  return { first, second };
};

const addLayer = (name?: string) => {
  let layer: any;
  act(() => {
    layer = handle.app.layers.add(name);
  });
  return layer;
};

describe("layers", () => {
  it("the first layer takes what is drawn, a new one becomes active", async () => {
    const { first: firstElement, second: secondElement } = await setup();
    const second = addLayer("Buttons");
    expect(handle.state.layers.map((layer) => layer.name)).toEqual([
      "Layer 1",
      "Buttons",
    ]);
    expect(handle.state.activeLayerId).toBe(second.id);
    const first = handle.state.layers[0];
    expect(
      getLayerId(
        handle.elements.find((element) => element.id === firstElement.id)!,
      ),
    ).toBe(first.id);
    expect(
      getLayerId(
        handle.elements.find((element) => element.id === secondElement.id)!,
      ),
    ).toBe(first.id);
    // what is drawn next goes to the active layer
    const third = API.createElement({ type: "diamond", x: 0, y: 300 });
    act(() => {
      API.updateScene({ elements: [...handle.elements, third] });
    });
    expect(
      getLayerId(handle.elements.find((element) => element.id === third.id)!),
    ).toBe(second.id);
  });

  it("a layer is a block of the stack: reordering layers reorders objects", async () => {
    const { first, second } = await setup();
    const top = addLayer("Top");
    const third = API.createElement({ type: "diamond", x: 0, y: 300 });
    act(() => {
      API.updateScene({ elements: [...handle.elements, third] });
    });
    expect(ids()).toEqual([first.id, second.id, third.id]);
    act(() => handle.app.layers.move(top.id, 0));
    expect(ids()).toEqual([third.id, first.id, second.id]);
  });

  it("moving objects to another layer puts them on top of its block", async () => {
    const { first, second } = await setup();
    addLayer("Top");
    const [l1, l2] = handle.state.layers;
    act(() => handle.app.layers.moveObjects([first.id], l2.id));
    expect(
      getLayerId(handle.elements.find((element) => element.id === first.id)!),
    ).toBe(l2.id);
    expect(ids()).toEqual([second.id, first.id]);
    expect(
      handle.app.layers.getObjects(l1.id).map((element) => element.id),
    ).toEqual([second.id]);
  });

  it("hiding a layer hides, unselects and unpicks its objects", async () => {
    const { first, second } = await setup();
    addLayer("Top");
    const l1 = handle.state.layers[0];
    API.setSelectedElements([first]);
    act(() => handle.app.layers.setVisible(l1.id, false));
    expect(handle.state.selectedElementIds[first.id]).toBeFalsy();
    expect(handle.app.getElementsAtPosition(50, 50)).toHaveLength(0);
    expect(handle.app.getElementsAtPosition(250, 50)).toHaveLength(0);
    // the data stays
    expect(liveElements()).toHaveLength(2);
    act(() => handle.app.layers.setVisible(l1.id, true));
    expect(
      handle.app.getElementsAtPosition(50, 50).map((element) => element.id),
    ).toEqual([first.id]);
    expect(
      handle.app.getElementsAtPosition(250, 50).map((element) => element.id),
    ).toEqual([second.id]);
  });

  it("locking a layer locks its objects, unlocking frees them", async () => {
    await setup();
    addLayer();
    const l1 = handle.state.layers[0];
    act(() => handle.app.layers.setLocked(l1.id, true));
    expect(liveElements().every((element) => element.locked)).toBe(true);
    act(() => handle.app.layers.setLocked(l1.id, false));
    expect(liveElements().some((element) => element.locked)).toBe(false);
  });

  it("the layer style restyles every object of the layer at once", async () => {
    const { first, second } = await setup();
    addLayer();
    const l1 = handle.state.layers[0];
    expect(
      handle.app.layers.getSharedStyle(l1.id, "backgroundColor"),
    ).toBeNull();
    act(() =>
      handle.app.layers.setStyle(l1.id, {
        backgroundColor: "#123456",
        strokeColor: "#abcdef",
      }),
    );
    for (const id of [first.id, second.id]) {
      const el = handle.elements.find((element) => element.id === id)!;
      expect(el.backgroundColor).toBe("#123456");
      expect(el.strokeColor).toBe("#abcdef");
    }
    expect(handle.app.layers.getSharedStyle(l1.id, "backgroundColor")).toBe(
      "#123456",
    );
  });

  it("deleting a layer deletes the objects it owns", async () => {
    const { first } = await setup();
    addLayer();
    const [l1, l2] = handle.state.layers;
    act(() => handle.app.layers.moveObjects([first.id], l2.id));
    act(() => handle.app.layers.remove(l2.id));
    expect(handle.state.layers.map((layer) => layer.id)).toEqual([l1.id]);
    expect(
      handle.elements.find((element) => element.id === first.id)!.isDeleted,
    ).toBe(true);
    expect(liveElements()).toHaveLength(1);
    expect(handle.state.activeLayerId).toBe(l1.id);
  });

  it("layer visibility and names survive save and restore", async () => {
    await setup();
    addLayer("Buttons");
    act(() => handle.app.layers.setVisible(handle.state.layers[0].id, false));
    const json = JSON.parse(
      serializeAsJSON(handle.elements, handle.state, {}, "local"),
    );
    const appState = restoreAppState(json.appState, null);
    expect(appState.layers.map((layer) => [layer.name, layer.visible])).toEqual(
      [
        ["Layer 1", false],
        ["Buttons", true],
      ],
    );
    expect(appState.activeLayerId).toBe(handle.state.layers[1].id);
    const els = restoreElements(json.elements, null);
    expect(els.map((element) => getLayerId(element))).toEqual([
      handle.state.layers[0].id,
      handle.state.layers[0].id,
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
    expect(handle.state.layers[1].name).toBe("Buttons");

    fireEvent.click(screen.getAllByTestId("layer-visible")[0]);
    expect(handle.state.layers[1].visible).toBe(false);

    fireEvent.click(screen.getByTestId("layer-delete"));
    expect(handle.state.layers).toHaveLength(1);
  });

  it("clicking the square selects every object of the layer", async () => {
    const { first, second } = await open();
    fireEvent.click(screen.getByTestId("layer-add"));
    fireEvent.click(screen.getAllByTestId("layer-select")[1]);
    expect(Object.keys(handle.state.selectedElementIds).sort()).toEqual(
      [first.id, second.id].sort(),
    );
  });

  it("dragging a layer row reorders the layers", async () => {
    await open();
    fireEvent.click(screen.getByTestId("layer-add"));
    const [bottom, top] = handle.state.layers;
    const rows = screen.getAllByTestId("layer-row");
    const store: Record<string, string> = {};
    const dataTransfer = {
      setData: (key: string, value: string) => (store[key] = value),
      getData: (key: string) => store[key],
      effectAllowed: "",
    };
    // the bottom row dropped on the upper half of the top one goes above it
    fireEvent.dragStart(rows[1], { dataTransfer });
    fireEvent.drop(rows[0], { dataTransfer });
    expect(handle.state.layers.map((layer) => layer.id)).toEqual([
      top.id,
      bottom.id,
    ]);
  });

  it("the layer fill colour restyles its objects", async () => {
    const { first, second } = await open();
    fireEvent.click(screen.getByTestId("layer-add"));
    fireEvent.click(screen.getAllByTestId("layer-row")[1]);
    fireEvent.change(screen.getByTestId("layer-fill"), {
      target: { value: "#0000ff" },
    });
    for (const id of [first.id, second.id]) {
      expect(
        handle.elements.find((element) => element.id === id)!.backgroundColor,
      ).toBe("#0000ff");
    }
  });
});
