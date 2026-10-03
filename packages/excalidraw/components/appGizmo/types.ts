import type { ExcalidrawPathElement } from "@excalidraw/element/types";

type SkewEdge = "n" | "e" | "s" | "w";

export type RotateGesture = {
  kind: "rotate";
  /** a single element turns about its own centre; several about the box's */
  ids: string[];
  angles: Map<string, number>;
  startAngle: number;
  startTheta: number;
  cx: number;
  cy: number;
};

export type SkewGesture = {
  kind: "skew";
  id: string;
  edge: SkewEdge;
  base: ExcalidrawPathElement;
  start: [number, number];
  cx: number;
  cy: number;
};

/** several shapes sheared about one line, in scene axes */
export type SkewGroupGesture = {
  kind: "skew-group";
  edge: SkewEdge;
  bases: ExcalidrawPathElement[];
  start: [number, number];
  cx: number;
  cy: number;
  hw: number;
  hh: number;
};

export type GizmoGesture = RotateGesture | SkewGesture | SkewGroupGesture;

export type ScenePoint = { x: number; y: number };
