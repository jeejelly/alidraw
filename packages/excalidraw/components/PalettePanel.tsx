import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { getBoundTextElement, isTextElement } from "@excalidraw/element";

import {
  actionChangeBackgroundColor,
  actionChangeFontSizeInput,
  actionTextToVectors,
  actionChangeOpacity,
  actionChangeSloppiness,
  actionChangeStrokeColor,
  actionChangeStrokeStyle,
  actionChangeStrokeWidthValue,
  actionSendBackward,
  actionBringForward,
  actionSendToBack,
  actionBringToFront,
  actionToggleElementLock,
} from "../actions";
import { t } from "../i18n";
import { getTargetElements } from "../scene";
import { getShapeActionPredicates } from "./shapeActionPredicates";
import {
  addSwatch,
  addSwatches,
  getPaletteState,
  normalizeHex,
  parsePaletteFile,
  PANEL_MARGIN,
  snapPanel,
  removeSwatch,
  serializeAse,
  serializeGpl,
  moveSwatch,
  setSwatchColor,
  renameSwatch,
  setLayersDetached,
  setLayersPosition,
  setPaletteHeight,
  setPaletteWidth,
  DEFAULT_PALETTE_STATE,
  setPaletteLayout,
  setPalettePosition,
  subscribePalette,
} from "../palette";

import Angle from "./Stats/Angle";
import Dimension from "./Stats/Dimension";
import { useHostPaletteTabs } from "../hostPalette";
import { ColorField } from "./inspector/ColorField";
import { FlowPanel } from "./inspector/FlowPanel";
import { ModesSection } from "./inspector/ModesSection";
import { SymbolLayoutSection, SymbolsPanel } from "./inspector/SymbolsPanel";
import { LayersTree } from "./inspector/LayersTree";
import MultiAngle from "./Stats/MultiAngle";
import MultiDimension from "./Stats/MultiDimension";
import MultiPosition from "./Stats/MultiPosition";
import Position from "./Stats/Position";
import { getAtomicUnits } from "./Stats/utils";
import "./inspector/Inspector.scss";
import { PaletteScroll } from "./inspector/PaletteScroll";
import {
  AlignSection,
  CornersSection,
  ImageStorageSection,
  VectorizeSection,
  PathSection,
  ToolsSection,
  AnchorSection,
  GridSection,
  PathfinderSection,
} from "./inspector/LayoutSections";
import {
  NumberPill,
  Section,
  Segmented,
  SliderRow,
} from "./inspector/primitives";

import type App from "./App";

type Target = "stroke" | "background";
type Tab = "design" | "layers" | "flow" | "symbols" | `host:${string}`;

export const INSPECTOR_FOCUS_TRANSFORM = "excalidraw:inspector-focus-transform";

const DEFAULT_STROKE = "#1e1e1e";

const layerName = (el: { type: string; text?: string }) =>
  el.type === "text" && el.text
    ? el.text.split("\n")[0].slice(0, 40)
    : t(`element.${el.type}` as any) || el.type;

const LAYER_GLYPH: Record<string, string> = {
  rectangle: "▭",
  diamond: "◇",
  ellipse: "◯",
  arrow: "→",
  line: "╱",
  freedraw: "✎",
  path: "✒",
  text: "T",
  image: "▣",
  frame: "#",
  magicframe: "#",
  stickynote: "▤",
  embeddable: "⧉",
  iframe: "⧉",
};

/**
 * The inspector: one panel for everything about the selection, grouped the
 * way designers look for it — Transform, Appearance (fill & stroke, opacity),
 * Swatches, Stroke, Type — plus a Layers tab. Docked to the right or floating
 * (horizontal strip / vertical column). Swatches are named, saved across
 * sessions and importable from .ase / .gpl.
 */
