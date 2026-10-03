import { KEYS } from "@excalidraw/common";
import { pointFrom, type LocalPoint } from "@excalidraw/math";
import {
  NO_HANDLES,
  deletePathPoint,
  dragPathHandle,
  getClosestPathLoopSegment,
  getPathLoopView,
  getPathUpdate,
  insertPathPoint,
  movePathPoint,
  newPathElement,
  setPathClosed,
  setPathPointMode,
  splitPathAt,
} from "@excalidraw/element";

import type {
  ExcalidrawPathElement,
  PathPointMode,
} from "@excalidraw/element/types";

import type React from "react";

import type { PathContext, ScenePoint } from "./context";

/** radius of an anchor/handle hit area, in screen px */
const HIT_RADIUS = 9;

type PointHit = { loop: number; index: number; side?: "in" | "out" };

type GuideModifiers = { ctrlKey: boolean; metaKey: boolean };

const toggledMode = (mode: PathPointMode | undefined): PathPointMode =>
  mode === "corner" ? "smooth" : "corner";

/** The point editor of a selected path: anchors, handles, split, close. */
export class PathPointEditor {
  constructor(private context: PathContext) {}

  private get app() {
    return this.context.app;
  }

  private get editing() {
    return this.app.state.editingPath;
  }

  startEditing = (element: ExcalidrawPathElement) => {
    this.context.setEditing(element.id, null);
  };

  stopEditing = () => {
    if (this.editing) {
      this.context.setEditing(null);
    }
  };

  private isHit = (
    element: ExcalidrawPathElement,
    local: LocalPoint,
    pointer: ScenePoint,
    hitRadius: number,
  ) => {
    const scene = this.context.toScene(element, local);
    return Math.hypot(scene[0] - pointer.x, scene[1] - pointer.y) <= hitRadius;
  };

  private hitPoint = (
    element: ExcalidrawPathElement,
    pointer: ScenePoint,
  ): PointHit | null => {
    const hitRadius = HIT_RADIUS / this.app.state.zoom.value;
    const selected = this.editing?.selectedPoint ?? null;
    const activeLoop = this.editing?.loop ?? 0;
    const active = getPathLoopView(element, activeLoop);

    // handles of the selected point come first: they sit on top
    const selectedHandles = selected != null ? active.handles[selected] : null;
    if (
      selected != null &&
      selectedHandles &&
      selectedHandles.mode !== "corner"
    ) {
      for (const side of ["out", "in"] as const) {
        const offset = selectedHandles[side];
        if (
          offset &&
          this.isHit(
            element,
            pointFrom<LocalPoint>(
              active.points[selected][0] + offset[0],
              active.points[selected][1] + offset[1],
            ),
            pointer,
            hitRadius,
          )
        ) {
          return { loop: activeLoop, index: selected, side };
        }
      }
    }
    // the main outline is on top of the holes
    const loops = 1 + (element.contours?.length ?? 0);
    for (let loop = 0; loop < loops; loop++) {
      const view = getPathLoopView(element, loop);
      for (let index = view.points.length - 1; index >= 0; index--) {
        if (this.isHit(element, view.points[index], pointer, hitRadius)) {
          return { loop, index };
        }
      }
    }
    return null;
  };

  /**
   * @returns true when the pointer was consumed by the point editor; false
   * leaves it to the regular selection code
   */
  pointerDown = (
    element: ExcalidrawPathElement,
    pointer: ScenePoint,
    event: React.PointerEvent<HTMLElement>,
  ): boolean => {
    const hitRadius = HIT_RADIUS / this.app.state.zoom.value;
    const hit = this.hitPoint(element, pointer);
    const isDouble = this.context.isDoubleClick(
      pointer,
      event.timeStamp,
      hitRadius,
    );
    this.context.rememberClick(pointer, event.timeStamp);

    if (hit?.side) {
      this.context.gesture = {
        kind: "handle",
        loop: hit.loop,
        index: hit.index,
        side: hit.side,
        original: element,
      };
      this.context.listen();
      return true;
    }
    if (hit) {
      this.pressAnchor(element, pointer, hit, isDouble || event.altKey);
      return true;
    }
    if (this.insertOnOutline(element, pointer, hitRadius, isDouble)) {
      return true;
    }
    // anywhere else leaves the editor and lets the click select as usual
    this.stopEditing();
    return false;
  };

  /** a press on an anchor selects and drags it; a double click or Alt toggles its mode */
  private pressAnchor = (
    element: ExcalidrawPathElement,
    pointer: ScenePoint,
    hit: PointHit,
    togglesMode: boolean,
  ) => {
    const view = getPathLoopView(element, hit.loop);
    this.context.setEditing(element.id, hit.index, hit.loop);
    if (togglesMode) {
      this.setPointMode(toggledMode(view.handles[hit.index]?.mode), hit.index);
      this.context.lastClick = null;
      return;
    }
    const anchor = view.points[hit.index];
    const local = this.context.toLocal(element, pointer);
    this.context.gesture = {
      kind: "anchor",
      loop: hit.loop,
      index: hit.index,
      original: element,
      grab: [anchor[0] - local[0], anchor[1] - local[1]],
    };
    this.context.listen();
  };

  /** @returns true when the pointer is on the outline (a double click inserts a point) */
  private insertOnOutline = (
    element: ExcalidrawPathElement,
    pointer: ScenePoint,
    hitRadius: number,
    isDouble: boolean,
  ) => {
    const local = this.context.toLocal(element, pointer);
    const closest = getClosestPathLoopSegment(element, local);
    if (!closest || closest.distance > hitRadius) {
      return false;
    }
    if (isDouble) {
      const inserted = insertPathPoint(
        getPathLoopView(element, closest.loop),
        closest.segmentIndex,
        closest.t,
      );
      if (inserted) {
        this.context.apply(element, inserted, undefined, closest.loop);
        this.context.setEditing(element.id, inserted.index, closest.loop);
        this.context.commit();
        this.context.lastClick = null;
      }
    }
    return true;
  };

