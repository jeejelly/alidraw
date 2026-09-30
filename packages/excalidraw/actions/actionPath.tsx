import {
  CaptureUpdateAction,
  getPathGeometryFromShape,
  isConvertibleToPath,
  isPathElement,
  newElementWith,
} from "@excalidraw/element";
import { arrayToMap } from "@excalidraw/common";

import type {
  ExcalidrawElement,
  ExcalidrawPathElement,
} from "@excalidraw/element/types";

import { DEFAULT_CATEGORIES } from "../components/CommandPalette/CommandPalette";

import { register } from "./register";

/** a shape the path can replace: no bound text or arrows hang off it */
const canConvert = (element: ExcalidrawElement) =>
  isConvertibleToPath(element) && !(element.boundElements?.length ?? 0);

export const actionConvertShapeToPath = register({
  name: "convertShapeToPath",
  label: "labels.path.convertToPath",
  category: DEFAULT_CATEGORIES.elements,
  keywords: ["path", "bezier", "vector", "shape", "convert"],
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => {
    const selected = app.scene.getSelectedElements(appState);
    return selected.length > 0 && selected.every(canConvert);
  },
  perform: (elements, appState, _, app) => {
    const selected = app.scene.getSelectedElements(appState);
    if (!selected.length || !selected.every(canConvert)) {
      return false;
    }
    const targets = arrayToMap(selected);
    return {
      elements: elements.map((element) => {
        if (!targets.has(element.id) || !isConvertibleToPath(element)) {
          return element;
        }
        const { points, handles } = getPathGeometryFromShape(element);
        // a new object of another type under the same id
        return newElementWith(
          {
            ...element,
            type: "path",
            points,
            handles,
            closed: true,
            roundness: null,
          } as unknown as ExcalidrawPathElement,
          {},
        );
      }),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionEditPath = register({
  name: "editPath",
  label: "labels.path.edit",
  category: DEFAULT_CATEGORIES.elements,
  keywords: ["path", "bezier", "points", "handles", "anchor"],
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => {
    const selected = app.scene.getSelectedElements(appState);
    return (
      !appState.editingPath &&
      selected.length === 1 &&
      isPathElement(selected[0])
    );
  },
  perform: (elements, appState, _, app) => {
    const selected = app.scene.getSelectedElements(appState);
    if (selected.length !== 1 || !isPathElement(selected[0])) {
      return false;
    }
    return {
      elements,
      appState: {
        ...appState,
        editingPath: { elementId: selected[0].id, selectedPoint: null },
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
});
