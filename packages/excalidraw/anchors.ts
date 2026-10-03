import type { Bounds } from "@excalidraw/common";

/** Ties an element to another element or to a ruler guide; kept in `customData.anchor`. */
export type AnchorPoint =
  | "tl"
  | "tc"
  | "tr"
  | "ml"
  | "c"
  | "mr"
  | "bl"
  | "bc"
  | "br";

export const ANCHOR_POINTS: readonly AnchorPoint[] = [
  "tl",
  "tc",
  "tr",
  "ml",
  "c",
  "mr",
  "bl",
  "bc",
  "br",
];

export type ElementAnchor = {
  /** the element followed */
  to: string;
  /** the point of the target the element hangs from */
  from: AnchorPoint;
  /** the point of the element that sits there */
  at: AnchorPoint;
  /** gap from the target point to the element point */
  dx: number;
  dy: number;
};

export type GuideEdge = "start" | "center" | "end";

export type GuideAnchor = {
  /** a ruler guide */
  guide: string;
  /** the edge of the element on it: left/top, middle, right/bottom */
  edge: GuideEdge;
  offset: number;
};

export type Anchor = ElementAnchor | GuideAnchor;

export const isGuideAnchor = (anchor: Anchor): anchor is GuideAnchor =>
  "guide" in anchor;

const isPoint = (value: unknown): value is AnchorPoint =>
  typeof value === "string" &&
  (ANCHOR_POINTS as readonly string[]).includes(value);

const num = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

/** the anchor of an element, repaired; null when there is none */
export const getAnchor = (element: {
  customData?: Record<string, any>;
}): Anchor | null => {
  const raw = element.customData?.anchor;
  if (!raw || typeof raw !== "object") {
    return null;
  }
  if (typeof raw.guide === "string") {
    return {
      guide: raw.guide,
      edge: raw.edge === "center" || raw.edge === "end" ? raw.edge : "start",
      offset: num(raw.offset),
    };
  }
  if (typeof raw.to === "string") {
    return {
      to: raw.to,
      from: isPoint(raw.from) ? raw.from : "c",
      at: isPoint(raw.at) ? raw.at : "c",
      dx: num(raw.dx),
      dy: num(raw.dy),
    };
  }
  return null;
};

export const withAnchor = (
  customData: Record<string, any> | undefined,
  anchor: Anchor | null,
): Record<string, any> => {
  const next = { ...(customData ?? {}) };
  if (anchor) {
    next.anchor = anchor;
  } else {
    delete next.anchor;
  }
  // an empty object, not undefined: an update with undefined changes nothing
  return next;
};

/** a named point of an axis-aligned box */
export const pointOnBounds = (
  [x1, y1, x2, y2]: Bounds,
  point: AnchorPoint,
): [number, number] => {
  const x = point.endsWith("l") ? x1 : point.endsWith("r") ? x2 : (x1 + x2) / 2;
  const y = point.startsWith("t")
    ? y1
    : point.startsWith("b")
    ? y2
    : (y1 + y2) / 2;
  // "c" is the centre, "tc" the top middle, "ml" the left middle ...
  return [
    point === "c" || point === "tc" || point === "bc" ? (x1 + x2) / 2 : x,
    point === "c" || point === "ml" || point === "mr" ? (y1 + y2) / 2 : y,
  ];
};

/** the move that makes an element satisfy its element anchor */
export const solveElementAnchor = (
  element: Bounds,
  target: Bounds,
  anchor: ElementAnchor,
): { x: number; y: number } => {
  const [ex, ey] = pointOnBounds(element, anchor.at);
  const [tx, ty] = pointOnBounds(target, anchor.from);
  return { x: tx + anchor.dx - ex, y: ty + anchor.dy - ey };
};

export const guideEdgeCoordinate = (
  element: Bounds,
  axis: "x" | "y",
  edge: GuideEdge,
) => {
  const [x1, y1, x2, y2] = element;
  const [start, end] = axis === "x" ? [x1, x2] : [y1, y2];
  return edge === "start" ? start : edge === "end" ? end : (start + end) / 2;
};

/** the move that makes an element satisfy its guide anchor */
export const solveGuideAnchor = (
  element: Bounds,
  guide: { axis: "x" | "y"; position: number },
  anchor: GuideAnchor,
): { x: number; y: number } => {
  const distance =
    guide.position +
    anchor.offset -
    guideEdgeCoordinate(element, guide.axis, anchor.edge);
  return guide.axis === "x" ? { x: distance, y: 0 } : { x: 0, y: distance };
};

/** a box rounded outward-in to grid lines; never smaller than one cell */
export const fitBoundsToGrid = (
  [x1, y1, x2, y2]: Bounds,
  size: number,
  {
    keepSize,
    origin = { x: 0, y: 0 },
  }: {
    keepSize: boolean;
    origin?: { x: number; y: number };
  },
): Bounds => {
  const snapX = (value: number) =>
    Math.round((value - origin.x) / size) * size + origin.x;
  const snapY = (value: number) =>
    Math.round((value - origin.y) / size) * size + origin.y;
  const nx1 = snapX(x1);
  const ny1 = snapY(y1);
  if (keepSize) {
    return [nx1, ny1, nx1 + (x2 - x1), ny1 + (y2 - y1)];
  }
  let nx2 = snapX(x2);
  let ny2 = snapY(y2);
  if (nx2 - nx1 < size) {
    nx2 = nx1 + size;
  }
  if (ny2 - ny1 < size) {
    ny2 = ny1 + size;
  }
  return [nx1, ny1, nx2, ny2];
};