const SwatchIcon = ({
  kind,
}: {
  kind: "plus" | "pencil" | "upload" | "trash" | "download";
}) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {kind === "plus" && <path d="M12 5v14M5 12h14" />}
    {kind === "pencil" && <path d="M4 20l1-5L16 4l4 4L9 19zM14 6l4 4" />}
    {kind === "upload" && <path d="M12 16V5M7 9.5L12 4.5l5 5M4 20h16" />}
    {kind === "download" && <path d="M12 4v11M7 10.5l5 5 5-5M4 20h16" />}
    {kind === "trash" && (
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
    )}
  </svg>
);

const rectOf = (el: Element | null) => {
  const r = el?.getBoundingClientRect();
  return r && r.width
    ? { x: r.left, y: r.top, width: r.width, height: r.height }
    : null;
};

/** where a panel dragged to (x, y) ends up: clamped, then snapped (Alt: free) */
const placePanel = (
  x: number,
  y: number,
  el: Element | null,
  otherTestId: string,
  alt: boolean,
) => {
  const size = rectOf(el);
  const cx = Math.max(0, Math.min(window.innerWidth - 60, x));
  const cy = Math.max(0, Math.min(window.innerHeight - 40, y));
  if (!size || alt) {
    return { x: cx, y: cy, edge: { right: false } };
  }
  const other = rectOf(
    document.querySelector(`[data-testid="${otherTestId}"]`),
  );
  return snapPanel({ ...size, x: cx, y: cy }, other ? [other] : [], {
    width: window.innerWidth,
    height: window.innerHeight,
  });
};

