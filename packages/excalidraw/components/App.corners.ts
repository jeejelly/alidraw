import { EVENT, KEYS, viewportCoordsToSceneCoords } from "@excalidraw/common";

import {
  canEditCorners,
  getCornerHandles,
  radiusAt,
  type CornerHandle,
} from "../corners";
import { actionConvertShapeToPath } from "../actions/actionPath";

import type React from "react";

import type App from "./App";

const HIT_RADIUS = 11;

type Gesture = { id: string; loop: number; index: number; all: boolean };

/**
 * Live corners: with corner mode on, each straight corner of the selected
 * shape gets a circle gizmo; dragging it along the corner's bisector sets that
 * corner's radius (Shift: every corner). A rectangle or diamond becomes a path
 * (its anchors are its corners) the first time a corner is changed.
 */
export class AppCorners {
  private gesture: Gesture | null = null;
  private teardown: (() => void) | null = null;

  constructor(private app: App) {}

  isActive = () => this.gesture !== null;

  toggle = () => {
    this.app.setState((s) => ({ cornerMode: !s.cornerMode }));
  };

  private target = () => {
    const s = this.app.state;
    if (
      !s.cornerMode ||
      s.activeTool.type !== "selection" ||
      s.viewModeEnabled ||
      s.editingPath ||
      s.editingTextElement ||
      s.newElement
    ) {
      return null;
    }
    const selected = this.app.scene.getSelectedElements(s);
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
    const p = viewportCoordsToSceneCoords(event, this.app.state);
    const zoom = this.app.state.zoom.value;
    const hit = getCornerHandles(
      el,
      this.app.scene.getNonDeletedElementsMap(),
    ).find(
      (h) =>
        Math.hypot(h.center.x - p.x, h.center.y - p.y) <= HIT_RADIUS / zoom ||
        (h.radius === 0 &&
          Math.hypot(
            h.corner.x + h.dir.x * (14 / zoom) - p.x,
            h.corner.y + h.dir.y * (14 / zoom) - p.y,
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
    const g = this.gesture;
    if (!g) {
      return;
    }
    const handle = this.handlesOf(g.id).find(
      (h) => h.loop === g.loop && h.index === g.index,
    );
    if (!handle) {
      return;
    }
    const p = viewportCoordsToSceneCoords(event, this.app.state);
    const radius = Math.round(radiusAt(handle, p));
    this.app.path.setBevelOf(
      g.id,
      event.shiftKey || g.all ? null : g.index,
      radius,
      false,
      g.loop,
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
    const win = this.app.ownerWindow;
    win.addEventListener(EVENT.POINTER_MOVE, this.move);
    win.addEventListener(EVENT.POINTER_UP, this.finish);
    this.teardown = () => {
      win.removeEventListener(EVENT.POINTER_MOVE, this.move);
      win.removeEventListener(EVENT.POINTER_UP, this.finish);
    };
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
