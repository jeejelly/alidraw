import type { PaletteState } from "@excalidraw/color";

import {
  actionBringForward,
  actionBringToFront,
  actionSendBackward,
  actionSendToBack,
  actionToggleElementLock,
} from "../../../actions";
import { t } from "../../../i18n";
import { LayersTree } from "../LayersTree";

import { layerGlyph, layerName } from "./layerDisplay";

import type { RunAction } from "./types";

import type App from "../../App";

const ORDER_BUTTONS = [
  ["⤒", actionBringToFront, "labels.bringToFront"],
  ["↑", actionBringForward, "labels.bringForward"],
  ["↓", actionSendBackward, "labels.sendBackward"],
  ["⤓", actionSendToBack, "labels.sendToBack"],
] as const;

export const LayersBody = ({
  app,
  palette,
  hasSelection,
  run,
  onToggleDetached,
}: {
  app: App;
  palette: PaletteState;
  hasSelection: boolean;
  run: RunAction;
  onToggleDetached: () => void;
}) => {
  // bound labels belong to their container
  const elements = app.scene
    .getNonDeletedElements()
    .filter((element) => !(element.type === "text" && element.containerId));

  return (
    <div data-testid="inspector-layers" style={{ padding: "0.5rem" }}>
      <div className="inspector__row" style={{ marginTop: 0, marginBottom: 6 }}>
        {ORDER_BUTTONS.map(([glyph, action, label]) => (
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
          onClick={onToggleDetached}
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
          layerName={(element) => layerName(element)}
          glyph={(element) => layerGlyph(element.type)}
        />
      ) : (
        <>
          {elements.length === 0 && (
            <div className="inspector__hint">
              {t("labels.palette.noLayers")}
            </div>
          )}
          {[...elements].reverse().map((element) => (
            <div
              key={element.id}
              role="option"
              data-testid="inspector-layer"
              aria-selected={!!app.state.selectedElementIds[element.id]}
              className="inspector__layer"
              onClick={(event) => {
                app.setState((prev) => ({
                  selectedElementIds: {
                    ...(event.shiftKey ? prev.selectedElementIds : {}),
                    [element.id]: true,
                  },
                  selectedGroupIds: {},
                  editingPath: null,
                }));
              }}
            >
              <span className="inspector__layer-type">
                {layerGlyph(element.type)}
              </span>
              <span className="inspector__layer-name">
                {layerName(element)}
              </span>
              {element.locked && (
                <span title={t("labels.elementLock.lock")}>🔒</span>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
};
