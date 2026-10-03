import type { ExcalidrawElement } from "@excalidraw/element/types";

import { canEditCorners, getCornerHandles } from "../../corners";

import { getThemedColor } from "./shared";

import type { InteractiveCanvasAppState } from "../../types";
import type { RenderableElementsMap } from "../../scene/types";

/** the circle gizmos of live corners: the rounding circle and its grab point */
export const renderCornerGizmos = (
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
  element: ExcalidrawElement,
  elementsMap: RenderableElementsMap,
) => {
  if (
    !appState.cornerMode ||
    appState.editingPath ||
    !canEditCorners(element)
  ) {
    return;
  }
  const zoom = appState.zoom.value;
  const accent = getThemedColor("#6965db", appState.theme);
  const white = getThemedColor("#ffffff", appState.theme);
  // the caller has already moved the origin to the scene
  context.save();
  context.lineWidth = 1.5 / zoom;
  for (const handle of getCornerHandles(element, elementsMap)) {
    // the grab point sits on the circle's centre; at radius 0 just inside
    const grab =
      handle.radius > 0
        ? handle.center
        : {
            x: handle.corner.x + handle.dir.x * (14 / zoom),
            y: handle.corner.y + handle.dir.y * (14 / zoom),
          };
    if (handle.radius > 0) {
      context.strokeStyle = accent;
      context.globalAlpha = 0.55;
      context.beginPath();
      context.arc(
        handle.center.x,
        handle.center.y,
        handle.radius,
        0,
        Math.PI * 2,
      );
      context.stroke();
      context.globalAlpha = 1;
    }
    context.strokeStyle = accent;
    context.setLineDash([3 / zoom, 3 / zoom]);
    context.beginPath();
    context.moveTo(handle.corner.x, handle.corner.y);
    context.lineTo(grab.x, grab.y);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = white;
    context.beginPath();
    context.arc(grab.x, grab.y, 6 / zoom, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    if (handle.radius > 0) {
      context.fillStyle = accent;
      context.font = `${11 / zoom}px sans-serif`;
      context.fillText(
        `${Math.round(handle.radius)}`,
        grab.x + 9 / zoom,
        grab.y - 6 / zoom,
      );
    }
  }
  context.restore();
};
