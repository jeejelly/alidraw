import { updateActiveTool } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  cutOutlines,
  getOutline,
  isPathfinderOperand,
  newElementWith,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawPathElement,
} from "@excalidraw/element/types";

import { asClosedPath } from "./pathShape";
import { register } from "./register";

export type KnifeCut = { from: [number, number]; to: [number, number] };

/**
 * The knife: cuts the selected closed shapes (every closed shape when nothing
 * is selected) along a segment. Each cut shape is replaced, in place in the
 * stack, by its pieces.
 */
export const actionKnifeCut = register<KnifeCut>({
  name: "knifeCut",
  label: "labels.knife.cut",
  trackEvent: { category: "element" },
  perform: async (elements, appState, value, app) => {
    if (!value) {
      return false;
    }
    const selected = new Set(
      app.scene.getSelectedElements(appState).map((element) => element.id),
    );
    const targets = elements.filter(
      (element) =>
        isPathfinderOperand(element) &&
        !element.locked &&
        (selected.size === 0 || selected.has(element.id)),
    );
    if (!targets.length) {
      return false;
    }
    const cuts = await cutOutlines(
      targets.map((element) => getOutline(element)!),
      value.from,
      value.to,
    );
    const pieces = new Map<string, ExcalidrawPathElement[]>();
    targets.forEach((target, index) => {
      const parts = cuts[index];
      if (!parts) {
        return;
      }
      pieces.set(
        target.id,
        parts.map((loop) => asClosedPath(target, loop)),
      );
    });
    if (!pieces.size) {
      return false;
    }
    const next: ExcalidrawElement[] = [];
    for (const element of elements) {
      const parts = pieces.get(element.id);
      if (parts) {
        next.push(newElementWith(element, { isDeleted: true }), ...parts);
      } else {
        next.push(element);
      }
    }
    return {
      elements: next,
      appState: {
        ...appState,
        // done cutting: back to the selection tool (unless it is locked)
        activeTool: appState.activeTool.locked
          ? appState.activeTool
          : updateActiveTool(appState, { type: "selection" }),
        selectedElementIds: Object.fromEntries(
          [...pieces.values()].flat().map((piece) => [piece.id, true]),
        ),
        selectedGroupIds: {},
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
