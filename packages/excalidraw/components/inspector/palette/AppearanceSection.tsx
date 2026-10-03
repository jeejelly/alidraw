import { normalizeHex } from "@excalidraw/color";

import { actionChangeOpacity } from "../../../actions";
import { t } from "../../../i18n";
import { Section, SliderRow } from "../primitives";

import { blurOnEnter } from "./inputHandlers";
import { DEFAULT_STROKE } from "./types";

import type { ColorTarget, RunAction } from "./types";

import type { DragEvent } from "react";

export const AppearanceSection = ({
  target,
  onTargetChange,
  strokeColor,
  backgroundColor,
  opacity,
  hasSelection,
  applyColor,
  run,
}: {
  target: ColorTarget;
  onTargetChange: (target: ColorTarget) => void;
  strokeColor: string;
  backgroundColor: string;
  opacity: number;
  hasSelection: boolean;
  applyColor: (color: string, target?: ColorTarget) => unknown;
  run: RunAction;
}) => {
  const currentColor = target === "stroke" ? strokeColor : backgroundColor;
  const hex = normalizeHex(currentColor);

  const dropColor = (which: ColorTarget) => (event: DragEvent) => {
    const color = event.dataTransfer.getData("text/swatch-color");
    if (color) {
      event.preventDefault();
      applyColor(color, which);
    }
  };

  return (
    <Section
      title={t("labels.palette.appearance")}
      testId="inspector-appearance"
    >
      <div className="inspector__row" style={{ alignItems: "flex-start" }}>
        <div className="inspector__wells">
          <button
            type="button"
            className={`inspector__well inspector__well--fill ${
              backgroundColor === "transparent" ? "inspector__checker" : ""
            }`}
            data-testid="palette-target-background"
            onDragOver={(event) => event.preventDefault()}
            onDrop={dropColor("background")}
            aria-pressed={target === "background"}
            aria-label={t("labels.background")}
            title={t("labels.background")}
            style={{
              background:
                backgroundColor === "transparent" ? undefined : backgroundColor,
            }}
            onClick={() => onTargetChange("background")}
          />
          <button
            type="button"
            className="inspector__well inspector__well--stroke"
            data-testid="palette-target-stroke"
            onDragOver={(event) => event.preventDefault()}
            onDrop={dropColor("stroke")}
            aria-pressed={target === "stroke"}
            aria-label={t("labels.stroke")}
            title={t("labels.stroke")}
            style={{
              borderColor:
                strokeColor === "transparent" ? "#c9c9c9" : strokeColor,
            }}
            onClick={() => onTargetChange("stroke")}
          />
        </div>
        <div
          style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}
        >
          <div className="inspector__row" style={{ marginTop: 0 }}>
            <input
              className="inspector__text"
              data-testid="palette-hex"
              aria-label={t("labels.palette.hex")}
              key={currentColor}
              defaultValue={currentColor === "transparent" ? "" : currentColor}
              placeholder="none"
              onKeyDown={blurOnEnter}
              onBlur={(event) => {
                const value = normalizeHex(event.target.value);
                if (value && value !== hex) {
                  applyColor(value);
                }
              }}
            />
            <input
              type="color"
              aria-label={t("labels.palette.pick")}
              value={hex ?? "#000000"}
              onChange={(event) => applyColor(event.target.value)}
              style={{
                width: 24,
                height: 24,
                padding: 0,
                border: 0,
                background: "none",
              }}
            />
          </div>
          <div className="inspector__row" style={{ marginTop: 0, gap: 2 }}>
            <button
              type="button"
              className="inspector__iconbtn"
              data-testid="palette-swap"
              title={t("labels.palette.swap")}
              disabled={!hasSelection || backgroundColor === "transparent"}
              onClick={() => {
                applyColor(backgroundColor, "stroke");
                applyColor(strokeColor, "background");
              }}
            >
              ⇄
            </button>
            <button
              type="button"
              className="inspector__iconbtn"
              data-testid="palette-default"
              title={t("labels.palette.defaults")}
              onClick={() => {
                applyColor(DEFAULT_STROKE, "stroke");
                applyColor("transparent", "background");
              }}
            >
              ◩
            </button>
            <button
              type="button"
              className="inspector__iconbtn"
              data-testid="palette-none"
              title={t("labels.palette.none")}
              onClick={() => applyColor("transparent")}
            >
              ⊘
            </button>
          </div>
        </div>
      </div>
      <SliderRow
        label={t("labels.opacity")}
        testId="inspector-opacity"
        value={opacity}
        min={0}
        max={100}
        unit="%"
        onChange={(value) => run(actionChangeOpacity, value)}
      />
    </Section>
  );
};
