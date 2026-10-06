import { randomId } from "@excalidraw/common";

import { parsePath, type TraceRegion } from "@excalidraw/vector";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { pathElement } from "./build";
import { ICONS } from "./icons";

/**
 * Finds library icons in a traced picture: the outline of each small area (or of a few
 * neighbouring areas of one colour) is compared with every icon drawn as strokes, both
 * fitted to a small grid. The icon replaces the traced shapes, in the picture's colour.
 */
const GRID = 32;
const STROKES = [1.5, 2, 2.75];
/** an icon's ink may be this much off its grid cell neighbour, as a share of the grid */
const REACH = 1;

type Pt = [number, number];
type Mask = Uint8Array;

const cubicAt = (
  from: ReturnType<typeof parsePath>[number]["anchors"][number],
  to: ReturnType<typeof parsePath>[number]["anchors"][number],
  at: number,
): Pt => {
  const rest = 1 - at;
  const out1: Pt = [
    from.x + (from.out?.[0] ?? 0),
    from.y + (from.out?.[1] ?? 0),
  ];
  const in2: Pt = [to.x + (to.in?.[0] ?? 0), to.y + (to.in?.[1] ?? 0)];
  const mix = (start: number, c1: number, c2: number, end: number) =>
    rest ** 3 * start +
    3 * rest * rest * at * c1 +
    3 * rest * at * at * c2 +
    at ** 3 * end;
  return [
    mix(from.x, out1[0], in2[0], to.x),
    mix(from.y, out1[1], in2[1], to.y),
  ];
};

const flatten = (icon: string) => {
  const lines: [Pt, Pt][] = [];
  for (const sub of parsePath(icon)) {
    const count = sub.anchors.length;
    const last = sub.closed ? count : count - 1;
    for (let index = 0; index < last; index++) {
      const from = sub.anchors[index];
      const to = sub.anchors[(index + 1) % count];
      const steps = from.out || to.in ? 12 : 1;
      let prev: Pt = [from.x, from.y];
      for (let step = 1; step <= steps; step++) {
        const next: Pt =
          steps === 1 ? [to.x, to.y] : cubicAt(from, to, step / steps);
        lines.push([prev, next]);
        prev = next;
      }
    }
  }
  return lines;
};

const segmentDistance = (px: number, py: number, [start, end]: [Pt, Pt]) => {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const len2 = dx * dx + dy * dy;
  const along = len2
    ? Math.max(
        0,
        Math.min(1, ((px - start[0]) * dx + (py - start[1]) * dy) / len2),
      )
    : 0;
  return Math.hypot(px - (start[0] + along * dx), py - (start[1] + along * dy));
};

/** the box of ink (the icon's lines widened by half the stroke) */
type Ink = {
  x: number;
  y: number;
  size: number;
  width: number;
  height: number;
};

const inkOf = (lines: [Pt, Pt][], stroke: number): Ink => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const line of lines) {
    for (const [x, y] of line) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const half = stroke / 2;
  const width = maxX - minX + stroke;
  const height = maxY - minY + stroke;
  return {
    x: minX - half,
    y: minY - half,
    width,
    height,
    size: Math.max(width, height),
  };
};

/** a shape's coverage on the grid, the shape fitted by its longer side and centred */
const toGrid = (covers: (x: number, y: number) => boolean, ink: Ink): Mask => {
  const mask = new Uint8Array(GRID * GRID);
  const scale = GRID / ink.size;
  const offX = (GRID - ink.width * scale) / 2;
  const offY = (GRID - ink.height * scale) / 2;
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const x = ink.x + (gx + 0.5 - offX) / scale;
      const y = ink.y + (gy + 0.5 - offY) / scale;
      if (covers(x, y)) {
        mask[gy * GRID + gx] = 1;
      }
    }
  }
  return mask;
};

const dilate = (mask: Mask, reach: number): Mask => {
  const out = new Uint8Array(mask.length);
  const span = Math.ceil(reach);
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!mask[y * GRID + x]) {
        continue;
      }
      for (let dy = -span; dy <= span; dy++) {
        for (let dx = -span; dx <= span; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (
            nx >= 0 &&
            ny >= 0 &&
            nx < GRID &&
            ny < GRID &&
            Math.hypot(dx, dy) <= reach
          ) {
            out[ny * GRID + nx] = 1;
          }
        }
      }
    }
  }
  return out;
};

