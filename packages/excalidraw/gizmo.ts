/**
 * The transform gizmo around the selection: one element in its own frame, or
 * several (a group) in the frame of their common box (origin at its centre,
 * axes turned with the element):
 *
 *   rotate zones: just outside each corner  — drag to turn around the centre
 *   skew zones:   just outside each edge    — drag along the edge to shear
 *
 * Resizing keeps the usual handles; these zones sit outside them, and the
 * modifiers (Shift: 15° steps, Alt: from the centre) work as in other design tools.
 */
import { getCommonBounds, getElementAbsoluteCoords } from "@excalidraw/element";

import type {
  ElementsMap,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

export type GizmoCorner = "nw" | "ne" | "se" | "sw";
export type GizmoEdge = "n" | "e" | "s" | "w";

export type GizmoZone =
  | { kind: "rotate"; corner: GizmoCorner }
  | { kind: "skew"; edge: GizmoEdge };

/** screen px from the element's box: clear of the resize handles */
export const GIZMO_INNER = 14;
export const GIZMO_OUTER = 34;
/** the existing rotation handle lives above the top edge's middle */
const TOP_CENTER_CLEARANCE = 26;

export const sameZone = (a: GizmoZone | null, b: GizmoZone | null) =>
  a === b ||
  (!!a &&
    !!b &&
    a.kind === b.kind &&
    (a.kind === "rotate"
      ? a.corner === (b as typeof a).corner
      : a.edge === (b as typeof a).edge));

/**
 * @param x,y   pointer, relative to the element's centre, in its frame
 * @param hw,hh half width / height of the element's box
 * @param zoom  scene px -> screen px
 */
export const getGizmoZone = (
  x: number,
  y: number,
  hw: number,
  hh: number,
  zoom: number,
  skewable: boolean,
): GizmoZone | null => {
  const inner = GIZMO_INNER / zoom;
  const outer = GIZMO_OUTER / zoom;
  const dx = Math.abs(x) - hw;
  const dy = Math.abs(y) - hh;
  const inBand = (d: number) => d > inner && d < outer;

  // corners: out past both edges
  if (dx > inner * 0.35 && dy > inner * 0.35 && dx < outer && dy < outer) {
    return {
      kind: "rotate",
      corner: `${y < 0 ? "n" : "s"}${x < 0 ? "w" : "e"}` as GizmoCorner,
    };
  }
  if (!skewable) {
    return null;
  }
  // edges: out past one edge, within the span of the other
  if (inBand(dy) && Math.abs(x) <= hw) {
    if (y < 0 && Math.abs(x) < TOP_CENTER_CLEARANCE / zoom) {
      return null;
    }
    return { kind: "skew", edge: y < 0 ? "n" : "s" };
  }
  if (inBand(dx) && Math.abs(y) <= hh) {
    return { kind: "skew", edge: x < 0 ? "w" : "e" };
  }
  return null;
};

/** local -> scene */
export const gizmoToScene = (
  lx: number,
  ly: number,
  cx: number,
  cy: number,
  angle: number,
): [number, number] => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [cx + lx * cos - ly * sin, cy + lx * sin + ly * cos];
};

/** scene -> local */
export const gizmoToLocal = (
  x: number,
  y: number,
  cx: number,
  cy: number,
  angle: number,
): [number, number] => {
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const dx = x - cx;
  const dy = y - cy;
  return [dx * cos - dy * sin, dx * sin + dy * cos];
};

const SKEW_LIMIT = (80 * Math.PI) / 180;
const STEP = (15 * Math.PI) / 180;

/**
 * The shear factor tan(a) for dragging a skew zone by `drag` (scene px, along
 * the edge, in the element's frame). The opposite edge stays put, or with
 * `fromCenter` the centre does and both edges move.
 */
export const getSkewFactor = (
  edge: GizmoEdge,
  drag: number,
  hw: number,
  hh: number,
  { fromCenter, snap }: { fromCenter: boolean; snap: boolean },
) => {
  const horizontal = edge === "n" || edge === "s";
  const half = horizontal ? hh : hw;
  const lever = fromCenter ? half : half * 2;
  if (lever <= 0) {
    return 0;
  }
  // the grabbed edge's side decides the direction
  const sign = edge === "s" || edge === "e" ? 1 : -1;
  let a = Math.atan((sign * drag) / lever);
  a = Math.max(-SKEW_LIMIT, Math.min(SKEW_LIMIT, a));
  if (snap) {
    a = Math.round(a / STEP) * STEP;
  }
  return Math.tan(a);
};

