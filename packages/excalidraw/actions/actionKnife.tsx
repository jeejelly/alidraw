import { updateActiveTool } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  cutOutlines,
  getOutline,
  getPathUpdate,
  isPathfinderOperand,
  newElementWith,
  newPathElement,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawPathElement,
} from "@excalidraw/element/types";

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
      app.scene.getSelectedElements(appState).map((el) => el.id),
    );
    const targets = elements.filter(
      (el) =>
        isPathfinderOperand(el) &&
        !el.locked &&
        (selected.size === 0 || selected.has(el.id)),
    );
    if (!targets.length) {
      return false;
    }
    const cuts = await cutOutlines(
      targets.map((el) => getOutline(el)!),
      value.from,
      value.to,
    );
    const pieces = new Map<string, ExcalidrawPathElement[]>();
    targets.forEach((el, i) => {
      const parts = cuts[i];
      if (!parts) {
        return;
      }
      pieces.set(
        el.id,
        parts.map((loop) => {
          const frame = {
            ...el,
            type: "path",
            x: 0,
            y: 0,
            angle: 0,
            width: 0,
            height: 0,
            closed: true,
            contours: undefined,
            ...loop,
          } as unknown as ExcalidrawPathElement;
          return newPathElement({
            strokeColor: el.strokeColor,
            backgroundColor: el.backgroundColor,
            fillStyle: el.fillStyle,
            strokeWidth: el.strokeWidth,
            strokeStyle: el.strokeStyle,
            roughness: el.roughness,
            opacity: el.opacity,
            roundness: null,
            groupIds: el.groupIds,
            frameId: el.frameId,
            ...getPathUpdate(frame, loop),
            closed: true,
          }) as ExcalidrawPathElement;
        }),
      );
    });
    if (!pieces.size) {
      return false;
    }
    const next: ExcalidrawElement[] = [];
    for (const el of elements) {
      const parts = pieces.get(el.id);
      if (parts) {
        next.push(newElementWith(el, { isDeleted: true }), ...parts);
      } else {
        next.push(el);
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
          [...pieces.values()].flat().map((p) => [p.id, true]),
        ),
        selectedGroupIds: {},
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
