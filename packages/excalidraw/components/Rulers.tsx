import { useEffect, useRef, useState } from "react";

import { viewportCoordsToSceneCoords } from "@excalidraw/common";

import { formatRulerValue } from "../guides";

import { drawRuler } from "./drawRuler";

import type App from "./App";

/**
 * Edge rulers in px, tracking zoom and scroll. A drag from a ruler makes a
 * guide; the readout shows its exact position while it moves.
 */
export const Rulers = ({ app }: { app: App }) => {
  const topRef = useRef<HTMLCanvasElement>(null);
  const leftRef = useRef<HTMLCanvasElement>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [, setTick] = useState(0);

  useEffect(
    () => app.guides.subscribe(() => setTick((count) => count + 1)),
    [app],
  );

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
  const editing = app.guides.getEditing();
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
        onPointerDown={(pointerEvent) => {
          pointerEvent.preventDefault();
          pointerEvent.stopPropagation();
          app.guides.startDrag("y", null);
        }}
      />
      <canvas
        ref={leftRef}
        data-testid="ruler-left"
        style={{ ...style, top: 0, left: 0, cursor: "col-resize" }}
        onPointerDown={(pointerEvent) => {
          pointerEvent.preventDefault();
          pointerEvent.stopPropagation();
          app.guides.startDrag("x", null);
        }}
      />
      {editing && (
        <input
          key={editing.id}
          data-testid="guide-input"
          aria-label={editing.axis === "x" ? "Guide x (px)" : "Guide y (px)"}
          autoFocus
          defaultValue={formatRulerValue(editing.position)}
          onFocus={(focusEvent) => focusEvent.currentTarget.select()}
          onKeyDown={(keyboardEvent) => {
            keyboardEvent.stopPropagation();
            if (keyboardEvent.key === "Enter") {
              app.guides.commitEdit(keyboardEvent.currentTarget.value);
            } else if (keyboardEvent.key === "Escape") {
              app.guides.cancelEdit();
            }
          }}
          onBlur={(blurEvent) =>
            app.guides.commitEdit(blurEvent.currentTarget.value)
          }
          style={{
            position: "fixed",
            left: editing.clientX + 10,
            top: editing.clientY + 10,
            width: 80,
            padding: "2px 6px",
            borderRadius: 4,
            border: "1px solid #e0449b",
            font: "12px sans-serif",
            zIndex: 100,
          }}
        />
      )}
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
