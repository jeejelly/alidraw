import { viewportCoordsToSceneCoords } from "@excalidraw/common";
import {
  getBoundTextElement,
  getElementBounds,
  updateBoundElements,
} from "@excalidraw/element";

import type { Bounds } from "@excalidraw/common";
import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import {
  getAnchor,
  isGuideAnchor,
  pointOnBounds,
  solveElementAnchor,
  solveGuideAnchor,
  withAnchor,
  type Anchor,
  type AnchorPoint,
  type GuideEdge,
  guideEdgeCoordinate,
} from "../anchors";

import { listenToGesture, onEscape } from "./gestureListeners";

import type App from "./App";

const EPSILON = 0.01;
/** how often a refresh re-settles anchor chains */
const SETTLE_PASSES = 4;
/** an anchor chain longer than this is treated as a loop */
const MAX_CHAIN_LENGTH = 64;

type Memory = { ex: number; ey: number; tx: number; ty: number };

/** Keeps anchored elements on their anchors: the follower follows its target, and a deliberate move changes the gap. */
export class AppAnchors {
  private busy = false;
  private memory = new Map<string, Memory>();
  private stopPicking: (() => void) | null = null;

  constructor(private app: App) {}

  private bounds = (el: NonDeletedExcalidrawElement): Bounds =>
    getElementBounds(el, this.app.scene.getNonDeletedElementsMap());

  private moveBy = (
    el: NonDeletedExcalidrawElement,
    dx: number,
    dy: number,
  ) => {
    const scene = this.app.scene;
    scene.mutateElement(el, { x: el.x + dx, y: el.y + dy });
    const text = getBoundTextElement(el, scene.getNonDeletedElementsMap());
    if (text) {
      scene.mutateElement(text, { x: text.x + dx, y: text.y + dy });
    }
    updateBoundElements(el, scene);
  };

  private commitAndRefresh = () => {
    this.app.store.scheduleCapture();
    this.refresh();
    this.app.setState({});
  };

  private writeAnchor = (
    el: NonDeletedExcalidrawElement,
    anchor: Anchor | null,
  ) => {
    this.app.scene.mutateElement(el, {
      customData: withAnchor(el.customData, anchor),
    });
    this.memory.delete(el.id);
  };

  /** Hangs `at` of the element off `from` of the target; `snap` closes the gap, else the current gap is kept. */
  setElementAnchor = (
    sourceId: string,
    targetId: string,
    from: AnchorPoint,
    at: AnchorPoint,
    snap = false,
  ) => {
    const source = this.app.scene.getNonDeletedElement(sourceId);
    const target = this.app.scene.getNonDeletedElement(targetId);
    if (
      !source ||
      !target ||
      source.id === target.id ||
      this.wouldCycle(sourceId, targetId)
    ) {
      return false;
    }
    const [ex, ey] = pointOnBounds(this.bounds(source), at);
    const [tx, ty] = pointOnBounds(this.bounds(target), from);
    this.writeAnchor(source, {
      to: targetId,
      from,
      at,
      dx: snap ? 0 : ex - tx,
      dy: snap ? 0 : ey - ty,
    });
    this.commitAndRefresh();
    return true;
  };

  setGuideAnchor = (
    sourceId: string,
    guideId: string,
    edge: GuideEdge,
    snap = false,
  ) => {
    const source = this.app.scene.getNonDeletedElement(sourceId);
    const guide = this.app.state.guides.find(
      (candidate) => candidate.id === guideId,
    );
    if (!source || !guide) {
      return false;
    }
    const at = guideEdgeCoordinate(this.bounds(source), guide.axis, edge);
    this.writeAnchor(source, {
      guide: guideId,
      edge,
      offset: snap ? 0 : at - guide.position,
    });
    this.commitAndRefresh();
    return true;
  };

  release = (sourceId: string) => {
    const source = this.app.scene.getNonDeletedElement(sourceId);
    if (source && getAnchor(source)) {
      this.writeAnchor(source, null);
      this.app.store.scheduleCapture();
      this.app.setState({});
    }
  };

  /** the gap (element anchors) or offset (guide anchors), typed in */
  setGap = (
    sourceId: string,
    gap: { dx?: number; dy?: number; offset?: number },
  ) => {
    const source = this.app.scene.getNonDeletedElement(sourceId);
    const anchor = source && getAnchor(source);
    if (!source || !anchor) {
      return;
    }
    this.writeAnchor(
      source,
      isGuideAnchor(anchor)
        ? { ...anchor, offset: gap.offset ?? anchor.offset }
        : { ...anchor, dx: gap.dx ?? anchor.dx, dy: gap.dy ?? anchor.dy },
    );
    this.commitAndRefresh();
  };

  /** an anchor chain that loops back would never settle */
  private wouldCycle = (sourceId: string, targetId: string) => {
    let id: string | null = targetId;
    for (let index = 0; index < MAX_CHAIN_LENGTH && id; index++) {
      if (id === sourceId) {
        return true;
      }
      const el = this.app.scene.getNonDeletedElement(id);
      const anchor = el && getAnchor(el);
      id = anchor && !isGuideAnchor(anchor) ? anchor.to : null;
    }
    return false;
  };

