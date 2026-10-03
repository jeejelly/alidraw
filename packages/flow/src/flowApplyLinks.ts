import { randomId } from "@excalidraw/common";
import { newElementWith } from "@excalidraw/element";

import type {
  ExcalidrawArrowElement,
  ExcalidrawElement,
} from "@excalidraw/element/types";

import { linkEnds, type LinkBox } from "./flowLinks";
import { portOfLabel, portPoint, portsOf } from "./flowPorts";

import { textOf } from "./flowText";

import { getFlowMeta, type FlowMeta } from "./flowMeta";
import { edgeStyleOf } from "./flowParts";

import type { Changes } from "./flowApplyRemovals";
import type {
  FlowEdge,
  FlowEnd,
  FlowGraph,
  FlowIssue,
  FlowNode,
} from "./flowGraph";
import type { FlowParts } from "./flowParts";

export type BoundRef = NonNullable<ExcalidrawElement["boundElements"]>[number];

/** the look of a link that is redrawn, to be put back */
type LinkLook = Record<string, any>;

const LINK_SPACING = 56;
/** how far from a step's border a link end may sit and still count as on it */
const BORDER_TOLERANCE = 14;

/** What the graph does with the arrows already on the canvas. */
export type LinkPlan = {
  /** the arrow that already draws the edge at this index of `graph.edges` */
  kept: Map<number, ExcalidrawArrowElement>;
  /** the look of arrows that have to be drawn again, by edge index */
  looks: Map<number, LinkLook>;
};

const lookOf = (arrow: ExcalidrawArrowElement): LinkLook => ({
  strokeColor: arrow.strokeColor,
  opacity: arrow.opacity,
  roughness: arrow.roughness,
  strokeWidth: arrow.strokeWidth,
});

const linkKeyOf = (arrow: ExcalidrawArrowElement, parts: FlowParts) =>
  `${parts.keyOfId.get(arrow.startBinding!.elementId)}>${parts.keyOfId.get(
    arrow.endBinding!.elementId,
  )}`;

const dropArrow = (
  arrow: ExcalidrawArrowElement,
  parts: FlowParts,
  gone: Set<string>,
) => {
  gone.add(arrow.id);
  const label = textOf(arrow, parts.map);
  if (label) {
    gone.add(label.id);
  }
};

/**
 * A link is an arrow with a flow meta: it stays when the graph still has the
 * link (same two steps, same turn among their links), so what was done to the
 * arrow (route, colour, roughness) survives. The others are removed or redrawn.
 */
export const planLinks = (
  parts: FlowParts,
  graph: FlowGraph,
  changes: Changes,
): LinkPlan => {
  const { gone } = changes;
  const arrowsByKey = new Map<string, ExcalidrawArrowElement[]>();
  for (const arrow of parts.arrows) {
    const key = linkKeyOf(arrow, parts);
    arrowsByKey.set(key, [...(arrowsByKey.get(key) ?? []), arrow]);
  }
  const plan: LinkPlan = { kept: new Map(), looks: new Map() };
  const used = new Set<string>();
  const turn = new Map<string, number>();
  graph.edges.forEach((edge, index) => {
    if (edge.style === "invisible") {
      return;
    }
    const key = `${edge.from}>${edge.to}`;
    const occurrence = turn.get(key) ?? 0;
    turn.set(key, occurrence + 1);
    const arrow = arrowsByKey.get(key)?.[occurrence];
    if (!arrow) {
      return;
    }
    used.add(arrow.id);
    const label = textOf(arrow, parts.map);
    if (label && edge.label && label.text !== edge.label) {
      changes.relabel.set(label.id, edge.label);
    }
    if (!!label !== !!edge.label) {
      // a label appears or goes: the arrow is drawn again, in the same colours
      plan.looks.set(index, lookOf(arrow));
      dropArrow(arrow, parts, gone);
      return;
    }
    plan.kept.set(index, arrow);
  });
  for (const arrow of parts.arrows) {
    if (!used.has(arrow.id)) {
      dropArrow(arrow, parts, gone);
    }
  }
  return plan;
};

