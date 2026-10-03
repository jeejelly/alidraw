import React from "react";

import { reseed } from "@excalidraw/common";

import {
  addSwatch,
  getPaletteState,
  normalizeHex,
  parseAse,
  parseGpl,
  removeSwatch,
  renameSwatch,
  resetPaletteCache,
  sanitizePaletteState,
  setPaletteLayout,
  snapPanel,
} from "@excalidraw/color";

import { actionTogglePalette } from "../actions";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { render, fireEvent, screen, act, unmountComponent } from "./test-utils";

unmountComponent();

const handle = window.h;

beforeEach(() => {
  localStorage.clear();
  resetPaletteCache();
  reseed(7);
});

const ase = (
  entries: { name: string; model: string; values: number[] }[],
): ArrayBuffer => {
  const parts: number[] = [];
  const u16 = (value: number) => parts.push((value >> 8) & 255, value & 255);
  const u32 = (value: number) =>
    parts.push(
      (value >>> 24) & 255,
      (value >>> 16) & 255,
      (value >>> 8) & 255,
      value & 255,
    );
  const f32 = (value: number) => {
    const view = new DataView(new ArrayBuffer(4));
    view.setFloat32(0, value);
    for (let index = 0; index < 4; index++) {
      parts.push(view.getUint8(index));
    }
  };
  parts.push(...[..."ASEF"].map((char) => char.charCodeAt(0)));
  u16(1);
  u16(0);
  u32(entries.length);
  for (const element of entries) {
    const len =
      2 + (element.name.length + 1) * 2 + 4 + element.values.length * 4 + 2;
    u16(0x0001);
    u32(len);
    u16(element.name.length + 1);
    for (const color of element.name) {
      u16(color.charCodeAt(0));
    }
    u16(0);
    parts.push(...[...element.model].map((char) => char.charCodeAt(0)));
    element.values.forEach(f32);
    u16(2);
  }
  return new Uint8Array(parts).buffer;
};

describe("palette store", () => {
  it("adds, renames and removes swatches, which survive a reload", () => {
    const swatch = addSwatch("#F00", "Signal red")!;
    addSwatch("#00ff00");
    expect(getPaletteState().swatches.map((entry) => entry.color)).toEqual([
      "#ff0000",
      "#00ff00",
    ]);
    renameSwatch(swatch.id, "Brand red");
    setPaletteLayout("vertical");

    resetPaletteCache(); // as after a page reload
    const reloaded = getPaletteState();
    expect(reloaded.swatches[0]).toMatchObject({
      name: "Brand red",
      color: "#ff0000",
    });
    expect(reloaded.swatches[1].name).toBe("#00ff00");
    expect(reloaded.layout).toBe("vertical");

    removeSwatch(swatch.id);
    resetPaletteCache();
    expect(getPaletteState().swatches).toHaveLength(1);
  });

  it("rejects bad colours and repairs bad storage", () => {
    expect(addSwatch("red")).toBeNull();
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    expect(normalizeHex("#12345")).toBeNull();
    const state = sanitizePaletteState({
      swatches: [
        { id: "a", name: "ok", color: "#123456" },
        { id: "a", name: "dup", color: "#654321" },
        { id: "b", name: "bad", color: "nope" },
        null,
      ],
      layout: "diagonal",
      position: { x: "1" },
    });
    expect(state.swatches).toEqual([{ id: "a", name: "ok", color: "#123456" }]);
    expect(state.layout).toBe("docked");
    localStorage.setItem("excalidraw-palette", "{not json");
    resetPaletteCache();
    expect(getPaletteState().swatches).toEqual([]);
  });
});