  /** brings every anchored element back in line with its anchor */
  refresh = () => {
    if (this.busy) {
      return;
    }
    this.busy = true;
    try {
      const { state, scene } = this.app;
      const interacting =
        state.selectedElementsAreBeingDragged ||
        state.isResizing ||
        state.isRotating;
      const anchored = scene
        .getNonDeletedElements()
        .filter((element) => getAnchor(element));
      if (!anchored.length) {
        this.memory.clear();
        return;
      }
      // chains settle front to back; a few passes cover them
      for (let pass = 0; pass < SETTLE_PASSES; pass++) {
        let moved = false;
        for (const element of anchored) {
          moved = this.follow(element, interacting) || moved;
        }
        if (!moved) {
          break;
        }
      }
    } finally {
      this.busy = false;
    }
  };

  /** where the follower and its target are, and how far the follower is off */
  private measure = (
    element: NonDeletedExcalidrawElement,
    anchor: Anchor,
  ): { current: Memory; delta: { x: number; y: number } } | null => {
    const box = this.bounds(element);
    if (isGuideAnchor(anchor)) {
      const guide = this.app.state.guides.find(
        (candidate) => candidate.id === anchor.guide,
      );
      if (!guide) {
        return null;
      }
      const edgeCoordinate = guideEdgeCoordinate(box, guide.axis, anchor.edge);
      return {
        current:
          guide.axis === "x"
            ? { ex: edgeCoordinate, ey: 0, tx: guide.position, ty: 0 }
            : { ex: 0, ey: edgeCoordinate, tx: 0, ty: guide.position },
        delta: solveGuideAnchor(box, guide, anchor),
      };
    }
    const target = this.app.scene.getNonDeletedElement(anchor.to);
    if (!target) {
      return null;
    }
    const targetBox = this.bounds(target);
    const [ex, ey] = pointOnBounds(box, anchor.at);
    const [tx, ty] = pointOnBounds(targetBox, anchor.from);
    return {
      current: { ex, ey, tx, ty },
      delta: solveElementAnchor(box, targetBox, anchor),
    };
  };

  /** @returns true when the follower was moved */
  private follow = (
    element: NonDeletedExcalidrawElement,
    interacting: boolean,
  ) => {
    const anchor = getAnchor(element)!;
    const measured = this.measure(element, anchor);
    if (!measured) {
      return false;
    }
    const { delta } = measured;
    let { current } = measured;
    const previous = this.memory.get(element.id);
    const targetMoved =
      !previous ||
      Math.abs(previous.tx - current.tx) > EPSILON ||
      Math.abs(previous.ty - current.ty) > EPSILON;
    const elementMoved =
      !!previous &&
      (Math.abs(previous.ex - current.ex) > EPSILON ||
        Math.abs(previous.ey - current.ey) > EPSILON);

    let moved = false;
    if (
      targetMoved &&
      (Math.abs(delta.x) > EPSILON || Math.abs(delta.y) > EPSILON)
    ) {
      this.moveBy(element, delta.x, delta.y);
      moved = true;
      current = {
        ...current,
        ex: current.ex + delta.x,
        ey: current.ey + delta.y,
      };
    } else if (!targetMoved && elementMoved && !interacting) {
      // the follower was moved on purpose: it keeps its new gap
      const next: Anchor = isGuideAnchor(anchor)
        ? { ...anchor, offset: anchor.offset - delta.x - delta.y }
        : { ...anchor, dx: anchor.dx - delta.x, dy: anchor.dy - delta.y };
      this.app.scene.mutateElement(element, {
        customData: withAnchor(element.customData, next),
      });
    }
    this.memory.set(element.id, current);
    return moved;
  };

  beginPick = (sourceId: string, from: AnchorPoint, at: AnchorPoint) => {
    this.cancelPick();
    this.app.setState({ anchorPick: { sourceId, from, at } });
    this.stopPicking = listenToGesture(this.app.ownerWindow, {
      onKeyDown: onEscape(this.cancelPick),
    });
  };

  cancelPick = () => {
    this.stopPicking?.();
    this.stopPicking = null;
    if (this.app.state.anchorPick) {
      this.app.setState({ anchorPick: null });
    }
  };

  /** @returns true when the click was spent on choosing (or dropping) the target */
  handlePointerDown = (event: React.PointerEvent<HTMLElement>): boolean => {
    const pick = this.app.state.anchorPick;
    if (!pick) {
      return false;
    }
    const point = viewportCoordsToSceneCoords(event, this.app.state);
    const hit = this.app.getElementAtPosition(point.x, point.y);
    if (hit && hit.id !== pick.sourceId) {
      this.setElementAnchor(pick.sourceId, hit.id, pick.from, pick.at);
    }
    this.cancelPick();
    return true;
  };

  destroy = () => {
    this.cancelPick();
    this.memory.clear();
  };
}
