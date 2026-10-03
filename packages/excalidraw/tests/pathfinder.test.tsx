import React from "react";

import { ROUNDNESS } from "@excalidraw/common";
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

import { liveElements, resetTestState } from "./helpers/fixtures";
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

const handle = window.h;

beforeEach(resetTestState);

const live = () => liveElements<ExcalidrawPathElement>();

const run = async (action: any) => {
  await act(async () => {
    handle.app.actionManager.executeAction(action);
    // the operation loads its engine on first use
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
};

const setup = async () => {
  await render(<Excalidraw />);
  const first = API.createElement({
    type: "rectangle",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    strokeColor: "#ff0000",
    backgroundColor: "#ffff00",
  });
  const second = API.createElement({
    type: "ellipse",
    x: 50,
    y: 50,
    width: 100,
    height: 100,
    strokeColor: "#0000ff",
    backgroundColor: "#00ffff",
  });
  API.setElements([first, second]);
  API.setSelectedElements([first, second]);
  return { first, second };
};

const box = (path: ExcalidrawPathElement) => [
  path.x,
  path.y,
  path.x + path.width,
  path.y + path.height,
];

describe("pathfinder in the editor", () => {
  it("unite replaces both with one path, wearing the top shape's style", async () => {
    const { first, second } = await setup();
    await run(actionPathfinderUnite);
    const out = live();
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("path");
    expect(out[0].closed).toBe(true);
    expect(out[0].strokeColor).toBe("#0000ff");
    expect(box(out[0]).map(Math.round)).toEqual([0, 0, 150, 150]);
    // the operands are gone, the result is selected
    expect(
      handle.elements.find((element) => element.id === first.id)!.isDeleted,
    ).toBe(true);
    expect(
      handle.elements.find((element) => element.id === second.id)!.isDeleted,
    ).toBe(true);
    expect(handle.state.selectedElementIds).toEqual({ [out[0].id]: true });
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
    const groups = new Set(out.map((element) => element.groupIds[0]));
    expect(groups.size).toBe(1);
  });

  it("a rotated shape takes part where it really is", async () => {
    await render(<Excalidraw />);
    const first = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 20,
    });
    const second = API.createElement({
      type: "rectangle",
      x: 40,
      y: -40,
      width: 20,
      height: 100,
    });
    API.setElements([first, second]);
    API.setSelectedElements([first, second]);
    await run(actionPathfinderUnite);
    const [plus] = live();
    // a plus sign: 100 wide and 100 tall
    expect(plus.width).toBeCloseTo(100, 3);
    expect(plus.height).toBeCloseTo(100, 3);
    expect(plus.points.length).toBe(12);
  });

  it("does nothing for one shape or for text", async () => {
    await render(<Excalidraw />);
    const first = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
    const text = API.createElement({ type: "text", x: 5, y: 5, text: "hi" });
    API.setElements([first, text]);
    API.setSelectedElements([first, text]);
    await run(actionPathfinderUnite);
    expect(
      live()
        .map((element) => element.type)
        .sort(),
    ).toEqual(["rectangle", "text"]);
  });

  it("the inspector's buttons are live only for two or more closed shapes", async () => {
    await render(<Excalidraw />);
    API.setAppState({ paletteOpen: true });
    const first = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const second = API.createElement({
      type: "ellipse",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
    });
    API.setElements([first, second]);
    API.setSelectedElements([first]);
    expect(
      (screen.getByTestId("pathfinder-unite") as HTMLButtonElement).disabled,
    ).toBe(true);
    API.setSelectedElements([first, second]);
    const unite = screen.getByTestId("pathfinder-unite") as HTMLButtonElement;
    expect(unite.disabled).toBe(false);
    fireEvent.click(unite);
    await waitFor(() => expect(live()).toHaveLength(1));
  });

  it("a pathfinder operation undoes in one step", async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
    const first = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const second = API.createElement({
      type: "ellipse",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
    });
    API.updateScene({
      elements: [first, second],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    API.setSelectedElements([first, second]);
    await run(actionPathfinderUnite);
    expect(live().map((element) => element.type)).toEqual(["path"]);
    Keyboard.undo();
    expect(
      live()
        .map((element) => element.type)
        .sort(),
    ).toEqual(["ellipse", "rectangle"]);
    Keyboard.redo();
    expect(live().map((element) => element.type)).toEqual(["path"]);
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
    expect(Math.min(...hole.map((point) => point[0]))).toBeGreaterThan(40);
    expect(Math.max(...hole.map((point) => point[0]))).toBeLessThan(160);
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
    expect(out.filter((element) => element.contours?.length)).toHaveLength(1);
  });

  it("make and release compound shape round-trip", async () => {
    await donut();
    await act(async () => {
      handle.app.actionManager.executeAction(actionMakeCompoundShape);
    });
    let out = live();
    expect(out).toHaveLength(1);
    expect(out[0].contours).toHaveLength(1);
    await act(async () => {
      handle.app.actionManager.executeAction(actionReleaseCompoundShape);
    });
    out = live();
    expect(out).toHaveLength(2);
    expect(out.every((element) => !element.contours)).toBe(true);
  });

  it("moves, scales and saves with its holes", async () => {
    await donut();
    await run(actionPathfinderSubtract);
    const ring = live()[0];
    const json = JSON.parse(
      (await import("../data/json")).serializeAsJSON(
        handle.elements,
        handle.state,
        {},
        "local",
      ),
    );
    const { restoreElements } = await import("../data/restore");
    const saved = json.elements.find((element: any) => element.type === "path");
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

describe("pathfinder with rounded shapes", () => {
  it("subtracting a card from a rounded box leaves two rounded boxes", async () => {
    await render(<Excalidraw />);
    const base = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 400,
      height: 200,
      backgroundColor: "#99ffbb",
    });
    const rounded = {
      ...base,
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS, value: 24 },
    } as typeof base;
    const card = API.createElement({
      type: "rectangle",
      x: 100,
      y: -50,
      width: 200,
      height: 300,
      backgroundColor: "#00ff44",
    });
    API.setElements([rounded, card]);
    API.setSelectedElements([rounded, card]);
    await run(actionPathfinderSubtract);
    const out = live();
    expect(out).toHaveLength(2);
    for (const piece of out) {
      expect(piece.backgroundColor).toBe("#99ffbb");
      // two rounded outer corners, two straight cut corners
      expect(
        piece.handles.filter((hd) => hd.in || hd.out).length,
      ).toBeGreaterThanOrEqual(2);
    }
    const xs = out
      .map((path) => Math.round(path.x))
      .sort((first, second) => first - second);
    expect(xs).toEqual([0, 300]);
  });
});
