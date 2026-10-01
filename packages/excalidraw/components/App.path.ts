import { EVENT, KEYS } from "@excalidraw/common";
import {
  pointFrom,
  pointRotateRads,
  type GlobalPoint,
  type LocalPoint,
} from "@excalidraw/math";
import {
  NO_HANDLES,
  deletePathPoint,
  dragPathHandle,
  getClosestPathLoopSegment,
  getPathLoopView,
  withPathLoopGeometry,
  getElementAbsoluteCoords,
  getPathUpdate,
  insertPathPoint,
  isPathElement,
  movePathPoint,
  newPathElement,
  setPathBevel,
  setPathClosed,
  setPathPointMode,
  splitPathAt,
} from "@excalidraw/element";

import { viewportCoordsToSceneCoords } from "@excalidraw/common";

import type {
  ExcalidrawPathElement,
  PathPointHandles,
  PathPointMode,
} from "@excalidraw/element/types";

import { getGuideSnap } from "../guides";

import type React from "react";

import type App from "./App";

/** radius of an anchor/handle hit area, in screen px */
const HIT_RADIUS = 9;
/** a click this close to the first point closes the path, in screen px */
const CLOSE_RADIUS = 10;
/** a pen drag shorter than this leaves a corner point, in screen px */
const MIN_HANDLE_DRAG = 4;
const DOUBLE_CLICK_MS = 400;

type Pt = { x: number; y: number };

type Gesture =
  | {
      kind: "anchor";
      loop: number;
      index: number;
      orig: ExcalidrawPathElement;
      /** anchor position minus pointer, local to `orig` */
      grab: [number, number];
    }
  | {
      kind: "handle";
      loop: number;
      index: number;
      side: "in" | "out";
      orig: ExcalidrawPathElement;
    }
  | { kind: "pen-handle"; index: number };

/**
 * The path tool (pen) and the point editor of a selected path.
 *
 * While creating, the last point of the path is a "floating" one that
 * follows the cursor, so the next segment is previewed by the normal renderer.
 */
export class AppPath {
  /** the path being drawn with the pen tool */
  private creating: { id: string; committed: number } | null = null;
  private gesture: Gesture | null = null;
  private lastClick: { x: number; y: number; time: number } | null = null;
  private teardown: (() => void) | null = null;

  constructor(private app: App) {}

  isCreating = () => this.creating !== null;

  getEditedElement = (): ExcalidrawPathElement | null => {
    const editing = this.app.state.editingPath;
    if (!editing) {
      return null;
    }
    const element = this.app.scene.getNonDeletedElement(editing.elementId);
    return isPathElement(element) ? element : null;
  };

  // ---------------------------------------------------------------------------
  // coordinates
  // ---------------------------------------------------------------------------

  private center = (element: ExcalidrawPathElement) => {
    const [, , , , cx, cy] = getElementAbsoluteCoords(
      element,
      this.app.scene.getNonDeletedElementsMap(),
    );
    return pointFrom<GlobalPoint>(cx, cy);
  };

  private toScene = (element: ExcalidrawPathElement, p: LocalPoint) =>
    pointRotateRads(
      pointFrom<GlobalPoint>(element.x + p[0], element.y + p[1]),
      this.center(element),
      element.angle,
    );

  private toLocal = (element: ExcalidrawPathElement, p: Pt): LocalPoint => {
    const r = pointRotateRads(
      pointFrom<GlobalPoint>(p.x, p.y),
      this.center(element),
      -element.angle as any,
    );
    return pointFrom<LocalPoint>(r[0] - element.x, r[1] - element.y);
  };

  private scenePointer = (event: { clientX: number; clientY: number }) =>
    viewportCoordsToSceneCoords(event, this.app.state);

