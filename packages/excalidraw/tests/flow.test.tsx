import React from "react";

import { reseed } from "@excalidraw/common";

import { Excalidraw } from "../index";
import {
  adoptIntoFlow,
  applyFlow,
  listFlows,
  readFlow,
} from "@excalidraw/flow";
import { parseFlow, serializeFlow } from "@excalidraw/flow";

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

const live = () => h.elements.filter((e) => !e.isDeleted);
const byType = (t: string) => live().filter((e) => e.type === t);
const apply = (text: string, flow = "Checkout") => {
  const { graph, issues } = parseFlow(text);
  expect(issues).toEqual([]);
  act(() => {
    applyFlow(h.app.scene, flow, graph, { x: 100, y: 100 });
  });
};
const label = (el: any) =>
  (live().find((t: any) => t.type === "text" && t.containerId === el.id) as any)
    ?.text;

describe("flow on the canvas", () => {
  it("draws steps and glued links from text", async () => {
    await render(<Excalidraw />);
    apply(`flowchart TD
      a["Cart"] -->|"pay"| b{"OK?"}
      b --> c(("Done"))`);
    expect(byType("rectangle")).toHaveLength(1);
    expect(byType("diamond")).toHaveLength(1);
    expect(byType("ellipse")).toHaveLength(1);
    const arrows = byType("arrow") as any[];
    expect(arrows).toHaveLength(2);
    // glued at both ends, and the steps know about them
    for (const a of arrows) {
      expect(a.startBinding?.elementId).toBeTruthy();
      expect(a.endBinding?.elementId).toBeTruthy();
    }
    const rect = byType("rectangle")[0];
    expect((rect.boundElements ?? []).some((b) => b.id === arrows[0].id)).toBe(
      true,
    );
    expect(label(rect)).toBe("Cart");
    expect(arrows.map((a) => label(a)).sort()).toEqual(
      ["pay", undefined].sort(),
    );
    // laid out top to bottom
    const [r, d, c] = [rect, byType("diamond")[0], byType("ellipse")[0]];
    expect(r.y).toBeLessThan(d.y);
    expect(d.y).toBeLessThan(c.y);
    expect(listFlows(h.elements)).toEqual(["Checkout"]);
  });

  it("reads back what it drew", async () => {
    await render(<Excalidraw />);
    const text = `flowchart LR
      subgraph s1["Cart"]
        pay["Pay"]
      end
      ok(("Thanks"))
      pay -->|"click"| ok
      ok -.-> pay`;
    apply(text);
    const read = readFlow(h.elements, "Checkout");
    expect(serializeFlow(read)).toBe(serializeFlow(parseFlow(text).graph));
  });

  it("keeps positions and styles when the text changes, and follows renames", async () => {
    await render(<Excalidraw />);
    apply(`flowchart TD
      a["Cart"] --> b["Pay"]`);
    const a = byType("rectangle").find((e) => label(e) === "Cart")!;
    // the designer moves and recolours a step
    act(() => {
      h.app.scene.mutateElement(a, {
        x: 500,
        y: 40,
        backgroundColor: "#ffcc00",
      });
    });
    apply(`flowchart TD
      a["Basket"] --> b["Pay"]
      b --> c["Receipt"]`);
    const moved = live().find((e) => e.id === a.id)!;
    expect([moved.x, moved.y, moved.backgroundColor]).toEqual([
      500,
      40,
      "#ffcc00",
    ]);
    expect(label(moved)).toBe("Basket");
    expect(byType("rectangle")).toHaveLength(3);
    expect(byType("arrow")).toHaveLength(2);
    // the new step sits below the one it follows
    const pay = byType("rectangle").find((e) => label(e) === "Pay")!;
    const rec = byType("rectangle").find((e) => label(e) === "Receipt")!;
    expect(rec.y).toBeGreaterThan(pay.y);
  });

  it("removes steps and their links when they leave the text", async () => {
    await render(<Excalidraw />);
    apply(`flowchart TD
      a["A"] --> b["B"] --> c["C"]`);
    expect(byType("arrow")).toHaveLength(2);
    apply(`flowchart TD
      a["A"] --> b["B"]`);
    expect(byType("rectangle")).toHaveLength(2);
    expect(byType("arrow")).toHaveLength(1);
    expect(
      byType("text")
        .map((t: any) => t.text)
        .sort(),
    ).toEqual(["A", "B"]);
  });

  it("makes screens frames that hold their steps", async () => {
    await render(<Excalidraw />);
    apply(`flowchart LR
      subgraph cart["Cart"]
        pay["Pay"]
        back["Back"]
      end
      subgraph done["Done"]
        ok["Thanks"]
      end
      pay --> ok`);
    const frames = byType("frame") as any[];
    expect(frames.map((f) => f.name).sort()).toEqual(["Cart", "Done"]);
    const cart = frames.find((f) => f.name === "Cart");
    const pay = byType("rectangle").find((e) => label(e) === "Pay")!;
    expect(pay.frameId).toBe(cart.id);
    // the frame contains its steps
    for (const n of ["Pay", "Back"]) {
      const el = byType("rectangle").find((e) => label(e) === n)!;
      expect(el.x).toBeGreaterThanOrEqual(cart.x);
      expect(el.y + el.height).toBeLessThanOrEqual(cart.y + cart.height);
    }
    // dropping a subgraph from the text takes its frame, not its steps
    apply(`flowchart LR
      pay["Pay"] --> ok["Thanks"]`);
    expect(byType("frame")).toHaveLength(0);
    expect(byType("rectangle")).toHaveLength(2);
    expect(live().every((e) => !(e as any).frameId)).toBe(true);
  });

  it("adopts a drawn diagram into a flow", async () => {
    await render(<Excalidraw />);
    const a = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 120,
      height: 60,
    });
    const b = API.createElement({
      type: "diamond",
      x: 0,
      y: 200,
      width: 140,
      height: 90,
    });
    const ta = API.createElement({
      type: "text",
      text: "Buy",
      containerId: a.id,
      x: 10,
      y: 10,
    } as any);
    const tb = API.createElement({
      type: "text",
      text: "Sure?",
      containerId: b.id,
      x: 10,
      y: 210,
    } as any);
    const arrow = {
      ...API.createElement({
        type: "arrow",
        x: 60,
        y: 60,
        width: 0,
        height: 140,
      }),
      startBinding: { elementId: a.id, fixedPoint: [0.5, 1], mode: "orbit" },
      endBinding: { elementId: b.id, fixedPoint: [0.5, 0], mode: "orbit" },
      endArrowhead: "arrow",
    } as any;
    API.setElements([
      {
        ...a,
        boundElements: [
          { type: "text", id: ta.id },
          { type: "arrow", id: arrow.id },
        ],
      },
      ta,
      {
        ...b,
        boundElements: [
          { type: "text", id: tb.id },
          { type: "arrow", id: arrow.id },
        ],
      },
      tb,
      arrow,
    ] as any);
    let n = 0;
    act(() => {
      n = adoptIntoFlow(h.app.scene, [a, b] as any, "Buy flow");
    });
    expect(n).toBe(2);
    const text = serializeFlow(readFlow(h.elements, "Buy flow"));
    expect(text).toContain('buy["Buy"]');
    expect(text).toContain('sure{"Sure?"}');
    expect(text).toContain("buy --> sure");
  });
});

