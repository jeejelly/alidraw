import { getVerticalOffset, randomId } from "@excalidraw/common";
import { getLineHeightInPx } from "@excalidraw/element";
import { importSvg } from "@excalidraw/vector";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { findLibraryFont, pickLibraryStyle } from "../fonts/library";

import { getOutlineFontLoader } from "./glyphFonts";

import type { FontLoader, GlyphFont } from "./glyphFonts";

export {
  defaultFontLoader,
  setOutlineFontLoader,
  type FontLoader,
  type GlyphFont,
} from "./glyphFonts";

/**
 * Text as vector shapes ("create outlines"): each glyph becomes a path element
 * (holes kept), laid out like the text was on the canvas (line height, alignment).
 */
const num = (value: number) => Math.round(value * 100) / 100;

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
  for (const char of Array.from(text)) {
    const glyph = font.charToGlyph(char);
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

type Run = { font: GlyphFont | null; text: string };

/** runs of characters that share a font file, so kerning and ligatures survive */
const splitRuns = async (
  line: string,
  textElement: ExcalidrawTextElement,
  load: FontLoader,
  missing: Set<string>,
) => {
  const runs: Run[] = [];
  for (const char of Array.from(line)) {
    const font = await load(textElement.fontFamily, char.codePointAt(0)!, {
      name: textElement.fontFamilyName,
      weight: textElement.fontWeight ?? 400,
      italic: textElement.fontStyle === "italic",
    });
    const last = runs[runs.length - 1];
    if (last && last.font === font) {
      last.text += char;
    } else {
      runs.push({ font, text: char });
    }
    if (!font && char.trim()) {
      missing.add(char);
    }
  }
  return runs;
};

/**
 * A family without a bold or italic face: the weight is faked with an outline
 * of the same colour, the slant with a shear (what browsers do too).
 */
const fauxStyle = (textElement: ExcalidrawTextElement, fill: string) => {
  const libraryFont = findLibraryFont(textElement.fontFamilyName);
  const picked = libraryFont
    ? pickLibraryStyle(
        libraryFont,
        textElement.fontWeight ?? 400,
        textElement.fontStyle === "italic",
      )
    : null;
  const bold =
    (textElement.fontWeight ?? 400) >= 600 && (picked?.weight ?? 400) < 600;
  return {
    italic: textElement.fontStyle === "italic" && picked?.style !== "italic",
    heavy: bold
      ? ` stroke="${fill}" stroke-width="${num(
          textElement.fontSize * 0.04,
        )}" stroke-linejoin="round"`
      : "",
  };
};

/** the `<path>`s of one line, runs side by side, aligned like the text was */
const lineShapesOf = (
  runs: Run[],
  textElement: ExcalidrawTextElement,
  y: number,
  fill: string,
  heavy: string,
) => {
  const laid = runs.map((run) =>
    run.font ? layoutRun(run.font, run.text, textElement.fontSize) : null,
  );
  const widths = runs.map(
    (run, runIndex) =>
      laid[runIndex]?.width ?? run.text.length * textElement.fontSize * 0.5,
  );
  const lineWidth = widths.reduce((sum, width) => sum + width, 0);
  let x =
    textElement.textAlign === "center"
      ? (textElement.width - lineWidth) / 2
      : textElement.textAlign === "right"
      ? textElement.width - lineWidth
      : 0;
  const shapes: string[] = [];
  runs.forEach((_run, runIndex) => {
    for (const { glyph, x: glyphX } of laid[runIndex]?.glyphs ?? []) {
      // glyph outlines are closed shapes, whether or not the font says so
      const raw = glyph
        .getPath(x + glyphX, y, textElement.fontSize)
        .toPathData(2);
      const pathData = raw
        ? `${raw.replace(/Z/g, "").replace(/M/g, "ZM").replace(/^Z/, "")}Z`
        : "";
      if (pathData) {
        shapes.push(`<path d="${pathData}" fill="${fill}"${heavy}/>`);
      }
    }
    x += widths[runIndex];
  });
  return shapes;
};

/** the shapes in an SVG the size of the text, turned like the text was */
const outlinesSvg = (textElement: ExcalidrawTextElement, shapes: string[]) => {
  const degrees = (textElement.angle * 180) / Math.PI;
  const turn = textElement.angle
    ? ` transform="rotate(${num(degrees)} ${num(textElement.width / 2)} ${num(
        textElement.height / 2,
      )})"`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${num(
    textElement.width,
  )}" height="${num(textElement.height)}" viewBox="0 0 ${num(
    textElement.width,
  )} ${num(textElement.height)}"><g${turn}>${shapes.join("")}</g></svg>`;
};

/** @returns null when no glyph could be drawn at all */
export const textToPaths = async (
  textElement: ExcalidrawTextElement,
  load: FontLoader = getOutlineFontLoader(),
): Promise<OutlinedText | null> => {
  const lines = textElement.text.replace(/\r\n?/g, "\n").split("\n");
  const lineHeightPx = getLineHeightInPx(
    textElement.fontSize,
    textElement.lineHeight,
  );
  const offset = getVerticalOffset(
    textElement.fontFamily,
    textElement.fontSize,
    lineHeightPx,
  );
  const missing = new Set<string>();
  const shapes: string[] = [];
  const fill =
    textElement.strokeColor === "transparent"
      ? "#000000"
      : textElement.strokeColor;
  const { heavy, italic } = fauxStyle(textElement, fill);

  for (let index = 0; index < lines.length; index++) {
    const runs = await splitRuns(lines[index], textElement, load, missing);
    const y = index * lineHeightPx + offset;
    const lineShapes = lineShapesOf(runs, textElement, y, fill, heavy);
    if (lineShapes.length) {
      shapes.push(
        italic
          ? `<g transform="translate(0 ${num(y)}) skewX(-12) translate(0 ${num(
              -y,
            )})">${lineShapes.join("")}</g>`
          : lineShapes.join(""),
      );
    }
  }
  if (!shapes.length) {
    return null;
  }
  const { elements } = importSvg(
    outlinesSvg(textElement, shapes),
    { x: textElement.x, y: textElement.y },
    1e7,
  );
  // one group per text, inside whatever group and frame the text was in
  const group = randomId();
  return {
    elements: elements.map((element) => ({
      ...element,
      groupIds: [group, ...textElement.groupIds],
      frameId: textElement.frameId,
      opacity: textElement.opacity,
    })) as ExcalidrawElement[],
    missing: [...missing],
  };
};
