import { randomId, ROUNDNESS } from "@excalidraw/common";
import {
  convertToExcalidrawElements,
  getCommonBounds,
  newElementWith,
} from "@excalidraw/element";

import { getSymbolMeta } from "@excalidraw/symbols";

import type { Scene } from "@excalidraw/element";
import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { FORMS, type FlowForm } from "./flowForms";
import { slugKey, type FlowShape } from "./flowGraph";
import { getFlowMeta, type FlowMeta } from "./flowMeta";

import {
  ACCENT,
  HANDLE,
  HANDLE_SIZE,
  LABEL_GAP,
  PAD,
  PLACEHOLDER,
} from "./flowStyle";

import type { FlowPort } from "./flowPorts";

/**
 * Flow elements: any object or group wrapped (decorator style) in an outline
 * with a label above and a handle on its edge. They share one group with what
 * they wrap, so the wrapped objects stay as editable as before. A flow element
 * can be wrapped by another one: that makes a screen out of its parts.
 * Dragging the handle links to another flow element or makes a placeholder.
 */
const isFlowPart = (element: ExcalidrawElement) => {
  const flowMeta = getFlowMeta(element);
  return (
    !!flowMeta &&
    (flowMeta.kind === "label" || flowMeta.kind === "handle" || !!flowMeta.wrap)
  );
};

/** what a selection stands for: whole groups, labels with their boxes */
export const expandSelection = (
  all: readonly ExcalidrawElement[],
  selected: readonly ExcalidrawElement[],
) => {
  const live = all.filter((element) => !element.isDeleted);
  const byId = new Map(live.map((element) => [element.id, element]));
  const ids = new Set<string>();
  for (const picked of selected) {
    const element = byId.get(picked.id);
    if (!element) {
      continue;
    }
    ids.add(element.id);
    if (element.groupIds.length) {
      const outer = element.groupIds[element.groupIds.length - 1];
      for (const member of live) {
        if (member.groupIds.includes(outer)) {
          ids.add(member.id);
        }
      }
    }
  }
  for (const id of [...ids]) {
    const element = byId.get(id)!;
    for (const boundElement of element.boundElements ?? []) {
      if (boundElement.type === "text" && byId.has(boundElement.id)) {
        ids.add(boundElement.id);
      }
    }
    if (
      element.type === "text" &&
      element.containerId &&
      byId.has(element.containerId)
    ) {
      ids.add(element.containerId);
    }
  }
  return live.filter(
    (element) => ids.has(element.id) && element.type !== "frame",
  );
};

const labelFor = (targets: readonly ExcalidrawElement[]) => {
  for (const element of targets) {
    if (isFlowPart(element)) {
      continue;
    }
    const symbol = getSymbolMeta(element);
    const fromSymbol = symbol?.label;
    if (fromSymbol) {
      return String(fromSymbol).slice(0, 30);
    }
    if (element.type === "text") {
      return (element as ExcalidrawTextElement).text
        .split("\n")[0]
        .slice(0, 30);
    }
  }
  return "";
};

/** How a new flow element is written in Mermaid and drawn: its form, outline shape and ports. */
export type FlowLook = {
  form?: FlowForm;
  shape?: FlowShape;
  ports?: FlowPort[];
};

/** the outline element a shape is read back from (see `shapeOf`) */
const outlineStyle = (shape: FlowShape | undefined) => ({
  type:
    shape === "diamond"
      ? "diamond"
      : shape === "ellipse"
      ? "ellipse"
      : "rectangle",
  roundness: shape === "round" ? { type: ROUNDNESS.ADAPTIVE_RADIUS } : null,
});

type Made = {
  key: string;
  /** the outline of the new flow element */
  outline: string;
  group: string;
};

const outerGroupOf = (element: ExcalidrawElement) =>
  element.groupIds[element.groupIds.length - 1] ?? element.id;

/** the selection already is exactly one flow element of this flow */
const isOneFlowElement = (
  targets: readonly ExcalidrawElement[],
  flowId: string,
) =>
  new Set(targets.map(outerGroupOf)).size === 1 &&
  targets.some((element) => {
    const flowMeta = getFlowMeta(element);
    return (
      !!flowMeta &&
      flowMeta.id === flowId &&
      !!flowMeta.wrap &&
      flowMeta.group === outerGroupOf(element)
    );
  });

/** the keys already used in a flow, and how many steps and screens it has */
const takenKeys = (all: readonly ExcalidrawElement[], flowId: string) => {
  const taken = new Set<string>();
  let count = 0;
  for (const element of all) {
    const flowMeta = !element.isDeleted ? getFlowMeta(element) : null;
    if (
      flowMeta &&
      flowMeta.id === flowId &&
      (flowMeta.kind === "node" || flowMeta.kind === "screen")
    ) {
      taken.add(flowMeta.key);
      count++;
    }
  }
  return { taken, count };
};