/** where each link goes, `shift` to the side for several links between two steps */
const shiftsOf = (graph: FlowGraph) => {
  const pairCount = new Map<string, number>();
  const drawn = graph.edges.filter((edge) => edge.style !== "invisible");
  for (const edge of drawn) {
    const pairKey = pairKeyOf(edge);
    pairCount.set(pairKey, (pairCount.get(pairKey) ?? 0) + 1);
  }
  const pairSeen = new Map<string, number>();
  const shifts = new Map<number, number>();
  graph.edges.forEach((edge, index) => {
    if (edge.style === "invisible") {
      return;
    }
    const pairKey = pairKeyOf(edge);
    const slot = pairSeen.get(pairKey) ?? 0;
    pairSeen.set(pairKey, slot + 1);
    const shift = (slot - (pairCount.get(pairKey)! - 1) / 2) * LINK_SPACING;
    // one side for the pair, whichever way each link runs
    shifts.set(index, edge.from > edge.to ? -shift : shift);
  });
  return shifts;
};

const ARROWHEAD_OF: Record<FlowEnd, string> = {
  arrow: "arrow",
  cross: "bar",
  circle: "circle_outline",
};

const linkMetaOf = (edge: FlowEdge): FlowMeta["link"] | undefined =>
  edge.headEnd || edge.tailEnd || edge.length || edge.fromPort || edge.toPort
    ? {
        ...(edge.headEnd ? { headEnd: edge.headEnd } : {}),
        ...(edge.tailEnd ? { tailEnd: edge.tailEnd } : {}),
        ...(edge.length ? { length: edge.length } : {}),
        ...(edge.fromPort ? { fromPort: edge.fromPort } : {}),
        ...(edge.toPort ? { toPort: edge.toPort } : {}),
      }
    : undefined;

const pairKeyOf = (edge: FlowEdge) => [edge.from, edge.to].sort().join("|");

const arrowSkeleton = (
  edge: FlowEdge,
  flowId: string,
  linkKey: string,
  look: LinkLook,
  ids: { from: string; to: string },
  [start, end]: [[number, number], [number, number]],
) => ({
  type: "arrow",
  id: randomId(),
  x: start[0],
  y: start[1],
  width: Math.abs(end[0] - start[0]),
  height: Math.abs(end[1] - start[1]),
  points: [
    [0, 0],
    [end[0] - start[0], end[1] - start[1]],
  ],
  start: { id: ids.from },
  end: { id: ids.to },
  startArrowhead: edge.tail ? ARROWHEAD_OF[edge.tailEnd ?? "arrow"] : null,
  endArrowhead: edge.head ? ARROWHEAD_OF[edge.headEnd ?? "arrow"] : null,
  strokeStyle: edge.style === "dashed" ? "dashed" : "solid",
  strokeWidth:
    edge.style === "thick"
      ? 4
      : look.strokeWidth && look.strokeWidth < 4
      ? look.strokeWidth
      : 2,
  strokeColor: look.strokeColor ?? "#e0449b",
  ...(look.opacity !== undefined ? { opacity: look.opacity } : {}),
  ...(look.roughness !== undefined ? { roughness: look.roughness } : {}),
  customData: {
    flow: {
      id: flowId,
      key: linkKey,
      kind: "edge",
      ...(linkMetaOf(edge) ? { link: linkMetaOf(edge) } : {}),
    },
  },
  ...(edge.label ? { label: { text: edge.label } } : {}),
});

