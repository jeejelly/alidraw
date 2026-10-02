import React from "react";

import { reseed } from "@excalidraw/common";

import { Excalidraw } from "../index";
import { buildElements, boundsOf, themeUpdates } from "../symbols/build";
import { collectCodeItems } from "../symbols/codeItems";
import { generateCode } from "../symbols/codegen";
import { COMPONENTS, defaultsOf } from "../symbols/components";
import { ICONS } from "../symbols/icons";
import { parsePath, circle } from "../symbols/svgPath";
import { ALL_THEMES, colorScheme, THEMES } from "../symbols/theme";
import { getPaletteState, setPaletteHeight } from "../palette";
import { setSymbolTheme } from "../symbols/themeStore";

import { act, fireEvent, render, screen, unmountComponent } from "./test-utils";

unmountComponent();

const { h } = window;

beforeEach(() => {
  localStorage.clear();
  setSymbolTheme(THEMES[2]);
  reseed(7);
});

const night = THEMES[2];

describe("path data", () => {
  it("reads lines, curves and closing", () => {
    const [sub] = parsePath("M1 2 L5 2 l0 4 H1 Z");
    expect(sub.closed).toBe(true);
    expect(sub.anchors.map((a) => [a.x, a.y])).toEqual([
      [1, 2],
      [5, 2],
      [5, 6],
      [1, 6],
    ]);
    const [c] = parsePath(circle(10, 10, 5));
    expect(c.closed).toBe(true);
    expect(c.anchors).toHaveLength(4);
    expect(c.anchors[0].out).not.toBeNull();
  });
  it("splits sub-paths and refuses what it cannot draw", () => {
    expect(parsePath("M0 0L1 1M5 5L6 6")).toHaveLength(2);
    expect(() => parsePath("M0 0X1 1")).toThrow();
  });
});

describe("the library", () => {
  it("every icon is drawable", () => {
    expect(ICONS.length).toBeGreaterThan(100);
    const names = new Set<string>();
    for (const i of ICONS) {
      expect(names.has(i.name)).toBe(false);
      names.add(i.name);
      expect(parsePath(i.d).length).toBeGreaterThan(0);
    }
  });

  it("every component draws in every theme, at every choice", () => {
    const ids = new Set<string>();
    for (const def of COMPONENTS) {
      expect(ids.has(def.id)).toBe(false);
      ids.add(def.id);
      const base = defaultsOf(def);
      const variants = [base];
      for (const p of def.params ?? []) {
        if (p.kind === "choice") {
          p.options!.forEach((o) => variants.push({ ...base, [p.key]: o }));
        } else if (p.kind === "bool") {
          variants.push({ ...base, [p.key]: !p.def });
        } else if (p.kind === "number") {
          variants.push(
            { ...base, [p.key]: p.min },
            { ...base, [p.key]: p.max },
          );
        }
      }
      for (const theme of ALL_THEMES) {
        for (const v of variants) {
          const shapes = def.shapes(theme, v);
          const b = boundsOf(shapes);
          expect(shapes.length).toBeGreaterThan(0);
          expect(b.w).toBeGreaterThan(0);
          expect(Number.isFinite(b.h)).toBe(true);
          for (const s of shapes) {
            if (s.t === "icon") {
              expect(ICONS.some((i) => i.name === s.name)).toBe(true);
            }
          }
        }
      }
    }
    expect(COMPONENTS.length).toBeGreaterThan(40);
  });

  it("has the screen kit: toggles, pills, tabs, collapsible bars, knobs, date and time", () => {
    const ids = COMPONENTS.map((c) => c.id);
    for (const id of [
      "toggle",
      "pills",
      "tabs",
      "collapsible-bars",
      "knob",
      "slider",
      "calendar",
      "time-picker",
      "app-bar",
      "navigation-bar",
      "scaffold",
      "fab",
      "list",
    ]) {
      expect(ids).toContain(id);
    }
  });
});

describe("collapsible bars are parametric", () => {
  const bars = (open: string, children: number) =>
    COMPONENTS.find((c) => c.id === "collapsible-bars")!.shapes(night, {
      ...defaultsOf(COMPONENTS.find((c) => c.id === "collapsible-bars")!),
      open,
      children,
    });
  const heightOf = (s: ReturnType<typeof bars>) => boundsOf(s).h;
  it("grows with the open bars and their nested bars", () => {
    const closed = heightOf(bars("", 2));
    const one = heightOf(bars("1", 2));
    const two = heightOf(bars("1,3", 2));
    expect(one).toBe(closed + 2 * 48);
    expect(two).toBe(closed + 4 * 48);
    expect(heightOf(bars("1", 0))).toBe(closed + 48);
  });
});

