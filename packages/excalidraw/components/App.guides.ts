import {
  EVENT,
  randomId,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import { type Guide } from "../guides";

import type App from "./App";

/** a guide within this many screen px of the pointer can be grabbed */
const GRAB_DISTANCE = 4;

export type GuideReadout = {
  /** viewport coordinates of the pointer */
  clientX: number;
  clientY: number;
  axis: Guide["axis"];
  position: number;
  /** released here, the guide is deleted */
  willDelete: boolean;
};

export type GuideEdit = {
  id: string;
  axis: Guide["axis"];
  position: number;
  /** viewport coordinates where the input appears */
  clientX: number;
  clientY: number;
};

/**
 * Dragging guides: new ones off a ruler, existing ones off the canvas. The
 * pointer owns window listeners until release; over a ruler, the guide is
 * dropped (deleted).
 */
export class AppGuides {
  private readout: GuideReadout | null = null;
  private listeners = new Set<() => void>();
  private teardown: (() => void) | null = null;

  constructor(private app: App) {}

  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };

  getReadout = () => this.readout;

  private notify = () => this.listeners.forEach((cb) => cb());

  private setReadout = (readout: GuideReadout | null) => {
    this.readout = readout;
    this.notify();
  };

  /** the guide whose exact position is being typed (no window.prompt in Electron) */
  private editing: GuideEdit | null = null;

  getEditing = () => this.editing;

  cancelEdit = () => {
    this.editing = null;
    this.notify();
  };

  /** applies a typed position; empty or non-numeric input changes nothing */
  commitEdit = (answer: string) => {
    const edit = this.editing;
    this.editing = null;
    this.notify();
    const value = Number(answer);
    if (edit && answer.trim() !== "" && Number.isFinite(value)) {
      this.setGuides(
        this.app.state.guides.map((g) =>
          g.id === edit.id ? { ...g, position: value } : g,
        ),
      );
    }
  };

  private setGuides = (guides: readonly Guide[]) =>
    this.app.setState({ guides });

  private scene = (event: { clientX: number; clientY: number }) =>
    viewportCoordsToSceneCoords(event, this.app.state);

  /** whole px, unless Alt is held for a free position */
  private place = (axis: Guide["axis"], event: PointerEvent | MouseEvent) => {
    const p = this.scene(event);
    const v = axis === "x" ? p.x : p.y;
    return event.altKey ? v : Math.round(v);
  };

  private isOverRuler = (axis: Guide["axis"], event: PointerEvent) => {
    const { offsetLeft, offsetTop, rulersEnabled } = this.app.state;
    if (!rulersEnabled) {
      return false;
    }
    return axis === "x"
      ? event.clientX - offsetLeft < RULER_SIZE
      : event.clientY - offsetTop < RULER_SIZE;
  };

  /** starts dragging `guideId`, or a new guide of `axis` when null */
  startDrag = (axis: Guide["axis"], guideId: string | null) => {
    this.teardown?.();
    const id = guideId ?? randomId();
    const original = this.app.state.guides.find((g) => g.id === id);

    const apply = (position: number) => {
      const others = this.app.state.guides.filter((g) => g.id !== id);
      this.setGuides([...others, { id, axis, position }]);
    };

    const onMove = (event: PointerEvent) => {
      const position = this.place(axis, event);
      const willDelete = this.isOverRuler(axis, event);
      apply(position);
      this.setReadout({
        clientX: event.clientX,
        clientY: event.clientY,
        axis,
        position,
        willDelete,
      });
    };
    const onUp = (event: PointerEvent) => {
      const willDelete = this.isOverRuler(axis, event);
      if (willDelete) {
        this.setGuides(this.app.state.guides.filter((g) => g.id !== id));
      } else {
        apply(this.place(axis, event));
      }
      this.stop();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // cancel: back to where it was
        this.setGuides(
          original
            ? [...this.app.state.guides.filter((g) => g.id !== id), original]
            : this.app.state.guides.filter((g) => g.id !== id),
        );
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
  };

  private stop = () => {
    this.teardown?.();
    this.teardown = null;
    this.setReadout(null);
  };

  destroy = () => this.stop();

  /** the guide under a viewport point, if any */
  hitGuide = (event: { clientX: number; clientY: number }): Guide | null => {
    const { zoom, guides, guidesLocked } = this.app.state;
    if (guidesLocked) {
      return null;
    }
    const p = this.scene(event);
    const r = GRAB_DISTANCE / zoom.value;
    let best: Guide | null = null;
    let bestD = Infinity;
    for (const g of guides) {
      const d = Math.abs((g.axis === "x" ? p.x : p.y) - g.position);
      if (d <= r && d < bestD) {
        best = g;
        bestD = d;
      }
    }
    return best;
  };

  /** @returns true when a guide was grabbed */
  handlePointerDown = (event: React.PointerEvent<HTMLElement>): boolean => {
    if (
      event.button !== 0 ||
      !this.app.state.guides.length ||
      this.app.state.viewModeEnabled ||
      this.app.state.activeTool.type !== "selection"
    ) {
      return false;
    }
    const guide = this.hitGuide(event);
    if (!guide) {
      return false;
    }
    this.startDrag(guide.axis, guide.id);
    return true;
  };

  /** double click a guide: type its exact position */
  handleDoubleClick = (event: { clientX: number; clientY: number }) => {
    const guide = this.hitGuide(event);
    if (!guide) {
      return false;
    }
    this.editing = {
      id: guide.id,
      axis: guide.axis,
      position: guide.position,
      clientX: event.clientX,
      clientY: event.clientY,
    };
    this.notify();
    return true;
  };

  clear = () => this.setGuides([]);
}

export const RULER_SIZE = 20;
