import React from "react";

import { getSymbolMeta } from "@excalidraw/symbols";
import { customOf, detectParams, isCustom } from "@excalidraw/symbols";
import { setCustomParam } from "@excalidraw/symbols";
import { generateSceneCode } from "@excalidraw/symbols";
import { DEFAULT_THEME } from "@excalidraw/symbols";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { actionConvertToSymbol } from "../actions";
import { Excalidraw } from "../index";

import { liveElements } from "./helpers/fixtures";
import { API } from "./helpers/api";
import {
  act,
  fireEvent,
  render,
  screen,
  unmountComponent,
  waitFor,
} from "./test-utils";

unmountComponent();
const handle = window.h;

/** a drawn button: a rounded blue box with a dark outline, a label, and a small dot */
const drawButton = () => {
  const box = API.createElement({
    type: "rectangle",
    x: 100,
    y: 100,
    width: 160,
    height: 48,
    backgroundColor: "#4f8dff",
    strokeColor: "#14142b",
    strokeWidth: 2,
    groupIds: ["g-button"],
  } as any);
  const label = API.createElement({
    type: "text",
    x: 140,
    y: 112,
    text: "Buy now",
    fontSize: 20,
    strokeColor: "#ffffff",
    groupIds: ["g-button"],
  } as any);
  const dot = API.createElement({
    type: "ellipse",
    x: 110,
    y: 116,
    width: 14,
    height: 14,
    backgroundColor: "#ff6b57",
    strokeColor: "transparent",
    groupIds: ["g-button"],
  } as any);
  return { box, label, dot, all: [box, label, dot] as ExcalidrawElement[] };
};

const byId = (id: string) =>
  handle.elements.find((element) => element.id === id) as any;

describe("custom symbols", () => {
  it("suggests parameters from what is drawn", () => {
    const { all } = drawButton();
    const params = detectParams(all);
    expect(params.map((param) => [param.key, param.kind, param.value])).toEqual(
      [
        ["background", "color", "#4f8dff"],
        ["accent", "color", "#ff6b57"],
        ["outline", "color", "#14142b"],
        ["ink", "color", "#ffffff"],
        ["text1", "text", "Buy now"],
      ],
    );
  });

  it("converts a group into a symbol that keeps its drawing and carries its parameters", async () => {
    await render(<Excalidraw />);
    const { box, label, dot, all } = drawButton();
    API.setElements(all);
    API.setSelectedElements([box, label, dot]);
    act(() => handle.app.actionManager.executeAction(actionConvertToSymbol));
    const members = liveElements();
    expect(members.every((element) => isCustom(element))).toBe(true);
    // the drawing is untouched, the symbol's group is the innermost
    expect(byId(box.id)).toMatchObject({ x: 100, backgroundColor: "#4f8dff" });
    const group = getSymbolMeta(members[0])!.group;
    expect(members.every((element) => element.groupIds[0] === group)).toBe(
      true,
    );
    const { params, parts } = customOf(members);
    expect(params.length).toBe(5);
    expect(parts.map((element) => element.id)).toEqual([
      box.id,
      label.id,
      dot.id,
    ]);
  });

  it("sets a parameter on every part it reaches, in the panel", async () => {
    await render(<Excalidraw />);
    API.setAppState({ paletteOpen: true });
    const { box, label, dot, all } = drawButton();
    API.setElements(all);
    API.setSelectedElements([box, label, dot]);
    fireEvent.click(screen.getByTestId("inspector-tab-symbols"));
    fireEvent.click(await screen.findByTestId("symbols-convert"));
    await waitFor(() =>
      expect(screen.getAllByTestId("symbols-custom-param")).toHaveLength(5),
    );

    // the background: a colour field
    fireEvent.change(screen.getByTestId("symbols-param-background-picker"), {
      target: { value: "#00aa55" },
    });
    expect(byId(box.id).backgroundColor).toBe("#00aa55");
    expect(byId(dot.id).backgroundColor).toBe("#ff6b57"); // the accent is its own parameter

    // the text
    const text = screen.getByTestId("symbols-param-text1") as HTMLInputElement;
    fireEvent.change(text, { target: { value: "Pay" } });
    fireEvent.blur(text);
    expect(byId(label.id).text).toBe("Pay");

    // the parameters are in the elements: a rename and a removal stay with them
    const name = screen.getAllByLabelText(
      "Parameter name",
    )[0] as HTMLInputElement;
    fireEvent.change(name, { target: { value: "Fill" } });
    fireEvent.blur(name);
    expect(customOf(liveElements()).params[0].label).toBe("Fill");
    fireEvent.click(screen.getByTestId("symbols-param-remove-accent"));
    expect(
      customOf(liveElements()).params.map((param) => param.key),
    ).not.toContain("accent");
  });

  it("a part exposes more of itself, and a copy keeps parameters of its own", async () => {
    await render(<Excalidraw />);
    API.setAppState({ paletteOpen: true });
    const { box, label, dot, all } = drawButton();
    API.setElements(all);
    API.setSelectedElements([box, label, dot]);
    act(() => handle.app.actionManager.executeAction(actionConvertToSymbol));
    // one part inside: expose its line width
    API.setSelectedElements([byId(box.id)]);
    fireEvent.click(screen.getByTestId("inspector-tab-symbols"));
    fireEvent.change(await screen.findByTestId("symbols-expose-prop"), {
      target: { value: "strokeWidth" },
    });
    fireEvent.change(screen.getByTestId("symbols-expose-label"), {
      target: { value: "Line" },
    });
    fireEvent.click(screen.getByTestId("symbols-expose"));
    const line = customOf(liveElements()).params.find(
      (param) => param.label === "Line",
    )!;
    expect(line.targets).toEqual([{ part: 0, prop: "strokeWidth" }]);

    // a copy through the library path: its own group, the same parameters, independent
    const known = new Set(liveElements().map((element) => element.id));
    act(() => {
      handle.app.addElementsFromPasteOrLibrary({
        elements: liveElements() as any,
        files: null,
        position: { clientX: 600, clientY: 400 },
      });
    });
    const copy = liveElements().filter((element) => !known.has(element.id));
    expect(copy).toHaveLength(3);
    expect(isCustom(copy[0])).toBe(true);
    expect(customOf(copy).params.map((param) => param.key)).toEqual(
      customOf(
        liveElements().filter((element) => known.has(element.id)),
      ).params.map((param) => param.key),
    );
    act(() => setCustomParam(handle.app.scene, copy, "background", "#112233"));
    expect(byId(copy[0].id).backgroundColor).toBe("#112233");
    expect(byId(box.id).backgroundColor).toBe("#4f8dff");
    // setting the line width on the copy only touches the copy
    act(() => setCustomParam(handle.app.scene, copy, "line", 6));
    expect(byId(copy[0].id).strokeWidth).toBe(6);
    expect(byId(box.id).strokeWidth).toBe(2);
  });

  it("a custom symbol is drawn where it is in the whole-canvas code export", async () => {
    await render(<Excalidraw />);
    const { box, label, dot, all } = drawButton();
    API.setElements(all);
    API.setSelectedElements([box, label, dot]);
    act(() => handle.app.actionManager.executeAction(actionConvertToSymbol));
    const code = generateSceneCode(liveElements() as any, DEFAULT_THEME)!;
    expect(code.html).toContain("#4f8dff");
    expect(code.html).toContain("Buy now");
  });
});
