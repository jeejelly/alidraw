import { KEYS, randomId } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  PATHFINDER_OPS,
  getOutline,
  isPathfinderOperand,
  newElementWith,
  outlineArea,
  reversePathGeometry,
  runPathfinder,
  type PathfinderOp,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawPathElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { DEFAULT_CATEGORIES } from "../components/CommandPalette/CommandPalette";

import { asClosedPath } from "./pathShape";
import { register } from "./register";

import type { Action } from "./types";

import type { AppClassProperties, AppState } from "../types";

/** the operands, bottom to top as they sit in the scene */
const getOperands = (
  elements: readonly ExcalidrawElement[],
  selectedIds: ReadonlySet<string>,
) =>
  elements.filter(
    (element) => selectedIds.has(element.id) && !element.isDeleted,
  );

/**
 * Subtract and divide keep what the bottom shape looks like; the others take
 * the look of the top one (the usual rule).
 */
const styleSourceOf = (
  op: PathfinderOp,
  operands: readonly ExcalidrawElement[],
) =>
  op === "subtract" || op === "divide"
    ? operands[0]
    : operands[operands.length - 1];

/** deletes the elements in `ids`; the result goes in place of the one with `anchorId` */
const replaceWith = (
  elements: readonly ExcalidrawElement[],
  ids: ReadonlySet<string>,
  anchorId: string,
  created: readonly ExcalidrawElement[],
) => {
  const next: ExcalidrawElement[] = [];
  for (const element of elements) {
    if (ids.has(element.id)) {
      next.push(newElementWith(element, { isDeleted: true }));
      if (element.id === anchorId) {
        next.push(...created);
      }
    } else {
      next.push(element);
    }
  }
  return next;
};

const canCombine = (appState: AppState, app: AppClassProperties) => {
  const selected = app.scene.getSelectedElements(appState);
  return selected.length >= 2 && selected.every(isPathfinderOperand);
};

/** the selected shapes that can be combined, or null when they cannot */
const getCombinable = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  app: AppClassProperties,
) => {
  const ids = new Set(
    app.scene.getSelectedElements(appState).map((element) => element.id),
  );
  const operands = getOperands(elements, ids);
  if (operands.length < 2 || !operands.every(isPathfinderOperand)) {
    return null;
  }
  return { ids, operands, top: operands[operands.length - 1] };
};

const makeAction = (op: PathfinderOp): Action =>
  register({
    name: `pathfinder${op[0].toUpperCase()}${op.slice(1)}` as any,
    label: `labels.pathfinder.${op}` as any,
    category: DEFAULT_CATEGORIES.elements,
    keywords: ["pathfinder", "boolean", "shape", "combine", op],
    trackEvent: { category: "element" },
    predicate: (elements, appState, _, app) => canCombine(appState, app),
    perform: async (elements, appState, _, app) => {
      const combinable = getCombinable(elements, appState, app);
      if (!combinable) {
        return false;
      }
      const { ids, operands, top } = combinable;
      const outlines = operands.map((element) => getOutline(element)!);
      const loops = await runPathfinder(op, outlines);
      const source = styleSourceOf(op, operands);
      // a divide gives several pieces: they come out grouped
      const groupId = op === "divide" && loops.length > 1 ? randomId() : null;
      const created = loops.map((loop) =>
        asClosedPath(
          source,
          loop,
          groupId ? [groupId, ...source.groupIds] : source.groupIds,
        ),
      );
      return {
        // the operands go; the result takes the top one's place
        elements: replaceWith(elements, ids, top.id, created),
        appState: {
          ...appState,
          selectedElementIds: Object.fromEntries(
            created.map((element) => [element.id, true]),
          ),
          selectedGroupIds: groupId ? { [groupId]: true } : {},
          editingPath: null,
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      };
    },
  });

const byOp = Object.fromEntries(
  PATHFINDER_OPS.map((op) => [op, makeAction(op)]),
) as Record<PathfinderOp, Action>;

export const actionPathfinderUnite = byOp.unite;
export const actionPathfinderIntersect = byOp.intersect;
export const actionPathfinderSubtract = byOp.subtract;
export const actionPathfinderExclude = byOp.exclude;
export const actionPathfinderDivide = byOp.divide;

export const PATHFINDER_ACTIONS = [
  ["unite", actionPathfinderUnite],
  ["subtract", actionPathfinderSubtract],
  ["intersect", actionPathfinderIntersect],
  ["exclude", actionPathfinderExclude],
  ["divide", actionPathfinderDivide],
] as const;

/** a shape is a combination of paths: the bottom one plus the others as contours */
export const actionMakeCompoundShape = register({
  name: "makeCompoundShape" as any,
  label: "labels.pathfinder.compound" as any,
  category: DEFAULT_CATEGORIES.elements,
  keywords: ["compound", "shape", "hole", "combine", "paths"],
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => canCombine(appState, app),
  perform: (elements, appState, _, app) => {
    const combinable = getCombinable(elements, appState, app);
    if (!combinable) {
      return false;
    }
    const { ids, operands, top } = combinable;
    const outlines = operands.map((element) => getOutline(element)!);
    const [main, ...others] = outlines;
    // canvas fills with the non-zero rule: holes wind against their outline
    const sign = Math.sign(outlineArea(main));
    const loops = others
      .flatMap((other) => [
        { points: other.points, handles: other.handles },
        ...(other.contours ?? []),
      ])
      .map((loop) =>
        Math.sign(outlineArea(loop)) === sign
          ? reversePathGeometry(loop)
          : loop,
      );
    const shape = asClosedPath(operands[0], {
      ...main,
      contours: [...(main.contours ?? []), ...loops],
    });
    return {
      elements: replaceWith(elements, ids, top.id, [shape]),
      appState: {
        ...appState,
        selectedElementIds: { [shape.id]: true },
        selectedGroupIds: {},
        editingPath: null,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && !event.altKey && event.code === "Digit8",
});

export const actionReleaseCompoundShape = register({
  name: "releaseCompoundShape" as any,
  label: "labels.pathfinder.release" as any,
  category: DEFAULT_CATEGORIES.elements,
  keywords: ["compound", "shape", "release", "split", "paths"],
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) =>
    app.scene
      .getSelectedElements(appState)
      .some((element) => element.type === "path" && !!element.contours?.length),
  perform: (elements, appState, _, app) => {
    const shapes = app.scene
      .getSelectedElements(appState)
      .filter(
        (element): element is NonDeleted<ExcalidrawPathElement> =>
          element.type === "path" && !!element.contours?.length,
      );
    if (!shapes.length) {
      return false;
    }
    const ids = new Set(shapes.map((element) => element.id));
    const created: ExcalidrawElement[] = [];
    const parts = new Map<string, ExcalidrawElement[]>();
    for (const element of shapes) {
      const outline = getOutline(element)!;
      const made = [
        { points: outline.points, handles: outline.handles },
        ...(outline.contours ?? []),
      ].map((loop) => asClosedPath(element, loop));
      parts.set(element.id, made);
      created.push(...made);
    }
    const next: ExcalidrawElement[] = [];
    for (const element of elements) {
      if (ids.has(element.id)) {
        next.push(
          newElementWith(element, { isDeleted: true }),
          ...parts.get(element.id)!,
        );
      } else {
        next.push(element);
      }
    }
    return {
      elements: next,
      appState: {
        ...appState,
        selectedElementIds: Object.fromEntries(
          created.map((element) => [element.id, true]),
        ),
        editingPath: null,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === "Digit8",
});
