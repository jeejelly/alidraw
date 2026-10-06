import React from "react";

import {
  applyFlow,
  getFlowMeta,
  parseFlow,
  readFlow,
  serializeFlow,
  setStepPorts,
  wrapAsFlowElement,
} from "@excalidraw/flow";

import { Excalidraw } from "../index";
import { selectedPortDots } from "../components/appFlow/portDots";

import { API } from "./helpers/api";
import { liveElements, resetTestState } from "./helpers/fixtures";
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

const handle = window.h;

beforeEach(resetTestState);
beforeAll(() => mockBoundingClientRect({ width: 1000, height: 1000 }));
afterAll(() => restoreOriginalGetBoundingClientRect());

const scene = () => handle.app.scene;
const text = () => serializeFlow(readFlow(handle.elements, "F"));
/** with the comments that carry ports */
const layoutText = () =>
  serializeFlow(readFlow(handle.elements, "F", { layout: true }), {
    layout: true,
  });
const arrows = () =>
  liveElements().filter((element) => element.type === "arrow") as any[];
const byKey = (key: string) =>
  liveElements().find(
    (element) =>
      getFlowMeta(element)?.key === key &&
      getFlowMeta(element)?.kind === "node",
  )!;

const draw = (source: string) => {
  const { graph } = parseFlow(source);
  act(() => {
    applyFlow(scene(), "F", graph, { x: 100, y: 100 });
  });
};

const select = (...elements: any[]) =>
  act(() => {
    API.setSelectedElements(elements);
  });

/** where an arrow end is drawn, on the canvas */
const endOf = (arrow: any, index: number) => ({
  x: arrow.x + arrow.points[index][0],
  y: arrow.y + arrow.points[index][1],
});

const near = (point: { x: number; y: number }, wanted: any) =>
  Math.abs(point.x - wanted.x) < 3 && Math.abs(point.y - wanted.y) < 3;

const client = (point: { x: number; y: number }) => ({
  clientX: point.x + handle.state.scrollX + handle.state.offsetLeft,
  clientY: point.y + handle.state.scrollY + handle.state.offsetTop,
});

const drag = (from: { x: number; y: number }, to: { x: number; y: number }) => {
  const canvas = document.querySelector("canvas.interactive")!;
  fireEvent.pointerDown(canvas, client(from));
  fireEvent.pointerMove(window, client(to));
  fireEvent.pointerUp(window, client(to));
};

const openFlowTab = () => {
  act(() => API.setAppState({ paletteOpen: true }));
  fireEvent.click(screen.getByTestId("inspector-tab-flow"));
};

const DECISION = 'flowchart TD\n  d{"OK?"}\n';

describe("port dots", () => {
  it("show on the selected step, named, and nowhere else", async () => {
    await render(<Excalidraw />);
    draw(`${DECISION}  a["A"]\n`);
    expect(screen.queryByTestId("flow-ports")).toBeNull();
    select(byKey("d"));
    expect(
      ["in", "yes", "no", "other"].map((name) =>
        screen.queryByTestId(`flow-port-${name}`),
      ),
    ).not.toContain(null);
    select(byKey("a"));
    expect(screen.queryByTestId("flow-ports")).toBeNull();
  });

  it("a drag from a port makes a link out of it, without a label", async () => {
    await render(<Excalidraw />);
    draw(DECISION);
    const diamond = byKey("d");
    const box = API.createElement({
      type: "rectangle",
      x: diamond.x,
      y: diamond.y + 300,
      width: 120,
      height: 60,
    } as any);
    act(() => {
      scene().replaceAllElements([
        ...scene().getElementsIncludingDeleted(),
        box,
      ]);
      wrapAsFlowElement(scene(), [box], "F", { label: "Pay" });
    });
    act(() => {
      setStepPorts(scene(), "F", "pay", [{ name: "in", at: [0.5, 0] }]);
    });
    select(diamond);
    const yes = selectedPortDots(handle.app).find((dot) => dot.name === "yes")!;
    const outline = byKey("pay");
    const inPort = { x: outline.x + outline.width / 2, y: outline.y };

    drag(yes.center, inPort);

    expect(arrows()).toHaveLength(1);
    const [arrow] = arrows();
    expect(getFlowMeta(arrow)!.link).toEqual({ fromPort: "yes", toPort: "in" });
    expect(near(endOf(arrow, 0), yes.center)).toBe(true);
    expect(near(endOf(arrow, 1), inPort)).toBe(true);
    expect(arrow.startBinding.elementId).toBe(diamond.id);
    expect(
      liveElements().some(
        (element) => (element as any).containerId === arrow.id,
      ),
    ).toBe(false);
    expect(layoutText()).toContain("%% @link 0 yes in");
  });

  it("dropped on the step itself, the link keeps the automatic side", async () => {
    await render(<Excalidraw />);
    draw(DECISION);
    const diamond = byKey("d");
    const box = API.createElement({
      type: "rectangle",
      x: diamond.x + 400,
      y: diamond.y,
      width: 120,
      height: 60,
    } as any);
    act(() => {
      scene().replaceAllElements([
        ...scene().getElementsIncludingDeleted(),
        box,
      ]);
      wrapAsFlowElement(scene(), [box], "F", { label: "Pay" });
    });
    select(diamond);
    const no = selectedPortDots(handle.app).find((dot) => dot.name === "no")!;
    drag(no.center, { x: box.x + 60, y: box.y + 30 });
    const [arrow] = arrows();
    expect(getFlowMeta(arrow)!.link).toEqual({ fromPort: "no" });
  });
});