  pointerMove = (pointer: ScenePoint, modifiers: GuideModifiers) => {
    const { gesture } = this.context;
    if (!gesture || gesture.kind === "pen-handle") {
      return;
    }
    const { original, loop, index } = gesture;
    const local = this.context.toLocal(original, pointer);
    const view = getPathLoopView(original, loop);

    if (gesture.kind === "anchor") {
      let target = pointFrom<LocalPoint>(
        local[0] + gesture.grab[0],
        local[1] + gesture.grab[1],
      );
      // the anchor, not the pointer, is pulled onto a guide
      const anchor = this.context.toScene(original, target);
      const snapped = this.context.snapToGuides(
        { x: anchor[0], y: anchor[1] },
        modifiers,
      );
      if (snapped.x !== anchor[0] || snapped.y !== anchor[1]) {
        target = this.context.toLocal(original, snapped);
      }
      this.context.apply(
        original,
        movePathPoint(view, index, target),
        undefined,
        loop,
      );
      return;
    }

    const anchor = view.points[index];
    const offset = pointFrom<LocalPoint>(
      local[0] - anchor[0],
      local[1] - anchor[1],
    );
    const current = view.handles[index] ?? NO_HANDLES;
    this.context.apply(
      original,
      {
        points: view.points,
        handles: view.handles.map((handles, handlesIndex) =>
          handlesIndex === index
            ? dragPathHandle(current, gesture.side, offset)
            : handles,
        ),
      },
      undefined,
      loop,
    );
  };

  setPointMode = (mode: PathPointMode, index?: number) => {
    const element = this.context.getEditedElement();
    const target = index ?? this.editing?.selectedPoint ?? null;
    if (!element || target == null) {
      return;
    }
    const loop = this.editing?.loop ?? 0;
    this.context.apply(
      element,
      setPathPointMode(getPathLoopView(element, loop), target, mode),
    );
    this.context.commit();
  };

  /** closes an open path / opens a closed one */
  toggleClosed = () => {
    const element = this.context.getEditedElement();
    if (!element || element.contours?.length) {
      // a shape with holes stays closed
      return;
    }
    const next = setPathClosed(element, !element.closed);
    if (!next) {
      return;
    }
    this.context.apply(element, next, next.closed);
    this.context.setEditing(element.id, null);
    this.context.commit();
  };

  /** cuts the path at the selected point */
  splitAtSelectedPoint = () => {
    const element = this.context.getEditedElement();
    const target = this.editing?.selectedPoint ?? null;
    if (!element || target == null || (this.editing?.loop ?? 0) > 0) {
      return;
    }
    const parts = splitPathAt(element, target);
    if (!parts) {
      return;
    }
    const [first, ...rest] = parts;
    const created = rest.map((geometry) =>
      newPathElement({
        strokeColor: element.strokeColor,
        backgroundColor: element.backgroundColor,
        fillStyle: element.fillStyle,
        strokeWidth: element.strokeWidth,
        strokeStyle: element.strokeStyle,
        roughness: element.roughness,
        opacity: element.opacity,
        roundness: element.roundness,
        angle: element.angle,
        groupIds: element.groupIds,
        frameId: element.frameId,
        ...getPathUpdate(element, geometry),
        closed: false,
      }),
    );
    this.context.apply(element, first, false);
    if (created.length) {
      this.app.insertNewElements(created);
    }
    this.context.setEditing(element.id, null);
    this.context.commit();
  };

  deleteSelectedPoint = () => {
    const element = this.context.getEditedElement();
    const target = this.editing?.selectedPoint ?? null;
    if (!element || target == null) {
      return;
    }
    const loop = this.editing?.loop ?? 0;
    const next = deletePathPoint(getPathLoopView(element, loop), target);
    if (!next) {
      return;
    }
    this.context.apply(element, next);
    this.context.setEditing(element.id, null, loop);
    this.context.commit();
  };

  /** the anchor-point switch (Shift+C): corner <-> smooth */
  private toggleSelectedPointMode = (selectedPoint: number) => {
    const element = this.context.getEditedElement();
    if (!element) {
      return;
    }
    const view = getPathLoopView(element, this.editing?.loop ?? 0);
    this.setPointMode(
      toggledMode(view.handles[selectedPoint]?.mode),
      selectedPoint,
    );
  };

  /** @returns true when the key was consumed */
  handleKeyDown = (event: KeyboardEvent | React.KeyboardEvent): boolean => {
    const editing = this.editing;
    if (!editing) {
      return false;
    }
    if (event.key === KEYS.ESCAPE || event.key === KEYS.ENTER) {
      this.stopEditing();
      return true;
    }
    if (editing.selectedPoint == null) {
      return false;
    }
    const isDeleteKey =
      event.key === KEYS.DELETE ||
      event.key === KEYS.BACKSPACE ||
      // the delete-anchor-point key
      event.key === "-";
    if (isDeleteKey) {
      this.deleteSelectedPoint();
      return true;
    }
    if (
      event.shiftKey &&
      event.key.toLowerCase() === "c" &&
      !event[KEYS.CTRL_OR_CMD]
    ) {
      this.toggleSelectedPointMode(editing.selectedPoint);
      return true;
    }
    return false;
  };
}
