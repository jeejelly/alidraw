import { Fonts } from "../fonts";
import {
  findLibraryFont,
  libraryFileUrl,
  loadFontCatalogue,
  pickLibraryStyle,
} from "../fonts/library";

import type * as OpenType from "opentype.js";

/** Glyph outlines from the font files the app already ships. */
export type GlyphFont = OpenType.Font;

export type FontLoader = (
  fontFamily: number,
  codePoint: number,
  /** the library font and face asked for, when the text is set in one */
  face?: { name: string | null | undefined; weight: number; italic: boolean },
) => Promise<GlyphFont | null>;

const parsed = new Map<string, Promise<GlyphFont | null>>();

/** the font file slice that has the character, as an outline font */
const parseFile = (key: string, fetchBytes: () => Promise<ArrayBuffer>) => {
  let font = parsed.get(key);
  if (!font) {
    font = (async () => {
      try {
        const [{ woff2ToSfnt }, opentype] = await Promise.all([
          import("../subset/subset-main"),
          import("opentype.js"),
        ]);
        // decoded in the subsetting worker (a page's policy may not allow the decoder)
        return opentype.parse(await woff2ToSfnt(await fetchBytes()));
      } catch {
        return null;
      }
    })();
    parsed.set(key, font);
  }
  return font;
};

export const defaultFontLoader: FontLoader = async (
  fontFamily,
  codePoint,
  wanted,
) => {
  // a library font: the face of the right weight and style, when it has the character
  if (wanted?.name) {
    await loadFontCatalogue();
    const lib = findLibraryFont(wanted.name);
    if (lib) {
      const style = pickLibraryStyle(lib, wanted.weight, wanted.italic);
      const url = libraryFileUrl(style.file);
      const font = await parseFile(url, async () =>
        (await fetch(url)).arrayBuffer(),
      );
      if (
        font &&
        (font as any).charToGlyph(String.fromCodePoint(codePoint)).index > 0
      ) {
        return font;
      }
    }
  }
  const face = Fonts.registered
    .get(fontFamily)
    ?.fontFaces.find((fontFace) => fontFace.covers(codePoint));
  const url = face?.urls[0];
  if (!face || !url) {
    return null;
  }
  return parseFile(String(url), () => face.fetchFont(url));
};

let fontLoader: FontLoader = defaultFontLoader;

/** where glyph outlines come from (the shipped fonts unless a host or a test says otherwise) */
export const setOutlineFontLoader = (loader: FontLoader | null) => {
  fontLoader = loader ?? defaultFontLoader;
};

export const getOutlineFontLoader = () => fontLoader;
