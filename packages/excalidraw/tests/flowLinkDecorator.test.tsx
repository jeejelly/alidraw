import React from "react";

import {
  applyFlow,
  parseFlow,
  readFlow,
  straightenLink,
} from "@excalidraw/flow";

import { Excalidraw } from "../index";

import { liveElements, resetTestState } from "./helpers/fixtures";
import { act, render, unmountComponent } from "./test-utils";

unmountComponent();

const handle = window.h;

beforeEach(resetTestState);

const draw = (text: string) => {
  const { graph } = parseFlow(text);
  act(() => {
    applyFlow(handle.app.scene, "Flow", graph, { x: 100, y: 100 });
  });
};

/** links are drawn as elbows; these tests are about straight ones */
const straighten = () =>
  act(() => {
    for (const arrow of arrows()) {
      straightenLink(handle.app.scene, arrow);
    }
  });

const arrows = () =>
  liveElements().filter((element) => element.type === "arrow") as any[];
const labelOf = (arrow: any) =>
  (
    liveElements().find(
      (element: any) =>
        element.type === "text" && element.containerId === arrow.id,
    ) as any
  )?.text;

/** within a pixel or two: bindings round the ends */
const near = (value: number, wanted: number) => Math.abs(value - wanted) < 2;

const mutate = (id: string, changes: Record<string, unknown>) =>
  act(() => {
    const element = liveElements().find((candidate) => candidate.id === id)!;
    handle.app.scene.mutateElement(element, changes as any);
  });

describe("a link keeps what was done to its arrow", () => {
  const TEXT = 'flowchart LR\n  a["A"] -->|"go"| b["B"]\n  b --> c["C"]\n';

  it("drawing the same text again leaves the arrows (and their ids) alone", async () => {
    await render(<Excalidraw />);
    draw(TEXT);
    const before = arrows().map((arrow) => arrow.id);
    draw(TEXT);
    expect(arrows().map((arrow) => arrow.id)).toEqual(before);
  });

  it("colour, bends and roundness survive edits elsewhere in the text", async () => {
    await render(<Excalidraw />);
    draw(TEXT);
    straighten();
    const [first] = arrows();
    mutate(first.id, {
      strokeColor: "#1971c2",
      roundness: { type: 2 },
      points: [
        [0, 0],
        [60, -40],
        [first.points[1][0], first.points[1][1]],
      ],
    });
    draw(`${TEXT}  c --> d["D"]\n`.replace('"go"', '"proceed"'));
    const kept = arrows().find((arrow) => arrow.id === first.id)!;
    expect(kept.strokeColor).toBe("#1971c2");
    expect(kept.points).toHaveLength(3);
    expect(kept.roundness).toBeTruthy();
    expect(labelOf(kept)).toBe("proceed");
    // still glued to both steps
    expect(kept.startBinding?.elementId).toBeTruthy();
    expect(kept.endBinding?.elementId).toBeTruthy();
    expect(arrows()).toHaveLength(3);
  });

  it("the text still decides the line style and the ends", async () => {
    await render(<Excalidraw />);
    draw(TEXT);
    const [first] = arrows();
    draw('flowchart LR\n  a["A"] -.->|"go"| b["B"]\n  b --x c["C"]\n');
    const kept = arrows().find((arrow) => arrow.id === first.id)!;
    expect(kept.strokeStyle).toBe("dashed");
    expect(arrows()[1].endArrowhead).toBe("bar");
    expect(
      readFlow(handle.elements, "Flow").edges.map((edge) => edge.style),
    ).toEqual(["dashed", "solid"]);
  });

  it("a link that leaves the text goes, with its label; the others stay", async () => {
    await render(<Excalidraw />);
    draw(TEXT);
    const [first, second] = arrows();
    draw('flowchart LR\n  b --> c["C"]\n  a["A"]\n');
    expect(arrows().map((arrow) => arrow.id)).toEqual([second.id]);
    expect(first.id).not.toBe(second.id);
    expect(
      liveElements().filter((element: any) => element.containerId === first.id),
    ).toHaveLength(0);
  });

  it("a label that appears or goes redraws the arrow in its colour", async () => {
    await render(<Excalidraw />);
    draw(TEXT);
    const second = arrows()[1];
    mutate(second.id, { strokeColor: "#2f9e44" });
    draw('flowchart LR\n  a["A"] -->|"go"| b["B"]\n  b -->|"later"| c["C"]\n');
    const redrawn = arrows()[1];
    expect(labelOf(redrawn)).toBe("later");
    expect(redrawn.strokeColor).toBe("#2f9e44");
  });

  it("a straight link follows a step that moved away from it", async () => {
    await render(<Excalidraw />);
    draw(TEXT);
    straighten();
    const [first] = arrows();
    const target = liveElements().find(
      (element) => element.id === first.endBinding.elementId,
    )!;
    mutate(target.id, { x: target.x + 400, y: target.y + 200 });
    draw(TEXT);
    const kept = arrows().find((arrow) => arrow.id === first.id)!;
    const endX = kept.x + kept.points[1][0];
    expect(endX).toBeGreaterThan(first.x + first.points[1][0] + 100);
  });
});

