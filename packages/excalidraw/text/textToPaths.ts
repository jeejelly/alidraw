import { randomId } from "@excalidraw/common";
import { getLineHeightInPx } from "@excalidraw/element";

import { getVerticalOffset } from "@excalidraw/common";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { Fonts } from "../fonts";
import { importSvg } from "../svgImport";

import type * as OpenType from "opentype.js";

/**
 * Text as vector shapes ("create outlines"): each glyph becomes a path element
 * (holes kept), laid out like the text was on the canvas (line height, alignment).
 * The glyph outlines come from the font files the app already ships.
 */
export type GlyphFont = OpenType.Font;

export type FontLoader = (
  fontFamily: number,
  codePoint: number,
) => Promise<GlyphFont | null>;

const parsed = new Map<string, Promise<GlyphFont | null>>();

/** the font file slice that has the character, as an outline font */
export const defaultFontLoader: FontLoader = async (fontFamily, codePoint) => {
  const face = Fonts.registered
    .get(fontFamily)
    ?.fontFaces.find((f) => f.covers(codePoint));
  const url = face?.urls[0];
  if (!face || !url) {
    return null;
  }
  const key = String(url);
  let font = parsed.get(key);
  if (!font) {
    font = (async () => {
      try {
        const [{ default: loadWoff2 }, opentype] = await Promise.all([
          import("../subset/woff2/woff2-loader"),
          import("opentype.js"),
        ]);
        const { decompress } = await loadWoff2();
        const ttf = decompress(await face.fetchFont(url)).buffer as ArrayBuffer;
        return opentype.parse(ttf);
      } catch {
        return null;
      }
    })();
    parsed.set(key, font);
  }
  return font;
};

const num = (n: number) => Math.round(n * 100) / 100;

/**
 * Glyph by glyph with pair kerning: the font's own substitutions (ligatures,
 * contextual forms) are not applied, so scripts that need them (Arabic,
 * Devanagari…) are not shaped.
 */
const layoutRun = (font: GlyphFont, text: string, fontSize: number) => {
  const scale = fontSize / font.unitsPerEm;
  const glyphs: { glyph: ReturnType<GlyphFont["charToGlyph"]>; x: number }[] =
    [];
  let x = 0;
  let previous: ReturnType<GlyphFont["charToGlyph"]> | null = null;
  for (const ch of Array.from(text)) {
    const glyph = font.charToGlyph(ch);
    if (previous) {
      x += (font.getKerningValue(previous, glyph) || 0) * scale;
    }
    glyphs.push({ glyph, x });
    x += glyph.advanceWidth * scale;
    previous = glyph;
  }
  return { glyphs, width: x };
};

export type OutlinedText = {
  /** path elements, in one group, where the text was */
  elements: ExcalidrawElement[];
  /** characters no font of the family could draw (emoji, missing scripts) */
  missing: string[];
};

/** @returns null when no glyph could be drawn at all */
let fontLoader: FontLoader = defaultFontLoader;

/** where glyph outlines come from (the shipped fonts unless a host or a test says otherwise) */
export const setOutlineFontLoader = (loader: FontLoader | null) => {
  fontLoader = loader ?? defaultFontLoader;
};

export const textToPaths = async (
  el: ExcalidrawTextElement,
  load: FontLoader = fontLoader,
): Promise<OutlinedText | null> => {
  const lines = el.text.replace(/\r\n?/g, "\n").split("\n");
  const lineHeightPx = getLineHeightInPx(el.fontSize, el.lineHeight);
  const offset = getVerticalOffset(el.fontFamily, el.fontSize, lineHeightPx);
  const missing = new Set<string>();
  const shapes: string[] = [];
  const fill = el.strokeColor === "transparent" ? "#000000" : el.strokeColor;

  for (let i = 0; i < lines.length; i++) {
    // runs of characters that share a font file, so kerning and ligatures survive
    const runs: { font: GlyphFont | null; text: string }[] = [];
    for (const ch of Array.from(lines[i])) {
      const font = await load(el.fontFamily, ch.codePointAt(0)!);
      const last = runs[runs.length - 1];
      if (last && last.font === font) {
        last.text += ch;
      } else {
        runs.push({ font, text: ch });
      }
      if (!font && ch.trim()) {
        missing.add(ch);
      }
    }
    const laid = runs.map((r) =>
      r.font ? layoutRun(r.font, r.text, el.fontSize) : null,
    );
    const widths = runs.map(
      (r, k) => laid[k]?.width ?? r.text.length * el.fontSize * 0.5,
    );
    const lineWidth = widths.reduce((a, b) => a + b, 0);
    let x =
      el.textAlign === "center"
        ? (el.width - lineWidth) / 2
        : el.textAlign === "right"
        ? el.width - lineWidth
        : 0;
    const y = i * lineHeightPx + offset;
    runs.forEach((r, k) => {
      for (const { glyph, x: gx } of laid[k]?.glyphs ?? []) {
        // glyph outlines are closed shapes, whether or not the font says so
        const raw = glyph.getPath(x + gx, y, el.fontSize).toPathData(2);
        const d = raw
          ? `${raw.replace(/Z/g, "").replace(/M/g, "ZM").replace(/^Z/, "")}Z`
          : "";
        if (d) {
          shapes.push(`<path d="${d}" fill="${fill}"/>`);
        }
      }
      x += widths[k];
    });
  }
  if (!shapes.length) {
    return null;
  }
  const deg = (el.angle * 180) / Math.PI;
  const turn = el.angle
    ? ` transform="rotate(${num(deg)} ${num(el.width / 2)} ${num(
        el.height / 2,
      )})"`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${num(
    el.width,
  )}" height="${num(el.height)}" viewBox="0 0 ${num(el.width)} ${num(
    el.height,
  )}"><g${turn}>${shapes.join("")}</g></svg>`;
  const { elements } = importSvg(svg, { x: el.x, y: el.y }, 1e7);
  // one group per text, inside whatever group and frame the text was in
  const group = randomId();
  return {
    elements: elements.map((e) => ({
      ...e,
      groupIds: [group, ...el.groupIds],
      frameId: el.frameId,
      opacity: el.opacity,
    })) as ExcalidrawElement[],
    missing: [...missing],
  };
};
