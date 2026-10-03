import { newElementWith, newFrameElement } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawFrameElement,
} from "@excalidraw/element/types";

import { withFlow, type FlowMeta } from "./flowMeta";

import type { FlowGraph } from "./flowGraph";

const FRAME_PAD = 28;

type Rect = { x: number; y: number; w: number; h: number };

/** the frame around a screen's steps, or a default box when it has none */
const frameRectOf = (
  members: readonly ExcalidrawElement[],
  origin: { x: number; y: number },
): Rect => {
  if (!members.length) {
    return { x: origin.x, y: origin.y, w: 240, h: 160 };
  }
  const left = Math.min(...members.map((member) => member.x));
  const top = Math.min(...members.map((member) => member.y));
  const right = Math.max(...members.map((member) => member.x + member.width));
  const bottom = Math.max(...members.map((member) => member.y + member.height));
  return {
    x: left - FRAME_PAD,
    y: top - FRAME_PAD,
    w: right - left + FRAME_PAD * 2,
    h: bottom - top + FRAME_PAD * 2,
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
    const members = graph.nodes
      .filter((flowNode) => flowNode.screen === flowScreen.key)
      .map((flowNode) => finalNodes.get(flowNode.key)!);
    const old = oldScreens.get(flowScreen.key);
    const rect = frameRectOf(members, origin);
    const meta: FlowMeta = { id: flowId, key: flowScreen.key, kind: "screen" };
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