type IconMask = {
  name: string;
  stroke: number;
  ink: Ink;
  mask: Mask;
  grown: Mask;
};

let iconMasks: IconMask[] | null = null;

const masksOfIcons = () => {
  if (!iconMasks) {
    iconMasks = [];
    for (const icon of ICONS) {
      const lines = flatten(icon.d);
      if (!lines.length) {
        continue;
      }
      for (const stroke of STROKES) {
        const ink = inkOf(lines, stroke);
        const mask = toGrid(
          (x, y) =>
            lines.some((line) => segmentDistance(x, y, line) <= stroke / 2),
          ink,
        );
        iconMasks.push({
          name: icon.name,
          stroke,
          ink,
          mask,
          grown: dilate(mask, REACH),
        });
      }
    }
  }
  return iconMasks;
};

const inside = (polys: Pt[][], x: number, y: number) => {
  let hits = 0;
  for (const poly of polys) {
    for (
      let index = 0, prev = poly.length - 1;
      index < poly.length;
      prev = index++
    ) {
      const [xi, yi] = poly[index];
      const [xj, yj] = poly[prev];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        hits++;
      }
    }
  }
  return hits % 2 === 1;
};

const shoelace = (poly: Pt[]) => {
  let sum = 0;
  for (let index = 0; index < poly.length; index++) {
    const next = poly[(index + 1) % poly.length];
    sum += poly[index][0] * next[1] - next[0] * poly[index][1];
  }
  return Math.abs(sum / 2);
};

/** the share of its box a region inks (the outline's area less its holes) */
const inkShare = (region: TraceRegion) => {
  const [outline, ...holes] = region.polys;
  const ink =
    shoelace(outline) - holes.reduce((sum, hole) => sum + shoelace(hole), 0);
  return ink / Math.max(1, region.bounds.width * region.bounds.height);
};

type Box = { x: number; y: number; width: number; height: number };

const unionBox = (boxes: readonly Box[]): Box => {
  const x = Math.min(...boxes.map((box) => box.x));
  const y = Math.min(...boxes.map((box) => box.y));
  return {
    x,
    y,
    width: Math.max(...boxes.map((box) => box.x + box.width)) - x,
    height: Math.max(...boxes.map((box) => box.y + box.height)) - y,
  };
};

export type IconMatch = {
  name: string;
  /** 0 to 1 */
  score: number;
  /** the regions it stands for (indexes into the traced regions) */
  regions: number[];
  /** where it is, in bitmap pixels */
  bounds: Box;
  stroke: number;
  fill: string;
};

const score = (candidate: Mask, icon: IconMask) => {
  let candidateInk = 0;
  let iconInk = 0;
  let precise = 0;
  let recalled = 0;
  const grown = dilate(candidate, REACH);
  for (let index = 0; index < candidate.length; index++) {
    candidateInk += candidate[index];
    iconInk += icon.mask[index];
    precise += candidate[index] & icon.grown[index];
    recalled += icon.mask[index] & grown[index];
  }
  // a filled blob is not an outline icon: the amount of ink must be alike
  if (
    !candidateInk ||
    !iconInk ||
    Math.abs(candidateInk - iconInk) / Math.max(candidateInk, iconInk) > 0.5
  ) {
    return 0;
  }
  const exact = precise / candidateInk;
  const whole = recalled / iconInk;
  return exact + whole > 0 ? (2 * exact * whole) / (exact + whole) : 0;
};

const best = (regions: readonly TraceRegion[], ids: number[]) => {
  const parts = ids.map((id) => regions[id]);
  const box = unionBox(parts.map((part) => part.bounds));
  const size = Math.max(box.width, box.height);
  const aspect = box.width / box.height;
  const polys = parts.flatMap((part) => part.polys);
  const mask = toGrid((x, y) => inside(polys, x, y), {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    size,
  });
  let top: IconMatch | null = null;
  for (const icon of masksOfIcons()) {
    const iconAspect = icon.ink.width / icon.ink.height;
    if (Math.abs(Math.log(aspect / iconAspect)) > 0.35) {
      continue;
    }
    const value = score(mask, icon);
    if (!top || value > top.score) {
      top = {
        name: icon.name,
        score: value,
        regions: ids,
        bounds: box,
        stroke: icon.stroke,
        fill: parts[0].fill,
      };
    }
  }
  return top;
};