describe("ports: several outcomes leave one decision", () => {
  const DECISION = `flowchart TD
  d{"Paid?"}
  ok["Ship"]
  late["Remind"]
  no["Cancel"]
  d -- yes --> ok
  d -- no --> late
  d -->|"other"| no
`;
  const startOf = (arrow: any) => [
    arrow.x + arrow.points[0][0],
    arrow.y + arrow.points[0][1],
  ];
  const decision = () =>
    liveElements().find((element) => element.type === "diamond")!;

  it("a link labelled like an outcome leaves from that port", async () => {
    await render(<Excalidraw />);
    draw(DECISION);
    const box = decision();
    const [yes, no, other] = arrows().map(startOf);
    expect(near(yes[0], box.x + box.width / 2)).toBe(true);
    expect(near(yes[1], box.y + box.height)).toBe(true);
    expect(near(no[0], box.x + box.width)).toBe(true);
    expect(near(no[1], box.y + box.height / 2)).toBe(true);
    expect(near(other[0], box.x)).toBe(true);
    expect(near(other[1], box.y + box.height / 2)).toBe(true);
  });

  it("a named port decides, whatever the label says; changing it moves the arrow", async () => {
    await render(<Excalidraw />);
    const text = (port: string) =>
      `flowchart TD\n  d{"Paid?"}\n  a["A"]\n  d --> a\n%% @link 0 ${port} -\n`;
    draw(text("no"));
    const [arrow] = arrows();
    const box = decision();
    expect(near(startOf(arrow)[0], box.x + box.width)).toBe(true);
    draw(text("other"));
    const moved = arrows().find((candidate) => candidate.id === arrow.id)!;
    expect(near(startOf(moved)[0], box.x)).toBe(true);
    expect(readFlow(handle.elements, "Flow").edges[0].fromPort).toBe("other");
  });

  it("custom ports, on any step, come back from the canvas", async () => {
    await render(<Excalidraw />);
    draw(
      'flowchart TD\n  s["Switch"]\n  a["A"]\n  b["B"]\n  s --> a\n  s --> b\n%% @ports s left:0:0.5 right:1:0.5\n%% @link 0 left -\n%% @link 1 right -\n',
    );
    const graph = readFlow(handle.elements, "Flow");
    expect(graph.nodes.find((node) => node.key === "s")?.ports).toEqual([
      { name: "left", at: [0, 0.5] },
      { name: "right", at: [1, 0.5] },
    ]);
    expect(graph.edges.map((edge) => edge.fromPort)).toEqual(["left", "right"]);
    const [left, right] = arrows().map(startOf);
    const box = liveElements().find(
      (element: any) =>
        element.type === "rectangle" && element.customData?.flow?.key === "s",
    )!;
    expect(near(left[0], box.x)).toBe(true);
    expect(near(right[0], box.x + box.width)).toBe(true);
  });
});

describe("a loop is a head with a body, an exit and the way back", () => {
  const LOOP = `flowchart TD
  start(["Start"])
  each{{"for each item"}}
  work["Process item"]
  done(["Done"])
  start --> each
  each -- body --> work
  each -- exit --> done
  work --> each
`;
  const startOf = (arrow: any) => [
    arrow.x + arrow.points[0][0],
    arrow.y + arrow.points[0][1],
  ];

  it("the body and exit links leave the hexagon from their ports", async () => {
    await render(<Excalidraw />);
    draw(LOOP);
    const head = liveElements().find(
      (element: any) => element.customData?.flow?.key === "each",
    )!;
    const [, body, exit] = arrows().map(startOf);
    expect(near(body[0], head.x + head.width / 2)).toBe(true);
    expect(near(body[1], head.y + head.height)).toBe(true);
    expect(near(exit[0], head.x + head.width)).toBe(true);
    expect(near(exit[1], head.y + head.height / 2)).toBe(true);
  });
});
