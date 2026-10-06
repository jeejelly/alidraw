import { randomId } from "@excalidraw/common";

import { buildPalette } from "@excalidraw/color";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { importSvg } from "./svgImport";

import { recognizeLines, type Ocr } from "./ocr";
import { regionsToSvg, type TraceRegion } from "./regions";
import { takeOutText, textElements, usableLines } from "./textBlocks";

/**
 * Bitmap to vector: the colours are reduced to a palette, each colour's area
 * is outlined and the outlines are fitted with smooth curves (ImageTracer,
 * public domain). The result is ordinary path elements, one group. For screen
 * captures ("ui") rectangles and ellipses stay shapes, the text is recognised and
 * becomes text blocks, and corners stay sharp.
 */
export type TraceOptions = {
  /** palette size, 2 to 64 */
  colors: number;
  /** 0 keeps every detail, 1 rounds everything off (fewer points, smoother curves) */
  smoothing: number;
  /** areas smaller than this many points are dropped as noise */
  speckle: number;
  /** turning angle (degrees) above which an outline keeps its corner */
  corner: number;
  /** rectangles, rounded rectangles and ellipses stay shapes, not curve fits */
  shapes: boolean;
  /** recognise text, paint it out of the picture and make text elements */
  text: boolean;
  /** the text recogniser (Tesseract by default) */
  ocr?: Ocr;
};

export const DEFAULT_TRACE: TraceOptions = {
  colors: 12,
  smoothing: 0.4,
  speckle: 8,
  corner: 75,
  shapes: false,
  text: false,
};

/** starting points: flat artwork and photos, or a screen capture */
export const TRACE_PRESETS: { art: TraceOptions; ui: TraceOptions } = {
  art: DEFAULT_TRACE,
  ui: {
    colors: 32,
    smoothing: 0.1,
    speckle: 2,
    corner: 50,
    shapes: true,
    text: true,
  },
};

export type PixelData = {
  width: number;
  height: number;
  data: Uint8ClampedArray | number[];
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const traceRaw = async (image: PixelData, settings: TraceOptions) => {
  const { default: ImageTracer } = await import("imagetracerjs");
  const smooth = clamp(settings.smoothing, 0, 1);
  const colors = Math.round(clamp(settings.colors, 2, 64));
  return ImageTracer.imagedataToSVG(image as ImageData, {
    numberofcolors: colors,
    // the picture's own palette (median cut): deterministic, small details keep their colour
    pal: buildPalette(image.data, colors),
    colorsampling: 0,
    colorquantcycles: 1,
    mincolorratio: 0,
    // the tracer only finds the outlines here (fine fit); the smoothing is ours
    ltres: 0.1,
    qtres: 0.1,
    pathomit: Math.max(0, Math.round(settings.speckle)),
    blurradius: smooth > 0.5 ? Math.round(smooth * 3) : 0,
    blurdelta: 20,
    roundcoords: 2,
    strokewidth: 0,
    scale: 1,
    viewbox: false,
    desc: false,
    linefilter: false,
    rightangleenhance: false,
  });
};

const traceBody = async (image: PixelData, settings: TraceOptions) =>
  regionsToSvg(await traceRaw(image, settings), {
    smoothing: settings.smoothing,
    corner: settings.corner,
    shapes: settings.shapes,
  });

/** the SVG text of a traced bitmap, in the bitmap's pixels */
export const traceToSvg = async (
  image: PixelData,
  options: Partial<TraceOptions> = {},
) => {
  const { body } = await traceBody(image, { ...DEFAULT_TRACE, ...options });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${image.width}" height="${image.height}" viewBox="0 0 ${image.width} ${image.height}">${body}</svg>`;
};

type Target = { x: number; y: number; width: number; height: number };

export type TraceResult = {
  /** the shapes, then the text blocks */
  elements: ExcalidrawElement[];
  /** the colour areas, element for element with the first `regions.length` elements */
  regions: TraceRegion[];
  textBlocks: number;
  /** why something asked for was left out */
  warning?: string;
};

/** the picture as shapes (and text blocks) filling `target`, one group */
export const traceImage = async (
  image: PixelData,
  target: Target,
  options: Partial<TraceOptions> = {},
): Promise<TraceResult> => {
  const settings = { ...DEFAULT_TRACE, ...options };
  const group = randomId();
  let source = image;
  let found: ReturnType<typeof takeOutText>["lines"] = [];
  let warning: string | undefined;
  if (settings.text) {
    try {
      const lines = usableLines(await (settings.ocr ?? recognizeLines)(image));
      ({ image: source, lines: found } = takeOutText(image, lines));
    } catch (error: any) {
      warning = `Text was not recognised: ${error?.message ?? error}`;
    }
  }
  const { regions, body } = await traceBody(source, settings);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${target.width}" height="${target.height}" viewBox="0 0 ${image.width} ${image.height}">${body}</svg>`;
  const shapes = importSvg(svg, { x: target.x, y: target.y }, 1e7).elements.map(
    (element) => ({ ...element, groupIds: [group] }),
  ) as ExcalidrawElement[];
  const texts = textElements(
    found,
    {
      x: target.x,
      y: target.y,
      scaleX: target.width / image.width,
      scaleY: target.height / image.height,
    },
    group,
  );
  return {
    elements: [...shapes, ...texts],
    // the importer makes one element per area; if it ever does not, nothing can be matched up
    regions: shapes.length === regions.length ? regions : [],
    textBlocks: texts.length,
    warning,
  };
};

/** @returns path elements filling `target`, a group, in the colours of the bitmap */
export const traceToElements = async (
  image: PixelData,
  target: Target,
  options: Partial<TraceOptions> = {},
): Promise<ExcalidrawElement[]> =>
  (await traceImage(image, target, options)).elements;
