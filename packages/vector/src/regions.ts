import {
  simplifyClosed,
  smoothClosedPath,
  subpathPoints,
  type Pt,
} from "./smoothOutline";

/**
 * The colour areas a tracer found, as plain geometry: an outline with holes,
 * a colour, and what the outline is (a rectangle, a rounded one, an ellipse
 * or a free shape). Rectangles and ellipses are what interfaces are made of,
 * so they are kept as such instead of being fitted with curves.
 */
export type RegionKind = "rect" | "ellipse" | "path";

export type TraceRegion = {
  fill: string;
  kind: RegionKind;
  /** the outline in bitmap pixels, then its holes */
  polys: Pt[][];
  bounds: { x: number; y: number; width: number; height: number };
  /** rounded rectangles: the corner radius, in pixels */
  radius: number;
};

const areaOf = (pts: Pt[]) => {
  let sum = 0;
  for (let index = 0; index < pts.length; index++) {
    const next = pts[(index + 1) % pts.length];
    sum += pts[index][0] * next[1] - next[0] * pts[index][1];
  }
  return Math.abs(sum / 2);
};

const boundsOf = (pts: Pt[]) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

/** a rounded rectangle's radius from the area its corners cut off, checked against the outline */
const cornerRadius = (outline: Pt[], box: TraceRegion["bounds"]) => {
  const missing = box.width * box.height - areaOf(outline);
  const radius = Math.sqrt(Math.max(0, missing) / (4 - Math.PI));
  const limit = Math.min(box.width, box.height) / 2;
  if (radius < 1.5 || radius > limit + 1) {
    return 0;
  }
  const corners: Pt[] = [
    [box.x, box.y],
    [box.x + box.width, box.y],
    [box.x + box.width, box.y + box.height],
    [box.x, box.y + box.height],
  ];
  // the outline passes a corner at r (sqrt 2 - 1) from it
  const expected = radius * (Math.SQRT2 - 1);
  for (const corner of corners) {
    let nearest = Infinity;
    for (const point of outline) {
      nearest = Math.min(
        nearest,
        Math.hypot(point[0] - corner[0], point[1] - corner[1]),
      );
    }
    if (Math.abs(nearest - expected) > Math.max(1.5, expected * 0.45)) {
      return 0;
    }
  }
  return Math.min(radius, limit);
};

const isEllipse = (outline: Pt[], box: TraceRegion["bounds"]) => {
  const ratio = areaOf(outline) / ((Math.PI / 4) * box.width * box.height);
  if (ratio < 0.92 || ratio > 1.08) {
    return false;
  }
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const rx = box.width / 2;
  const ry = box.height / 2;
  let fit = 0;
  for (const [x, y] of outline) {
    const value = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
    if (value > 0.8 && value < 1.2) {
      fit++;
    }
  }
  return fit / outline.length > 0.9;
};

/** what a traced outline is */
export const classifyOutline = (
  outline: Pt[],
): Pick<TraceRegion, "kind" | "bounds" | "radius"> => {
  const bounds = boundsOf(outline);
  const boxArea = bounds.width * bounds.height;
  const free = { kind: "path" as const, bounds, radius: 0 };
  if (bounds.width < 3 || bounds.height < 3 || boxArea <= 0) {
    return free;
  }
  const fill = areaOf(outline) / boxArea;
  if (fill >= 0.985 && simplifyClosed(outline, 1.5).length <= 5) {
    return { kind: "rect", bounds, radius: 0 };
  }
  if (isEllipse(outline, bounds)) {
    return { kind: "ellipse", bounds, radius: 0 };
  }
  if (fill > 0.8) {
    const radius = cornerRadius(outline, bounds);
    if (radius) {
      return { kind: "rect", bounds, radius };
    }
  }
  return free;
};

export type RegionOptions = {
  smoothing: number;
  /** turning angle (degrees) above which an outline keeps its corner */
  corner: number;
  /** keep rectangles and ellipses as such */
  shapes: boolean;
};

const r2 = (value: number) => Math.round(value * 100) / 100;

/**
 * The tracer's SVG as regions, and the SVG the importer reads: the biggest areas first
 * (a container's holes are filled under what sits in them, so the picture is the same),
 * rectangles and ellipses as such, everything else as smooth curves.
 * Element `index` of the import is region `index`.
 */
export const regionsToSvg = (
  rawSvg: string,
  options: RegionOptions,
): { regions: TraceRegion[]; body: string } => {
  const found: (TraceRegion & { area: number })[] = [];
  for (const [tag] of rawSvg.matchAll(/<path\b[^>]*>/g)) {
    if (/fill-opacity="0(\.0*)?"/.test(tag)) {
      continue;
    }
    const fill = /\bfill="([^"]*)"/.exec(tag)?.[1];
    const pathData = /\bd="([^"]*)"/.exec(tag)?.[1];
    if (!fill || !pathData) {
      continue;
    }
    const polys = subpathPoints(pathData)
      .filter((pts) => pts.length >= 3)
      .sort((first, second) => areaOf(second) - areaOf(first));
    if (!polys.length) {
      continue;
    }
    const outline = options.shapes
      ? classifyOutline(polys[0])
      : { kind: "path" as const, bounds: boundsOf(polys[0]), radius: 0 };
    found.push({
      fill,
      polys,
      ...outline,
      area: areaOf(polys[0]),
    });
  }
  found.sort((first, second) => second.area - first.area);
  const smooth = Math.min(1, Math.max(0, options.smoothing));
  const body = found
    .map((region) => {
      const { x, y, width, height } = region.bounds;
      if (region.kind === "rect") {
        return `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(
          width,
        )}" height="${r2(height)}" rx="${r2(region.radius)}" fill="${
          region.fill
        }"/>`;
      }
      if (region.kind === "ellipse") {
        return `<ellipse cx="${r2(x + width / 2)}" cy="${r2(
          y + height / 2,
        )}" rx="${r2(width / 2)}" ry="${r2(height / 2)}" fill="${
          region.fill
        }"/>`;
      }
      const curved = region.polys
        .map((pts) => smoothClosedPath(pts, smooth, options.corner))
        .join("");
      // neighbouring areas are smoothed apart: a hairline of their own colour closes the seams
      return `<path d="${curved}" fill="${region.fill}" stroke="${region.fill}" stroke-width="0.7" stroke-linejoin="round"/>`;
    })
    .join("");
  return {
    regions: found.map(({ area: _area, ...region }) => region),
    body,
  };
};