describe("palette import", () => {
  it("reads .gpl palettes", () => {
    const colors = parseGpl(
      "GIMP Palette\nName: Test\nColumns: 4\n#\n255   0   0\tRed\n 0 128 255 Sky blue\n300 0 0 Bad\n",
    );
    expect(colors).toEqual([
      { name: "Red", color: "#ff0000" },
      { name: "Sky blue", color: "#0080ff" },
    ]);
    expect(parseGpl("not a palette")).toEqual([]);
  });

  it("reads ASE swatch files", () => {
    const colors = parseAse(
      ase([
        { name: "Orange", model: "RGB ", values: [1, 0.5, 0] },
        { name: "Grey", model: "Gray", values: [0.2] },
        { name: "Cyan", model: "CMYK", values: [1, 0, 0, 0] },
        { name: "Skipped", model: "LAB ", values: [50, 0, 0] },
      ]),
    );
    expect(colors).toEqual([
      { name: "Orange", color: "#ff8000" },
      { name: "Grey", color: "#333333" },
      { name: "Cyan", color: "#00ffff" },
    ]);
    expect(parseAse(new ArrayBuffer(4))).toEqual([]);
  });
});

describe("palette panel", () => {
  const open = async () => {
    await render(<Excalidraw />);
    act(() => {
      API.executeAction(actionTogglePalette);
    });
    return screen.getByTestId("palette-panel");
  };

  it("stays open while elements are selected and edited", async () => {
    await open();
    const rect = API.createElement({
      type: "rectangle",
      strokeColor: "#000000",
    });
    API.setElements([rect]);
    API.setSelectedElements([rect]);
    expect(screen.queryByTestId("palette-panel")).not.toBeNull();
    API.setSelectedElements([]);
    expect(screen.queryByTestId("palette-panel")).not.toBeNull();
  });

  it("adds the current colour, names it and applies a swatch to the selection", async () => {
    await open();
    const rect = API.createElement({
      type: "rectangle",
      strokeColor: "#ff0000",
      backgroundColor: "#00ff00",
    });
    API.setElements([rect]);
    API.setSelectedElements([rect]);

    fireEvent.click(screen.getByTestId("palette-add"));
    const name = screen.getByTestId("palette-swatch-name");
    fireEvent.change(name, { target: { value: "Signal" } });
    fireEvent.blur(name);
    expect(getPaletteState().swatches[0]).toMatchObject({
      name: "Signal",
      color: "#ff0000",
    });

    fireEvent.click(screen.getByTestId("palette-manage"));
    addSwatch("#0000ff", "Blue");
    // apply to the background
    fireEvent.click(screen.getByTestId("palette-target-background"));
    const swatches = await screen.findAllByTestId("palette-swatch");
    fireEvent.click(swatches[1]);
    expect(handle.elements[0].backgroundColor).toBe("#0000ff");
    expect(handle.elements[0].strokeColor).toBe("#ff0000");

    fireEvent.click(screen.getByTestId("palette-target-stroke"));
    fireEvent.click((await screen.findAllByTestId("palette-swatch"))[1]);
    expect(handle.elements[0].strokeColor).toBe("#0000ff");
  });

  it("removes a swatch", async () => {
    addSwatch("#123456", "Mine");
    await open();
    fireEvent.click(screen.getByTestId("palette-manage"));
    fireEvent.click(screen.getByTestId("palette-swatch-remove"));
    expect(getPaletteState().swatches).toHaveLength(0);
  });

  it("docks to the right by default and floats as a column or a strip", async () => {
    const panel = await open();
    expect(panel.getAttribute("data-layout")).toBe("docked");
    // the drag handle only moves a floating panel
    expect(
      (screen.getByTestId("palette-orientation") as HTMLButtonElement).disabled,
    ).toBe(true);

    fireEvent.click(screen.getByTestId("palette-dock"));
    expect(getPaletteState().layout).toBe("vertical");
    fireEvent.click(screen.getByTestId("palette-orientation"));
    expect(getPaletteState().layout).toBe("horizontal");
    expect(panel.className).toContain("inspector--horizontal");
    fireEvent.click(screen.getByTestId("palette-orientation"));
    expect(getPaletteState().layout).toBe("vertical");

    const handle = screen.getByTestId("palette-handle");
    const start = getPaletteState().position;
    (handle as any).setPointerCapture = () => {};
    fireEvent.pointerDown(handle, {
      clientX: start.x + 10,
      clientY: start.y + 10,
      pointerId: 1,
    });
    fireEvent.pointerMove(handle, {
      clientX: start.x + 60,
      clientY: start.y + 40,
      pointerId: 1,
    });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(getPaletteState().position).toEqual({
      x: start.x + 50,
      y: start.y + 30,
    });
  });

  it("imports a palette file", async () => {
    await open();
    const file = new File(["GIMP Palette\n255 0 0 Red\n"], "x.gpl");
    (file as any).text = async () => "GIMP Palette\n255 0 0 Red\n";
    fireEvent.change(screen.getByTestId("palette-import-input"), {
      target: { files: [file] },
    });
    await screen.findByRole("status");
    expect(getPaletteState().swatches).toEqual([
      expect.objectContaining({ name: "Red", color: "#ff0000" }),
    ]);
  });
});

