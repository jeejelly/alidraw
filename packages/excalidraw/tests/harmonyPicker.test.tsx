import React from "react";

import { harmony, hexToHsl } from "@excalidraw/color";

import { getPaletteState } from "@excalidraw/color";

import { Excalidraw } from "../index";
import { getSymbolTheme } from "../components/inspector/symbols/themeStore";

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

beforeEach(() => localStorage.clear());

describe("colour harmony picker", () => {
  beforeAll(() => mockBoundingClientRect({ width: 1000, height: 1000 }));
  afterAll(() => restoreOriginalGetBoundingClientRect());

  const openTheme = async () => {
    await render(<Excalidraw />);
    API.setAppState({ paletteOpen: true });
    fireEvent.click(screen.getByTestId("inspector-tab-symbols"));
    fireEvent.click(await screen.findByTestId("symbols-harmony-toggle"));
  };

  it("makes a whole theme from the base colour and a rule", async () => {
    await openTheme();
    fireEvent.change(screen.getByTestId("harmony-base-picker"), {
      target: { value: "#e8590c" },
    });
    fireEvent.click(screen.getByTestId("harmony-rule-triad"));
    // five colours, the base among them
    const chips = screen.getAllByTestId("harmony-chip");
    expect(chips).toHaveLength(5);
    expect(chips.map((chip) => chip.getAttribute("aria-label"))).toContain(
      "#e8590c",
    );

    fireEvent.click(screen.getByTestId("harmony-action-dark"));
    const theme = getSymbolTheme();
    expect(theme.name).toContain("Harmony");
    // the accent keeps the hue, lifted a little to read on dark
    expect(Math.round(hexToHsl(theme.colors.accent).h)).toBe(21);
    expect(hexToHsl(theme.colors.accent).l).toBeGreaterThanOrEqual(50);
    // dark: the page is dark, the text light
    expect(hexToHsl(theme.colors.page).l).toBeLessThan(20);
    expect(hexToHsl(theme.colors.text).l).toBeGreaterThan(85);

    fireEvent.click(screen.getByTestId("harmony-action-light"));
    expect(hexToHsl(getSymbolTheme().colors.page).l).toBeGreaterThan(90);
  });

  it("dragging on the wheel moves the base, and a chip becomes the base", async () => {
    await openTheme();
    const wheel = screen.getByTestId("harmony-wheel");
    // straight up, at the rim: hue 0 (red), full saturation
    fireEvent.pointerDown(wheel, { clientX: 500, clientY: 0, pointerId: 1 });
    const base = (screen.getByTestId("harmony-base") as HTMLInputElement).value;
    expect(hexToHsl(base).h).toBeLessThan(2);
    expect(hexToHsl(base).s).toBeGreaterThan(90);
    // to the right: a quarter turn, yellow-green side
    fireEvent.pointerDown(wheel, { clientX: 1000, clientY: 500, pointerId: 1 });
    expect(
      Math.round(
        hexToHsl((screen.getByTestId("harmony-base") as HTMLInputElement).value)
          .h,
      ),
    ).toBeCloseTo(90, -1);
    // the second colour of the rule as the base
    const second = screen
      .getAllByTestId("harmony-chip")[1]
      .getAttribute("aria-label")!;
    fireEvent.click(screen.getAllByTestId("harmony-chip")[1]);
    expect(
      (
        screen.getByTestId("harmony-base") as HTMLInputElement
      ).value.toLowerCase(),
    ).toBe(second.toLowerCase());
  });

  it("keeps a harmony, or a ready-made palette, in the swatches", async () => {
    await openTheme();
    const before = getPaletteState().swatches.length;
    fireEvent.click(screen.getByTestId("harmony-action-keep"));
    expect(getPaletteState().swatches.length).toBe(before + 5);

    fireEvent.click(screen.getByTestId("harmony-tab-presets"));
    const cards = screen.getAllByTestId("harmony-preset");
    expect(cards.length).toBeGreaterThanOrEqual(12);
    fireEvent.click(
      cards.find((card) => card.getAttribute("title") === "Nord")!,
    );
    const result = screen.getAllByTestId("harmony-chip");
    expect(result.length).toBe(16);
    fireEvent.click(screen.getByTestId("harmony-action-keep"));
    expect(getPaletteState().swatches.length).toBe(before + 5 + 16);
    // as a theme: the palette's most vivid colour leads
    fireEvent.click(screen.getByTestId("harmony-action-light"));
    expect(getSymbolTheme().name).toContain("Harmony");
  });

  it("is in the swatches section too", async () => {
    await render(<Excalidraw />);
    API.setAppState({ paletteOpen: true });
    act(() => {});
    const rect = {
      ...API.createElement({ type: "rectangle" } as any),
      strokeColor: "#3b82f6",
      backgroundColor: "#3b82f6",
    } as any;
    API.setElements([rect]);
    API.setSelectedElements([rect]);
    fireEvent.click(await screen.findByTestId("palette-harmony"));
    expect(screen.getByTestId("harmony")).toBeTruthy();
    // the base starts at the colour in use
    const base = (
      screen.getByTestId("harmony-base") as HTMLInputElement
    ).value.toLowerCase();
    expect(base).toBe("#3b82f6");
    expect(harmony(base, "analogous").colors).toHaveLength(5);
  });
});
