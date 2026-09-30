import { useRef, useState, useSyncExternalStore } from "react";

import {
  actionChangeBackgroundColor,
  actionChangeStrokeColor,
} from "../actions";
import { t } from "../i18n";
import {
  addSwatch,
  addSwatches,
  getPaletteState,
  normalizeHex,
  parsePaletteFile,
  removeSwatch,
  renameSwatch,
  setPaletteLayout,
  setPalettePosition,
  subscribePalette,
} from "../palette";

import type App from "./App";

type Target = "stroke" | "background";

const PANEL_WIDTH_HORIZONTAL = 420;

const chip = (color: string, size = 22) =>
  ({
    width: size,
    height: size,
    borderRadius: 4,
    border: "1px solid var(--default-border-color)",
    background: color === "transparent" ? "transparent" : color,
    backgroundImage:
      color === "transparent"
        ? "repeating-conic-gradient(#ccc 0 25%, #fff 0 50%)"
        : undefined,
    backgroundSize: "8px 8px",
    cursor: "pointer",
    padding: 0,
  } as const);

const btn = {
  padding: "0.25rem 0.5rem",
  border: "1px solid var(--default-border-color)",
  borderRadius: 6,
  background: "transparent",
  color: "var(--text-primary-color)",
  cursor: "pointer",
  font: "inherit",
  fontSize: "0.75rem",
} as const;

/**
 * The palette as a panel that stays open while elements are selected and
 * edited: stroke/background swatches (named, saved across sessions, importable
 * from .ase / .gpl), and the other style and text controls one click away.
 */