/** the dashed outline, its label above and the handle on its right edge */
const buildWrapElements = ({
  flowId,
  key,
  label,
  group,
  outline,
  bounds,
  frameId,
  meta,
  shape,
  pad,
}: {
  flowId: string;
  key: string;
  label: string;
  group: string;
  outline: string;
  bounds: readonly [number, number, number, number];
  frameId: string | null;
  meta: FlowMeta;
  shape?: FlowShape;
  pad: number;
}) => {
  const [left, top, right, bottom] = bounds;
  const outlineX = left - pad;
  const outlineY = top - pad;
  const outlineWidth = right - left + pad * 2;
  const outlineHeight = bottom - top + pad * 2;
  return convertToExcalidrawElements(
    [
      {
        ...outlineStyle(shape),
        id: outline,
        x: outlineX,
        y: outlineY,
        width: outlineWidth,
        height: outlineHeight,
        strokeColor: ACCENT,
        backgroundColor: "transparent",
        strokeStyle: "dashed",
        strokeWidth: 1,
        roughness: 0,
        groupIds: [group],
        frameId,
        customData: { flow: meta },
      },
      {
        type: "text",
        x: outlineX,
        y: outlineY - LABEL_GAP,
        text: label,
        fontSize: 16,
        strokeColor: ACCENT,
        groupIds: [group],
        frameId,
        customData: { flow: { id: flowId, key, kind: "label" } },
      },
      {
        type: "ellipse",
        x: outlineX + outlineWidth - HANDLE_SIZE / 2,
        y: outlineY + outlineHeight / 2 - HANDLE_SIZE / 2,
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
        strokeColor: HANDLE,
        backgroundColor: HANDLE,
        fillStyle: "solid",
        roughness: 0,
        strokeWidth: 1,
        groupIds: [group],
        frameId,
        customData: { flow: { id: flowId, key, kind: "handle" } },
      },
    ] as any,
    { regenerateIds: false },
  );
};

/** the outline goes under the wrapped objects, label and handle above them */
const insertWrap = (
  all: readonly ExcalidrawElement[],
  targetIds: Set<string>,
  group: string,
  [box, text, handle]: readonly ExcalidrawElement[],
) => {
  const first = all.findIndex((element) => targetIds.has(element.id));
  let last = first;
  all.forEach((element, index) => {
    if (targetIds.has(element.id)) {
      last = index;
    }
  });
  const next: ExcalidrawElement[] = [];
  all.forEach((element, index) => {
    if (index === first) {
      next.push(box);
    }
    next.push(
      targetIds.has(element.id)
        ? newElementWith(element, { groupIds: [...element.groupIds, group] })
        : element,
    );
    if (index === last) {
      next.push(text, handle);
    }
  });
  return next;
};

/**
 * Wraps `selected` in a flow element of `flowId`. Returns null when there is
 * nothing to wrap or the selection already is one flow element.
 */
export const wrapAsFlowElement = (
  scene: Scene,
  selected: readonly ExcalidrawElement[],
  flowId: string,
  options: { label?: string; placeholder?: boolean } = {},
  look: FlowLook = {},
): Made | null => {
  const all = scene.getElementsIncludingDeleted();
  const targets = expandSelection(all, selected);
  if (!targets.length || isOneFlowElement(targets, flowId)) {
    return null;
  }

  const { taken, count } = takenKeys(all, flowId);
  const holdsFlowElement = targets.some((element) => {
    const flowMeta = getFlowMeta(element);
    return !!flowMeta && flowMeta.id === flowId && !!flowMeta.wrap;
  });
  const label =
    options.label ??
    (labelFor(targets) ||
      (options.placeholder
        ? `Step ${count + 1}`
        : holdsFlowElement
        ? "Screen"
        : "Step"));
  const key = slugKey(label, taken);
  const group = randomId();
  const outline = randomId();
  const frames = new Set(targets.map((element) => element.frameId ?? null));
  const meta: FlowMeta = {
    id: flowId,
    key,
    kind: "node",
    wrap: true,
    group,
    ...(options.placeholder ? { placeholder: true } : {}),
    ...(look.form ? { form: look.form } : {}),
    ...(look.ports?.length ? { ports: look.ports } : {}),
  };
  const made = buildWrapElements({
    flowId,
    key,
    label,
    group,
    outline,
    bounds: getCommonBounds(targets),
    frameId: frames.size === 1 ? [...frames][0] : null,
    meta,
    shape: look.shape ?? (look.form ? FORMS[look.form].shape : undefined),
    pad: holdsFlowElement ? PAD : 0,
  });
  const targetIds = new Set(targets.map((element) => element.id));
  scene.replaceAllElements(insertWrap(all, targetIds, group, made));
  return { key, outline, group };
};

/** a box where a link was dropped on nothing: to be replaced by the real thing */
export const addPlaceholder = (
  scene: Scene,
  flowId: string,
  center: { x: number; y: number },
) => {
  const [box] = convertToExcalidrawElements(
    [
      {
        type: "rectangle",
        x: center.x - PLACEHOLDER.w / 2,
        y: center.y - PLACEHOLDER.h / 2,
        width: PLACEHOLDER.w,
        height: PLACEHOLDER.h,
        strokeColor: "#868e96",
        backgroundColor: "#f1f3f5",
        fillStyle: "solid",
        roughness: 0,
        roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
        customData: { flowPlaceholder: true },
      },
    ] as any,
    { regenerateIds: false },
  );
  scene.replaceAllElements([...scene.getElementsIncludingDeleted(), box]);
  return wrapAsFlowElement(scene, [box], flowId, { placeholder: true });
};
