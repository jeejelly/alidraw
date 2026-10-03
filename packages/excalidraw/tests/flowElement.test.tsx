import React from "react";

import { getCommonBounds } from "@excalidraw/element";

import { applyFlow, getFlowMeta, readFlow } from "@excalidraw/flow";
import {
  addLink,
  addPlaceholder,
  fillPlaceholder,
  wrapAsFlowElement,
} from "@excalidraw/flow";
import { parseFlow, serializeFlow } from "@excalidraw/flow";
import { buildElements } from "@excalidraw/symbols";
import { COMPONENTS, defaultsOf } from "@excalidraw/symbols";
import { DEFAULT_THEME } from "@excalidraw/symbols";

import { Excalidraw } from "../index";

import { actionConvertToFlowElement } from "../actions";

import { API } from "./helpers/api";
import {
  act,
  fireEvent,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  unmountComponent,
} from "./test-utils";
import { liveElements, resetTestState } from "./helpers/fixtures";

unmountComponent();

const handle = window.h;

beforeEach(resetTestState);

const text = () => serializeFlow(readFlow(handle.elements, "F"));
const scene = () => handle.app.scene;

const box = (x: number, y: number, width = 100, h2 = 60) =>
  API.createElement({
    type: "rectangle",
    x,
    y,
    width,
    height: h2,
  } as any);

