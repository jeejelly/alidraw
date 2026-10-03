import type { Unit } from "../sceneCode";

export type Box = { x: number; y: number; w: number; h: number };
export type Item = { u: Unit; b: Box; z: number };

export type Node =
  | { t: "leaf"; item: Item; b: Box }
  | {
      t: "box";
      item: Item;
      b: Box;
      inner: Node;
      pad: [number, number, number, number];
    }
  | { t: "flow"; dir: "col" | "row"; kids: Node[]; gaps: number[]; b: Box }
  | { t: "abs"; kids: Node[]; b: Box };

export type Out = { html: string; kt: string };

export const TOL = 1;

export const union = (bs: Box[]): Box => {
  const x = Math.min(...bs.map((box) => box.x));
  const y = Math.min(...bs.map((box) => box.y));
  return {
    x,
    y,
    w: Math.max(...bs.map((box) => box.x + box.w)) - x,
    h: Math.max(...bs.map((box) => box.y + box.h)) - y,
  };
};

export const contains = (outer: Box, inner: Box) =>
  inner.x >= outer.x - TOL &&
  inner.y >= outer.y - TOL &&
  inner.x + inner.w <= outer.x + outer.w + TOL &&
  inner.y + inner.h <= outer.y + outer.h + TOL;

export const isRect = (item: Item) =>
  item.u.kind === "element" && item.u.el.type === "rectangle";

/** sibling groups separated by an empty band on one axis */
export const split = (nodes: Node[], axis: "x" | "y"): Node[][] => {
  const lo = (node: Node) => (axis === "x" ? node.b.x : node.b.y);
  const hi = (node: Node) =>
    axis === "x" ? node.b.x + node.b.w : node.b.y + node.b.h;
  const sorted = [...nodes].sort((first, second) => lo(first) - lo(second));
  const groups: Node[][] = [];
  let reach = -Infinity;
  for (const node of sorted) {
    if (groups.length && lo(node) >= reach - 0.01) {
      groups.push([node]);
    } else if (groups.length) {
      groups[groups.length - 1].push(node);
    } else {
      groups.push([node]);
    }
    reach = Math.max(reach, hi(node));
  }
  return groups;
};

export const layout = (nodes: Node[]): Node => {
  if (nodes.length === 1) {
    return nodes[0];
  }
  for (const [axis, dir] of [
    ["y", "col"],
    ["x", "row"],
  ] as const) {
    const groups = split(nodes, axis);
    if (groups.length > 1) {
      const kids = groups.map(layout);
      const gaps = kids
        .slice(1)
        .map((child, index) =>
          axis === "y"
            ? child.b.y - (kids[index].b.y + kids[index].b.h)
            : child.b.x - (kids[index].b.x + kids[index].b.w),
        );
      return {
        t: "flow",
        dir,
        kids,
        gaps,
        b: union(kids.map((child) => child.b)),
      };
    }
  }
  const kids = [...nodes].sort(
    (first, second) =>
      (first.t === "abs" ? 0 : zOf(first)) -
      (second.t === "abs" ? 0 : zOf(second)),
  );
  return { t: "abs", kids, b: union(nodes.map((node) => node.b)) };
};

export const zOf = (node: Node): number =>
  node.t === "leaf" || node.t === "box" ? node.item.z : 0;

/** containers first: each part goes into the smallest rectangle around it */
export const build = (items: Item[]): { node: Node; abs: number } | null => {
  if (!items.length) {
    return null;
  }
  const area = (item: Item) => item.b.w * item.b.h;
  const parentOf = new Map<Item, Item>();
  for (const it of items) {
    let best: Item | null = null;
    for (const candidate of items) {
      if (
        candidate !== it &&
        isRect(candidate) &&
        area(candidate) > area(it) &&
        contains(candidate.b, it.b) &&
        (!best || area(candidate) < area(best))
      ) {
        best = candidate;
      }
    }
    if (best) {
      parentOf.set(it, best);
    }
  }
  let abs = 0;
  const make = (it: Item): Node => {
    const kids = items.filter((child) => parentOf.get(child) === it);
    if (!kids.length) {
      return { t: "leaf", item: it, b: it.b };
    }
    const inner = layoutOf(kids.map(make));
    const ib = inner.b;
    return {
      t: "box",
      item: it,
      b: it.b,
      inner,
      pad: [
        Math.max(0, ib.x - it.b.x),
        Math.max(0, ib.y - it.b.y),
        Math.max(0, it.b.x + it.b.w - (ib.x + ib.w)),
        Math.max(0, it.b.y + it.b.h - (ib.y + ib.h)),
      ],
    };
  };
  const layoutOf = (nodes: Node[]) => {
    const root = layout(nodes);
    countAbs(root);
    return root;
  };
  const counted = new Set<Node>();
  const countAbs = (node: Node) => {
    if (node.t === "abs" && !counted.has(node)) {
      counted.add(node);
      abs++;
    }
  };
  const top = items.filter((item) => !parentOf.has(item)).map(make);
  return { node: layoutOf(top), abs };
};
