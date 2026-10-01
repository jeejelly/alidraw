import { EVENT, viewportCoordsToSceneCoords } from "@excalidraw/common";
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

import type App from "./App";

const EPSILON = 0.01;

type Memory = { ex: number; ey: number; tx: number; ty: number };

/**
 * Keeps anchored elements where their anchors say: when the target (another
 * element or a ruler guide) moves, the follower follows; when the follower is
 * moved on purpose, the anchor takes the new gap. See `anchors.ts`.
 */
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

  private writeAnchor = (
    el: NonDeletedExcalidrawElement,
    anchor: Anchor | null,
  ) => {
    this.app.scene.mutateElement(el, {
      customData: withAnchor(el.customData, anchor),
    });
    this.memory.delete(el.id);
  };

  // ---------------------------------------------------------------------------
  // setting
  // ---------------------------------------------------------------------------

  /**
   * Hangs `at` of the element off `from` of the target. With `snap` the
   * element jumps onto the point (gap 0); otherwise it stays where it is and
   * the gap it has now is kept.
   */
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
    this.app.store.scheduleCapture();
    this.refresh();
    this.app.setState({});
    return true;
  };

  setGuideAnchor = (
    sourceId: string,
    guideId: string,
    edge: GuideEdge,
    snap = false,
  ) => {
    const source = this.app.scene.getNonDeletedElement(sourceId);
    const guide = this.app.state.guides.find((g) => g.id === guideId);
    if (!source || !guide) {
      return false;
    }
    const at = guideEdgeCoordinate(this.bounds(source), guide.axis, edge);
    this.writeAnchor(source, {
      guide: guideId,
      edge,
      offset: snap ? 0 : at - guide.position,
    });
    this.app.store.scheduleCapture();
    this.refresh();
    this.app.setState({});
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
    this.app.store.scheduleCapture();
    this.refresh();
    this.app.setState({});
  };

  /** an anchor chain that loops back would never settle */
  private wouldCycle = (sourceId: string, targetId: string) => {
    let id: string | null = targetId;
    for (let i = 0; i < 64 && id; i++) {
      if (id === sourceId) {
        return true;
      }
      const el = this.app.scene.getNonDeletedElement(id);
      const a = el && getAnchor(el);
      id = a && !isGuideAnchor(a) ? a.to : null;
    }
    return false;
  };

  // ---------------------------------------------------------------------------
  // following
  // ---------------------------------------------------------------------------

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
        .filter((el) => getAnchor(el));
      if (!anchored.length) {
        this.memory.clear();
        return;
      }
      // chains settle front to back; a few passes cover them
      for (let pass = 0; pass < 4; pass++) {
        let moved = false;
        for (const el of anchored) {
          const anchor = getAnchor(el)!;
          const box = this.bounds(el);
          let current: { ex: number; ey: number; tx: number; ty: number };
          let delta: { x: number; y: number };
          if (isGuideAnchor(anchor)) {
            const guide = state.guides.find((g) => g.id === anchor.guide);
            if (!guide) {
              continue;
            }
            const e = guideEdgeCoordinate(box, guide.axis, anchor.edge);
            current =
              guide.axis === "x"
                ? { ex: e, ey: 0, tx: guide.position, ty: 0 }
                : { ex: 0, ey: e, tx: 0, ty: guide.position };
            delta = solveGuideAnchor(box, guide, anchor);
          } else {
            const target = scene.getNonDeletedElement(anchor.to);
            if (!target) {
              continue;
            }
            const tb = this.bounds(target);
            const [ex, ey] = pointOnBounds(box, anchor.at);
            const [tx, ty] = pointOnBounds(tb, anchor.from);
            current = { ex, ey, tx, ty };
            delta = solveElementAnchor(box, tb, anchor);
          }
          const mem = this.memory.get(el.id);
          const targetMoved =
            !mem ||
            Math.abs(mem.tx - current.tx) > EPSILON ||
            Math.abs(mem.ty - current.ty) > EPSILON;
          const elementMoved =
            !!mem &&
            (Math.abs(mem.ex - current.ex) > EPSILON ||
              Math.abs(mem.ey - current.ey) > EPSILON);

          if (
            targetMoved &&
            (Math.abs(delta.x) > EPSILON || Math.abs(delta.y) > EPSILON)
          ) {
            this.moveBy(el, delta.x, delta.y);
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
            this.app.scene.mutateElement(el, {
              customData: withAnchor(el.customData, next),
            });
          }
          this.memory.set(el.id, current);
        }
        if (!moved) {
          break;
        }
      }
    } finally {
      this.busy = false;
    }
  };

  // ---------------------------------------------------------------------------
  // picking a target on the canvas
  // ---------------------------------------------------------------------------

  beginPick = (sourceId: string, from: AnchorPoint, at: AnchorPoint) => {
    this.cancelPick();
    this.app.setState({ anchorPick: { sourceId, from, at } });
    const win = this.app.ownerWindow;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        this.cancelPick();
      }
    };
    win.addEventListener(EVENT.KEYDOWN, onKey);
    this.stopPicking = () => win.removeEventListener(EVENT.KEYDOWN, onKey);
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
    const p = viewportCoordsToSceneCoords(event, this.app.state);
    const hit = this.app.getElementAtPosition(p.x, p.y);
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
