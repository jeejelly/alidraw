import { randomId, ROUNDNESS } from "@excalidraw/common";
import {
  convertToExcalidrawElements,
  getBoundTextElement,
  newElementWith,
  newFrameElement,
} from "@excalidraw/element";

import type { Scene } from "@excalidraw/element";
import type {
  ExcalidrawArrowElement,
  ExcalidrawElement,
  ExcalidrawFrameElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { layoutNewNodes } from "./flowLayout";
import {
  emptyFlow,
  slugKey,
  type FlowEdge,
  type FlowGraph,
  type FlowIssue,
  type FlowNode,
} from "./flowGraph";

/**
 * How a diagram on the canvas belongs to a flow: `customData.flow` on the
 * element. Nodes are rectangles, diamonds and ellipses (a screen's buttons and
 * steps), screens are frames, links are arrows glued to two nodes.
 */
export type FlowMeta = {
  id: string;
  key: string;
  kind: "node" | "screen" | "edge";
};

export const getFlowMeta = (el: {
  customData?: ExcalidrawElement["customData"];
}): FlowMeta | null => {
  const m = el.customData?.flow;
  return m && typeof m.id === "string" && typeof m.key === "string"
    ? (m as FlowMeta)
    : null;
};

const withFlow = (el: ExcalidrawElement, meta: FlowMeta) => ({
  ...el.customData,
  flow: meta,
});

const isNodeType = (t: string) =>
  t === "rectangle" || t === "diamond" || t === "ellipse";

export const listFlows = (elements: readonly ExcalidrawElement[]) => {
  const ids: string[] = [];
  for (const el of elements) {
    const m = !el.isDeleted ? getFlowMeta(el) : null;
    if (m && !ids.includes(m.id)) {
      ids.push(m.id);
    }
  }
  return ids;
};

const textOf = (
  el: ExcalidrawElement,
  map: Map<string, ExcalidrawElement>,
): ExcalidrawTextElement | null =>
  getBoundTextElement(el, map as any) as ExcalidrawTextElement | null;

const shapeOf = (el: ExcalidrawElement): FlowNode["shape"] =>
  el.type === "diamond"
    ? "diamond"
    : el.type === "ellipse"
    ? "ellipse"
    : el.roundness
    ? "round"
    : "rect";

const edgeStyleOf = (el: ExcalidrawElement): FlowEdge["style"] =>
  el.strokeStyle !== "solid"
    ? "dashed"
    : el.strokeWidth >= 4
    ? "thick"
    : "solid";

type Parts = {
  live: ExcalidrawElement[];
  map: Map<string, ExcalidrawElement>;
  nodes: Map<string, ExcalidrawElement>;
  screens: Map<string, ExcalidrawFrameElement>;
  keyOfId: Map<string, string>;
  arrows: ExcalidrawArrowElement[];
};

const partsOf = (
  elements: readonly ExcalidrawElement[],
  flowId: string,
): Parts => {
  const live = elements.filter((e) => !e.isDeleted);
  const map = new Map(live.map((e) => [e.id, e]));
  const nodes = new Map<string, ExcalidrawElement>();
  const screens = new Map<string, ExcalidrawFrameElement>();
  const keyOfId = new Map<string, string>();
  for (const el of live) {
    const m = getFlowMeta(el);
    if (!m || m.id !== flowId) {
      continue;
    }
    if (m.kind === "node" && isNodeType(el.type)) {
      nodes.set(m.key, el);
      keyOfId.set(el.id, m.key);
    } else if (m.kind === "screen" && el.type === "frame") {
      screens.set(m.key, el as ExcalidrawFrameElement);
    }
  }
  const arrows = live.filter(
    (e): e is ExcalidrawArrowElement =>
      e.type === "arrow" &&
      !!e.startBinding &&
      !!e.endBinding &&
      keyOfId.has(e.startBinding.elementId) &&
      keyOfId.has(e.endBinding.elementId),
  );
  return { live, map, nodes, screens, keyOfId, arrows };
};

/** the flow as drawn: what the Source view shows */
export const readFlow = (
  elements: readonly ExcalidrawElement[],
  flowId: string,
): FlowGraph => {
  const { map, nodes, screens, keyOfId, arrows } = partsOf(elements, flowId);
  const graph = emptyFlow();
  const screenKeyOfFrame = new Map(
    [...screens].map(([key, frame]) => [frame.id, key]),
  );
  for (const [key, frame] of screens) {
    graph.screens.push({ key, label: frame.name || key });
  }
  for (const [key, el] of nodes) {
    graph.nodes.push({
      key,
      label: textOf(el, map)?.text ?? "",
      shape: shapeOf(el),
      screen: el.frameId ? screenKeyOfFrame.get(el.frameId) : undefined,
    });
  }
  let dx = 0;
  let dy = 0;
  for (const a of arrows) {
    const from = keyOfId.get(a.startBinding!.elementId)!;
    const to = keyOfId.get(a.endBinding!.elementId)!;
    graph.edges.push({
      from,
      to,
      label: textOf(a, map)?.text ?? "",
      style: edgeStyleOf(a),
      head: !!a.endArrowhead,
      tail: !!a.startArrowhead,
    });
    const na = nodes.get(from)!;
    const nb = nodes.get(to)!;
    dx += Math.abs(nb.x + nb.width / 2 - (na.x + na.width / 2));
    dy += Math.abs(nb.y + nb.height / 2 - (na.y + na.height / 2));
  }
  graph.direction = dx > dy ? "LR" : "TD";
  return graph;
};

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
  const map = new Map(all.filter((e) => !e.isDeleted).map((e) => [e.id, e]));
  const taken = new Set<string>();
  for (const el of all) {
    const m = !el.isDeleted ? getFlowMeta(el) : null;
    if (m && m.id === flowId && m.kind !== "edge") {
      taken.add(m.key);
    }
  }
  const updates = new Map<string, ExcalidrawElement>();
  let count = 0;
  for (const picked of selected) {
    // the scene's own copy: the caller's may be stale
    const el = map.get(picked.id) ?? picked;
    const isScreen = el.type === "frame";
    if (!isScreen && !isNodeType(el.type)) {
      continue;
    }
    const existing = getFlowMeta(el);
    if (existing && existing.id === flowId) {
      continue;
    }
    const label = isScreen
      ? (el as ExcalidrawFrameElement).name ?? ""
      : textOf(el, map)?.text ?? "";
    const key = slugKey(label || (isScreen ? "screen" : "step"), taken);
    taken.add(key);
    updates.set(
      el.id,
      newElementWith(el, {
        customData: withFlow(el, {
          id: flowId,
          key,
          kind: isScreen ? "screen" : "node",
        }),
      }),
    );
    count++;
  }
  if (updates.size) {
    scene.replaceAllElements(all.map((e) => updates.get(e.id) ?? e));
  }
  return count;
};

