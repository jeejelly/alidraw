import React from "react";

import { reseed } from "@excalidraw/common";

import { actionCopyAsMermaid } from "../actions";
import { Excalidraw } from "../index";
import { elementsToMermaid } from "../mermaidExport";

import { API } from "./helpers/api";
import { act, fireEvent, render, screen, unmountComponent } from "./test-utils";

vi.mock("../clipboard", async (orig) => ({
  ...(await orig<typeof import("../clipboard")>()),
  copyTextToSystemClipboard: vi.fn(async () => {}),
}));

unmountComponent();

const { h } = window;

beforeEach(() => {
  localStorage.clear();
  reseed(7);
});

const labelled = (container: any, text: string) => {
  const t = API.createElement({
    type: "text",
    text,
    containerId: container.id,
    x: container.x,
    y: container.y,
  } as any);
  return [
    { ...container, boundElements: [{ type: "text", id: t.id }] },
    t,
  ] as const;
};

const diagram = () => {
  const [a, ta] = labelled(
    API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    }),
    "Start",
  );
  const [b, tb] = labelled(
    API.createElement({
      type: "diamond",
      x: 300,
      y: 10,
      width: 100,
      height: 80,
    }),
    "OK?",
  );
  const c = API.createElement({
    type: "ellipse",
    x: 600,
    y: 0,
    width: 100,
    height: 50,
  });
  const arrow = {
    ...API.createElement({
      type: "arrow",
      x: 100,
      y: 25,
      width: 200,
      height: 0,
    }),
    startBinding: { elementId: a.id, fixedPoint: [1, 0.5], mode: "orbit" },
    endBinding: { elementId: b.id, fixedPoint: [0, 0.5], mode: "orbit" },
    endArrowhead: "arrow",
  } as any;
  const dashed = {
    ...API.createElement({
      type: "arrow",
      x: 400,
      y: 25,
      width: 200,
      height: 0,
      strokeStyle: "dashed",
    }),
    startBinding: { elementId: b.id, fixedPoint: [1, 0.5], mode: "orbit" },
    endBinding: { elementId: c.id, fixedPoint: [0, 0.5], mode: "orbit" },
    endArrowhead: "arrow",
  } as any;
  return [a, ta, b, tb, c, arrow, dashed];
};

describe("elements to Mermaid", () => {
  it("writes nodes by shape and links by arrow style", () => {
    const els = diagram();
    const { text, nodes, links } = elementsToMermaid(els);
    expect(nodes).toBe(3);
    expect(links).toBe(2);
    expect(text).toContain("flowchart LR");
    expect(text).toContain('n1["Start"]');
    expect(text).toContain('n2{"OK?"}');
    expect(text).toContain('n3(("');
    expect(text).toContain("n1 --> n2");
    expect(text).toContain("n2 -.-> n3");
  });

  it("is empty without shapes, and skips unglued arrows", () => {
    expect(elementsToMermaid([]).text).toBe("");
    const lone = API.createElement({ type: "arrow", x: 0, y: 0 });
    expect(elementsToMermaid([lone]).text).toBe("");
  });
});

describe("tools in the inspector", () => {
  it("every overflow tool is a button, and the gear hides the ones you don't want", async () => {
    await render(<Excalidraw />);
    API.setAppState({ paletteOpen: true });
    for (const id of [
      "image",
      "frame",
      "embeddable",
      "autoshape",
      "laser",
      "bucketfill",
      "lasso",
      "mermaid-from",
      "mermaid-to",
    ]) {
      expect(screen.getByTestId(`tool-${id}`)).toBeTruthy();
    }
    fireEvent.click(screen.getByTestId("tool-bucketfill"));
    expect(h.state.activeTool.type).toBe("bucketfill");

    fireEvent.click(screen.getByTestId("tools-customize"));
    fireEvent.click(screen.getByTestId("tool-laser"));
    fireEvent.click(screen.getByTestId("tools-customize"));
    expect(screen.queryByTestId("tool-laser")).toBeNull();
    // kept across reloads
    expect(
      JSON.parse(localStorage.getItem("excalidraw-palette")!).hiddenTools,
    ).toEqual(["laser"]);
  });

  it("opens the Mermaid dialog", async () => {
    await render(<Excalidraw />);
    API.setAppState({ paletteOpen: true });
    fireEvent.click(screen.getByTestId("tool-mermaid-from"));
    expect(h.state.openDialog).toMatchObject({ name: "ttd", tab: "mermaid" });
  });

  it("copies the diagram as Mermaid", async () => {
    await render(<Excalidraw />);
    API.setElements(diagram());
    await act(async () => {
      h.app.actionManager.executeAction(actionCopyAsMermaid);
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(h.state.toast?.message).toContain("3 nodes, 2 links");
  });
});
