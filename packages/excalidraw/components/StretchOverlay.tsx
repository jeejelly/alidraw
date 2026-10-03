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
  const start = at(frame.x0, frame.y0);
  const end = at(frame.x1, frame.y1);
  const aligned = guides.length > 0;
  return (
    <div
      className="stretch-overlay"
      data-testid="stretch-overlay"
      aria-hidden="true"
    >
      <div
        className={`stretch-overlay__frame${aligned ? " is-aligned" : ""}`}
        style={{
          left: start.x,
          top: start.y,
          width: end.x - start.x,
          height: end.y - start.y,
        }}
      />
      {guides.map((guide, index) => {
        const p0 =
          guide.axis === "x"
            ? at(guide.pos, guide.from)
            : at(guide.from, guide.pos);
        const p1 =
          guide.axis === "x"
            ? at(guide.pos, guide.to)
            : at(guide.to, guide.pos);
        return (
          <div
            key={index}
            data-testid="stretch-guide"
            className={`stretch-overlay__guide stretch-overlay__guide--${guide.axis}`}
            style={
              guide.axis === "x"
                ? { left: p0.x, top: p0.y, height: p1.y - p0.y }
                : { left: p0.x, top: p0.y, width: p1.x - p0.x }
            }
          />
        );
      })}
    </div>
  );
};
