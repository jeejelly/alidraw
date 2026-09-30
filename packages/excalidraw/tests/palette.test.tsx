import React from "react";

import { reseed } from "@excalidraw/common";

import { actionTogglePalette } from "../actions";
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
} from "../palette";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { render, fireEvent, screen, act, unmountComponent } from "./test-utils";

unmountComponent();

const { h } = window;

beforeEach(() => {
  localStorage.clear();
  resetPaletteCache();
  reseed(7);
});

const ase = (
  entries: { name: string; model: string; values: number[] }[],
): ArrayBuffer => {
  const parts: number[] = [];
  const u16 = (n: number) => parts.push((n >> 8) & 255, n & 255);
  const u32 = (n: number) =>
    parts.push((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
  const f32 = (n: number) => {
    const b = new DataView(new ArrayBuffer(4));
    b.setFloat32(0, n);
    for (let i = 0; i < 4; i++) {
      parts.push(b.getUint8(i));
    }
  };
  parts.push(...[..."ASEF"].map((c) => c.charCodeAt(0)));
  u16(1);
  u16(0);
  u32(entries.length);
  for (const e of entries) {
    const len = 2 + (e.name.length + 1) * 2 + 4 + e.values.length * 4 + 2;
    u16(0x0001);
    u32(len);
    u16(e.name.length + 1);
    for (const c of e.name) {
      u16(c.charCodeAt(0));
    }
    u16(0);
    parts.push(...[...e.model].map((c) => c.charCodeAt(0)));
    e.values.forEach(f32);
    u16(2);
  }
  return new Uint8Array(parts).buffer;
};

describe("palette store", () => {
  it("adds, renames and removes swatches, which survive a reload", () => {
    const a = addSwatch("#F00", "Signal red")!;
    addSwatch("#00ff00");
    expect(getPaletteState().swatches.map((s) => s.color)).toEqual([
      "#ff0000",
      "#00ff00",
    ]);
    renameSwatch(a.id, "Brand red");
    setPaletteLayout("vertical");

    resetPaletteCache(); // as after a page reload
    const reloaded = getPaletteState();
    expect(reloaded.swatches[0]).toMatchObject({
      name: "Brand red",
      color: "#ff0000",
    });
    expect(reloaded.swatches[1].name).toBe("#00ff00");
    expect(reloaded.layout).toBe("vertical");

    removeSwatch(a.id);
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
    expect(state.layout).toBe("horizontal");
    localStorage.setItem("excalidraw-palette", "{not json");
    resetPaletteCache();
    expect(getPaletteState().swatches).toEqual([]);
  });
});

describe("palette import", () => {
  it("reads GIMP palettes", () => {
    const colors = parseGpl(
      "GIMP Palette\nName: Test\nColumns: 4\n#\n255   0   0\tRed\n 0 128 255 Sky blue\n300 0 0 Bad\n",
    );
    expect(colors).toEqual([
      { name: "Red", color: "#ff0000" },
      { name: "Sky blue", color: "#0080ff" },
    ]);
    expect(parseGpl("not a palette")).toEqual([]);
  });

  it("reads Adobe swatch exchange files", () => {
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
    expect(h.elements[0].backgroundColor).toBe("#0000ff");
    expect(h.elements[0].strokeColor).toBe("#ff0000");

    fireEvent.click(screen.getByTestId("palette-target-stroke"));
    fireEvent.click((await screen.findAllByTestId("palette-swatch"))[1]);
    expect(h.elements[0].strokeColor).toBe("#0000ff");
  });

  it("removes a swatch", async () => {
    addSwatch("#123456", "Mine");
    await open();
    fireEvent.click(screen.getByTestId("palette-manage"));
    fireEvent.click(screen.getByTestId("palette-swatch-remove"));
    expect(getPaletteState().swatches).toHaveLength(0);
  });

  it("switches between horizontal and vertical layout and is dragged", async () => {
    const panel = await open();
    const width = () => (panel as HTMLElement).style.width;
    expect(width()).toBe("420px");
    fireEvent.click(screen.getByTestId("palette-orientation"));
    expect(getPaletteState().layout).toBe("vertical");
    expect(width()).toBe("170px");

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
