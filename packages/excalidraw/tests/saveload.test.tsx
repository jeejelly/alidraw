import React from "react";

import { pointFrom, type LocalPoint } from "@excalidraw/math";

import type {
  ExcalidrawPathElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { loadFromBlob } from "../data/blob";
import { restoreAppState, restoreElements } from "../data/restore";
import { serializeAsJSON } from "../data/json";
import { Excalidraw } from "../index";
import { exportToSvg } from "../scene/export";

import { resetTestState } from "./helpers/fixtures";
import { API } from "./helpers/api";
import { act, render, unmountComponent } from "./test-utils";

unmountComponent();

const handle = window.h;

beforeEach(resetTestState);

const localPoint = (x: number, y: number) => pointFrom<LocalPoint>(x, y);

/** what a user's file holds: every feature of this work in one scene */
const buildScene = () => {
  const path = API.createElement({
    type: "path",
    x: 40,
    y: 60,
    points: [
      localPoint(0, 0),
      localPoint(120, 0),
      localPoint(120, 80),
      localPoint(0, 80),
    ],
    strokeColor: "#ff0000",
  }) as unknown as ExcalidrawPathElement;
  const withHandles = {
    ...path,
    handles: [
      { mode: "smooth", in: localPoint(-20, 0), out: localPoint(20, 0) },
      { mode: "corner", in: localPoint(-5, 0), out: localPoint(5, 5) }, // hidden tangents kept
      { mode: "broken", in: localPoint(0, -10), out: null },
      { mode: "corner", in: null, out: null },
    ],
    closed: true,
    angle: 0.5,
  } as unknown as ExcalidrawPathElement;
  const follower = {
    ...API.createElement({
      type: "rectangle",
      x: 300,
      y: 60,
      width: 50,
      height: 50,
    }),
    customData: {
      anchor: { to: path.id, from: "tr", at: "tl", dx: 16, dy: 0 },
      other: "kept",
    },
  };
  const pinned = {
    ...API.createElement({
      type: "rectangle",
      x: 10,
      y: 300,
      width: 50,
      height: 50,
    }),
    customData: { anchor: { guide: "g1", edge: "end", offset: 4 } },
  };
  const text = {
    ...API.createElement({ type: "text", x: 10, y: 10, text: "Hello" }),
    fontFamilyName: "Fira Sans",
    fontUnit: "dp",
  } as ExcalidrawTextElement;
  return { elements: [withHandles, follower, pinned, text], path: withHandles };
};

const appStateWith = (extra: Record<string, unknown>) => ({
  ...handle.state,
  ...extra,
});

describe("saving and reopening", () => {
  it("the file keeps paths, handles, anchors, fonts and guides", async () => {
    await render(<Excalidraw />);
    const { elements } = buildScene();
    const json = serializeAsJSON(
      elements,
      appStateWith({
        guides: [{ id: "g1", axis: "x", position: 123 }],
        gridSize: 8,
        gridStep: 4,
        gridModeEnabled: true,
        paletteOpen: true,
        rulersEnabled: true,
      }) as any,
      {},
      "local",
    );
    const file = JSON.parse(json);

    // what is written
    const written = file.elements as any[];
    const pathElement = written.find((element) => element.type === "path");
    expect(pathElement.closed).toBe(true);
    expect(pathElement.handles[0]).toEqual({
      mode: "smooth",
      in: [-20, 0],
      out: [20, 0],
    });
    expect(pathElement.handles[1]).toEqual({
      mode: "corner",
      in: [-5, 0],
      out: [5, 5],
    });
    expect(
      written.find((element) => element.customData?.anchor?.to).customData
        .other,
    ).toBe("kept");
    expect(
      written.find((element) => element.type === "text").fontFamilyName,
    ).toBe("Fira Sans");
    expect(file.appState.guides).toEqual([
      { id: "g1", axis: "x", position: 123 },
    ]);
    expect(file.appState.gridSize).toBe(8);
    // view-only state is not saved
    expect(file.appState).not.toHaveProperty("paletteOpen");
    expect(file.appState).not.toHaveProperty("rulersEnabled");
    expect(file.appState).not.toHaveProperty("gizmo");
    expect(file.appState).not.toHaveProperty("anchorPick");
    expect(file.appState).not.toHaveProperty("editingPath");

    // reopened
    const restored = restoreElements(file.elements, null) as any[];
    const rp = restored.find((element) => element.type === "path");
    expect(rp.handles).toEqual(pathElement.handles);
    expect(rp.points).toEqual(pathElement.points);
    expect(rp.closed).toBe(true);
    expect(rp.angle).toBeCloseTo(0.5);
    const rf = restored.find((element) => element.customData?.anchor?.to);
    expect(rf.customData.anchor).toEqual({
      to: rp.id,
      from: "tr",
      at: "tl",
      dx: 16,
      dy: 0,
    });
    const rt = restored.find((element) => element.type === "text");
    expect(rt.fontFamilyName).toBe("Fira Sans");
    expect(rt.fontUnit).toBe("dp");
    const state = restoreAppState(file.appState, null);
    expect(state.guides).toEqual([{ id: "g1", axis: "x", position: 123 }]);
    expect(state.gridSize).toBe(8);
    expect(state.gridModeEnabled).toBe(true);
  });

  it("loading the file through the app's own loader gives the same scene", async () => {
    await render(<Excalidraw />);
    const { elements } = buildScene();
    const blob = new Blob(
      [
        serializeAsJSON(
          elements,
          appStateWith({
            guides: [{ id: "g1", axis: "y", position: 9 }],
          }) as any,
          {},
          "local",
        ),
      ],
      { type: "application/json" },
    );
    const loaded = await loadFromBlob(blob, null, null);
    const lp = loaded.elements.find(
      (element) => element.type === "path",
    ) as ExcalidrawPathElement;
    expect(lp.handles).toHaveLength(4);
    expect(lp.handles[2]).toEqual({ mode: "broken", in: [0, -10], out: null });
    expect(loaded.appState.guides).toEqual([
      { id: "g1", axis: "y", position: 9 },
    ]);
    // and it opens in the editor
    API.updateScene({ elements: loaded.elements as any });
    expect(
      handle.elements.filter((element) => element.type === "path"),
    ).toHaveLength(1);
  });

  it("a file from before these features opens exactly as it did", async () => {
    await render(<Excalidraw />);
    const rect = API.createElement({
      type: "rectangle",
      x: 1,
      y: 2,
      width: 30,
      height: 40,
    });
    const json = serializeAsJSON([rect], handle.state as any, {}, "local");
    const file = JSON.parse(json);
    delete file.appState.guides;
    delete file.appState.gridSize;
    const [rectangle] = restoreElements(file.elements, null);
    expect(rectangle).toMatchObject({
      type: "rectangle",
      x: 1,
      y: 2,
      width: 30,
      height: 40,
    });
    const state = restoreAppState(file.appState, null);
    expect(state.guides).toEqual([]);
    expect(state.rulersEnabled).toBe(false);
    expect(state.gridSize).toBeGreaterThan(0);
  });

  it("an SVG export draws the path, the rotation and the text font", async () => {
    await render(<Excalidraw />);
    const { elements } = buildScene();
    const svg = await exportToSvg(
      elements as any,
      {
        exportBackground: false,
        viewBackgroundColor: "#fff",
        exportEmbedScene: true,
      } as any,
      {},
    );
    const markup = svg.outerHTML;
    expect(markup).toContain("<path");
    expect(markup).toContain("rotate(");
    expect(markup).toContain("Fira Sans");
    // the scene travels inside the svg
    expect(markup).toContain("payload-type:application/vnd.excalidraw+json");
  });

  it("duplicating an anchored pair keeps the copy anchored to the copy", async () => {
    await render(<Excalidraw />);
    const first = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    });
    const second = {
      ...API.createElement({
        type: "rectangle",
        x: 200,
        y: 0,
        width: 50,
        height: 50,
      }),
      customData: {
        anchor: { to: first.id, from: "tr", at: "tl", dx: 150, dy: 0 },
      },
    };
    API.setElements([first, second]);
    API.setSelectedElements([first, second] as any);
    act(() => {
      handle.app.actionManager.executeAction(
        handle.app.actionManager.actions.duplicateSelection,
      );
    });
    const live = handle.elements.filter((element) => !element.isDeleted);
    expect(live).toHaveLength(4);
    const copies = live.filter(
      (element) => element.id !== first.id && element.id !== second.id,
    );
    const copyB = copies.find(
      (element) => (element as any).customData?.anchor,
    ) as any;
    const copyA = copies.find((element) => element !== copyB)!;
    // follows its own copy, not the original
    expect(copyB.customData.anchor.to).toBe(copyA.id);
  });
});
