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
import {
  buildTemplate,
  TEMPLATES,
  templateShapes,
} from "../../symbols/templates";
import { SymbolPreview } from "../../symbols/SymbolPreview";
import {
  ALL_THEMES,
  colorScheme,
  TOKENS,
  MAX_RADIUS,
  type SymbolTheme,
} from "../../symbols/theme";
import { setSymbolTheme, useSymbolTheme } from "../../symbols/themeStore";

import { getSymbolMeta } from "../../symbols/build";
import { collectCodeItems } from "../../symbols/codeItems";
import { generateCode } from "../../symbols/codegen";
import { generateSceneCode } from "../../symbols/sceneCode";
import { generateResponsiveSceneCode } from "../../symbols/sceneLayout";
import {
  getLayout,
  getSelectedSymbol,
  type LayoutH,
  type LayoutV,
} from "../../symbols/stretch";

import {
  actionChangeBackgroundColor,
  actionChangeStrokeColor,
} from "../../actions";
import { addSwatches } from "../../palette";

import { ColorField } from "./ColorField";
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
    <div className="symbols__tokens">
      {TOKENS.map((tk) => (
        <div key={tk} className="symbols__token">
          <span>{tk}</span>
          <ColorField
            compact
            label={tk}
            testId={`symbols-token-${tk}`}
            value={theme.colors[tk]}
            onChange={(c) =>
              setSymbolTheme({ ...theme, colors: { ...theme.colors, [tk]: c } })
            }
          />
        </div>
      ))}
    </div>
  </div>
);

type LayoutKind = "auto" | "start" | "center" | "end" | "scale";

/**
 * a 20px icon: a frame, and where the content sits in it when the component is
 * stretched along an axis (drawn for each axis, not rotated)
 */
const LayoutIcon = ({
  kind,
  vertical,
}: {
  kind: LayoutKind;
  vertical?: boolean;
}) => {
  // a 16 x 12 frame; sizes are (along the axis, across it)
  const along = 16;
  const across = 12;
  const ox = vertical ? 4 : 2;
  const oy = vertical ? 2 : 4;
  const R = (a: number, c: number, la: number, lc: number) =>
    vertical
      ? { x: ox + c, y: oy + a, width: lc, height: la }
      : { x: ox + a, y: oy + c, width: la, height: lc };
  const L = (a1: number, c1: number, a2: number, c2: number) =>
    vertical
      ? { x1: ox + c1, y1: oy + a1, x2: ox + c2, y2: oy + a2 }
      : { x1: ox + a1, y1: oy + c1, x2: ox + a2, y2: oy + c2 };
  const block = 4;
  const thick = 6;
  const mid = (across - thick) / 2;
  const solid = { fill: "currentColor", stroke: "none" };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      aria-hidden="true"
    >
      <rect
        {...R(0, 0, along, across)}
        rx="1.5"
        strokeDasharray="2 2"
        opacity="0.55"
      />
      {kind === "auto" && (
        <>
          <rect {...R(1.5, mid, block, thick)} {...solid} />
          <rect {...R(along - 1.5 - block, mid, block, thick)} {...solid} />
          <line
            {...L(1.5 + block, across / 2, along - 1.5 - block, across / 2)}
          />
        </>
      )}
      {kind === "start" && (
        <rect {...R(1.5, mid, block + 1, thick)} {...solid} />
      )}
      {kind === "center" && (
        <rect
          {...R((along - block - 1) / 2, mid, block + 1, thick)}
          {...solid}
        />
      )}
      {kind === "end" && (
        <rect
          {...R(along - 1.5 - block - 1, mid, block + 1, thick)}
          {...solid}
        />
      )}
      {kind === "scale" && (
        <>
          <rect {...R(4, 3, along - 8, across - 6)} {...solid} opacity="0.85" />
          <line {...L(0.8, across / 2, 3.2, across / 2)} />
          <line {...L(along - 3.2, across / 2, along - 0.8, across / 2)} />
        </>
      )}
    </svg>
  );
};

const H_CHOICES: [LayoutH, LayoutKind, string][] = [
  [
    "auto",
    "auto",
    "Automatic: what spans grows, the rest goes to the nearest end",
  ],
  ["left", "start", "Everything that does not span stays at the left"],
  ["center", "center", "Everything that does not span stays centred"],
  ["right", "end", "Everything that does not span stays at the right"],
  ["scale", "scale", "Everything scales in proportion"],
];
const V_CHOICES: [LayoutV, LayoutKind, string][] = [
  [
    "auto",
    "auto",
    "Automatic: what spans grows, the rest goes to the nearest end",
  ],
  ["top", "start", "Everything that does not span stays at the top"],
  ["middle", "center", "Everything that does not span stays in the middle"],
  ["bottom", "end", "Everything that does not span stays at the bottom"],
  ["scale", "scale", "Everything scales in proportion"],
];

