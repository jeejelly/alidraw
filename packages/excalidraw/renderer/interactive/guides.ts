import { getThemedColor } from "./shared";

import type { InteractiveCanvasAppState } from "../../types";

/** the rulers' guide lines, crisp at one device pixel (the origin is not scrolled yet) */
export const renderGuides = (
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
) => {
  if (!appState.guides.length) {
    return;
  }
  const { zoom, scrollX, scrollY, width, height } = appState;
  context.save();
  context.lineWidth = 1;
  context.strokeStyle = getThemedColor("#e0449b", appState.theme);
  context.setLineDash([]);
  for (const guide of appState.guides) {
    context.beginPath();
    if (guide.axis === "x") {
      const x = Math.round((guide.position + scrollX) * zoom.value) + 0.5;
      context.moveTo(x, 0);
      context.lineTo(x, height);
    } else {
      const y = Math.round((guide.position + scrollY) * zoom.value) + 0.5;
      context.moveTo(0, y);
      context.lineTo(width, y);
    }
    context.stroke();
  }
  context.restore();
};