  /** the magnet: a scene point pulled onto a nearby guide (Ctrl/Cmd skips) */
  private snapToGuides = (
    p: Pt,
    event: { ctrlKey: boolean; metaKey: boolean },
  ): Pt => {
    const { guides, guidesSnapEnabled, zoom } = this.app.state;
    if (
      !guides.length ||
      !guidesSnapEnabled ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return p;
    }
    const snap = getGuideSnap([[p.x, p.y]], guides, zoom.value);
    return { x: p.x + snap.x, y: p.y + snap.y };
  };

  // ---------------------------------------------------------------------------
  // element updates
  // ---------------------------------------------------------------------------

  private apply = (
    element: ExcalidrawPathElement,
    geometry: {
      points: readonly LocalPoint[];
      handles: readonly PathPointHandles[];
    },
    closed?: boolean,
    loop = this.app.state.editingPath?.loop ?? 0,
  ) => {
    const current = this.app.scene.getElement(
      element.id,
    ) as ExcalidrawPathElement | null;
    if (!current) {
      return;
    }
    this.app.scene.mutateElement(current, {
      ...getPathUpdate(
        { ...element, closed: closed ?? element.closed },
        withPathLoopGeometry(element, loop, geometry),
      ),
      ...(closed !== undefined ? { closed } : {}),
    });
  };

  /** makes everything changed since the last commit one undo step */
  private commit = () => {
    this.app.store.scheduleCapture();
    this.app.setState({});
  };

  private setEditing = (
    elementId: string | null,
    selectedPoint: number | null = null,
    loop = 0,
  ) => {
    this.app.setState({
      editingPath: elementId ? { elementId, selectedPoint, loop } : null,
    });
  };

  // ---------------------------------------------------------------------------
  // pen tool
  // ---------------------------------------------------------------------------