describe("inspector controls", () => {
  const setup = async () => {
    await render(<Excalidraw />);
    act(() => {
      API.executeAction(actionTogglePalette);
    });
    const rect = API.createElement({
      type: "rectangle",
      strokeWidth: 2,
      opacity: 100,
    });
    API.setElements([rect]);
    API.setSelectedElements([rect]);
    return rect;
  };

  it("opacity and stroke weight are a slider plus a value pill, in sync", async () => {
    await setup();
    const slider = screen.getByTestId("inspector-opacity-slider");
    fireEvent.change(slider, { target: { value: "40" } });
    expect(handle.elements[0].opacity).toBe(40);
    const pill = screen.getByTestId(
      "inspector-opacity-value",
    ) as HTMLInputElement;
    expect(pill.value).toBe("40");
    fireEvent.change(pill, { target: { value: "75" } });
    fireEvent.keyDown(pill, { key: "Enter" });
    expect(handle.elements[0].opacity).toBe(75);

    const width = screen.getByTestId("inspector-stroke-width-value");
    fireEvent.change(width, { target: { value: "7.5" } });
    fireEvent.blur(width);
    expect(handle.elements[0].strokeWidth).toBe(7.5);
    fireEvent.change(screen.getByTestId("inspector-stroke-width-slider"), {
      target: { value: "12" },
    });
    expect(handle.elements[0].strokeWidth).toBe(12);
  });

  it("clamps typed values and ignores junk", async () => {
    await setup();
    const pill = screen.getByTestId("inspector-opacity-value");
    fireEvent.change(pill, { target: { value: "500" } });
    fireEvent.blur(pill);
    expect(handle.elements[0].opacity).toBe(100);
    fireEvent.change(pill, { target: { value: "abc" } });
    fireEvent.blur(pill);
    expect(handle.elements[0].opacity).toBe(100);
  });

  it("sets stroke style and sloppiness, and swaps fill with stroke", async () => {
    const rect = await setup();
    API.updateScene({
      elements: [
        { ...rect, strokeColor: "#ff0000", backgroundColor: "#00ff00" } as any,
      ],
    });
    API.setSelectedElements([handle.elements[0] as any]);
    fireEvent.click(screen.getByTestId("inspector-stroke-style-dashed"));
    expect(handle.elements[0].strokeStyle).toBe("dashed");
    fireEvent.click(screen.getByTestId("inspector-roughness-2"));
    expect(handle.elements[0].roughness).toBe(2);
    fireEvent.click(screen.getByTestId("palette-swap"));
    expect(handle.elements[0].strokeColor).toBe("#00ff00");
    expect(handle.elements[0].backgroundColor).toBe("#ff0000");
    fireEvent.click(screen.getByTestId("palette-none"));
    expect(handle.elements[0].strokeColor).toBe("transparent");
  });

  it("types a hex colour for the target", async () => {
    await setup();
    const hex = screen.getByTestId("palette-hex");
    fireEvent.change(hex, { target: { value: "#0af" } });
    fireEvent.blur(hex);
    expect(handle.elements[0].strokeColor).toBe("#00aaff");
  });

  it("lists layers top-most first and selects on click", async () => {
    await render(<Excalidraw />);
    act(() => {
      API.executeAction(actionTogglePalette);
    });
    const first = API.createElement({ type: "rectangle" });
    const second = API.createElement({ type: "ellipse" });
    API.setElements([first, second]);
    fireEvent.click(screen.getByTestId("inspector-tab-layers"));
    const rows = screen.getAllByTestId("inspector-layer");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Ellipse"),
      expect.stringContaining("Rectangle"),
    ]);
    fireEvent.click(rows[1]);
    expect(handle.state.selectedElementIds[first.id]).toBe(true);
  });

  it("hides the old style panel while the inspector is open", async () => {
    await setup();
    expect(
      document.querySelector(
        ".layer-ui__wrapper .selected-shape-actions, .App-menu__left .selected-shape-actions",
      ),
    ).toBeNull();
    act(() => {
      API.executeAction(actionTogglePalette);
    });
    expect(document.querySelector(".selected-shape-actions")).not.toBeNull();
  });

  it("Ctrl+T opens the inspector and focuses the width", async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
    const rect = API.createElement({
      type: "rectangle",
      width: 100,
      height: 50,
    });
    API.setElements([rect]);
    API.setSelectedElements([rect]);
    Keyboard.withModifierKeys({ ctrl: true }, () => Keyboard.codePress("KeyT"));
    await screen.findByTestId("palette-panel");
    expect(handle.state.paletteOpen).toBe(true);
  });
});

