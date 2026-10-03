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
  const b = boundsOf(shapes);
  const pad = 6;
  const c = theme.colors;
  const none = "none";
  return (
    <svg
      width={width}
      height={height}
      viewBox={`${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`}
      preserveAspectRatio="xMidYMid meet"
      style={{
        background: background ? c.page : "transparent",
        borderRadius: 6,
      }}
      aria-hidden="true"
    >
      {shapes.map((s, k) => {
        if (s.t === "rect") {
          const r = resolveRadius(s.r, s.h, s.w, theme);
          return (
            <rect
              key={k}
              x={s.x}
              y={s.y}
              width={s.w}
              height={s.h}
              rx={r}
              fill={s.f ? c[s.f] : none}
              stroke={s.s ? c[s.s] : none}
              strokeWidth={s.sw ?? 1}
              strokeDasharray={s.dash ? "4 3" : undefined}
            />
          );
        }
        if (s.t === "ellipse") {
          return (
            <ellipse
              key={k}
              cx={s.x + s.w / 2}
              cy={s.y + s.h / 2}
              rx={s.w / 2}
              ry={s.h / 2}
              fill={s.f ? c[s.f] : none}
              stroke={s.s ? c[s.s] : none}
              strokeWidth={s.sw ?? 1}
            />
          );
        }
        if (s.t === "line") {
          return (
            <polyline
              key={k}
              points={s.pts.map((p) => p.join(",")).join(" ")}
              fill="none"
              stroke={c[s.s ?? "text"]}
              strokeWidth={s.sw ?? theme.stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        }
        if (s.t === "icon") {
          const icon = getIcon(s.name);
          const k2 = s.size / 24;
          return icon ? (
            <path
              key={k}
              d={icon.d}
              transform={`translate(${s.x} ${s.y}) scale(${k2})`}
              fill="none"
              stroke={c[s.s ?? "text"]}
              strokeWidth={Math.max(1, theme.stroke * k2) / k2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null;
        }
        return (
          <text
            key={k}
            x={s.x}
            y={s.y}
            fontSize={s.size}
            fill={c[s.s]}
            textAnchor={s.anchor ?? "start"}
            dominantBaseline="central"
            fontFamily="Nunito, system-ui, sans-serif"
          >
            {s.text}
          </text>
        );
      })}
    </svg>
  );
};
