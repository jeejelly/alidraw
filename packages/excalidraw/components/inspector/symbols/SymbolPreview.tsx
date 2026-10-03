import { getIcon } from "@excalidraw/symbols";
import { boundsOf, resolveRadius, type Shape } from "@excalidraw/symbols";

import type { SymbolTheme } from "@excalidraw/symbols";

/** a symbol drawn as SVG in the theme, for the panel */
export const SymbolPreview = ({
  shapes,
  theme,
  width,
  height,
  background = true,
}: {
  shapes: readonly Shape[];
  theme: SymbolTheme;
  width: number;
  height: number;
  background?: boolean;
}) => {
  const bounds = boundsOf(shapes);
  const pad = 6;
  const colors = theme.colors;
  const none = "none";
  return (
    <svg
      width={width}
      height={height}
      viewBox={`${bounds.x - pad} ${bounds.y - pad} ${bounds.w + pad * 2} ${
        bounds.h + pad * 2
      }`}
      preserveAspectRatio="xMidYMid meet"
      style={{
        background: background ? colors.page : "transparent",
        borderRadius: 6,
      }}
      aria-hidden="true"
    >
      {shapes.map((shape, index) => {
        if (shape.t === "rect") {
          const radius = resolveRadius(shape.r, shape.h, shape.w, theme);
          return (
            <rect
              key={index}
              x={shape.x}
              y={shape.y}
              width={shape.w}
              height={shape.h}
              rx={radius}
              fill={shape.f ? colors[shape.f] : none}
              stroke={shape.s ? colors[shape.s] : none}
              strokeWidth={shape.sw ?? 1}
              strokeDasharray={shape.dash ? "4 3" : undefined}
            />
          );
        }
        if (shape.t === "ellipse") {
          return (
            <ellipse
              key={index}
              cx={shape.x + shape.w / 2}
              cy={shape.y + shape.h / 2}
              rx={shape.w / 2}
              ry={shape.h / 2}
              fill={shape.f ? colors[shape.f] : none}
              stroke={shape.s ? colors[shape.s] : none}
              strokeWidth={shape.sw ?? 1}
            />
          );
        }
        if (shape.t === "line") {
          return (
            <polyline
              key={index}
              points={shape.pts.map((point) => point.join(",")).join(" ")}
              fill="none"
              stroke={colors[shape.s ?? "text"]}
              strokeWidth={shape.sw ?? theme.stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        }
        if (shape.t === "icon") {
          const icon = getIcon(shape.name);
          const k2 = shape.size / 24;
          return icon ? (
            <path
              key={index}
              d={icon.d}
              transform={`translate(${shape.x} ${shape.y}) scale(${k2})`}
              fill="none"
              stroke={colors[shape.s ?? "text"]}
              strokeWidth={Math.max(1, theme.stroke * k2) / k2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null;
        }
        return (
          <text
            key={index}
            x={shape.x}
            y={shape.y}
            fontSize={shape.size}
            fill={colors[shape.s]}
            textAnchor={shape.anchor ?? "start"}
            dominantBaseline="central"
            fontFamily="Nunito, system-ui, sans-serif"
          >
            {shape.text}
          </text>
        );
      })}
    </svg>
  );
};
