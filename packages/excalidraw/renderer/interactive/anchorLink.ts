import { getElementBounds } from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import {
  getAnchor,
  guideEdgeCoordinate,
  isGuideAnchor,
  pointOnBounds,
} from "../../anchors";

import { getThemedColor } from "./shared";

import type { InteractiveCanvasAppState } from "../../types";
import type { RenderableElementsMap } from "../../scene/types";

/** a dashed link from an anchored element to what it follows */
export const renderAnchorLink = (
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
  element: NonDeletedExcalidrawElement,
  elementsMap: RenderableElementsMap,
) => {
  const anchor = getAnchor(element);
  if (!anchor) {
    return;
  }
  const zoom = appState.zoom.value;
  const box = getElementBounds(element, elementsMap);
  let from: [number, number] | null = null;
  let to: [number, number] | null = null;
  if (isGuideAnchor(anchor)) {
    const guide = appState.guides.find(
      (candidate) => candidate.id === anchor.guide,
    );
    if (!guide) {
      return;
    }
    const edge = guideEdgeCoordinate(box, guide.axis, anchor.edge);
    const mid = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
    from = guide.axis === "x" ? [edge, mid[1]] : [mid[0], edge];
    to =
      guide.axis === "x" ? [guide.position, mid[1]] : [mid[0], guide.position];
  } else {
    const target = elementsMap.get(anchor.to);
    if (!target) {
      return;
    }
    from = pointOnBounds(box, anchor.at);
    to = pointOnBounds(getElementBounds(target, elementsMap), anchor.from);
  }
  const color = getThemedColor("#e0449b", appState.theme);
  context.save();
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 1.5 / zoom;
  context.setLineDash([5 / zoom, 4 / zoom]);
  context.beginPath();
  context.moveTo(from[0], from[1]);
  context.lineTo(to[0], to[1]);
  context.stroke();
  context.setLineDash([]);
  context.beginPath();
  context.arc(from[0], from[1], 3 / zoom, 0, Math.PI * 2);
  context.fill();
  // the anchored end is a small diamond
  const half = 4.5 / zoom;
  context.beginPath();
  context.moveTo(to[0], to[1] - half);
  context.lineTo(to[0] + half, to[1]);
  context.lineTo(to[0], to[1] + half);
  context.lineTo(to[0] - half, to[1]);
  context.closePath();
  context.fill();
  context.restore();
};
