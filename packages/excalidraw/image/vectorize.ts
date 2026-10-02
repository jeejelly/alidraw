import { randomId } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { importSvg } from "../svgImport";

import { buildPalette } from "./palette";
import { smoothClosedPath, subpathPoints } from "./smoothOutline";

/**
 * Bitmap to vector: the colours are reduced to a palette, each colour's area
 * is outlined and the outlines are fitted with smooth curves (ImageTracer,
 * public domain). The result is ordinary path elements, one group.
 */
export type TraceOptions = {
  /** palette size, 2 to 64 */
  colors: number;
  /** 0 keeps every detail, 1 rounds everything off (fewer points, smoother curves) */
  smoothing: number;
  /** areas smaller than this many points are dropped as noise */
  speckle: number;
};

export const DEFAULT_TRACE: TraceOptions = {
  colors: 12,
  smoothing: 0.4,
  speckle: 8,
};

export type PixelData = {
  width: number;
  height: number;
  data: Uint8ClampedArray | number[];
};

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

/** the SVG text of a traced bitmap, in the bitmap's pixels */
export const traceToSvg = async (
  image: PixelData,
  options: Partial<TraceOptions> = {},
) => {
  const o = { ...DEFAULT_TRACE, ...options };
  const { default: ImageTracer } = await import("imagetracerjs");
  const smooth = clamp(o.smoothing, 0, 1);
  const svg = ImageTracer.imagedataToSVG(image as ImageData, {
    numberofcolors: Math.round(clamp(o.colors, 2, 64)),
    // the picture's own palette (median cut): deterministic, small details keep their colour
    pal: buildPalette(image.data, Math.round(clamp(o.colors, 2, 64))),
    colorsampling: 0,
    colorquantcycles: 1,
    mincolorratio: 0,
    // the tracer only finds the outlines here (fine fit); the smoothing is ours
    ltres: 0.1,
    qtres: 0.1,
    pathomit: Math.max(0, Math.round(o.speckle)),
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
  // shapes are filled areas: no outline strokes; outlines become smooth curves
  return (
    svg
      .replace(/ stroke="[^"]*"/g, "")
      .replace(/ stroke-width="[^"]*"/g, "")
      .replace(/ d="([^"]*)"/g, (_m, d: string) => {
        const curved = subpathPoints(d)
          .map((pts) => smoothClosedPath(pts, smooth))
          .join("");
        return ` d="${curved}"`;
      })
      // neighbouring areas are smoothed apart: a hairline of their own colour closes the seams
      .replace(
        / fill="([^"]*)"/g,
        ' fill="$1" stroke="$1" stroke-width="0.7" stroke-linejoin="round"',
      )
  );
};

/** @returns path elements filling `target`, a group, in the colours of the bitmap */
export const traceToElements = async (
  image: PixelData,
  target: { x: number; y: number; width: number; height: number },
  options: Partial<TraceOptions> = {},
): Promise<ExcalidrawElement[]> => {
  const svg = (await traceToSvg(image, options)).replace(
    /<svg[^>]*>/,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${target.width}" height="${target.height}" viewBox="0 0 ${image.width} ${image.height}">`,
  );
  const group = randomId();
  return importSvg(svg, { x: target.x, y: target.y }, 1e7).elements.map(
    (e) => ({
      ...e,
      groupIds: [group],
    }),
  ) as ExcalidrawElement[];
};