export const skewPivot = (
  edge: GizmoEdge,
  hw: number,
  hh: number,
  fromCenter: boolean,
) => {
  if (fromCenter) {
    return 0;
  }
  // the opposite edge, centre-relative
  switch (edge) {
    case "n":
      return hh;
    case "s":
      return -hh;
    case "w":
      return hw;
    case "e":
      return -hw;
  }
};

export const snapAngle = (a: number) => Math.round(a / STEP) * STEP;

// -----------------------------------------------------------------------------
// eligibility
// -----------------------------------------------------------------------------

type GizmoElement = {
  type: string;
  locked: boolean;
  boundElements: readonly unknown[] | null;
  elbowed?: boolean;
};

/** an element the gizmo turns at all */
export const canRotateWithGizmo = (element: GizmoElement) =>
  !element.locked &&
  element.type !== "frame" &&
  element.type !== "magicframe" &&
  !(element.type === "arrow" && element.elbowed);

/**
 * An element the gizmo shears: paths directly, and plain shapes (which become
 * paths on the first skew). Containers with bound labels or arrows are left.
 */
export const canSkewWithGizmo = (element: GizmoElement) =>
  canRotateWithGizmo(element) &&
  (element.type === "path" ||
    ((element.type === "rectangle" ||
      element.type === "diamond" ||
      element.type === "ellipse") &&
      !(element.boundElements?.length ?? 0)));

// -----------------------------------------------------------------------------
// angle alignment
// -----------------------------------------------------------------------------

export type AlignCandidate = {
  /** the angle of an axis to line up with */
  angle: number;
  /** a point on that axis, drawn so the match is visible */
  x: number;
  y: number;
};

/** how close a turning element must come to an axis to lock onto it */
export const ALIGN_TOLERANCE = (3 * Math.PI) / 180;

const QUARTER = Math.PI / 2;

/**
 * Locks a rotation onto the nearest axis of another element (or the page
 * axes): the element's own axes are a quarter turn apart, so an angle matches
 * any candidate angle plus a multiple of 90°.
 */
export const snapToAlignment = (
  angle: number,
  candidates: readonly AlignCandidate[],
  tolerance = ALIGN_TOLERANCE,
): { angle: number; matches: AlignCandidate[] } => {
  let best = angle;
  let bestD = tolerance + 1e-9;
  for (const c of candidates) {
    const turns = Math.round((angle - c.angle) / QUARTER);
    const target = c.angle + turns * QUARTER;
    const d = Math.abs(target - angle);
    if (d < bestD) {
      best = target;
      bestD = d;
    }
  }
  if (bestD > tolerance) {
    return { angle, matches: [] };
  }
  const matches = candidates.filter((c) => {
    const turns = Math.round((best - c.angle) / QUARTER);
    return Math.abs(c.angle + turns * QUARTER - best) < 1e-6;
  });
  return { angle: best, matches };
};

// -----------------------------------------------------------------------------
// what the gizmo surrounds
// -----------------------------------------------------------------------------

/** the box the zones sit around: centre, half sizes, and its turn */
export type GizmoFrame = {
  cx: number;
  cy: number;
  hw: number;
  hh: number;
  angle: number;
};

export type GizmoTarget = {
  elements: readonly NonDeletedExcalidrawElement[];
  frame: GizmoFrame;
  /** every element can be sheared */
  skewable: boolean;
};

/**
 * The gizmo of a selection. One element has the frame of its own (turned)
 * box; several, a group included, the upright box around all of them.
 * Nothing when any of them cannot turn (frames, locked, elbow arrows).
 */
export const getGizmoTarget = (
  selected: readonly NonDeletedExcalidrawElement[],
  elementsMap: ElementsMap,
): GizmoTarget | null => {
  if (
    !selected.length ||
    !selected.every((e) => canRotateWithGizmo(e as any))
  ) {
    return null;
  }
  const skewable = selected.every((e) => canSkewWithGizmo(e as any));
  if (selected.length === 1) {
    const [x1, y1, x2, y2, cx, cy] = getElementAbsoluteCoords(
      selected[0],
      elementsMap,
    );
    return {
      elements: selected,
      frame: {
        cx,
        cy,
        hw: (x2 - x1) / 2,
        hh: (y2 - y1) / 2,
        angle: selected[0].angle,
      },
      skewable,
    };
  }
  const [x1, y1, x2, y2] = getCommonBounds(selected, elementsMap);
  return {
    elements: selected,
    frame: {
      cx: (x1 + x2) / 2,
      cy: (y1 + y2) / 2,
      hw: (x2 - x1) / 2,
      hh: (y2 - y1) / 2,
      angle: 0,
    },
    skewable,
  };
};
