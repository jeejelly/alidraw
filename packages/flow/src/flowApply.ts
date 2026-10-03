import {
  convertToExcalidrawElements,
  newElementWith,
} from "@excalidraw/element";

import type { Scene } from "@excalidraw/element";
import type {
  ExcalidrawElement,
  ExcalidrawFrameElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { buildFrames } from "./flowApplyFrames";
import {
  buildLinkSkeletons,
  collectArrowRefs,
  rememberLinkLooks,
  uniqueRefs,
} from "./flowApplyLinks";
import {
  bindingStub,
  buildNodeBatch,
  frameNodes,
  mergeNodes,
  nodeSize,
} from "./flowApplyNodes";
import { planRemovals, type Changes } from "./flowApplyRemovals";
import { layoutNewNodes } from "./flowLayout";
import { getFlowMeta } from "./flowMeta";
import { partsOf, type FlowParts } from "./flowParts";
import { relabelText } from "./flowText";

import type { FlowGraph, FlowIssue } from "./flowGraph";

const NODE_GAP = 70;

/** Steps that exist stay where they are; the rest are laid out around them. */
const placeNewNodes = (
  graph: FlowGraph,
  oldNodes: Map<string, ExcalidrawElement>,
  origin: { x: number; y: number },
) => {
  const sizes = new Map(graph.nodes.map((node) => [node.key, nodeSize(node)]));
  const fixed = new Map<
    string,
    { x: number; y: number; w: number; h: number }
  >();
  for (const node of graph.nodes) {
    const old = oldNodes.get(node.key);
    if (old) {
      fixed.set(node.key, { x: old.x, y: old.y, w: old.width, h: old.height });
    }
  }
  return {
    sizes,
    placed: layoutNewNodes(graph, fixed, sizes, origin, NODE_GAP),
  };
};

/** bound texts of recreated nodes follow their container's frame */
const followContainerFrames = (
  extra: readonly ExcalidrawElement[],
  nodeById: Map<string, ExcalidrawElement>,
) =>
  extra.map((element) =>
    element.type === "text" &&
    element.containerId &&
    nodeById.has(element.containerId)
      ? newElementWith(element, {
          frameId: nodeById.get(element.containerId)!.frameId,
        })
      : element,
  );

/** The elements that replace old ones with the same id. */
const replacementsOf = ({
  finalNodes,
  frames,
  containers,
  wrapScreens,
  arrowRefs,
  gone,
}: {
  finalNodes: Map<string, ExcalidrawElement>;
  frames: Map<string, ExcalidrawFrameElement>;
  containers: FlowGraph["screens"];
  wrapScreens: Map<string, ExcalidrawElement>;
  arrowRefs: ReturnType<typeof collectArrowRefs>;
  gone: Set<string>;
}) => {
  const replaced = new Map<string, ExcalidrawElement>();
  for (const node of finalNodes.values()) {
    replaced.set(node.id, node);
  }
  for (const frame of frames.values()) {
    replaced.set(frame.id, frame);
  }
  for (const flowScreen of containers) {
    const element = wrapScreens.get(flowScreen.key)!;
    const refs = [
      ...(element.boundElements ?? []).filter(
        (boundElement) => !gone.has(boundElement.id),
      ),
      ...(arrowRefs.get(element.id) ?? []),
    ];
    replaced.set(
      element.id,
      newElementWith(element, { boundElements: uniqueRefs(refs) }),
    );
  }
  return replaced;
};

/**
 * Draws the steps, then the links glued to them (two passes: labels may grow
 * the boxes the links start from).
 */
const drawStepsAndLinks = ({
  graph,
  flowId,
  parts,
  containers,
  placed,
  sizes,
  carry,
  changes,
  issues,
}: {
  graph: FlowGraph;
  flowId: string;
  parts: FlowParts;
  containers: FlowGraph["screens"];
  placed: Map<string, { x: number; y: number }>;
  sizes: Map<string, { w: number; h: number }>;
  carry: ReturnType<typeof rememberLinkLooks>;
  changes: Changes;
  issues: FlowIssue[];
}) => {
  const { batch, idOf, recreated } = buildNodeBatch({
    graph,
    flowId,
    parts,
    placed,
    sizes,
    changes,
  });
  // screens made of flow elements can be linked too
  for (const flowScreen of containers) {
    const element = parts.wrapScreens.get(flowScreen.key)!;
    idOf.set(flowScreen.key, element.id);
    batch.push(bindingStub(element));
  }

  // phase 1: the steps (labels may grow their boxes)
  const nodeOut = convertToExcalidrawElements(batch, { regenerateIds: false });
  const nodeOutById = new Map(nodeOut.map((element) => [element.id, element]));
  const rectOf = (key: string) => {
    const existing = nodeOutById.get(idOf.get(key)!)!;
    return {
      x: existing.x,
      y: existing.y,
      w: existing.width,
      h: existing.height,
      type: existing.type,
    };
  };

  // phase 2: the links, from the border of one step to the border of the next
  const arrowSkeletons = buildLinkSkeletons({
    graph,
    flowId,
    idOf,
    rectOf,
    carry,
    issues,
  });
  const linkOut = convertToExcalidrawElements(
    [
      // the steps as they ended up, only to glue the links to
      ...[
        ...graph.nodes.map((node) => node.key),
        ...containers.map((flowScreen) => flowScreen.key),
      ].map((key) => bindingStub(nodeOutById.get(idOf.get(key)!)!)),
      ...arrowSkeletons,
    ],
    { regenerateIds: false },
  );
  const out = [
    ...nodeOut.filter((element) => element.type === "text"),
    ...nodeOut.filter((element) => element.type !== "text"),
    ...linkOut.filter((element) => !nodeOutById.has(element.id)),
  ];
  const newArrowIds = new Set(
    arrowSkeletons.map((arrowSkeleton) => arrowSkeleton.id),
  );
  return { idOf, recreated, out, newArrowIds };
};

/** The scene's elements after the change: deletions, replacements, additions. */
const rebuildElements = ({
  all,
  flowId,
  graph,
  changes,
  replaced,
  nodeById,
  finalNodes,
  extraFinal,
  frames,
}: {
  all: readonly ExcalidrawElement[];
  flowId: string;
  graph: FlowGraph;
  changes: Changes;
  replaced: Map<string, ExcalidrawElement>;
  nodeById: Map<string, ExcalidrawElement>;
  finalNodes: Map<string, ExcalidrawElement>;
  extraFinal: ExcalidrawElement[];
  frames: Map<string, ExcalidrawFrameElement>;
}) => {
  const screenKeys = new Set(graph.screens.map((flowScreen) => flowScreen.key));
  const next: ExcalidrawElement[] = [
    ...[...frames.values()].filter(
      (frame) => !all.some((element) => element.id === frame.id),
    ),
  ];
  for (const element of all) {
    if (changes.gone.has(element.id)) {
      next.push(newElementWith(element, { isDeleted: true }));
      continue;
    }
    // a removed screen disappears; its steps are no longer framed
    const meta = getFlowMeta(element);
    if (
      meta &&
      meta.id === flowId &&
      meta.kind === "screen" &&
      !screenKeys.has(meta.key)
    ) {
      next.push(newElementWith(element, { isDeleted: true }));
      continue;
    }
    // a step's label follows its frame
    const owner =
      element.type === "text" && element.containerId
        ? nodeById.get(element.containerId)
        : null;
    let current: ExcalidrawElement =
      replaced.get(element.id) ??
      (owner && owner.frameId !== element.frameId
        ? newElementWith(element, { frameId: owner.frameId })
        : element);
    if (
      changes.ungroup.size &&
      current.groupIds.some((groupId) => changes.ungroup.has(groupId))
    ) {
      current = newElementWith(current, {
        groupIds: current.groupIds.filter(
          (groupId) => !changes.ungroup.has(groupId),
        ),
      });
    }
    const text = changes.relabel.get(element.id);
    if (text !== undefined && current.type === "text") {
      current = relabelText(current as ExcalidrawTextElement, text);
    }
    next.push(current);
  }
  const insertedIds = new Set(next.map((element) => element.id));
  for (const element of [...finalNodes.values(), ...extraFinal]) {
    if (!insertedIds.has(element.id)) {
      next.push(element);
    }
  }
  return next;
};

/**
 * Makes the canvas say what the graph says. Steps that exist keep their place,
 * size and style (only a changed label or shape is touched); new steps are put
 * next to the step they link to; links are redrawn glued to their steps,
 * keeping their colour; screens are frames that grow to hold their steps.
 */
export const applyFlow = (
  scene: Scene,
  flowId: string,
  graph: FlowGraph,
  origin: { x: number; y: number },
): FlowIssue[] => {
  const issues: FlowIssue[] = [];
  const all = scene.getElementsIncludingDeleted();
  const parts = partsOf(all, flowId);
  const { nodes: oldNodes, screens: oldScreens, wrapScreens } = parts;

  const changes: Changes = {
    gone: new Set(),
    ungroup: new Set(),
    relabel: new Map(),
  };
  // links are redrawn: remember their look
  const carry = rememberLinkLooks(parts, changes.gone);
  planRemovals(all, parts, graph, changes);

  const { sizes, placed } = placeNewNodes(graph, oldNodes, origin);

  const containers = graph.screens.filter((flowScreen) =>
    wrapScreens.has(flowScreen.key),
  );
  const { idOf, recreated, out, newArrowIds } = drawStepsAndLinks({
    graph,
    flowId,
    parts,
    containers,
    placed,
    sizes,
    carry,
    changes,
    issues,
  });
  const outById = new Map(out.map((element) => [element.id, element]));
  const arrowRefs = collectArrowRefs(out, newArrowIds);

  // the new element list: old ones kept or replaced, new ones added
  const finalNodes = mergeNodes({
    graph,
    flowId,
    oldNodes,
    idOf,
    recreated,
    outById,
    arrowRefs,
    gone: changes.gone,
  });
  // arrows, and the labels of recreated steps or of new links
  const extra = out.filter(
    (element) =>
      newArrowIds.has(element.id) ||
      (element.type === "text" && element.containerId),
  );

  const frames = buildFrames({
    graph,
    flowId,
    origin,
    oldScreens,
    wrapScreens,
    finalNodes,
  });
  frameNodes({ graph, oldNodes, wrapScreens, frames, finalNodes, issues });

  const nodeById = new Map(
    [...finalNodes.values()].map((node) => [node.id, node]),
  );
  const extraFinal = followContainerFrames(extra, nodeById);

  const replaced = replacementsOf({
    finalNodes,
    frames,
    containers,
    wrapScreens,
    arrowRefs,
    gone: changes.gone,
  });
  scene.replaceAllElements(
    rebuildElements({
      all,
      flowId,
      graph,
      changes,
      replaced,
      nodeById,
      finalNodes,
      extraFinal,
      frames,
    }),
  );
  return issues;
};