  private startCreating = (p: Pt) => {
    const style = this.app.getPathElementStyle();
    const element = newPathElement({
      x: p.x,
      y: p.y,
      ...style,
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
  private penPointerDown = (p: Pt, event: React.PointerEvent<HTMLElement>) => {
    const zoom = this.app.state.zoom.value;
    let element: ExcalidrawPathElement;
    let index: number;

    if (!this.creating) {
      element = this.startCreating(p);
      index = 0;
    } else {
      const found = this.app.scene.getNonDeletedElement(this.creating.id);
      if (!isPathElement(found)) {
        this.creating = null;
        return false;
      }
      element = found;
      const local = this.toLocal(element, p);
      const { committed } = this.creating;

      // double click: the second click only ends the path
      const last = this.lastClick;
      if (
        last &&
        event.timeStamp - last.time < DOUBLE_CLICK_MS &&
        Math.hypot(last.x - p.x, last.y - p.y) < CLOSE_RADIUS / zoom
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
      this.apply(element, { points, handles });
      index = committed;
      this.creating = { id: element.id, committed: committed + 1 };
    }

    this.lastClick = { x: p.x, y: p.y, time: event.timeStamp };
    this.gesture = { kind: "pen-handle", index };
    this.listen();
    return true;
  };

  private penPointerMove = (p: Pt) => {
    if (!this.creating) {
      return;
    }
    const element = this.app.scene.getNonDeletedElement(this.creating.id);
    if (!isPathElement(element)) {
      return;
    }
    const local = this.toLocal(element, p);
    const { committed } = this.creating;

    if (this.gesture?.kind === "pen-handle") {
      const i = this.gesture.index;
      const anchor = element.points[i];
      const out = pointFrom<LocalPoint>(
        local[0] - anchor[0],
        local[1] - anchor[1],
      );
      const dragged =
        Math.hypot(out[0], out[1]) * this.app.state.zoom.value >=
        MIN_HANDLE_DRAG;
      const handles = element.handles.map((h, k) =>
        k === i
          ? dragged
            ? {
                mode: "smooth" as PathPointMode,
                out,
                in: pointFrom<LocalPoint>(-out[0], -out[1]),
              }
            : NO_HANDLES
          : h,
      );
      this.apply(element, { points: element.points, handles });
      return;
    }

    // the floating point follows the cursor
    const points = element.points.map((pt, k) =>
      k === committed ? local : pt,
    );
    this.apply(element, { points, handles: element.handles });
  };

  /** ends the path being drawn: drops the floating point, selects the path */
  finishCreating = (close = false) => {
    if (!this.creating) {
      return;
    }
    const { id, committed } = this.creating;
    this.creating = null;
    this.gesture = null;
    this.unlisten();

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
      ) < 1
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
      this.apply(element, closing, true);
    } else {
      this.apply(element, { points, handles }, false);
    }
    this.app.setState({ selectedElementIds: { [id]: true } });
    if (!this.app.state.activeTool.locked) {
      this.app.setActiveTool({ type: "selection" }, { keepSelection: true });
    }
    this.commit();
  };

  // ---------------------------------------------------------------------------
  // point editor
  // ---------------------------------------------------------------------------

  startEditing = (element: ExcalidrawPathElement) => {
    this.setEditing(element.id, null);
  };

  stopEditing = () => {
    if (this.app.state.editingPath) {
      this.setEditing(null);
    }
  };

  private hitPoint = (
    element: ExcalidrawPathElement,
    p: Pt,
  ):
    | { loop: number; index: number }
    | { loop: number; index: number; side: "in" | "out" }
    | null => {
    const r = HIT_RADIUS / this.app.state.zoom.value;
    const editing = this.app.state.editingPath;
    const selected = editing?.selectedPoint ?? null;
    const activeLoop = editing?.loop ?? 0;
    const active = getPathLoopView(element, activeLoop);

    // handles of the selected point come first: they sit on top
    if (
      selected != null &&
      active.handles[selected]?.mode !== "corner" &&
      active.handles[selected]
    ) {
      for (const side of ["out", "in"] as const) {
        const h = active.handles[selected][side];
        if (h) {
          const s = this.toScene(
            element,
            pointFrom<LocalPoint>(
              active.points[selected][0] + h[0],
              active.points[selected][1] + h[1],
            ),
          );
          if (Math.hypot(s[0] - p.x, s[1] - p.y) <= r) {
            return { loop: activeLoop, index: selected, side };
          }
        }
      }
    }
    // the main outline is on top of the holes
    const loops = 1 + (element.contours?.length ?? 0);
    for (let loop = 0; loop < loops; loop++) {
      const view = getPathLoopView(element, loop);
      for (let i = view.points.length - 1; i >= 0; i--) {
        const s = this.toScene(element, view.points[i]);
        if (Math.hypot(s[0] - p.x, s[1] - p.y) <= r) {
          return { loop, index: i };
        }
      }
    }
    return null;
  };

  /**
   * @returns true when the pointer was consumed by the point editor; false
   * leaves it to the regular selection code
   */
  private editPointerDown = (
    element: ExcalidrawPathElement,
    p: Pt,
    event: React.PointerEvent<HTMLElement>,
  ) => {
    const zoom = this.app.state.zoom.value;
    const hit = this.hitPoint(element, p);
    const last = this.lastClick;
    const isDouble =
      !!last &&
      event.timeStamp - last.time < DOUBLE_CLICK_MS &&
      Math.hypot(last.x - p.x, last.y - p.y) < HIT_RADIUS / zoom;
    this.lastClick = { x: p.x, y: p.y, time: event.timeStamp };

    if (hit && "side" in hit) {
      this.gesture = {
        kind: "handle",
        loop: hit.loop,
        index: hit.index,
        side: hit.side,
        orig: element,
      };
      this.listen();
      return true;
    }

    if (hit) {
      if (isDouble || event.altKey) {
        // double click or alt+click toggles corner <-> smooth
        const mode: PathPointMode =
          getPathLoopView(element, hit.loop).handles[hit.index]?.mode ===
          "corner"
            ? "smooth"
            : "corner";
        this.setEditing(element.id, hit.index, hit.loop);
        this.setPointMode(mode, hit.index);
        this.lastClick = null;
        return true;
      }
      this.setEditing(element.id, hit.index, hit.loop);
      const a = getPathLoopView(element, hit.loop).points[hit.index];
      const local = this.toLocal(element, p);
      this.gesture = {
        kind: "anchor",
        loop: hit.loop,
        index: hit.index,
        orig: element,
        grab: [a[0] - local[0], a[1] - local[1]],
      };
      this.listen();
      return true;
    }

    // double click on the outline inserts a point
    const local = this.toLocal(element, p);
    const closest = getClosestPathLoopSegment(element, local);
    if (closest && closest.distance <= HIT_RADIUS / zoom) {
      if (isDouble) {
        const inserted = insertPathPoint(
          getPathLoopView(element, closest.loop),
          closest.segmentIndex,
          closest.t,
        );
        if (inserted) {
          this.apply(element, inserted, undefined, closest.loop);
          this.setEditing(element.id, inserted.index, closest.loop);
          this.commit();
          this.lastClick = null;
        }
      }
      return true;
    }

    // anywhere else leaves the editor and lets the click select as usual
    this.stopEditing();
    return false;
  };

  private editPointerMove = (
    p: Pt,
    event: { ctrlKey: boolean; metaKey: boolean },
  ) => {
    const g = this.gesture;
    if (!g || g.kind === "pen-handle") {
      return;
    }
    const local = this.toLocal(g.orig, p);
    const view = getPathLoopView(g.orig, g.loop);
    if (g.kind === "anchor") {
      let to = pointFrom<LocalPoint>(
        local[0] + g.grab[0],
        local[1] + g.grab[1],
      );
      // the anchor, not the pointer, is pulled onto a guide
      const anchor = this.toScene(g.orig, to);
      const snapped = this.snapToGuides({ x: anchor[0], y: anchor[1] }, event);
      if (snapped.x !== anchor[0] || snapped.y !== anchor[1]) {
        to = this.toLocal(g.orig, snapped);
      }
      this.apply(g.orig, movePathPoint(view, g.index, to), undefined, g.loop);
    } else {
      const anchor = view.points[g.index];
      const offset = pointFrom<LocalPoint>(
        local[0] - anchor[0],
        local[1] - anchor[1],
      );
      const current = view.handles[g.index] ?? NO_HANDLES;
      this.apply(
        g.orig,
        {
          points: view.points,
          handles: view.handles.map((h, i) =>
            i === g.index ? dragPathHandle(current, g.side, offset) : h,
          ),
        },
        undefined,
        g.loop,
      );
    }
  };

  setPointMode = (mode: PathPointMode, index?: number) => {
    const element = this.getEditedElement();
    const target = index ?? this.app.state.editingPath?.selectedPoint ?? null;
    if (!element || target == null) {
      return;
    }
    const loop = this.app.state.editingPath?.loop ?? 0;
    this.apply(
      element,
      setPathPointMode(getPathLoopView(element, loop), target, mode),
    );
    this.commit();
  };

  /** the paths a bevel applies to: the one being edited, else the selected */
  private bevelTargets = () => {
    const editing = this.getEditedElement();
    return editing
      ? [editing]
      : this.app.scene
          .getSelectedElements(this.app.state)
          .filter(isPathElement);
  };

  /** the bevel radius of the selected anchor, or the one shared by all */
  getBevel = (scope: "point" | "all"): number | null => {
    const radii = new Set<number>();
    const editing = this.app.state.editingPath;
    for (const el of this.bevelTargets()) {
      if (scope === "point") {
        const sel = editing?.selectedPoint;
        if (sel == null) {
          return null;
        }
        radii.add(
          getPathLoopView(el, editing?.loop ?? 0).handles[sel]?.radius ?? 0,
        );
      } else {
        for (const loop of [el, ...(el.contours ?? [])]) {
          loop.handles.forEach((h) => radii.add(h.radius ?? 0));
        }
      }
    }
    return radii.size === 1 ? [...radii][0] : null;
  };

  /**
   * Rounds straight corners: one anchor (while editing) or every anchor of the
   * path(s). The anchors stay put; the drawn outline is rounded.
   */
  setBevel = (radius: number, scope: "point" | "all") => {
    const editing = this.app.state.editingPath;
    for (const el of this.bevelTargets()) {
      if (scope === "point") {
        const sel = editing?.selectedPoint;
        if (sel == null) {
          continue;
        }
        const loop = editing?.loop ?? 0;
        this.apply(
          el,
          setPathBevel(getPathLoopView(el, loop), radius, [sel]),
          undefined,
          loop,
        );
      } else {
        this.app.scene.mutateElement(
          el,
          getPathUpdate(el, {
            ...setPathBevel(el, radius),
            contours: el.contours?.map((c) => setPathBevel(c, radius)),
          }),
        );
      }
    }
    this.commit();
  };

  /** one anchor's bevel (or all with `null`) of a given path, editing or not */
  setBevelOf = (elementId: string, index: number | null, radius: number) => {
    const el = this.app.scene.getNonDeletedElement(elementId);
    if (!el || !isPathElement(el)) {
      return;
    }
    this.app.scene.mutateElement(
      el,
      getPathUpdate(el, {
        ...setPathBevel(el, radius, index === null ? undefined : [index]),
        contours:
          index === null
            ? el.contours?.map((c) => setPathBevel(c, radius))
            : el.contours,
      }),
    );
    this.commit();
  };

  /** closes an open path / opens a closed one */
  toggleClosed = () => {
    const element = this.getEditedElement();
    if (!element || element.contours?.length) {
      // a shape with holes stays closed
      return;
    }
    const next = setPathClosed(element, !element.closed);
    if (!next) {
      return;
    }
    this.apply(element, next, next.closed);
    this.setEditing(element.id, null);
    this.commit();
  };

  /** cuts the path at the selected point */
  splitAtSelectedPoint = () => {
    const element = this.getEditedElement();
    const target = this.app.state.editingPath?.selectedPoint ?? null;
    if (!element || target == null) {
      return;
    }
    if ((this.app.state.editingPath?.loop ?? 0) > 0) {
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
    this.apply(element, first, false);
    if (created.length) {
      this.app.insertNewElements(created);
    }
    this.setEditing(element.id, null);
    this.commit();
  };

  deleteSelectedPoint = () => {
    const element = this.getEditedElement();
    const target = this.app.state.editingPath?.selectedPoint ?? null;
    if (!element || target == null) {
      return;
    }
    const loop = this.app.state.editingPath?.loop ?? 0;
    const next = deletePathPoint(getPathLoopView(element, loop), target);
    if (!next) {
      return;
    }
    this.apply(element, next);
    this.setEditing(element.id, null, loop);
    this.commit();
  };

  // ---------------------------------------------------------------------------
  // App hooks
  // ---------------------------------------------------------------------------

  /** @returns true when the pointer down was consumed */
  handlePointerDown = (event: React.PointerEvent<HTMLElement>): boolean => {
    if (event.button !== 0) {
      return false;
    }
    const p = this.snapToGuides(this.scenePointer(event), event);
    if (this.app.state.activeTool.type === "path") {
      return this.penPointerDown(p, event);
    }
    const element = this.getEditedElement();
    if (element) {
      return this.editPointerDown(element, p, event);
    }
    return false;
  };

  /** @returns true when the double click was consumed */
  handleDoubleClick = (): boolean => {
    if (this.creating || this.app.state.editingPath) {
      return true;
    }
    const selected = this.app.scene.getSelectedElements(this.app.state);
    if (selected.length === 1 && isPathElement(selected[0])) {
      this.startEditing(selected[0]);
      return true;
    }
    return false;
  };

  /** @returns true when the key was consumed */
  handleKeyDown = (event: KeyboardEvent | React.KeyboardEvent): boolean => {
    if (this.creating) {
      if (event.key === KEYS.ENTER || event.key === KEYS.ESCAPE) {
        this.finishCreating();
        return true;
      }
      if (event.key === KEYS.BACKSPACE || event.key === KEYS.DELETE) {
        this.removeLastCommittedPoint();
        return true;
      }
      return false;
    }
    if (this.app.state.editingPath) {
      if (event.key === KEYS.ESCAPE || event.key === KEYS.ENTER) {
        this.stopEditing();
        return true;
      }
      if (
        (event.key === KEYS.DELETE ||
          event.key === KEYS.BACKSPACE ||
          // Illustrator's delete-anchor-point key
          event.key === "-") &&
        this.app.state.editingPath.selectedPoint != null
      ) {
        this.deleteSelectedPoint();
        return true;
      }
      // Illustrator's Anchor Point tool (Shift+C): corner <-> smooth
      if (
        event.shiftKey &&
        event.key.toLowerCase() === "c" &&
        !event[KEYS.CTRL_OR_CMD] &&
        this.app.state.editingPath.selectedPoint != null
      ) {
        const element = this.getEditedElement();
        const index = this.app.state.editingPath.selectedPoint;
        if (element) {
          const view = getPathLoopView(
            element,
            this.app.state.editingPath.loop ?? 0,
          );
          this.setPointMode(
            view.handles[index]?.mode === "corner" ? "smooth" : "corner",
            index,
          );
        }
        return true;
      }
    }
    return false;
  };

  private removeLastCommittedPoint = () => {
    if (!this.creating) {
      return;
    }
    const element = this.app.scene.getNonDeletedElement(this.creating.id);
    if (!isPathElement(element)) {
      return;
    }
    if (this.creating.committed <= 1) {
      this.cancelCreating();
      return;
    }
    const committed = this.creating.committed - 1;
    this.creating = { id: element.id, committed };
    // the floating point takes the place of the dropped one
    this.apply(element, {
      points: element.points.slice(0, committed + 1),
      handles: element.handles
        .slice(0, committed + 1)
        .map((h, i) => (i === committed ? NO_HANDLES : h)),
    });
  };

  cancelCreating = () => {
    if (!this.creating) {
      return;
    }
    const element = this.app.scene.getNonDeletedElement(this.creating.id);
    this.creating = null;
    this.gesture = null;
    this.unlisten();
    if (element) {
      this.app.scene.mutateElement(element as ExcalidrawPathElement, {
        isDeleted: true,
      });
    }
  };

  // ---------------------------------------------------------------------------
  // window listeners: a gesture owns the pointer until release, and the pen
  // tool tracks the cursor between clicks
  // ---------------------------------------------------------------------------

  private listen = () => {
    if (this.teardown) {
      return;
    }
    const win = this.app.ownerWindow;
    const onMove = (event: PointerEvent) => {
      const p = this.scenePointer(event);
      if (this.creating) {
        this.penPointerMove(this.snapToGuides(p, event));
      } else {
        this.editPointerMove(p, event);
      }
    };
    const onUp = () => {
      const wasEditing = this.gesture && this.gesture.kind !== "pen-handle";
      this.gesture = null;
      if (wasEditing) {
        this.commit();
        this.unlisten();
      }
      // pen: keep tracking the cursor until the path is finished
    };
    win.addEventListener(EVENT.POINTER_MOVE, onMove);
    win.addEventListener(EVENT.POINTER_UP, onUp);
    this.teardown = () => {
      win.removeEventListener(EVENT.POINTER_MOVE, onMove);
      win.removeEventListener(EVENT.POINTER_UP, onUp);
    };
  };

  private unlisten = () => {
    this.teardown?.();
    this.teardown = null;
  };

  /** the tool changed or the scene was replaced: nothing half-drawn is kept */
  reset = () => {
    if (this.creating) {
      this.finishCreating();
    }
    this.gesture = null;
    this.unlisten();
  };
}