export const renameFlow = (scene: Scene, from: string, to: string) => {
  if (!to.trim() || from === to) {
    return;
  }
  scene.replaceAllElements(
    scene.getElementsIncludingDeleted().map((el) => {
      const m = getFlowMeta(el);
      return m && m.id === from
        ? newElementWith(el, { customData: withFlow(el, { ...m, id: to }) })
        : el;
    }),
  );
};

const NODE_GAP = 70;
const FRAME_PAD = 28;

const nodeSize = (n: FlowNode) => {
  const longest = Math.max(...n.label.split("\n").map((l) => l.length), 4);
  const w = Math.min(280, Math.max(120, longest * 9 + 40));
  const lines = n.label.split("\n").length;
  const h = Math.max(56, lines * 26 + 28);
  return n.shape === "diamond"
    ? { w: Math.round(w * 1.25), h: Math.round(h * 1.5) }
    : { w, h };
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
  const {
    map,
    nodes: oldNodes,
    screens: oldScreens,
    keyOfId,
    arrows,
  } = partsOf(all, flowId);

  const gone = new Set<string>();
  // links are redrawn: remember their look
  const carry = new Map<string, Record<string, any>[]>();
  for (const a of arrows) {
    gone.add(a.id);
    const t = textOf(a, map);
    if (t) {
      gone.add(t.id);
    }
    const k = `${keyOfId.get(a.startBinding!.elementId)}>${keyOfId.get(
      a.endBinding!.elementId,
    )}`;
    const list = carry.get(k) ?? [];
    list.push({
      strokeColor: a.strokeColor,
      opacity: a.opacity,
      roughness: a.roughness,
      strokeWidth: a.strokeWidth,
    });
    carry.set(k, list);
  }
  const wanted = new Set(graph.nodes.map((n) => n.key));
  for (const [key, el] of oldNodes) {
    if (!wanted.has(key)) {
      gone.add(el.id);
      const t = textOf(el, map);
      if (t) {
        gone.add(t.id);
      }
      // every arrow glued to it goes with it
      for (const b of el.boundElements ?? []) {
        if (b.type === "arrow") {
          gone.add(b.id);
          const arrow = map.get(b.id);
          const at = arrow && textOf(arrow, map);
          if (at) {
            gone.add(at.id);
          }
        }
      }
    }
  }

  // where new steps go
  const sizes = new Map(graph.nodes.map((n) => [n.key, nodeSize(n)]));
  const fixed = new Map<
    string,
    { x: number; y: number; w: number; h: number }
  >();
  for (const n of graph.nodes) {
    const old = oldNodes.get(n.key);
    if (old) {
      fixed.set(n.key, { x: old.x, y: old.y, w: old.width, h: old.height });
    }
  }
  const placed = layoutNewNodes(graph, fixed, sizes, origin, NODE_GAP);

  const batch: any[] = [];
  const idOf = new Map<string, string>();
  const recreated = new Set<string>();
  for (const n of graph.nodes) {
    const old = oldNodes.get(n.key);
    const type =
      n.shape === "diamond"
        ? "diamond"
        : n.shape === "ellipse"
        ? "ellipse"
        : "rectangle";
    const roundness =
      n.shape === "round" ? { type: ROUNDNESS.ADAPTIVE_RADIUS } : null;
    const oldText = old ? textOf(old, map) : null;
    const labelChanged = !old || (oldText?.text ?? "") !== n.label;
    const typeChanged =
      !!old && (old.type !== type || !!old.roundness !== !!roundness);
    const meta: FlowMeta = { id: flowId, key: n.key, kind: "node" };
    if (old && !labelChanged && !typeChanged) {
      idOf.set(n.key, old.id);
      // only for binding the new arrows
      batch.push({ ...old, boundElements: [], frameId: null });
      continue;
    }
    const base = old
      ? { ...old, type, roundness, boundElements: [], frameId: null }
      : {
          type,
          id: randomId(),
          x: placed.get(n.key)!.x,
          y: placed.get(n.key)!.y,
          width: sizes.get(n.key)!.w,
          height: sizes.get(n.key)!.h,
          roundness,
        };
    idOf.set(n.key, base.id);
    recreated.add(n.key);
    if (old && oldText) {
      gone.add(oldText.id);
    }
    batch.push({
      ...base,
      customData: old ? withFlow(old, meta) : { flow: meta },
      ...(n.label
        ? {
            label: {
              text: n.label,
              ...(oldText
                ? { fontSize: oldText.fontSize, fontFamily: oldText.fontFamily }
                : {}),
            },
          }
        : {}),
    });
  }

  // phase 1: the steps (labels may grow their boxes)
  const nodeOut = convertToExcalidrawElements(batch, { regenerateIds: false });
  const nodeOutById = new Map(nodeOut.map((e) => [e.id, e]));
  const rectOf = (key: string) => {
    const e = nodeOutById.get(idOf.get(key)!)!;
    return { x: e.x, y: e.y, w: e.width, h: e.height, type: e.type };
  };

  // phase 2: the links, from the border of one step to the border of the next
  const pairCount = new Map<string, number>();
  for (const e of graph.edges) {
    const pk = [e.from, e.to].sort().join("|");
    pairCount.set(pk, (pairCount.get(pk) ?? 0) + 1);
  }
  const pairSeen = new Map<string, number>();
  const arrowSkeletons: any[] = [];
  const seen = new Map<string, number>();
  for (const e of graph.edges) {
    if (!idOf.has(e.from) || !idOf.has(e.to)) {
      continue;
    }
    if (e.from === e.to) {
      issues.push({
        line: 0,
        message: `Link ${e.from} → ${e.to} to itself was skipped`,
      });
      continue;
    }
    const k = `${e.from}>${e.to}`;
    const n = seen.get(k) ?? 0;
    seen.set(k, n + 1);
    const look = carry.get(k)?.[n] ?? {};
    const pk = [e.from, e.to].sort().join("|");
    const slot = pairSeen.get(pk) ?? 0;
    pairSeen.set(pk, slot + 1);
    const shift = (slot - (pairCount.get(pk)! - 1) / 2) * 56;
    // one side for the pair, whichever way each link runs
    const [p0, p1] = linkEnds(
      rectOf(e.from),
      rectOf(e.to),
      e.from > e.to ? -shift : shift,
    );
    arrowSkeletons.push({
      type: "arrow",
      id: randomId(),
      x: p0[0],
      y: p0[1],
      width: Math.abs(p1[0] - p0[0]),
      height: Math.abs(p1[1] - p0[1]),
      points: [
        [0, 0],
        [p1[0] - p0[0], p1[1] - p0[1]],
      ],
      start: { id: idOf.get(e.from) },
      end: { id: idOf.get(e.to) },
      startArrowhead: e.tail ? "arrow" : null,
      endArrowhead: e.head ? "arrow" : null,
      strokeStyle: e.style === "dashed" ? "dashed" : "solid",
      strokeWidth:
        e.style === "thick"
          ? 4
          : look.strokeWidth && look.strokeWidth < 4
          ? look.strokeWidth
          : 2,
      ...(look.strokeColor ? { strokeColor: look.strokeColor } : {}),
      ...(look.opacity !== undefined ? { opacity: look.opacity } : {}),
      ...(look.roughness !== undefined ? { roughness: look.roughness } : {}),
      customData: { flow: { id: flowId, key: k, kind: "edge" } },
      ...(e.label ? { label: { text: e.label } } : {}),
    });
  }

  const linkOut = convertToExcalidrawElements(
    [
      // the steps as they ended up, only to glue the links to
      ...graph.nodes.map((n) => ({
        ...nodeOutById.get(idOf.get(n.key)!)!,
        boundElements: [],
        frameId: null,
      })),
      ...arrowSkeletons,
    ],
    { regenerateIds: false },
  );
  const out = [
    ...nodeOut.filter((e) => e.type === "text"),
    ...nodeOut.filter((e) => e.type !== "text"),
    ...linkOut.filter((e) => !nodeOutById.has(e.id)),
  ];
  const outById = new Map(out.map((e) => [e.id, e]));
  const newArrowIds = new Set(arrowSkeletons.map((a) => a.id));
  const arrowRefs = new Map<string, { type: "arrow"; id: string }[]>();
  for (const a of out) {
    if (a.type === "arrow" && newArrowIds.has(a.id)) {
      for (const end of [a.startBinding, a.endBinding]) {
        if (end) {
          const list = arrowRefs.get(end.elementId) ?? [];
          list.push({ type: "arrow", id: a.id });
          arrowRefs.set(end.elementId, list);
        }
      }
    }
  }

  // the new element list: old ones kept or replaced, new ones added
  const finalNodes = new Map<string, ExcalidrawElement>();
  const extra: ExcalidrawElement[] = [];
  for (const n of graph.nodes) {
    const id = idOf.get(n.key)!;
    const old = oldNodes.get(n.key);
    const fresh = outById.get(id)!;
    const base = recreated.has(n.key) ? fresh : old!;
    const kept = (old?.boundElements ?? []).filter(
      (b) => !gone.has(b.id) && (!recreated.has(n.key) || b.type !== "text"),
    );
    const fromBatch = recreated.has(n.key)
      ? (fresh.boundElements ?? []).filter((b) => b.type === "text")
      : [];
    const refs = [...kept, ...fromBatch, ...(arrowRefs.get(id) ?? [])];
    const unique = refs.filter(
      (b, i) => refs.findIndex((c) => c.id === b.id) === i,
    );
    const node = newElementWith(base, {
      boundElements: unique,
      customData: withFlow(base, { id: flowId, key: n.key, kind: "node" }),
    });
    finalNodes.set(n.key, node);
  }
  for (const e of out) {
    if (newArrowIds.has(e.id)) {
      extra.push(e);
    } else if (e.type === "text" && e.containerId) {
      // the label of a recreated step or of a new link
      extra.push(e);
    }
  }

  // screens
  const screenKeys = new Set(graph.screens.map((s) => s.key));
  const frames = new Map<string, ExcalidrawFrameElement>();
  for (const s of graph.screens) {
    const members = graph.nodes
      .filter((n) => n.screen === s.key)
      .map((n) => finalNodes.get(n.key)!);
    const old = oldScreens.get(s.key);
    const left = Math.min(...members.map((m) => m.x));
    const top = Math.min(...members.map((m) => m.y));
    const right = Math.max(...members.map((m) => m.x + m.width));
    const bottom = Math.max(...members.map((m) => m.y + m.height));
    const rect = members.length
      ? {
          x: left - FRAME_PAD,
          y: top - FRAME_PAD,
          w: right - left + FRAME_PAD * 2,
          h: bottom - top + FRAME_PAD * 2,
        }
      : { x: origin.x, y: origin.y, w: 240, h: 160 };
    const meta: FlowMeta = { id: flowId, key: s.key, kind: "screen" };
    if (old) {
      const x1 = Math.min(old.x, rect.x);
      const y1 = Math.min(old.y, rect.y);
      const x2 = Math.max(old.x + old.width, rect.x + rect.w);
      const y2 = Math.max(old.y + old.height, rect.y + rect.h);
      frames.set(
        s.key,
        newElementWith(old, {
          name: s.label,
          x: x1,
          y: y1,
          width: x2 - x1,
          height: y2 - y1,
          customData: withFlow(old, meta),
        }),
      );
    } else {
      frames.set(
        s.key,
        newFrameElement({
          name: s.label,
          x: rect.x,
          y: rect.y,
          width: rect.w,
          height: rect.h,
          customData: { flow: meta },
        } as any),
      );
    }
  }
  const frameIdOfScreen = new Map([...frames].map(([k, f]) => [k, f.id]));
  for (const n of graph.nodes) {
    const node = finalNodes.get(n.key)!;
    finalNodes.set(
      n.key,
      newElementWith(node, {
        frameId: n.screen ? frameIdOfScreen.get(n.screen) ?? null : null,
      }),
    );
  }
  // bound texts of recreated nodes follow their container's frame
  const nodeById = new Map([...finalNodes.values()].map((n) => [n.id, n]));
  const extraFinal = extra.map((e) =>
    e.type === "text" && e.containerId && nodeById.has(e.containerId)
      ? newElementWith(e, { frameId: nodeById.get(e.containerId)!.frameId })
      : e,
  );

  const nodeByIdFinal = new Map([...finalNodes.values()].map((n) => [n.id, n]));
  const next: ExcalidrawElement[] = [];
  const replaced = new Map<string, ExcalidrawElement>();
  for (const n of finalNodes.values()) {
    replaced.set(n.id, n);
  }
  for (const [, f] of frames) {
    replaced.set(f.id, f);
  }
  const newFrames = [...frames.values()].filter(
    (f) => !all.some((e) => e.id === f.id),
  );
  next.push(...newFrames);
  for (const el of all) {
    if (gone.has(el.id)) {
      next.push(newElementWith(el, { isDeleted: true }));
      continue;
    }
    // a removed screen disappears; its steps are no longer framed
    const meta = getFlowMeta(el);
    if (
      meta &&
      meta.id === flowId &&
      meta.kind === "screen" &&
      !screenKeys.has(meta.key)
    ) {
      next.push(newElementWith(el, { isDeleted: true }));
      continue;
    }
    // a step's label follows its frame
    const owner =
      el.type === "text" && el.containerId
        ? nodeByIdFinal.get(el.containerId)
        : null;
    next.push(
      replaced.get(el.id) ??
        (owner && owner.frameId !== el.frameId
          ? newElementWith(el, { frameId: owner.frameId })
          : el),
    );
  }
  const insertedNodeIds = new Set(next.map((e) => e.id));
  for (const n of finalNodes.values()) {
    if (!insertedNodeIds.has(n.id)) {
      next.push(n);
    }
  }
  for (const e of extraFinal) {
    if (!insertedNodeIds.has(e.id)) {
      next.push(e);
    }
  }
  scene.replaceAllElements(next);
  return issues;
};

