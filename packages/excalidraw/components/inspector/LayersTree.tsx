import { useState } from "react";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { t } from "../../i18n";
import { getLayerId, type Layer } from "../../layers";

import type App from "../App";

const DRAG_TYPE = "application/x-excalidraw-layer";

type Drag = { kind: "layer" | "object"; id: string };

/** the row being dragged (`getData` is not readable everywhere) */
let dragging: Drag | null = null;

const setDrag = (event: React.DragEvent, drag: Drag) => {
  dragging = drag;
  event.dataTransfer?.setData(DRAG_TYPE, JSON.stringify(drag));
  event.dataTransfer?.setData("text/plain", `${drag.kind}:${drag.id}`);
  try {
    event.dataTransfer.effectAllowed = "move";
  } catch {
    // read-only in some environments
  }
};

const getDrag = (event: React.DragEvent): Drag | null => {
  try {
    return JSON.parse(event.dataTransfer?.getData(DRAG_TYPE) ?? "");
  } catch {
    return dragging;
  }
};

/** the layer panel's rows: layers (named, reorderable, hideable, lockable)
 * and, under each, the objects it owns */
export const LayersTree = ({
  app,
  layerName,
  glyph,
}: {
  app: App;
  layerName: (el: NonDeletedExcalidrawElement) => string;
  glyph: (el: NonDeletedExcalidrawElement) => string;
}) => {
  const { layers, activeLayerId, selectedElementIds } = app.state;
  const [editing, setEditing] = useState<string | null>(null);
  const api = app.layers;

  const selectedIds = Object.keys(selectedElementIds);

  // the stack reads top first, like the canvas
  const rows = [...layers].reverse();

  const dropOnLayer = (event: React.DragEvent, layer: Layer) => {
    event.preventDefault();
    const drag = getDrag(event);
    if (!drag) {
      return;
    }
    if (drag.kind === "object") {
      // the dragged object, or the whole selection when it is part of it
      const ids = selectedIds.includes(drag.id) ? selectedIds : [drag.id];
      api.moveObjects(ids, layer.id);
      return;
    }
    if (drag.id === layer.id) {
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const below = rect.height > 0 && event.clientY > rect.top + rect.height / 2;
    const target = layers.findIndex((l) => l.id === layer.id);
    const from = layers.findIndex((l) => l.id === drag.id);
    // the list is top first: the lower half of a row is the slot beneath it
    let index = below ? target : target + 1;
    if (from < index) {
      index -= 1;
    }
    api.move(drag.id, index);
  };

  return (
    <div data-testid="layers-tree">
      {rows.map((layer) => {
        const objects = api.getObjects(layer.id).reverse();
        const active = layer.id === activeLayerId;
        const fill = api.getSharedStyle(layer.id, "backgroundColor");
        const stroke = api.getSharedStyle(layer.id, "strokeColor");
        return (
          <div key={layer.id} data-testid="layer" data-layer-id={layer.id}>
            <div
              className="inspector__layerrow"
              role="option"
              aria-selected={active}
              data-testid="layer-row"
              draggable
              style={{ borderLeftColor: layer.color }}
              onDragStart={(e) => setDrag(e, { kind: "layer", id: layer.id })}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => dropOnLayer(e, layer)}
              onClick={() => api.setActive(layer.id)}
            >
              <button
                type="button"
                className="inspector__iconbtn"
                data-testid="layer-visible"
                aria-pressed={layer.visible}
                title={t(
                  layer.visible
                    ? "labels.layerPanel.hide"
                    : "labels.layerPanel.show",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  api.setVisible(layer.id, !layer.visible);
                }}
              >
                {layer.visible ? "👁" : "·"}
              </button>
              <button
                type="button"
                className="inspector__iconbtn"
                data-testid="layer-lock"
                aria-pressed={layer.locked}
                title={t(
                  layer.locked
                    ? "labels.layerPanel.unlock"
                    : "labels.layerPanel.lock",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  api.setLocked(layer.id, !layer.locked);
                }}
              >
                {layer.locked ? "🔒" : "🔓"}
              </button>
              <button
                type="button"
                className="inspector__iconbtn"
                data-testid="layer-collapse"
                aria-expanded={!layer.collapsed}
                onClick={(e) => {
                  e.stopPropagation();
                  api.toggleCollapsed(layer.id);
                }}
              >
                {layer.collapsed ? "▸" : "▾"}
              </button>
              <button
                type="button"
                className="inspector__layerchip"
                data-testid="layer-select"
                title={t("labels.layerPanel.selectAll")}
                style={{ background: layer.color }}
                onClick={(e) => {
                  e.stopPropagation();
                  api.select(layer.id, e.shiftKey);
                }}
              />
              {editing === layer.id ? (
                <input
                  className="inspector__layer-input"
                  data-testid="layer-name-input"
                  autoFocus
                  defaultValue={layer.name}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    api.rename(layer.id, e.target.value);
                    setEditing(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      (e.target as HTMLInputElement).blur();
                    } else if (e.key === "Escape") {
                      setEditing(null);
                    }
                    e.stopPropagation();
                  }}
                />
              ) : (
                <span
                  className="inspector__layer-name"
                  data-testid="layer-name"
                  onDoubleClick={() => setEditing(layer.id)}
                >
                  {layer.name}
                </span>
              )}
              <span className="inspector__layer-count">{objects.length}</span>
            </div>

            {active && (
              <div className="inspector__layerstyle" data-testid="layer-style">
                <label title={t("labels.layerPanel.fill")}>
                  ▣
                  <input
                    type="color"
                    data-testid="layer-fill"
                    value={toHex(fill)}
                    onChange={(e) =>
                      api.setStyle(layer.id, {
                        backgroundColor: e.target.value,
                      })
                    }
                  />
                </label>
                <label title={t("labels.layerPanel.stroke")}>
                  ▢
                  <input
                    type="color"
                    data-testid="layer-stroke"
                    value={toHex(stroke)}
                    onChange={(e) =>
                      api.setStyle(layer.id, { strokeColor: e.target.value })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="inspector__iconbtn"
                  data-testid="layer-fill-none"
                  title={t("labels.layerPanel.noFill")}
                  onClick={() =>
                    api.setStyle(layer.id, { backgroundColor: "transparent" })
                  }
                >
                  ∅
                </button>
                <button
                  type="button"
                  className="inspector__iconbtn"
                  style={{ marginLeft: "auto" }}
                  data-testid="layer-delete"
                  title={t("labels.layerPanel.delete")}
                  onClick={() => api.remove(layer.id)}
                >
                  🗑
                </button>
              </div>
            )}

            {!layer.collapsed &&
              objects.map((el) => (
                <div
                  key={el.id}
                  role="option"
                  data-testid="inspector-layer"
                  aria-selected={!!selectedElementIds[el.id]}
                  className="inspector__layer inspector__layer--child"
                  draggable
                  onDragStart={(e) => setDrag(e, { kind: "object", id: el.id })}
                  onClick={(e) => {
                    app.setState((prev) => ({
                      selectedElementIds: {
                        ...(e.shiftKey ? prev.selectedElementIds : {}),
                        [el.id]: true,
                      },
                      selectedGroupIds: {},
                      editingPath: null,
                      activeLayerId: getLayerId(el),
                    }));
                  }}
                >
                  <span className="inspector__layer-type">{glyph(el)}</span>
                  <span className="inspector__layer-name">{layerName(el)}</span>
                  {el.locked && <span>🔒</span>}
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
};

/** `<input type=color>` only takes #rrggbb */
const toHex = (color: string | null) =>
  color && /^#[0-9a-f]{6}$/i.test(color) ? color : "#000000";