describe("an end of a link dropped on a port", () => {
  it("takes the port, and loses it elsewhere on the step; bindings stay", async () => {
    await render(<Excalidraw />);
    draw(`${DECISION}  a["A"]\n  a --> d\n`);
    const [arrow] = arrows();
    const diamond = byKey("d");
    const binding = arrow.endBinding.elementId;
    const lastIndex = arrow.points.length - 1;
    const yesPoint = {
      x: diamond.x + diamond.width / 2,
      y: diamond.y + diamond.height,
    };

    act(() => {
      handle.app.flow.handleEndpointDrop(arrow.id, lastIndex, yesPoint);
    });
    let now = arrows()[0];
    expect(getFlowMeta(now)!.link?.toPort).toBe("yes");
    expect(now.endBinding.elementId).toBe(binding);
    expect(now.endBinding.fixedPoint[0]).toBeCloseTo(0.5);
    expect(now.endBinding.fixedPoint[1]).toBeCloseTo(1);
    expect(near(endOf(now, now.points.length - 1), yesPoint)).toBe(true);

    act(() => {
      handle.app.flow.handleEndpointDrop(
        arrow.id,
        arrows()[0].points.length - 1,
        {
          x: diamond.x + 10,
          y: diamond.y + 10,
        },
      );
    });
    now = arrows()[0];
    expect(getFlowMeta(now)!.link?.toPort).toBeUndefined();
    expect(now.endBinding.elementId).toBe(binding);
    expect(arrows()).toHaveLength(1);
  });
});

describe("the Selection section: ports of a step", () => {
  const SOURCE = `${DECISION}  a["A"]\n  d -->|"yes"| a\n%% @link 0 yes -\n`;

  it("renaming a port keeps its links, moving it moves them", async () => {
    await render(<Excalidraw />);
    draw(SOURCE);
    openFlowTab();
    const diamond = byKey("d");
    select(diamond);
    const arrowId = arrows()[0].id;
    expect(screen.getByTestId("flow-ports-editor")).toBeTruthy();

    // ports are listed in order: in, yes, no, other
    const name = screen.getByTestId("flow-port-name-1") as HTMLInputElement;
    fireEvent.change(name, { target: { value: "ok" } });
    fireEvent.blur(name);
    expect(getFlowMeta(arrows()[0])!.link?.fromPort).toBe("ok");
    expect(getFlowMeta(byKey("d"))!.ports!.map((port) => port.name)).toEqual([
      "in",
      "ok",
      "no",
      "other",
    ]);

    fireEvent.change(screen.getByTestId("flow-port-position-1"), {
      target: { value: "left" },
    });
    const moved = arrows()[0];
    const left = { x: diamond.x, y: diamond.y + diamond.height / 2 };
    expect(moved.id).toBe(arrowId);
    expect(near(endOf(moved, 0), left)).toBe(true);
    expect(moved.startBinding.fixedPoint[0]).toBeCloseTo(0);
    expect(layoutText()).toContain("%% @link 0 ok -");
  });

  it("a removed port frees its links, which stay glued", async () => {
    await render(<Excalidraw />);
    draw(SOURCE);
    openFlowTab();
    select(byKey("d"));
    const before = arrows()[0];
    fireEvent.click(screen.getByTestId("flow-port-remove-1"));
    const now = arrows()[0];
    expect(getFlowMeta(now)!.link?.fromPort).toBeUndefined();
    expect(now.id).toBe(before.id);
    expect(now.startBinding.elementId).toBe(before.startBinding.elementId);
    expect(now.endBinding.elementId).toBe(before.endBinding.elementId);
  });

  it("adds a port, takes presets and resets", async () => {
    await render(<Excalidraw />);
    draw(`${DECISION}`);
    openFlowTab();
    select(byKey("d"));
    fireEvent.change(screen.getByTestId("flow-port-add-name"), {
      target: { value: "maybe" },
    });
    fireEvent.change(screen.getByTestId("flow-port-add-position"), {
      target: { value: "custom" },
    });
    fireEvent.change(screen.getByTestId("flow-port-add-at-x"), {
      target: { value: "25" },
    });
    fireEvent.blur(screen.getByTestId("flow-port-add-at-x"));
    fireEvent.click(screen.getByTestId("flow-port-add-button"));
    const ports = () => getFlowMeta(byKey("d"))!.ports!;
    expect(ports().at(-1)).toEqual({ name: "maybe", at: [0.25, 0.5] });

    fireEvent.click(screen.getByTestId("flow-ports-fork"));
    expect(ports().map((port) => port.name)).toEqual([
      "in",
      "first",
      "second",
      "third",
    ]);
    fireEvent.click(screen.getByTestId("flow-ports-decision"));
    expect(ports().map((port) => port.name)).toEqual([
      "in",
      "yes",
      "no",
      "other",
    ]);
    fireEvent.click(screen.getByTestId("flow-ports-reset"));
    expect(getFlowMeta(byKey("d"))!.ports).toBeUndefined();
    // the diamond brings its own again
    expect(screen.getByTestId("flow-port-name-1")).toBeTruthy();
  });
});

