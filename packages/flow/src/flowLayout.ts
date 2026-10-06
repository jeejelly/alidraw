import { layoutCompound } from "./flowLayoutTree";
import { rankKeys } from "./flowRank";

import type { FlowGraph } from "./flowGraph";

type Rect = { x: number; y: number; w: number; h: number };

const overlaps = (first: Rect, second: Rect, gap: number) =>
  first.x < second.x + second.w + gap &&
  second.x < first.x + first.w + gap &&
  first.y < second.y + second.h + gap &&
  second.y < first.y + first.h + gap;

/** longest-path ranks, ignoring edges that close a cycle */
const rankNodes = (graph: FlowGraph) =>
  rankKeys(
    graph.nodes.map((node) => node.key),
    graph.edges.map((edge) => [edge.from, edge.to]),
  );

type Size = { w: number; h: number };
type Point = { x: number; y: number };

type Flow = {
  horizontal: boolean;
  /** 1 along the flow's direction, -1 against it (BT, RL) */
  along: 1 | -1;
  gap: number;
};

/** the step keys of each rank, steps of the same screen side by side */
const rowsOf = (graph: FlowGraph) => {
  const rank = rankNodes(graph);
  const screenOrder = new Map(
    graph.screens.map((flowScreen, index) => [flowScreen.key, index]),
  );
  const rows = new Map<number, string[]>();
  for (const node of graph.nodes) {
    const nodeRank = rank.get(node.key)!;
    rows.set(nodeRank, [...(rows.get(nodeRank) ?? []), node.key]);
  }
  const nodeByKey = new Map(graph.nodes.map((node) => [node.key, node]));
  for (const keys of rows.values()) {
    keys.sort(
      (firstKey, secondKey) =>
        (screenOrder.get(nodeByKey.get(firstKey)!.screen ?? "") ?? -1) -
        (screenOrder.get(nodeByKey.get(secondKey)!.screen ?? "") ?? -1),
    );
  }
  return { rows, nodeByKey };
};

/** With nothing placed: a layered layout in the graph's direction. */
const layoutLayered = (
  graph: FlowGraph,
  sizes: ReadonlyMap<string, Size>,
  origin: Point,
  { horizontal, along, gap }: Flow,
  put: (key: string, rect: Rect) => void,
) => {
  const { rows, nodeByKey } = rowsOf(graph);
  const ranks = [...rows.keys()].sort((first, second) => first - second);
  // thickness of each rank along the flow, extent across it
  let cursor = 0;
  const lanes: { keys: string[]; at: number; size: number }[] = [];
  for (const currentRank of ranks) {
    const keys = rows.get(currentRank)!;
    const thick = Math.max(
      ...keys.map((key) =>
        horizontal ? sizes.get(key)!.w : sizes.get(key)!.h,
      ),
    );
    lanes.push({ keys, at: cursor, size: thick });
    cursor += thick + gap * 2.2;
  }
  const total = cursor - gap * 2.2;
  const screenBreak = (keys: string[], index: number) =>
    index > 0 &&
    nodeByKey.get(keys[index - 1])!.screen !==
      nodeByKey.get(keys[index])!.screen;
  const span = (keys: string[]) =>
    keys.reduce(
      (running, key, index) =>
        running +
        (horizontal ? sizes.get(key)!.h : sizes.get(key)!.w) +
        (index ? gap : 0) +
        (screenBreak(keys, index) ? gap * 0.6 : 0),
      0,
    );
  const widest = Math.max(...lanes.map((lane) => span(lane.keys)));
  for (const lane of lanes) {
    let across = (widest - span(lane.keys)) / 2;
    lane.keys.forEach((key, index) => {
      const size = sizes.get(key)!;
      if (screenBreak(lane.keys, index)) {
        across += gap * 0.6;
      }
      const main = along === 1 ? lane.at : total - lane.at - lane.size;
      const x = horizontal ? main : across;
      const y = horizontal ? across : main;
      put(key, { x: origin.x + x, y: origin.y + y, w: size.w, h: size.h });
      across += (horizontal ? size.h : size.w) + gap;
    });
  }
};

