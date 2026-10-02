import { useEffect, useMemo, useRef, useState } from "react";

import { buildElements, shapesOf, themeUpdates } from "../../symbols/build";
import {
  COMPONENT_CATEGORIES,
  COMPONENTS,
  defaultsOf,
  type ComponentDef,
  type Param,
  type Values,
} from "../../symbols/components";
import { ICON_CATEGORIES, ICONS } from "../../symbols/icons";
import { SymbolPreview } from "../../symbols/SymbolPreview";
import {
  ALL_THEMES,
  TOKENS,
  MAX_RADIUS,
  type SymbolTheme,
} from "../../symbols/theme";
import { setSymbolTheme, useSymbolTheme } from "../../symbols/themeStore";

import {
  getLayout,
  getSelectedSymbol,
  type LayoutH,
  type LayoutV,
} from "../../symbols/stretch";

import { Section } from "./primitives";

import type App from "../App";

const ParamField = ({
  param,
  value,
  onChange,
}: {
  param: Param;
  value: any;
  onChange: (v: any) => void;
}) => (
  <label className="symbols__param">
    <span>{param.label}</span>
    {param.kind === "bool" ? (
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
      />
    ) : param.kind === "choice" ? (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {param.options!.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    ) : param.kind === "number" ? (
      <input
        type="number"
        min={param.min}
        max={param.max}
        value={value}
        onKeyDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) {
            onChange(Math.min(param.max ?? n, Math.max(param.min ?? n, n)));
          }
        }}
      />
    ) : (
      <input
        type="text"
        value={value}
        onKeyDown={(e) => e.stopPropagation()}
        onChange={(e) => onChange(e.target.value)}
      />
    )}
  </label>
);

