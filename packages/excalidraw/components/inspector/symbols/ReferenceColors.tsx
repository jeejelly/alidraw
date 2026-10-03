import { useState } from "react";

import { addSwatches } from "@excalidraw/color";
import { colorScheme, type SymbolTheme } from "@excalidraw/symbols";

import {
  actionChangeBackgroundColor,
  actionChangeStrokeColor,
} from "../../../actions";

import type App from "../../App";

/** The colours a theme is made of, to pick from and keep in the swatches. */
export const ReferenceColors = ({
  app,
  theme,
}: {
  app: App;
  theme: SymbolTheme;
}) => {
  const [target, setTarget] = useState<"fill" | "stroke">("fill");
  const [kept, setKept] = useState<string | null>(null);
  const colors = colorScheme(theme);
  const apply = (color: string) =>
    app.actionManager.executeAction(
      target === "fill" ? actionChangeBackgroundColor : actionChangeStrokeColor,
      "ui",
      {
        currentItemBackgroundColor: color,
        currentItemStrokeColor: color,
        color,
      } as any,
    );
  const keepColors = () => {
    const count = addSwatches(
      colors.map((entry) => ({
        name: `${theme.name} ${entry.name}`,
        color: entry.color,
      })),
    );
    setKept(`${count} colours added to the swatches.`);
  };
  return (
    <div className="symbols__scheme" data-testid="symbols-scheme">
      <div className="symbols__row">
        {(["fill", "stroke"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={target === option}
            onClick={() => setTarget(option)}
          >
            {option === "fill" ? "Fill" : "Stroke"}
          </button>
        ))}
        <button
          type="button"
          data-testid="symbols-scheme-keep"
          title="Keep these colours in the swatches"
          onClick={keepColors}
        >
          Keep
        </button>
      </div>
      <div className="symbols__chips">
        {colors.map((entry) => (
          <button
            key={entry.name}
            type="button"
            className="symbols__chip"
            title={`${entry.name} ${entry.color}`}
            data-testid="symbols-scheme-color"
            style={{ background: entry.color }}
            onClick={() => apply(entry.color)}
          />
        ))}
      </div>
      {kept && <p className="symbols__note">{kept}</p>}
    </div>
  );
};