/** beside the placed step the new one links to, or under everything */
const spotFor = (
  graph: FlowGraph,
  nodeKey: string,
  size: Size,
  placed: ReadonlyMap<string, Rect>,
  origin: Point,
  { horizontal, along, gap }: Flow,
): Rect => {
  const outEdge = graph.edges.find(
    (edge) => edge.to === nodeKey && placed.has(edge.from),
  );
  const inEdge = graph.edges.find(
    (edge) => edge.from === nodeKey && placed.has(edge.to),
  );
  const anchor = outEdge
    ? placed.get(outEdge.from)!
    : inEdge
    ? placed.get(inEdge.to)!
    : null;
  if (!anchor) {
    const all = [...placed.values()];
    const bottom = all.length
      ? Math.max(...all.map((bounds) => bounds.y + bounds.h))
      : origin.y;
    const left = all.length
      ? Math.min(...all.map((bounds) => bounds.x))
      : origin.x;
    return { x: left, y: bottom + gap * 2.2, w: size.w, h: size.h };
  }
  const dir = outEdge ? along : inEdge ? -along : along;
  return horizontal
    ? {
        x:
          dir === 1
            ? anchor.x + anchor.w + gap * 2.2
            : anchor.x - size.w - gap * 2.2,
        y: anchor.y + (anchor.h - size.h) / 2,
        w: size.w,
        h: size.h,
      }
    : {
        x: anchor.x + (anchor.w - size.w) / 2,
        y:
          dir === 1
            ? anchor.y + anchor.h + gap * 2.2
            : anchor.y - size.h - gap * 2.2,
        w: size.w,
        h: size.h,
      };
};

/**
 * Positions for the steps that are not on the canvas yet. With nothing placed,
 * a layered layout in the graph's direction from `origin`; otherwise each new
 * step goes next to a step it links to, moved aside when the spot is taken.
 */
export const layoutNewNodes = (
  graph: FlowGraph,
  fixed: ReadonlyMap<string, Rect>,
  sizes: ReadonlyMap<string, Size>,
  origin: Point,
  gap: number,
): Map<string, Point> => {
  const result = new Map<string, Point>();
  const placed = new Map<string, Rect>(fixed);
  const horizontal = graph.direction === "LR" || graph.direction === "RL";
  const reverse = graph.direction === "BT" || graph.direction === "RL";
  const flow: Flow = { horizontal, along: reverse ? -1 : 1, gap };

  const free = (rect: Rect) =>
    ![...placed.values()].some((placedRect) =>
      overlaps(rect, placedRect, gap / 2),
    );
  const put = (key: string, rect: Rect) => {
    placed.set(key, rect);
    result.set(key, { x: rect.x, y: rect.y });
  };

  if (
    !fixed.size &&
    graph.nodes.length &&
    (graph.screens.length || graph.layout === "cascade")
  ) {
    return layoutCompound(graph, sizes, origin, gap);
  }
  if (!fixed.size && graph.nodes.length) {
    layoutLayered(graph, sizes, origin, flow, put);
    return result;
  }

  // incremental: next to a placed neighbour
  for (const node of graph.nodes) {
    if (placed.has(node.key)) {
      continue;
    }
    const size = sizes.get(node.key)!;
    let rect = spotFor(graph, node.key, size, placed, origin, flow);
    for (let attempt = 0; attempt < 40 && !free(rect); attempt++) {
      // sideways, alternating
      const step =
        (Math.floor(attempt / 2) + 1) * ((horizontal ? size.h : size.w) + gap);
      const sign = attempt % 2 ? -1 : 1;
      rect = horizontal
        ? { ...rect, y: rect.y + sign * step }
        : { ...rect, x: rect.x + sign * step };
    }
    put(node.key, rect);
  }
  return result;
};
