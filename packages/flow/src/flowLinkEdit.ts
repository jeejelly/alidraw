import { ROUNDNESS } from "@excalidraw/common";
import {
  getBoundTextElement,
  newElementWith,
  newTextElement,
  redrawTextBoundingBox,
  refreshTextDimensions,
} from "@excalidraw/element";

import type { Scene } from "@excalidraw/element";
import type {
  ExcalidrawArrowElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";
import type { LocalPoint } from "@excalidraw/math";

import { ARROWHEAD_OF } from "./flowApplyLinks";
import { updateLinkMeta } from "./flowPortEdit";
import { getFlowMeta, withFlow } from "./flowMeta";
import { partsOf } from "./flowParts";

import type { FlowEnd } from "./flowGraph";

export type LinkSide = "head" | "tail";
export type LinkLine = "solid" | "dashed" | "thick";
export type LinkRoute = "straight" | "curved" | "elbow";

/** a bend as deep as this share of the link's length */
const BEND = 0.2;
const THICK = 4;
const THIN = 2;

/** `none` takes the end off; the arrowhead and the meta (which the text reads first) agree */
export const setLinkEnd = (
  scene: Scene,
  arrow: ExcalidrawArrowElement,
  side: LinkSide,
  end: FlowEnd | "none",
) => {
  const field = side === "head" ? "endArrowhead" : "startArrowhead";
  scene.mutateElement(arrow, {
    [field]: end === "none" ? null : ARROWHEAD_OF[end],
  });
  updateLinkMeta(scene, arrow, {
    [side === "head" ? "headEnd" : "tailEnd"]:
      end === "none" || end === "arrow" ? null : end,
  });
};

export const setLinkLine = (
  scene: Scene,
  arrow: ExcalidrawArrowElement,
  line: LinkLine,
) => {
  scene.mutateElement(arrow, {
    strokeStyle: line === "dashed" ? "dashed" : "solid",
    strokeWidth:
      line === "thick"
        ? THICK
        : arrow.strokeWidth >= THICK
        ? THIN
        : arrow.strokeWidth,
  });
};

export const routeOf = (arrow: ExcalidrawArrowElement): LinkRoute =>
  arrow.elbowed ? "elbow" : arrow.roundness ? "curved" : "straight";

const endPoints = (arrow: ExcalidrawArrowElement) => {
  const last = arrow.points[arrow.points.length - 1];
  return { first: arrow.points[0], last };
};

/** the two ends in a line again: the bends and the curve go, the ends stay */
export const straightenLink = (scene: Scene, arrow: ExcalidrawArrowElement) => {
  const { first, last } = endPoints(arrow);
  scene.mutateElement(arrow, {
    points: [first, last],
    roundness: null,
    elbowed: false,
  });
};

/** a smooth curve through one bend, off the line between the ends */
export const curveLink = (scene: Scene, arrow: ExcalidrawArrowElement) => {
  const { first, last } = endPoints(arrow);
  const alongX = last[0] - first[0];
  const alongY = last[1] - first[1];
  const bendPoint = [
    first[0] + alongX / 2 - alongY * BEND,
    first[1] + alongY / 2 + alongX * BEND,
  ] as LocalPoint;
  scene.mutateElement(arrow, {
    points: arrow.points.length > 2 ? arrow.points : [first, bendPoint, last],
    roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
    elbowed: false,
  });
};

export const linkLabelOf = (scene: Scene, arrow: ExcalidrawArrowElement) =>
  getBoundTextElement(arrow, scene.getNonDeletedElementsMap());

/** says what the link says: edits the label, makes one, or takes it off when empty */
export const setLinkLabel = (
  scene: Scene,
  arrow: ExcalidrawArrowElement,
  text: string,
) => {
  const label = linkLabelOf(scene, arrow);
  if (label && text) {
    const dimensions = refreshTextDimensions(
      label,
      arrow,
      scene.getNonDeletedElementsMap(),
      text,
    );
    scene.mutateElement(label, { text, originalText: text, ...dimensions });
    redrawTextBoundingBox(label as ExcalidrawTextElement, arrow, scene);
  } else if (label) {
    scene.replaceAllElements(
      scene
        .getElementsIncludingDeleted()
        .map((element) =>
          element.id === label.id
            ? newElementWith(element, { isDeleted: true })
            : element,
        ),
    );
    scene.mutateElement(arrow, {
      boundElements: (arrow.boundElements ?? []).filter(
        (bound) => bound.id !== label.id,
      ),
    });
  } else if (text) {
    const created = newTextElement({
      text,
      containerId: arrow.id,
      x: arrow.x,
      y: arrow.y,
      textAlign: "center",
      verticalAlign: "middle",
      strokeColor: arrow.strokeColor,
    });
    scene.insertElement(created);
    scene.mutateElement(arrow, {
      boundElements: [
        ...(arrow.boundElements ?? []),
        { type: "text", id: created.id },
      ],
    });
    redrawTextBoundingBox(created, arrow, scene);
  }
};

/**
 * A hand-drawn arrow glued to two steps of one flow becomes a link of that
 * flow: it gets the meta that carries its ports and ends.
 */
export const makeFlowLink = (scene: Scene, arrow: ExcalidrawArrowElement) => {
  const all = scene.getElementsIncludingDeleted();
  const map = scene.getNonDeletedElementsMap();
  const startMeta = getFlowMeta(
    map.get(arrow.startBinding?.elementId ?? "") ?? {},
  );
  if (!startMeta || getFlowMeta(arrow)) {
    return false;
  }
  const { keyOfId } = partsOf(all, startMeta.id);
  const from = keyOfId.get(arrow.startBinding?.elementId ?? "");
  const to = keyOfId.get(arrow.endBinding?.elementId ?? "");
  if (!from || !to || from === to) {
    return false;
  }
  scene.mutateElement(arrow, {
    customData: withFlow(arrow, {
      id: startMeta.id,
      key: `${from}>${to}`,
      kind: "edge",
    }),
  });
  return true;
};
