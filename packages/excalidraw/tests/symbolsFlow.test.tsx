import React from "react";

import { readFlow, serializeFlow } from "@excalidraw/flow";
import { FONT_FAMILY } from "@excalidraw/common";
import {
  buildElements,
  COMPONENTS,
  COMPONENT_CATEGORIES,
  THEMES,
  themeUpdates,
} from "@excalidraw/symbols";

import { Excalidraw } from "../index";
import { setSymbolTheme } from "../components/inspector/symbols/themeStore";

import { API } from "./helpers/api";
import { act, fireEvent, render, screen, unmountComponent } from "./test-utils";
import { resetTestState } from "./helpers/fixtures";

unmountComponent();

const handle = window.h;

beforeEach(async () => {
  resetTestState();
  localStorage.clear();
  setSymbolTheme(THEMES[2]);
});

/** picks the first component the search finds and inserts it */
const insertFound = async (search: string) => {
  act(() => handle.setState({ paletteOpen: true } as any));
  fireEvent.click(screen.getByTestId("inspector-tab-symbols"));
  fireEvent.change(screen.getByTestId("symbols-search"), {
    target: { value: search },
  });
  fireEvent.click(screen.getAllByTestId("symbols-tile")[0]);
  fireEvent.click(screen.getByTestId("symbols-insert"));
};

const flowNodes = () => readFlow(handle.elements, "Flow 1").nodes;

describe("flow symbols", () => {
  it("has the four new categories, each with components", () => {
    for (const category of ["Flow", "State", "Architecture", "Programming"]) {
      expect(COMPONENT_CATEGORIES).toContain(category);
      expect(
        COMPONENTS.filter((component) => component.category === category)
          .length,
      ).toBeGreaterThan(5);
    }
  });

  it("every flow component names a text param that exists", () => {
    for (const def of COMPONENTS.filter((component) => component.flow)) {
      const param = def.params?.find(
        (candidate) => candidate.key === def.flow!.labelParam,
      );
      expect(param?.kind).toBe("text");
    }
  });

  it("inserts a decision as a flow element with ports", async () => {
    await render(<Excalidraw />);
    await insertFound("yes no diamond");
    const [node] = flowNodes();
    expect(node.label).toBe("Condition?");
    expect(node.shape).toBe("diamond");
    expect(node.ports?.map((port) => port.name)).toEqual([
      "in",
      "yes",
      "no",
      "other",
    ]);
    expect(serializeFlow(readFlow(handle.elements, "Flow 1"))).toContain(
      '{"Condition?"}',
    );
  });

  it("inserts a for loop as the hexagon and a while loop as the loop-limit shape, both with loop ports", async () => {
    await render(<Excalidraw />);
    await insertFound("counted");
    await insertFound("until");
    const [forNode, whileNode] = flowNodes();
    expect([forNode.form, forNode.label]).toEqual(["hexagon", "for each item"]);
    expect([whileNode.form, whileNode.label]).toEqual([
      "loop-limit",
      "while condition",
    ]);
    for (const node of [forNode, whileNode]) {
      expect(node.ports?.map((port) => port.name)).toEqual([
        "in",
        "body",
        "exit",
        "back",
      ]);
    }
    const text = serializeFlow(readFlow(handle.elements, "Flow 1"));
    expect(text).toContain('{{"for each item"}}');
    expect(text).toContain('@{ shape: notch-pent, label: "while condition" }');
  });

  it("inserts a database as a cylinder", async () => {
    await render(<Excalidraw />);
    await insertFound("storage data cylinder db flowchart");
    const [node] = flowNodes();
    expect(node.form).toBe("cylinder");
    expect(node.label).toBe("Users");
    expect(serializeFlow(readFlow(handle.elements, "Flow 1"))).toContain(
      '[("Users")]',
    );
  });

  it("inserts a state as a rounded step", async () => {
    await render(<Excalidraw />);
    await insertFound("entry exit");
    const [node] = flowNodes();
    expect(node.shape).toBe("round");
    expect(node.label).toBe("Idle");
  });

  it("joins the flow of the selection", async () => {
    await render(<Excalidraw />);
    await insertFound("storage data cylinder db flowchart");
    await insertFound("yes no diamond");
    expect(flowNodes()).toHaveLength(2);
  });

  it("leaves a component without flow alone", async () => {
    await render(<Excalidraw />);
    API.setElements([]);
    await insertFound("switch");
    expect(handle.elements.some((element) => element.customData?.flow)).toBe(
      false,
    );
  });
});

describe("filled shapes and code fonts", () => {
  const buildComponent = (id: string) => {
    const def = COMPONENTS.find((component) => component.id === id)!;
    const values = Object.fromEntries(
      (def.params ?? []).map((param) => [param.key, param.def]),
    );
    return buildElements(def.shapes(THEMES[2], values as any), THEMES[2], {
      x: 0,
      y: 0,
    });
  };

  it("a decision, a parallelogram and a display are filled polygons", () => {
    for (const id of ["flow-decision", "flow-input-output", "flow-display"]) {
      const polygons = buildComponent(id).filter(
        (element: any) => element.type === "line" && element.polygon,
      );
      expect(polygons.length).toBeGreaterThan(0);
      for (const polygon of polygons) {
        expect(polygon.backgroundColor).toBe(THEMES[2].colors.surface);
      }
    }
  });

  it("re-theming recolours the fill of a polygon", () => {
    const [polygon] = buildComponent("flow-decision").filter(
      (element: any) => element.type === "line" && element.polygon,
    );
    const dark = THEMES[THEMES.length - 1];
    const [update] = themeUpdates([polygon], dark);
    expect(update.updates.backgroundColor).toBe(dark.colors.surface);
  });

  it("code uses a monospace face, other text does not", () => {
    const texts = buildComponent("prog-note").filter(
      (element: any) => element.type === "text",
    ) as any[];
    const byText = (content: string) =>
      texts.find((element) => element.text.includes(content))!;
    expect(byText("run();").fontFamily).toBe(FONT_FAMILY.Cascadia);
    expect(byText("Snippet").fontFamily).toBe(FONT_FAMILY.Nunito);
  });
});
