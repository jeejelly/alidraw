import { KEYS } from "@excalidraw/common";
import { pointFrom, type LocalPoint } from "@excalidraw/math";
import {
  NO_HANDLES,
  applyMirror,
  type MirrorLine,
  centerMirrorLine,
  findMirrorPairs,
  deletePathPoint,
  dragPathHandle,
  getClosestPathLoopSegment,
  getPathLoopView,
  getPathUpdate,
  insertPathPoint,
  movePathPoints,
  newPathElement,
  setPathClosed,
  setPathPointMode,
  splitPathAt,
} from "@excalidraw/element";

import type { PathGeometry } from "@excalidraw/element";
import type {
  ExcalidrawPathElement,
  PathPointMode,
} from "@excalidraw/element/types";

import type React from "react";

import type { AppState } from "../../types";

import type {
  PathContext,
  PathGesture,
  PathMirror,
  ScenePoint,
} from "./context";

/** radius of an anchor/handle hit area, in screen px */
const HIT_RADIUS = 9;

type PointHit = { loop: number; index: number; side?: "in" | "out" };

type GuideModifiers = { ctrlKey: boolean; metaKey: boolean };

/** the selected points of the outline being edited */
const selectionOf = (
  editing: NonNullable<AppState["editingPath"]> | null,
): number[] =>
  editing?.selectedPoints ??
  (editing?.selectedPoint != null ? [editing.selectedPoint] : []);

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

  /**
   * The line is kept relative to the scene (not to the path's own origin,
   * which moves when the bounds change); this is it in the path's local space.
   */
  private localMirror = (element: ExcalidrawPathElement): MirrorLine | null => {
    const line = this.editing?.mirror;
    return line
      ? {
          axis: line.axis,
          at: line.at - (line.axis === "x" ? element.x : element.y),
        }
      : null;
  };

  /** the mirror line with the sibling of each point, as the outline is now */
  private mirrorOf = (
    element: ExcalidrawPathElement,
    loop: number,
  ): PathMirror | undefined => {
    const line = this.localMirror(element);
    return line
      ? {
          line,
          pairs: findMirrorPairs(getPathLoopView(element, loop).points, line),
        }
      : undefined;
  };

  /** adds the mirror line across the middle of the outline, or removes it */
  toggleMirror = (axis: "x" | "y") => {
    const element = this.context.getEditedElement();
    if (!element) {
      return;
    }
    if (this.editing?.mirror?.axis === axis) {
      this.context.setMirror(null);
      return;
    }
    const centered = centerMirrorLine(
      getPathLoopView(element, this.editing?.loop ?? 0).points,
      axis,
    );
    this.context.setMirror({
      axis,
      at: centered.at + (axis === "x" ? element.x : element.y),
    });
  };

  private isOnMirrorLine = (
    element: ExcalidrawPathElement,
    pointer: ScenePoint,
    hitRadius: number,
  ) => {
    const line = this.localMirror(element);
    if (!line) {
      return false;
    }
    const local = this.context.toLocal(element, pointer);
    return Math.abs(local[line.axis === "x" ? 0 : 1] - line.at) <= hitRadius;
  };

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
        mirror: this.mirrorOf(element, hit.loop),
      };
      this.context.listen();
      return true;
    }
    if (hit) {
      this.pressAnchor(element, pointer, hit, {
        togglesMode: isDouble || event.altKey,
        additive: event.shiftKey,
      });
      return true;
    }
    if (this.isOnMirrorLine(element, pointer, hitRadius)) {
      this.context.gesture = { kind: "mirror-line", original: element };
      this.context.listen();
      return true;
    }
    if (this.insertOnOutline(element, pointer, hitRadius, isDouble)) {
      return true;
    }
    if (event.shiftKey) {
      this.context.gesture = {
        kind: "marquee",
        loop: this.editing?.loop ?? 0,
        start: pointer,
        base: selectionOf(this.editing),
      };
      this.context.listen();
      return true;
    }
    // anywhere else leaves the editor and lets the click select as usual
    this.stopEditing();
    return false;
  };

  /**
   * A press on an anchor selects and drags it (with the rest of its
   * selection); Shift adds or removes it; a double click or Alt toggles its mode.
   */
  private pressAnchor = (
    element: ExcalidrawPathElement,
    pointer: ScenePoint,
    hit: PointHit,
    { togglesMode, additive }: { togglesMode: boolean; additive: boolean },
  ) => {
    const view = getPathLoopView(element, hit.loop);
    const sameLoop = (this.editing?.loop ?? 0) === hit.loop;
    const current = sameLoop ? selectionOf(this.editing) : [];
    if (additive) {
      const next = current.includes(hit.index)
        ? current.filter((index) => index !== hit.index)
        : [...current, hit.index];
      this.context.selectPoints(next, next.at(-1) ?? null, hit.loop);
      return;
    }
    const keepsSelection = current.length > 1 && current.includes(hit.index);
    if (keepsSelection && !togglesMode) {
      this.context.selectPoints(current, hit.index, hit.loop);
    } else {
      this.context.setEditing(element.id, hit.index, hit.loop);
    }
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
      indexes: keepsSelection ? current : [hit.index],
      mirror: this.mirrorOf(element, hit.loop),
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
    if (gesture.kind === "marquee") {
      this.dragMarquee(gesture, pointer);
      return;
    }
    if (gesture.kind === "mirror-line") {
      this.dragMirrorLine(gesture.original, pointer);
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
      const from = view.points[index];
      const moved = movePathPoints(view, gesture.indexes, [
        target[0] - from[0],
        target[1] - from[1],
      ]);
      this.context.apply(
        original,
        gesture.mirror
          ? applyMirror(
              moved,
              gesture.mirror.line,
              gesture.mirror.pairs,
              // the point under the pointer wins over a selected sibling
              [...gesture.indexes.filter((other) => other !== index), index],
            )
          : moved,
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
    const dragged = {
      points: view.points,
      handles: view.handles.map((handles, handlesIndex) =>
        handlesIndex === index
          ? dragPathHandle(current, gesture.side, offset)
          : handles,
      ),
    };
    this.context.apply(
      original,
      gesture.mirror
        ? applyMirror(dragged, gesture.mirror.line, gesture.mirror.pairs, [
            index,
          ])
        : dragged,
      undefined,
      loop,
    );
  };

  private dragMirrorLine = (
    element: ExcalidrawPathElement,
    pointer: ScenePoint,
  ) => {
    const line = this.editing?.mirror;
    if (line) {
      const local = this.context.toLocal(element, pointer);
      this.context.setMirror({
        ...line,
        at: line.axis === "x" ? element.x + local[0] : element.y + local[1],
      });
    }
  };

  private dragMarquee = (
    gesture: Extract<PathGesture, { kind: "marquee" }>,
    pointer: ScenePoint,
  ) => {
    const element = this.context.getEditedElement();
    if (!element) {
      return;
    }
    const x1 = Math.min(gesture.start.x, pointer.x);
    const x2 = Math.max(gesture.start.x, pointer.x);
    const y1 = Math.min(gesture.start.y, pointer.y);
    const y2 = Math.max(gesture.start.y, pointer.y);
    const inside = getPathLoopView(element, gesture.loop)
      .points.map((point, index) => ({
        index,
        scene: this.context.toScene(element, point),
      }))
      .filter(
        ({ scene }) =>
          scene[0] >= x1 && scene[0] <= x2 && scene[1] >= y1 && scene[1] <= y2,
      )
      .map(({ index }) => index);
    const indexes = [...new Set([...gesture.base, ...inside])];
    this.context.selectPoints(indexes, indexes.at(-1) ?? null, gesture.loop);
    this.context.setMarquee({ x1, y1, x2, y2 });
  };

  /** the box is dropped, the points it caught stay selected */
  finishMarquee = () => this.context.setMarquee(null);

  selectAllPoints = () => {
    const element = this.context.getEditedElement();
    if (!element) {
      return;
    }
    const loop = this.editing?.loop ?? 0;
    const indexes = getPathLoopView(element, loop).points.map(
      (_, index) => index,
    );
    this.context.selectPoints(indexes, indexes.at(-1) ?? null, loop);
  };

  /** sets the mode of one point, else of every selected point */
  setPointMode = (mode: PathPointMode, index?: number) => {
    const element = this.context.getEditedElement();
    const targets = index != null ? [index] : selectionOf(this.editing);
    if (!element || !targets.length) {
      return;
    }
    const loop = this.editing?.loop ?? 0;
    let geometry: PathGeometry = getPathLoopView(element, loop);
    for (const target of targets) {
      geometry = setPathPointMode(
        { ...getPathLoopView(element, loop), ...geometry },
        target,
        mode,
      );
    }
    this.context.apply(element, geometry);
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

  /** deletes the selected points, highest index first so the others keep theirs */
  deleteSelectedPoint = () => {
    const element = this.context.getEditedElement();
    const targets = [...selectionOf(this.editing)].sort(
      (left, right) => right - left,
    );
    if (!element || !targets.length) {
      return;
    }
    const loop = this.editing?.loop ?? 0;
    let geometry: PathGeometry | null = null;
    for (const target of targets) {
      const next = deletePathPoint(
        { ...getPathLoopView(element, loop), ...geometry },
        target,
      );
      if (!next) {
        break;
      }
      geometry = next;
    }
    if (!geometry) {
      return;
    }
    this.context.apply(element, geometry);
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
    if (event[KEYS.CTRL_OR_CMD] && event.key.toLowerCase() === KEYS.A) {
      this.selectAllPoints();
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
