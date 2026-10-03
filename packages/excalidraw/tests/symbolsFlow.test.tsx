import React from "react";

import { readFlow, serializeFlow } from "@excalidraw/flow";
import { COMPONENTS, COMPONENT_CATEGORIES } from "@excalidraw/symbols";
import { THEMES } from "@excalidraw/symbols";

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
