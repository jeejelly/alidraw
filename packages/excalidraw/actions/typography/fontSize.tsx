import { useEffect, useState } from "react";

import {
  DEFAULT_FONT_SIZE,
  FONT_UNITS,
  MAX_FONT_SIZE_INPUT,
  MIN_FONT_SIZE_INPUT,
  type FontUnit,
} from "@excalidraw/common";
import {
  CaptureUpdateAction,
  getBaseFontSize,
  isTextElement,
  newElementWith,
} from "@excalidraw/element";
import { getBoundTextElement } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { t } from "../../i18n";

import {
  changeFontSize,
  changeProperty,
  getFormValue,
} from "../actionProperties";
import { register } from "../register";

import { getTextOf, hasText } from "./shared";

import type { AppState } from "../../types";

export const parseFontSize = (raw: string): number | null => {
  const value = Number(raw.trim().replace(",", "."));
  if (!raw.trim() || !Number.isFinite(value)) {
    return null;
  }
  return Math.min(
    MAX_FONT_SIZE_INPUT,
    Math.max(MIN_FONT_SIZE_INPUT, Math.round(value * 100) / 100),
  );
};

const FontSizeField = ({
  value,
  onCommit,
}: {
  value: number | null;
  onCommit: (size: number) => void;
}) => {
  const [draft, setDraft] = useState<string>(value === null ? "" : `${value}`);
  useEffect(() => {
    setDraft(value === null ? "" : `${value}`);
  }, [value]);

  const commit = () => {
    const size = parseFontSize(draft);
    if (size === null) {
      setDraft(value === null ? "" : `${value}`);
    } else if (size !== value) {
      onCommit(size);
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      className="font-size-input"
      data-testid="fontSize-input"
      aria-label={t("labels.fontSize")}
      placeholder={value === null ? "—" : undefined}
      value={draft}
      style={{ width: "4.5rem" }}
      onChange={(changeEvent) => setDraft(changeEvent.target.value)}
      onBlur={commit}
      onKeyDown={(keyEvent) => {
        if (keyEvent.key === "Enter") {
          commit();
          keyEvent.stopPropagation();
        } else if (keyEvent.key === "ArrowUp" || keyEvent.key === "ArrowDown") {
          const base = parseFontSize(draft) ?? value ?? DEFAULT_FONT_SIZE;
          const next = parseFontSize(
            `${
              base +
              (keyEvent.key === "ArrowUp" ? 1 : -1) *
                (keyEvent.shiftKey ? 10 : 1)
            }`,
          );
          if (next !== null) {
            setDraft(`${next}`);
            onCommit(next);
          }
          keyEvent.preventDefault();
        }
        // keep typing away from the editor shortcuts
        keyEvent.stopPropagation();
      }}
    />
  );
};

const applyFontUnit = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  unit: FontUnit,
) => ({
  elements: changeProperty(
    elements,
    appState,
    (element) =>
      isTextElement(element)
        ? newElementWith(element, {
            fontUnit: unit,
          })
        : element,
    true,
  ),
  appState: { ...appState, currentItemFontUnit: unit },
  captureUpdate: CaptureUpdateAction.IMMEDIATELY,
});

export const actionChangeFontSizeInput = register<{
  size?: number;
  unit?: FontUnit;
}>({
  name: "changeFontSizeInput",
  label: "labels.fontSize",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    if (value?.unit && FONT_UNITS.includes(value.unit)) {
      return applyFontUnit(elements, appState, value.unit);
    }
    const size = value?.size;
    if (typeof size !== "number" || !Number.isFinite(size)) {
      return false;
    }
    return changeFontSize(elements, appState, app, () => size, size);
  },
  PanelComponent: ({ elements, appState, updateData, app }) => {
    const size = getFormValue(
      elements,
      app,
      (element) => {
        const map = app.scene.getNonDeletedElementsMap();
        if (isTextElement(element)) {
          return getBaseFontSize(element, map);
        }
        const bound = getBoundTextElement(element, map);
        return bound ? getBaseFontSize(bound, map) : null;
      },
      (element) => hasText(element, app),
      (hasSelection) =>
        hasSelection ? null : appState.currentItemFontSize || DEFAULT_FONT_SIZE,
    );
    const unit = getFormValue<FontUnit | null>(
      elements,
      app,
      (element) => {
        const text = getTextOf(element, app);
        return text ? text.fontUnit ?? "px" : null;
      },
      (element) => hasText(element, app),
      (hasSelection) => (hasSelection ? null : appState.currentItemFontUnit),
    );
    return (
      <div
        className="font-size-row"
        style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
      >
        <FontSizeField
          value={size}
          onCommit={(value) => updateData({ size: value })}
        />
        <select
          data-testid="fontUnit-select"
          aria-label={t("labels.fontUnit")}
          value={unit ?? ""}
          onChange={(changeEvent) =>
            updateData({ unit: changeEvent.target.value as FontUnit })
          }
        >
          {unit === null && <option value="" />}
          {FONT_UNITS.map((fontUnit) => (
            <option key={fontUnit} value={fontUnit}>
              {fontUnit}
            </option>
          ))}
        </select>
      </div>
    );
  },
});
