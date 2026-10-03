import {
  ALL_THEMES,
  MAX_RADIUS,
  TOKENS,
  type SymbolTheme,
} from "@excalidraw/symbols";

import { ColorField } from "../ColorField";

import { setSymbolTheme } from "./themeStore";

export const ThemeEditor = ({ theme }: { theme: SymbolTheme }) => {
  const isPreset = ALL_THEMES.some((preset) => preset.name === theme.name);
  return (
    <div className="symbols__theme" data-testid="symbols-theme">
      <label className="symbols__param">
        <span>Theme</span>
        <select
          className="inspector__select"
          data-testid="symbols-theme-preset"
          value={isPreset ? theme.name : ""}
          onChange={(event) => {
            const preset = ALL_THEMES.find(
              (candidate) => candidate.name === event.target.value,
            );
            if (preset) {
              setSymbolTheme(preset);
            }
          }}
        >
          {!isPreset && <option value="">{theme.name}</option>}
          {ALL_THEMES.map((preset) => (
            <option key={preset.name} value={preset.name}>
              {preset.name}
            </option>
          ))}
        </select>
      </label>
      <label className="symbols__param">
        <span>Corners</span>
        <input
          type="range"
          className="inspector__slider"
          style={{ ["--p" as string]: theme.radius / MAX_RADIUS }}
          data-testid="symbols-radius-range"
          min={0}
          max={MAX_RADIUS}
          value={theme.radius}
          onChange={(event) =>
            setSymbolTheme({ ...theme, radius: Number(event.target.value) })
          }
        />
        <input
          type="number"
          className="inspector__text symbols__num"
          data-testid="symbols-radius"
          min={0}
          value={theme.radius}
          onKeyDown={(event) => event.stopPropagation()}
          onChange={(event) =>
            Number.isFinite(Number(event.target.value)) &&
            setSymbolTheme({
              ...theme,
              radius: Math.max(0, Number(event.target.value)),
            })
          }
        />
      </label>
      <label className="symbols__param">
        <span>Stroke</span>
        <input
          type="number"
          className="inspector__text"
          data-testid="symbols-stroke"
          min={0.5}
          step={0.5}
          value={theme.stroke}
          onKeyDown={(event) => event.stopPropagation()}
          onChange={(event) =>
            Number(event.target.value) > 0 &&
            setSymbolTheme({ ...theme, stroke: Number(event.target.value) })
          }
        />
      </label>
      <div className="symbols__tokens">
        {TOKENS.map((token) => (
          <div key={token} className="symbols__token">
            <span>{token}</span>
            <ColorField
              compact
              label={token}
              testId={`symbols-token-${token}`}
              value={theme.colors[token]}
              onChange={(color) =>
                setSymbolTheme({
                  ...theme,
                  colors: { ...theme.colors, [token]: color },
                })
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
};
