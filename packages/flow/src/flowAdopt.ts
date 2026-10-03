import { newElementWith } from "@excalidraw/element";

import type { Scene } from "@excalidraw/element";
import type {
  ExcalidrawElement,
  ExcalidrawFrameElement,
} from "@excalidraw/element/types";

import { slugKey } from "./flowGraph";
import { getFlowMeta, isNodeType, withFlow } from "./flowMeta";
import { textOf } from "./flowText";

/**
 * Gives the selected shapes, frames and the arrows between them to a flow:
 * shapes become steps, frames become screens, with keys made from labels.
 * Returns the number of steps and screens taken.
 */
export const adoptIntoFlow = (
  scene: Scene,
  selected: readonly ExcalidrawElement[],
  flowId: string,
) => {
  const all = scene.getElementsIncludingDeleted();
  const map = new Map(
    all
      .filter((element) => !element.isDeleted)
      .map((element) => [element.id, element]),
  );
  const taken = new Set<string>();
  for (const element of all) {
    const flowMeta = !element.isDeleted ? getFlowMeta(element) : null;
    if (
      flowMeta &&
      flowMeta.id === flowId &&
      (flowMeta.kind === "node" || flowMeta.kind === "screen")
    ) {
      taken.add(flowMeta.key);
    }
  }
  const updates = new Map<string, ExcalidrawElement>();
  let count = 0;
  for (const picked of selected) {
    // the scene's own copy: the caller's may be stale
    const element = map.get(picked.id) ?? picked;
    const isScreen = element.type === "frame";
    if (!isScreen && !isNodeType(element.type)) {
      continue;
    }
    const existing = getFlowMeta(element);
    if (existing && existing.id === flowId) {
      continue;
    }
    const label = isScreen
      ? (element as ExcalidrawFrameElement).name ?? ""
      : textOf(element, map)?.text ?? "";
    const key = slugKey(label || (isScreen ? "screen" : "step"), taken);
    taken.add(key);
    updates.set(
      element.id,
      newElementWith(element, {
        customData: withFlow(element, {
          id: flowId,
          key,
          kind: isScreen ? "screen" : "node",
        }),
      }),
    );
    count++;
  }
  if (updates.size) {
    scene.replaceAllElements(
      all.map((element) => updates.get(element.id) ?? element),
    );
  }
  return count;
};

export const renameFlow = (scene: Scene, from: string, to: string) => {
  if (!to.trim() || from === to) {
    return;
  }
  scene.replaceAllElements(
    scene.getElementsIncludingDeleted().map((element) => {
      const flowMeta = getFlowMeta(element);
      return flowMeta && flowMeta.id === from
        ? newElementWith(element, {
            customData: withFlow(element, { ...flowMeta, id: to }),
          })
        : element;
    }),
  );
};
