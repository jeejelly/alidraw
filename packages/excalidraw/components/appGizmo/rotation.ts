import {
  getElementAbsoluteCoords,
  rotateElementsBy,
  setSingleElementAngle,
  updateBoundElements,
} from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import type { Radians } from "@excalidraw/math";

import {
  AngleKeys,
  lockAngle,
  magnetAngle,
  normalizeAngle,
  toDegrees,
} from "../../remarkableAngles";
import {
  snapAngle,
  snapToAlignment,
  type AlignCandidate,
  type GizmoTarget,
} from "../../gizmo";

import type App from "../App";
import type { GizmoOverlay } from "./overlay";
import type { RotateGesture, ScenePoint } from "./types";

/** matches closer than this (scene px) to the turning centre are the page axis */
const PAGE_AXIS_TOLERANCE = 1e-6;
/** how many aligned elements get a guide line besides the page axis */
const MAX_ALIGN_GUIDES = 2;

type SnapOutcome = {
  angle: number;
  matches: AlignCandidate[];
  how: "free" | "key" | "step" | "align" | "magnet";
};

const HOW_SUFFIX = { free: "", step: "", align: " ⟂", magnet: " ◆" } as const;

/** Turns the selection about its centre, snapping to keys, steps, axes and remarkable angles. */
export class GizmoRotation {
  /** number keys lock the angle while held */
  readonly keys = new AngleKeys();

  constructor(private app: App, private overlay: GizmoOverlay) {}

  begin = (target: GizmoTarget, point: ScenePoint): RotateGesture => {
    const { cx, cy, angle } = target.frame;
    return {
      kind: "rotate",
      ids: target.elements.map((element) => element.id),
      angles: new Map(
        target.elements.map((element) => [element.id, element.angle]),
      ),
      startAngle: angle,
      startTheta: Math.atan2(point.y - cy, point.x - cx),
      cx,
      cy,
    };
  };

  /** shows what the held number key does */
  startKeyHelper = () => {
    this.app.setState({ angleHelper: { active: null } });
    this.keys.start(this.app.ownerWindow, () =>
      this.app.setState({ angleHelper: { active: this.keys.key } }),
    );
  };

  /** the page axes, and every other element's own axes through its centre */
  private alignCandidates = (
    except: readonly string[],
    centre: { cx: number; cy: number },
  ): AlignCandidate[] => {
    const elementsMap = this.app.scene.getNonDeletedElementsMap();
    const candidates: AlignCandidate[] = [];
    for (const other of this.app.scene.getNonDeletedElements()) {
      if (except.includes(other.id) || other.isDeleted) {
        continue;
      }
      const [, , , , cx, cy] = getElementAbsoluteCoords(other, elementsMap);
      candidates.push({ angle: other.angle, x: cx, y: cy });
    }
    // the page axes, through the turning selection's own centre
    candidates.push({ angle: 0, x: centre.cx, y: centre.cy });
    return candidates;
  };

  private snap = (
    gesture: RotateGesture,
    rawAngle: number,
    event: PointerEvent,
  ): SnapOutcome => {
    const key = this.keys.key;
    if (key) {
      // a held number key asks for that angle outright
      return {
        angle: lockAngle(key, rawAngle, Math.PI / 2) ?? rawAngle,
        matches: [],
        how: "key",
      };
    }
    if (event.shiftKey) {
      return { angle: snapAngle(rawAngle), matches: [], how: "step" };
    }
    if (event.altKey) {
      return { angle: rawAngle, matches: [], how: "free" };
    }
    // the axes of the other elements first, then the remarkable angles
    const aligned = snapToAlignment(
      rawAngle,
      this.alignCandidates(gesture.ids, gesture),
    );
    if (aligned.matches.length) {
      return { angle: aligned.angle, matches: aligned.matches, how: "align" };
    }
    const magnet = magnetAngle(normalizeAngle(rawAngle));
    return magnet.snapped
      ? { angle: magnet.angle, matches: [], how: "magnet" }
      : { angle: rawAngle, matches: [], how: "free" };
  };

  private getElements = (gesture: RotateGesture) =>
    gesture.ids
      .map((id) => this.app.scene.getNonDeletedElement(id))
      .filter(Boolean) as NonDeletedExcalidrawElement[];

  move = (gesture: RotateGesture, event: PointerEvent, point: ScenePoint) => {
    const rawAngle =
      gesture.startAngle +
      (Math.atan2(point.y - gesture.cy, point.x - gesture.cx) -
        gesture.startTheta);
    const snapped = this.snap(gesture, rawAngle, event);
    const angle = normalizeAngle(snapped.angle);
    const elements = this.getElements(gesture);
    if (elements.length === 1) {
      setSingleElementAngle(elements[0], this.app.scene, angle as Radians);
      updateBoundElements(elements[0], this.app.scene);
    } else {
      // a group turns as one: every shape about the box's centre
      rotateElementsBy(
        elements,
        gesture.angles,
        this.app.scene,
        gesture.cx,
        gesture.cy,
        angle - gesture.startAngle,
      );
    }
    const suffix =
      snapped.how === "key" ? ` ⌨${this.keys.key}` : HOW_SUFFIX[snapped.how];
    this.overlay.readout(event, `${toDegrees(angle)}°${suffix}`);
    this.overlay.set({ align: this.alignGuides(gesture, snapped.matches) });
  };

  /** the page axis, and only the two nearest elements it lined up with */
  private alignGuides = (gesture: RotateGesture, matches: AlignCandidate[]) => {
    const distance = (match: AlignCandidate) =>
      Math.hypot(match.x - gesture.cx, match.y - gesture.cy);
    const shown = [
      ...matches.filter((match) => distance(match) < PAGE_AXIS_TOLERANCE),
      ...matches
        .filter((match) => distance(match) >= PAGE_AXIS_TOLERANCE)
        .sort((first, second) => distance(first) - distance(second))
        .slice(0, MAX_ALIGN_GUIDES),
    ];
    return shown.map((match) => ({
      x: match.x,
      y: match.y,
      angle: match.angle,
      tx: gesture.cx,
      ty: gesture.cy,
    }));
  };

  /** puts the elements back at the angles they had when the gesture began */
  cancel = (gesture: RotateGesture) => {
    const elements = this.getElements(gesture);
    if (elements.length === 1) {
      setSingleElementAngle(
        elements[0],
        this.app.scene,
        gesture.startAngle as Radians,
      );
    } else {
      rotateElementsBy(
        elements,
        gesture.angles,
        this.app.scene,
        gesture.cx,
        gesture.cy,
        0,
      );
    }
  };
}
