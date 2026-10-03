import React from "react";

import { reseed } from "@excalidraw/common";

import { Excalidraw } from "../index";
import { nestGroups, groupLabel } from "../components/inspector/LayersTree";
import { buildElements } from "@excalidraw/symbols";
import { COMPONENTS, defaultsOf } from "@excalidraw/symbols";
import { THEMES } from "@excalidraw/symbols";

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

const rect = (id: string, groupIds: string[] = []) =>
  API.createElement({
    type: "rectangle",
    id,
    groupIds,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  } as any);

describe("grouped objects in the layers", () => {
  it("nests groups the way they are: outer first, then inner, then shapes", () => {
    const els = [
      rect("a", ["inner", "outer"]),
      rect("b", ["inner", "outer"]),
      rect("c", ["outer"]),
      rect("d"),
    ] as any[];
    const tree = nestGroups(els);
    expect(tree.map((n) => n.kind)).toEqual(["group", "el"]);
    const outer = tree[0] as any;
    expect(outer.id).toBe("outer");
    expect(outer.members).toHaveLength(3);
    expect(outer.children.map((n: any) => n.kind)).toEqual(["group", "el"]);
    expect(outer.children[0].id).toBe("inner");
    expect(outer.children[0].children).toHaveLength(2);
  });

  it("labels a group by what the user said, what a symbol is, or Group", () => {
    const def = COMPONENTS.find((c) => c.id === "toggle")!;
    const symbol = buildElements(
      def.shapes(THEMES[2], defaultsOf(def)),
      THEMES[2],
      { x: 0, y: 0 },
      "toggle",
    );
    expect(groupLabel(symbol as any)).toBe("Toggle");
    const named = symbol.map((e) => ({
      ...e,
      customData: { ...e.customData, groupLabel: "Dark mode switch" },
    }));
    expect(groupLabel(named as any)).toBe("Dark mode switch");
    expect(groupLabel([rect("x", ["g"])] as any)).toBe("Group");
  });

  describe("in the panel", () => {
    beforeAll(() => {
      mockBoundingClientRect({ width: 1000, height: 1000 });
    });
    afterAll(() => {
      restoreOriginalGetBoundingClientRect();
    });

    it("shows a group as one row that opens, selects all its shapes and renames", async () => {
      await render(<Excalidraw />);
      const els = [rect("a", ["g1"]), rect("b", ["g1"]), rect("c")];
      API.setElements(els as any);
      act(() => h.app.layers.add("Top"));
      API.setAppState({ paletteOpen: true });
      fireEvent.click(screen.getByText("Layers"));
      // the group is one row; the loose shape another
      expect(screen.getAllByTestId("layer-group-row")).toHaveLength(1);
      expect(screen.getAllByTestId("inspector-layer")).toHaveLength(1);
      expect(screen.getByTestId("layer-group-name").textContent).toBe("Group");

      fireEvent.click(screen.getByTestId("layer-group-toggle"));
      expect(screen.getAllByTestId("inspector-layer")).toHaveLength(3);

      fireEvent.click(screen.getByTestId("layer-group-row"));
      expect(Object.keys(h.state.selectedElementIds).sort()).toEqual([
        "a",
        "b",
      ]);
      expect(h.state.selectedGroupIds).toEqual({ g1: true });

      fireEvent.doubleClick(screen.getByTestId("layer-group-name"));
      const input = screen.getByTestId("layer-group-input");
      fireEvent.change(input, { target: { value: "Toolbar" } });
      fireEvent.blur(input);
      expect(screen.getByTestId("layer-group-name").textContent).toBe(
        "Toolbar",
      );
      expect(
        h.elements
          .filter((e) => e.groupIds[0] === "g1")
          .every((e) => e.customData?.groupLabel === "Toolbar"),
      ).toBe(true);
    });
  });
});

describe("modes", () => {
  it("snapping to objects and the grid can both be on", async () => {
    await render(<Excalidraw />);
    act(() => h.setState({ paletteOpen: true } as any));
    fireEvent.click(screen.getByTestId("mode-grid"));
    fireEvent.click(screen.getByTestId("mode-snap-objects"));
    expect(h.state.gridModeEnabled).toBe(true);
    expect(h.state.objectsSnapModeEnabled).toBe(true);
    // the grid is drawn, and the objects win over its lines
    expect(h.app.getEffectiveGridSize()).toBeNull();
    fireEvent.click(screen.getByTestId("mode-snap-objects"));
    expect(h.app.getEffectiveGridSize()).toBe(h.state.gridSize);
  });

  it("the guides can be locked from the palette, so they cannot be grabbed", async () => {
    await render(<Excalidraw />);
    act(() =>
      h.setState({
        paletteOpen: true,
        rulersEnabled: true,
        guides: [{ id: "g", axis: "x", position: 100 }],
      } as any),
    );
    expect(
      h.app.guides.hitGuide({
        clientX: 100 + h.state.offsetLeft + h.state.scrollX,
        clientY: 50,
      }),
    ).not.toBeNull();
    fireEvent.click(screen.getByTestId("mode-lock-guides"));
    expect(h.state.guidesLocked).toBe(true);
    expect(
      h.app.guides.hitGuide({
        clientX: 100 + h.state.offsetLeft + h.state.scrollX,
        clientY: 50,
      }),
    ).toBeNull();
  });
});
