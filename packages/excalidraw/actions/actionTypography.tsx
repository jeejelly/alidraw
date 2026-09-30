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
  redrawTextBoundingBox,
  updateBoundElements,
} from "@excalidraw/element";
import { getBoundTextElement } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import {
  filterFontFamilies,
  getLocalFontFamilies,
  isLocalFontAccessSupported,
} from "../fonts/localFonts";
import { t } from "../i18n";

import {
  changeFontSize,
  changeProperty,
  getFormValue,
} from "./actionProperties";
import { register } from "./register";

import type { AppState } from "../types";

const hasText = (element: any, app: any) =>
  isTextElement(element) ||
  getBoundTextElement(element, app.scene.getNonDeletedElementsMap()) !== null;

// -----------------------------------------------------------------------------
// numeric font size
// -----------------------------------------------------------------------------

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
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
          e.stopPropagation();
        } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          const base = parseFontSize(draft) ?? value ?? DEFAULT_FONT_SIZE;
          const next = parseFontSize(
            `${base + (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 10 : 1)}`,
          );
          if (next !== null) {
            setDraft(`${next}`);
            onCommit(next);
          }
          e.preventDefault();
        }
        // keep typing away from the editor shortcuts
        e.stopPropagation();
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
        const text = isTextElement(element)
          ? element
          : getBoundTextElement(element, app.scene.getNonDeletedElementsMap());
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
        <FontSizeField value={size} onCommit={(v) => updateData({ size: v })} />
        <select
          data-testid="fontUnit-select"
          aria-label={t("labels.fontUnit")}
          value={unit ?? ""}
          onChange={(e) => updateData({ unit: e.target.value as FontUnit })}
        >
          {unit === null && <option value="" />}
          {FONT_UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
    );
  },
});

// -----------------------------------------------------------------------------
// local fonts
// -----------------------------------------------------------------------------

export const actionChangeLocalFont = register<string | null>({
  name: "changeLocalFont",
  label: "labels.localFont",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    const name = typeof value === "string" && value ? value : null;
    const updated = new Set<ExcalidrawTextElement>();
    const nextElements = changeProperty(
      elements,
      appState,
      (element) => {
        if (!isTextElement(element)) {
          return element;
        }
        const next = newElementWith(element, { fontFamilyName: name });
        updated.add(next);
        redrawTextBoundingBox(
          next,
          app.scene.getContainerElement(next),
          app.scene,
        );
        return next;
      },
      true,
    );
    updated.forEach((el) =>
      updateBoundElements(el as NonDeletedExcalidrawElement, app.scene),
    );
    return {
      elements: nextElements,
      appState: { ...appState, currentItemFontFamilyName: name },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app }) => {
    const current = getFormValue<string | null>(
      elements,
      app,
      (element) => {
        const text = isTextElement(element)
          ? element
          : getBoundTextElement(element, app.scene.getNonDeletedElementsMap());
        return text?.fontFamilyName ?? null;
      },
      (element) => hasText(element, app),
      (hasSelection) =>
        hasSelection ? null : appState.currentItemFontFamilyName,
    );
    return <LocalFontPicker current={current} onSelect={updateData} />;
  },
});

const LocalFontPicker = ({
  current,
  onSelect,
}: {
  current: string | null;
  onSelect: (name: string | null) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [families, setFamilies] = useState<string[] | null>(null);
  const [query, setQuery] = useState("");

  if (!isLocalFontAccessSupported()) {
    return null;
  }

  const show = async () => {
    setOpen((o) => !o);
    if (families === null) {
      setFamilies(await getLocalFontFamilies());
    }
  };

  const list = filterFontFamilies(families ?? [], query).slice(0, 200);

  return (
    <div className="local-font-picker" style={{ position: "relative" }}>
      <button
        type="button"
        data-testid="local-font-button"
        onClick={show}
        style={{ width: "100%", textAlign: "left" }}
        title={t("labels.localFont")}
      >
        {current ?? t("labels.localFont")}
      </button>
      {open && (
        <div
          data-testid="local-font-list"
          style={{
            position: "absolute",
            zIndex: 10,
            marginTop: 4,
            width: "100%",
            maxHeight: 260,
            overflow: "auto",
            background: "var(--island-bg-color)",
            boxShadow: "var(--shadow-island)",
            borderRadius: 6,
            padding: 4,
          }}
        >
          <input
            autoFocus
            type="text"
            value={query}
            placeholder={t("labels.localFontSearch")}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            style={{ width: "100%", marginBottom: 4 }}
          />
          {current && (
            <button
              type="button"
              onClick={() => {
                onSelect(null);
                setOpen(false);
              }}
            >
              {t("labels.localFontClear")}
            </button>
          )}
          {families !== null && list.length === 0 && (
            <div style={{ padding: 6 }}>{t("labels.localFontNone")}</div>
          )}
          {list.map((family) => (
            <button
              key={family}
              type="button"
              data-testid="local-font-item"
              onClick={() => {
                onSelect(family);
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                fontFamily: `"${family}"`,
              }}
            >
              {family}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