describe("on the canvas", () => {
  it("builds one group of editable shapes, with paths for pills and icons", () => {
    const def = COMPONENTS.find((c) => c.id === "button")!;
    const els = buildElements(def.shapes(night, defaultsOf(def)), night, {
      x: 10,
      y: 20,
    });
    expect(els.length).toBeGreaterThanOrEqual(2);
    expect(new Set(els.map((e) => e.groupIds[0])).size).toBe(1);
    // a pill is a path with a full bevel, still editable with the corner gizmo
    const pill = els.find((e) => e.type === "path") as any;
    expect(pill.closed).toBe(true);
    expect(pill.handles[0].radius).toBe(20);
    expect(pill.width).toBe(140);
    expect(pill.height).toBe(40);
    expect(els.some((e) => e.type === "text")).toBe(true);
    expect(els.every((e) => !!e.customData?.symbol)).toBe(true);
  });

  it("a soft theme keeps real rectangles", () => {
    const def = COMPONENTS.find((c) => c.id === "button")!;
    const els = buildElements(
      def.shapes(THEMES[0], defaultsOf(def)),
      THEMES[0],
    );
    expect(els.some((e) => e.type === "rectangle")).toBe(true);
  });

  it("re-themes colours and corners", () => {
    const def = COMPONENTS.find((c) => c.id === "button")!;
    const els = buildElements(def.shapes(night, defaultsOf(def)), night);
    const light = THEMES[0];
    const ups = themeUpdates(els, light);
    expect(ups.length).toBe(els.length);
    const bg = ups.find((u) => u.element.type === "path")!;
    expect(bg.updates.backgroundColor).toBe(light.colors.accent);
    expect(bg.updates.handles[0].radius).toBe(8);
  });

  it("inserts from the panel and re-themes the selection", async () => {
    await render(<Excalidraw />);
    act(() => h.setState({ paletteOpen: true } as any));
    fireEvent.click(screen.getByTestId("inspector-tab-symbols"));
    expect(screen.getAllByTestId("symbols-tile").length).toBeGreaterThan(20);

    fireEvent.change(screen.getByTestId("symbols-search"), {
      target: { value: "switch" },
    });
    const tiles = screen.getAllByTestId("symbols-tile");
    expect(tiles).toHaveLength(1);
    fireEvent.click(tiles[0]);
    expect(screen.getByTestId("symbols-detail")).toBeTruthy();
    fireEvent.click(screen.getByTestId("symbols-insert"));
    const live = h.elements.filter((e) => !e.isDeleted);
    expect(live.length).toBeGreaterThanOrEqual(2);
    expect(new Set(live.map((e) => e.groupIds[0])).size).toBe(1);
    const before = live.map((e) => e.backgroundColor).join();

    fireEvent.change(screen.getByTestId("symbols-theme-preset"), {
      target: { value: "Forest" },
    });
    fireEvent.click(screen.getByTestId("symbols-apply-all"));
    const after = h.elements
      .filter((e) => !e.isDeleted)
      .map((e) => e.backgroundColor)
      .join();
    expect(after).not.toBe(before);
  });

  it("inserts an icon at the chosen size", async () => {
    await render(<Excalidraw />);
    act(() => h.setState({ paletteOpen: true } as any));
    fireEvent.click(screen.getByTestId("inspector-tab-symbols"));
    fireEvent.click(screen.getByTestId("symbols-mode-icons"));
    fireEvent.change(screen.getByTestId("symbols-search"), {
      target: { value: "search" },
    });
    fireEvent.click(screen.getAllByTestId("symbols-icon")[0]);
    const live = h.elements.filter((e) => !e.isDeleted);
    expect(live.length).toBeGreaterThan(0);
    expect(live.every((e) => e.type === "path")).toBe(true);
  });
});

