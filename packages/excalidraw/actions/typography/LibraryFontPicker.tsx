import { useEffect, useState } from "react";

import {
  findLibraryFont,
  getLoadedCatalogue,
  hasExactStyle,
  loadFontCatalogue,
  loadLibraryFace,
  pickLibraryStyle,
  type LibraryFont,
} from "../../fonts/library";
import { t } from "../../i18n";

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

  const categories = [
    "all",
    ...new Set((fonts ?? []).map((font) => font.category)),
  ];
  const needle = query.trim().toLowerCase();
  const list = (fonts ?? []).filter(
    (font) =>
      (category === "all" || font.category === category) &&
      (!needle || font.family.toLowerCase().includes(needle)),
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
          onClick={() => setOpen((isOpen) => !isOpen)}
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
            onChange={(changeEvent) => setQuery(changeEvent.target.value)}
            onKeyDown={(keyEvent) => keyEvent.stopPropagation()}
          />
          <div className="fontlib__cats">
            {categories.map((categoryName) => (
              <button
                key={categoryName}
                type="button"
                aria-pressed={category === categoryName}
                onClick={() => setCategory(categoryName)}
              >
                {categoryName === "all"
                  ? "All"
                  : CATEGORY_LABELS[categoryName] ?? categoryName}
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
