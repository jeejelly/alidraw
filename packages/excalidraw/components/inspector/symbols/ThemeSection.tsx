import { useEffect, useRef } from "react";

import { themeUpdates, type SymbolTheme } from "@excalidraw/symbols";

import { Section } from "../primitives";

import { HarmonyTheme } from "./HarmonyTheme";
import { ReferenceColors } from "./ReferenceColors";
import { ThemeEditor } from "./ThemeEditor";

import type App from "../../App";

type ThemeUpdates = ReturnType<typeof themeUpdates>;

const applyThemeUpdates = (app: App, updates: ThemeUpdates) => {
  for (const { element, updates: changes } of updates) {
    app.scene.mutateElement(element, changes as any, {
      informMutation: false,
      isDragging: false,
    });
  }
  // one redraw for all of them: without it the canvas shows the change only when touched
  app.scene.triggerUpdate();
  app.store.scheduleCapture();
};

/** The theme editor, its colour helpers, and the buttons that restyle the canvas. */
export const ThemeSection = ({
  app,
  theme,
  note,
  onNote,
}: {
  app: App;
  theme: SymbolTheme;
  note: string | null;
  onNote: (note: string) => void;
}) => {
  const retheme = (everySymbol: boolean) => {
    const pool = everySymbol
      ? app.scene.getNonDeletedElements()
      : app.scene.getSelectedElements(app.state);
    const updates = themeUpdates(pool, theme);
    if (!updates.length) {
      onNote(
        everySymbol ? "No symbols on the canvas." : "Select symbols first.",
      );
      return;
    }
    applyThemeUpdates(app, updates);
    onNote(`Applied "${theme.name}" to ${updates.length} shapes.`);
  };

  // the theme is live: changing it restyles every symbol on the canvas at once
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const updates = themeUpdates(app.scene.getNonDeletedElements(), theme);
    if (updates.length) {
      applyThemeUpdates(app, updates);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  return (
    <Section title="Theme" testId="symbols-theme-section">
      <ThemeEditor theme={theme} />
      <HarmonyTheme app={app} theme={theme} />
      <ReferenceColors app={app} theme={theme} />
      <p className="symbols__note">Apply the theme to</p>
      <div className="symbols__row">
        <button
          type="button"
          data-testid="symbols-apply-selection"
          title="Apply the theme to the selected symbols"
          onClick={() => retheme(false)}
        >
          Selection
        </button>
        <button
          type="button"
          data-testid="symbols-apply-all"
          title="Apply the theme to every symbol of the canvas"
          onClick={() => retheme(true)}
        >
          All symbols
        </button>
      </div>
      {note && <p className="symbols__note">{note}</p>}
    </Section>
  );
};
