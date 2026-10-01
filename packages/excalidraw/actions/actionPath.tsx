import {
  CaptureUpdateAction,
  getPathGeometryFromShape,
  getPathSceneGeometry,
  getPathUpdate,
  joinPathGeometries,
  reversePathGeometry,
  isConvertibleToPath,
  isLineConvertibleToPath,
  NO_HANDLES,
  isPathElement,
  newElementWith,
} from "@excalidraw/element";
import { CODES, KEYS, arrayToMap } from "@excalidraw/common";

import type {
  ExcalidrawElement,
  ExcalidrawPathElement,
} from "@excalidraw/element/types";

import { DEFAULT_CATEGORIES } from "../components/CommandPalette/CommandPalette";

import { register } from "./register";

/** a shape the path can replace: no bound text or arrows hang off it */
const canConvert = (element: ExcalidrawElement) =>
  (isConvertibleToPath(element) || isLineConvertibleToPath(element)) &&
  !(element.boundElements?.length ?? 0);

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
        if (!targets.has(element.id)) {
          return element;
        }
        if (isLineConvertibleToPath(element)) {
          // a line becomes a path as drawn: same anchors, corners kept
          let points = [...element.points];
          const closed = !!element.polygon;
          if (
            closed &&
            points.length > 2 &&
            points[0][0] === points[points.length - 1][0] &&
            points[0][1] === points[points.length - 1][1]
          ) {
            points = points.slice(0, -1);
          }
          const handles = points.map(() => NO_HANDLES);
          const frame = {
            ...element,
            type: "path",
            points,
            handles,
            closed,
            roundness: null,
          } as unknown as ExcalidrawPathElement;
          return newElementWith(frame, {
            ...getPathUpdate(frame, { points, handles }),
          });
        }
        if (!isConvertibleToPath(element)) {
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

const isOpenPath = (
  element: ExcalidrawElement,
): element is ExcalidrawPathElement =>
  isPathElement(element) && !element.closed && element.points.length >= 2;

/** two open paths become one, joined where their ends are nearest */
export const actionJoinPaths = register({
  name: "joinPaths",
  label: "labels.path.join",
  category: DEFAULT_CATEGORIES.elements,
  keywords: ["path", "merge", "connect"],
  trackEvent: { category: "element" },
  // Illustrator: Ctrl+J joins
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] &&
    !event.shiftKey &&
    !event.altKey &&
    event.code === CODES.J,
  predicate: (elements, appState, _, app) => {
    const selected = app.scene.getSelectedElements(appState);
    return selected.length === 2 && selected.every(isOpenPath);
  },
  perform: (elements, appState, _, app) => {
    const selected = app.scene.getSelectedElements(appState);
    if (selected.length !== 2 || !selected.every(isOpenPath)) {
      return false;
    }
    const [A, B] = selected as ExcalidrawPathElement[];
    const a = getPathSceneGeometry(A);
    const b = getPathSceneGeometry(B);
    const gap = (x: typeof a, y: typeof a) => {
      const p = x.points[x.points.length - 1];
      const q = y.points[0];
      return Math.hypot(p[0] - q[0], p[1] - q[1]);
    };
    const candidates = [
      [a, b],
      [a, reversePathGeometry(b)],
      [reversePathGeometry(a), b],
      [reversePathGeometry(a), reversePathGeometry(b)],
    ] as const;
    const [first, second] = candidates.reduce((best, c) =>
      gap(c[0], c[1]) < gap(best[0], best[1]) ? c : best,
    );
    const joined = joinPathGeometries(first, second);
    // scene coordinates, no rotation: a frame at the origin
    const frame = { ...A, x: 0, y: 0, angle: 0 as any, ...joined };
    const update = getPathUpdate(frame, joined);
    return {
      elements: elements.map((element) => {
        if (element.id === A.id) {
          return newElementWith(element, { ...update, angle: 0 as any } as any);
        }
        if (element.id === B.id) {
          return newElementWith(element, { isDeleted: true });
        }
        return element;
      }),
      appState: {
        ...appState,
        selectedElementIds: { [A.id]: true },
        editingPath: null,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