export const PalettePanel = ({ app }: { app: App }) => {
  const palette = useSyncExternalStore(subscribePalette, getPaletteState);
  const [target, setTarget] = useState<Target>("stroke");
  const [managing, setManaging] = useState(false);
  const [showMore, setShowMore] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const { actionManager } = app;
  const selected = app.scene.getSelectedElements(app.state);
  const strokeColor =
    selected[0]?.strokeColor ?? app.state.currentItemStrokeColor;
  const backgroundColor =
    selected[0]?.backgroundColor ?? app.state.currentItemBackgroundColor;
  const currentColor = target === "stroke" ? strokeColor : backgroundColor;

  const apply = (color: string) =>
    actionManager.executeAction(
      target === "stroke"
        ? actionChangeStrokeColor
        : actionChangeBackgroundColor,
      "ui",
      { color },
    );

  const vertical = palette.layout === "vertical";
  const pos = palette.position;

  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) {
      return;
    }
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const moveDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) {
      return;
    }
    setPalettePosition({
      x: Math.max(
        0,
        Math.min(window.innerWidth - 60, e.clientX - drag.current.dx),
      ),
      y: Math.max(
        0,
        Math.min(window.innerHeight - 40, e.clientY - drag.current.dy),
      ),
    });
  };
  const endDrag = () => {
    drag.current = null;
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

  const hex = normalizeHex(currentColor);

  return (
    <div
      className="palette-panel"
      data-testid="palette-panel"
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        width: vertical ? 170 : PANEL_WIDTH_HORIZONTAL,
        maxHeight: "80vh",
        overflow: "auto",
        zIndex: "var(--zIndex-layerUI, 4)" as any,
        background: "var(--island-bg-color)",
        boxShadow: "var(--shadow-island)",
        borderRadius: "var(--border-radius-lg, 8px)",
        color: "var(--text-primary-color)",
        fontSize: "0.8125rem",
        pointerEvents: "all",
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div
        data-testid="palette-handle"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "0.4rem 0.6rem",
          cursor: "move",
          touchAction: "none",
          borderBottom: "1px solid var(--default-border-color)",
        }}
      >
        <strong style={{ flex: 1 }}>{t("labels.palette.title")}</strong>
        <button
          type="button"
          style={btn}
          data-testid="palette-orientation"
          title={t("labels.palette.orientation")}
          onClick={() => setPaletteLayout(vertical ? "horizontal" : "vertical")}
        >
          {vertical ? "↔" : "↕"}
        </button>
        <button
          type="button"
          style={btn}
          data-testid="palette-close"
          aria-label={t("buttons.close")}
          onClick={() => app.setState({ paletteOpen: false })}
        >
          ×
        </button>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: vertical ? "column" : "row",
          gap: 10,
          padding: "0.6rem",
          alignItems: vertical ? "stretch" : "flex-start",
        }}
      >
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {(["stroke", "background"] as const).map((k) => (
            <button
              key={k}
              type="button"
              data-testid={`palette-target-${k}`}
              style={{
                ...btn,
                display: "flex",
                gap: 4,
                alignItems: "center",
                background:
                  target === k
                    ? "var(--color-primary-light, #e0dfff)"
                    : "transparent",
              }}
              onClick={() => setTarget(k)}
            >
              <span
                style={chip(k === "stroke" ? strokeColor : backgroundColor, 14)}
              />
              {t(k === "stroke" ? "labels.stroke" : "labels.background")}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          <div
            data-testid="palette-swatches"
            style={{
              display: "flex",
              flexDirection: managing ? "column" : "row",
              flexWrap: "wrap",
              gap: managing ? 4 : 6,
            }}
          >
            {palette.swatches.length === 0 && (
              <span style={{ opacity: 0.6 }}>{t("labels.palette.empty")}</span>
            )}
            {palette.swatches.map((s) =>
              managing ? (
                <div
                  key={s.id}
                  style={{ display: "flex", gap: 4, alignItems: "center" }}
                >
                  <span style={chip(s.color, 18)} />
                  <input
                    type="text"
                    data-testid="palette-swatch-name"
                    defaultValue={s.name}
                    style={{ flex: 1, minWidth: 0, width: "100%" }}
                    onBlur={(e) => renameSwatch(s.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                  />
                  <button
                    type="button"
                    style={btn}
                    data-testid="palette-swatch-remove"
                    aria-label={t("labels.palette.remove")}
                    onClick={() => removeSwatch(s.id)}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  key={s.id}
                  type="button"
                  data-testid="palette-swatch"
                  title={`${s.name} ${s.color}`}
                  style={chip(s.color)}
                  onClick={() => apply(s.color)}
                />
              ),
            )}
          </div>

          <div
            style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}
          >
            <button
              type="button"
              style={btn}
              data-testid="palette-add"
              disabled={!hex}
              onClick={() => {
                if (hex && addSwatch(hex)) {
                  setManaging(true);
                }
              }}
            >
              + {t("labels.palette.add")}
            </button>
            <button
              type="button"
              style={btn}
              data-testid="palette-manage"
              onClick={() => setManaging((m) => !m)}
            >
              {managing ? t("labels.palette.done") : t("labels.palette.edit")}
            </button>
            <button
              type="button"
              style={btn}
              data-testid="palette-import"
              onClick={() => fileRef.current?.click()}
            >
              {t("labels.palette.import")}
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
          </div>
          {message && (
            <div role="status" style={{ marginTop: 6, opacity: 0.8 }}>
              {message}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: "0 0.6rem 0.6rem" }}>
        <button
          type="button"
          style={btn}
          data-testid="palette-more-toggle"
          aria-expanded={showMore}
          onClick={() => setShowMore((v) => !v)}
        >
          {showMore ? "▾" : "▸"} {t("labels.palette.more")}
        </button>
      </div>
      {showMore && (
        <div
          data-testid="palette-more"
          className="selected-shape-actions"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "0 0.6rem 0.6rem",
          }}
        >
          {actionManager.renderAction("changeOpacity")}
          {actionManager.renderAction("changeStrokeWidth")}
          {actionManager.renderAction("changeFontFamily")}
          {actionManager.renderAction("changeLocalFont")}
          {actionManager.renderAction("changeFontSizeInput")}
        </div>
      )}
    </div>
  );
};
