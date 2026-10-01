import {
  EVENT,
  KEYS,
  viewportCoordsToSceneCoords,
  MIME_TYPES,
} from "@excalidraw/common";
import {
  getElementAbsoluteCoords,
  getElementWithTransformHandleType,
  getPathGeometryFromShape,
  getPathUpdate,
  isPathElement,
  newElementWith,
  setSingleElementAngle,
  shearPathGeometry,
  updateBoundElements,
} from "@excalidraw/element";

import type {
  ExcalidrawPathElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import type { Radians } from "@excalidraw/math";

import {
  canRotateWithGizmo,
  canSkewWithGizmo,
  getGizmoZone,
  getSkewFactor,
  gizmoToLocal,
  sameZone,
  skewPivot,
  snapAngle,
  snapToAlignment,
  type AlignCandidate,
  type GizmoZone,
} from "../gizmo";

import type App from "./App";

const cursorUrl = (svg: string) =>
  `url("data:${MIME_TYPES.svg},${encodeURIComponent(svg)}") 12 12, auto`;

const ROTATE_ARROW =
  '<path d="M6 12a6 6 0 0 1 10.5-4" /><path d="M17 4v4h-4" /><path d="M18 12a6 6 0 0 1-10.5 4" /><path d="M7 20v-4h4" />';
const SKEW_ARROW =
  '<path d="M3 12h18" /><path d="M6 9l-3 3 3 3" /><path d="M18 9l3 3-3 3" />';

const makeCursor = (inner: string, deg: number) =>
  cursorUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><g transform="rotate(${deg} 12 12)"><g stroke="#fff" stroke-width="4">${inner}</g><g stroke="#1b1b1f" stroke-width="1.6">${inner}</g></g></svg>`,
  );

const CLICK_SLOP = 3;

type Gesture =
  | {
      kind: "rotate";
      id: string;
      angle0: number;
      theta0: number;
      cx: number;
      cy: number;
    }
  | {
      kind: "skew";
      id: string;
      edge: "n" | "e" | "s" | "w";
      base: ExcalidrawPathElement;
      start: [number, number];
      cx: number;
      cy: number;
    };

/**
 * The rotate / skew gizmo around the single selected element (see
 * `gizmo.ts` for the zones). Owns its pointer from press to release; Shift
 * steps in 15°, Alt works from the centre (skew), Escape cancels.
 */
export class AppGizmo {
  private gesture: Gesture | null = null;
  private teardown: (() => void) | null = null;
  /** where the press began: a release that never left it is a plain click */
  private pressedAt: { x: number; y: number } | null = null;
  private moved = false;

  constructor(private app: App) {}

  isActive = () => this.gesture !== null;

  private target = (): NonDeletedExcalidrawElement | null => {
    const s = this.app.state;
    if (
      s.activeTool.type !== "selection" ||
      s.viewModeEnabled ||
      s.editingPath ||
      s.editingTextElement ||
      s.croppingElementId ||
      s.selectedLinearElement?.isEditing ||
      s.newElement
    ) {
      return null;
    }
    const selected = this.app.scene.getSelectedElements(s);
    if (selected.length !== 1 || !canRotateWithGizmo(selected[0] as any)) {
      return null;
    }
    return selected[0];
  };

  private frame = (el: NonDeletedExcalidrawElement) => {
    const [x1, y1, x2, y2, cx, cy] = getElementAbsoluteCoords(
      el,
      this.app.scene.getNonDeletedElementsMap(),
    );
    return { hw: (x2 - x1) / 2, hh: (y2 - y1) / 2, cx, cy };
  };

  private zoneAt = (event: { clientX: number; clientY: number }) => {
    const el = this.target();
    if (!el) {
      return null;
    }
    const p = viewportCoordsToSceneCoords(event, this.app.state);
    const { hw, hh, cx, cy } = this.frame(el);
    const [lx, ly] = gizmoToLocal(p.x, p.y, cx, cy, el.angle);
    const zone = getGizmoZone(
      lx,
      ly,
      hw,
      hh,
      this.app.state.zoom.value,
      canSkewWithGizmo(el as any),
    );
    return zone ? { zone, el } : null;
  };

  private setGizmo = (
    patch: Partial<NonNullable<typeof this.app.state.gizmo>>,
  ) =>
    this.app.setState((prev) => ({
      gizmo: {
        hover: prev.gizmo?.hover ?? null,
        readout: prev.gizmo?.readout ?? null,
        align: prev.gizmo?.align ?? [],
        ...patch,
      },
    }));

  /** @returns true when the pointer is over a zone (the cursor is ours) */
  handleHover = (event: { clientX: number; clientY: number }): boolean => {
    if (this.gesture) {
      return true;
    }
    const hit = this.zoneAt(event);
    const prev = this.app.state.gizmo?.hover ?? null;
    if (!sameZone(prev, hit?.zone ?? null)) {
      this.setGizmo({ hover: hit?.zone ?? null });
    }
    if (!hit) {
      return false;
    }
    const deg = (hit.el.angle * 180) / Math.PI;
    if (hit.zone.kind === "rotate") {
      const base = { nw: 0, ne: 90, se: 180, sw: 270 }[hit.zone.corner];
      this.app.cursor.set(makeCursor(ROTATE_ARROW, deg + base));
    } else {
      const along = hit.zone.edge === "n" || hit.zone.edge === "s" ? 0 : 90;
      this.app.cursor.set(makeCursor(SKEW_ARROW, deg + along));
    }
    return true;
  };

  /** @returns true when a zone was grabbed */
  handlePointerDown = (event: React.PointerEvent<HTMLElement>): boolean => {
    // Shift adds to the selection and Ctrl/Cmd deep-selects: not ours
    if (event.button !== 0 || event.shiftKey || event[KEYS.CTRL_OR_CMD]) {
      return false;
    }
    const hit = this.zoneAt(event);
    if (!hit) {
      return false;
    }
    // the regular handles win where they overlap
    const s = this.app.state;
    const p = viewportCoordsToSceneCoords(event, s);
    const handle = getElementWithTransformHandleType(
      [hit.el],
      s,
      p.x,
      p.y,
      s.zoom,
      event.pointerType as any,
      this.app.scene.getNonDeletedElementsMap(),
      this.app.editorInterface,
    );
    if (handle?.transformHandleType) {
      return false;
    }
    // another shape under the pointer is simply clicked
    const under = this.app.getElementAtPosition(p.x, p.y);
    if (under && under.id !== hit.el.id) {
      return false;
    }
    this.pressedAt = { x: event.clientX, y: event.clientY };
    return this.begin(hit.zone, hit.el, p);
  };

  private begin = (
    zone: GizmoZone,
    el: NonDeletedExcalidrawElement,
    p: { x: number; y: number },
  ) => {
    if (zone.kind === "rotate") {
      const { cx, cy } = this.frame(el);
      this.gesture = {
        kind: "rotate",
        id: el.id,
        angle0: el.angle,
        theta0: Math.atan2(p.y - cy, p.x - cx),
        cx,
        cy,
      };
    } else {
      const path = this.ensurePath(el);
      if (!path) {
        return false;
      }
      const { cx, cy } = this.frame(path as NonDeletedExcalidrawElement);
      const [lx, ly] = gizmoToLocal(p.x, p.y, cx, cy, path.angle);
      this.gesture = {
        kind: "skew",
        id: path.id,
        edge: zone.edge,
        base: { ...path },
        start: [lx, ly],
        cx,
        cy,
      };
    }
    this.listen();
    return true;
  };

  /** rectangle / diamond / ellipse become paths so they can shear */
  private ensurePath = (
    el: NonDeletedExcalidrawElement,
  ): ExcalidrawPathElement | null => {
    if (isPathElement(el)) {
      return el;
    }
    if (
      el.type !== "rectangle" &&
      el.type !== "diamond" &&
      el.type !== "ellipse"
    ) {
      return null;
    }
    const { points, handles } = getPathGeometryFromShape(el);
    // a new object of another type under the same id
    const converted = newElementWith(
      {
        ...el,
        type: "path",
        points,
        handles,
        closed: true,
        roundness: null,
      } as unknown as ExcalidrawPathElement,
      {},
    );
    this.app.scene.replaceAllElements(
      this.app.scene
        .getElementsIncludingDeleted()
        .map((e) => (e.id === el.id ? converted : e)),
    );
    return this.app.scene.getNonDeletedElement(el.id) as ExcalidrawPathElement;
  };

  private readout = (event: PointerEvent, text: string) => {
    const p = viewportCoordsToSceneCoords(event, this.app.state);
    this.setGizmo({
      readout: {
        x: p.x + 14 / this.app.state.zoom.value,
        y: p.y + 14 / this.app.state.zoom.value,
        text,
      },
    });
  };

  /** the page axes, and every other element's own axes through its centre */
  private alignCandidates = (exceptId: string): AlignCandidate[] => {
    const map = this.app.scene.getNonDeletedElementsMap();
    const out: AlignCandidate[] = [];
    for (const other of this.app.scene.getNonDeletedElements()) {
      if (other.id === exceptId || other.isDeleted) {
        continue;
      }
      const [, , , , cx, cy] = getElementAbsoluteCoords(other, map);
      out.push({ angle: other.angle, x: cx, y: cy });
    }
    // the page axes, through the turning element's own centre
    const self = this.app.scene.getNonDeletedElement(exceptId);
    if (self) {
      const [, , , , cx, cy] = getElementAbsoluteCoords(self, map);
      out.push({ angle: 0, x: cx, y: cy });
    }
    return out;
  };

  private move = (event: PointerEvent) => {
    const g = this.gesture;
    if (!g) {
      return;
    }
    const p = viewportCoordsToSceneCoords(event, this.app.state);
    if (
      this.pressedAt &&
      Math.hypot(
        event.clientX - this.pressedAt.x,
        event.clientY - this.pressedAt.y,
      ) < CLICK_SLOP
    ) {
      return;
    }
    this.moved = true;
    const el = this.app.scene.getNonDeletedElement(g.id);
    if (!el) {
      return;
    }
    if (g.kind === "rotate") {
      let angle = g.angle0 + (Math.atan2(p.y - g.cy, p.x - g.cx) - g.theta0);
      let matches: { angle: number; x: number; y: number }[] = [];
      if (event.shiftKey) {
        angle = snapAngle(angle);
      } else if (!event.altKey) {
        // lock onto the axes of the other elements and of the page
        const snapped = snapToAlignment(angle, this.alignCandidates(g.id));
        angle = snapped.angle;
        matches = snapped.matches;
      }
      angle = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      setSingleElementAngle(el, this.app.scene, angle as Radians);
      updateBoundElements(el, this.app.scene);
      this.readout(
        event,
        `${Math.round((angle * 180) / Math.PI)}°${matches.length ? " ⟂" : ""}`,
      );
      this.setGizmo({
        align: matches.map((m) => ({ x: m.x, y: m.y, angle: m.angle })),
      });
      return;
    }
    const base = g.base;
    const hw = base.width / 2;
    const hh = base.height / 2;
    const [lx, ly] = gizmoToLocal(p.x, p.y, g.cx, g.cy, base.angle);
    const horizontal = g.edge === "n" || g.edge === "s";
    const drag = horizontal ? lx - g.start[0] : ly - g.start[1];
    const k = getSkewFactor(g.edge, drag, hw, hh, {
      fromCenter: event.altKey,
      snap: event.shiftKey,
    });
    const geometry = shearPathGeometry(
      base,
      horizontal ? "x" : "y",
      k,
      skewPivot(g.edge, hw, hh, event.altKey),
    );
    this.app.scene.mutateElement(el as ExcalidrawPathElement, {
      ...getPathUpdate(base, geometry),
    });
    this.readout(event, `${Math.round((Math.atan(k) * 1800) / Math.PI) / 10}°`);
  };

  private finish = (cancel: boolean) => {
    const g = this.gesture;
    this.gesture = null;
    this.teardown?.();
    this.teardown = null;
    if (g && cancel) {
      const el = this.app.scene.getNonDeletedElement(g.id);
      if (el) {
        if (g.kind === "rotate") {
          setSingleElementAngle(el, this.app.scene, g.angle0 as Radians);
        } else {
          this.app.scene.mutateElement(el as ExcalidrawPathElement, {
            x: g.base.x,
            y: g.base.y,
            width: g.base.width,
            height: g.base.height,
            points: g.base.points,
            handles: g.base.handles,
          });
        }
      }
    }
    const wasClick = !this.moved && !cancel;
    this.moved = false;
    this.pressedAt = null;
    if (g && wasClick) {
      // a press in the zone that never moved is a click on empty canvas
      this.app.clearSelection(null);
    }
    this.app.store.scheduleCapture();
    this.app.setState((prev) => ({
      gizmo: { hover: prev.gizmo?.hover ?? null, readout: null, align: [] },
    }));
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
