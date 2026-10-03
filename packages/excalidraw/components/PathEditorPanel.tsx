import { useEffect, useState } from "react";

import { getPathLoopView, isPathElement } from "@excalidraw/element";

import type { PathPointMode } from "@excalidraw/element/types";

import { t } from "../i18n";

import type App from "./App";

const MODES: readonly PathPointMode[] = ["corner", "smooth", "broken"];

const buttonStyle = (active: boolean, disabled: boolean) =>
  ({
    padding: "0.4rem 0.7rem",
    border: "1px solid var(--default-border-color)",
    borderRadius: "var(--border-radius-md, 6px)",
    background: active ? "var(--color-primary-light, #e0dfff)" : "transparent",
    color: "var(--text-primary-color)",
    opacity: disabled ? 0.4 : 1,
    cursor: disabled ? "default" : "pointer",
    font: "inherit",
    fontSize: "0.8125rem",
  } as const);

/**
 * Point-type switch of the path editor: shown while the points of a path are
 * edited, acts on the selected point.
 */
export const PathEditorPanel = ({ app }: { app: App }) => {
  // the element is mutated in place, so re-read it when the scene changes
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsubscribe = app.scene.onUpdate(() => setTick((count) => count + 1));
    return () => {
      try {
        unsubscribe();
      } catch {
        // the scene was destroyed first
      }
    };
  }, [app]);

  const editing = app.state.editingPath;
  const element = app.path.getEditedElement();
  if (!editing || !element || !isPathElement(element)) {
    return null;
  }
  const selected = editing.selectedPoint;
  const inHole = (editing.loop ?? 0) > 0;
  const closeToggleDisabled =
    !!element.contours?.length ||
    (!element.closed && element.points.length < 3);
  const mode =
    selected != null
      ? getPathLoopView(element, editing.loop ?? 0).handles[selected]?.mode
      : null;

  return (
    <div
      className="path-editor-panel"
      data-testid="path-editor-panel"
      style={{
        position: "absolute",
        bottom: "5.5rem",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: "0.35rem",
        padding: "0.4rem",
        background: "var(--island-bg-color)",
        boxShadow: "var(--shadow-island)",
        borderRadius: "var(--border-radius-lg, 8px)",
        zIndex: "var(--zIndex-layerUI, 4)" as any,
        pointerEvents: "all",
      }}
    >
      {MODES.map((pointMode) => (
        <button
          key={pointMode}
          type="button"
          data-testid={`path-point-${pointMode}`}
          disabled={selected == null}
          style={buttonStyle(mode === pointMode, selected == null)}
          onClick={() => app.path.setPointMode(pointMode)}
        >
          {t(`labels.path.${pointMode}`)}
        </button>
      ))}
      <button
        type="button"
        data-testid="path-point-delete"
        disabled={selected == null}
        style={buttonStyle(false, selected == null)}
        onClick={() => app.path.deleteSelectedPoint()}
      >
        {t("labels.path.deletePoint")}
      </button>
      <button
        type="button"
        data-testid="path-toggle-closed"
        style={buttonStyle(false, closeToggleDisabled)}
        disabled={closeToggleDisabled}
        onClick={() => app.path.toggleClosed()}
      >
        {t(element.closed ? "labels.path.openPath" : "labels.path.closePath")}
      </button>
      <button
        type="button"
        data-testid="path-split"
        disabled={selected == null || inHole}
        style={buttonStyle(false, selected == null || inHole)}
        onClick={() => app.path.splitAtSelectedPoint()}
      >
        {t("labels.path.split")}
      </button>
      <button
        type="button"
        data-testid="path-editor-done"
        style={buttonStyle(false, false)}
        onClick={() => app.path.stopEditing()}
      >
        {t("labels.path.done")}
      </button>
    </div>
  );
};
