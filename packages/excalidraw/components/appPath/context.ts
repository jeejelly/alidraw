import { viewportCoordsToSceneCoords } from "@excalidraw/common";
import {
  pointFrom,
  pointRotateRads,
  type GlobalPoint,
  type LocalPoint,
} from "@excalidraw/math";
import {
  getElementAbsoluteCoords,
  getPathUpdate,
  isPathElement,
  withPathLoopGeometry,
} from "@excalidraw/element";

import type {
  ExcalidrawPathElement,
  PathPointHandles,
} from "@excalidraw/element/types";

import { getGuideSnap } from "../../guides";

import { listenToGesture } from "../gestureListeners";

import type { AppState } from "../../types";
import type App from "../App";

type EditingPath = AppState["editingPath"];

const DOUBLE_CLICK_MS = 400;

export type ScenePoint = { x: number; y: number };

export type PathGesture =
  | {
      kind: "anchor";
      loop: number;
      index: number;
      original: ExcalidrawPathElement;
      /** anchor position minus pointer, local to `original` */
      grab: [number, number];
      /** the points that travel with it: the selection it belongs to */
      indexes: number[];
    }
  | {
      kind: "handle";
      loop: number;
      index: number;
      side: "in" | "out";
      original: ExcalidrawPathElement;
    }
  | { kind: "marquee"; loop: number; start: ScenePoint; base: number[] }
  | { kind: "pen-handle"; index: number };

type PointerHandlers = {
  move: (event: PointerEvent) => void;
  release: () => void;
};

type GuideModifiers = { ctrlKey: boolean; metaKey: boolean };

/** state and services shared by the pen tool and the point editor */
export class PathContext {
  gesture: PathGesture | null = null;
  lastClick: { x: number; y: number; time: number } | null = null;
  pointerHandlers: PointerHandlers | null = null;
  private teardown: (() => void) | null = null;

  constructor(readonly app: App) {}

  getEditedElement = (): ExcalidrawPathElement | null => {
    const editing = this.app.state.editingPath;
    if (!editing) {
      return null;
    }
    const element = this.app.scene.getNonDeletedElement(editing.elementId);
    return isPathElement(element) ? element : null;
  };

  private center = (element: ExcalidrawPathElement) => {
    const [, , , , centerX, centerY] = getElementAbsoluteCoords(
      element,
      this.app.scene.getNonDeletedElementsMap(),
    );
    return pointFrom<GlobalPoint>(centerX, centerY);
  };

  toScene = (element: ExcalidrawPathElement, point: LocalPoint) =>
    pointRotateRads(
      pointFrom<GlobalPoint>(element.x + point[0], element.y + point[1]),
      this.center(element),
      element.angle,
    );

  toLocal = (element: ExcalidrawPathElement, point: ScenePoint): LocalPoint => {
    const unrotated = pointRotateRads(
      pointFrom<GlobalPoint>(point.x, point.y),
      this.center(element),
      -element.angle as any,
    );
    return pointFrom<LocalPoint>(
      unrotated[0] - element.x,
      unrotated[1] - element.y,
    );
  };

  scenePointer = (event: { clientX: number; clientY: number }) =>
    viewportCoordsToSceneCoords(event, this.app.state);

  /** the magnet: a scene point pulled onto a nearby guide (Ctrl/Cmd skips) */
  snapToGuides = (point: ScenePoint, modifiers: GuideModifiers): ScenePoint => {
    const { guides, guidesSnapEnabled, zoom } = this.app.state;
    if (
      !guides.length ||
      !guidesSnapEnabled ||
      modifiers.ctrlKey ||
      modifiers.metaKey
    ) {
      return point;
    }
    const snap = getGuideSnap([[point.x, point.y]], guides, zoom.value);
    return { x: point.x + snap.x, y: point.y + snap.y };
  };

  /** whether this click repeats the previous one on the same spot, quickly */
  isDoubleClick = (
    point: ScenePoint,
    timeStamp: number,
    maxDistance: number,
  ) => {
    const last = this.lastClick;
    return (
      !!last &&
      timeStamp - last.time < DOUBLE_CLICK_MS &&
      Math.hypot(last.x - point.x, last.y - point.y) < maxDistance
    );
  };

  rememberClick = (point: ScenePoint, timeStamp: number) => {
    this.lastClick = { x: point.x, y: point.y, time: timeStamp };
  };

  /** replaces the geometry of one outline of `element`, keeping the rest */
  apply = (
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
  commit = () => {
    this.app.store.scheduleCapture();
    this.app.setState({});
  };

  setEditing = (
    elementId: string | null,
    selectedPoint: number | null = null,
    loop = 0,
  ) => {
    this.app.setState({
      editingPath: elementId ? { elementId, selectedPoint, loop } : null,
    });
  };

  private patchEditing = (patch: Partial<NonNullable<EditingPath>>) =>
    this.app.setState((prevState) =>
      prevState.editingPath
        ? { editingPath: { ...prevState.editingPath, ...patch } }
        : null,
    );

  /** selects several points of an outline; `primary` is the one the panel acts on */
  selectPoints = (indexes: number[], primary: number | null, loop = 0) =>
    this.patchEditing({
      selectedPoint: primary,
      selectedPoints: indexes,
      loop,
    });

  setMarquee = (marquee: NonNullable<EditingPath>["marquee"]) =>
    this.patchEditing({ marquee });

  /** a gesture owns the pointer until release; the pen tracks it between clicks */
  listen = () => {
    if (this.teardown || !this.pointerHandlers) {
      return;
    }
    const { move, release } = this.pointerHandlers;
    this.teardown = listenToGesture(this.app.ownerWindow, {
      onPointerMove: move,
      onPointerUp: release,
    });
  };

  unlisten = () => {
    this.teardown?.();
    this.teardown = null;
  };
}
