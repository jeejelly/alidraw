import { KEYS } from "@excalidraw/common";
import { pointFrom, type LocalPoint } from "@excalidraw/math";
import {
  NO_HANDLES,
  isPathElement,
  newPathElement,
  setPathClosed,
} from "@excalidraw/element";

import type {
  ExcalidrawPathElement,
  PathPointMode,
} from "@excalidraw/element/types";

import type React from "react";

import type { PathContext, ScenePoint } from "./context";

/** a click this close to the first point closes the path, in screen px */
const CLOSE_RADIUS = 10;
/** a pen drag shorter than this leaves a corner point, in screen px */
const MIN_HANDLE_DRAG = 4;
/** consecutive points closer than this (scene px) count as a repeated click */
const DUPLICATE_POINT_DISTANCE = 1;

/**
 * The pen tool. While creating, the last point of the path is a "floating"
 * one that follows the cursor, so the next segment is previewed by the normal
 * renderer.
 */
export class PathPen {
  private creating: { id: string; committed: number } | null = null;

  constructor(private context: PathContext) {}

  private get app() {
    return this.context.app;
  }

  isCreating = () => this.creating !== null;

  private getCreatedElement = () => {
    if (!this.creating) {
      return null;
    }
    const element = this.app.scene.getNonDeletedElement(this.creating.id);
    return isPathElement(element) ? element : null;
  };

