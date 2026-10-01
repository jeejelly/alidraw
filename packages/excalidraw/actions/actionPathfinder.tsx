import { KEYS, randomId } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  PATHFINDER_OPS,
  getOutline,
  getPathUpdate,
  isPathfinderOperand,
  newElementWith,
  newPathElement,
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

import { register } from "./register";

import type { Action } from "./types";

/** the operands, bottom to top as they sit in the scene */
const getOperands = (
  elements: readonly ExcalidrawElement[],
  selectedIds: ReadonlySet<string>,
) => elements.filter((el) => selectedIds.has(el.id) && !el.isDeleted);

/**
 * Subtract and divide keep what the bottom shape looks like; the others take
 * the look of the top one (Illustrator's rule).
 */
const styleSourceOf = (
  op: PathfinderOp,
  operands: readonly ExcalidrawElement[],
) =>
  op === "subtract" || op === "divide"
    ? operands[0]
    : operands[operands.length - 1];

const makeAction = (op: PathfinderOp): Action =>
  register({
    name: `pathfinder${op[0].toUpperCase()}${op.slice(1)}` as any,
    label: `labels.pathfinder.${op}` as any,
    category: DEFAULT_CATEGORIES.elements,
    keywords: ["pathfinder", "boolean", "shape", "combine", op],
    trackEvent: { category: "element" },
    predicate: (elements, appState, _, app) => {
      const selected = app.scene.getSelectedElements(appState);
      return selected.length >= 2 && selected.every(isPathfinderOperand);
    },
    perform: async (elements, appState, _, app) => {
      const ids = new Set(
        app.scene.getSelectedElements(appState).map((el) => el.id),
      );
      const operands = getOperands(elements, ids);
      if (operands.length < 2 || !operands.every(isPathfinderOperand)) {
        return false;
      }
      const outlines = operands.map((el) => getOutline(el)!);
      const loops = await runPathfinder(op, outlines);
      const source = styleSourceOf(op, operands);
      // a divide gives several pieces: they come out grouped
      const groupId = op === "divide" && loops.length > 1 ? randomId() : null;

      const created = loops.map((loop) => {
        // scene coordinates, no rotation: a frame at the origin
        const frame = {
          ...source,
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
          strokeColor: source.strokeColor,
          backgroundColor: source.backgroundColor,
          fillStyle: source.fillStyle,
          strokeWidth: source.strokeWidth,
          strokeStyle: source.strokeStyle,
          roughness: source.roughness,
          opacity: source.opacity,
          roundness: null,
          groupIds: groupId ? [groupId, ...source.groupIds] : source.groupIds,
          frameId: source.frameId,
          ...getPathUpdate(frame, loop),
          closed: true,
        });
      });

      const top = operands[operands.length - 1];
      const next: ExcalidrawElement[] = [];
      for (const el of elements) {
        if (ids.has(el.id)) {
          // the operands go; the result takes the top one's place
          next.push(newElementWith(el, { isDeleted: true }));
          if (el.id === top.id) {
            next.push(...created);
          }
        } else {
          next.push(el);
        }
      }
      return {
        elements: next,
        appState: {
          ...appState,
          selectedElementIds: Object.fromEntries(
            created.map((el) => [el.id, true]),
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

const asShape = (
  source: ExcalidrawElement,
  loop: NonNullable<ReturnType<typeof getOutline>>,
) => {
  const frame = {
    ...source,
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
    strokeColor: source.strokeColor,
    backgroundColor: source.backgroundColor,
    fillStyle: source.fillStyle,
    strokeWidth: source.strokeWidth,
    strokeStyle: source.strokeStyle,
    roughness: source.roughness,
    opacity: source.opacity,
    roundness: null,
    groupIds: source.groupIds,
    frameId: source.frameId,
    ...getPathUpdate(frame, loop),
    closed: true,
  });
};

const replaceWith = (
  elements: readonly ExcalidrawElement[],
  ids: ReadonlySet<string>,
  anchorId: string,
  created: readonly ExcalidrawElement[],
) => {
  const next: ExcalidrawElement[] = [];
  for (const el of elements) {
    if (ids.has(el.id)) {
      next.push(newElementWith(el, { isDeleted: true }));
      if (el.id === anchorId) {
        next.push(...created);
      }
    } else {
      next.push(el);
    }
  }
  return next;
};

/** a shape is a combination of paths: the bottom one plus the others as contours */
export const actionMakeCompoundShape = register({
  name: "makeCompoundShape" as any,
  label: "labels.pathfinder.compound" as any,
  category: DEFAULT_CATEGORIES.elements,
  keywords: ["compound", "shape", "hole", "combine", "paths"],
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => {
    const selected = app.scene.getSelectedElements(appState);
    return selected.length >= 2 && selected.every(isPathfinderOperand);
  },
  perform: (elements, appState, _, app) => {
    const ids = new Set(
      app.scene.getSelectedElements(appState).map((el) => el.id),
    );
    const operands = getOperands(elements, ids);
    if (operands.length < 2 || !operands.every(isPathfinderOperand)) {
      return false;
    }
    const outlines = operands.map((el) => getOutline(el)!);
    const [main, ...others] = outlines;
    // canvas fills with the non-zero rule: holes wind against their outline
    const sign = Math.sign(outlineArea(main));
    const loops = others
      .flatMap((o) => [
        { points: o.points, handles: o.handles },
        ...(o.contours ?? []),
      ])
      .map((loop) =>
        Math.sign(outlineArea(loop)) === sign
          ? reversePathGeometry(loop)
          : loop,
      );
    const shape = asShape(operands[0], {
      ...main,
      contours: [...(main.contours ?? []), ...loops],
    });
    return {
      elements: replaceWith(elements, ids, operands[operands.length - 1].id, [
        shape,
      ]),
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
      .some((el) => el.type === "path" && !!el.contours?.length),
  perform: (elements, appState, _, app) => {
    const shapes = app.scene
      .getSelectedElements(appState)
      .filter(
        (el): el is NonDeleted<ExcalidrawPathElement> =>
          el.type === "path" && !!el.contours?.length,
      );
    if (!shapes.length) {
      return false;
    }
    const ids = new Set(shapes.map((el) => el.id));
    const created: ExcalidrawElement[] = [];
    const parts = new Map<string, ExcalidrawElement[]>();
    for (const el of shapes) {
      const outline = getOutline(el)!;
      const made = [
        { points: outline.points, handles: outline.handles },
        ...(outline.contours ?? []),
      ].map((loop) => asShape(el, loop));
      parts.set(el.id, made);
      created.push(...made);
    }
    const next: ExcalidrawElement[] = [];
    for (const el of elements) {
      if (ids.has(el.id)) {
        next.push(
          newElementWith(el, { isDeleted: true }),
          ...parts.get(el.id)!,
        );
      } else {
        next.push(el);
      }
    }
    return {
      elements: next,
      appState: {
        ...appState,
        selectedElementIds: Object.fromEntries(
          created.map((el) => [el.id, true]),
        ),
        editingPath: null,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === "Digit8",
});
