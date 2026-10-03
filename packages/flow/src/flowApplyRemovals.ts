import type { ExcalidrawElement } from "@excalidraw/element/types";

import { getFlowMeta } from "./flowMeta";
import { textOf } from "./flowText";

import type { FlowGraph } from "./flowGraph";
import type { FlowParts } from "./flowParts";

/** What the new graph takes away from, or changes on, the canvas. */
export type Changes = {
  gone: Set<string>;
  /** groups whose real objects stay but are no longer grouped */
  ungroup: Set<string>;
  /** label text id -> new words */
  relabel: Map<string, string>;
};

/** every arrow glued to the element goes, with its label */
const dropBoundArrows = (
  element: ExcalidrawElement,
  map: Map<string, ExcalidrawElement>,
  gone: Set<string>,
) => {
  for (const boundElement of element.boundElements ?? []) {
    if (boundElement.type === "arrow") {
      gone.add(boundElement.id);
      const arrow = map.get(boundElement.id);
      const arrowLabel = arrow && textOf(arrow, map);
      if (arrowLabel) {
        gone.add(arrowLabel.id);
      }
    }
  }
};

/**
 * What a flow element drops when its step leaves the text: the outline, label,
 * handle and the placeholder box; real objects are only ungrouped.
 */
const dropWrap = (
  element: ExcalidrawElement,
  key: string,
  all: readonly ExcalidrawElement[],
  parts: FlowParts,
  changes: Changes,
) => {
  const meta = getFlowMeta(element);
  const { gone } = changes;
  gone.add(element.id);
  const label = parts.labels.get(key);
  const handle = parts.handles.get(key);
  if (label) {
    gone.add(label.id);
  }
  if (handle) {
    gone.add(handle.id);
  }
  if (meta?.group) {
    changes.ungroup.add(meta.group);
    for (const other of all) {
      if (
        !other.isDeleted &&
        other.customData?.flowPlaceholder &&
        other.groupIds.includes(meta.group)
      ) {
        gone.add(other.id);
      }
    }
  }
  dropBoundArrows(element, parts.map, gone);
};

/** Steps and screens that are no longer in the graph, and screens to relabel. */
export const planRemovals = (
  all: readonly ExcalidrawElement[],
  parts: FlowParts,
  graph: FlowGraph,
  changes: Changes,
) => {
  const { gone, relabel } = changes;
  const wanted = new Set(graph.nodes.map((node) => node.key));
  const wantedScreens = new Set(
    graph.screens.map((flowScreen) => flowScreen.key),
  );
  for (const [key, element] of parts.wrapScreens) {
    if (!wantedScreens.has(key)) {
      dropWrap(element, key, all, parts, changes);
    }
  }
  for (const flowScreen of graph.screens) {
    const element = parts.wrapScreens.get(flowScreen.key);
    const label = parts.labels.get(flowScreen.key);
    if (element && label && label.text !== flowScreen.label) {
      relabel.set(label.id, flowScreen.label);
    }
  }
  for (const [key, element] of parts.nodes) {
    if (wanted.has(key)) {
      continue;
    }
    if (getFlowMeta(element)?.wrap) {
      dropWrap(element, key, all, parts, changes);
      continue;
    }
    gone.add(element.id);
    const label = textOf(element, parts.map);
    if (label) {
      gone.add(label.id);
    }
    dropBoundArrows(element, parts.map, gone);
  }
};
