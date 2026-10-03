import { viewportCoordsToSceneCoords } from "@excalidraw/common";

import {
  PLACEHOLDER,
  addLink,
  addPlaceholder,
  fillPlaceholder,
  getFlowMeta,
  listFlows,
  partsOf,
  wrapAsFlowElement,
} from "@excalidraw/flow";

import { ChangeNotifier } from "./changeNotifier";
import { listenToGesture, onEscape } from "./gestureListeners";
import { resolveFlowTarget } from "./appFlow/resolveTarget";

import type { FlowHit, Point, Rect } from "./appFlow/resolveTarget";
import type App from "./App";

export type FlowLinkState = {
  from: Point;
  to: Point;
  /** the flow element the link would reach, or an object it would wrap */
  target: Rect | null;
  /** over nothing: a placeholder would be made here */
  ghost: Rect | null;
} | null;

/** a press that moves less than this (screen px) is a plain click */
const CLICK_SLOP = 4;
/** extra reach (screen px) around a handle */
const HANDLE_SLACK = 4;

/** Drag a flow element's handle: release on a flow element or object to link to it, on nothing to leave a placeholder. */
export class AppFlow {
  private state: FlowLinkState = null;
  private notifier = new ChangeNotifier();
  private teardown: (() => void) | null = null;

  constructor(private app: App) {}

  subscribe = this.notifier.subscribe;

  getSnapshot = () => this.state;

  private set(next: FlowLinkState) {
    this.state = next;
    this.notifier.notify();
  }

  private scenePoint = (event: { clientX: number; clientY: number }) =>
    viewportCoordsToSceneCoords(event, this.app.state);

  /** the handle under the pointer, as {flow, key, centre} */
  private handleAt = (point: Point) => {
    const slack = HANDLE_SLACK / this.app.state.zoom.value;
    for (const element of this.app.scene.getNonDeletedElements()) {
      const meta = getFlowMeta(element);
      if (meta?.kind !== "handle") {
        continue;
      }
      const centerX = element.x + element.width / 2;
      const centerY = element.y + element.height / 2;
      if (
        Math.hypot(point.x - centerX, point.y - centerY) <=
        element.width / 2 + slack
      ) {
        return {
          flowId: meta.id,
          key: meta.key,
          center: { x: centerX, y: centerY },
        };
      }
    }
    return null;
  };

  handlePointerDown = (event: React.PointerEvent<HTMLElement>): boolean => {
    if (
      event.button !== 0 ||
      this.app.state.viewModeEnabled ||
      this.app.state.activeTool.type !== "selection"
    ) {
      return false;
    }
    const handle = this.handleAt(this.scenePoint(event));
    if (!handle) {
      return false;
    }
    this.teardown?.();
    const { flowId, key, center } = handle;
    let moved = false;

    const preview = (moveEvent: PointerEvent) => {
      const point = this.scenePoint(moveEvent);
      const hit = resolveFlowTarget(this.app, point, flowId, key);
      this.set({
        from: center,
        to: point,
        target: hit ? hit.rect : null,
        ghost: hit
          ? null
          : {
              x: point.x - PLACEHOLDER.w / 2,
              y: point.y - PLACEHOLDER.h / 2,
              w: PLACEHOLDER.w,
              h: PLACEHOLDER.h,
            },
      });
    };
    this.teardown = listenToGesture(this.app.ownerWindow, {
      onPointerMove: (moveEvent) => {
        const travelled = Math.hypot(
          moveEvent.clientX - event.clientX,
          moveEvent.clientY - event.clientY,
        );
        if (!moved && travelled < CLICK_SLOP) {
          return;
        }
        moved = true;
        preview(moveEvent);
      },
      onPointerUp: (upEvent) => {
        this.stop();
        if (!moved) {
          return;
        }
        const point = this.scenePoint(upEvent);
        this.finish(
          flowId,
          key,
          point,
          resolveFlowTarget(this.app, point, flowId, key),
        );
      },
      onKeyDown: onEscape(this.stop),
    });
    return true;
  };

  /** makes the link a release asked for */
  finish = (flowId: string, key: string, at: Point, hit: FlowHit) => {
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
        .filter((element) => element.groupIds.includes(group));
      this.app.setState({
        selectedElementIds: Object.fromEntries(
          members.map((element) => [element.id, true]),
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
