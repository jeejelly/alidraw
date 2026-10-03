import { KEYS, viewportCoordsToSceneCoords } from "@excalidraw/common";

import {
  getCommonBounds,
  getTransformHandleTypeFromCoords,
} from "@excalidraw/element";

import {
  frameOf,
  getLayout,
  getSelectedSymbol,
  inferPins,
  snapFrame,
  stretchUpdates,
  type Frame,
  type Guide,
  type Pin,
} from "@excalidraw/symbols";

import type { Bounds } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { ChangeNotifier } from "./changeNotifier";
import { listenToGesture, onEscape } from "./gestureListeners";

import type App from "./App";

export type StretchState = {
  frame: Frame | null;
  guides: Guide[];
};

type Edges = { l: boolean; r: boolean; t: boolean; b: boolean };

const IDLE: StretchState = { frame: null, guides: [] };
const GEOMETRY_KEYS = [
  "x",
  "y",
  "width",
  "height",
  "points",
  "handles",
  "contours",
] as const;

/** a component cannot be stretched smaller than this, in scene px */
const MIN_SIZE = 24;
/** how close (screen px) the pointer must be to an edge to grab it */
const EDGE_GRAB_DISTANCE = 8;
/** how close (screen px) an edge must be to another component to snap to it */
const SNAP_DISTANCE = 6;

/** Ctrl + drag stretches a component: what spans grows, what is pinned keeps its distance. */
export class AppStretch {
  private state: StretchState = IDLE;
  private notifier = new ChangeNotifier();
  private teardown: (() => void) | null = null;
  private gesture: {
    members: ExcalidrawElement[];
    base: ExcalidrawElement[];
    pins: Map<string, Pin>;
    from: Frame;
    edges: Edges;
    start: { x: number; y: number };
    others: ExcalidrawElement[];
  } | null = null;

  constructor(private app: App) {}

  subscribe = this.notifier.subscribe;

  getSnapshot = () => this.state;

  private set(next: StretchState) {
    this.state = next;
    this.notifier.notify();
  }

  /** @returns the edges under the pointer, else those of the transform handle there (null: none) */
  private grabbedEdges = (
    bounds: Bounds,
    point: { x: number; y: number },
    event: React.PointerEvent<HTMLElement>,
  ): Edges | null => {
    const { zoom } = this.app.state;
    const [minX, minY, maxX, maxY] = bounds;
    const tolerance = EDGE_GRAB_DISTANCE / zoom.value;
    const inX = point.x >= minX - tolerance && point.x <= maxX + tolerance;
    const inY = point.y >= minY - tolerance && point.y <= maxY + tolerance;
    const edges = {
      l: inY && Math.abs(point.x - minX) <= tolerance,
      r: inY && Math.abs(point.x - maxX) <= tolerance,
      t: inX && Math.abs(point.y - minY) <= tolerance,
      b: inX && Math.abs(point.y - maxY) <= tolerance,
    };
    if (edges.l || edges.r || edges.t || edges.b) {
      return edges;
    }
    const handle = getTransformHandleTypeFromCoords(
      bounds,
      point.x,
      point.y,
      zoom,
      event.pointerType as any,
      this.app.editorInterface,
    );
    if (!handle || handle === "rotation") {
      return null;
    }
    return {
      l: handle.includes("w"),
      r: handle.includes("e"),
      t: handle.includes("n"),
      b: handle.includes("s"),
    };
  };

  handlePointerDown = (event: React.PointerEvent<HTMLElement>): boolean => {
    if (
      event.button !== 0 ||
      !(event[KEYS.CTRL_OR_CMD] || event.ctrlKey) ||
      this.app.state.viewModeEnabled
    ) {
      return false;
    }
    const all = this.app.scene.getNonDeletedElements();
    const symbol = getSelectedSymbol(
      this.app.scene.getSelectedElements(this.app.state),
      all,
    );
    if (!symbol) {
      return false;
    }
    const point = viewportCoordsToSceneCoords(event, this.app.state);
    const edges = this.grabbedEdges(
      getCommonBounds(symbol.members),
      point,
      event,
    );
    if (!edges) {
      return false;
    }
    const from = frameOf(symbol.members);
    this.gesture = {
      members: symbol.members,
      base: symbol.members.map((member) => ({ ...member })),
      pins: inferPins(symbol.members, from, getLayout(symbol.members)),
      from,
      edges,
      start: point,
      others: all.filter((element) => !symbol.members.includes(element)),
    };
    this.set({ frame: from, guides: [] });
    this.teardown = listenToGesture(this.app.ownerWindow, {
      onPointerMove: this.move,
      onPointerUp: () => this.finish(false),
      onKeyDown: onEscape(() => this.finish(true)),
    });
    event.preventDefault();
    event.stopPropagation();
    return true;
  };

  private move = (event: PointerEvent) => {
    const { gesture } = this;
    if (!gesture) {
      return;
    }
    const point = viewportCoordsToSceneCoords(event, this.app.state);
    const dx = point.x - gesture.start.x;
    const dy = point.y - gesture.start.y;
    const { from, edges } = gesture;
    const stretched: Frame = {
      x0: edges.l ? Math.min(from.x0 + dx, from.x1 - MIN_SIZE) : from.x0,
      x1: edges.r ? Math.max(from.x1 + dx, from.x0 + MIN_SIZE) : from.x1,
      y0: edges.t ? Math.min(from.y0 + dy, from.y1 - MIN_SIZE) : from.y0,
      y1: edges.b ? Math.max(from.y1 + dy, from.y0 + MIN_SIZE) : from.y1,
    };
    const snapped = snapFrame(
      stretched,
      edges,
      gesture.others,
      SNAP_DISTANCE / this.app.state.zoom.value,
    );
    const updates = stretchUpdates(
      gesture.base,
      gesture.pins,
      from,
      snapped.frame,
    );
    for (const member of gesture.members) {
      const update = updates.get(member.id);
      if (update) {
        this.app.scene.mutateElement(member as any, update, {
          informMutation: false,
          isDragging: true,
        });
      }
    }
    this.app.scene.triggerUpdate();
    this.set({ frame: snapped.frame, guides: snapped.guides });
  };

  /** puts every member back to the geometry it had when the gesture began */
  private restore = (gesture: NonNullable<AppStretch["gesture"]>) => {
    gesture.members.forEach((member, index) => {
      const original: Record<string, any> = {};
      for (const key of GEOMETRY_KEYS) {
        if (key in gesture.base[index]) {
          original[key] = (gesture.base[index] as any)[key];
        }
      }
      this.app.scene.mutateElement(member as any, original, {
        informMutation: false,
        isDragging: false,
      });
    });
    this.app.scene.triggerUpdate();
  };

  private finish = (cancel: boolean) => {
    const { gesture } = this;
    this.teardown?.();
    this.teardown = null;
    this.gesture = null;
    if (gesture) {
      if (cancel) {
        this.restore(gesture);
      } else {
        this.app.store.scheduleCapture();
      }
    }
    this.set(IDLE);
  };

  destroy = () => {
    this.teardown?.();
    this.teardown = null;
    this.gesture = null;
  };
}
