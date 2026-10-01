import {
  CaptureUpdateAction,
  getBoundTextElement,
  getElementBounds,
  isPathElement,
  scalePathGeometry,
  updateBoundElements,
} from "@excalidraw/element";

import { fitBoundsToGrid } from "../anchors";

import { DEFAULT_CATEGORIES } from "../components/CommandPalette/CommandPalette";

import { register } from "./register";

const RESIZABLE = new Set([
  "rectangle",
  "diamond",
  "ellipse",
  "image",
  "frame",
  "magicframe",
  "path",
]);

/**
 * Puts the selection on the grid: each element's edges go to the nearest grid
 * lines (never smaller than one cell). Shapes resize to fit; text, lines and
 * rotated or labelled elements keep their size and only move.
 */
export const actionFitToGrid = register({
  name: "fitToGrid",
  label: "labels.grid.fit",
  category: DEFAULT_CATEGORIES.elements,
  keywords: ["grid", "snap", "align", "pixel", "fit"],
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) =>
    app.scene.getSelectedElements(appState).length > 0,
  perform: (elements, appState, _, app) => {
    const size = appState.gridSize;
    const scene = app.scene;
    const map = scene.getNonDeletedElementsMap();
    const selected = scene.getSelectedElements(appState);
    if (!selected.length || !(size > 0)) {
      return false;
    }
    for (const el of selected) {
      const box = getElementBounds(el, map);
      const canResize =
        RESIZABLE.has(el.type) &&
        el.angle === 0 &&
        !getBoundTextElement(el, map);
      const fitted = fitBoundsToGrid(box, size, { keepSize: !canResize });
      if (canResize) {
        if (isPathElement(el)) {
          const geometry = scalePathGeometry(
            el,
            (fitted[2] - fitted[0]) / (el.width || 1),
            (fitted[3] - fitted[1]) / (el.height || 1),
          );
          scene.mutateElement(el, {
            x: fitted[0],
            y: fitted[1],
            width: fitted[2] - fitted[0],
            height: fitted[3] - fitted[1],
            points: geometry.points,
            handles: geometry.handles,
            ...(geometry.contours ? { contours: geometry.contours } : {}),
          });
        } else {
          scene.mutateElement(el, {
            x: fitted[0],
            y: fitted[1],
            width: fitted[2] - fitted[0],
            height: fitted[3] - fitted[1],
          });
        }
      } else {
        const dx = fitted[0] - box[0];
        const dy = fitted[1] - box[1];
        scene.mutateElement(el, { x: el.x + dx, y: el.y + dy });
        const text = getBoundTextElement(el, map);
        if (text) {
          scene.mutateElement(text, { x: text.x + dx, y: text.y + dy });
        }
      }
      updateBoundElements(el, scene);
    }
    return {
      elements: scene.getElementsIncludingDeleted(),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
