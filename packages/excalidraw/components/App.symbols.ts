import { getBoundTextElement } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { getSymbolMeta, symbolGroupOf } from "../symbols/build";
import { isReplaceable, labelOf, symbolInBox } from "../symbols/replace";

import type { Values } from "../symbols/components";
import type { SymbolTheme } from "../symbols/theme";

import type App from "./App";

/**
 * A symbol can stand in for a shape of a diagram, with the shape's text as its
 * label. The shape stays under it as an invisible anchor, so arrows glued to it
 * keep working, and when its text changes (from the canvas or from the Flow
 * text) the symbol is redrawn with the new label.
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
      const quiet = { informMutation: false, isDragging: false };
      this.app.scene.mutateElement(
        node as any,
        {
          strokeColor: "transparent",
          backgroundColor: "transparent",
          groupIds: [group, ...node.groupIds],
          customData: { ...node.customData, symbol: { ...meta, anchor: true } },
        },
        quiet,
      );
      if (text) {
        this.app.scene.mutateElement(
          text as any,
          {
            strokeColor: "transparent",
            groupIds: [group, ...text.groupIds],
            customData: { ...text.customData, symbol: meta },
          },
          quiet,
        );
      }
      // the shape that was replaced is a text on its own: it keeps its place, unseen
      this.app.scene.insertElementsAtIndex(made, null);
      last = {
        group,
        ids: [node.id, ...(text ? [text.id] : []), ...made.map((e) => e.id)],
      };
    }
    if (last) {
      this.select(last.group, last.ids);
      this.app.store.scheduleCapture();
    }
    return nodes.length;
  };

  /** redraws every symbol whose anchor's text changed */
  sync = () => {
    const map = this.app.scene.getNonDeletedElementsMap();
    const all = this.app.scene.getNonDeletedElements();
    const stale: ExcalidrawElement[] = [];
    for (const el of all) {
      const m = getSymbolMeta(el);
      if (m?.anchor && m.component && labelOf(el, map) !== (m.label ?? "")) {
        stale.push(el);
      }
    }
    if (!stale.length) {
      return;
    }
    this.busy = true;
    try {
      const theme = this.themeFor();
      for (const anchor of stale) {
        const m = getSymbolMeta(anchor)!;
        const label = labelOf(anchor, map);
        const keep = new Set([anchor.id, getBoundTextElement(anchor, map)?.id]);
        for (const el of all) {
          if (symbolGroupOf(el) === anchor.groupIds[0] && !keep.has(el.id)) {
            this.app.scene.mutateElement(
              el as any,
              { isDeleted: true },
              { informMutation: false, isDragging: false },
            );
          }
        }
        const made = symbolInBox(
          m.component!,
          m.values ?? {},
          theme,
          anchor,
          label,
        ).map((e) => ({
          ...e,
          groupIds: anchor.groupIds,
        }));
        for (const e of made) {
          e.customData = {
            ...e.customData,
            symbol: { ...e.customData?.symbol, group: m.group },
          };
        }
        this.app.scene.insertElementsAtIndex(made as any, null);
        this.app.scene.mutateElement(
          anchor as any,
          { customData: { ...anchor.customData, symbol: { ...m, label } } },
          { informMutation: false, isDragging: false },
        );
      }
      this.app.scene.triggerUpdate();
      this.app.store.scheduleCapture();
    } finally {
      this.busy = false;
    }
  };

  private themeFor = (): SymbolTheme => this.app.symbolTheme();
}
