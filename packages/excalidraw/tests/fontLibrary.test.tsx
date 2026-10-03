import fs from "node:fs";
import path from "node:path";

import React from "react";

import { actionChangeLibraryFont } from "../actions";
import {
  findLibraryFont,
  hasExactStyle,
  libraryFileUrl,
  loadFontCatalogue,
  pickLibraryStyle,
  setFontCatalogue,
} from "../fonts/library";
import { Excalidraw } from "../index";
import { textToPaths } from "../text/textToPaths";

import { API } from "./helpers/api";
import { act, render, unmountComponent } from "./test-utils";

unmountComponent();
const handle = window.h;

const root = path.join(__dirname, "..", "..", "..");
const library = path.join(root, "public", "fonts", "library");
const ALLOWED = new Set([
  "OFL-1.1",
  "Apache-2.0",
  "MIT",
  "Ubuntu",
  "CC0-1.0",
  "UFL-1.0",
]);

/** the app's static files, read from the repo instead of a server */
const stubFetch = () => {
  vi.stubGlobal("fetch", async (url: string | URL) => {
    const href = String(url);
    const marker = "/fonts/library/";
    const at = href.indexOf(marker);
    if (at < 0) {
      throw new Error(`unexpected fetch ${href}`);
    }
    const file = path.join(library, href.slice(at + marker.length));
    if (!fs.existsSync(file)) {
      return { ok: false, status: 404 } as any;
    }
    const bytes = fs.readFileSync(file);
    return {
      ok: true,
      json: async () => JSON.parse(bytes.toString("utf8")),
      arrayBuffer: async () =>
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
    } as any;
  });
};

beforeEach(() => {
  setFontCatalogue(null);
  stubFetch();
});
afterEach(() => {
  vi.unstubAllGlobals();
  setFontCatalogue(null);
});

describe("the font library", () => {
  it("lists families that are all open licences, each with its files and licence text", async () => {
    const fonts = await loadFontCatalogue();
    expect(fonts.length).toBeGreaterThanOrEqual(60);
    for (const font of fonts) {
      expect(ALLOWED.has(font.license)).toBe(true);
      expect(font.styles.length).toBeGreaterThan(0);
      for (const style of font.styles) {
        expect(fs.existsSync(path.join(library, style.file))).toBe(true);
      }
      expect(fs.existsSync(path.join(library, font.id, "LICENSE"))).toBe(true);
    }
    // the table of licences is generated with the files
    const table = fs.readFileSync(path.join(library, "LICENSES.md"), "utf8");
    expect(table).toContain("| Inter | OFL-1.1 |");
    expect(
      new Set(fonts.map((font) => font.category)).size,
    ).toBeGreaterThanOrEqual(4);
  });

  it("picks the face closest to the weight and style asked for", async () => {
    await loadFontCatalogue();
    const inter = findLibraryFont("Inter")!;
    expect(pickLibraryStyle(inter, 700, false)).toMatchObject({
      weight: 700,
      style: "normal",
    });
    expect(pickLibraryStyle(inter, 700, true)).toMatchObject({
      weight: 700,
      style: "italic",
    });
    expect(pickLibraryStyle(inter, 600, false).weight).toBe(700);
    expect(hasExactStyle(inter, 400, true)).toBe(true);
    // a family with no italic falls back to its upright face
    const bebas = findLibraryFont("Bebas Neue")!;
    expect(hasExactStyle(bebas, 400, true)).toBe(false);
    expect(pickLibraryStyle(bebas, 400, true).style).toBe("normal");
    expect(libraryFileUrl("inter/x.woff2")).toContain(
      "/fonts/library/inter/x.woff2",
    );
  });

  it("outlines come from the real bold face, not a faked one", async () => {
    const make = (fontWeight?: number) =>
      ({
        ...API.createElement({
          type: "text",
          x: 0,
          y: 0,
          text: "Hamburg",
          fontSize: 60,
        } as any),
        fontFamilyName: "Inter",
        ...(fontWeight ? { fontWeight } : {}),
      } as any);
    const width = async (el: any) => {
      const out = (await textToPaths(el))!;
      const xs = out.elements.flatMap((element) => [
        element.x,
        element.x + element.width,
      ]);
      return {
        w: Math.max(...xs) - Math.min(...xs),
        strokes: out.elements.some(
          (element) =>
            element.strokeWidth > 0.6 && element.strokeColor !== "transparent",
        ),
      };
    };
    const regular = await width(make());
    const bold = await width(make(700));
    expect(regular.w).toBeGreaterThan(100);
    // the bold face is wider, and no outline was added to fake it
    expect(bold.w).toBeGreaterThan(regular.w + 2);
    expect(bold.strokes).toBe(false);
  });

  it("the action sets the family, loads its face and measures with it", async () => {
    await render(<Excalidraw />);
    const text = API.createElement({
      type: "text",
      x: 0,
      y: 0,
      text: "Hello",
      fontSize: 24,
    } as any);
    API.setElements([text]);
    API.setSelectedElements([text]);
    await act(async () => {
      await (handle.app.actionManager.executeAction(
        actionChangeLibraryFont,
        "ui",
        "Lora",
      ) as any);
    });
    await vi.waitFor(() =>
      expect(
        (handle.elements.find((element) => element.id === text.id) as any)
          .fontFamilyName,
      ).toBe("Lora"),
    );
    expect(
      (document.fonts.add as any).mock.calls.some(
        ([font]: any[]) => font.family === "Lora",
      ),
    ).toBe(true);
  });
});
