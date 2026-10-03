import { randomId } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { linkEnds, type LinkBox } from "./flowLinks";
import type { FlowMeta } from "./flowMeta";
import { textOf } from "./flowText";

import type { FlowEdge, FlowEnd, FlowGraph, FlowIssue } from "./flowGraph";
import type { FlowParts } from "./flowParts";

export type BoundRef = NonNullable<ExcalidrawElement["boundElements"]>[number];

/** the look of a link that is redrawn, to be put back */
type LinkLook = Record<string, any>;

const LINK_SPACING = 56;

/** Marks the links as removed (they are redrawn) and remembers their look. */
export const rememberLinkLooks = (parts: FlowParts, gone: Set<string>) => {
  const carry = new Map<string, LinkLook[]>();
  for (const arrow of parts.arrows) {
    gone.add(arrow.id);
    const label = textOf(arrow, parts.map);
    if (label) {
      gone.add(label.id);
    }
    const linkKey = `${parts.keyOfId.get(
      arrow.startBinding!.elementId,
    )}>${parts.keyOfId.get(arrow.endBinding!.elementId)}`;
    const looks = carry.get(linkKey) ?? [];
    looks.push({
      strokeColor: arrow.strokeColor,
      opacity: arrow.opacity,
      roughness: arrow.roughness,
      strokeWidth: arrow.strokeWidth,
    });
    carry.set(linkKey, looks);
  }
  return carry;
};

const ARROWHEAD_OF: Record<FlowEnd, string> = {
  arrow: "arrow",
  cross: "bar",
  circle: "circle_outline",
};

const linkMetaOf = (edge: FlowEdge): FlowMeta["link"] | undefined =>
  edge.headEnd || edge.tailEnd || edge.length
    ? {
        ...(edge.headEnd ? { headEnd: edge.headEnd } : {}),
        ...(edge.tailEnd ? { tailEnd: edge.tailEnd } : {}),
        ...(edge.length ? { length: edge.length } : {}),
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

/** The links, from the border of one step to the border of the next. */
export const buildLinkSkeletons = ({
  graph,
  flowId,
  idOf,
  rectOf,
  carry,
  issues,
}: {
  graph: FlowGraph;
  flowId: string;
  idOf: Map<string, string>;
  rectOf: (key: string) => LinkBox;
  carry: Map<string, LinkLook[]>;
  issues: FlowIssue[];
}) => {
  const pairCount = new Map<string, number>();
  const drawn = graph.edges.filter((edge) => edge.style !== "invisible");
  for (const edge of drawn) {
    const pairKey = pairKeyOf(edge);
    pairCount.set(pairKey, (pairCount.get(pairKey) ?? 0) + 1);
  }
  const pairSeen = new Map<string, number>();
  const skeletons: any[] = [];
  const seen = new Map<string, number>();
  for (const edge of drawn) {
    if (!idOf.has(edge.from) || !idOf.has(edge.to)) {
      const missing = idOf.has(edge.from) ? edge.to : edge.from;
      if (graph.screens.some((flowScreen) => flowScreen.key === missing)) {
        issues.push({
          line: 0,
          message: `Link ${edge.from} → ${edge.to}: "${missing}" is a frame, only a flow element can be linked`,
          warn: true,
        });
      }
      continue;
    }
    if (edge.from === edge.to) {
      issues.push({
        line: 0,
        message: `Link ${edge.from} → ${edge.to} to itself was skipped`,
      });
      continue;
    }
    const linkKey = `${edge.from}>${edge.to}`;
    const occurrence = seen.get(linkKey) ?? 0;
    seen.set(linkKey, occurrence + 1);
    const look = carry.get(linkKey)?.[occurrence] ?? {};
    const pairKey = pairKeyOf(edge);
    const slot = pairSeen.get(pairKey) ?? 0;
    pairSeen.set(pairKey, slot + 1);
    const shift = (slot - (pairCount.get(pairKey)! - 1) / 2) * LINK_SPACING;
    // one side for the pair, whichever way each link runs
    const ends = linkEnds(
      rectOf(edge.from),
      rectOf(edge.to),
      edge.from > edge.to ? -shift : shift,
    );
    skeletons.push(
      arrowSkeleton(
        edge,
        flowId,
        linkKey,
        look,
        { from: idOf.get(edge.from)!, to: idOf.get(edge.to)! },
        ends,
      ),
    );
  }
  return skeletons;
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