export const PalettePanel = ({ app }: { app: App }) => {
  const palette = useSyncExternalStore(subscribePalette, getPaletteState);
  const [tab, setTab] = useState<Tab>("design");
  const hostTabs = useHostPaletteTabs();
  const [target, setTarget] = useState<Target>("stroke");
  const [managing, setManaging] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const editSwatch =
    palette.swatches.find((x) => x.id === editId) ??
    palette.swatches[0] ??
    null;
  const [message, setMessage] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  // the scene mutates elements in place: repaint on any change
  useEffect(() => {
    const off = app.scene.onUpdate(() => setTick((n) => n + 1));
    return () => {
      try {
        off();
      } catch {
        // scene destroyed first
      }
    };
  }, [app]);

  // Ctrl+T: jump to the transform fields
  useEffect(() => {
    const focus = () => {
      setTab("design");
      requestAnimationFrame(() => {
        rootRef.current
          ?.querySelector<HTMLInputElement>(
            '[data-testid="W"] input, [data-testid="W"]',
          )
          ?.focus();
      });
    };
    window.addEventListener(INSPECTOR_FOCUS_TRANSFORM, focus);
    return () => window.removeEventListener(INSPECTOR_FOCUS_TRANSFORM, focus);
  }, []);

  const { actionManager } = app;
  const run = (action: any, value?: unknown) =>
    actionManager.executeAction(action, "ui", value);

  const selected = app.scene.getSelectedElements(app.state);
  const first = selected[0];
  const single = selected.length === 1 ? selected[0] : null;
  const strokeColor = first?.strokeColor ?? app.state.currentItemStrokeColor;
  const backgroundColor =
    first?.backgroundColor ?? app.state.currentItemBackgroundColor;
  const currentColor = target === "stroke" ? strokeColor : backgroundColor;
  const hex = normalizeHex(currentColor);
  // a shape's own label counts: its type controls belong to the shape
  const textEl =
    selected.find(isTextElement) ??
    selected
      .map((el) =>
        getBoundTextElement(el, app.scene.getNonDeletedElementsMap()),
      )
      .find(Boolean) ??
    null;
  const hasSelection = selected.length > 0;

  const applyColor = (color: string, which: Target = target) =>
    run(
      which === "stroke"
        ? actionChangeStrokeColor
        : actionChangeBackgroundColor,
      { color },
    );

  const layout = palette.layout;
  const docked = layout === "docked";
  const pos = palette.position;

  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) {
      return;
    }
    let origin = pos;
    if (docked) {
      // dragging a docked panel tears it off where it is
      const rect = rootRef.current?.getBoundingClientRect();
      origin = { x: rect?.left ?? pos.x, y: rect?.top ?? pos.y };
      setPaletteLayout("vertical");
      setPalettePosition(origin);
    }
    drag.current = { dx: e.clientX - origin.x, dy: e.clientY - origin.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const moveDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) {
      return;
    }
    const { x, y } = placePanel(
      e.clientX - drag.current.dx,
      e.clientY - drag.current.dy,
      rootRef.current,
      "layers-panel",
      e.altKey,
    );
    setPalettePosition({ x, y });
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) {
      return;
    }
    drag.current = null;
    // let go against the right edge: the panel docks there again
    const size = rectOf(rootRef.current);
    if (
      !e.altKey &&
      size &&
      Math.abs(window.innerWidth - size.width - PANEL_MARGIN - size.x) < 1
    ) {
      setPaletteLayout("docked");
    }
  };

  /** the swatches as a palette file other tools read */
  const saveSwatches = (format: "gpl" | "ase") => {
    const colors = palette.swatches.map((x) => ({
      name: x.name,
      color: x.color,
    }));
    const blob = new Blob(
      [
        format === "gpl"
          ? serializeGpl(colors, "Swatches")
          : serializeAse(colors),
      ],
      { type: "application/octet-stream" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `swatches.${format}`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(`${colors.length} swatches exported.`);
  };

  const onImport = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    const colors = await parsePaletteFile(file);
    const added = colors.length ? addSwatches(colors) : 0;
    setMessage(
      colors.length
        ? t("labels.palette.imported", { count: added })
        : t("labels.palette.importFailed"),
    );
  };

  const className = [
    "inspector",
    docked ? "inspector--docked" : "inspector--floating",
    layout === "horizontal" ? "inspector--horizontal" : "",
  ].join(" ");

  // ---------------------------------------------------------------------------

  const transform = single && (
    <Section title={t("labels.palette.transform")} testId="inspector-transform">
      <div className="inspector__grid">
        <Position
          property="x"
          element={single}
          elementsMap={app.scene.getNonDeletedElementsMap()}
          scene={app.scene}
          appState={app.state}
        />
        <Position
          property="y"
          element={single}
          elementsMap={app.scene.getNonDeletedElementsMap()}
          scene={app.scene}
          appState={app.state}
        />
        <Dimension
          property="width"
          element={single}
          scene={app.scene}
          appState={app.state}
        />
        <Dimension
          property="height"
          element={single}
          scene={app.scene}
          appState={app.state}
        />
        <Angle
          property="angle"
          element={single}
          scene={app.scene}
          appState={app.state}
        />
      </div>
    </Section>
  );

  // several shapes: the fields set every shape (mixed values read as "Mixed")
  const multi = selected.length > 1 && (
    <Section title={t("labels.palette.transform")} testId="inspector-transform">
      <div className="inspector__grid">
        {(["x", "y"] as const).map((property) => (
          <MultiPosition
            key={property}
            property={property}
            elements={selected}
            elementsMap={app.scene.getNonDeletedElementsMap()}
            atomicUnits={getAtomicUnits(selected, app.state)}
            scene={app.scene}
            appState={app.state}
          />
        ))}
        {(["width", "height"] as const).map((property) => (
          <MultiDimension
            key={property}
            property={property}
            elements={selected}
            elementsMap={app.scene.getNonDeletedElementsMap()}
            atomicUnits={getAtomicUnits(selected, app.state)}
            scene={app.scene}
            appState={app.state}
          />
        ))}
        <MultiAngle
          property="angle"
          elements={selected}
          scene={app.scene}
          appState={app.state}
        />
      </div>
    </Section>
  );

  const appearance = (
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
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const color = e.dataTransfer.getData("text/swatch-color");
              if (color) {
                e.preventDefault();
                applyColor(color, "background");
              }
            }}
            aria-pressed={target === "background"}
            aria-label={t("labels.background")}
            title={t("labels.background")}
            style={{
              background:
                backgroundColor === "transparent" ? undefined : backgroundColor,
            }}
            onClick={() => setTarget("background")}
          />
          <button
            type="button"
            className="inspector__well inspector__well--stroke"
            data-testid="palette-target-stroke"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const color = e.dataTransfer.getData("text/swatch-color");
              if (color) {
                e.preventDefault();
                applyColor(color, "stroke");
              }
            }}
            aria-pressed={target === "stroke"}
            aria-label={t("labels.stroke")}
            title={t("labels.stroke")}
            style={{
              borderColor:
                strokeColor === "transparent" ? "#c9c9c9" : strokeColor,
            }}
            onClick={() => setTarget("stroke")}
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
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              onBlur={(e) => {
                const v = normalizeHex(e.target.value);
                if (v && v !== hex) {
                  applyColor(v);
                }
              }}
            />
            <input
              type="color"
              aria-label={t("labels.palette.pick")}
              value={hex ?? "#000000"}
              onChange={(e) => applyColor(e.target.value)}
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
        value={first?.opacity ?? app.state.currentItemOpacity}
        min={0}
        max={100}
        unit="%"
        onChange={(v) => run(actionChangeOpacity, v)}
      />
    </Section>
  );

  const swatches = (
    <Section
      title={t("labels.palette.swatches")}
      hint={`${palette.swatches.length}`}
      testId="inspector-swatches"
    >
      <div
        data-testid="palette-swatches"
        className="inspector__swatches"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          // dropped on the empty part: to the end of the list
          const id = e.dataTransfer.getData("text/swatch-id");
          if (id) {
            moveSwatch(id, null);
          }
        }}
      >
        {palette.swatches.length === 0 && (
          <span className="inspector__hint">{t("labels.palette.empty")}</span>
        )}
        {palette.swatches.map((s) => (
          <button
            key={s.id}
            type="button"
            draggable
            className={`inspector__swatch${
              managing && editSwatch?.id === s.id ? " is-picked" : ""
            }`}
            data-testid="palette-swatch"
            title={`${s.name} ${s.color}`}
            style={{ background: s.color }}
            onDragStart={(e) => {
              e.dataTransfer.setData("text/swatch-id", s.id);
              e.dataTransfer.setData("text/swatch-color", s.color);
              e.dataTransfer.effectAllowed = "copyMove";
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.stopPropagation();
              const id = e.dataTransfer.getData("text/swatch-id");
              if (id) {
                moveSwatch(id, s.id);
              }
            }}
            onClick={() => (managing ? setEditId(s.id) : applyColor(s.color))}
          />
        ))}
      </div>
      {managing && editSwatch && (
        <div
          className="inspector__swatch-editor"
          data-testid="palette-swatch-editor"
        >
          <ColorField
            value={editSwatch.color}
            testId="palette-swatch-hex"
            label={t("labels.palette.pick")}
            onChange={(c) => setSwatchColor(editSwatch.id, c)}
          />
          <div className="inspector__row" style={{ marginTop: 0 }}>
            <input
              className="inspector__text"
              data-testid="palette-swatch-name"
              key={editSwatch.id}
              defaultValue={editSwatch.name}
              onBlur={(e) => renameSwatch(editSwatch.id, e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
            <button
              type="button"
              className="inspector__iconbtn inspector__iconbtn--lg"
              data-testid="palette-swatch-remove"
              aria-label={t("labels.palette.remove")}
              title={t("labels.palette.remove")}
              onClick={() => {
                removeSwatch(editSwatch.id);
                setEditId(null);
              }}
            >
              <SwatchIcon kind="trash" />
            </button>
          </div>
        </div>
      )}
      <div className="inspector__row">
        <button
          type="button"
          className="inspector__iconbtn inspector__iconbtn--lg"
          data-testid="palette-add"
          title={t("labels.palette.add")}
          aria-label={t("labels.palette.add")}
          disabled={!hex}
          onClick={() => {
            const added = hex && addSwatch(hex);
            if (added) {
              setManaging(true);
              setEditId(added.id);
            }
          }}
        >
          <SwatchIcon kind="plus" />
        </button>
        <button
          type="button"
          className="inspector__iconbtn inspector__iconbtn--lg"
          data-testid="palette-manage"
          aria-pressed={managing}
          title={managing ? t("labels.palette.done") : t("labels.palette.edit")}
          aria-label={
            managing ? t("labels.palette.done") : t("labels.palette.edit")
          }
          onClick={() => setManaging((m) => !m)}
        >
          <SwatchIcon kind="pencil" />
        </button>
        <button
          type="button"
          className="inspector__iconbtn inspector__iconbtn--lg"
          data-testid="palette-import"
          title={t("labels.palette.import")}
          aria-label={t("labels.palette.import")}
          onClick={() => fileRef.current?.click()}
        >
          <SwatchIcon kind="upload" />
        </button>
        <button
          type="button"
          className="inspector__iconbtn inspector__iconbtn--lg"
          data-testid="palette-export"
          title="Export the swatches as .gpl"
          aria-label="Export the swatches as .gpl"
          disabled={palette.swatches.length === 0}
          onClick={() => saveSwatches("gpl")}
        >
          <SwatchIcon kind="download" />
        </button>
        <button
          type="button"
          className="inspector__iconbtn inspector__iconbtn--lg"
          data-testid="palette-export-ase"
          title="Export the swatches as .ase"
          aria-label="Export the swatches as .ase"
          disabled={palette.swatches.length === 0}
          onClick={() => saveSwatches("ase")}
        >
          <span style={{ fontSize: "0.6rem", fontWeight: 700 }}>ASE</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".ase,.gpl"
          hidden
          data-testid="palette-import-input"
          onChange={(e) => {
            onImport(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {message && (
          <span
            role="status"
            className="inspector__hint"
            style={{ padding: 0 }}
          >
            {message}
          </span>
        )}
      </div>
    </Section>
  );

  const strokeSection = (
    <Section title={t("labels.stroke")} testId="inspector-stroke">
      <SliderRow
        label={t("labels.strokeWidth")}
        testId="inspector-stroke-width"
        value={first?.strokeWidth ?? null}
        min={0.5}
        max={20}
        step={0.5}
        unit="px"
        disabled={!hasSelection}
        onChange={(v) => run(actionChangeStrokeWidthValue, v)}
      />
      <Segmented
        label={t("labels.strokeStyle")}
        testId="inspector-stroke-style"
        value={first?.strokeStyle ?? app.state.currentItemStrokeStyle}
        options={[
          { value: "solid", text: "—", title: t("labels.strokeStyle_solid") },
          {
            value: "dashed",
            text: "- -",
            title: t("labels.strokeStyle_dashed"),
          },
          {
            value: "dotted",
            text: "···",
            title: t("labels.strokeStyle_dotted"),
          },
        ]}
        onChange={(v) => run(actionChangeStrokeStyle, v)}
      />
      <Segmented
        label={t("labels.sloppiness")}
        testId="inspector-roughness"
        value={first?.roughness ?? app.state.currentItemRoughness}
        options={[
          { value: 0, text: "0", title: t("labels.architect") },
          { value: 1, text: "1", title: t("labels.artist") },
          { value: 2, text: "2", title: t("labels.cartoonist") },
        ]}
        onChange={(v) => run(actionChangeSloppiness, v)}
      />
    </Section>
  );

  // everything the classic panel offers that the sections above do not
  const predicates = getShapeActionPredicates(
    app.state,
    getTargetElements(app.scene.getNonDeletedElementsMap(), app.state),
    app.scene.getNonDeletedElementsMap(),
    app,
  );
  const typeSection = (textEl || app.state.activeTool.type === "text") && (
    <Section title={t("labels.palette.type")} testId="inspector-type">
      <div className="selected-shape-actions">
        {actionManager.renderAction("changeFontFamily")}
      </div>
      <div className="inspector__row">
        <span className="inspector__label">
          {t("labels.palette.installed")}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {actionManager.renderAction("changeLocalFont")}
        </div>
      </div>
      <div className="selected-shape-actions">
        {actionManager.renderAction("changeFontSize")}
        {predicates.textAlign && actionManager.renderAction("changeTextAlign")}
      </div>
      <div className="inspector__row">
        <span className="inspector__label">{t("labels.fontSize")}</span>
        <NumberPill
          label={t("labels.fontSize")}
          testId="inspector-font-size"
          value={textEl?.fontSize ?? app.state.currentItemFontSize}
          min={1}
          max={1000}
          onCommit={(v) => run(actionChangeFontSizeInput, { size: v })}
        />
        <select
          className="inspector__select"
          data-testid="fontUnit-select"
          aria-label={t("labels.fontUnit")}
          value={textEl?.fontUnit ?? app.state.currentItemFontUnit}
          onChange={(e) =>
            run(actionChangeFontSizeInput, { unit: e.target.value })
          }
        >
          <option value="px">px</option>
          <option value="dp">dp</option>
        </select>
      </div>
      {textEl && (
        <button
          type="button"
          className="inspector__btn"
          data-testid="inspector-text-to-vectors"
          title={t("labels.textToVectors")}
          onClick={() => run(actionTextToVectors)}
        >
          {t("labels.textToVectors")}
        </button>
      )}
    </Section>
  );

  const optionsSection = (predicates.hasSelection ||
    app.state.activeTool.type !== "selection") && (
    <Section title={t("labels.palette.options")} testId="inspector-options">
      <div className="selected-shape-actions">
        {predicates.fill && actionManager.renderAction("changeFillStyle")}
        {predicates.freedrawMode &&
          actionManager.renderAction("changeFreedrawMode")}
        {predicates.roundness && actionManager.renderAction("changeRoundness")}
        {predicates.arrowType && actionManager.renderAction("changeArrowType")}
        {predicates.arrowheads && actionManager.renderAction("changeArrowhead")}
        {predicates.verticalAlign &&
          actionManager.renderAction("changeVerticalAlign")}
        {predicates.showExtraActions && (
          <fieldset>
            <legend>{t("labels.actions")}</legend>
            <div className="buttonList">
              {actionManager.renderAction("duplicateSelection")}
              {actionManager.renderAction("deleteSelectedElements")}
              {actionManager.renderAction("group")}
              {actionManager.renderAction("ungroup")}
              {predicates.link && actionManager.renderAction("hyperlink")}
              {predicates.cropEditor &&
                actionManager.renderAction("cropEditor")}
              {predicates.lineEditor &&
                actionManager.renderAction("toggleLinearEditor")}
            </div>
          </fieldset>
        )}
      </div>
    </Section>
  );

  const layers = app.scene.getNonDeletedElements().filter(
    // bound labels belong to their container
    (el) => !(el.type === "text" && el.containerId),
  );

  const layersBody = (
    <div data-testid="inspector-layers" style={{ padding: "0.5rem" }}>
      <div className="inspector__row" style={{ marginTop: 0, marginBottom: 6 }}>
        {(
          [
            ["⤒", actionBringToFront, "labels.bringToFront"],
            ["↑", actionBringForward, "labels.bringForward"],
            ["↓", actionSendBackward, "labels.sendBackward"],
            ["⤓", actionSendToBack, "labels.sendToBack"],
          ] as const
        ).map(([glyph, action, label]) => (
          <button
            key={label}
            type="button"
            className="inspector__iconbtn"
            title={t(label)}
            disabled={!hasSelection}
            onClick={() => run(action)}
          >
            {glyph}
          </button>
        ))}
        <button
          type="button"
          className="inspector__iconbtn"
          data-testid="layer-add"
          title={t("labels.layerPanel.new")}
          onClick={() => app.layers.add()}
        >
          ＋
        </button>
        <button
          type="button"
          className="inspector__iconbtn"
          data-testid="layers-detach"
          style={{ marginLeft: "auto" }}
          title={
            palette.layersDetached
              ? t("labels.palette.attachLayers")
              : t("labels.palette.detachLayers")
          }
          onClick={() => {
            if (!palette.layersDetached) {
              const rect = rootRef.current?.getBoundingClientRect();
              setLayersPosition({
                x: Math.max(0, (rect?.left ?? 400) - 280),
                y: (rect?.top ?? 80) + 40,
              });
              setTab("design");
            }
            setLayersDetached(!palette.layersDetached);
          }}
        >
          {palette.layersDetached ? "⇤" : "⧉"}
        </button>
        <button
          type="button"
          className="inspector__iconbtn"
          title={t("labels.elementLock.lock")}
          disabled={!hasSelection}
          onClick={() => run(actionToggleElementLock)}
        >
          🔒
        </button>
      </div>
      {app.state.layers.length > 0 ? (
        <LayersTree
          app={app}
          layerName={(el) => layerName(el as any)}
          glyph={(el) => LAYER_GLYPH[el.type] ?? "•"}
        />
      ) : (
        <>
          {layers.length === 0 && (
            <div className="inspector__hint">
              {t("labels.palette.noLayers")}
            </div>
          )}
          {[...layers].reverse().map((el) => (
            <div
              key={el.id}
              role="option"
              data-testid="inspector-layer"
              aria-selected={!!app.state.selectedElementIds[el.id]}
              className="inspector__layer"
              onClick={(e) => {
                app.setState((prev) => ({
                  selectedElementIds: {
                    ...(e.shiftKey ? prev.selectedElementIds : {}),
                    [el.id]: true,
                  },
                  selectedGroupIds: {},
                  editingPath: null,
                }));
              }}
            >
              <span className="inspector__layer-type">
                {LAYER_GLYPH[el.type] ?? "•"}
              </span>
              <span className="inspector__layer-name">
                {layerName(el as any)}
              </span>
              {el.locked && (
                <span title={t("labels.elementLock.lock")}>🔒</span>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );

  const detached = palette.layersDetached && (
    <DetachedLayers
      position={palette.layersPosition}
      onMove={setLayersPosition}
      onAttach={() => setLayersDetached(false)}
    >
      {layersBody}
    </DetachedLayers>
  );

  const collapsed = !app.state.paletteOpen;

  return (
    <>
      {!collapsed && detached}
      <div
        ref={rootRef}
        className={className}
        data-testid="palette-panel"
        data-layout={layout}
        data-collapsed={collapsed || undefined}
        style={{
          ...(docked ? {} : { left: pos.x, top: pos.y }),
          ...(layout === "horizontal" ? {} : { width: palette.width }),
          ...(palette.height && !collapsed
            ? { height: palette.height, maxHeight: "none" }
            : {}),
        }}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {layout !== "horizontal" && (
          <div
            className={`inspector__grip inspector__grip--${
              docked ? "left" : "right"
            }`}
            data-testid="palette-resize"
            title={t("labels.palette.resize")}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const startX = e.clientX;
              const startWidth = palette.width;
              const sign = docked ? -1 : 1;
              const move = (ev: PointerEvent) =>
                setPaletteWidth(startWidth + sign * (ev.clientX - startX));
              const up = () => {
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
              };
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up);
            }}
            onDoubleClick={() => setPaletteWidth(DEFAULT_PALETTE_STATE.width)}
          />
        )}
        <div
          className="inspector__head"
          data-testid="palette-handle"
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
        >
          {collapsed && (
            <span className="inspector__collapsed-title">
              {t("labels.palette.title")}
            </span>
          )}
          <div className="inspector__tabs" role="tablist" hidden={collapsed}>
            {(
              [
                ...(palette.layersDetached
                  ? (["design", "symbols", "flow"] as const)
                  : (["design", "layers", "symbols", "flow"] as const)),
                ...hostTabs.map((h) => `host:${h.id}` as const),
              ] as Tab[]
            ).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                className="inspector__tab"
                data-testid={`inspector-tab-${k}`}
                aria-selected={tab === k}
                onClick={() => setTab(k)}
              >
                {k.startsWith("host:")
                  ? hostTabs.find((h) => `host:${h.id}` === k)?.title
                  : t(`labels.palette.tab_${k}` as any)}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="inspector__iconbtn"
            data-testid="palette-dock"
            hidden={collapsed}
            aria-pressed={docked}
            title={t("labels.palette.dock")}
            onClick={() => setPaletteLayout(docked ? "vertical" : "docked")}
          >
            ⇥
          </button>
          <button
            type="button"
            className="inspector__iconbtn"
            data-testid="palette-orientation"
            hidden={collapsed}
            disabled={docked}
            title={t("labels.palette.orientation")}
            onClick={() =>
              setPaletteLayout(
                layout === "vertical" ? "horizontal" : "vertical",
              )
            }
          >
            {layout === "horizontal" ? "↕" : "↔"}
          </button>
          <button
            type="button"
            className="inspector__iconbtn"
            data-testid="palette-collapse"
            aria-label={
              collapsed
                ? t("labels.palette.expand")
                : t("labels.palette.collapse")
            }
            aria-expanded={!collapsed}
            title={
              collapsed
                ? t("labels.palette.expand")
                : t("labels.palette.collapse")
            }
            onClick={() => app.setState({ paletteOpen: collapsed })}
          >
            {collapsed ? "▾" : "▴"}
          </button>
        </div>

        {!collapsed && (
          <PaletteScroll>
            {/* the tools stay in reach whichever tab is open */}
            <ToolsSection app={app} />
            <ModesSection app={app} />
            {tab.startsWith("host:") &&
            hostTabs.some((h) => `host:${h.id}` === tab) ? (
              hostTabs
                .find((h) => `host:${h.id}` === tab)!
                .render({ api: app.api })
            ) : tab === "flow" ? (
              <FlowPanel app={app} />
            ) : tab === "symbols" ? (
              <SymbolsPanel app={app} />
            ) : tab === "design" || palette.layersDetached ? (
              <>
                {transform}
                {multi}
                <SymbolLayoutSection app={app} />
                <ImageStorageSection app={app} />
                <VectorizeSection app={app} />
                <PathSection app={app} />
                <AlignSection app={app} />
                <PathfinderSection app={app} />
                {appearance}
                <CornersSection app={app} />
                {swatches}
                {strokeSection}
                {typeSection}
                {optionsSection}
                <GridSection app={app} />
                <AnchorSection app={app} />
              </>
            ) : (
              layersBody
            )}
          </PaletteScroll>
        )}
        {!collapsed && (
          <div
            className="inspector__grip inspector__grip--bottom"
            data-testid="palette-resize-height"
            title={t("labels.palette.resizeHeight")}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const startY = e.clientY;
              const startHeight =
                rootRef.current?.getBoundingClientRect().height ?? 400;
              const move = (ev: PointerEvent) =>
                setPaletteHeight(startHeight + (ev.clientY - startY));
              const up = () => {
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
              };
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up);
            }}
            onDoubleClick={() => setPaletteHeight(null)}
          />
        )}
      </div>
    </>
  );
};

/** the layers list as a panel of its own: floats, drags by its header */
const DetachedLayers = ({
  position,
  onMove,
  onAttach,
  children,
}: {
  position: { x: number; y: number };
  onMove: (p: { x: number; y: number }) => void;
  onAttach: () => void;
  children: React.ReactNode;
}) => {
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={panelRef}
      className="inspector inspector--floating inspector--layers"
      data-testid="layers-panel"
      style={{ left: position.x, top: position.y }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div
        className="inspector__head"
        data-testid="layers-handle"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) {
            return;
          }
          drag.current = {
            dx: e.clientX - position.x,
            dy: e.clientY - position.y,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (drag.current) {
            const { x, y } = placePanel(
              e.clientX - drag.current.dx,
              e.clientY - drag.current.dy,
              panelRef.current,
              "palette-panel",
              e.altKey,
            );
            onMove({ x, y });
          }
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        <div className="inspector__tabs">
          <span className="inspector__tab" aria-selected="true">
            {t("labels.palette.tab_layers")}
          </span>
        </div>
        <button
          type="button"
          className="inspector__iconbtn"
          data-testid="layers-attach"
          title={t("labels.palette.attachLayers")}
          onClick={onAttach}
        >
          ⇤
        </button>
      </div>
      <PaletteScroll>{children}</PaletteScroll>
    </div>
  );
};
