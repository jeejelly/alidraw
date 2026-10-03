import React from "react";

import { reseed } from "@excalidraw/common";

import { buildElements, boundsOf, themeUpdates } from "@excalidraw/symbols";
import { collectCodeItems } from "@excalidraw/symbols";
import { generateSceneCode, pathData } from "@excalidraw/symbols";
import { generateResponsiveSceneCode } from "@excalidraw/symbols";
import { importSvg } from "@excalidraw/vector";
import { generateCode } from "@excalidraw/symbols";
import { COMPONENTS, defaultsOf } from "@excalidraw/symbols";
import { buildTemplate, TEMPLATES, templateShapes } from "@excalidraw/symbols";
import { ICONS } from "@excalidraw/symbols";
import { parsePath, circle } from "@excalidraw/vector";
import { ALL_THEMES, colorScheme, THEMES } from "@excalidraw/symbols";
import { getPaletteState, setPaletteHeight } from "@excalidraw/color";

import { Excalidraw } from "../index";
import { setSymbolTheme } from "../components/inspector/symbols/themeStore";

import { API } from "./helpers/api";
import { act, fireEvent, render, screen, unmountComponent } from "./test-utils";

unmountComponent();

const handle = window.h;

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
    expect(sub.anchors.map((anchor) => [anchor.x, anchor.y])).toEqual([
      [1, 2],
      [5, 2],
      [5, 6],
      [1, 6],
    ]);
    const [subPath] = parsePath(circle(10, 10, 5));
    expect(subPath.closed).toBe(true);
    expect(subPath.anchors).toHaveLength(4);
    expect(subPath.anchors[0].out).not.toBeNull();
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
    for (const icon of ICONS) {
      expect(names.has(icon.name)).toBe(false);
      names.add(icon.name);
      expect(parsePath(icon.d).length).toBeGreaterThan(0);
    }
  });

  it("every component draws in every theme, at every choice", () => {
    const ids = new Set<string>();
    for (const def of COMPONENTS) {
      expect(ids.has(def.id)).toBe(false);
      ids.add(def.id);
      const base = defaultsOf(def);
      const variants = [base];
      for (const param of def.params ?? []) {
        if (param.kind === "choice") {
          param.options!.forEach((option) =>
            variants.push({ ...base, [param.key]: option }),
          );
        } else if (param.kind === "bool") {
          variants.push({ ...base, [param.key]: !param.def });
        } else if (param.kind === "number") {
          variants.push(
            { ...base, [param.key]: param.min },
            { ...base, [param.key]: param.max },
          );
        }
      }
      for (const theme of ALL_THEMES) {
        for (const variant of variants) {
          const shapes = def.shapes(theme, variant);
          const bounds = boundsOf(shapes);
          expect(shapes.length).toBeGreaterThan(0);
          expect(bounds.w).toBeGreaterThan(0);
          expect(Number.isFinite(bounds.h)).toBe(true);
          for (const shape of shapes) {
            if (shape.t === "icon") {
              expect(ICONS.some((icon) => icon.name === shape.name)).toBe(true);
            }
          }
        }
      }
    }
    expect(COMPONENTS.length).toBeGreaterThan(40);
  });

  it("has the screen kit: toggles, pills, tabs, collapsible bars, knobs, date and time", () => {
    const ids = COMPONENTS.map((component) => component.id);
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
    COMPONENTS.find((component) => component.id === "collapsible-bars")!.shapes(
      night,
      {
        ...defaultsOf(
          COMPONENTS.find((component) => component.id === "collapsible-bars")!,
        ),
        open,
        children,
      },
    );
  const heightOf = (shapes: ReturnType<typeof bars>) => boundsOf(shapes).h;
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
    const def = COMPONENTS.find((component) => component.id === "button")!;
    const els = buildElements(def.shapes(night, defaultsOf(def)), night, {
      x: 10,
      y: 20,
    });
    expect(els.length).toBeGreaterThanOrEqual(2);
    expect(new Set(els.map((element) => element.groupIds[0])).size).toBe(1);
    // a pill is a path with a full bevel, still editable with the corner gizmo
    const pill = els.find((element) => element.type === "path") as any;
    expect(pill.closed).toBe(true);
    expect(pill.handles[0].radius).toBe(20);
    expect(pill.width).toBe(140);
    expect(pill.height).toBe(40);
    expect(els.some((element) => element.type === "text")).toBe(true);
    expect(els.every((element) => !!element.customData?.symbol)).toBe(true);
  });

  it("a soft theme keeps real rectangles", () => {
    const def = COMPONENTS.find((component) => component.id === "button")!;
    const els = buildElements(
      def.shapes(THEMES[0], defaultsOf(def)),
      THEMES[0],
    );
    expect(els.some((element) => element.type === "rectangle")).toBe(true);
  });

  it("re-themes colours and corners", () => {
    const def = COMPONENTS.find((component) => component.id === "button")!;
    const els = buildElements(def.shapes(night, defaultsOf(def)), night);
    const light = THEMES[0];
    const ups = themeUpdates(els, light);
    expect(ups.length).toBe(els.length);
    const bg = ups.find((update) => update.element.type === "path")!;
    expect(bg.updates.backgroundColor).toBe(light.colors.accent);
    expect(bg.updates.handles[0].radius).toBe(8);
  });

  it("inserts from the panel and re-themes the selection", async () => {
    await render(<Excalidraw />);
    act(() => handle.setState({ paletteOpen: true } as any));
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
    const live = handle.elements.filter((element) => !element.isDeleted);
    expect(live.length).toBeGreaterThanOrEqual(2);
    expect(new Set(live.map((element) => element.groupIds[0])).size).toBe(1);
    const before = live.map((element) => element.backgroundColor).join();

    fireEvent.change(screen.getByTestId("symbols-theme-preset"), {
      target: { value: "Forest" },
    });
    fireEvent.click(screen.getByTestId("symbols-apply-all"));
    const after = handle.elements
      .filter((element) => !element.isDeleted)
      .map((element) => element.backgroundColor)
      .join();
    expect(after).not.toBe(before);
  });

  it("inserts an icon at the chosen size", async () => {
    await render(<Excalidraw />);
    act(() => handle.setState({ paletteOpen: true } as any));
    fireEvent.click(screen.getByTestId("inspector-tab-symbols"));
    fireEvent.click(screen.getByTestId("symbols-mode-icons"));
    fireEvent.change(screen.getByTestId("symbols-search"), {
      target: { value: "search" },
    });
    fireEvent.click(screen.getAllByTestId("symbols-icon")[0]);
    const live = handle.elements.filter((element) => !element.isDeleted);
    expect(live.length).toBeGreaterThan(0);
    expect(live.every((element) => element.type === "path")).toBe(true);
  });
});

