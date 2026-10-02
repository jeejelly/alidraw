import { useSyncExternalStore } from "react";

import { sceneCoordsToViewportCoords } from "@excalidraw/common";

import type App from "./App";

/** the frame being stretched, and the lines that flash when it lines up with something */
export const StretchOverlay = ({ app }: { app: App }) => {
  const { frame, guides } = useSyncExternalStore(
    app.stretch.subscribe,
    app.stretch.getSnapshot,
  );
  if (!frame) {
    return null;
  }
  const at = (x: number, y: number) =>
    sceneCoordsToViewportCoords({ sceneX: x, sceneY: y }, app.state);
  const a = at(frame.x0, frame.y0);
  const b = at(frame.x1, frame.y1);
  const aligned = guides.length > 0;
  return (
    <div
      className="stretch-overlay"
      data-testid="stretch-overlay"
      aria-hidden="true"
    >
      <div
        className={`stretch-overlay__frame${aligned ? " is-aligned" : ""}`}
        style={{ left: a.x, top: a.y, width: b.x - a.x, height: b.y - a.y }}
      />
      {guides.map((g, k) => {
        const p0 = g.axis === "x" ? at(g.pos, g.from) : at(g.from, g.pos);
        const p1 = g.axis === "x" ? at(g.pos, g.to) : at(g.to, g.pos);
        return (
          <div
            key={k}
            data-testid="stretch-guide"
            className={`stretch-overlay__guide stretch-overlay__guide--${g.axis}`}
            style={
              g.axis === "x"
                ? { left: p0.x, top: p0.y, height: p1.y - p0.y }
                : { left: p0.x, top: p0.y, width: p1.x - p0.x }
            }
          />
        );
      })}
    </div>
  );
};
