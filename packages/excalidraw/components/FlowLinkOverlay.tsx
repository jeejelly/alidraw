import { useSyncExternalStore } from "react";

import { sceneCoordsToViewportCoords } from "@excalidraw/common";

import { FlowPortDots } from "./FlowPortDots";

import type App from "./App";

/** the line from a handle to the pointer, with what the release would reach */
export const FlowLinkOverlay = ({ app }: { app: App }) => {
  const link = useSyncExternalStore(app.flow.subscribe, app.flow.getSnapshot);
  const dots = <FlowPortDots app={app} hover={link?.hover ?? null} />;
  if (!link) {
    return dots;
  }
  const at = (x: number, y: number) =>
    sceneCoordsToViewportCoords({ sceneX: x, sceneY: y }, app.state);
  const start = at(link.from.x, link.from.y);
  const end = at(link.to.x, link.to.y);
  const box = (rect: { x: number; y: number; w: number; h: number }) => {
    const topLeft = at(rect.x, rect.y);
    const bottomRight = at(rect.x + rect.w, rect.y + rect.h);
    return {
      left: topLeft.x,
      top: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };
  };
  return (
    <>
      {dots}
      <div
        className="flow-link-overlay"
        data-testid="flow-link"
        aria-hidden="true"
      >
        <svg>
          <line
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke="#e0449b"
            strokeWidth={2}
            strokeDasharray="6 4"
          />
          <circle cx={end.x} cy={end.y} r={4} fill="#e0449b" />
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
    </>
  );
};
