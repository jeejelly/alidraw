import { sceneCoordsToViewportCoords } from "@excalidraw/common";

import { dotsOfStep, selectedPortDots } from "./appFlow/portDots";

import type { PortDot, PortStep } from "./appFlow/portDots";
import type App from "./App";

const DOT_RADIUS = 5;
/** gap (px) between a dot and its name */
const NAME_GAP = 9;

/** the name goes outside the step, on the side its dot sits on */
const nameAnchor = (at: [number, number]) => {
  if (at[0] <= 0) {
    return { dx: -NAME_GAP, dy: 4, anchor: "end" } as const;
  }
  if (at[0] >= 1) {
    return { dx: NAME_GAP, dy: 4, anchor: "start" } as const;
  }
  return at[1] <= 0
    ? ({ dx: 0, dy: -NAME_GAP, anchor: "middle" } as const)
    : ({ dx: 0, dy: NAME_GAP + 6, anchor: "middle" } as const);
};

/** small labelled dots on the ports of the selected step, and of the one a link is dragged over */
export const FlowPortDots = ({
  app,
  hover,
}: {
  app: App;
  hover: (PortStep & { port: string | null }) | null;
}) => {
  const dots: PortDot[] = [
    ...selectedPortDots(app),
    ...(hover ? dotsOfStep(app, hover) : []),
  ];
  if (!dots.length) {
    return null;
  }
  return (
    <div
      className="flow-link-overlay"
      data-testid="flow-ports"
      aria-hidden="true"
    >
      <svg>
        {dots.map((dot) => {
          const center = sceneCoordsToViewportCoords(
            { sceneX: dot.center.x, sceneY: dot.center.y },
            app.state,
          );
          const { dx, dy, anchor } = nameAnchor(dot.at);
          const active = hover?.key === dot.key && hover.port === dot.name;
          return (
            <g
              key={`${dot.key}/${dot.name}`}
              data-testid={`flow-port-${dot.name}`}
              data-active={active || undefined}
            >
              <circle
                cx={center.x}
                cy={center.y}
                r={active ? DOT_RADIUS + 2 : DOT_RADIUS}
                fill={active ? "#e0449b" : "#fff"}
                stroke="#e0449b"
                strokeWidth={2}
              />
              <text
                x={center.x + dx}
                y={center.y + dy}
                textAnchor={anchor}
                fontSize={11}
                fill="#e0449b"
                stroke="#fff"
                strokeWidth={3}
                paintOrder="stroke"
              >
                {dot.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