describe("the palette stays, and the theme is live", () => {
  it("collapses to its title bar and never leaves", async () => {
    await render(<Excalidraw />);
    act(() => handle.setState({ paletteOpen: false } as any));
    const panel = screen.getByTestId("palette-panel");
    expect(panel.getAttribute("data-collapsed")).toBe("true");
    fireEvent.click(screen.getByTestId("palette-collapse"));
    expect(handle.state.paletteOpen).toBe(true);
    expect(
      screen.getByTestId("palette-panel").getAttribute("data-collapsed"),
    ).toBeNull();
    fireEvent.click(screen.getByTestId("palette-collapse"));
    expect(handle.state.paletteOpen).toBe(false);
    expect(screen.queryByTestId("palette-panel")).not.toBeNull();
  });

  it("has every tool of the top bar, on every tab", async () => {
    await render(<Excalidraw />);
    act(() => handle.setState({ paletteOpen: true } as any));
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
    expect(handle.state.activeTool.type).toBe("diamond");
    fireEvent.click(screen.getByTestId("tool-lock"));
    expect(handle.state.activeTool.locked).toBe(true);
  });

  it("restyles every symbol as soon as the theme changes", async () => {
    await render(<Excalidraw />);
    act(() => handle.setState({ paletteOpen: true } as any));
    fireEvent.click(screen.getByTestId("inspector-tab-symbols"));
    fireEvent.change(screen.getByTestId("symbols-search"), {
      target: { value: "switch" },
    });
    fireEvent.click(screen.getAllByTestId("symbols-tile")[0]);
    fireEvent.click(screen.getByTestId("symbols-insert"));
    const colors = () =>
      handle.elements
        .filter((element) => !element.isDeleted)
        .map((element) => element.backgroundColor)
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
    act(() => handle.setState({ paletteOpen: true } as any));
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
    act(() => handle.setState({ paletteOpen: true } as any));
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
    const before = handle.state.gridModeEnabled;
    fireEvent.click(screen.getByTestId("mode-grid"));
    expect(handle.state.gridModeEnabled).toBe(!before);
    expect(screen.getByTestId("mode-grid").getAttribute("aria-pressed")).toBe(
      String(!before),
    );
    fireEvent.click(screen.getByTestId("mode-rulers"));
    expect(handle.state.rulersEnabled).toBe(true);
  });

  it("stretches down as well as sideways", async () => {
    await render(<Excalidraw />);
    act(() => handle.setState({ paletteOpen: true } as any));
    expect(screen.getByTestId("palette-resize-height")).toBeTruthy();
    act(() => setPaletteHeight(500));
    expect(screen.getByTestId("palette-panel").style.height).toBe("500px");
    act(() => setPaletteHeight(null));
    expect(screen.getByTestId("palette-panel").style.height).toBe("");
  });

  it("lists the colours of a theme and keeps them in the swatches", async () => {
    await render(<Excalidraw />);
    act(() => handle.setState({ paletteOpen: true } as any));
    fireEvent.click(screen.getByTestId("inspector-tab-symbols"));
    expect(colorScheme(THEMES[2]).length).toBeGreaterThan(15);
    expect(
      screen.getAllByTestId("symbols-scheme-color").length,
    ).toBeGreaterThan(15);
    fireEvent.click(screen.getByTestId("symbols-scheme-keep"));
    expect(getPaletteState().swatches.length).toBeGreaterThan(10);
  });

  it("ships layout grids", () => {
    const grids = COMPONENTS.filter(
      (component) => component.category === "Grids",
    ).map((component) => component.id);
    expect(grids).toEqual(
      expect.arrayContaining([
        "grid-columns",
        "grid-baseline",
        "grid-square",
        "grid-safe-area",
        "grid-thirds",
      ]),
    );
    const cols = COMPONENTS.find(
      (component) => component.id === "grid-columns",
    )!;
    const twelve = cols
      .shapes(night, defaultsOf(cols))
      .filter((shape) => shape.t === "rect");
    // the frame, plus one band per column
    expect(twelve).toHaveLength(13);
  });
});

