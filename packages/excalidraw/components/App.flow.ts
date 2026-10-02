import { EVENT, viewportCoordsToSceneCoords } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { getFlowMeta, listFlows, partsOf } from "../flow/flowCanvas";
import {
  PLACEHOLDER,
  addLink,
  addPlaceholder,
  fillPlaceholder,
  flowKeyAt,
  selfAndAncestors,
  wrapAsFlowElement,
} from "../flow/flowElement";

import type App from "./App";

type Point = { x: number; y: number };
type Rect = { x: number; y: number; w: number; h: number };

export type FlowLinkState = {
  from: Point;
  to: Point;
  /** the flow element the link would reach, or an object it would wrap */
  target: Rect | null;
  /** over nothing: a placeholder would be made here */
  ghost: Rect | null;
} | null;

type Hit =
  | { kind: "flow"; key: string; rect: Rect }
  | { kind: "object"; element: ExcalidrawElement; rect: Rect }
  | null;

const CLICK = 4;

/**
 * Drag the handle of a flow element: release on another flow element to link
 * to it, on any other object to make that a flow element and link to it, on
 * nothing to leave a placeholder box linked to it.
 */
export class AppFlow {
  private state: FlowLinkState = null;
  private listeners = new Set<() => void>();
  private teardown: (() => void) | null = null;

