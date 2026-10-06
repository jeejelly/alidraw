import { rankKeys } from "./flowRank";
import { isHiddenScreen } from "./flowScreens";

import type { FlowDirection, FlowGraph } from "./flowGraph";

type Rect = { x: number; y: number; w: number; h: number };
type Size = { w: number; h: number };
type Point = { x: number; y: number };

/** the gap between a frame and what it holds (the frame's own drawing must agree: see flowApplyFrames) */
export const FRAME_PAD = 28;
/** more room above a frame that holds frames: their titles sit there */
export const FRAME_TITLE = 26;

const ROOT = "";

type Arranged = { rects: Map<string, Rect>; w: number; h: number };

/**
 * Layout with subgraphs: each subgraph is laid out on its own (its steps and its
 * inner subgraphs as boxes, ranked by the links between them) and then placed as a
 * box among its siblings. A link between steps of different subgraphs counts as a
 * link between the two boxes that hold them where their paths part. A subgraph's
 * own direction is used only when none of its steps links out (as Mermaid does).
 */
export const layoutCompound = (
  graph: FlowGraph,
  sizes: ReadonlyMap<string, Size>,
  origin: Point,
  gap: number,
): Map<string, Point> => {
  const nodeKeys = new Set(graph.nodes.map((node) => node.key));
  const screenByKey = new Map(
    graph.screens.map((screen) => [screen.key, screen]),
  );
  const hidden = new Set(
    graph.screens
      .filter((screen) => isHiddenScreen(graph, screen))
      .map((screen) => screen.key),
  );
  const parentOf = (key: string): string | undefined =>
    nodeKeys.has(key)
      ? graph.nodes.find((node) => node.key === key)?.screen
      : screenByKey.get(key)?.parent;
  const nodeParent = new Map(
    graph.nodes.map((node) => [node.key, node.screen]),
  );
  const chain = (key: string): string[] => {
    const path = [key];
    let parent = nodeParent.has(key) ? nodeParent.get(key) : parentOf(key);
    for (let guard = 0; parent && guard < 50; guard++) {
      path.unshift(parent);
      parent = screenByKey.get(parent)?.parent;
    }
    return path;
  };

  // the links, lifted to the container where their ends part
  type Lifted = { from: string; to: string; label: number };
  const lifted = new Map<string, Lifted[]>();
  const crossing = new Set<string>();
  for (const edge of graph.edges) {
    if (!nodeKeys.has(edge.from) || !nodeKeys.has(edge.to)) {
      continue;
    }
    const first = chain(edge.from);
    const second = chain(edge.to);
    let index = 0;
    while (
      index < first.length - 1 &&
      index < second.length - 1 &&
      first[index] === second[index]
    ) {
      index++;
    }
    // the screens only one end is in: the link leaves them
    for (const screen of [
      ...first.slice(index, -1),
      ...second.slice(index, -1),
    ]) {
      crossing.add(screen);
    }
    if (first[index] === second[index]) {
      continue;
    }
    const container = index === 0 ? ROOT : first[index - 1];
    const label = Math.max(
      0,
      ...edge.label.split("\n").map((line) => line.length),
    );
    lifted.set(container, [
      ...(lifted.get(container) ?? []),
      { from: first[index], to: second[index], label },
    ]);
  }

  const itemsOf = (container: string) => {
    const items: string[] = [];
    // document order: steps and screens as they were first mentioned
    for (const node of graph.nodes) {
      if ((node.screen ?? ROOT) === container) {
        items.push(node.key);
      }
    }
    for (const screen of graph.screens) {
      if ((screen.parent ?? ROOT) === container) {
        items.push(screen.key);
      }
    }
    return items;
  };
  const padsOf = (key: string) => {
    if (hidden.has(key)) {
      return { x: 0, top: 0, bottom: 0 };
    }
    const nests = graph.screens.some(
      (screen) => screen.parent === key && !hidden.has(screen.key),
    );
    return {
      x: FRAME_PAD,
      top: FRAME_PAD + (nests ? FRAME_TITLE : 0),
      bottom: FRAME_PAD,
    };
  };

  const arranged = new Map<string, Arranged>();
  const sizeOf = (key: string): Size => {
    if (nodeKeys.has(key)) {
      return sizes.get(key)!;
    }
    const inner = arranged.get(key)!;
    const pads = padsOf(key);
    return { w: inner.w + pads.x * 2, h: inner.h + pads.top + pads.bottom };
  };

  const arrange = (
    container: string,
    direction: FlowDirection,
    depth: number,
  ) => {
    const items = itemsOf(container);
    // inner screens first: their sizes are needed here
    for (const key of items.filter((item) => !nodeKeys.has(item))) {
      const screen = screenByKey.get(key)!;
      const own =
        screen.direction && !crossing.has(key) ? screen.direction : direction;
      arrange(key, own, depth + 1);
    }
    const horizontal = direction === "LR" || direction === "RL";
    const reverse = direction === "BT" || direction === "RL";
    const along = depth === 0 ? gap * 2.2 : gap * 1.4;
    const across = depth === 0 ? gap : gap * 0.7;
    const links = lifted.get(container) ?? [];
    const rank = rankKeys(
      items,
      links.map((link) => [link.from, link.to] as const),
    );
    const lanes = new Map<number, string[]>();
    for (const key of items) {
      lanes.set(rank.get(key)!, [...(lanes.get(rank.get(key)!) ?? []), key]);
    }
    const order = [...lanes.keys()].sort((first, second) => first - second);
    const extent = (key: string) =>
      horizontal ? sizeOf(key).h : sizeOf(key).w;
    const thick = (key: string) => (horizontal ? sizeOf(key).w : sizeOf(key).h);
    // across-axis centres, every lane centred on the same axis
    const centre = new Map<string, number>();
    const laneSpan = (keys: string[]) =>
      keys.reduce(
        (sum, key, index) => sum + extent(key) + (index ? across : 0),
        0,
      );
    for (const laneRank of order) {
      const keys = lanes.get(laneRank)!;
      const wish = (key: string) => {
        const before = links
          .filter((link) => link.to === key && centre.has(link.from))
          .map((link) => centre.get(link.from)!);
        return before.length
          ? before.reduce((sum, value) => sum + value, 0) / before.length
          : null;
      };
      keys.sort((first, second) => {
        const one = wish(first);
        const two = wish(second);
        return one === null || two === null ? 0 : one - two;
      });
      let cursor = -laneSpan(keys) / 2;
      for (const key of keys) {
        centre.set(key, cursor + extent(key) / 2);
        cursor += extent(key) + across;
      }
    }
    const widest = Math.max(
      0,
      ...order.map((laneRank) => laneSpan(lanes.get(laneRank)!)),
    );
    // the room a link's label needs between two lanes
    const betweenLanes = order.map((laneRank, index) => {
      const next = order[index + 1];
      if (next === undefined) {
        return 0;
      }
      const label = Math.max(
        0,
        ...links
          .filter(
            (link) =>
              rank.get(link.from) === laneRank && rank.get(link.to) === next,
          )
          .map((link) => link.label),
      );
      return Math.max(along, label * 7.5 + 50);
    });
    const rects = new Map<string, Rect>();
    let at = 0;
    const laneAt = new Map<number, { at: number; size: number }>();
    order.forEach((laneRank, index) => {
      const size = Math.max(...lanes.get(laneRank)!.map(thick));
      laneAt.set(laneRank, { at, size });
      at += size + betweenLanes[index];
    });
    const total = Math.max(0, at - (betweenLanes[order.length - 1] ?? 0));
    for (const laneRank of order) {
      const lane = laneAt.get(laneRank)!;
      for (const key of lanes.get(laneRank)!) {
        const size = sizeOf(key);
        const main = reverse ? total - lane.at - lane.size : lane.at;
        const side = widest / 2 + centre.get(key)! - extent(key) / 2;
        // a step is centred in its lane along the flow as well
        const along0 = main + (lane.size - thick(key)) / 2;
        rects.set(
          key,
          horizontal
            ? { x: along0, y: side, w: size.w, h: size.h }
            : { x: side, y: along0, w: size.w, h: size.h },
        );
      }
    }
    arranged.set(container, {
      rects,
      w: horizontal ? total : widest,
      h: horizontal ? widest : total,
    });
  };
  arrange(ROOT, graph.direction, 0);

  const out = new Map<string, Point>();
  const assign = (container: string, ox: number, oy: number) => {
    for (const [key, rect] of arranged.get(container)!.rects) {
      if (nodeKeys.has(key)) {
        out.set(key, { x: ox + rect.x, y: oy + rect.y });
      } else {
        const pads = padsOf(key);
        assign(key, ox + rect.x + pads.x, oy + rect.y + pads.top);
      }
    }
  };
  assign(ROOT, origin.x, origin.y);
  return out;
};
