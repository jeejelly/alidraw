import fs from "node:fs";
import path from "node:path";

import { FONT_FAMILY } from "@excalidraw/common";

import React from "react";

import { actionTextToVectors } from "../actions";
import { Excalidraw } from "../index";
import {
  setOutlineFontLoader,
  textToPaths,
  type FontLoader,
  type GlyphFont,
} from "../text/textToPaths";

import { API } from "./helpers/api";
import { act, render, unmountComponent } from "./test-utils";

unmountComponent();
const { h } = window;

/** the real font files of the repo, as the app would fetch them */
const fontsDir = path.join(__dirname, "..", "fonts", "Nunito");
const cache: GlyphFont[] = [];
const loader: FontLoader = async (_family, cp) => {
  if (!cache.length) {
    const [{ default: loadWoff2 }, opentype] = await Promise.all([
      import("../subset/woff2/woff2-loader"),
      import("opentype.js"),
    ]);
    const { decompress } = await loadWoff2();
    for (const file of fs
      .readdirSync(fontsDir)
      .filter((f) => f.endsWith(".woff2"))) {
      const buf = fs.readFileSync(path.join(fontsDir, file));
      const ttf = decompress(
        buf.buffer.slice(
          buf.byteOffset,
          buf.byteOffset + buf.byteLength,
        ) as ArrayBuffer,
      );
      cache.push(opentype.parse(ttf.buffer as ArrayBuffer));
    }
  }
  return (
    cache.find(
      (f) => (f as any).charToGlyphIndex(String.fromCodePoint(cp)) > 0,
    ) ?? null
  );
};

describe("text to vectors", () => {
  it("turns each glyph into a path, with holes kept, where the text was", async () => {
    const text = API.createElement({
      type: "text",
      x: 100,
      y: 50,
      text: "Oh\nbe",
      fontSize: 40,
      fontFamily: FONT_FAMILY.Nunito,
      strokeColor: "#e03131",
    } as any) as any;
    const out = (await textToPaths(text, loader))!;
    expect(out).toBeTruthy();
    // four letters, four paths, one group, all of them paths
    expect(out.elements).toHaveLength(4);
    expect(new Set(out.elements.map((e) => e.type))).toEqual(new Set(["path"]));
    expect(new Set(out.elements.map((e) => e.groupIds[0])).size).toBe(1);
    expect(out.elements.every((e) => e.backgroundColor === "#e03131")).toBe(
      true,
    );
    // the O and the b have a counter: a hole (a contour) each
    const holes = out.elements.map((e) => ((e as any).contours ?? []).length);
    expect(holes[0]).toBeGreaterThan(0);
    expect(holes[2]).toBeGreaterThan(0); // b
    expect(holes[1]).toBe(0); // h has none
    // the letters sit inside the text's box, the second line below the first
    const [o, , b] = out.elements;
    expect(o.x).toBeGreaterThanOrEqual(text.x - 2);
    expect(b.y).toBeGreaterThan(o.y + 20);
    expect(out.missing).toEqual([]);
  });

  it("says which characters the font cannot draw, and leaves them out", async () => {
    const text = API.createElement({
      type: "text",
      x: 0,
      y: 0,
      text: "a☃",
      fontSize: 30,
      fontFamily: FONT_FAMILY.Nunito,
    } as any) as any;
    const out = (await textToPaths(text, loader))!;
    expect(out.elements).toHaveLength(1);
    expect(out.missing).toEqual(["☃"]);
    const none = await textToPaths({ ...text, text: "☃" }, loader);
    expect(none).toBeNull();
  });

  it("center and right alignment move the glyphs like the canvas does", async () => {
    const make = (textAlign: string) =>
      API.createElement({
        type: "text",
        x: 0,
        y: 0,
        text: "i",
        fontSize: 30,
        width: 200,
        fontFamily: FONT_FAMILY.Nunito,
        textAlign,
      } as any) as any;
    const left = (await textToPaths(make("left"), loader))!.elements[0];
    const center = (await textToPaths(make("center"), loader))!.elements[0];
    const right = (await textToPaths(make("right"), loader))!.elements[0];
    expect(center.x).toBeGreaterThan(left.x + 50);
    expect(right.x).toBeGreaterThan(center.x + 50);
  });

  it("the action replaces the selected text with its shapes and selects them", async () => {
    await render(<Excalidraw />);
    setOutlineFontLoader(loader);
    try {
      const text = API.createElement({
        type: "text",
        x: 20,
        y: 20,
        text: "Hi",
        fontSize: 40,
        fontFamily: FONT_FAMILY.Nunito,
      } as any);
      API.setElements([text]);
      API.setSelectedElements([text]);
      await act(async () => {
        await h.app.actionManager.executeAction(actionTextToVectors);
      });
      const live = h.elements.filter((e) => !e.isDeleted);
      expect(live.every((e) => e.type === "path")).toBe(true);
      expect(live).toHaveLength(2);
      expect(Object.keys(h.state.selectedElementIds)).toHaveLength(2);
      expect(h.elements.find((e) => e.id === text.id)!.isDeleted).toBe(true);
    } finally {
      setOutlineFontLoader(null);
    }
  });
});
