import React from "react";

import { reseed } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawPathElement } from "@excalidraw/element/types";

import {
  actionMakeCompoundShape,
  actionPathfinderDivide,
  actionPathfinderIntersect,
  actionPathfinderSubtract,
  actionPathfinderUnite,
  actionReleaseCompoundShape,
} from "../actions";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import {
  act,
  fireEvent,
  render,
  screen,
  unmountComponent,
  waitFor,
} from "./test-utils";

unmountComponent();

const { h } = window;

beforeEach(() => {
  localStorage.clear();
  reseed(7);
});

const live = () =>
  h.elements.filter((e) => !e.isDeleted) as ExcalidrawPathElement[];

const run = async (action: any) => {
  await act(async () => {
    h.app.actionManager.executeAction(action);
    // the operation loads its engine on first use
    await new Promise((r) => setTimeout(r, 50));
  });
};

const setup = async () => {
  await render(<Excalidraw />);
  const a = API.createElement({
    type: "rectangle",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    strokeColor: "#ff0000",
    backgroundColor: "#ffff00",
  });
  const b = API.createElement({
    type: "ellipse",
    x: 50,
    y: 50,
    width: 100,
    height: 100,
    strokeColor: "#0000ff",
    backgroundColor: "#00ffff",
  });
  API.setElements([a, b]);
  API.setSelectedElements([a, b]);
  return { a, b };
};

const box = (p: ExcalidrawPathElement) => [
  p.x,
  p.y,
  p.x + p.width,
  p.y + p.height,
];

describe("pathfinder in the editor", () => {
  it("unite replaces both with one path, wearing the top shape's style", async () => {
    const { a, b } = await setup();
    await run(actionPathfinderUnite);
    const out = live();
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("path");
    expect(out[0].closed).toBe(true);
    expect(out[0].strokeColor).toBe("#0000ff");
    expect(box(out[0]).map(Math.round)).toEqual([0, 0, 150, 150]);
    // the operands are gone, the result is selected
    expect(h.elements.find((e) => e.id === a.id)!.isDeleted).toBe(true);
    expect(h.elements.find((e) => e.id === b.id)!.isDeleted).toBe(true);
    expect(h.state.selectedElementIds).toEqual({ [out[0].id]: true });
  });

  it("subtract keeps the bottom shape's style and cuts the top out of it", async () => {
    await setup();
    await run(actionPathfinderSubtract);
    const out = live();
    expect(out).toHaveLength(1);
    expect(out[0].strokeColor).toBe("#ff0000");
    expect(box(out[0]).map(Math.round)).toEqual([0, 0, 100, 100]);
    // the cut is a curve: some handle survived
    expect(out[0].handles.some((hd) => hd.in || hd.out)).toBe(true);
  });

  it("intersect gives the overlap", async () => {
    await setup();
    await run(actionPathfinderIntersect);
    const out = live();
    expect(out).toHaveLength(1);
    expect(box(out[0]).map(Math.round)).toEqual([50, 50, 100, 100]);
  });

  it("divide gives grouped pieces", async () => {
    await setup();
    await run(actionPathfinderDivide);
    const out = live();
    expect(out).toHaveLength(3);
    const groups = new Set(out.map((e) => e.groupIds[0]));
    expect(groups.size).toBe(1);
  });

  it("a rotated shape takes part where it really is", async () => {
    await render(<Excalidraw />);
    const a = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 20,
    });
    const b = API.createElement({
      type: "rectangle",
      x: 40,
      y: -40,
      width: 20,
      height: 100,
    });
    API.setElements([a, b]);
    API.setSelectedElements([a, b]);
    await run(actionPathfinderUnite);
    const [plus] = live();
    // a plus sign: 100 wide and 100 tall
    expect(plus.width).toBeCloseTo(100, 3);
    expect(plus.height).toBeCloseTo(100, 3);
    expect(plus.points.length).toBe(12);
  });

  it("does nothing for one shape or for text", async () => {
    await render(<Excalidraw />);
    const a = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
    const t = API.createElement({ type: "text", x: 5, y: 5, text: "hi" });
    API.setElements([a, t]);
    API.setSelectedElements([a, t]);
    await run(actionPathfinderUnite);
    expect(
      live()
        .map((e) => e.type)
        .sort(),
    ).toEqual(["rectangle", "text"]);
  });

  it("the inspector's buttons are live only for two or more closed shapes", async () => {
    await render(<Excalidraw />);
    API.setAppState({ paletteOpen: true });
    const a = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const b = API.createElement({
      type: "ellipse",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
    });
    API.setElements([a, b]);
    API.setSelectedElements([a]);
    expect(
      (screen.getByTestId("pathfinder-unite") as HTMLButtonElement).disabled,
    ).toBe(true);
    API.setSelectedElements([a, b]);
    const unite = screen.getByTestId("pathfinder-unite") as HTMLButtonElement;
    expect(unite.disabled).toBe(false);
    fireEvent.click(unite);
    await waitFor(() => expect(live()).toHaveLength(1));
  });

  it("is one undo step", async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
    const a = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const b = API.createElement({
      type: "ellipse",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
    });
    API.updateScene({
      elements: [a, b],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    API.setSelectedElements([a, b]);
    await run(actionPathfinderUnite);
    expect(live().map((e) => e.type)).toEqual(["path"]);
    Keyboard.undo();
    expect(
      live()
        .map((e) => e.type)
        .sort(),
    ).toEqual(["ellipse", "rectangle"]);
    Keyboard.redo();
    expect(live().map((e) => e.type)).toEqual(["path"]);
  });
});