  constructor(private app: App) {}

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };

  getSnapshot = () => this.state;

  private set(next: FlowLinkState) {
    this.state = next;
    this.listeners.forEach((l) => l());
  }

  private scenePoint = (e: { clientX: number; clientY: number }) =>
    viewportCoordsToSceneCoords(e, this.app.state);

  /** the handle under the pointer, as {flow, key, element} */
  private handleAt = (p: Point) => {
    const slack = 4 / this.app.state.zoom.value;
    for (const el of this.app.scene.getNonDeletedElements()) {
      const m = getFlowMeta(el);
      if (m?.kind !== "handle") {
        continue;
      }
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      if (Math.hypot(p.x - cx, p.y - cy) <= el.width / 2 + slack) {
        return { flowId: m.id, key: m.key, center: { x: cx, y: cy } };
      }
    }
    return null;
  };

  private resolve = (p: Point, flowId: string, key: string): Hit => {
    const all = this.app.scene.getElementsIncludingDeleted();
    const excluded = selfAndAncestors(all, flowId, key);
    const parts = partsOf(all, flowId);
    const rectOf = (el: ExcalidrawElement): Rect => ({
      x: el.x,
      y: el.y,
      w: el.width,
      h: el.height,
    });
    const hits = this.app.getElementsAtPosition(p.x, p.y);
    for (let i = hits.length - 1; i >= 0; i--) {
      const el = hits[i];
      if (el.type === "frame" || el.type === "magicframe") {
        continue;
      }
      const at = flowKeyAt(all, el, flowId, excluded);
      if (at.key) {
        return {
          kind: "flow",
          key: at.key,
          rect: rectOf(parts.byKey.get(at.key)!),
        };
      }
      if (at.onlyExcluded || el.type === "arrow") {
        continue;
      }
      return { kind: "object", element: el, rect: rectOf(el) };
    }
    // the room inside an outline or an unfilled shape: the smallest around
    let best: { hit: Hit; area: number } | null = null;
    const consider = (hit: Hit, el: ExcalidrawElement) => {
      const area = el.width * el.height;
      if (!best || area < best.area) {
        best = { hit, area };
      }
    };
    const inside = (el: ExcalidrawElement) =>
      p.x >= el.x &&
      p.x <= el.x + el.width &&
      p.y >= el.y &&
      p.y <= el.y + el.height;
    for (const [k, el] of parts.byKey) {
      if (!excluded.has(k) && inside(el)) {
        consider({ kind: "flow", key: k, rect: rectOf(el) }, el);
      }
    }
    for (const el of this.app.scene.getNonDeletedElements()) {
      if (
        !(
          el.type === "rectangle" ||
          el.type === "ellipse" ||
          el.type === "diamond"
        ) ||
        getFlowMeta(el) ||
        !inside(el)
      ) {
        continue;
      }
      const at = flowKeyAt(all, el, flowId, excluded);
      if (at.key) {
        consider(
          { kind: "flow", key: at.key, rect: rectOf(parts.byKey.get(at.key)!) },
          el,
        );
      } else if (!at.onlyExcluded) {
        consider({ kind: "object", element: el, rect: rectOf(el) }, el);
      }
    }
    return (best as { hit: Hit } | null)?.hit ?? null;
  };

  handlePointerDown = (event: React.PointerEvent<HTMLElement>): boolean => {
    if (
      event.button !== 0 ||
      this.app.state.viewModeEnabled ||
      this.app.state.activeTool.type !== "selection"
    ) {
      return false;
    }
    const start = this.scenePoint(event);
    const handle = this.handleAt(start);
    if (!handle) {
      return false;
    }
    this.teardown?.();
    const { flowId, key, center } = handle;
    let hit: Hit = null;
    let moved = false;
    const update = (e: PointerEvent) => {
      const p = this.scenePoint(e);
      hit = this.resolve(p, flowId, key);
      this.set({
        from: center,
        to: p,
        target: hit ? hit.rect : null,
        ghost: hit
          ? null
          : {
              x: p.x - PLACEHOLDER.w / 2,
              y: p.y - PLACEHOLDER.h / 2,
              w: PLACEHOLDER.w,
              h: PLACEHOLDER.h,
            },
      });
    };
    const onMove = (e: PointerEvent) => {
      if (
        !moved &&
        Math.hypot(e.clientX - event.clientX, e.clientY - event.clientY) < CLICK
      ) {
        return;
      }
      moved = true;
      update(e);
    };
    const onUp = (e: PointerEvent) => {
      this.stop();
      if (!moved) {
        return;
      }
      this.finish(
        flowId,
        key,
        this.scenePoint(e),
        this.resolve(this.scenePoint(e), flowId, key),
      );
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        this.stop();
      }
    };
    const win = this.app.ownerWindow;
    win.addEventListener(EVENT.POINTER_MOVE, onMove);
    win.addEventListener(EVENT.POINTER_UP, onUp);
    win.addEventListener(EVENT.KEYDOWN, onKey);
    this.teardown = () => {
      win.removeEventListener(EVENT.POINTER_MOVE, onMove);
      win.removeEventListener(EVENT.POINTER_UP, onUp);
      win.removeEventListener(EVENT.KEYDOWN, onKey);
    };
    return true;
  };

  /** makes the link a release asked for */
  finish = (flowId: string, key: string, at: Point, hit: Hit) => {
    const scene = this.app.scene;
    let to: string | null = null;
    if (hit?.kind === "flow") {
      to = hit.key;
    } else if (hit?.kind === "object") {
      to = wrapAsFlowElement(scene, [hit.element], flowId)?.key ?? null;
    } else {
      to = addPlaceholder(scene, flowId, at)?.key ?? null;
    }
    if (to) {
      addLink(scene, flowId, key, to);
      this.app.store.scheduleCapture();
      this.app.setState({});
    }
    return to;
  };

  /**
   * "Convert to flow element": the selection is wrapped (a placeholder
   * selected with real objects is filled by them). Returns the key or null.
   */
  convertSelection = (flowId?: string, label?: string) => {
    const { scene } = this.app;
    const selected = scene.getSelectedElements(this.app.state);
    if (!selected.length) {
      return null;
    }
    const all = scene.getElementsIncludingDeleted();
    const id =
      flowId ??
      selected.map(getFlowMeta).find(Boolean)?.id ??
      listFlows(all)[0] ??
      "Flow 1";
    const filled = fillPlaceholder(scene, selected, id);
    const made = filled
      ? null
      : wrapAsFlowElement(scene, selected, id, label ? { label } : {});
    const key = filled ?? made?.key ?? null;
    if (!key) {
      return null;
    }
    // the new flow element is the selection
    const parts = partsOf(scene.getElementsIncludingDeleted(), id);
    const group = getFlowMeta(parts.wraps.get(key)!)?.group;
    if (group) {
      const members = scene
        .getNonDeletedElements()
        .filter((e) => e.groupIds.includes(group));
      this.app.setState({
        selectedElementIds: Object.fromEntries(
          members.map((e) => [e.id, true]),
        ),
        selectedGroupIds: { [group]: true },
      });
    }
    this.app.store.scheduleCapture();
    return key;
  };

  private stop = () => {
    this.teardown?.();
    this.teardown = null;
    this.set(null);
  };

  destroy = () => this.stop();
}