describe("code from symbols", () => {
  const items = (id: string, values: any = {}) => {
    const def = COMPONENTS.find((component) => component.id === id)!;
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
    const badge = items("badge")[0];
    const progress = { ...items("progress")[0], y: badge.y - 100 };
    const code = generateCode([badge, progress], night);
    expect(code.html.indexOf("<progress")).toBeLessThan(
      code.html.indexOf("badge badge--"),
    );
  });

  it("the panel turns a selection into code", async () => {
    await render(<Excalidraw />);
    act(() => handle.setState({ paletteOpen: true } as any));
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

describe("screen templates and more code", () => {
  it("every template builds from components that exist, in every theme", () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(6);
    for (const template of TEMPLATES) {
      for (const part of template.parts) {
        expect(
          COMPONENTS.some((component) => component.id === part.component),
        ).toBe(true);
      }
      for (const theme of ALL_THEMES) {
        const els = buildTemplate(template, theme);
        expect(els.length).toBeGreaterThan(10);
        expect(templateShapes(template, theme).length).toBeGreaterThan(10);
      }
    }
  });

  it("a template is one group per part, each remembering its component", () => {
    const template = TEMPLATES.find((x) => x.id === "tpl-login")!;
    const els = buildTemplate(template, THEMES[2]);
    const groups = new Set(els.map((element) => element.groupIds[0]));
    expect(groups.size).toBe(template.parts.length);
    const items = collectCodeItems(els);
    expect(items.map((item) => item.component)).toEqual(
      expect.arrayContaining(["phone", "app-bar", "input", "button"]),
    );
  });

  it("a screen becomes code, frames left out, nothing unmapped", () => {
    for (const template of TEMPLATES) {
      const code = generateCode(
        collectCodeItems(buildTemplate(template, THEMES[2])),
        THEMES[2],
      );
      expect(code.unmapped).toEqual([]);
      expect(code.html).toContain("<body>");
      expect(code.compose).toContain("fun Screen()");
    }
    const login = generateCode(
      collectCodeItems(buildTemplate(TEMPLATES[0], THEMES[2])),
      THEMES[2],
    );
    expect(login.html).toContain(
      '<button class="btn btn--filled" style="width:328px">Sign in</button>',
    );
    expect(login.compose).toContain('Text("Sign in")');
  });

  it("maps pickers, carousel and grids", () => {
    const code = generateCode(
      [
        ...[
          "calendar",
          "time-picker",
          "carousel",
          "grid-columns",
          "date-picker",
        ].flatMap((id) => {
          const def = COMPONENTS.find((component) => component.id === id)!;
          return collectCodeItems(
            buildElements(
              def.shapes(night, defaultsOf(def)),
              night,
              { x: 0, y: 0 },
              id,
              defaultsOf(def),
            ),
          );
        }),
      ].map((it, index) => ({ ...it, y: index * 100 })),
      night,
    );
    expect(code.unmapped).toEqual([]);
    expect(code.html).toContain('<input type="date"');
    expect(code.html).toContain('<input type="time"');
    expect(code.compose).toContain("rememberDatePickerState");
    expect(code.compose).toContain("rememberTimePickerState");
    expect(code.compose).toContain("LazyRow");
    expect(code.compose).toContain("GridCells.Fixed(12)");
  });

  it("the panel inserts a screen as separate parts", async () => {
    await render(<Excalidraw />);
    act(() => handle.setState({ paletteOpen: true } as any));
    fireEvent.click(screen.getByTestId("inspector-tab-symbols"));
    fireEvent.click(screen.getByTestId("symbols-mode-templates"));
    expect(screen.getAllByTestId("symbols-template").length).toBe(
      TEMPLATES.length,
    );
    fireEvent.click(screen.getAllByTestId("symbols-template")[0]);
    const live = handle.elements.filter((element) => !element.isDeleted);
    expect(new Set(live.map((element) => element.groupIds[0])).size).toBe(
      TEMPLATES[0].parts.length,
    );
  });
});

describe("the whole canvas as a page", () => {
  it("places symbols and plain shapes where they are drawn", () => {
    const def = COMPONENTS.find((component) => component.id === "button")!;
    const button = buildElements(
      def.shapes(night, defaultsOf(def)),
      night,
      { x: 300, y: 200 },
      "button",
      defaultsOf(def),
    );
    const box = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 80,
      height: 40,
      backgroundColor: "#ff0000",
      strokeColor: "#000000",
    } as any);
    const dot = API.createElement({
      type: "ellipse",
      x: 120,
      y: 300,
      width: 30,
      height: 30,
      backgroundColor: "#00ff00",
    } as any);
    const label = API.createElement({
      type: "text",
      x: 100,
      y: 60,
      text: "Hello <b>",
      fontSize: 20,
    } as any);
    const svg = importSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><path d="M0 0 L40 0 L20 40 Z" fill="#00f"/></svg>',
      { x: 400, y: 100 },
    ).elements;
    const code = generateSceneCode(
      [box, dot, label, ...svg, ...button] as any,
      night,
    )!;
    expect(code.count).toBe(5);
    // the page starts at the top-left of what is drawn
    expect(code.html).toContain("left:0px;top:40px");
    expect(code.html).toContain("position:absolute;left:200px;top:140px");
    expect(code.html).toContain("background:#ff0000");
    expect(code.html).toContain("border-radius:50%");
    expect(code.html).toContain("Hello &lt;b&gt;");
    expect(code.html).toContain("<svg");
    expect(code.html).toContain('<button class="btn btn--filled"');
    expect(code.compose).toContain("Box(Modifier.offset(200.dp, 140.dp))");
    expect(code.compose).toContain(".background(Color(0xFFFF0000)");
    expect(code.compose).toContain('Text("Hello <b>"');
    expect(code.compose).toContain("// TODO: path");
    expect(code.notes[0]).toContain("not a responsive layout");
    expect(generateSceneCode([], night)).toBeNull();
  });

  it("works out rows, columns and padded boxes", () => {
    const rect = (
      x: number,
      y: number,
      width: number,
      height: number,
      extra = {},
    ) =>
      API.createElement({
        type: "rectangle",
        x,
        y,
        width,
        height,
        ...extra,
      } as any);
    const card = rect(0, 0, 400, 200, { backgroundColor: "#eeeeee" });
    const title = API.createElement({
      type: "text",
      x: 20,
      y: 20,
      text: "Title",
      fontSize: 20,
    } as any);
    const first = rect(20, 100, 100, 40, { backgroundColor: "#ff0000" });
    const second = rect(140, 100, 240, 40, { backgroundColor: "#0000ff" });
    const footer = rect(0, 240, 400, 60, { backgroundColor: "#00ff00" });
    const code = generateResponsiveSceneCode(
      [card, title, first, second, footer] as any,
      night,
    )!;
    // a column of the card and the footer; the card is a padded box holding
    // the title above a row
    expect(code.html).toContain("flex-direction:column");
    expect(code.html).toContain("flex-direction:row");
    expect(code.html).toContain("margin-top:40px"); // gap card -> footer
    expect(code.html).toContain("padding:");
    expect(code.html).toContain("max-width: 400px");
    // both full-width boxes stretch; the wide button of the row takes the room
    expect(code.html).toContain("width:100%");
    expect(code.html).toContain("flex:1");
    expect(code.compose).toContain("Column(");
    expect(code.compose).toContain("Row(");
    expect(code.compose).toContain("Spacer(Modifier.height(40.dp))");
    expect(code.compose).toContain("fillMaxWidth()");
    expect(code.compose).toContain("Modifier.weight(1f)");
    expect(code.notes[0]).toContain("everything flows");
  });

  it("keeps overlapping parts in a fixed box", () => {
    const first = API.createElement({
      type: "ellipse",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    } as any);
    const second = API.createElement({
      type: "ellipse",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
    } as any);
    const code = generateResponsiveSceneCode([first, second] as any, night)!;
    expect(code.html).toContain("position:relative;width:150px;height:150px");
    expect(code.html).toContain("left:50px;top:50px");
    expect(code.notes[0]).toContain("1 group(s)");
    expect(generateResponsiveSceneCode([], night)).toBeNull();
  });

  it("path data keeps curves and holes", () => {
    const { elements } = importSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><path fill="#000" d="M0 0H40V40H0Z M10 10V30H30V10Z"/><path d="M0 0C10 0 20 10 20 20"/></svg>',
    );
    const data = pathData(elements[0] as any);
    expect(data.match(/M/g)).toHaveLength(2);
    expect(data.match(/Z/g)).toHaveLength(2);
    expect(pathData(elements[1] as any)).toContain("C");
  });
});
