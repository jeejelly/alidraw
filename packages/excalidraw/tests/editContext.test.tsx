import React from "react";

import { getCommonBounds, getElementsInGroup } from "@excalidraw/element";
import {
  buildElements,
  COMPONENTS,
  defaultsOf,
  THEMES,
} from "@excalidraw/symbols";

import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { actionDuplicateSelection } from "../actions";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Pointer, UI } from "./helpers/ui";
import { render, unmountComponent } from "./test-utils";

unmountComponent();

const { h } = window;
const mouse = new Pointer("mouse");
const theme = THEMES[2];

const buildButton = (x: number, y: number) => {
  const def = COMPONENTS.find((component) => component.id === "button")!;
  return buildElements(def.shapes(theme, defaultsOf(def)), theme, { x, y });
};

const liveElements = () =>
  h.elements.filter((element) => !element.isDeleted) as ExcalidrawElement[];

describe("editing a library component", () => {
  let button: ExcalidrawElement[];
  let groupId: string;

  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
    button = buildButton(100, 100);
    groupId = button[0].groupIds[0];
    API.setElements(button);
  });

  const enterContext = () => {
    const pill = button.find((element) => element.type === "path")!;
    mouse.doubleClickOn(pill);
  };

  it("a double click on a symbol makes it the drawing context", () => {
    expect(h.state.editingGroupId).toBe(null);
    enterContext();
    expect(h.state.editingGroupId).toBe(groupId);
  });

  it("a shape drawn inside joins the component", () => {
    enterContext();
    const [minX, minY] = getCommonBounds(button);
    UI.createElement("rectangle", { x: minX + 10, y: minY + 10, size: 8 });
    const drawn = liveElements().at(-1)!;
    expect(drawn.type).toBe("rectangle");
    expect(drawn.groupIds).toContain(groupId);
    expect(h.state.editingGroupId).toBe(groupId);
    expect(
      getElementsInGroup(h.app.scene.getNonDeletedElementsMap(), groupId),
    ).toContain(drawn);
  });

  it("starting a shape outside the component ends the editing", () => {
    enterContext();
    UI.createElement("rectangle", { x: 700, y: 700, size: 20 });
    const drawn = liveElements().at(-1)!;
    expect(drawn.groupIds).toEqual([]);
    expect(h.state.editingGroupId).toBe(null);
  });

  it("a library item is added to the middle of the component", () => {
    enterContext();
    const extra = buildButton(900, 900);
    h.app.addElementsFromPasteOrLibrary({
      elements: extra,
      files: null,
      position: "center",
    });
    const members = getElementsInGroup(
      h.app.scene.getNonDeletedElementsMap(),
      groupId,
    );
    expect(members.length).toBeGreaterThan(button.length);
    const [minX, minY, maxX, maxY] = getCommonBounds(button);
    const added = members.filter(
      (element) => !button.some((original) => original.id === element.id),
    );
    const [addedMinX, addedMinY, addedMaxX, addedMaxY] = getCommonBounds(added);
    expect((addedMinX + addedMaxX) / 2).toBeCloseTo((minX + maxX) / 2, 0);
    expect((addedMinY + addedMaxY) / 2).toBeCloseTo((minY + maxY) / 2, 0);
  });

  it("a duplicate made while editing stays in the component", () => {
    enterContext();
    const pill = button.find((element) => element.type === "path")!;
    API.setSelectedElements([pill as NonDeletedExcalidrawElement]);
    API.setAppState({ editingGroupId: groupId });
    API.executeAction(actionDuplicateSelection);
    const copies = liveElements().filter(
      (element) => element.type === "path" && element.id !== pill.id,
    );
    expect(copies.length).toBe(1);
    expect(copies[0].groupIds).toContain(groupId);
  });
});
