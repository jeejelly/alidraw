import { useEffect, useRef, useState } from "react";

import { THEME, viewportCoordsToSceneCoords } from "@excalidraw/common";

import { formatRulerValue, getRulerStep } from "../guides";

import { RULER_SIZE } from "./App.guides";

import type App from "./App";

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

const drawRuler = (
  canvas: HTMLCanvasElement,
  axis: "x" | "y",
  app: App,
  cursor: number | null,
) => {
  const { zoom, scrollX, scrollY, width, height, theme, guides } = app.state;
  const colors = COLORS[theme];
  const length = axis === "x" ? width : height;
  const dpr = window.devicePixelRatio || 1;
  const cssW = axis === "x" ? length : RULER_SIZE;
  const cssH = axis === "x" ? RULER_SIZE : length;
  canvas.width = Math.max(1, Math.round(cssW * dpr));
  canvas.height = Math.max(1, Math.round(cssH * dpr));
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  ctx.scale(dpr, dpr);
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, cssW, cssH);

  const scroll = axis === "x" ? scrollX : scrollY;
  const z = zoom.value;
  const toScreen = (v: number) => (v + scroll) * z;
  const major = getRulerStep(z);
  const minor = major / 5;
  const first = Math.floor(-scroll / minor) * minor;
  const last = -scroll + length / z;

  ctx.strokeStyle = colors.line;
  ctx.fillStyle = colors.text;
  ctx.font = "10px sans-serif";
  ctx.textBaseline = "top";
  ctx.lineWidth = 1;
  for (let v = first; v <= last; v += minor) {
    const n = Math.round(v / minor);
    const isMajor = n % 5 === 0;
    const p = Math.round(toScreen(n * minor)) + 0.5;
    const len = isMajor ? RULER_SIZE : n % 5 === 0 ? 10 : 6;
    ctx.beginPath();
    if (axis === "x") {
      ctx.moveTo(p, RULER_SIZE);
      ctx.lineTo(p, RULER_SIZE - len);
    } else {
      ctx.moveTo(RULER_SIZE, p);
      ctx.lineTo(RULER_SIZE - len, p);
    }
    ctx.stroke();
    if (isMajor) {
      const label = formatRulerValue(n * minor);
      if (axis === "x") {
        ctx.fillText(label, p + 3, 2);
      } else {
        ctx.save();
        ctx.translate(2, p - 3);
        ctx.rotate(-Math.PI / 2);
        ctx.textBaseline = "top";
        ctx.fillText(label, 0, 0);
        ctx.restore();
      }
    }
  }

  // guides and the cursor leave a mark
  const mark = (v: number, color: string) => {
    const p = Math.round(toScreen(v)) + 0.5;
    ctx.strokeStyle = color;
    ctx.beginPath();
    if (axis === "x") {
      ctx.moveTo(p, 0);
      ctx.lineTo(p, RULER_SIZE);
    } else {
      ctx.moveTo(0, p);
      ctx.lineTo(RULER_SIZE, p);
    }
    ctx.stroke();
  };
  for (const g of guides) {
    if (g.axis === axis) {
      mark(g.position, colors.guide);
    }
  }
  if (cursor !== null) {
    mark(cursor, colors.cursor);
  }
};

/**
 * Edge rulers in px, tracking zoom and scroll. A drag from a ruler makes a
 * guide; the readout shows its exact position while it moves.
 */
export const Rulers = ({ app }: { app: App }) => {
  const topRef = useRef<HTMLCanvasElement>(null);
  const leftRef = useRef<HTMLCanvasElement>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => app.guides.subscribe(() => setTick((n) => n + 1)), [app]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      setCursor(viewportCoordsToSceneCoords(event, app.state));
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [app]);

  const { zoom, scrollX, scrollY, width, height, theme, guides } = app.state;
  useEffect(() => {
    if (topRef.current) {
      drawRuler(topRef.current, "x", app, cursor ? cursor.x : null);
    }
    if (leftRef.current) {
      drawRuler(leftRef.current, "y", app, cursor ? cursor.y : null);
    }
  }, [app, zoom.value, scrollX, scrollY, width, height, theme, guides, cursor]);

  const readout = app.guides.getReadout();
  const style = {
    position: "absolute",
    background: "transparent",
    zIndex: "var(--zIndex-canvasButtons, 3)",
    pointerEvents: "all",
    touchAction: "none",
  } as const;

  return (
    <>
      <canvas
        ref={topRef}
        data-testid="ruler-top"
        style={{ ...style, top: 0, left: 0, cursor: "row-resize" }}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          app.guides.startDrag("y", null);
        }}
      />
      <canvas
        ref={leftRef}
        data-testid="ruler-left"
        style={{ ...style, top: 0, left: 0, cursor: "col-resize" }}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          app.guides.startDrag("x", null);
        }}
      />
      {readout && (
        <div
          data-testid="guide-readout"
          style={{
            position: "fixed",
            left: readout.clientX + 14,
            top: readout.clientY + 14,
            padding: "2px 6px",
            borderRadius: 4,
            font: "12px sans-serif",
            background: readout.willDelete ? "#e03131" : "#e0449b",
            color: "#fff",
            pointerEvents: "none",
            zIndex: 100,
          }}
        >
          {readout.willDelete
            ? "Release to delete"
            : `${readout.axis === "x" ? "X" : "Y"}: ${formatRulerValue(
                readout.position,
              )}`}
        </div>
      )}
    </>
  );
};
