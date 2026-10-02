import { EVENT, KEYS, viewportCoordsToSceneCoords } from "@excalidraw/common";
import {
  getCommonBounds,
  getTransformHandleTypeFromCoords,
} from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

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
} from "../symbols/stretch";

import type App from "./App";

export type StretchState = {
  frame: Frame | null;
  guides: Guide[];
};

const IDLE: StretchState = { frame: null, guides: [] };
const KEYS_OF_GEOMETRY = [
  "x",
  "y",
  "width",
  "height",
  "points",
  "handles",
  "contours",
] as const;

/**
 * Ctrl + drag on a handle of a component stretches it as a real component:
 * what spans grows, what is pinned to an end keeps its distance from it. The
 * frame flashes when an edge lines up with another component.
 */
export class AppStretch {
  private state: StretchState = IDLE;
  private listeners = new Set<() => void>();
  private teardown: (() => void) | null = null;
  private gesture: {
    members: ExcalidrawElement[];
    base: ExcalidrawElement[];
    pins: Map<string, Pin>;
    from: Frame;
    edges: { l: boolean; r: boolean; t: boolean; b: boolean };
    start: { x: number; y: number };
    others: ExcalidrawElement[];
  } | null = null;

  constructor(private app: App) {}

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };

  getSnapshot = () => this.state;

  private set(next: StretchState) {
    this.state = next;
    this.listeners.forEach((l) => l());
  }

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
    const s = this.app.state;
    const p = viewportCoordsToSceneCoords(event, s);
    // the handles, or anywhere along an edge: small components have no side handles
    const [bx0, by0, bx1, by1] = getCommonBounds(symbol.members);
    const tol = 8 / s.zoom.value;
    const inX = p.x >= bx0 - tol && p.x <= bx1 + tol;
    const inY = p.y >= by0 - tol && p.y <= by1 + tol;
    let edges = {
      l: inY && Math.abs(p.x - bx0) <= tol,
      r: inY && Math.abs(p.x - bx1) <= tol,
      t: inX && Math.abs(p.y - by0) <= tol,
      b: inX && Math.abs(p.y - by1) <= tol,
    };
    if (!edges.l && !edges.r && !edges.t && !edges.b) {
      const handle = getTransformHandleTypeFromCoords(
        [bx0, by0, bx1, by1],
        p.x,
        p.y,
        s.zoom,
        event.pointerType as any,
        this.app.editorInterface,
      );
      if (!handle || handle === "rotation") {
        return false;
      }
      edges = {
        l: handle.includes("w"),
        r: handle.includes("e"),
        t: handle.includes("n"),
        b: handle.includes("s"),
      };
    }
    const from = frameOf(symbol.members);
    this.gesture = {
      members: symbol.members,
      base: symbol.members.map((e) => ({ ...e })),
      pins: inferPins(symbol.members, from, getLayout(symbol.members)),
      from,
      edges,
      start: p,
      others: all.filter((e) => !symbol.members.includes(e)),
    };
    this.set({ frame: from, guides: [] });
    this.listen();
    event.preventDefault();
    event.stopPropagation();
    return true;
  };

  private move = (event: PointerEvent) => {
    const g = this.gesture;
    if (!g) {
      return;
    }
    const p = viewportCoordsToSceneCoords(event, this.app.state);
    const dx = p.x - g.start.x;
    const dy = p.y - g.start.y;
    const MIN = 24;
    let next: Frame = {
      x0: g.edges.l ? Math.min(g.from.x0 + dx, g.from.x1 - MIN) : g.from.x0,
      x1: g.edges.r ? Math.max(g.from.x1 + dx, g.from.x0 + MIN) : g.from.x1,
      y0: g.edges.t ? Math.min(g.from.y0 + dy, g.from.y1 - MIN) : g.from.y0,
      y1: g.edges.b ? Math.max(g.from.y1 + dy, g.from.y0 + MIN) : g.from.y1,
    };
    const snapped = snapFrame(
      next,
      g.edges,
      g.others,
      6 / this.app.state.zoom.value,
    );
    next = snapped.frame;
    const updates = stretchUpdates(g.base, g.pins, g.from, next);
    for (const el of g.members) {
      const u = updates.get(el.id);
      if (u) {
        this.app.scene.mutateElement(el as any, u, {
          informMutation: false,
          isDragging: true,
        });
      }
    }
    this.app.scene.triggerUpdate();
    this.set({ frame: next, guides: snapped.guides });
  };

  private finish = (cancel: boolean) => {
    const g = this.gesture;
    this.teardown?.();
    this.teardown = null;
    this.gesture = null;
    if (g) {
      if (cancel) {
        g.members.forEach((el, i) => {
          const original: Record<string, any> = {};
          for (const k of KEYS_OF_GEOMETRY) {
            if (k in g.base[i]) {
              original[k] = (g.base[i] as any)[k];
            }
          }
          this.app.scene.mutateElement(el as any, original, {
            informMutation: false,
            isDragging: false,
          });
        });
        this.app.scene.triggerUpdate();
      } else {
        this.app.store.scheduleCapture();
      }
    }
    this.set(IDLE);
  };

  private listen = () => {
    const win = this.app.ownerWindow;
    const onUp = () => this.finish(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        this.finish(true);
      }
    };
    win.addEventListener(EVENT.POINTER_MOVE, this.move);
    win.addEventListener(EVENT.POINTER_UP, onUp);
    win.addEventListener(EVENT.KEYDOWN, onKey);
    this.teardown = () => {
      win.removeEventListener(EVENT.POINTER_MOVE, this.move);
      win.removeEventListener(EVENT.POINTER_UP, onUp);
      win.removeEventListener(EVENT.KEYDOWN, onKey);
    };
  };

  destroy = () => {
    this.teardown?.();
    this.teardown = null;
    this.gesture = null;
  };
}