describe("the Selection section: a link", () => {
  const SOURCE = `${DECISION}  a["A"]\n  d --> a\n`;

  it("changes ends, line and route without a new arrow or new bindings", async () => {
    await render(<Excalidraw />);
    draw(SOURCE);
    openFlowTab();
    const before = arrows()[0];
    select(before);

    fireEvent.click(screen.getByTestId("flow-link-head-cross"));
    fireEvent.click(screen.getByTestId("flow-link-tail-circle"));
    fireEvent.click(screen.getByTestId("flow-link-line-dashed"));
    let now = arrows()[0];
    expect(now.endArrowhead).toBe("bar");
    expect(now.startArrowhead).toBe("circle_outline");
    expect(now.strokeStyle).toBe("dashed");
    expect(text()).toContain("d o-.-x a");

    fireEvent.click(screen.getByTestId("flow-link-line-thick"));
    expect(arrows()[0].strokeWidth).toBe(2.5);
    expect(arrows()[0].strokeStyle).toBe("solid");

    for (const route of ["curved", "elbow", "straight"] as const) {
      fireEvent.click(screen.getByTestId(`flow-link-route-${route}`));
      now = arrows()[0];
      expect(arrows()).toHaveLength(1);
      expect(now.id).toBe(before.id);
      expect(now.startBinding.elementId).toBe(before.startBinding.elementId);
      expect(now.endBinding.elementId).toBe(before.endBinding.elementId);
      expect(!!now.elbowed).toBe(route === "elbow");
      expect(!!now.roundness).toBe(route === "curved");
    }
    // straight resets the bend
    expect(arrows()[0].points).toHaveLength(2);
    fireEvent.click(screen.getByTestId("flow-link-route-curved"));
    expect(arrows()[0].points).toHaveLength(3);
  });

  it("picks the ports of the steps it joins", async () => {
    await render(<Excalidraw />);
    draw(SOURCE);
    openFlowTab();
    const diamond = byKey("d");
    select(arrows()[0]);
    fireEvent.change(screen.getByTestId("flow-link-from-port"), {
      target: { value: "no" },
    });
    const arrow = arrows()[0];
    expect(getFlowMeta(arrow)!.link?.fromPort).toBe("no");
    expect(
      near(endOf(arrow, 0), {
        x: diamond.x + diamond.width,
        y: diamond.y + diamond.height / 2,
      }),
    ).toBe(true);
    // a rectangle has no ports to choose from
    expect(
      (screen.getByTestId("flow-link-to-port") as HTMLSelectElement).disabled,
    ).toBe(true);
    fireEvent.change(screen.getByTestId("flow-link-from-port"), {
      target: { value: "" },
    });
    expect(getFlowMeta(arrows()[0])!.link?.fromPort).toBeUndefined();
  });

  it("edits, adds and removes the label", async () => {
    await render(<Excalidraw />);
    draw(SOURCE);
    openFlowTab();
    select(arrows()[0]);
    const label = () =>
      liveElements().find(
        (element: any) =>
          element.type === "text" && element.containerId === arrows()[0].id,
      ) as any;
    const input = () => screen.getByTestId("flow-link-label");
    fireEvent.change(input(), { target: { value: "go" } });
    fireEvent.blur(input());
    expect(label().text).toBe("go");
    expect(text()).toContain('d -->|"go"| a');
    fireEvent.change(input(), { target: { value: "stop" } });
    fireEvent.blur(input());
    expect(label().text).toBe("stop");
    fireEvent.change(input(), { target: { value: "" } });
    fireEvent.blur(input());
    expect(label()).toBeUndefined();
    expect(text()).toContain("d --> a");
    expect(arrows()).toHaveLength(1);
  });

  it("makes a hand-drawn arrow between two steps a flow link", async () => {
    await render(<Excalidraw />);
    draw(SOURCE);
    openFlowTab();
    const [arrow] = arrows();
    // as if drawn by hand: no flow meta
    act(() => {
      scene().mutateElement(arrow, { customData: {} });
    });
    select(arrows()[0]);
    expect(screen.queryByTestId("flow-link-line-dashed")).toBeNull();
    fireEvent.click(screen.getByTestId("flow-link-make"));
    expect(getFlowMeta(arrows()[0])).toMatchObject({
      id: "F",
      key: "d>a",
      kind: "edge",
    });
    expect(text()).toContain("d --> a");
    // and it is a link now: it has the controls, and survives a redraw
    expect(screen.getByTestId("flow-link-line-dashed")).toBeTruthy();
    const id = arrows()[0].id;
    draw(`${SOURCE}  a --> e["E"]\n`);
    expect(arrows().map((link) => link.id)).toContain(id);
  });
});