describe("flow elements", () => {
  it("wraps objects in an outline, a label and a handle, in one group", async () => {
    await render(<Excalidraw />);
    const first = box(0, 0);
    API.setElements([first]);
    const made = act(() =>
      wrapAsFlowElement(scene(), [first], "F", { label: "Buy" }),
    );
    void made;
    const parts = liveElements().filter((element) => getFlowMeta(element));
    expect(parts.map((element) => getFlowMeta(element)!.kind).sort()).toEqual([
      "handle",
      "label",
      "node",
    ]);
    const group = getFlowMeta(
      parts.find((part) => getFlowMeta(part)!.kind === "node")!,
    )!.group!;
    // the wrapped box stays itself and shares the group
    const wrapped = liveElements().find((element) => element.id === first.id)!;
    expect(wrapped.groupIds).toEqual([group]);
    expect(
      liveElements().every((element) => element.groupIds.includes(group)),
    ).toBe(true);
    expect(text()).toContain('buy["Buy"]');
    // wrapping the same group again does nothing
    expect(
      wrapAsFlowElement(
        scene(),
        liveElements().filter((element) => element.id === first.id),
        "F",
      ),
    ).toBeNull();
  });

  it("links flow elements, a screen holds its parts, links reach screens", async () => {
    await render(<Excalidraw />);
    const first = box(0, 0);
    const second = box(400, 0);
    const third = box(0, 300, 300, 200);
    API.setElements([first, second, third]);
    act(() => {
      wrapAsFlowElement(scene(), [first], "F", { label: "Buy" });
      wrapAsFlowElement(scene(), [second], "F", { label: "Pay" });
      addLink(scene(), "F", "buy", "pay", "click");
    });
    expect(text()).toContain('buy -->|"click"| pay');
    // select the button's flow element and the drawing under it: a screen
    act(() => {
      wrapAsFlowElement(scene(), [first, third], "F", { label: "Home" });
    });
    const source = text();
    expect(source).toContain('subgraph home["Home"]');
    expect(source).toMatch(/subgraph home\["Home"\]\n\s+buy\["Buy"\]\n\s+end/);
    // a link from a step to a screen
    act(() => {
      addLink(scene(), "F", "pay", "home", "back");
    });
    expect(text()).toContain('pay -->|"back"| home');
    // a screen made of flow elements nests in another one
    act(() => {
      wrapAsFlowElement(scene(), [first, third, second], "F", { label: "App" });
    });
    expect(text()).toMatch(/subgraph app\["App"\]/);
    expect(text()).toMatch(/subgraph home\["Home"\]/);
  });

  it("text edits relabel and unwrap without touching the drawing", async () => {
    await render(<Excalidraw />);
    const first = box(0, 0);
    const second = box(400, 0);
    API.setElements([first, second]);
    act(() => {
      wrapAsFlowElement(scene(), [first], "F", { label: "Buy" });
      wrapAsFlowElement(scene(), [second], "F", { label: "Pay" });
      addLink(scene(), "F", "buy", "pay");
    });
    const before = liveElements().find((element) => element.id === first.id)!;
    act(() => {
      const { graph } = parseFlow(`flowchart TD
        buy["Purchase"]
        pay["Pay"]
        buy --> pay`);
      applyFlow(scene(), "F", graph, { x: 0, y: 0 });
    });
    expect(text()).toContain('buy["Purchase"]');
    expect(
      liveElements().find((element) => element.id === first.id),
    ).toMatchObject({
      x: before.x,
      y: before.y,
      width: before.width,
    });
    expect(
      liveElements().filter((element) => element.type === "arrow"),
    ).toHaveLength(1);
    // dropping a step from the text unwraps it: the box stays
    act(() => {
      const { graph } = parseFlow(`flowchart TD
        buy["Purchase"]`);
      applyFlow(scene(), "F", graph, { x: 0, y: 0 });
    });
    expect(liveElements().some((element) => element.id === second.id)).toBe(
      true,
    );
    expect(
      liveElements().find((element) => element.id === second.id)!.groupIds,
    ).toEqual([]);
    expect(
      liveElements().filter((element) => element.type === "arrow"),
    ).toHaveLength(0);
    expect(text()).not.toContain("pay");
  });

  it("a placeholder is replaced by the objects selected with it", async () => {
    await render(<Excalidraw />);
    const first = box(0, 0);
    API.setElements([first]);
    let from = "";
    act(() => {
      from = wrapAsFlowElement(scene(), [first], "F", { label: "Buy" })!.key;
      addPlaceholder(scene(), "F", { x: 500, y: 300 });
    });
    const placeholder = liveElements().find(
      (element) => getFlowMeta(element)?.placeholder,
    )!;
    const key = getFlowMeta(placeholder)!.key;
    act(() => {
      addLink(scene(), "F", from, key);
    });
    expect(text()).toContain(`buy --> ${key}`);
    const real = box(900, 900, 120, 120);
    act(() => {
      scene().replaceAllElements([
        ...scene().getElementsIncludingDeleted(),
        real,
      ]);
    });
    let result: string | null = null;
    act(() => {
      result = fillPlaceholder(scene(), [placeholder, real], "F");
    });
    expect(result).toBe(key);
    const moved = liveElements().find((element) => element.id === real.id)!;
    // it took the place of the placeholder box, which is gone
    expect(moved.x + moved.width / 2).toBeCloseTo(500, 0);
    expect(
      liveElements().some((element) => element.customData?.flowPlaceholder),
    ).toBe(false);
    expect(
      getFlowMeta(
        liveElements().find((element) => element.id === placeholder.id)!,
      )!.placeholder,
    ).toBe(false);
    expect(text()).toContain(`buy --> ${key}`);
  });

  describe("the handle", () => {
    beforeAll(() => {
      mockBoundingClientRect({ width: 1000, height: 1000 });
    });
    afterAll(() => {
      restoreOriginalGetBoundingClientRect();
    });

    const handleOf = (key: string) => {
      const el = liveElements().find(
        (element) =>
          getFlowMeta(element)?.kind === "handle" &&
          getFlowMeta(element)!.key === key,
      )!;
      return { x: el.x + el.width / 2, y: el.y + el.height / 2 };
    };
    const client = (point: { x: number; y: number }) => ({
      clientX: point.x + handle.state.scrollX + handle.state.offsetLeft,
      clientY: point.y + handle.state.scrollY + handle.state.offsetTop,
    });
    const drag = (
      from: { x: number; y: number },
      to: { x: number; y: number },
    ) => {
      const canvas = document.querySelector("canvas.interactive")!;
      fireEvent.pointerDown(canvas, client(from));
      fireEvent.pointerMove(window, client(to));
      fireEvent.pointerUp(window, client(to));
    };

    it("released on nothing: a placeholder, linked", async () => {
      await render(<Excalidraw />);
      const first = box(0, 0);
      API.setElements([first]);
      act(() => {
        wrapAsFlowElement(scene(), [first], "F", { label: "Buy" });
      });
      const before = liveElements().length;
      drag(handleOf("buy"), { x: 600, y: 300 });
      expect(liveElements().length).toBeGreaterThan(before);
      const placeholder = liveElements().find(
        (element) => getFlowMeta(element)?.placeholder,
      )!;
      expect(placeholder).toBeTruthy();
      expect(text()).toContain(`buy --> ${getFlowMeta(placeholder)!.key}`);
      // it is a flow element with a handle of its own: the chain goes on
      expect(
        liveElements().filter(
          (element) => getFlowMeta(element)?.kind === "handle",
        ),
      ).toHaveLength(2);
    });

    it("released on a flow element or on a plain object: a link", async () => {
      await render(<Excalidraw />);
      const first = box(0, 0);
      const second = box(400, 0);
      const third = box(0, 400, 200, 100);
      API.setElements([first, second, third]);
      act(() => {
        wrapAsFlowElement(scene(), [first], "F", { label: "Buy" });
        wrapAsFlowElement(scene(), [second], "F", { label: "Pay" });
      });
      drag(handleOf("buy"), { x: 450, y: 30 });
      expect(text()).toContain("buy --> pay");
      // a plain object becomes a flow element when a link reaches it
      drag(handleOf("pay"), { x: 100, y: 450 });
      expect(
        liveElements().some(
          (element) =>
            getFlowMeta(element)?.kind === "handle" &&
            element.x > 180 &&
            element.y > 400,
        ),
      ).toBe(true);
      expect(text()).toMatch(/pay --> \w+/);
      expect(
        liveElements().find((element) => element.id === third.id)!.groupIds,
      ).toHaveLength(1);
    });

    it("a click on the handle changes nothing", async () => {
      await render(<Excalidraw />);
      const first = box(0, 0);
      API.setElements([first]);
      act(() => {
        wrapAsFlowElement(scene(), [first], "F", { label: "Buy" });
      });
      const before = liveElements().length;
      drag(handleOf("buy"), handleOf("buy"));
      expect(liveElements()).toHaveLength(before);
    });

    it("the action converts the selection", async () => {
      await render(<Excalidraw />);
      const first = box(0, 0);
      API.setElements([first]);
      API.setSelectedElements([first]);
      act(() =>
        handle.app.actionManager.executeAction(actionConvertToFlowElement),
      );
      expect(serializeFlow(readFlow(handle.elements, "Flow 1"))).toContain(
        'step["Step"]',
      );
      expect(
        liveElements().filter((element) => getFlowMeta(element)),
      ).toHaveLength(3);
      // and the flow element is what is selected
      expect(Object.keys(handle.state.selectedElementIds)).toHaveLength(4);
    });
  });

  describe("replacing from the library", () => {
    const libraryItem = () => {
      const def = COMPONENTS.find((component) => component.id === "button")!;
      const values = defaultsOf(def);
      return {
        id: "lib-button",
        status: "unpublished" as const,
        created: 1,
        elements: buildElements(
          def.shapes(DEFAULT_THEME, values),
          DEFAULT_THEME,
          { x: 0, y: 0 },
          "button",
          values,
        ),
      };
    };

    it.each([
      ["what it wraps", false],
      ["the whole flow element", true],
    ])("replaces %s, never the flow element", async (_name, whole) => {
      await render(<Excalidraw />);
      const first = box(0, 0, 200, 80);
      const second = box(600, 0);
      API.setElements([first, second]);
      act(() => {
        wrapAsFlowElement(scene(), [first], "F", { label: "Buy" });
        wrapAsFlowElement(scene(), [second], "F", { label: "Pay" });
        addLink(scene(), "F", "buy", "pay");
      });
      const outline = liveElements().find(
        (element) =>
          getFlowMeta(element)?.kind === "node" &&
          getFlowMeta(element)!.key === "buy",
      )!;
      const group = getFlowMeta(outline)!.group!;
      const pick = whole
        ? liveElements().filter((element) => element.groupIds.includes(group))
        : [liveElements().find((element) => element.id === first.id)!];
      API.setSelectedElements(pick as any);
      act(() =>
        handle.app.replaceSelectionWithLibraryItem(libraryItem() as any),
      );

      // the flow element is the same one, with its label, handle and link
      const kept = liveElements().find((element) => element.id === outline.id)!;
      expect(getFlowMeta(kept)).toMatchObject({ key: "buy", wrap: true });
      expect(
        liveElements().some(
          (element) =>
            getFlowMeta(element)?.kind === "label" &&
            getFlowMeta(element)!.key === "buy",
        ),
      ).toBe(true);
      expect(
        liveElements().filter(
          (element) => getFlowMeta(element)?.kind === "handle",
        ),
      ).toHaveLength(2);
      expect(
        liveElements().filter((element) => element.type === "arrow"),
      ).toHaveLength(1);
      expect(text()).toContain("buy --> pay");
      // the old box is gone and a button symbol took its place, inside the group
      expect(liveElements().some((element) => element.id === first.id)).toBe(
        false,
      );
      const symbols = liveElements().filter(
        (element) =>
          element.groupIds.includes(group) && element.customData?.symbol,
      );
      expect(symbols.length).toBeGreaterThan(0);
      // the outline hugs the new content
      const [x1, y1, x2, y2] = getCommonBounds(symbols);
      expect(kept.x).toBeLessThanOrEqual(x1);
      expect(kept.y).toBeLessThanOrEqual(y1);
      expect(kept.x + kept.width).toBeGreaterThanOrEqual(x2);
      expect(kept.y + kept.height).toBeGreaterThanOrEqual(y2);
    });
  });
});