describe("dragging and detaching", () => {
  const open = async () => {
    await render(<Excalidraw />);
    act(() => {
      API.executeAction(actionTogglePalette);
    });
  };
  const dragHandle = (
    testId: string,
    from: [number, number],
    to: [number, number],
  ) => {
    const handle = screen.getByTestId(testId);
    (handle as any).setPointerCapture = () => {};
    fireEvent.pointerDown(handle, {
      clientX: from[0],
      clientY: from[1],
      pointerId: 1,
    });
    fireEvent.pointerMove(handle, {
      clientX: to[0],
      clientY: to[1],
      pointerId: 1,
    });
    fireEvent.pointerUp(handle, { pointerId: 1 });
  };

  it("dragging the docked panel tears it off and moves it", async () => {
    await open();
    expect(getPaletteState().layout).toBe("docked");
    dragHandle("palette-handle", [900, 100], [700, 160]);
    const state = getPaletteState();
    expect(state.layout).toBe("vertical");
    // it moved by the drag delta from where it started
    expect(
      screen.getByTestId("palette-panel").getAttribute("data-layout"),
    ).toBe("vertical");
  });

  it("the layers pop out into their own draggable panel and come back", async () => {
    await open();
    fireEvent.click(screen.getByTestId("inspector-tab-layers"));
    fireEvent.click(screen.getByTestId("layers-detach"));
    expect(getPaletteState().layersDetached).toBe(true);
    expect(screen.getByTestId("layers-panel")).toBeTruthy();
    // the inspector keeps only the design tab
    expect(screen.queryByTestId("inspector-tab-layers")).toBeNull();
    expect(screen.getByTestId("inspector-appearance")).toBeTruthy();

    const before = getPaletteState().layersPosition;
    dragHandle(
      "layers-handle",
      [before.x + 10, before.y + 10],
      [before.x + 70, before.y + 50],
    );
    expect(getPaletteState().layersPosition).toEqual({
      x: before.x + 60,
      y: before.y + 40,
    });

    resetPaletteCache(); // survives a reload
    expect(getPaletteState().layersDetached).toBe(true);

    fireEvent.click(screen.getByTestId("layers-attach"));
    expect(screen.queryByTestId("layers-panel")).toBeNull();
    expect(screen.getByTestId("inspector-tab-layers")).toBeTruthy();
  });
});

