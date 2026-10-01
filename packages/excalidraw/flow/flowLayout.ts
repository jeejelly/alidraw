import type { FlowGraph } from "./flowGraph";

type Rect = { x: number; y: number; w: number; h: number };

const overlaps = (a: Rect, b: Rect, gap: number) =>
  a.x < b.x + b.w + gap &&
  b.x < a.x + a.w + gap &&
  a.y < b.y + b.h + gap &&
  b.y < a.y + a.h + gap;

/** longest-path ranks, ignoring edges that close a cycle */
const rankNodes = (graph: FlowGraph) => {
  const keys = graph.nodes.map((n) => n.key);
  const out = new Map<string, string[]>(keys.map((k) => [k, []]));
  for (const e of graph.edges) {
    if (out.has(e.from) && out.has(e.to) && e.from !== e.to) {
      out.get(e.from)!.push(e.to);
    }
  }
  const state = new Map<string, 0 | 1 | 2>();
  const dag = new Map<string, string[]>(keys.map((k) => [k, []]));
  const visit = (k: string) => {
    state.set(k, 1);
    for (const t of out.get(k)!) {
      const s = state.get(t) ?? 0;
      if (s === 1) {
        continue; // back edge
      }
      dag.get(k)!.push(t);
      if (s === 0) {
        visit(t);
      }
    }
    state.set(k, 2);
  };
  const hasIncoming = new Set(graph.edges.map((e) => e.to));
  for (const k of keys.filter((k) => !hasIncoming.has(k))) {
    if (!state.get(k)) {
      visit(k);
    }
  }
  for (const k of keys) {
    if (!state.get(k)) {
      visit(k);
    }
  }
  const rank = new Map<string, number>(keys.map((k) => [k, 0]));
  // relax along the DAG until stable (small graphs)
  for (let pass = 0; pass < keys.length; pass++) {
    let changed = false;
    for (const [k, targets] of dag) {
      for (const t of targets) {
        if (rank.get(t)! < rank.get(k)! + 1) {
          rank.set(t, rank.get(k)! + 1);
          changed = true;
        }
      }
    }
    if (!changed) {
      break;
    }
  }
  return rank;
};

/**
 * Positions for the steps that are not on the canvas yet. With nothing placed,
 * a layered layout in the graph's direction from `origin`; otherwise each new
 * step goes next to a step it links to, moved aside when the spot is taken.
 */
export const layoutNewNodes = (
  graph: FlowGraph,
  fixed: ReadonlyMap<string, Rect>,
  sizes: ReadonlyMap<string, { w: number; h: number }>,
  origin: { x: number; y: number },
  gap: number,
): Map<string, { x: number; y: number }> => {
  const result = new Map<string, { x: number; y: number }>();
  const placed = new Map<string, Rect>(fixed);
  const horizontal = graph.direction === "LR" || graph.direction === "RL";
  const reverse = graph.direction === "BT" || graph.direction === "RL";
  const along = reverse ? -1 : 1;

  const free = (r: Rect) =>
    ![...placed.values()].some((p) => overlaps(r, p, gap / 2));
  const put = (key: string, r: Rect) => {
    placed.set(key, r);
    result.set(key, { x: r.x, y: r.y });
  };

  if (!fixed.size && graph.nodes.length) {
    const rank = rankNodes(graph);
    const screenOrder = new Map(graph.screens.map((s, i) => [s.key, i]));
    const rows = new Map<number, string[]>();
    for (const n of graph.nodes) {
      const r = rank.get(n.key)!;
      rows.set(r, [...(rows.get(r) ?? []), n.key]);
    }
    const nodeByKey = new Map(graph.nodes.map((n) => [n.key, n]));
    for (const keys of rows.values()) {
      keys.sort(
        (a, b) =>
          (screenOrder.get(nodeByKey.get(a)!.screen ?? "") ?? -1) -
          (screenOrder.get(nodeByKey.get(b)!.screen ?? "") ?? -1),
      );
    }
    const ranks = [...rows.keys()].sort((a, b) => a - b);
    // thickness of each rank along the flow, extent across it
    let cursor = 0;
    const lanes: { keys: string[]; at: number; size: number }[] = [];
    for (const r of ranks) {
      const keys = rows.get(r)!;
      const thick = Math.max(
        ...keys.map((k) => (horizontal ? sizes.get(k)!.w : sizes.get(k)!.h)),
      );
      lanes.push({ keys, at: cursor, size: thick });
      cursor += thick + gap * 2.2;
    }
    const total = cursor - gap * 2.2;
    const span = (keys: string[]) =>
      keys.reduce(
        (s, k, i) =>
          s +
          (horizontal ? sizes.get(k)!.h : sizes.get(k)!.w) +
          (i ? gap : 0) +
          (i && nodeByKey.get(keys[i - 1])!.screen !== nodeByKey.get(k)!.screen
            ? gap * 0.6
            : 0),
        0,
      );
    const widest = Math.max(...lanes.map((l) => span(l.keys)));
    for (const lane of lanes) {
      let across = (widest - span(lane.keys)) / 2;
      lane.keys.forEach((k, i) => {
        const s = sizes.get(k)!;
        if (
          i &&
          nodeByKey.get(lane.keys[i - 1])!.screen !== nodeByKey.get(k)!.screen
        ) {
          across += gap * 0.6;
        }
        const main = along === 1 ? lane.at : total - lane.at - lane.size;
        const x = horizontal ? main : across;
        const y = horizontal ? across : main;
        put(k, { x: origin.x + x, y: origin.y + y, w: s.w, h: s.h });
        across += (horizontal ? s.h : s.w) + gap;
      });
    }
    return result;
  }

  // incremental: next to a placed neighbour
  for (const n of graph.nodes) {
    if (placed.has(n.key)) {
      continue;
    }
    const s = sizes.get(n.key)!;
    const outEdge = graph.edges.find(
      (e) => e.to === n.key && placed.has(e.from),
    );
    const inEdge = graph.edges.find(
      (e) => e.from === n.key && placed.has(e.to),
    );
    const anchor = outEdge
      ? placed.get(outEdge.from)!
      : inEdge
      ? placed.get(inEdge.to)!
      : null;
    const dir = outEdge ? along : inEdge ? -along : along;
    let r: Rect;
    if (anchor) {
      r = horizontal
        ? {
            x:
              dir === 1
                ? anchor.x + anchor.w + gap * 2.2
                : anchor.x - s.w - gap * 2.2,
            y: anchor.y + (anchor.h - s.h) / 2,
            w: s.w,
            h: s.h,
          }
        : {
            x: anchor.x + (anchor.w - s.w) / 2,
            y:
              dir === 1
                ? anchor.y + anchor.h + gap * 2.2
                : anchor.y - s.h - gap * 2.2,
            w: s.w,
            h: s.h,
          };
    } else {
      const all = [...placed.values()];
      const bottom = all.length
        ? Math.max(...all.map((p) => p.y + p.h))
        : origin.y;
      const left = all.length ? Math.min(...all.map((p) => p.x)) : origin.x;
      r = { x: left, y: bottom + gap * 2.2, w: s.w, h: s.h };
    }
    for (let i = 0; i < 40 && !free(r); i++) {
      // sideways, alternating
      const step = (Math.floor(i / 2) + 1) * ((horizontal ? s.h : s.w) + gap);
      const sign = i % 2 ? -1 : 1;
      r = horizontal
        ? { ...r, y: r.y + sign * step }
        : { ...r, x: r.x + sign * step };
    }
    put(n.key, r);
  }
  return result;
};
