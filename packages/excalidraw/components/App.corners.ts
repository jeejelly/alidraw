import { KEYS, viewportCoordsToSceneCoords } from "@excalidraw/common";

import {
  canEditCorners,
  getCornerHandles,
  radiusAt,
  type CornerHandle,
} from "../corners";
import { actionConvertShapeToPath } from "../actions/actionPath";

import { listenToGesture } from "./gestureListeners";

import type React from "react";

import type App from "./App";

const HIT_RADIUS = 11;

type Gesture = { id: string; loop: number; index: number; all: boolean };

/**
 * Corner mode: dragging a corner's circle along its bisector sets the radius
 * (Shift: every corner). A rectangle or diamond becomes a path on first change.
 */
export class AppCorners {
  private gesture: Gesture | null = null;
  private teardown: (() => void) | null = null;

  constructor(private app: App) {}

  isActive = () => this.gesture !== null;

  toggle = () => {
    this.app.setState((state) => ({ cornerMode: !state.cornerMode }));
  };

  private target = () => {
    const state = this.app.state;
    if (
      !state.cornerMode ||
      state.activeTool.type !== "selection" ||
      state.viewModeEnabled ||
      state.editingPath ||
      state.editingTextElement ||
      state.newElement
    ) {
      return null;
    }
    const selected = this.app.scene.getSelectedElements(state);
    return selected.length === 1 && canEditCorners(selected[0])
      ? selected[0]
      : null;
  };

  private handlesOf = (id: string): CornerHandle[] => {
    const el = this.app.scene.getNonDeletedElement(id);
    return el
      ? getCornerHandles(el, this.app.scene.getNonDeletedElementsMap())
      : [];
  };

  handlePointerDown = (event: React.PointerEvent<HTMLElement>): boolean => {
    const el = this.target();
    if (!el || event.button !== 0) {
      return false;
    }
    const point = viewportCoordsToSceneCoords(event, this.app.state);
    const zoom = this.app.state.zoom.value;
    const hit = getCornerHandles(
      el,
      this.app.scene.getNonDeletedElementsMap(),
    ).find(
      (handle) =>
        Math.hypot(handle.center.x - point.x, handle.center.y - point.y) <=
          HIT_RADIUS / zoom ||
        (handle.radius === 0 &&
          Math.hypot(
            handle.corner.x + handle.dir.x * (14 / zoom) - point.x,
            handle.corner.y + handle.dir.y * (14 / zoom) - point.y,
          ) <=
            HIT_RADIUS / zoom),
    );
    if (!hit) {
      return false;
    }
    if (el.type !== "path") {
      // the shape's corners become anchors of a path, rounding kept
      this.app.actionManager.executeAction(actionConvertShapeToPath, "ui");
    }
    this.gesture = {
      id: el.id,
      loop: hit.loop,
      index: hit.index,
      all: event.shiftKey,
    };
    this.listen();
    return true;
  };

  private move = (event: PointerEvent) => {
    const gesture = this.gesture;
    if (!gesture) {
      return;
    }
    const handle = this.handlesOf(gesture.id).find(
      (candidate) =>
        candidate.loop === gesture.loop && candidate.index === gesture.index,
    );
    if (!handle) {
      return;
    }
    const point = viewportCoordsToSceneCoords(event, this.app.state);
    const radius = Math.round(radiusAt(handle, point));
    this.app.path.setBevelOf(
      gesture.id,
      event.shiftKey || gesture.all ? null : gesture.index,
      radius,
      false,
      gesture.loop,
    );
  };

  private finish = () => {
    this.gesture = null;
    this.teardown?.();
    this.teardown = null;
    this.app.store.scheduleCapture();
    this.app.setState({});
  };

  private listen = () => {
    this.teardown = listenToGesture(this.app.ownerWindow, {
      onPointerMove: this.move,
      onPointerUp: this.finish,
    });
  };

  /** @returns true when the key was consumed */
  handleKeyDown = (event: KeyboardEvent | React.KeyboardEvent): boolean => {
    if (this.app.state.cornerMode && event.key === KEYS.ESCAPE) {
      this.app.setState({ cornerMode: false });
      return true;
    }
    return false;
  };

  destroy = () => {
    this.teardown?.();
    this.teardown = null;
    this.gesture = null;
  };
}
