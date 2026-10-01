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
  for (const g of value) {
    if (
      g &&
      typeof g.id === "string" &&
      (g.axis === "x" || g.axis === "y") &&
      Number.isFinite(g.position) &&
      !seen.has(g.id)
    ) {
      seen.add(g.id);
      guides.push({ id: g.id, axis: g.axis, position: g.position });
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
    for (const p of points) {
      const d = guide.position - (axis === "x" ? p[0] : p[1]);
      if (Math.abs(d) <= limit && Math.abs(d) < best[axis]) {
        best[axis] = Math.abs(d);
        offset[axis] = d;
      }
    }
  }
  return {
    ...offset,
    guides: guides.filter(
      (g) =>
        best[g.axis] !== Infinity &&
        points.some(
          (p) =>
            Math.abs(
              (g.axis === "x" ? p[0] : p[1]) + offset[g.axis] - g.position,
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
    for (const s of STEPS) {
      if (s * mag * zoom >= minPx) {
        return s * mag;
      }
    }
  }
  return 1e9;
};

export const formatRulerValue = (v: number) => `${Math.round(v * 1000) / 1000}`;