/** The new links, from the border of one step to the border of the next. */
export const buildLinkSkeletons = ({
  graph,
  flowId,
  idOf,
  rectOf,
  plan,
  issues,
}: {
  graph: FlowGraph;
  flowId: string;
  idOf: Map<string, string>;
  rectOf: (key: string) => LinkBox;
  plan: LinkPlan;
  issues: FlowIssue[];
}) => {
  const shifts = shiftsOf(graph);
  const skeletons: any[] = [];
  graph.edges.forEach((edge, index) => {
    if (edge.style === "invisible" || plan.kept.has(index)) {
      return;
    }
    if (!idOf.has(edge.from) || !idOf.has(edge.to)) {
      const missing = idOf.has(edge.from) ? edge.to : edge.from;
      if (graph.screens.some((flowScreen) => flowScreen.key === missing)) {
        issues.push({
          line: 0,
          message: `Link ${edge.from} → ${edge.to}: "${missing}" is a frame, only a flow element can be linked`,
          warn: true,
        });
      }
      return;
    }
    if (edge.from === edge.to) {
      issues.push({
        line: 0,
        message: `Link ${edge.from} → ${edge.to} to itself was skipped`,
      });
      return;
    }
    const ends = routeLink(edge, graph, rectOf, shifts.get(index) ?? 0);
    skeletons.push(
      arrowSkeleton(
        edge,
        flowId,
        `${edge.from}>${edge.to}`,
        plan.looks.get(index) ?? {},
        { from: idOf.get(edge.from)!, to: idOf.get(edge.to)! },
        ends,
      ),
    );
  });
  return skeletons;
};

type Point = [number, number];

const pointBox = (point: Point): LinkBox => ({
  x: point[0],
  y: point[1],
  w: 0,
  h: 0,
  type: "rectangle",
});

/** where a link meets a step's port: the one it names, or (leaving a decision) the one its label names */
const portPointOf = (
  node: FlowNode | undefined,
  box: LinkBox,
  name: string | undefined,
  label?: string,
): Point | null => {
  const ports = node ? portsOf(node) : [];
  const port =
    ports.find((candidate) => candidate.name === name) ??
    (label ? portOfLabel(ports, label) : undefined);
  return port ? portPoint(box, port) : null;
};

/** both ends of a link: on the ports it uses, else facing the other step */
const routeLink = (
  edge: FlowEdge,
  graph: FlowGraph,
  rectOf: (key: string) => LinkBox,
  shift: number,
): [Point, Point] => {
  const from = rectOf(edge.from);
  const to = rectOf(edge.to);
  const stepOf = (key: string) => graph.nodes.find((node) => node.key === key);
  const start = portPointOf(stepOf(edge.from), from, edge.fromPort, edge.label);
  const end = portPointOf(stepOf(edge.to), to, edge.toPort);
  if (start && end) {
    return [start, end];
  }
  if (start) {
    return [start, linkEnds(pointBox(start), to, 0)[1]];
  }
  if (end) {
    return [linkEnds(from, pointBox(end), 0)[0], end];
  }
  return linkEnds(from, to, shift);
};

const nearBorder = (point: [number, number], box: LinkBox) =>
  point[0] >= box.x - BORDER_TOLERANCE &&
  point[0] <= box.x + box.w + BORDER_TOLERANCE &&
  point[1] >= box.y - BORDER_TOLERANCE &&
  point[1] <= box.y + box.h + BORDER_TOLERANCE &&
  !(
    point[0] > box.x + BORDER_TOLERANCE * 2 &&
    point[0] < box.x + box.w - BORDER_TOLERANCE * 2 &&
    point[1] > box.y + BORDER_TOLERANCE * 2 &&
    point[1] < box.y + box.h - BORDER_TOLERANCE * 2
  );

/** a straight link: two points, no curve, not an elbow */
const isStraight = (arrow: ExcalidrawArrowElement) =>
  arrow.points.length === 2 && !arrow.roundness && !arrow.elbowed;

const endOf = (
  arrow: ExcalidrawArrowElement,
): [[number, number], [number, number]] => [
  [arrow.x + arrow.points[0][0], arrow.y + arrow.points[0][1]],
  [arrow.x + arrow.points[1][0], arrow.y + arrow.points[1][1]],
];

/**
 * The arrows that stay, brought in line with the graph: the meta, the ends and
 * line style the text sets, and (only when a straight link no longer touches
 * its steps) the two end points. Curves, elbows and bends are left as drawn.
 */
