import React from "react";

import { reseed } from "@excalidraw/common";

import { Excalidraw } from "../index";
import { applyFlow, getFlowMeta, readFlow } from "../flow/flowCanvas";
import {
  addLink,
  addPlaceholder,
  fillPlaceholder,
  wrapAsFlowElement,
} from "../flow/flowElement";
import { parseFlow, serializeFlow } from "../flow/flowGraph";

import { API } from "./helpers/api";
import {
  act,
  fireEvent,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  unmountComponent,
} from "./test-utils";
import { actionConvertToFlowElement } from "../actions";

unmountComponent();

const { h } = window;

beforeEach(() => {
  localStorage.clear();
  reseed(7);
});

const live = () => h.elements.filter((e) => !e.isDeleted);
const text = () => serializeFlow(readFlow(h.elements, "F"));
const scene = () => h.app.scene;

const box = (x: number, y: number, w = 100, h2 = 60) =>
  API.createElement({ type: "rectangle", x, y, width: w, height: h2 } as any);

describe("flow elements", () => {
  it("wraps objects in an outline, a label and a handle, in one group", async () => {
    await render(<Excalidraw />);
    const a = box(0, 0);
    API.setElements([a]);
    const made = act(() =>
      wrapAsFlowElement(scene(), [a], "F", { label: "Buy" }),
    );
    void made;
    const parts = live().filter((e) => getFlowMeta(e));
    expect(parts.map((e) => getFlowMeta(e)!.kind).sort()).toEqual([
      "handle",
      "label",
      "node",
    ]);
    const group = getFlowMeta(
      parts.find((p) => getFlowMeta(p)!.kind === "node")!,
    )!.group!;
    // the wrapped box stays itself and shares the group
    const wrapped = live().find((e) => e.id === a.id)!;
    expect(wrapped.groupIds).toEqual([group]);
    expect(live().every((e) => e.groupIds.includes(group))).toBe(true);
    expect(text()).toContain('buy["Buy"]');
    // wrapping the same group again does nothing
    expect(
      wrapAsFlowElement(
        scene(),
        live().filter((e) => e.id === a.id),
        "F",
      ),
    ).toBeNull();
  });

  it("links flow elements, a screen holds its parts, links reach screens", async () => {
    await render(<Excalidraw />);
    const a = box(0, 0);
    const b = box(400, 0);
    const c = box(0, 300, 300, 200);
    API.setElements([a, b, c]);
    act(() => {
      wrapAsFlowElement(scene(), [a], "F", { label: "Buy" });
      wrapAsFlowElement(scene(), [b], "F", { label: "Pay" });
      addLink(scene(), "F", "buy", "pay", "click");
    });
    expect(text()).toContain('buy -->|"click"| pay');
    // select the button's flow element and the drawing under it: a screen
    act(() => {
      wrapAsFlowElement(scene(), [a, c], "F", { label: "Home" });
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
      wrapAsFlowElement(scene(), [a, c, b], "F", { label: "App" });
    });
    expect(text()).toMatch(/subgraph app\["App"\]/);
    expect(text()).toMatch(/subgraph home\["Home"\]/);
  });

  it("text edits relabel and unwrap without touching the drawing", async () => {
    await render(<Excalidraw />);
    const a = box(0, 0);
    const b = box(400, 0);
    API.setElements([a, b]);
    act(() => {
      wrapAsFlowElement(scene(), [a], "F", { label: "Buy" });
      wrapAsFlowElement(scene(), [b], "F", { label: "Pay" });
      addLink(scene(), "F", "buy", "pay");
    });
    const before = live().find((e) => e.id === a.id)!;
    act(() => {
      const { graph } = parseFlow(`flowchart TD
        buy["Purchase"]
        pay["Pay"]
        buy --> pay`);
      applyFlow(scene(), "F", graph, { x: 0, y: 0 });
    });
    expect(text()).toContain('buy["Purchase"]');
    expect(live().find((e) => e.id === a.id)).toMatchObject({
      x: before.x,
      y: before.y,
      width: before.width,
    });
    expect(live().filter((e) => e.type === "arrow")).toHaveLength(1);
    // dropping a step from the text unwraps it: the box stays
    act(() => {
      const { graph } = parseFlow(`flowchart TD
        buy["Purchase"]`);
      applyFlow(scene(), "F", graph, { x: 0, y: 0 });
    });
    expect(live().some((e) => e.id === b.id)).toBe(true);
    expect(live().find((e) => e.id === b.id)!.groupIds).toEqual([]);
    expect(live().filter((e) => e.type === "arrow")).toHaveLength(0);
    expect(text()).not.toContain("pay");
  });

  it("a placeholder is replaced by the objects selected with it", async () => {
    await render(<Excalidraw />);
    const a = box(0, 0);
    API.setElements([a]);
    let from = "";
    act(() => {
      from = wrapAsFlowElement(scene(), [a], "F", { label: "Buy" })!.key;
      addPlaceholder(scene(), "F", { x: 500, y: 300 });
    });
    const placeholder = live().find((e) => getFlowMeta(e)?.placeholder)!;
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
    const moved = live().find((e) => e.id === real.id)!;
    // it took the place of the placeholder box, which is gone
    expect(moved.x + moved.width / 2).toBeCloseTo(500, 0);
    expect(live().some((e) => e.customData?.flowPlaceholder)).toBe(false);
    expect(
      getFlowMeta(live().find((e) => e.id === placeholder.id)!)!.placeholder,
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
      const el = live().find(
        (e) => getFlowMeta(e)?.kind === "handle" && getFlowMeta(e)!.key === key,
      )!;
      return { x: el.x + el.width / 2, y: el.y + el.height / 2 };
    };
    const client = (p: { x: number; y: number }) => ({
      clientX: p.x + h.state.scrollX + h.state.offsetLeft,
      clientY: p.y + h.state.scrollY + h.state.offsetTop,
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
      const a = box(0, 0);
      API.setElements([a]);
      act(() => {
        wrapAsFlowElement(scene(), [a], "F", { label: "Buy" });
      });
      const before = live().length;
      drag(handleOf("buy"), { x: 600, y: 300 });
      expect(live().length).toBeGreaterThan(before);
      const placeholder = live().find((e) => getFlowMeta(e)?.placeholder)!;
      expect(placeholder).toBeTruthy();
      expect(text()).toContain(`buy --> ${getFlowMeta(placeholder)!.key}`);
      // it is a flow element with a handle of its own: the chain goes on
      expect(
        live().filter((e) => getFlowMeta(e)?.kind === "handle"),
      ).toHaveLength(2);
    });

    it("released on a flow element or on a plain object: a link", async () => {
      await render(<Excalidraw />);
      const a = box(0, 0);
      const b = box(400, 0);
      const c = box(0, 400, 200, 100);
      API.setElements([a, b, c]);
      act(() => {
        wrapAsFlowElement(scene(), [a], "F", { label: "Buy" });
        wrapAsFlowElement(scene(), [b], "F", { label: "Pay" });
      });
      drag(handleOf("buy"), { x: 450, y: 30 });
      expect(text()).toContain("buy --> pay");
      // a plain object becomes a flow element when a link reaches it
      drag(handleOf("pay"), { x: 100, y: 450 });
      expect(
        live().some(
          (e) => getFlowMeta(e)?.kind === "handle" && e.x > 180 && e.y > 400,
        ),
      ).toBe(true);
      expect(text()).toMatch(/pay --> \w+/);
      expect(live().find((e) => e.id === c.id)!.groupIds).toHaveLength(1);
    });

    it("a click on the handle changes nothing", async () => {
      await render(<Excalidraw />);
      const a = box(0, 0);
      API.setElements([a]);
      act(() => {
        wrapAsFlowElement(scene(), [a], "F", { label: "Buy" });
      });
      const before = live().length;
      drag(handleOf("buy"), handleOf("buy"));
      expect(live()).toHaveLength(before);
    });

    it("the action converts the selection", async () => {
      await render(<Excalidraw />);
      const a = box(0, 0);
      API.setElements([a]);
      API.setSelectedElements([a]);
      act(() => h.app.actionManager.executeAction(actionConvertToFlowElement));
      expect(serializeFlow(readFlow(h.elements, "Flow 1"))).toContain(
        'step["Step"]',
      );
      expect(live().filter((e) => getFlowMeta(e))).toHaveLength(3);
      // and the flow element is what is selected
      expect(Object.keys(h.state.selectedElementIds)).toHaveLength(4);
    });
  });
});