  private startCreating = (point: ScenePoint) => {
    const element = newPathElement({
      x: point.x,
      y: point.y,
      ...this.app.getPathElementStyle(),
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(0, 0)],
      handles: [NO_HANDLES, NO_HANDLES],
      closed: false,
    });
    this.app.insertNewElement(element);
    this.creating = { id: element.id, committed: 1 };
    this.app.setState({
      selectedElementIds: {},
      selectedGroupIds: {},
      editingPath: null,
    });
    return element;
  };

  /** @returns true when the pointer was consumed by the pen tool */
  pointerDown = (
    point: ScenePoint,
    event: React.PointerEvent<HTMLElement>,
  ): boolean => {
    let index: number;

    if (!this.creating) {
      this.startCreating(point);
      index = 0;
    } else {
      const element = this.getCreatedElement();
      if (!element) {
        this.creating = null;
        return false;
      }
      const zoom = this.app.state.zoom.value;
      const local = this.context.toLocal(element, point);
      const { committed } = this.creating;

      // double click: the second click only ends the path
      if (
        this.context.isDoubleClick(point, event.timeStamp, CLOSE_RADIUS / zoom)
      ) {
        this.finishCreating();
        return true;
      }

      // a click on the first point closes the path
      if (
        committed >= 3 &&
        Math.hypot(
          local[0] - element.points[0][0],
          local[1] - element.points[0][1],
        ) <
          CLOSE_RADIUS / zoom
      ) {
        this.finishCreating(true);
        return true;
      }

      const points = [...element.points];
      const handles = [...element.handles];
      points[committed] = local;
      handles[committed] = NO_HANDLES;
      points.push(local);
      handles.push(NO_HANDLES);
      this.context.apply(element, { points, handles });
      index = committed;
      this.creating = { id: element.id, committed: committed + 1 };
    }

    this.context.rememberClick(point, event.timeStamp);
    this.context.gesture = { kind: "pen-handle", index };
    this.context.listen();
    return true;
  };

  pointerMove = (point: ScenePoint) => {
    const element = this.getCreatedElement();
    if (!this.creating || !element) {
      return;
    }
    const local = this.context.toLocal(element, point);
    const { committed } = this.creating;
    const { gesture } = this.context;

    if (gesture?.kind === "pen-handle") {
      this.dragHandle(element, gesture.index, local);
      return;
    }

    // the floating point follows the cursor
    const points = element.points.map((existing, index) =>
      index === committed ? local : existing,
    );
    this.context.apply(element, { points, handles: element.handles });
  };

  /** dragging out of a fresh anchor pulls a symmetric (smooth) handle pair */
  private dragHandle = (
    element: ExcalidrawPathElement,
    anchorIndex: number,
    local: LocalPoint,
  ) => {
    const anchor = element.points[anchorIndex];
    const out = pointFrom<LocalPoint>(
      local[0] - anchor[0],
      local[1] - anchor[1],
    );
    const dragged =
      Math.hypot(out[0], out[1]) * this.app.state.zoom.value >= MIN_HANDLE_DRAG;
    const handles = element.handles.map((existing, index) => {
      if (index !== anchorIndex) {
        return existing;
      }
      return dragged
        ? {
            mode: "smooth" as PathPointMode,
            out,
            in: pointFrom<LocalPoint>(-out[0], -out[1]),
          }
        : NO_HANDLES;
    });
    this.context.apply(element, { points: element.points, handles });
  };

  /** ends the path being drawn: drops the floating point, selects the path */
  finishCreating = (close = false) => {
    if (!this.creating) {
      return;
    }
    const { id, committed } = this.creating;
    this.creating = null;
    this.context.gesture = null;
    this.context.unlisten();

    const element = this.app.scene.getNonDeletedElement(id);
    if (!isPathElement(element)) {
      return;
    }
    // a double click commits its first click's point twice
    let keep = committed;
    while (
      keep > 2 &&
      Math.hypot(
        element.points[keep - 1][0] - element.points[keep - 2][0],
        element.points[keep - 1][1] - element.points[keep - 2][1],
      ) < DUPLICATE_POINT_DISTANCE
    ) {
      keep--;
    }

    if (keep < 2) {
      this.app.scene.mutateElement(element as ExcalidrawPathElement, {
        isDeleted: true,
      });
      this.app.setState({ selectedElementIds: {} });
      this.app.setActiveTool({ type: "selection" });
      return;
    }

    const points = element.points.slice(0, keep);
    const handles = element.handles.slice(0, keep);
    const closing = close
      ? setPathClosed({ ...element, points, handles, closed: false }, true)
      : null;
    if (closing) {
      this.context.apply(element, closing, true);
    } else {
      this.context.apply(element, { points, handles }, false);
    }
    this.app.setState({ selectedElementIds: { [id]: true } });
    if (!this.app.state.activeTool.locked) {
      this.app.setActiveTool({ type: "selection" }, { keepSelection: true });
    }
    this.context.commit();
  };

  cancelCreating = () => {
    if (!this.creating) {
      return;
    }
    const element = this.app.scene.getNonDeletedElement(this.creating.id);
    this.creating = null;
    this.context.gesture = null;
    this.context.unlisten();
    if (element) {
      this.app.scene.mutateElement(element as ExcalidrawPathElement, {
        isDeleted: true,
      });
    }
  };

  private removeLastCommittedPoint = () => {
    const element = this.getCreatedElement();
    if (!this.creating || !element) {
      return;
    }
    if (this.creating.committed <= 1) {
      this.cancelCreating();
      return;
    }
    const committed = this.creating.committed - 1;
    this.creating = { id: element.id, committed };
    // the floating point takes the place of the dropped one
    this.context.apply(element, {
      points: element.points.slice(0, committed + 1),
      handles: element.handles
        .slice(0, committed + 1)
        .map((handles, index) => (index === committed ? NO_HANDLES : handles)),
    });
  };

  /** @returns true when the key was consumed */
  handleKeyDown = (event: KeyboardEvent | React.KeyboardEvent): boolean => {
    if (event.key === KEYS.ENTER || event.key === KEYS.ESCAPE) {
      this.finishCreating();
      return true;
    }
    if (event.key === KEYS.BACKSPACE || event.key === KEYS.DELETE) {
      this.removeLastCommittedPoint();
      return true;
    }
    return false;
  };
}