describe("flow panel", () => {
  beforeAll(() => {
    mockBoundingClientRect({ width: 1000, height: 1000 });
  });
  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  const open = async () => {
    await render(<Excalidraw />);
    API.setAppState({ paletteOpen: true });
    fireEvent.click(screen.getByTestId("inspector-tab-flow"));
  };
  const settle = () =>
    act(async () => {
      await new Promise((r) => setTimeout(r, 650));
    });

  it("starts a flow, and edits to the text redraw the diagram", async () => {
    await open();
    fireEvent.click(screen.getByTestId("flow-new"));
    expect(listFlows(h.elements)).toEqual(["Flow 1"]);
    expect(byType("frame")).toHaveLength(2);
    expect(byType("arrow")).toHaveLength(1);

    const source = screen.getByTestId("flow-source") as HTMLTextAreaElement;
    expect(source.value).toContain('buy["Buy button"]');
    expect(source.value).toContain('buy -->|"click"| pay');

    fireEvent.change(source, {
      target: { value: source.value.replace("Pay", "Pay now") },
    });
    await settle();
    expect(byType("text").map((t: any) => t.text)).toContain("Pay now");
    expect(
      (screen.getByTestId("flow-source") as HTMLTextAreaElement).value,
    ).toContain('"Pay now"');
  });

  it("shows what it cannot read and leaves the canvas alone", async () => {
    await open();
    fireEvent.click(screen.getByTestId("flow-new"));
    const before = live().length;
    fireEvent.change(screen.getByTestId("flow-source"), {
      target: { value: "flowchart TD\n  a --> \n" },
    });
    await settle();
    expect(screen.getByTestId("flow-issues").textContent).toContain("Line 2");
    expect(live()).toHaveLength(before);
  });

  it("a change on the canvas shows up in the text", async () => {
    await open();
    fireEvent.click(screen.getByTestId("flow-new"));
    const pay = byType("rectangle").find((e) => label(e) === "Pay")!;
    const t = live().find(
      (x: any) => x.type === "text" && x.containerId === pay.id,
    )!;
    act(() => {
      h.app.scene.mutateElement(t as any, {
        text: "Checkout",
        originalText: "Checkout",
      });
    });
    expect(
      (screen.getByTestId("flow-source") as HTMLTextAreaElement).value,
    ).toContain('"Checkout"');
  });
});