const ThemeEditor = ({ theme }: { theme: SymbolTheme }) => (
  <div className="symbols__theme" data-testid="symbols-theme">
    <label className="symbols__param">
      <span>Theme</span>
      <select
        data-testid="symbols-theme-preset"
        value={ALL_THEMES.some((t) => t.name === theme.name) ? theme.name : ""}
        onChange={(e) => {
          const t = ALL_THEMES.find((x) => x.name === e.target.value);
          if (t) {
            setSymbolTheme(t);
          }
        }}
      >
        {!ALL_THEMES.some((t) => t.name === theme.name) && (
          <option value="">{theme.name}</option>
        )}
        {ALL_THEMES.map((t) => (
          <option key={t.name} value={t.name}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
    <label className="symbols__param">
      <span>Corners</span>
      <input
        type="range"
        data-testid="symbols-radius-range"
        min={0}
        max={MAX_RADIUS}
        value={theme.radius}
        onChange={(e) =>
          setSymbolTheme({ ...theme, radius: Number(e.target.value) })
        }
      />
      <input
        type="number"
        className="symbols__num"
        data-testid="symbols-radius"
        min={0}
        value={theme.radius}
        onKeyDown={(e) => e.stopPropagation()}
        onChange={(e) =>
          Number.isFinite(Number(e.target.value)) &&
          setSymbolTheme({
            ...theme,
            radius: Math.max(0, Number(e.target.value)),
          })
        }
      />
    </label>
    <label className="symbols__param">
      <span>Stroke</span>
      <input
        type="number"
        data-testid="symbols-stroke"
        min={0.5}
        step={0.5}
        value={theme.stroke}
        onKeyDown={(e) => e.stopPropagation()}
        onChange={(e) =>
          Number(e.target.value) > 0 &&
          setSymbolTheme({ ...theme, stroke: Number(e.target.value) })
        }
      />
    </label>
    <div className="symbols__swatches">
      {TOKENS.map((tk) => (
        <label key={tk} title={tk} className="symbols__swatch">
          <input
            type="color"
            value={theme.colors[tk]}
            onChange={(e) =>
              setSymbolTheme({
                ...theme,
                colors: { ...theme.colors, [tk]: e.target.value },
              })
            }
          />
          <span>{tk}</span>
        </label>
      ))}
    </div>
  </div>
);

const H_CHOICES: [LayoutH, string][] = [
  ["auto", "Auto"],
  ["left", "Left"],
  ["center", "Center"],
  ["right", "Right"],
  ["scale", "Scale"],
];
const V_CHOICES: [LayoutV, string][] = [
  ["auto", "Auto"],
  ["top", "Top"],
  ["middle", "Middle"],
  ["bottom", "Bottom"],
  ["scale", "Scale"],
];

/** how the selected component re-lays out when it is stretched with Ctrl + drag */
export const SymbolLayoutSection = ({ app }: { app: App }) => {
  const symbol = getSelectedSymbol(
    app.scene.getSelectedElements(app.state),
    app.scene.getNonDeletedElements(),
  );
  if (!symbol) {
    return null;
  }
  const layout = getLayout(symbol.members);
  const set = (patch: Partial<{ h: LayoutH; v: LayoutV }>) => {
    const next = { ...layout, ...patch };
    for (const el of symbol.members) {
      app.scene.mutateElement(
        el as any,
        {
          customData: {
            ...el.customData,
            symbol: { ...el.customData?.symbol, layout: next },
          },
        },
        { informMutation: false, isDragging: false },
      );
    }
    app.scene.triggerUpdate();
    app.store.scheduleCapture();
  };
  const row = (label: string, key: "h" | "v", choices: [string, string][]) => (
    <div className="symbols__layout">
      <span>{label}</span>
      {choices.map(([v, name]) => (
        <button
          key={v}
          type="button"
          data-testid={`symbols-layout-${key}-${v}`}
          aria-pressed={layout[key] === v}
          onClick={() => set({ [key]: v } as any)}
        >
          {name}
        </button>
      ))}
    </div>
  );
  return (
    <Section title="Layout" testId="symbols-layout">
      {row("Across", "h", H_CHOICES)}
      {row("Down", "v", V_CHOICES)}
      <p className="symbols__note">
        Ctrl + drag a handle stretches it: what spans grows, the rest keeps its
        place. The frame flashes when it lines up with another component.
      </p>
    </Section>
  );
};

/** UI components and icons in a theme: pick one, set its parameters, put it on the canvas */
export const SymbolsPanel = ({ app }: { app: App }) => {
  const theme = useSymbolTheme();
  const [mode, setMode] = useState<"components" | "icons">("components");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [picked, setPicked] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, Values>>({});
  const [iconSize, setIconSize] = useState(32);
  const [note, setNote] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const components = useMemo(
    () =>
      COMPONENTS.filter(
        (c) =>
          (category === "All" || c.category === category) &&
          (!q ||
            `${c.name} ${c.tags ?? ""} ${c.category}`
              .toLowerCase()
              .includes(q)),
      ),
    [category, q],
  );
  const icons = useMemo(
    () =>
      ICONS.filter(
        (i) =>
          (category === "All" || i.category === category) &&
          (!q || `${i.name} ${i.tags ?? ""}`.toLowerCase().includes(q)),
      ),
    [category, q],
  );

  const pickedDef = COMPONENTS.find((c) => c.id === picked) ?? null;
  const valuesOf = (def: ComponentDef): Values => ({
    ...defaultsOf(def),
    ...values[def.id],
  });

  const insert = (elements: ReturnType<typeof buildElements>) => {
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

  const retheme = (all: boolean) => {
    const pool = all
      ? app.scene.getNonDeletedElements()
      : app.scene.getSelectedElements(app.state);
    const updates = themeUpdates(pool, theme);
    if (!updates.length) {
      setNote(all ? "No symbols on the canvas." : "Select symbols first.");
      return;
    }
    for (const { element, updates: u } of updates) {
      app.scene.mutateElement(element, u as any, {
        informMutation: false,
        isDragging: false,
      });
    }
    // one redraw for all of them: without it the canvas shows the change only when touched
    app.scene.triggerUpdate();
    app.store.scheduleCapture();
    setNote(`Applied "${theme.name}" to ${updates.length} shapes.`);
  };

  // the theme is live: changing it restyles every symbol on the canvas at once
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const updates = themeUpdates(app.scene.getNonDeletedElements(), theme);
    if (updates.length) {
      for (const { element, updates: u } of updates) {
        app.scene.mutateElement(element, u as any, {
          informMutation: false,
          isDragging: false,
        });
      }
      app.scene.triggerUpdate();
      app.store.scheduleCapture();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  const cats = [
    "All",
    ...(mode === "components" ? COMPONENT_CATEGORIES : ICON_CATEGORIES),
  ];

  return (
    <div className="symbols" data-testid="symbols-panel">
      <SymbolLayoutSection app={app} />
      <Section title="Theme" testId="symbols-theme-section">
        <ThemeEditor theme={theme} />
        <div className="symbols__row">
          <button
            type="button"
            data-testid="symbols-apply-selection"
            onClick={() => retheme(false)}
          >
            Apply to selection
          </button>
          <button
            type="button"
            data-testid="symbols-apply-all"
            onClick={() => retheme(true)}
          >
            Apply to all symbols
          </button>
        </div>
        {note && <p className="symbols__note">{note}</p>}
      </Section>

      <div className="symbols__modes" role="tablist">
        {(["components", "icons"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            data-testid={`symbols-mode-${m}`}
            onClick={() => {
              setMode(m);
              setCategory("All");
            }}
          >
            {m === "components"
              ? `Components (${COMPONENTS.length})`
              : `Icons (${ICONS.length})`}
          </button>
        ))}
      </div>
      <input
        className="symbols__search"
        data-testid="symbols-search"
        placeholder={
          mode === "components" ? "Search components…" : "Search icons…"
        }
        value={query}
        onKeyDown={(e) => e.stopPropagation()}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="symbols__cats">
        {cats.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {mode === "components" ? (
        <>
          {pickedDef && (
            <div className="symbols__detail" data-testid="symbols-detail">
              <strong>{pickedDef.name}</strong>
              <SymbolPreview
                shapes={pickedDef.shapes(theme, valuesOf(pickedDef))}
                theme={theme}
                width={300}
                height={170}
              />
              {(pickedDef.params ?? []).map((p) => (
                <ParamField
                  key={p.key}
                  param={p}
                  value={valuesOf(pickedDef)[p.key]}
                  onChange={(v) =>
                    setValues((all) => ({
                      ...all,
                      [pickedDef.id]: { ...all[pickedDef.id], [p.key]: v },
                    }))
                  }
                />
              ))}
              <button
                type="button"
                className="symbols__insert"
                data-testid="symbols-insert"
                onClick={() => insertComponent(pickedDef)}
              >
                Insert on canvas
              </button>
            </div>
          )}
          <div className="symbols__grid" data-testid="symbols-grid">
            {components.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`symbols__tile${
                  picked === c.id ? " is-picked" : ""
                }`}
                data-testid="symbols-tile"
                title={c.name}
                onClick={() => setPicked(c.id)}
                onDoubleClick={() => insertComponent(c)}
              >
                <SymbolPreview
                  shapes={c.shapes(theme, valuesOf(c))}
                  theme={theme}
                  width={136}
                  height={84}
                />
                <span>{c.name}</span>
              </button>
            ))}
            {components.length === 0 && (
              <p className="symbols__note">Nothing matches.</p>
            )}
          </div>
        </>
      ) : (
        <>
          <label className="symbols__param">
            <span>Size</span>
            <input
              type="number"
              min={8}
              max={256}
              value={iconSize}
              onKeyDown={(e) => e.stopPropagation()}
              onChange={(e) =>
                Number(e.target.value) > 0 &&
                setIconSize(Number(e.target.value))
              }
            />
          </label>
          <div className="symbols__icons" data-testid="symbols-icons">
            {icons.map((i) => (
              <button
                key={i.name}
                type="button"
                className="symbols__icon"
                data-testid="symbols-icon"
                title={i.name}
                onClick={() => insertIcon(i.name)}
              >
                <SymbolPreview
                  shapes={[
                    {
                      t: "icon",
                      name: i.name,
                      x: 0,
                      y: 0,
                      size: 24,
                      s: "text",
                    },
                  ]}
                  theme={theme}
                  width={40}
                  height={40}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
