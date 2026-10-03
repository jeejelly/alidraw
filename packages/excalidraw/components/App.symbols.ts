import { getBoundTextElement } from "@excalidraw/element";

import { getSymbolMeta, symbolGroupOf } from "@excalidraw/symbols";
import { isReplaceable, labelOf, symbolInBox } from "@excalidraw/symbols";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { Values } from "@excalidraw/symbols";
import type { SymbolTheme } from "@excalidraw/symbols";

import type App from "./App";

/** mutations that must not notify subscribers or count as a drag */
const QUIET = { informMutation: false, isDragging: false };

/**
 * A symbol stands in for a shape, which stays under it as an invisible anchor
 * so glued arrows keep working; the symbol is redrawn when the shape's text changes.
 */
export class AppSymbols {
  private off: (() => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private busy = false;

  constructor(private app: App) {}

  start = () => {
    this.off = this.app.scene.onUpdate(this.schedule);
  };

  destroy = () => {
    try {
      this.off?.();
    } catch {
      // the scene was destroyed first
    }
    this.off = null;
    if (this.timer) {
      clearTimeout(this.timer);
    }
  };

  private schedule = () => {
    if (this.busy || this.timer) {
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      this.sync();
    }, 150);
  };

  /** shapes in the selection a symbol can replace */
  replaceable = () =>
    this.app.scene.getSelectedElements(this.app.state).filter(isReplaceable);

  private select(group: string, ids: string[]) {
    this.app.setState({
      selectedElementIds: Object.fromEntries(ids.map((id) => [id, true])),
      selectedGroupIds: { [group]: true },
    });
  }

  /** the selected shapes become the component, each keeping its text as the label */
  replace = (componentId: string, values: Values, theme: SymbolTheme) => {
    const map = this.app.scene.getNonDeletedElementsMap();
    const nodes = this.replaceable();
    let last: { group: string; ids: string[] } | null = null;
    for (const node of nodes) {
      const text = getBoundTextElement(node, map);
      const label = labelOf(node, map);
      const made = symbolInBox(componentId, values, theme, node, label);
      if (!made.length) {
        continue;
      }
      const group = made[0].groupIds[0];
      const meta = {
        group,
        s: null,
        f: null,
        component: componentId,
        values,
        label,
      };
      this.hideBehindSymbol(node, text, group, meta);
      // the shape that was replaced is a text on its own: it keeps its place, unseen
      this.app.scene.insertElementsAtIndex(made, null);
      last = {
        group,
        ids: [
          node.id,
          ...(text ? [text.id] : []),
          ...made.map((element) => element.id),
        ],
      };
    }
    if (last) {
      this.select(last.group, last.ids);
      this.app.store.scheduleCapture();
    }
    return nodes.length;
  };

  /** the replaced shape and its text stay as invisible anchors of the symbol */
  private hideBehindSymbol = (
    node: ExcalidrawElement,
    text: ExcalidrawElement | null,
    group: string,
    meta: object,
  ) => {
    this.app.scene.mutateElement(
      node as any,
      {
        strokeColor: "transparent",
        backgroundColor: "transparent",
        groupIds: [group, ...node.groupIds],
        customData: { ...node.customData, symbol: { ...meta, anchor: true } },
      },
      QUIET,
    );
    if (text) {
      this.app.scene.mutateElement(
        text as any,
        {
          strokeColor: "transparent",
          groupIds: [group, ...text.groupIds],
          customData: { ...text.customData, symbol: meta },
        },
        QUIET,
      );
    }
  };

  /** redraws every symbol whose anchor's text changed */
  sync = () => {
    const map = this.app.scene.getNonDeletedElementsMap();
    const all = this.app.scene.getNonDeletedElements();
    const stale = all.filter((element) => {
      const meta = getSymbolMeta(element);
      return (
        meta?.anchor &&
        meta.component &&
        labelOf(element, map) !== (meta.label ?? "")
      );
    });
    if (!stale.length) {
      return;
    }
    this.busy = true;
    try {
      const theme = this.app.symbolTheme();
      for (const anchor of stale) {
        this.redraw(anchor, theme, all, map);
      }
      this.app.scene.triggerUpdate();
      this.app.store.scheduleCapture();
    } finally {
      this.busy = false;
    }
  };

  /** replaces the parts of one symbol by a fresh drawing with the anchor's current text */
  private redraw = (
    anchor: ExcalidrawElement,
    theme: SymbolTheme,
    all: readonly ExcalidrawElement[],
    map: ReturnType<App["scene"]["getNonDeletedElementsMap"]>,
  ) => {
    const meta = getSymbolMeta(anchor)!;
    const label = labelOf(anchor, map);
    const keep = new Set([anchor.id, getBoundTextElement(anchor, map)?.id]);
    for (const element of all) {
      if (
        symbolGroupOf(element) === anchor.groupIds[0] &&
        !keep.has(element.id)
      ) {
        this.app.scene.mutateElement(
          element as any,
          { isDeleted: true },
          QUIET,
        );
      }
    }
    const made = symbolInBox(
      meta.component!,
      meta.values ?? {},
      theme,
      anchor,
      label,
    ).map((element) => ({ ...element, groupIds: anchor.groupIds }));
    for (const element of made) {
      element.customData = {
        ...element.customData,
        symbol: { ...element.customData?.symbol, group: meta.group },
      };
    }
    this.app.scene.insertElementsAtIndex(made as any, null);
    this.app.scene.mutateElement(
      anchor as any,
      { customData: { ...anchor.customData, symbol: { ...meta, label } } },
      QUIET,
    );
  };
}
