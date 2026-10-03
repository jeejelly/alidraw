import { THEME, applyDarkModeFilter } from "@excalidraw/common";

import type { InteractiveCanvasAppState } from "../../types";

/** maps a light-mode UI color to its dark-mode counterpart when in dark mode */
export const getThemedColor = (
  color: string,
  theme: InteractiveCanvasAppState["theme"],
) => applyDarkModeFilter(color, theme === THEME.DARK);

/** a rounded label with white text, filled with the current fill style */
export const drawPillLabel = (
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  zoom: number,
) => {
  context.font = `${12 / zoom}px sans-serif`;
  const width = context.measureText(text).width + 10 / zoom;
  const height = 18 / zoom;
  context.beginPath();
  if (context.roundRect) {
    context.roundRect(x, y, width, height, 9 / zoom);
  } else {
    context.rect(x, y, width, height);
  }
  context.fill();
  context.fillStyle = "#fff";
  context.textBaseline = "middle";
  context.fillText(text, x + 5 / zoom, y + height / 2);
};