describe("the palette stays, and the theme is live", () => {
  it("collapses to its title bar and never leaves", async () => {
    await render(<Excalidraw />);
    act(() => h.setState({ paletteOpen: false } as any));
    const panel = screen.getByTestId("palette-panel");
    expect(panel.getAttribute("data-collapsed")).toBe("true");
    fireEvent.click(screen.getByTestId("palette-collapse"));
    expect(h.state.paletteOpen).toBe(true);
    expect(
      screen.getByTestId("palette-panel").getAttribute("data-collapsed"),
    ).toBeNull();
    fireEvent.click(screen.getByTestId("palette-collapse"));
    expect(h.state.paletteOpen).toBe(false);
    expect(screen.queryByTestId("palette-panel")).not.toBeNull();
  });

  it("has every tool of the top bar, on every tab", async () => {
    await render(<Excalidraw />);
    act(() => h.setState({ paletteOpen: true } as any));
    for (const tab of ["design", "symbols", "flow"]) {
      fireEvent.click(screen.getByTestId(`inspector-tab-${tab}`));
      for (const id of [
        "lock",
        "hand",
        "selection",
        "rectangle",
        "diamond",
        "ellipse",
        "arrow",
        "line",
        "freedraw",
        "text",
        "eraser",
      ]) {
        expect(screen.getByTestId(`tool-${id}`)).toBeTruthy();
      }
    }
    fireEvent.click(screen.getByTestId("tool-diamond"));
    expect(h.state.activeTool.type).toBe("diamond");
    fireEvent.click(screen.getByTestId("tool-lock"));
    expect(h.state.activeTool.locked).toBe(true);
  });

  it("restyles every symbol as soon as the theme changes", async () => {
    await render(<Excalidraw />);
    act(() => h.setState({ paletteOpen: true } as any));
    fireEvent.click(screen.getByTestId("inspector-tab-symbols"));
    fireEvent.change(screen.getByTestId("symbols-search"), {
      target: { value: "switch" },
    });
    fireEvent.click(screen.getAllByTestId("symbols-tile")[0]);
    fireEvent.click(screen.getByTestId("symbols-insert"));
    const colors = () =>
      h.elements
        .filter((e) => !e.isDeleted)
        .map((e) => e.backgroundColor)
        .join();
    const before = colors();
    fireEvent.change(screen.getByTestId("symbols-theme-preset"), {
      target: { value: "Forest" },
    });
    expect(colors()).not.toBe(before);
    expect(colors()).toContain("#4ade80");
  });

  it("takes corners as a number or a slider, and any stroke width", async () => {
    await render(<Excalidraw />);
    act(() => h.setState({ paletteOpen: true } as any));
    fireEvent.click(screen.getByTestId("inspector-tab-symbols"));
    fireEvent.change(screen.getByTestId("symbols-radius"), {
      target: { value: "13" },
    });
    expect(
      (screen.getByTestId("symbols-radius-range") as HTMLInputElement).value,
    ).toBe("13");
    fireEvent.change(screen.getByTestId("symbols-radius-range"), {
      target: { value: "4" },
    });
    expect(
      (screen.getByTestId("symbols-radius") as HTMLInputElement).value,
    ).toBe("4");
    fireEvent.change(screen.getByTestId("symbols-stroke"), {
      target: { value: "12" },
    });
    expect(
      (screen.getByTestId("symbols-stroke") as HTMLInputElement).value,
    ).toBe("12");
  });
});

describe("modes, height, reference colours, grids", () => {
  it("has the switches of the preferences as icons, and they work", async () => {
    await render(<Excalidraw />);
    act(() => h.setState({ paletteOpen: true } as any));
    for (const id of [
      "snap-objects",
      "snap-guides",
      "rulers",
      "grid",
      "arrow-binding",
      "midpoints",
      "zen",
    ]) {
      expect(screen.getByTestId(`mode-${id}`)).toBeTruthy();
    }
    const before = h.state.gridModeEnabled;
    fireEvent.click(screen.getByTestId("mode-grid"));
    expect(h.state.gridModeEnabled).toBe(!before);
    expect(screen.getByTestId("mode-grid").getAttribute("aria-pressed")).toBe(
      String(!before),
    );
    fireEvent.click(screen.getByTestId("mode-rulers"));
    expect(h.state.rulersEnabled).toBe(true);
  });

  it("stretches down as well as sideways", async () => {
    await render(<Excalidraw />);
    act(() => h.setState({ paletteOpen: true } as any));
    expect(screen.getByTestId("palette-resize-height")).toBeTruthy();
    act(() => setPaletteHeight(500));
    expect(screen.getByTestId("palette-panel").style.height).toBe("500px");
    act(() => setPaletteHeight(null));
    expect(screen.getByTestId("palette-panel").style.height).toBe("");
  });

  it("lists the colours of a theme and keeps them in the swatches", async () => {
    await render(<Excalidraw />);
    act(() => h.setState({ paletteOpen: true } as any));
    fireEvent.click(screen.getByTestId("inspector-tab-symbols"));
    expect(colorScheme(THEMES[2]).length).toBeGreaterThan(15);
    expect(
      screen.getAllByTestId("symbols-scheme-color").length,
    ).toBeGreaterThan(15);
    fireEvent.click(screen.getByTestId("symbols-scheme-keep"));
    expect(getPaletteState().swatches.length).toBeGreaterThan(10);
  });

  it("ships layout grids", () => {
    const grids = COMPONENTS.filter((c) => c.category === "Grids").map(
      (c) => c.id,
    );
    expect(grids).toEqual(
      expect.arrayContaining([
        "grid-columns",
        "grid-baseline",
        "grid-square",
        "grid-safe-area",
        "grid-thirds",
      ]),
    );
    const cols = COMPONENTS.find((c) => c.id === "grid-columns")!;
    const twelve = cols
      .shapes(night, defaultsOf(cols))
      .filter((s) => s.t === "rect");
    // the frame, plus one band per column
    expect(twelve).toHaveLength(13);
  });
});