export type MatchOptions = {
  /** the smallest score taken as a match, 0 to 1 */
  threshold?: number;
  /** icons smaller or larger than this (longer side, bitmap pixels) are not looked for */
  minSize?: number;
  maxSize?: number;
};

/** the icons found among the traced regions, best first; no region is used twice */
export const matchIcons = (
  regions: readonly TraceRegion[],
  { threshold = 0.84, minSize = 8, maxSize = 220 }: MatchOptions = {},
): IconMatch[] => {
  const candidates = regions
    .map((region, id) => ({ region, id }))
    .filter(({ region }) => {
      const { width, height } = region.bounds;
      const size = Math.max(width, height);
      return (
        size >= minSize &&
        size <= maxSize &&
        Math.min(width, height) >= 3 &&
        // strokes ink a minority of their box; a filled box, disc or page is not a glyph (dots are)
        (size <= 14 || inkShare(region) <= 0.6)
      );
    });
  // neighbours of one colour may be pieces of one icon (a dotted ellipsis, a bell and its clapper)
  const near = (first: TraceRegion, second: TraceRegion) => {
    const one = first.bounds;
    const two = second.bounds;
    const gap = Math.max(one.width, one.height, two.width, two.height) * 0.3;
    return (
      first.fill === second.fill &&
      one.x - gap < two.x + two.width &&
      two.x - gap < one.x + one.width &&
      one.y - gap < two.y + two.height &&
      two.y - gap < one.y + one.height
    );
  };
  const clusters: number[][] = [];
  const seen = new Set<number>();
  for (const { id } of candidates) {
    if (seen.has(id)) {
      continue;
    }
    const cluster = [id];
    seen.add(id);
    for (let at = 0; at < cluster.length && cluster.length < 5; at++) {
      for (const other of candidates) {
        if (
          !seen.has(other.id) &&
          cluster.length < 5 &&
          near(regions[cluster[at]], other.region)
        ) {
          seen.add(other.id);
          cluster.push(other.id);
        }
      }
    }
    clusters.push(cluster);
  }
  const found: IconMatch[] = [];
  for (const cluster of clusters) {
    const whole = best(regions, cluster);
    const box = whole?.bounds;
    const fits =
      box &&
      Math.max(box.width, box.height) <= maxSize &&
      whole.score >= threshold;
    if (fits) {
      found.push(whole);
    } else if (cluster.length > 1) {
      for (const id of cluster) {
        const single = best(regions, [id]);
        if (single && single.score >= threshold) {
          found.push(single);
        }
      }
    }
  }
  return found.sort((first, second) => second.score - first.score);
};

/** the library icon as path elements over a match, in the picture's colour, one group */
export const iconElements = (
  match: IconMatch,
  /** the match's box in canvas units */
  box: Box,
  color: string,
): ExcalidrawElement[] => {
  const icon = ICONS.find((candidate) => candidate.name === match.name);
  if (!icon) {
    return [];
  }
  const ink = inkOf(flatten(icon.d), match.stroke);
  const size = Math.max(box.width, box.height);
  const scale = size / ink.size;
  const group = randomId();
  const ox =
    box.x +
    (size - ink.width * scale) / 2 +
    (box.width - size) / 2 -
    ink.x * scale;
  const oy =
    box.y +
    (size - ink.height * scale) / 2 +
    (box.height - size) / 2 -
    ink.y * scale;
  return parsePath(icon.d).map(
    (sub) =>
      pathElement(sub, scale, ox, oy, {
        strokeColor: color,
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: Math.max(1, match.stroke * scale),
        roughness: 0,
        opacity: 100,
        groupIds: [group],
        customData: { symbol: { group, icon: icon.name } },
      }) as ExcalidrawElement,
  );
};
