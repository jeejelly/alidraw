import { viewportCoordsToSceneCoords } from "@excalidraw/common";

import {
  PLACEHOLDER,
  addLink,
  addPlaceholder,
  fillPlaceholder,
  getFlowMeta,
  partsOf,
  portNearPoint,
  setLinkPorts,
  settleLinkEnd,
  targetFlowId,
  wrapAsFlowElement,
  type FlowLook,
} from "@excalidraw/flow";

import { isArrowElement } from "@excalidraw/element";

import type { ExcalidrawArrowElement } from "@excalidraw/element/types";

import { ChangeNotifier } from "./changeNotifier";
import { listenToGesture, onEscape } from "./gestureListeners";
import { selectedPortDots } from "./appFlow/portDots";
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
  /** the flow element under the pointer, and the port dot the pointer is on */
  hover: { flowId: string; key: string; port: string | null } | null;
} | null;

/** a press that moves less than this (screen px) is a plain click */
const CLICK_SLOP = 4;
/** extra reach (screen px) around a handle */
const HANDLE_SLACK = 4;
/** reach (screen px) of a port dot */
const PORT_REACH = 8;

/** where a dragged link starts: a handle, or a port dot (`port` names it) */
type LinkSource = {
  flowId: string;
  key: string;
  center: Point;
  port?: string;
  /** how far the press was from the centre, to pick the closer of two */
  gap: number;
};

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
  private handleAt = (point: Point): LinkSource | null => {
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
          gap: Math.hypot(point.x - centerX, point.y - centerY),
        };
      }
    }
    return null;
  };

  /** the port dot of the selected step under the pointer */
  private portDotAt = (point: Point): LinkSource | null => {
    const reach = PORT_REACH / this.app.state.zoom.value;
    let best: LinkSource | null = null;
    for (const dot of selectedPortDots(this.app)) {
      const gap = Math.hypot(point.x - dot.center.x, point.y - dot.center.y);
      if (gap <= reach && (!best || gap < best.gap)) {
        best = {
          flowId: dot.flowId,
          key: dot.key,
          center: dot.center,
          port: dot.name,
          gap,
        };
      }
    }
    return best;
  };

  /** a dot wins over the handle it overlaps: it is what is drawn there */
  private sourceAt = (point: Point) => {
    const dot = this.portDotAt(point);
    const handle = this.handleAt(point);
    return dot && (!handle || dot.gap <= handle.gap) ? dot : handle;
  };

  /** the port dot of flow element `key` at `point`, if the pointer is on one */
  private portNameAt = (flowId: string, key: string, point: Point) => {
    const step = partsOf(
      this.app.scene.getElementsIncludingDeleted(),
      flowId,
    ).byKey.get(key);
    const reach = PORT_REACH / this.app.state.zoom.value;
    return step ? portNearPoint(step, point, reach)?.name : undefined;
  };

  handlePointerDown = (event: React.PointerEvent<HTMLElement>): boolean => {
    if (
      event.button !== 0 ||
      this.app.state.viewModeEnabled ||
      this.app.state.activeTool.type !== "selection"
    ) {
      return false;
    }
    const source = this.sourceAt(this.scenePoint(event));
    if (!source) {
      return false;
    }
    this.teardown?.();
    const { flowId, key, center, port } = source;
    let moved = false;

    const preview = (moveEvent: PointerEvent) => {
      const point = this.scenePoint(moveEvent);
      const hit = resolveFlowTarget(this.app, point, flowId, key);
      this.set({
        from: center,
        to: point,
        hover:
          hit?.kind === "flow"
            ? {
                flowId,
                key: hit.key,
                port: this.portNameAt(flowId, hit.key, point) ?? null,
              }
            : null,
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
          port,
        );
      },
      onKeyDown: onEscape(this.stop),
    });
    return true;
  };

  /** makes the link a release asked for */
  finish = (
    flowId: string,
    key: string,
    at: Point,
    hit: FlowHit,
    fromPort?: string,
  ) => {
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
      const arrowId = addLink(scene, flowId, key, to);
      const toPort =
        hit?.kind === "flow" ? this.portNameAt(flowId, to, at) : undefined;
      const arrow = arrowId && scene.getElement(arrowId);
      if (arrow && (fromPort || toPort)) {
        setLinkPorts(scene, arrow as ExcalidrawArrowElement, {
          fromPort,
          toPort,
        });
      }
      this.app.store.scheduleCapture();
      this.app.setState({});
    }
    return to;
  };

  /**
   * "Convert to flow element": the selection is wrapped (a placeholder
   * selected with real objects is filled by them). Returns the key or null.
   */
  convertSelection = (flowId?: string, label?: string, look?: FlowLook) => {
    const { scene } = this.app;
    const selected = scene.getSelectedElements(this.app.state);
    if (!selected.length) {
      return null;
    }
    const all = scene.getElementsIncludingDeleted();
    const id = flowId ?? targetFlowId(all, selected);
    const filled = fillPlaceholder(scene, selected, id);
    const made = filled
      ? null
      : wrapAsFlowElement(scene, selected, id, label ? { label } : {}, look);
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

  /** an end of a link arrow was dragged: dropped on a port dot it takes that port, elsewhere on the step it loses it */
  handleEndpointDrop = (arrowId: string, pointIndex: number, at: Point) => {
    const arrow = this.app.scene.getElement(arrowId);
    if (!arrow || !isArrowElement(arrow)) {
      return;
    }
    const end =
      pointIndex === 0
        ? "start"
        : pointIndex === arrow.points.length - 1
        ? "end"
        : null;
    const reach = PORT_REACH / this.app.state.zoom.value;
    if (end && settleLinkEnd(this.app.scene, arrow, end, at, reach)) {
      this.app.store.scheduleCapture();
    }
  };

  private stop = () => {
    this.teardown?.();
    this.teardown = null;
    this.set(null);
  };

  destroy = () => this.stop();
}
