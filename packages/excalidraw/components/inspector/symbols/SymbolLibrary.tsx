import { useMemo, useState } from "react";

import {
  COMPONENTS,
  COMPONENT_CATEGORIES,
  ICONS,
  ICON_CATEGORIES,
  ILLUSTRATIONS,
  TEMPLATES,
  buildElements,
  defaultsOf,
  type ComponentDef,
  type SymbolTheme,
  type Values,
} from "@excalidraw/symbols";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  ArtGrid,
  ComponentsView,
  IconsView,
  TemplateGrid,
} from "./LibraryViews";

import type App from "../../App";

type Mode = "components" | "icons" | "templates" | "art";

const MODES: Mode[] = ["components", "icons", "templates", "art"];

const modeLabel = (mode: Mode) =>
  ({
    components: `Components (${COMPONENTS.length})`,
    icons: `Icons (${ICONS.length})`,
    templates: `Screens (${TEMPLATES.length})`,
    art: `Art (${ILLUSTRATIONS.length})`,
  }[mode]);

const SEARCH_PLACEHOLDER: Record<Mode, string> = {
  components: "Search components…",
  icons: "Search icons…",
  art: "Search illustrations…",
  templates: "Search screens…",
};

/** UI components, icons, screens and art in a theme: pick one and put it on the canvas. */
export const SymbolLibrary = ({
  app,
  theme,
  onNote,
}: {
  app: App;
  theme: SymbolTheme;
  onNote: (note: string) => void;
}) => {
  const [mode, setMode] = useState<Mode>("components");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, Values>>({});
  const [iconSize, setIconSize] = useState(32);

  const search = query.trim().toLowerCase();
  const components = useMemo(
    () =>
      COMPONENTS.filter(
        (component) =>
          (category === "All" || component.category === category) &&
          (!search ||
            `${component.name} ${component.tags ?? ""} ${component.category}`
              .toLowerCase()
              .includes(search)),
      ),
    [category, search],
  );
  const icons = useMemo(
    () =>
      ICONS.filter(
        (icon) =>
          (category === "All" || icon.category === category) &&
          (!search ||
            `${icon.name} ${icon.tags ?? ""}`.toLowerCase().includes(search)),
      ),
    [category, search],
  );

  const picked =
    COMPONENTS.find((component) => component.id === pickedId) ?? null;
  const valuesOf = (def: ComponentDef): Values => ({
    ...defaultsOf(def),
    ...values[def.id],
  });

  const insert = (elements: readonly ExcalidrawElement[]) => {
    if (!elements.length) {
      return;
    }
    app.addElementsFromPasteOrLibrary({
      elements,
      files: null,
      position: "center",
    });
  };

  const insertComponent = (def: ComponentDef) =>
    insert(
      buildElements(
        def.shapes(theme, valuesOf(def)),
        theme,
        { x: 0, y: 0 },
        def.id,
      ),
    );

  const insertIcon = (name: string) =>
    insert(
      buildElements(
        [{ t: "icon", name, x: 0, y: 0, size: iconSize, s: "text" }],
        theme,
        { x: 0, y: 0 },
        `icon:${name}`,
      ),
    );

  const categories = [
    "All",
    ...(mode === "components" ? COMPONENT_CATEGORIES : ICON_CATEGORIES),
  ];

  return (
    <div className="symbols__library">
      <div className="symbols__modes" role="tablist">
        {MODES.map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={mode === option}
            data-testid={`symbols-mode-${option}`}
            onClick={() => {
              setMode(option);
              setCategory("All");
            }}
          >
            {modeLabel(option)}
          </button>
        ))}
      </div>
      <input
        className="inspector__text symbols__search"
        data-testid="symbols-search"
        placeholder={SEARCH_PLACEHOLDER[mode]}
        value={query}
        onKeyDown={(event) => event.stopPropagation()}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div
        className="symbols__cats"
        hidden={mode === "templates" || mode === "art"}
      >
        {categories.map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={category === name}
            onClick={() => setCategory(name)}
          >
            {name}
          </button>
        ))}
      </div>

      {mode === "art" && <ArtGrid query={search} insert={insert} />}
      {mode === "templates" && (
        <TemplateGrid query={search} theme={theme} insert={insert} />
      )}
      {mode === "components" && (
        <ComponentsView
          app={app}
          theme={theme}
          components={components}
          picked={picked}
          values={values}
          valuesOf={valuesOf}
          onPick={setPickedId}
          onChangeValue={(componentId, key, value) =>
            setValues((all) => ({
              ...all,
              [componentId]: { ...all[componentId], [key]: value },
            }))
          }
          onInsert={insertComponent}
          onNote={onNote}
        />
      )}
      {mode === "icons" && (
        <IconsView
          theme={theme}
          icons={icons}
          iconSize={iconSize}
          onSizeChange={setIconSize}
          onInsert={insertIcon}
        />
      )}
    </div>
  );
};
