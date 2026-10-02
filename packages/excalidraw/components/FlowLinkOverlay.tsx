import { useSyncExternalStore } from "react";

import { sceneCoordsToViewportCoords } from "@excalidraw/common";

import type App from "./App";

/** the line from a handle to the pointer, with what the release would reach */
export const FlowLinkOverlay = ({ app }: { app: App }) => {
  const link = useSyncExternalStore(app.flow.subscribe, app.flow.getSnapshot);
  if (!link) {
    return null;
  }
  const at = (x: number, y: number) =>
    sceneCoordsToViewportCoords({ sceneX: x, sceneY: y }, app.state);
  const a = at(link.from.x, link.from.y);
  const b = at(link.to.x, link.to.y);
  const box = (r: { x: number; y: number; w: number; h: number }) => {
    const p = at(r.x, r.y);
    const q = at(r.x + r.w, r.y + r.h);
    return { left: p.x, top: p.y, width: q.x - p.x, height: q.y - p.y };
  };
  return (
    <div
      className="flow-link-overlay"
      data-testid="flow-link"
      aria-hidden="true"
    >
      <svg>
        <line
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke="#e0449b"
          strokeWidth={2}
          strokeDasharray="6 4"
        />
        <circle cx={b.x} cy={b.y} r={4} fill="#e0449b" />
      </svg>
      {link.target && (
        <div
          className="flow-link-overlay__box"
          data-testid="flow-link-target"
          style={box(link.target)}
        />
      )}
      {link.ghost && (
        <div
          className="flow-link-overlay__box flow-link-overlay__box--ghost"
          data-testid="flow-link-ghost"
          style={box(link.ghost)}
        />
      )}
    </div>
  );
};
