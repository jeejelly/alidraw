import {
  CaptureUpdateAction,
  getCornerRadius,
  getPathGeometryFromShape,
  getPathSceneGeometry,
  getPathUpdate,
  mergeOpenPaths,
  isConvertibleToPath,
  isLineConvertibleToPath,
  NO_HANDLES,
  isPathElement,
  newElementWith,
} from "@excalidraw/element";
import { CODES, KEYS, arrayToMap } from "@excalidraw/common";

import type {
  ExcalidrawElement,
  ExcalidrawLineElement,
  ExcalidrawPathElement,
} from "@excalidraw/element/types";

import { DEFAULT_CATEGORIES } from "../components/CommandPalette/CommandPalette";

import { register } from "./register";

/** a shape the path can replace: no bound text or arrows hang off it */
const canConvert = (element: ExcalidrawElement) =>
  (isConvertibleToPath(element) || isLineConvertibleToPath(element)) &&
  !(element.boundElements?.length ?? 0);

/** a line becomes a path as drawn: same anchors, corners kept */
const lineToPath = (line: ExcalidrawLineElement) => {
  let points = [...line.points];
  const closed = !!line.polygon;
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
    ...line,
    type: "path",
    points,
    handles,
    closed,
    roundness: null,
  } as unknown as ExcalidrawPathElement;
  return newElementWith(frame, {
    ...getPathUpdate(frame, { points, handles }),
  });
};

/** a rectangle, diamond or ellipse becomes a closed path with the same outline */
const shapeToPath = (
  shape: ExcalidrawElement & { type: "rectangle" | "diamond" | "ellipse" },
) => {
  const geometry = getPathGeometryFromShape(shape);
  // a rounded rectangle or diamond keeps its rounding as bevels
  const radius =
    shape.type === "ellipse"
      ? 0
      : getCornerRadius(Math.min(shape.width, shape.height), shape);
  const handles = radius
    ? geometry.handles.map((handle) => ({ ...handle, radius }))
    : geometry.handles;
  // a new object of another type under the same id
  return newElementWith(
    {
      ...shape,
      type: "path",
      points: geometry.points,
      handles,
      closed: true,
      roundness: null,
    } as unknown as ExcalidrawPathElement,
    {},
  );
};

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
          return lineToPath(element);
        }
        return isConvertibleToPath(element) ? shapeToPath(element) : element;
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

/** how close (on screen) two end points must be for their paths to merge */
const MERGE_TOLERANCE_PX = 24;

/**
 * Open paths become one wherever their ends meet, keeping curves; a chain
 * whose two ends meet closes. Two paths always join at their nearest ends.
 */
export const actionJoinPaths = register({
  name: "joinPaths",
  label: "labels.path.join",
  category: DEFAULT_CATEGORIES.elements,
  keywords: ["path", "merge", "connect"],
  trackEvent: { category: "element" },
  // Ctrl+J joins
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] &&
    !event.shiftKey &&
    !event.altKey &&
    event.code === CODES.J,
  predicate: (elements, appState, _, app) => {
    const selected = app.scene.getSelectedElements(appState);
    return selected.length >= 2 && selected.every(isOpenPath);
  },
  perform: (elements, appState, _, app) => {
    const selected = app.scene.getSelectedElements(appState);
    if (selected.length < 2 || !selected.every(isOpenPath)) {
      return false;
    }
    const paths = selected as ExcalidrawPathElement[];
    const tolerance = MERGE_TOLERANCE_PX / appState.zoom.value;
    const merged = mergeOpenPaths(
      paths.map(getPathSceneGeometry),
      paths.length === 2 ? Infinity : tolerance,
      tolerance,
    ).filter((chain) => chain.members.length > 1);
    if (!merged.length) {
      return false;
    }
    const updates = new Map<string, ReturnType<typeof newElementWith>>();
    const removed = new Set<string>();
    const selectedIds: Record<string, true> = {};
    for (const chain of merged) {
      const [keptIndex, ...rest] = chain.members;
      const kept = paths[keptIndex];
      // scene coordinates, no rotation: a frame at the origin
      const frame = {
        ...kept,
        x: 0,
        y: 0,
        angle: 0 as any,
        closed: chain.closed,
        points: chain.points,
        handles: chain.handles,
      };
      updates.set(
        kept.id,
        newElementWith(kept, {
          ...getPathUpdate(frame, chain),
          closed: chain.closed,
          angle: 0 as any,
        } as any),
      );
      rest.forEach((index) => removed.add(paths[index].id));
      selectedIds[kept.id] = true;
    }
    return {
      elements: elements.map((element) =>
        removed.has(element.id)
          ? newElementWith(element, { isDeleted: true })
          : updates.get(element.id) ?? element,
      ),
      appState: {
        ...appState,
        selectedElementIds: selectedIds,
        editingPath: null,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