describe("compound shapes", () => {
  const donut = async () => {
    await render(<Excalidraw />);
    const outer = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      backgroundColor: "#ff0000",
    });
    const inner = API.createElement({
      type: "ellipse",
      x: 60,
      y: 60,
      width: 80,
      height: 80,
    });
    API.setElements([outer, inner]);
    API.setSelectedElements([outer, inner]);
    return { outer, inner };
  };

  it("subtracting a shape from inside another leaves a hole, not two loops", async () => {
    await donut();
    await run(actionPathfinderSubtract);
    const out = live();
    expect(out).toHaveLength(1);
    expect(out[0].contours).toHaveLength(1);
    expect(box(out[0]).map(Math.round)).toEqual([0, 0, 200, 200]);
    // the hole sits inside the frame
    const hole = out[0].contours![0].points;
    expect(Math.min(...hole.map((p) => p[0]))).toBeGreaterThan(40);
    expect(Math.max(...hole.map((p) => p[0]))).toBeLessThan(160);
  });

  it("a shape with a hole takes part in the next operation whole", async () => {
    await donut();
    await run(actionPathfinderSubtract);
    const ring = live()[0];
    const plug = API.createElement({
      type: "rectangle",
      x: 90,
      y: 90,
      width: 20,
      height: 20,
    });
    API.setElements([ring as any, plug]);
    API.setSelectedElements([ring as any, plug]);
    await run(actionPathfinderUnite);
    const out = live();
    // the plug sits in the hole: ring and island stay apart as one shape
    expect(out).toHaveLength(2);
    expect(out.filter((e) => e.contours?.length)).toHaveLength(1);
  });

  it("make and release compound shape round-trip", async () => {
    await donut();
    await act(async () => {
      h.app.actionManager.executeAction(actionMakeCompoundShape);
    });
    let out = live();
    expect(out).toHaveLength(1);
    expect(out[0].contours).toHaveLength(1);
    await act(async () => {
      h.app.actionManager.executeAction(actionReleaseCompoundShape);
    });
    out = live();
    expect(out).toHaveLength(2);
    expect(out.every((e) => !e.contours)).toBe(true);
  });

  it("moves, scales and saves with its holes", async () => {
    await donut();
    await run(actionPathfinderSubtract);
    const ring = live()[0];
    const json = JSON.parse(
      (await import("../data/json")).serializeAsJSON(
        h.elements,
        h.state,
        {},
        "local",
      ),
    );
    const { restoreElements } = await import("../data/restore");
    const saved = json.elements.find((e: any) => e.type === "path");
    const [back] = restoreElements([saved], null) as any[];
    expect(back.contours).toHaveLength(1);
    expect(back.contours[0].points).toEqual(ring.contours![0].points);
    // junk contours are dropped
    const [bad] = restoreElements(
      [
        {
          ...saved,
          contours: [{ points: [[NaN, 0]], handles: [] }],
        },
      ],
      null,
    ) as any[];
    expect(bad.contours).toBeUndefined();
  });
});
