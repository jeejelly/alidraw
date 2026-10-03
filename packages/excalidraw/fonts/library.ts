import { isTextElement } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

/**
 * The font library: open-licence families shipped as woff2 files beside the
 * app (public/fonts/library, see scripts/fonts/add-fonts.mjs), listed in a
 * manifest with their licence. A text uses one by name (`fontFamilyName`), the
 * face is picked by weight and style, and the file loads when first needed.
 */
export type LibraryFontStyle = {
  weight: number;
  style: "normal" | "italic";
  subset: string;
  file: string;
};

export type LibraryFont = {
  id: string;
  family: string;
  category: string;
  license: string;
  licenseUrl: string | null;
  attribution: string | null;
  source: string;
  version: string;
  styles: LibraryFontStyle[];
};

const baseUrl = () => {
  const path = (window as any).EXCALIDRAW_ASSET_PATH;
  const first = Array.isArray(path) ? path[0] : path;
  const base =
    typeof first === "string" && first ? first : window.location.origin;
  return base.endsWith("/") ? base : `${base}/`;
};

export const libraryFileUrl = (file: string) =>
  new URL(`fonts/library/${file}`, baseUrl()).toString();

let catalogue: Promise<LibraryFont[]> | null = null;
let loaded: LibraryFont[] = [];

/** the families of the library (empty when the app has none, or it cannot be read) */
export const loadFontCatalogue = (): Promise<LibraryFont[]> => {
  if (!catalogue) {
    catalogue = (async () => {
      try {
        if (typeof fetch !== "function") {
          return [];
        }
        const res = await fetch(libraryFileUrl("manifest.json"));
        if (!res.ok) {
          return [];
        }
        const body = await res.json();
        loaded = Array.isArray(body.fonts) ? body.fonts : [];
        return loaded;
      } catch {
        return [];
      }
    })();
  }
  return catalogue;
};

/** for tests and hosts that bring their own list */
export const setFontCatalogue = (fonts: LibraryFont[] | null) => {
  loaded = fonts ?? [];
  catalogue = fonts ? Promise.resolve(loaded) : null;
};

/** what is known now, without loading anything */
export const getLoadedCatalogue = () => loaded;

export const findLibraryFont = (family: string | null | undefined) =>
  family ? loaded.find((font) => font.family === family) ?? null : null;

/** the face of a family closest to the weight and style asked for */
export const pickLibraryStyle = (
  font: LibraryFont,
  weight = 400,
  italic = false,
): LibraryFontStyle => {
  const wanted = italic ? "italic" : "normal";
  const sameStyle = font.styles.filter(
    (fontStyle) => fontStyle.style === wanted,
  );
  const pool = sameStyle.length ? sameStyle : font.styles;
  return [...pool].sort(
    (first, second) =>
      Math.abs(first.weight - weight) - Math.abs(second.weight - weight),
  )[0];
};

/** the family has a face of exactly this weight and style (otherwise the browser fakes it) */
export const hasExactStyle = (
  font: LibraryFont,
  weight: number,
  italic: boolean,
) =>
  font.styles.some(
    (fontStyle) =>
      fontStyle.weight === weight &&
      fontStyle.style === (italic ? "italic" : "normal"),
  );

const faces = new Map<string, Promise<FontFace | null>>();

/** loads one face of a family into the document (once) */
export const loadLibraryFace = (
  font: LibraryFont,
  style: LibraryFontStyle,
  ownerDocument: Document = document,
): Promise<FontFace | null> => {
  const key = style.file;
  let face = faces.get(key);
  if (!face) {
    face = (async () => {
      try {
        const fontFace = new FontFace(
          font.family,
          `url(${libraryFileUrl(style.file)})`,
          {
            weight: String(style.weight),
            style: style.style,
            display: "swap",
          },
        );
        ownerDocument.fonts.add(fontFace);
        await fontFace.load();
        return fontFace;
      } catch {
        return null;
      }
    })();
    faces.set(key, face);
  }
  return face;
};

/** the library faces the texts among `elements` need, loaded */
export const loadLibraryFontsFor = async (
  elements: readonly ExcalidrawElement[],
  ownerDocument: Document = document,
): Promise<FontFace[]> => {
  const wanted = new Map<string, [LibraryFont, LibraryFontStyle]>();
  const names = new Set<string>();
  for (const el of elements) {
    if (isTextElement(el) && !el.isDeleted && el.fontFamilyName) {
      names.add(el.fontFamilyName);
    }
  }
  if (!names.size) {
    return [];
  }
  await loadFontCatalogue();
  for (const el of elements) {
    if (!isTextElement(el) || el.isDeleted) {
      continue;
    }
    const font = findLibraryFont(el.fontFamilyName);
    if (font) {
      const style = pickLibraryStyle(
        font,
        el.fontWeight ?? 400,
        el.fontStyle === "italic",
      );
      wanted.set(style.file, [font, style]);
    }
  }
  const made = await Promise.all(
    [...wanted.values()].map(([font, style]) =>
      loadLibraryFace(font, style, ownerDocument),
    ),
  );
  return made.filter((face): face is FontFace => !!face);
};

/** `@font-face` rules (subsetted to the characters used, inlined) for exporting texts set in library fonts */
export const libraryFontFaceCSS = async (
  elements: readonly ExcalidrawElement[],
): Promise<string[]> => {
  const used = new Map<
    string,
    { font: LibraryFont; style: LibraryFontStyle; chars: Set<number> }
  >();
  const named = elements.some(
    (element) => isTextElement(element) && element.fontFamilyName,
  );
  if (!named) {
    return [];
  }
  await loadFontCatalogue();
  for (const el of elements) {
    if (!isTextElement(el) || el.isDeleted) {
      continue;
    }
    const font = findLibraryFont(el.fontFamilyName);
    if (!font) {
      continue;
    }
    const style = pickLibraryStyle(
      font,
      el.fontWeight ?? 400,
      el.fontStyle === "italic",
    );
    const entry = used.get(style.file) ?? {
      font,
      style,
      chars: new Set<number>(),
    };
    for (const ch of Array.from(el.text)) {
      entry.chars.add(ch.codePointAt(0)!);
    }
    used.set(style.file, entry);
  }
  const { subsetWoff2GlyphsByCodepoints } = await import(
    "../subset/subset-main"
  );
  const out: string[] = [];
  for (const { font, style, chars } of used.values()) {
    try {
      const buffer = await (
        await fetch(libraryFileUrl(style.file))
      ).arrayBuffer();
      const src = await subsetWoff2GlyphsByCodepoints(buffer, [...chars]);
      out.push(
        `@font-face { font-family: "${font.family}"; font-weight: ${style.weight}; font-style: ${style.style}; src: url(${src}); }`,
      );
    } catch {
      // the export still works, with whatever the viewer has
    }
  }
  return out;
};
