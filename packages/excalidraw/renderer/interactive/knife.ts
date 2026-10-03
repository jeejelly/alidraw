import { drawPillLabel, getThemedColor } from "./shared";

import type { InteractiveCanvasAppState } from "../../types";

/** the knife's cut line with its angle */
export const renderKnife = (
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
) => {
  const knife = appState.knife;
  if (!knife) {
    return;
  }
  const zoom = appState.zoom.value;
  const color = getThemedColor("#e0449b", appState.theme);
  context.save();
  context.lineCap = "round";
  // a white halo under the dashed line
  context.strokeStyle = getThemedColor("#ffffff", appState.theme);
  context.lineWidth = 4 / zoom;
  context.beginPath();
  context.moveTo(knife.from.x, knife.from.y);
  context.lineTo(knife.to.x, knife.to.y);
  context.stroke();
  context.strokeStyle = color;
  context.lineWidth = 1.75 / zoom;
  context.setLineDash([7 / zoom, 5 / zoom]);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = color;
  for (const endpoint of [knife.from, knife.to]) {
    context.beginPath();
    context.arc(endpoint.x, endpoint.y, 3.5 / zoom, 0, Math.PI * 2);
    context.fill();
  }
  if (knife.label) {
    drawPillLabel(
      context,
      knife.label,
      knife.to.x + 12 / zoom,
      knife.to.y + 12 / zoom,
      zoom,
    );
  }
  context.restore();
};
