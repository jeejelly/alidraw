import { randomId, viewportCoordsToSceneCoords } from "@excalidraw/common";

import { type Guide } from "../guides";

import { ChangeNotifier } from "./changeNotifier";
import { listenToGesture, onEscape } from "./gestureListeners";

import type App from "./App";

/** a guide within this many screen px of the pointer can be grabbed */
const GRAB_DISTANCE = 4;

export const RULER_SIZE = 20;

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

/** Dragging guides, new ones off a ruler or existing ones off the canvas; dropped over a ruler, a guide is deleted. */
export class AppGuides {
  private readout: GuideReadout | null = null;
  /** the guide whose exact position is being typed (no window.prompt in Electron) */
  private editing: GuideEdit | null = null;
  private notifier = new ChangeNotifier();
  private teardown: (() => void) | null = null;

  constructor(private app: App) {}

  subscribe = this.notifier.subscribe;

  getReadout = () => this.readout;

  private setReadout = (readout: GuideReadout | null) => {
    this.readout = readout;
    this.notifier.notify();
  };

  getEditing = () => this.editing;

  cancelEdit = () => {
    this.editing = null;
    this.notifier.notify();
  };

  /** applies a typed position; empty or non-numeric input changes nothing */
  commitEdit = (answer: string) => {
    const edit = this.editing;
    this.editing = null;
    this.notifier.notify();
    const value = Number(answer);
    if (edit && answer.trim() !== "" && Number.isFinite(value)) {
      this.setGuides(
        this.app.state.guides.map((guide) =>
          guide.id === edit.id ? { ...guide, position: value } : guide,
        ),
      );
    }
  };

  private setGuides = (guides: readonly Guide[]) =>
    this.app.setState({ guides });

  private scenePoint = (event: { clientX: number; clientY: number }) =>
    viewportCoordsToSceneCoords(event, this.app.state);

  /** whole px, unless Alt is held for a free position */
  private place = (axis: Guide["axis"], event: PointerEvent | MouseEvent) => {
    const point = this.scenePoint(event);
    const coordinate = axis === "x" ? point.x : point.y;
    return event.altKey ? coordinate : Math.round(coordinate);
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
    const original = this.app.state.guides.find((guide) => guide.id === id);
    const withoutDragged = () =>
      this.app.state.guides.filter((guide) => guide.id !== id);

    const moveGuideTo = (position: number) =>
      this.setGuides([...withoutDragged(), { id, axis, position }]);

    this.teardown = listenToGesture(this.app.ownerWindow, {
      onPointerMove: (event) => {
        const position = this.place(axis, event);
        moveGuideTo(position);
        this.setReadout({
          clientX: event.clientX,
          clientY: event.clientY,
          axis,
          position,
          willDelete: this.isOverRuler(axis, event),
        });
      },
      onPointerUp: (event) => {
        if (this.isOverRuler(axis, event)) {
          this.setGuides(withoutDragged());
        } else {
          moveGuideTo(this.place(axis, event));
        }
        this.stop();
      },
      onKeyDown: onEscape(() => {
        // cancel: back to where it was
        this.setGuides(
          original ? [...withoutDragged(), original] : withoutDragged(),
        );
        this.stop();
      }),
    });
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
    const point = this.scenePoint(event);
    const grabRadius = GRAB_DISTANCE / zoom.value;
    let best: Guide | null = null;
    let bestDistance = Infinity;
    for (const guide of guides) {
      const distance = Math.abs(
        (guide.axis === "x" ? point.x : point.y) - guide.position,
      );
      if (distance <= grabRadius && distance < bestDistance) {
        best = guide;
        bestDistance = distance;
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
    this.notifier.notify();
    return true;
  };

  clear = () => this.setGuides([]);
}