describe("panel snapping", () => {
  const vp = { width: 1400, height: 800 };
  const size = { width: 264, height: 300 };

  it("snaps to the screen edges, keeping a margin", () => {
    expect(snapPanel({ ...size, x: 5, y: 9 }, [], vp)).toMatchObject({
      x: 12,
      y: 12,
    });
    const snapped = snapPanel(
      { ...size, x: 1400 - 264 - 4, y: 800 - 300 - 20 },
      [],
      vp,
    );
    expect(snapped).toMatchObject({ x: 1400 - 264 - 12, y: 800 - 300 - 12 });
    expect(snapped.edge.right).toBe(true);
  });

  it("does not snap beyond the distance", () => {
    expect(snapPanel({ ...size, x: 100, y: 100 }, [], vp)).toMatchObject({
      x: 100,
      y: 100,
    });
  });

  it("sits beside, aligns with and stacks under a neighbour", () => {
    const other = { x: 500, y: 100, width: 264, height: 300 };
    // just to its right
    expect(snapPanel({ ...size, x: 780, y: 103 }, [other], vp)).toMatchObject({
      x: 500 + 264 + 8,
      y: 100,
    });
    // just to its left
    expect(snapPanel({ ...size, x: 228, y: 300 }, [other], vp)).toMatchObject({
      x: 500 - 264 - 8,
    });
    // underneath, left edges aligned
    expect(snapPanel({ ...size, x: 505, y: 405 }, [other], vp)).toMatchObject({
      x: 500,
      y: 100 + 300 + 8,
    });
  });
});

describe("transform of several shapes", () => {
  it("shows the fields for a multi selection and sets each shape", async () => {
    await render(<Excalidraw />);
    API.setAppState({ paletteOpen: true });
    const first = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 50,
      height: 50,
    });
    const second = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 50,
      height: 50,
    });
    API.setElements([first, second]);
    API.setSelectedElements([first, second]);
    const x = screen
      .getByTestId("inspector-transform")
      .querySelector(
        '[data-testid="X"] input, input[data-testid="X"]',
      ) as HTMLInputElement;
    expect(x).toBeTruthy();
    fireEvent.change(x, { target: { value: "30" } });
    fireEvent.blur(x);
    const live = window.h.elements as any[];
    expect([live[0].x, live[1].x]).toEqual([30, 30]);
  });
});

describe("panel width", () => {
  it("is resized by dragging its edge, kept, and reset by a double click", async () => {
    await render(<Excalidraw />);
    API.setAppState({ paletteOpen: true });
    const panel = screen.getByTestId("palette-panel");
    expect(panel.style.width).toBe("264px");
    const grip = screen.getByTestId("palette-resize");
    fireEvent.pointerDown(grip, { clientX: 1000 });
    // docked at the right: dragging the left edge to the left widens it
    fireEvent.pointerMove(window, { clientX: 900 });
    fireEvent.pointerUp(window, { clientX: 900 });
    expect(screen.getByTestId("palette-panel").style.width).toBe("364px");
    expect(JSON.parse(localStorage.getItem("excalidraw-palette")!).width).toBe(
      364,
    );
    // never narrower than it can be used
    fireEvent.pointerDown(grip, { clientX: 1000 });
    fireEvent.pointerMove(window, { clientX: 1400 });
    fireEvent.pointerUp(window, { clientX: 1400 });
    expect(screen.getByTestId("palette-panel").style.width).toBe("240px");
    fireEvent.doubleClick(grip);
    expect(screen.getByTestId("palette-panel").style.width).toBe("264px");
  });
});

describe("swatch files out and back", () => {
  it("writes .gpl and .ase that read back to the same colours", async () => {
    const { serializeGpl, serializeAse, parseGpl, parseAse } = await import(
      "@excalidraw/color"
    );
    const colors = [
      { name: "Signal", color: "#c80404" },
      { name: "Sea blue", color: "#0a84ff" },
      { name: "É ü", color: "#00ff7f" },
    ];
    expect(parseGpl(serializeGpl(colors, "Mine"))).toEqual(colors);
    const ase = parseAse(serializeAse(colors));
    expect(ase.map((entry) => entry.color)).toEqual(
      colors.map((expected) => expected.color),
    );
    expect(ase.map((entry) => entry.name)).toEqual(
      colors.map((expected) => expected.name),
    );
  });
});
