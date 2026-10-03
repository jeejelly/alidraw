import { randomId, ROUNDNESS } from "@excalidraw/common";
import { newElementWith } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawFrameElement,
} from "@excalidraw/element/types";

import { uniqueRefs, type collectArrowRefs } from "./flowApplyLinks";
import { getFlowMeta, withFlow, type FlowMeta } from "./flowMeta";
import { textOf } from "./flowText";

import type { Changes } from "./flowApplyRemovals";
import type { FlowGraph, FlowIssue, FlowNode } from "./flowGraph";
import type { FlowParts } from "./flowParts";

export const nodeSize = (node: FlowNode) => {
  const longest = Math.max(
    ...node.label.split("\n").map((line) => line.length),
    4,
  );
  const width = Math.min(280, Math.max(120, longest * 9 + 40));
  const lines = node.label.split("\n").length;
  const height = Math.max(56, lines * 26 + 28);
  return node.shape === "diamond"
    ? { w: Math.round(width * 1.25), h: Math.round(height * 1.5) }
    : { w: width, h: height };
};

/** only for binding the new arrows */
export const bindingStub = (element: ExcalidrawElement) => ({
  ...element,
  boundElements: [],
  frameId: null,
});

const skeletonType = (shape: FlowNode["shape"]) =>
  shape === "diamond"
    ? "diamond"
    : shape === "ellipse"
    ? "ellipse"
    : "rectangle";

/** The steps to draw: untouched ones as stubs, changed or new ones in full. */
export const buildNodeBatch = ({
  graph,
  flowId,
  parts,
  placed,
  sizes,
  changes,
}: {
  graph: FlowGraph;
  flowId: string;
  parts: FlowParts;
  placed: Map<string, { x: number; y: number }>;
  sizes: Map<string, { w: number; h: number }>;
  changes: Changes;
}) => {
  const { map, nodes: oldNodes, labels } = parts;
  const batch: any[] = [];
  const idOf = new Map<string, string>();
  const recreated = new Set<string>();
  for (const node of graph.nodes) {
    const old = oldNodes.get(node.key);
    if (old && getFlowMeta(old)?.wrap) {
      // a flow element keeps what it wraps; only its label text follows
      const label = labels.get(node.key);
      if (label && label.text !== node.label) {
        changes.relabel.set(label.id, node.label);
      }
      idOf.set(node.key, old.id);
      batch.push(bindingStub(old));
      continue;
    }
    const type = skeletonType(node.shape);
    const roundness =
      node.shape === "round" ? { type: ROUNDNESS.ADAPTIVE_RADIUS } : null;
    const oldText = old ? textOf(old, map) : null;
    const labelChanged = !old || (oldText?.text ?? "") !== node.label;
    const typeChanged =
      !!old && (old.type !== type || !!old.roundness !== !!roundness);
    if (old && !labelChanged && !typeChanged) {
      idOf.set(node.key, old.id);
      batch.push(bindingStub(old));
      continue;
    }
    const meta: FlowMeta = { id: flowId, key: node.key, kind: "node" };
    const base = old
      ? { ...old, type, roundness, boundElements: [], frameId: null }
      : {
          type,
          id: randomId(),
          x: placed.get(node.key)!.x,
          y: placed.get(node.key)!.y,
          width: sizes.get(node.key)!.w,
          height: sizes.get(node.key)!.h,
          roundness,
        };
    idOf.set(node.key, base.id);
    recreated.add(node.key);
    if (old && oldText) {
      changes.gone.add(oldText.id);
    }
    batch.push({
      ...base,
      customData: old ? withFlow(old, meta) : { flow: meta },
      ...(node.label
        ? {
            label: {
              text: node.label,
              ...(oldText
                ? { fontSize: oldText.fontSize, fontFamily: oldText.fontFamily }
                : {}),
            },
          }
        : {}),
    });
  }
  return { batch, idOf, recreated };
};

/** the parts of a step's meta that the text decides */
const withoutLook = (meta: FlowMeta): FlowMeta => {
  const { form: _form, classes: _classes, ...rest } = meta;
  return rest;
};

/** The steps as they ended up, with the bindings of the new links. */
export const mergeNodes = ({
  graph,
  flowId,
  oldNodes,
  idOf,
  recreated,
  outById,
  arrowRefs,
  gone,
}: {
  graph: FlowGraph;
  flowId: string;
  oldNodes: Map<string, ExcalidrawElement>;
  idOf: Map<string, string>;
  recreated: Set<string>;
  outById: Map<string, ExcalidrawElement>;
  arrowRefs: ReturnType<typeof collectArrowRefs>;
  gone: Set<string>;
}) => {
  const finalNodes = new Map<string, ExcalidrawElement>();
  for (const flowNode of graph.nodes) {
    const id = idOf.get(flowNode.key)!;
    const old = oldNodes.get(flowNode.key);
    const fresh = outById.get(id)!;
    const isRecreated = recreated.has(flowNode.key);
    const base = isRecreated ? fresh : old!;
    const kept = (old?.boundElements ?? []).filter(
      (boundElement) =>
        !gone.has(boundElement.id) &&
        (!isRecreated || boundElement.type !== "text"),
    );
    const fromBatch = isRecreated
      ? (fresh.boundElements ?? []).filter(
          (boundElement) => boundElement.type === "text",
        )
      : [];
    const refs = [...kept, ...fromBatch, ...(arrowRefs.get(id) ?? [])];
    finalNodes.set(
      flowNode.key,
      newElementWith(base, {
        boundElements: uniqueRefs(refs),
        customData: withFlow(base, {
          ...(getFlowMeta(base)?.wrap ? withoutLook(getFlowMeta(base)!) : {}),
          id: flowId,
          key: flowNode.key,
          kind: "node",
          ...(flowNode.form ? { form: flowNode.form } : {}),
          ...(flowNode.classes?.length ? { classes: flowNode.classes } : {}),
        }),
      }),
    );
  }
  return finalNodes;
};

/** Puts each step in its screen's frame, and warns about misplaced ones. */
export const frameNodes = ({
  graph,
  oldNodes,
  wrapScreens,
  frames,
  finalNodes,
  issues,
}: {
  graph: FlowGraph;
  oldNodes: Map<string, ExcalidrawElement>;
  wrapScreens: Map<string, ExcalidrawElement>;
  frames: Map<string, ExcalidrawFrameElement>;
  finalNodes: Map<string, ExcalidrawElement>;
  issues: FlowIssue[];
}) => {
  const frameIdOfScreen = new Map(
    [...frames].map(([screenKey, frame]) => [screenKey, frame.id]),
  );
  for (const flowNode of graph.nodes) {
    const element = finalNodes.get(flowNode.key)!;
    if (
      flowNode.screen &&
      wrapScreens.has(flowNode.screen) &&
      !oldNodes.get(flowNode.key)
    ) {
      issues.push({
        line: 0,
        message: `"${flowNode.key}" is drawn outside "${flowNode.screen}": nest it on the canvas (convert both to flow elements)`,
        warn: true,
      });
    }
    if (getFlowMeta(oldNodes.get(flowNode.key) ?? {})?.wrap) {
      continue;
    }
    finalNodes.set(
      flowNode.key,
      newElementWith(element, {
        frameId: flowNode.screen
          ? frameIdOfScreen.get(flowNode.screen) ?? null
          : null,
      }),
    );
  }
};
