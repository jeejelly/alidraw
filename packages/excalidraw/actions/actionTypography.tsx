import { useEffect, useState } from "react";

import { KEYS } from "@excalidraw/common";

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
import {
  findLibraryFont,
  getLoadedCatalogue,
  hasExactStyle,
  loadFontCatalogue,
  loadLibraryFace,
  pickLibraryStyle,
  type LibraryFont,
} from "../fonts/library";
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

export const LocalFontPicker = ({
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

// -----------------------------------------------------------------------------
// bold and italic
// -----------------------------------------------------------------------------

const selectedTexts = (
  appState: AppState,
  app: any,
): ExcalidrawTextElement[] => {
  const found = new Map<string, ExcalidrawTextElement>();
  for (const el of app.scene.getSelectedElements({
    selectedElementIds: appState.selectedElementIds,
    includeBoundTextElement: true,
  })) {
    if (isTextElement(el)) {
      found.set(el.id, el);
    }
  }
  if (appState.editingTextElement) {
    found.set(appState.editingTextElement.id, appState.editingTextElement);
  }
  return [...found.values()];
};

const BOLD = 700;

/** the faces texts set in library fonts will need, loaded before the text is measured */
const warmLibraryFaces = async (
  app: any,
  texts: readonly ExcalidrawTextElement[],
  next: (t: ExcalidrawTextElement) => {
    weight: number;
    italic: boolean;
    family?: string | null;
  },
) => {
  const named = texts.filter((t) => next(t).family ?? t.fontFamilyName);
  if (!named.length) {
    return;
  }
  await loadFontCatalogue();
  const faces: FontFace[] = [];
  for (const text of named) {
    const { weight, italic, family } = next(text);
    const font = findLibraryFont(family ?? text.fontFamilyName);
    if (font) {
      const face = await loadLibraryFace(
        font,
        pickLibraryStyle(font, weight, italic),
        app.ownerDocument,
      );
      if (face) {
        faces.push(face);
      }
    }
  }
  // texts measured with a stand-in so far are measured again
  app.fonts.onLoaded(faces);
};

/** one switch for the whole selection: off when all of it is already on */
const makeToggle = (
  name: "toggleBold" | "toggleItalic",
  label: string,
  key: string,
  isOn: (t: ExcalidrawTextElement) => boolean,
  patch: (on: boolean) => Record<string, unknown>,
) =>
  register({
    name,
    label,
    trackEvent: { category: "element" },
    predicate: (_elements, appState, _props, app) =>
      !appState.viewModeEnabled && selectedTexts(appState, app).length > 0,
    perform: (elements, appState, _value, app) => {
      const texts = selectedTexts(appState, app);
      const ids = new Set(texts.map((t) => t.id));
      const turnOn = !(texts.length > 0 && texts.every(isOn));
      const change = (all: readonly ExcalidrawElement[], state: AppState) => {
        const updated: ExcalidrawTextElement[] = [];
        const next = changeProperty(
          all,
          state,
          (element) => {
            if (!isTextElement(element) || !ids.has(element.id)) {
              return element;
            }
            const changed = newElementWith(element, patch(turnOn) as any);
            updated.push(changed);
            redrawTextBoundingBox(
              changed,
              app.scene.getContainerElement(changed),
              app.scene,
            );
            return changed;
          },
          true,
        );
        updated.forEach((el) =>
          updateBoundElements(el as NonDeletedExcalidrawElement, app.scene),
        );
        return {
          elements: next,
          appState: state,
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        };
      };
      if (!texts.some((t) => t.fontFamilyName)) {
        return change(elements, appState);
      }
      // a library font has its own bold and italic faces: they load first
      return (async () => {
        await warmLibraryFaces(app, texts, (t) => {
          const p = patch(turnOn) as {
            fontWeight?: number;
            fontStyle?: string;
          };
          return {
            weight: p.fontWeight ?? t.fontWeight ?? 400,
            italic: (p.fontStyle ?? t.fontStyle) === "italic",
          };
        });
        return change(app.scene.getElementsIncludingDeleted(), app.state);
      })();
    },
    keyTest: (event) =>
      event[KEYS.CTRL_OR_CMD] &&
      !event.shiftKey &&
      !event.altKey &&
      event.key.toLowerCase() === key,
  });

export const actionToggleBold = makeToggle(
  "toggleBold",
  "labels.bold",
  "b",
  (t) => (t.fontWeight ?? 400) >= 600,
  (on) => ({ fontWeight: on ? BOLD : 400 }),
);

export const actionToggleItalic = makeToggle(
  "toggleItalic",
  "labels.italic",
  "i",
  (t) => t.fontStyle === "italic",
  (on) => ({ fontStyle: on ? ("italic" as const) : ("normal" as const) }),
);

// -----------------------------------------------------------------------------
// library fonts
// -----------------------------------------------------------------------------

/** set the library font of the selected texts (null: back to the family they had) */
export const actionChangeLibraryFont = register<string | null>({
  name: "changeLibraryFont",
  label: "labels.libraryFont",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    const name = typeof value === "string" && value ? value : null;
    const texts = selectedTexts(appState, app);
    const ids = new Set(texts.map((t) => t.id));
    return (async () => {
      await warmLibraryFaces(app, texts, (t) => ({
        weight: t.fontWeight ?? 400,
        italic: t.fontStyle === "italic",
        family: name,
      }));
      const updated: ExcalidrawTextElement[] = [];
      const next = changeProperty(
        app.scene.getElementsIncludingDeleted(),
        app.state,
        (element) => {
          if (!isTextElement(element) || !ids.has(element.id)) {
            return element;
          }
          const changed = newElementWith(element, { fontFamilyName: name });
          updated.push(changed);
          redrawTextBoundingBox(
            changed,
            app.scene.getContainerElement(changed),
            app.scene,
          );
          return changed;
        },
        true,
      );
      updated.forEach((el) =>
        updateBoundElements(el as NonDeletedExcalidrawElement, app.scene),
      );
      return {
        elements: next,
        appState: { ...app.state, currentItemFontFamilyName: name },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      };
    })();
  },
});

const CATEGORY_LABELS: Record<string, string> = {
  "sans-serif": "Sans",
  serif: "Serif",
  display: "Display",
  monospace: "Mono",
  handwriting: "Hand",
};

/** the open-licence fonts shipped with the app, searchable, with each one's licence */
export const LibraryFontPicker = ({
  current,
  onSelect,
}: {
  current: string | null;
  onSelect: (name: string | null) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [fonts, setFonts] = useState<LibraryFont[] | null>(
    getLoadedCatalogue().length ? getLoadedCatalogue() : null,
  );
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [hovered, setHovered] = useState<LibraryFont | null>(null);

  useEffect(() => {
    if (open && fonts === null) {
      loadFontCatalogue().then(setFonts);
    }
  }, [open, fonts]);

  // a font shows itself when pointed at
  useEffect(() => {
    if (hovered) {
      loadLibraryFace(hovered, pickLibraryStyle(hovered));
    }
  }, [hovered]);

  const categories = ["all", ...new Set((fonts ?? []).map((f) => f.category))];
  const q = query.trim().toLowerCase();
  const list = (fonts ?? []).filter(
    (f) =>
      (category === "all" || f.category === category) &&
      (!q || f.family.toLowerCase().includes(q)),
  );
  const selected = findLibraryFont(current) ?? hovered;

  return (
    <div className="fontlib" data-testid="library-font-picker">
      <div className="inspector__row">
        <span className="inspector__label">{t("labels.libraryFont")}</span>
        <button
          type="button"
          className="fontlib__button"
          data-testid="library-font-button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          title={t("labels.libraryFont")}
        >
          <span className="fontlib__name">{current ?? "Choose…"}</span>
          <span aria-hidden="true">{open ? "▴" : "▾"}</span>
        </button>
      </div>
      {open && (
        <div className="fontlib__box" data-testid="library-font-list">
          <input
            autoFocus
            type="search"
            className="fontlib__search"
            value={query}
            placeholder={t("labels.libraryFontSearch")}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
          <div className="fontlib__cats">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
              >
                {c === "all" ? "All" : CATEGORY_LABELS[c] ?? c}
              </button>
            ))}
          </div>
          {selected && (
            <div
              className="fontlib__preview"
              data-testid="library-font-preview"
              style={{ fontFamily: `"${selected.family}"` }}
            >
              Hamburgefonstiv 0123
              <small>
                {selected.license} ·{" "}
                {selected.source.replace(/^https?:\/\//, "")}
              </small>
            </div>
          )}
          <div className="fontlib__list">
            {current && (
              <button
                type="button"
                className="fontlib__item"
                onClick={() => {
                  onSelect(null);
                  setOpen(false);
                }}
              >
                {t("labels.localFontClear")}
              </button>
            )}
            {fonts !== null && list.length === 0 && (
              <div className="fontlib__none">{t("labels.libraryFontNone")}</div>
            )}
            {list.map((font) => (
              <button
                key={font.id}
                type="button"
                className="fontlib__item"
                data-testid="library-font-item"
                aria-pressed={current === font.family}
                onMouseEnter={() => setHovered(font)}
                onClick={() => {
                  onSelect(font.family);
                  setOpen(false);
                }}
              >
                <span>{font.family}</span>
                <small>
                  {hasExactStyle(font, 700, false) ? "B" : ""}
                  {hasExactStyle(font, 400, true) ? " I" : ""}
                </small>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
