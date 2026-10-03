import { getCommonBounds } from "@excalidraw/element";

import { actionFitToGrid, actionToggleGridMode } from "../../../actions";
import { t } from "../../../i18n";
import { NumberPill, Section } from "../primitives";

import type App from "../../App";

/** Grid on/off, spacing, subdivisions, origin, and fitting the selection to it. */
export const GridSection = ({ app }: { app: App }) => {
  const { gridModeEnabled, gridSize, gridStep, gridOrigin } = app.state;
  const hasSelection = app.scene.getSelectedElements(app.state).length > 0;
  return (
    <Section title={t("labels.grid.title")} testId="inspector-grid">
      <div className="inspector__row">
        <span className="inspector__label">{t("labels.toggleGrid")}</span>
        <div className="inspector__seg">
          <button
            type="button"
            data-testid="grid-toggle"
            aria-pressed={gridModeEnabled}
            onClick={() =>
              app.actionManager.executeAction(actionToggleGridMode, "ui")
            }
          >
            {gridModeEnabled ? "On" : "Off"}
          </button>
        </div>
      </div>
      <div className="inspector__row">
        <span className="inspector__label">{t("labels.grid.spacing")}</span>
        <NumberPill
          label={t("labels.grid.spacing")}
          testId="grid-spacing"
          value={gridSize}
          min={1}
          max={500}
          unit="px"
          onCommit={(value) => app.setState({ gridSize: Math.round(value) })}
        />
      </div>
      <div className="inspector__row">
        <span className="inspector__label">
          {t("labels.grid.subdivisions")}
        </span>
        <NumberPill
          label={t("labels.grid.subdivisions")}
          testId="grid-subdivisions"
          value={gridStep}
          min={1}
          max={20}
          onCommit={(value) => app.setState({ gridStep: Math.round(value) })}
        />
      </div>
      <div className="inspector__row">
        <span className="inspector__label">{t("labels.grid.origin")}</span>
        <NumberPill
          label="X"
          testId="grid-origin-x"
          value={gridOrigin.x}
          min={-100000}
          max={100000}
          unit="px"
          onCommit={(value) =>
            app.setState({
              gridOrigin: { ...gridOrigin, x: Math.round(value) },
            })
          }
        />
        <NumberPill
          label="Y"
          testId="grid-origin-y"
          value={gridOrigin.y}
          min={-100000}
          max={100000}
          unit="px"
          onCommit={(value) =>
            app.setState({
              gridOrigin: { ...gridOrigin, y: Math.round(value) },
            })
          }
        />
      </div>
      <div className="inspector__row">
        <button
          type="button"
          className="inspector__text"
          style={{ cursor: "pointer" }}
          data-testid="grid-origin-selection"
          disabled={!hasSelection}
          onClick={() => {
            const selected = app.scene.getSelectedElements(app.state);
            const [left, top] = getCommonBounds(selected);
            app.setState({
              gridOrigin: { x: Math.round(left), y: Math.round(top) },
            });
          }}
        >
          {t("labels.grid.originToSelection")}
        </button>
        <button
          type="button"
          className="inspector__text"
          style={{ cursor: "pointer" }}
          data-testid="grid-origin-reset"
          onClick={() => app.setState({ gridOrigin: { x: 0, y: 0 } })}
        >
          {t("labels.grid.originReset")}
        </button>
      </div>
      <div className="inspector__row">
        <button
          type="button"
          className="inspector__text"
          style={{ cursor: "pointer" }}
          data-testid="grid-fit"
          disabled={!hasSelection}
          onClick={() => app.actionManager.executeAction(actionFitToGrid, "ui")}
        >
          {t("labels.grid.fit")}
        </button>
      </div>
    </Section>
  );
};
