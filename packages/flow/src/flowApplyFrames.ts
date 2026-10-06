import { newElementWith, newFrameElement } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawFrameElement,
} from "@excalidraw/element/types";

import { FRAME_PAD, FRAME_TITLE } from "./flowLayoutTree";
import { withFlow, type FlowMeta } from "./flowMeta";

import type { FlowGraph } from "./flowGraph";

type Rect = { x: number; y: number; w: number; h: number };

/** the frame around a screen's steps and inner screens, or a default box when it holds none */
const frameRectOf = (
  graph: FlowGraph,
  key: string,
  finalNodes: Map<string, ExcalidrawElement>,
  origin: { x: number; y: number },
  seen = new Set<string>(),
): Rect => {
  const boxes: Rect[] = graph.nodes
    .filter((flowNode) => flowNode.screen === key)
    .map((flowNode) => finalNodes.get(flowNode.key)!)
    .map((member) => ({
      x: member.x,
      y: member.y,
      w: member.width,
      h: member.height,
    }));
  const inner = graph.screens.filter(
    (flowScreen) => flowScreen.parent === key && !seen.has(flowScreen.key),
  );
  for (const flowScreen of inner) {
    boxes.push(
      frameRectOf(
        graph,
        flowScreen.key,
        finalNodes,
        origin,
        new Set([...seen, key]),
      ),
    );
  }
  if (!boxes.length) {
    return { x: origin.x, y: origin.y, w: 240, h: 160 };
  }
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.w));
  const bottom = Math.max(...boxes.map((box) => box.y + box.h));
  // a frame that holds frames leaves room for their titles
  const above = FRAME_PAD + (inner.length ? FRAME_TITLE : 0);
  return {
    x: left - FRAME_PAD,
    y: top - above,
    w: right - left + FRAME_PAD * 2,
    h: bottom - top + FRAME_PAD + above,
  };
};

/** Screens drawn as frames: existing ones only grow, new ones are created. */
export const buildFrames = ({
  graph,
  flowId,
  origin,
  oldScreens,
  wrapScreens,
  finalNodes,
}: {
  graph: FlowGraph;
  flowId: string;
  origin: { x: number; y: number };
  oldScreens: Map<string, ExcalidrawFrameElement>;
  wrapScreens: Map<string, ExcalidrawElement>;
  finalNodes: Map<string, ExcalidrawElement>;
}) => {
  const frames = new Map<string, ExcalidrawFrameElement>();
  for (const flowScreen of graph.screens) {
    if (wrapScreens.has(flowScreen.key)) {
      continue;
    }
    const old = oldScreens.get(flowScreen.key);
    const rect = frameRectOf(graph, flowScreen.key, finalNodes, origin);
    const meta: FlowMeta = {
      id: flowId,
      key: flowScreen.key,
      kind: "screen",
      ...(flowScreen.direction ? { direction: flowScreen.direction } : {}),
    };
    if (old) {
      const left = Math.min(old.x, rect.x);
      const top = Math.min(old.y, rect.y);
      const right = Math.max(old.x + old.width, rect.x + rect.w);
      const bottom = Math.max(old.y + old.height, rect.y + rect.h);
      frames.set(
        flowScreen.key,
        newElementWith(old, {
          name: flowScreen.label,
          x: left,
          y: top,
          width: right - left,
          height: bottom - top,
          customData: withFlow(old, meta),
        }),
      );
    } else {
      frames.set(
        flowScreen.key,
        newFrameElement({
          name: flowScreen.label,
          x: rect.x,
          y: rect.y,
          width: rect.w,
          height: rect.h,
          customData: { flow: meta },
        } as any),
      );
    }
  }
  return frames;
};