/** how the selected component re-lays out when it is stretched with Ctrl + drag */
export const SymbolLayoutSection = ({ app }: { app: App }) => {
  const selected = app.scene.getSelectedElements(app.state);
  const symbol = getSelectedSymbol(selected, app.scene.getNonDeletedElements());
  // one part of a component, picked inside its group
  const part =
    !symbol && selected.length === 1 && getSymbolMeta(selected[0])
      ? selected[0]
      : null;
  if (!symbol && !part) {
    return null;
  }
  const mutateMeta = (els: readonly any[], patch: Record<string, any>) => {
    for (const el of els) {
      app.scene.mutateElement(
        el,
        {
          customData: {
            ...el.customData,
            symbol: { ...el.customData?.symbol, ...patch },
          },
        },
        { informMutation: false, isDragging: false },
      );
    }
    app.scene.triggerUpdate();
    app.store.scheduleCapture();
  };
  if (part) {
    const meta = getSymbolMeta(part)!;
    return (
      <Section title="Layout" testId="symbols-layout">
        <label className="symbols__param">
          <span>Cover</span>
          <input
            type="checkbox"
            data-testid="symbols-cover"
            checked={!!meta.cover}
            onChange={(e) => mutateMeta([part], { cover: e.target.checked })}
          />
        </label>
        <p className="symbols__note">
          Locked to the clipping zone: this part always covers the whole
          component, however it is stretched.
        </p>
      </Section>
    );
  }
  const layout = getLayout(symbol!.members);
  const set = (patch: Partial<{ h: LayoutH; v: LayoutV }>) =>
    mutateMeta(symbol!.members, { layout: { ...layout, ...patch } });
  const row = (
    label: string,
    key: "h" | "v",
    choices: [string, LayoutKind, string][],
  ) => (
    <>
      <div className="symbols__layout-title">{label}</div>
      <div className="symbols__layout">
        {choices.map(([v, kind, title]) => (
          <button
            key={v}
            type="button"
            className="symbols__layout-btn"
            title={title}
            aria-label={title}
            data-testid={`symbols-layout-${key}-${v}`}
            aria-pressed={layout[key] === v}
            onClick={() => set({ [key]: v } as any)}
          >
            <LayoutIcon kind={kind} vertical={key === "v"} />
          </button>
        ))}
      </div>
    </>
  );
  return (
    <Section title="Layout" testId="symbols-layout">
      {row("When stretched sideways", "h", H_CHOICES)}
      {row("When stretched up or down", "v", V_CHOICES)}
      <p className="symbols__note">
        Ctrl + drag an edge to stretch. The frame flashes when it lines up with
        another component.
      </p>
    </Section>
  );
};

/** the colours a theme is made of, as a list to pick from and keep in the swatches */
const ReferenceColors = ({ app, theme }: { app: App; theme: SymbolTheme }) => {
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
  return (
    <div className="symbols__scheme" data-testid="symbols-scheme">
      <div className="symbols__row">
        {(["fill", "stroke"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={target === k}
            onClick={() => setTarget(k)}
          >
            {k === "fill" ? "Fill" : "Stroke"}
          </button>
        ))}
        <button
          type="button"
          data-testid="symbols-scheme-keep"
          onClick={() => {
            const n = addSwatches(
              colors.map((c) => ({
                name: `${theme.name} ${c.name}`,
                color: c.color,
              })),
            );
            setKept(`${n} colours added to the swatches.`);
          }}
        >
          Keep in swatches
        </button>
      </div>
      <div className="symbols__chips">
        {colors.map((c) => (
          <button
            key={c.name}
            type="button"
            className="symbols__chip"
            title={`${c.name} ${c.color}`}
            data-testid="symbols-scheme-color"
            style={{ background: c.color }}
            onClick={() => apply(c.color)}
          />
        ))}
      </div>
      {kept && <p className="symbols__note">{kept}</p>}
    </div>
  );
};