describe("code from symbols", () => {
  const items = (id: string, values: any = {}) => {
    const def = COMPONENTS.find((c) => c.id === id)!;
    const els = buildElements(
      def.shapes(night, { ...defaultsOf(def), ...values }),
      night,
      { x: 10, y: 20 },
      id,
      values,
    );
    return collectCodeItems(els);
  };

  it("remembers what a component is, its settings and its size", () => {
    const [it] = items("button", { label: "Pay now", look: "tonal" });
    expect(it).toMatchObject({
      component: "button",
      values: { label: "Pay now", look: "tonal" },
      x: 10,
      y: 20,
    });
    expect(it.width).toBe(140);
  });

  it("writes HTML and Jetpack Compose with the theme's colours and labels", () => {
    const code = generateCode(
      [
        ...items("button", { label: "Pay now", width: 200 }),
        ...items("toggle", { on: false, label: "Alerts" }),
      ],
      night,
    );
    expect(code.html).toContain(
      '<button class="btn btn--filled" style="width:200px">Pay now</button>',
    );
    expect(code.html).toContain("--accent: #f472b6");
    expect(code.html).toContain("--radius: 999px");
    expect(code.compose).toContain('Text("Pay now")');
    expect(code.compose).toContain("mutableStateOf(false)");
    expect(code.compose).toContain("primary = Color(0xFFF472B6)");
    expect(code.unmapped).toEqual([]);
  });

  it("escapes text and says what it has no mapping for", () => {
    const code = generateCode(
      [...items("button", { label: 'A <b> & "q" $x' }), ...items("knob")],
      THEMES[0],
    );
    expect(code.html).toContain('A &lt;b&gt; &amp; "q" $x');
    expect(code.compose).toContain('Text("A <b> & \\"q\\" \\$x")');
    expect(code.unmapped).toEqual(["knob"]);
    expect(code.compose).toContain("// TODO: Knob");
  });

  it("orders components top to bottom", () => {
    const a = items("badge")[0];
    const b = { ...items("progress")[0], y: a.y - 100 };
    const code = generateCode([a, b], night);
    expect(code.html.indexOf("<progress")).toBeLessThan(
      code.html.indexOf("badge badge--"),
    );
  });

  it("the panel turns a selection into code", async () => {
    await render(<Excalidraw />);
    act(() => h.setState({ paletteOpen: true } as any));
    fireEvent.click(screen.getByTestId("inspector-tab-symbols"));
    fireEvent.change(screen.getByTestId("symbols-search"), {
      target: { value: "switch" },
    });
    fireEvent.click(screen.getAllByTestId("symbols-tile")[0]);
    fireEvent.click(screen.getByTestId("symbols-insert"));
    fireEvent.click(screen.getByTestId("symbols-code-html"));
    expect(
      (screen.getByTestId("symbols-code-text") as HTMLTextAreaElement).value,
    ).toContain('class="switch"');
    fireEvent.click(screen.getByTestId("symbols-code-compose"));
    expect(
      (screen.getByTestId("symbols-code-text") as HTMLTextAreaElement).value,
    ).toContain("fun Screen()");
  });
});
