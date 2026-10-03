import { KEYS, viewportCoordsToSceneCoords } from "@excalidraw/common";
import {
  getCommonBounds,
  getElementWithTransformHandleType,
  getTransformHandleTypeFromCoords,
} from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import {
  getGizmoTarget,
  getGizmoZone,
  gizmoToLocal,
  sameZone,
  type GizmoTarget,
  type GizmoZone,
} from "../gizmo";

import { listenToGesture, onEscape } from "./gestureListeners";
import { getGizmoCursor } from "./appGizmo/cursors";
import { GizmoOverlay } from "./appGizmo/overlay";
import { GizmoRotation } from "./appGizmo/rotation";
import { GizmoSkew } from "./appGizmo/skew";

import type { GizmoGesture, ScenePoint } from "./appGizmo/types";
import type App from "./App";

/** a release closer than this (screen px) to the press is a plain click */
const CLICK_SLOP = 3;

/** The rotate / skew gizmo (zones in `gizmo.ts`): owns the pointer from press to release; Shift steps, Alt centres, Escape cancels. */
export class AppGizmo {
  private gesture: GizmoGesture | null = null;
  private teardown: (() => void) | null = null;
  private pressedAt: { x: number; y: number } | null = null;
  private moved = false;
  private overlay: GizmoOverlay;
  private rotation: GizmoRotation;
  private skew: GizmoSkew;

  constructor(private app: App) {
    this.overlay = new GizmoOverlay(app);
    this.rotation = new GizmoRotation(app, this.overlay);
    this.skew = new GizmoSkew(app, this.overlay);
  }

  isActive = () => this.gesture !== null;

  private target = (): GizmoTarget | null => {
    const state = this.app.state;
    if (
      state.activeTool.type !== "selection" ||
      state.viewModeEnabled ||
      state.editingPath ||
      state.editingTextElement ||
      state.croppingElementId ||
      state.selectedLinearElement?.isEditing ||
      state.newElement
    ) {
      return null;
    }
    return getGizmoTarget(
      this.app.scene.getSelectedElements(state),
      this.app.scene.getNonDeletedElementsMap(),
    );
  };

  private zoneAt = (event: { clientX: number; clientY: number }) => {
    const target = this.target();
    if (!target) {
      return null;
    }
    const point = viewportCoordsToSceneCoords(event, this.app.state);
    const { hw, hh, cx, cy, angle } = target.frame;
    const [localX, localY] = gizmoToLocal(point.x, point.y, cx, cy, angle);
    const zone = getGizmoZone(
      localX,
      localY,
      hw,
      hh,
      this.app.state.zoom.value,
      target.skewable,
    );
    return zone ? { zone, target } : null;
  };

  /** @returns true when the pointer is over a zone (the cursor is ours) */
  handleHover = (event: { clientX: number; clientY: number }): boolean => {
    if (this.gesture) {
      return true;
    }
    const hit = this.zoneAt(event);
    const previous = this.app.state.gizmo?.hover ?? null;
    if (!sameZone(previous, hit?.zone ?? null)) {
      this.overlay.set({ hover: hit?.zone ?? null });
    }
    if (!hit) {
      return false;
    }
    this.app.cursor.set(getGizmoCursor(hit.zone, hit.target.frame.angle));
    return true;
  };

  /** whether one of the regular transform handles sits under the pointer */
  private isOnTransformHandle = (
    target: GizmoTarget,
    point: ScenePoint,
    event: React.PointerEvent<HTMLElement>,
  ) => {
    const state = this.app.state;
    // a single element's own handles, or the handles of the group's common box
    const elements = target.elements as NonDeletedExcalidrawElement[];
    const handle =
      elements.length === 1
        ? getElementWithTransformHandleType(
            elements,
            state,
            point.x,
            point.y,
            state.zoom,
            event.pointerType as any,
            this.app.scene.getNonDeletedElementsMap(),
            this.app.editorInterface,
          )?.transformHandleType
        : getTransformHandleTypeFromCoords(
            getCommonBounds(elements),
            point.x,
            point.y,
            state.zoom,
            event.pointerType as any,
            this.app.editorInterface,
          );
    return !!handle;
  };

  /** @returns true when a zone was grabbed */
  handlePointerDown = (event: React.PointerEvent<HTMLElement>): boolean => {
    // Shift adds to the selection and Ctrl/Cmd deep-selects: not ours
    if (event.button !== 0 || event.shiftKey || event[KEYS.CTRL_OR_CMD]) {
      return false;
    }
    const hit = this.zoneAt(event);
    if (!hit) {
      return false;
    }
    const point = viewportCoordsToSceneCoords(event, this.app.state);
    // the regular handles win where they overlap
    if (this.isOnTransformHandle(hit.target, point, event)) {
      return false;
    }
    // another shape under the pointer is simply clicked
    const under = this.app.getElementAtPosition(point.x, point.y);
    if (
      under &&
      !hit.target.elements.some((element) => element.id === under.id)
    ) {
      return false;
    }
    this.pressedAt = { x: event.clientX, y: event.clientY };
    return this.begin(hit.zone, hit.target, point);
  };

  private begin = (zone: GizmoZone, target: GizmoTarget, point: ScenePoint) => {
    const gesture =
      zone.kind === "rotate"
        ? this.rotation.begin(target, point)
        : this.skew.begin(zone, target, point);
    if (!gesture) {
      return false;
    }
    this.gesture = gesture;
    this.listen();
    if (gesture.kind === "rotate") {
      this.rotation.startKeyHelper();
    }
    return true;
  };

  private move = (event: PointerEvent) => {
    const gesture = this.gesture;
    if (!gesture) {
      return;
    }
    const point = viewportCoordsToSceneCoords(event, this.app.state);
    if (
      this.pressedAt &&
      Math.hypot(
        event.clientX - this.pressedAt.x,
        event.clientY - this.pressedAt.y,
      ) < CLICK_SLOP
    ) {
      return;
    }
    this.moved = true;
    if (gesture.kind === "rotate") {
      this.rotation.move(gesture, event, point);
    } else if (gesture.kind === "skew") {
      this.skew.move(gesture, event, point);
    } else {
      this.skew.moveGroup(gesture, event, point);
    }
  };

  private finish = (cancel: boolean) => {
    const gesture = this.gesture;
    this.gesture = null;
    this.teardown?.();
    this.teardown = null;
    this.rotation.keys.end();
    this.app.setState({ angleHelper: null });
    if (gesture && cancel) {
      if (gesture.kind === "rotate") {
        this.rotation.cancel(gesture);
      } else {
        this.skew.cancel(gesture);
      }
    }
    const wasClick = !this.moved && !cancel;
    this.moved = false;
    this.pressedAt = null;
    if (gesture && wasClick) {
      // a press in the zone that never moved is a click on empty canvas
      this.app.clearSelection(null);
    }
    this.app.store.scheduleCapture();
    this.overlay.clear();
  };

  private listen = () => {
    this.teardown = listenToGesture(this.app.ownerWindow, {
      onPointerMove: this.move,
      onPointerUp: () => this.finish(false),
      onKeyDown: onEscape(() => this.finish(true)),
    });
  };

  destroy = () => {
    this.teardown?.();
    this.teardown = null;
    this.gesture = null;
  };
}
