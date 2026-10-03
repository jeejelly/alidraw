import type { GlobalPoint } from "@excalidraw/math";

/**
 * A guide line. `axis: "x"` is a vertical line at scene x = `position`,
 * `axis: "y"` a horizontal one.
 */
export type Guide = Readonly<{
  id: string;
  axis: "x" | "y";
  position: number;
}>;

/** a guide attracts within this many screen px */
export const GUIDE_SNAP_DISTANCE = 8;

export const sanitizeGuides = (value: unknown): Guide[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const guides: Guide[] = [];
  for (const entry of value) {
    if (
      entry &&
      typeof entry.id === "string" &&
      (entry.axis === "x" || entry.axis === "y") &&
      Number.isFinite(entry.position) &&
      !seen.has(entry.id)
    ) {
      seen.add(entry.id);
      guides.push({ id: entry.id, axis: entry.axis, position: entry.position });
    }
  }
  return guides;
};

/**
 * The offset that moves the nearest of `points` onto the nearest guide, per
 * axis, and the guides it lands on.
 */
export const getGuideSnap = (
  points: readonly (readonly [number, number] | GlobalPoint)[],
  guides: readonly Guide[],
  zoom: number,
): { x: number; y: number; guides: Guide[] } => {
  const limit = GUIDE_SNAP_DISTANCE / zoom;
  const best = { x: Infinity, y: Infinity };
  const offset = { x: 0, y: 0 };
  for (const guide of guides) {
    const axis = guide.axis;
    for (const point of points) {
      const distance = guide.position - (axis === "x" ? point[0] : point[1]);
      if (Math.abs(distance) <= limit && Math.abs(distance) < best[axis]) {
        best[axis] = Math.abs(distance);
        offset[axis] = distance;
      }
    }
  }
  return {
    ...offset,
    guides: guides.filter(
      (guide) =>
        best[guide.axis] !== Infinity &&
        points.some(
          (point) =>
            Math.abs(
              (guide.axis === "x" ? point[0] : point[1]) +
                offset[guide.axis] -
                guide.position,
            ) < 1e-6,
        ),
    ),
  };
};

const STEPS = [1, 2, 5];

/**
 * Tick spacing for a ruler: the smallest 1/2/5 x 10^n scene step that is at
 * least `minPx` wide on screen.
 */
export const getRulerStep = (zoom: number, minPx = 60) => {
  for (let mag = 0.001; mag < 1e9; mag *= 10) {
    for (const step of STEPS) {
      if (step * mag * zoom >= minPx) {
        return step * mag;
      }
    }
  }
  return 1e9;
};

export const formatRulerValue = (value: number) =>
  `${Math.round(value * 1000) / 1000}`;