export const refreshKeptLinks = ({
  graph,
  flowId,
  idOf,
  rectOf,
  plan,
  labelOf,
}: {
  graph: FlowGraph;
  flowId: string;
  idOf: Map<string, string>;
  rectOf: (key: string) => LinkBox;
  plan: LinkPlan;
  labelOf: (arrow: ExcalidrawArrowElement) => ExcalidrawElement | null;
}) => {
  const shifts = shiftsOf(graph);
  const updated: ExcalidrawElement[] = [];
  for (const [index, arrow] of plan.kept) {
    const edge = graph.edges[index];
    if (!idOf.has(edge.from) || !idOf.has(edge.to) || edge.from === edge.to) {
      continue;
    }
    const changes: Record<string, unknown> = {
      startArrowhead: edge.tail ? ARROWHEAD_OF[edge.tailEnd ?? "arrow"] : null,
      endArrowhead: edge.head ? ARROWHEAD_OF[edge.headEnd ?? "arrow"] : null,
      customData: {
        ...arrow.customData,
        flow: {
          ...(getFlowMeta(arrow) ?? { id: flowId, kind: "edge" }),
          id: flowId,
          key: `${edge.from}>${edge.to}`,
          kind: "edge",
          link: linkMetaOf(edge),
        },
      },
    };
    if (edgeStyleOf(arrow) !== edge.style) {
      changes.strokeStyle = edge.style === "dashed" ? "dashed" : "solid";
      changes.strokeWidth =
        edge.style === "thick"
          ? 4
          : arrow.strokeWidth >= 4
          ? 2
          : arrow.strokeWidth;
    }
    const fromBox = rectOf(edge.from);
    const toBox = rectOf(edge.to);
    const [start, end] = endOf(arrow);
    const [newStart, newEnd] = routeLink(
      edge,
      graph,
      rectOf,
      shifts.get(index) ?? 0,
    );
    const onPorts = (point: Point, wanted: Point | null) =>
      !wanted || Math.hypot(point[0] - wanted[0], point[1] - wanted[1]) < 4;
    const stepOf = (key: string) =>
      graph.nodes.find((node) => node.key === key);
    const toPortPoint = portPointOf(stepOf(edge.to), toBox, edge.toPort);
    const fromPortPoint = portPointOf(
      stepOf(edge.from),
      fromBox,
      edge.fromPort,
      edge.label,
    );
    const touching =
      nearBorder(start, fromBox) &&
      nearBorder(end, toBox) &&
      onPorts(start, fromPortPoint) &&
      onPorts(end, toPortPoint);
    if (isStraight(arrow) && !touching) {
      Object.assign(changes, {
        x: newStart[0],
        y: newStart[1],
        width: Math.abs(newEnd[0] - newStart[0]),
        height: Math.abs(newEnd[1] - newStart[1]),
        points: [
          [0, 0],
          [newEnd[0] - newStart[0], newEnd[1] - newStart[1]],
        ],
      });
      const label = labelOf(arrow);
      if (label) {
        updated.push(
          newElementWith(label, {
            x: (newStart[0] + newEnd[0]) / 2 - label.width / 2,
            y: (newStart[1] + newEnd[1]) / 2 - label.height / 2,
          }),
        );
      }
    }
    updated.push(newElementWith(arrow, changes as any));
  }
  return updated;
};

/** for each element, the new arrows glued to it */
export const collectArrowRefs = (
  out: readonly ExcalidrawElement[],
  newArrowIds: Set<string>,
) => {
  const arrowRefs = new Map<string, { type: "arrow"; id: string }[]>();
  for (const element of out) {
    if (element.type === "arrow" && newArrowIds.has(element.id)) {
      for (const end of [element.startBinding, element.endBinding]) {
        if (end) {
          const refs = arrowRefs.get(end.elementId) ?? [];
          refs.push({ type: "arrow", id: element.id });
          arrowRefs.set(end.elementId, refs);
        }
      }
    }
  }
  return arrowRefs;
};

export const uniqueRefs = (refs: readonly BoundRef[]) =>
  refs.filter(
    (boundElement, index) =>
      refs.findIndex((other) => other.id === boundElement.id) === index,
  );
