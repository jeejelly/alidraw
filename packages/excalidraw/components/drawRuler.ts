import { THEME } from "@excalidraw/common";

import { formatRulerValue, getRulerStep } from "../guides";

import { RULER_SIZE } from "./App.guides";

import type App from "./App";

type Axis = "x" | "y";

const COLORS = {
  [THEME.LIGHT]: {
    bg: "#f8f9fa",
    line: "#ced4da",
    text: "#495057",
    cursor: "#e0449b",
    guide: "#e0449b",
  },
  [THEME.DARK]: {
    bg: "#232329",
    line: "#495057",
    text: "#adb5bd",
    cursor: "#e0449b",
    guide: "#e0449b",
  },
} as const;

const MINOR_TICKS_PER_MAJOR = 5;
const MINOR_TICK_LENGTH = 6;

const drawTicks = (
  context: CanvasRenderingContext2D,
  axis: Axis,
  colors: (typeof COLORS)[keyof typeof COLORS],
  toScreen: (position: number) => number,
  zoomValue: number,
  scroll: number,
  length: number,
) => {
  const major = getRulerStep(zoomValue);
  const minor = major / MINOR_TICKS_PER_MAJOR;
  const first = Math.floor(-scroll / minor) * minor;
  const last = -scroll + length / zoomValue;

  context.strokeStyle = colors.line;
  context.fillStyle = colors.text;
  context.font = "10px sans-serif";
  context.textBaseline = "top";
  context.lineWidth = 1;
  for (let value = first; value <= last; value += minor) {
    const tickIndex = Math.round(value / minor);
    const isMajor = tickIndex % MINOR_TICKS_PER_MAJOR === 0;
    const screenPosition = Math.round(toScreen(tickIndex * minor)) + 0.5;
    const tickLength = isMajor ? RULER_SIZE : MINOR_TICK_LENGTH;
    context.beginPath();
    if (axis === "x") {
      context.moveTo(screenPosition, RULER_SIZE);
      context.lineTo(screenPosition, RULER_SIZE - tickLength);
    } else {
      context.moveTo(RULER_SIZE, screenPosition);
      context.lineTo(RULER_SIZE - tickLength, screenPosition);
    }
    context.stroke();
    if (!isMajor) {
      continue;
    }
    const label = formatRulerValue(tickIndex * minor);
    if (axis === "x") {
      context.fillText(label, screenPosition + 3, 2);
    } else {
      context.save();
      context.translate(2, screenPosition - 3);
      context.rotate(-Math.PI / 2);
      context.textBaseline = "top";
      context.fillText(label, 0, 0);
      context.restore();
    }
  }
};

const drawMark = (
  context: CanvasRenderingContext2D,
  axis: Axis,
  screenPosition: number,
  color: string,
) => {
  context.strokeStyle = color;
  context.beginPath();
  if (axis === "x") {
    context.moveTo(screenPosition, 0);
    context.lineTo(screenPosition, RULER_SIZE);
  } else {
    context.moveTo(0, screenPosition);
    context.lineTo(RULER_SIZE, screenPosition);
  }
  context.stroke();
};

export const drawRuler = (
  canvas: HTMLCanvasElement,
  axis: Axis,
  app: App,
  cursor: number | null,
) => {
  const { zoom, scrollX, scrollY, width, height, theme, guides } = app.state;
  const colors = COLORS[theme];
  const length = axis === "x" ? width : height;
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = axis === "x" ? length : RULER_SIZE;
  const cssHeight = axis === "x" ? RULER_SIZE : length;
  canvas.width = Math.max(1, Math.round(cssWidth * dpr));
  canvas.height = Math.max(1, Math.round(cssHeight * dpr));
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  context.scale(dpr, dpr);
  context.fillStyle = colors.bg;
  context.fillRect(0, 0, cssWidth, cssHeight);

  const scroll = axis === "x" ? scrollX : scrollY;
  const toScreen = (position: number) => (position + scroll) * zoom.value;
  drawTicks(context, axis, colors, toScreen, zoom.value, scroll, length);

  const mark = (position: number, color: string) =>
    drawMark(context, axis, Math.round(toScreen(position)) + 0.5, color);
  for (const guide of guides) {
    if (guide.axis === axis) {
      mark(guide.position, colors.guide);
    }
  }
  if (cursor !== null) {
    mark(cursor, colors.cursor);
  }
};