/** starting code for the symbols on the canvas: HTML and Jetpack Compose */
const CodeSection = ({ app }: { app: App }) => {
  const theme = useSymbolTheme();
  const [kind, setKind] = useState<"html" | "compose">("html");
  const [scope, setScope] = useState<"selection" | "all" | "scene" | "flow">(
    "selection",
  );
  const [text, setText] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const make = (k: "html" | "compose") => {
    if (scope === "scene" || scope === "flow") {
      const scene = (
        scope === "flow" ? generateResponsiveSceneCode : generateSceneCode
      )(app.scene.getNonDeletedElements(), theme);
      if (!scene) {
        setText("");
        setInfo("The canvas is empty.");
        return;
      }
      setKind(k);
      setText(k === "html" ? scene.html : scene.compose);
      setInfo(
        `${scene.count} parts on a ${scene.width} x ${
          scene.height
        } page. ${scene.notes.join(" ")}`,
      );
      return;
    }
    const selected = app.scene.getSelectedElements(app.state);
    const all = app.scene.getNonDeletedElements();
    // a selected group stands for all of its members
    const groups = new Set(selected.map((e) => e.groupIds[0]).filter(Boolean));
    const members =
      scope === "selection"
        ? all.filter(
            (e) =>
              selected.includes(e) ||
              (e.groupIds[0] && groups.has(e.groupIds[0])),
          )
        : all;
    const items = collectCodeItems(members);
    if (!items.length) {
      setText("");
      setInfo(
        scope === "selection"
          ? "Select symbols first."
          : "No symbols on the canvas.",
      );
      return;
    }
    const out = generateCode(items, theme);
    setKind(k);
    setText(k === "html" ? out.html : out.compose);
    setInfo(
      `${out.count} component${out.count === 1 ? "" : "s"}${
        out.unmapped.length
          ? `; no code yet for: ${[...new Set(out.unmapped)].join(", ")}`
          : ""
      }.`,
    );
  };
  return (
    <Section title="Code" testId="symbols-code">
      <div className="symbols__row">
        <label className="symbols__param" style={{ flex: 1 }}>
          <span>From</span>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as any)}
            data-testid="symbols-code-scope"
          >
            <option value="selection">the selection</option>
            <option value="all">every symbol (stacked)</option>
            <option value="flow">the whole canvas (rows and columns)</option>
            <option value="scene">the whole canvas (positioned)</option>
          </select>
        </label>
      </div>
      <div className="symbols__row">
        <button
          type="button"
          data-testid="symbols-code-html"
          onClick={() => make("html")}
        >
          HTML + CSS
        </button>
        <button
          type="button"
          data-testid="symbols-code-compose"
          onClick={() => make("compose")}
        >
          Jetpack Compose
        </button>
      </div>
      {info && <p className="symbols__note">{info}</p>}
      {text && (
        <>
          <textarea
            className="symbols__code"
            data-testid="symbols-code-text"
            readOnly
            value={text}
            onKeyDown={(e) => e.stopPropagation()}
          />
          <div className="symbols__row">
            <button
              type="button"
              data-testid="symbols-code-copy"
              onClick={() =>
                navigator.clipboard?.writeText(text).then(
                  () => setInfo("Copied."),
                  () => setInfo("Could not copy."),
                )
              }
            >
              Copy
            </button>
            <button
              type="button"
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob([text], { type: "text/plain" }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = kind === "html" ? "screen.html" : "Screen.kt";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              Save file
            </button>
          </div>
        </>
      )}
    </Section>
  );
};

/** UI components and icons in a theme: pick one, set its parameters, put it on the canvas */
export const SymbolsPanel = ({ app }: { app: App }) => {
  const theme = useSymbolTheme();
  const [mode, setMode] = useState<"components" | "icons" | "templates">(
    "components",
  );
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
      <CodeSection app={app} />
      <Section title="Theme" testId="symbols-theme-section">
        <ThemeEditor theme={theme} />
        <ReferenceColors app={app} theme={theme} />
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
        {(["components", "icons", "templates"] as const).map((m) => (
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
              : m === "icons"
              ? `Icons (${ICONS.length})`
              : `Screens (${TEMPLATES.length})`}
          </button>
        ))}
      </div>
      <input
        className="symbols__search"
        data-testid="symbols-search"
        placeholder={
          mode === "components"
            ? "Search components…"
            : mode === "icons"
            ? "Search icons…"
            : "Search screens…"
        }
        value={query}
        onKeyDown={(e) => e.stopPropagation()}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="symbols__cats" hidden={mode === "templates"}>
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

      {mode === "templates" ? (
        <div
          className="symbols__grid symbols__grid--screens"
          data-testid="symbols-templates"
        >
          {TEMPLATES.filter(
            (t) => !q || `${t.name} ${t.tags}`.toLowerCase().includes(q),
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              className="symbols__tile"
              data-testid="symbols-template"
              title={`${t.name}: ${t.parts.length} parts, each one editable`}
              onClick={() => insert(buildTemplate(t, theme))}
            >
              <SymbolPreview
                shapes={templateShapes(t, theme)}
                theme={theme}
                width={136}
                height={190}
              />
              <span>{t.name}</span>
            </button>
          ))}
        </div>
      ) : mode === "components" ? (
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
              <button
                type="button"
                className="symbols__replace"
                data-testid="symbols-replace"
                disabled={app.symbols.replaceable().length === 0}
                title="Each selected shape becomes this component, keeping its text as the label and its links"
                onClick={() => {
                  const n = app.symbols.replace(
                    pickedDef.id,
                    values[pickedDef.id] ?? {},
                    theme,
                  );
                  setNote(`${n} shape${n === 1 ? "" : "s"} replaced.`);
                }}
              >
                Replace selected shapes
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