/**
 * Both ends of a link: on the border of each step, on the line between their
 * centres, `shift` to the side so links between the same two steps don't overlap.
 */
const linkEnds = (
  a: { x: number; y: number; w: number; h: number; type: string },
  b: { x: number; y: number; w: number; h: number; type: string },
  shift: number,
): [[number, number], [number, number]] => {
  const ca = [a.x + a.w / 2, a.y + a.h / 2];
  const cb = [b.x + b.w / 2, b.y + b.h / 2];
  const dx = cb[0] - ca[0];
  const dy = cb[1] - ca[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * shift;
  const ny = (dx / len) * shift;
  // how far along (dx, dy) the border is, as a fraction of the centre distance
  const border = (r: typeof a) => {
    const hw = r.w / 2;
    const hh = r.h / 2;
    const ax = Math.abs(dx) / hw || 0;
    const ay = Math.abs(dy) / hh || 0;
    const t =
      r.type === "diamond"
        ? ax + ay
        : r.type === "ellipse"
        ? Math.hypot(ax, ay)
        : Math.max(ax, ay);
    return t ? 1 / t : 0;
  };
  const sa = border(a);
  const sb = border(b);
  return [
    [ca[0] + dx * sa + nx, ca[1] + dy * sa + ny],
    [cb[0] - dx * sb + nx, cb[1] - dy * sb + ny],
  ];
};
