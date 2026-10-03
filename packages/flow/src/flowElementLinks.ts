import { randomId } from "@excalidraw/common";
import {
  convertToExcalidrawElements,
  newElementWith,
} from "@excalidraw/element";

import type { Scene } from "@excalidraw/element";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import { linkEnds } from "./flowLinks";
import { getFlowMeta } from "./flowMeta";
import { partsOf } from "./flowParts";
import { LINK_COLOR } from "./flowStyle";

/** the flow elements an element belongs to, innermost first */
const wrapperKeysOf = (
  all: readonly ExcalidrawElement[],
  el: ExcalidrawElement,
  flowId: string,
) => {
  const byGroup = new Map<string, string>();
  for (const candidate of all) {
    const flowMeta = !candidate.isDeleted ? getFlowMeta(candidate) : null;
    if (flowMeta && flowMeta.id === flowId && flowMeta.wrap && flowMeta.group) {
      byGroup.set(flowMeta.group, flowMeta.key);
    }
  }
  return el.groupIds.flatMap((groupId) =>
    byGroup.has(groupId) ? [byGroup.get(groupId)!] : [],
  );
};

/** the flow element (key) a link dropped on `element` reaches, or null */
export const flowKeyAt = (
  all: readonly ExcalidrawElement[],
  el: ExcalidrawElement,
  flowId: string,
  excluded: ReadonlySet<string>,
): { key: string | null; onlyExcluded: boolean } => {
  const keys = wrapperKeysOf(all, el, flowId);
  const free = keys.find((key) => !excluded.has(key));
  return { key: free ?? null, onlyExcluded: !free && keys.length > 0 };
};

/** the keys of a flow element and of every flow element around it */
export const selfAndAncestors = (
  all: readonly ExcalidrawElement[],
  flowId: string,
  key: string,
) => {
  const { wrapParent } = partsOf(all, flowId);
  const out = new Set<string>([key]);
  for (
    let parentKey = wrapParent.get(key);
    parentKey && !out.has(parentKey);
    parentKey = wrapParent.get(parentKey)
  ) {
    out.add(parentKey);
  }
  return out;
};

/** a link from one flow element to another; nothing if there already is one */
export const addLink = (
  scene: Scene,
  flowId: string,
  fromKey: string,
  toKey: string,
  label = "",
) => {
  const all = scene.getElementsIncludingDeleted();
  const { byKey, keyOfId } = partsOf(all, flowId);
  const fromElement = byKey.get(fromKey);
  const toElement = byKey.get(toKey);
  if (!fromElement || !toElement || fromElement.id === toElement.id) {
    return null;
  }
  for (const element of all) {
    if (
      !element.isDeleted &&
      element.type === "arrow" &&
      element.startBinding &&
      element.endBinding &&
      keyOfId.get(element.startBinding.elementId) === fromKey &&
      keyOfId.get(element.endBinding.elementId) === toKey
    ) {
      return null;
    }
  }
  const rect = (element: ExcalidrawElement) => ({
    x: element.x,
    y: element.y,
    w: element.width,
    h: element.height,
    type: element.type,
  });
  const [p0, p1] = linkEnds(rect(fromElement), rect(toElement), 0);
  const id = randomId();
  const out = convertToExcalidrawElements(
    [
      { ...fromElement, boundElements: [], frameId: null },
      { ...toElement, boundElements: [], frameId: null },
      {
        type: "arrow",
        id,
        x: p0[0],
        y: p0[1],
        width: Math.abs(p1[0] - p0[0]),
        height: Math.abs(p1[1] - p0[1]),
        points: [
          [0, 0],
          [p1[0] - p0[0], p1[1] - p0[1]],
        ],
        start: { id: fromElement.id },
        end: { id: toElement.id },
        endArrowhead: "arrow",
        strokeWidth: 2,
        strokeColor: LINK_COLOR,
        customData: {
          flow: { id: flowId, key: `${fromKey}>${toKey}`, kind: "edge" },
        },
        ...(label ? { label: { text: label } } : {}),
      },
    ] as any,
    { regenerateIds: false },
  );
  const arrows = out.filter(
    (element) =>
      element.id === id ||
      (element.type === "text" && element.containerId === id),
  );
  const ref = { type: "arrow" as const, id };
  scene.replaceAllElements([
    ...all.map((element) =>
      element.id === fromElement.id || element.id === toElement.id
        ? newElementWith(element, {
            boundElements: [...(element.boundElements ?? []), ref],
          })
        : element,
    ),
    ...arrows,
  ]);
  return id;
};
