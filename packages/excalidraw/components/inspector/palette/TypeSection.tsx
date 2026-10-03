import type { ExcalidrawTextElement } from "@excalidraw/element/types";

import {
  actionChangeFontSizeInput,
  actionChangeLibraryFont,
  actionTextToVectors,
  actionToggleBold,
  actionToggleItalic,
} from "../../../actions";
import { LibraryFontPicker } from "../../../actions/actionTypography";
import { t } from "../../../i18n";
import { NumberPill, Section } from "../primitives";

import type { getShapeActionPredicates } from "../../shapeActionPredicates";

import type { RunAction } from "./types";

import type App from "../../App";

export const TypeSection = ({
  app,
  textElement,
  predicates,
  run,
}: {
  app: App;
  textElement: ExcalidrawTextElement | null;
  predicates: ReturnType<typeof getShapeActionPredicates>;
  run: RunAction;
}) => {
  const { actionManager } = app;
  return (
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
      <LibraryFontPicker
        current={textElement?.fontFamilyName ?? null}
        onSelect={(name) => run(actionChangeLibraryFont, name)}
      />
      <div className="inspector__row">
        <span className="inspector__label">{t("labels.fontSize")}</span>
        <NumberPill
          label="Exact"
          testId="inspector-font-size"
          value={textElement?.fontSize ?? app.state.currentItemFontSize}
          min={1}
          max={1000}
          onCommit={(size) => run(actionChangeFontSizeInput, { size })}
        />
        <select
          className="inspector__select"
          data-testid="fontUnit-select"
          aria-label={t("labels.fontUnit")}
          value={textElement?.fontUnit ?? app.state.currentItemFontUnit}
          onChange={(event) =>
            run(actionChangeFontSizeInput, { unit: event.target.value })
          }
        >
          <option value="px">px</option>
          <option value="dp">dp</option>
        </select>
      </div>
      <div className="selected-shape-actions">
        {actionManager.renderAction("changeFontSize")}
      </div>
      <div className="inspector__stylerow">
        {textElement && (
          <div className="inspector__segmented" role="group" aria-label="Style">
            <button
              type="button"
              className="inspector__segment"
              style={{ fontWeight: 700 }}
              data-testid="inspector-bold"
              aria-pressed={(textElement.fontWeight ?? 400) >= 600}
              title={`${t("labels.bold")} (Ctrl+B)`}
              onClick={() => run(actionToggleBold)}
            >
              B
            </button>
            <button
              type="button"
              className="inspector__segment"
              style={{ fontStyle: "italic", fontFamily: "serif" }}
              data-testid="inspector-italic"
              aria-pressed={textElement.fontStyle === "italic"}
              title={`${t("labels.italic")} (Ctrl+I)`}
              onClick={() => run(actionToggleItalic)}
            >
              I
            </button>
          </div>
        )}
        {predicates.textAlign && (
          <div className="selected-shape-actions">
            {actionManager.renderAction("changeTextAlign")}
          </div>
        )}
      </div>
      {textElement && (
        <button
          type="button"
          className="inspector__action"
          data-testid="inspector-text-to-vectors"
          title={t("labels.textToVectors")}
          onClick={() => run(actionTextToVectors)}
        >
          Create outlines
        </button>
      )}
    </Section>
  );
};
