import {
  getElementAbsoluteCoords,
  getPathGeometryFromShape,
  getPathSceneGeometry,
  getPathUpdate,
  isPathElement,
  newElementWith,
  shearPathGeometry,
  shearSceneGeometry,
} from "@excalidraw/element";

import type {
  ExcalidrawPathElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import type { Radians } from "@excalidraw/math";

import {
  getSkewFactor,
  gizmoToLocal,
  skewPivot,
  type GizmoTarget,
  type GizmoZone,
} from "../../gizmo";

import type App from "../App";
import type { GizmoOverlay } from "./overlay";
import type { ScenePoint, SkewGesture, SkewGroupGesture } from "./types";

type SkewZone = Extract<GizmoZone, { kind: "skew" }>;

const isHorizontalEdge = (edge: "n" | "e" | "s" | "w") =>
  edge === "n" || edge === "s";

/** the skew angle shown to the user, in degrees with one decimal */
const skewReadout = (factor: number) =>
  `${Math.round((Math.atan(factor) * 1800) / Math.PI) / 10}°`;

/** Shears one path, or several shapes about one shared line. */
export class GizmoSkew {
  constructor(private app: App, private overlay: GizmoOverlay) {}

  /** @returns null when a shape of the selection cannot become a path */
  begin = (
    zone: SkewZone,
    target: GizmoTarget,
    point: ScenePoint,
  ): SkewGesture | SkewGroupGesture | null => {
    if (target.elements.length === 1) {
      const path = this.ensurePath(target.elements[0]);
      if (!path) {
        return null;
      }
      const [centerX, centerY] = this.center(
        path as NonDeletedExcalidrawElement,
      );
      const [localX, localY] = gizmoToLocal(
        point.x,
        point.y,
        centerX,
        centerY,
        path.angle,
      );
      return {
        kind: "skew",
        id: path.id,
        edge: zone.edge,
        base: { ...path },
        start: [localX, localY],
        cx: centerX,
        cy: centerY,
      };
    }
    const bases: ExcalidrawPathElement[] = [];
    for (const element of target.elements) {
      const path = this.ensurePath(element);
      if (!path) {
        return null;
      }
      bases.push({ ...path });
    }
    const { cx, cy, hw, hh } = target.frame;
    return {
      kind: "skew-group",
      edge: zone.edge,
      bases,
      start: [point.x - cx, point.y - cy],
      cx,
      cy,
      hw,
      hh,
    };
  };

  private center = (element: NonDeletedExcalidrawElement) => {
    const [, , , , centerX, centerY] = getElementAbsoluteCoords(
      element,
      this.app.scene.getNonDeletedElementsMap(),
    );
    return [centerX, centerY] as const;
  };

  /** rectangle / diamond / ellipse become paths so they can shear */
  private ensurePath = (
    element: NonDeletedExcalidrawElement,
  ): ExcalidrawPathElement | null => {
    if (isPathElement(element)) {
      return element;
    }
    if (
      element.type !== "rectangle" &&
      element.type !== "diamond" &&
      element.type !== "ellipse"
    ) {
      return null;
    }
    const { points, handles } = getPathGeometryFromShape(element);
    // a new object of another type under the same id
    const converted = newElementWith(
      {
        ...element,
        type: "path",
        points,
        handles,
        closed: true,
        roundness: null,
      } as unknown as ExcalidrawPathElement,
      {},
    );
    this.app.scene.replaceAllElements(
      this.app.scene
        .getElementsIncludingDeleted()
        .map((existing) => (existing.id === element.id ? converted : existing)),
    );
    return this.app.scene.getNonDeletedElement(
      element.id,
    ) as ExcalidrawPathElement;
  };

  move = (gesture: SkewGesture, event: PointerEvent, point: ScenePoint) => {
    const element = this.app.scene.getNonDeletedElement(gesture.id);
    if (!element) {
      return;
    }
    const { base, edge } = gesture;
    const halfWidth = base.width / 2;
    const halfHeight = base.height / 2;
    const [localX, localY] = gizmoToLocal(
      point.x,
      point.y,
      gesture.cx,
      gesture.cy,
      base.angle,
    );
    const horizontal = isHorizontalEdge(edge);
    const drag = horizontal
      ? localX - gesture.start[0]
      : localY - gesture.start[1];
    const factor = getSkewFactor(edge, drag, halfWidth, halfHeight, {
      fromCenter: event.altKey,
      snap: event.shiftKey,
    });
    const geometry = shearPathGeometry(
      base,
      horizontal ? "x" : "y",
      factor,
      skewPivot(edge, halfWidth, halfHeight, event.altKey),
    );
    this.app.scene.mutateElement(element as ExcalidrawPathElement, {
      ...getPathUpdate(base, geometry),
    });
    this.overlay.readout(event, skewReadout(factor));
  };

  /** several shapes sheared about one line: scene axes, one shared pivot */
  moveGroup = (
    gesture: SkewGroupGesture,
    event: PointerEvent,
    point: ScenePoint,
  ) => {
    const { edge, cx, cy, hw, hh } = gesture;
    const horizontal = isHorizontalEdge(edge);
    const drag = horizontal
      ? point.x - cx - gesture.start[0]
      : point.y - cy - gesture.start[1];
    const factor = getSkewFactor(edge, drag, hw, hh, {
      fromCenter: event.altKey,
      snap: event.shiftKey,
    });
    // the line that stays put, in scene coordinates
    const pivot =
      (horizontal ? cy : cx) + skewPivot(edge, hw, hh, event.altKey);
    for (const base of gesture.bases) {
      const element = this.app.scene.getNonDeletedElement(base.id);
      if (!element) {
        continue;
      }
      const geometry = shearSceneGeometry(
        getPathSceneGeometry(base),
        horizontal ? "x" : "y",
        factor,
        pivot,
      );
      const sceneFrame = {
        ...base,
        x: 0,
        y: 0,
        angle: 0 as Radians,
        ...geometry,
      } as ExcalidrawPathElement;
      this.app.scene.mutateElement(element as ExcalidrawPathElement, {
        ...getPathUpdate(sceneFrame, geometry),
        angle: 0 as Radians,
      });
    }
    this.overlay.readout(event, skewReadout(factor));
  };

  /** puts every sheared path back to the geometry it had when the gesture began */
  cancel = (gesture: SkewGesture | SkewGroupGesture) => {
    for (const base of gesture.kind === "skew"
      ? [gesture.base]
      : gesture.bases) {
      const element = this.app.scene.getNonDeletedElement(base.id);
      if (!element) {
        continue;
      }
      this.app.scene.mutateElement(element as ExcalidrawPathElement, {
        x: base.x,
        y: base.y,
        width: base.width,
        height: base.height,
        angle: base.angle,
        points: base.points,
        handles: base.handles,
        ...(base.contours ? { contours: base.contours } : {}),
      });
    }
  };
}
