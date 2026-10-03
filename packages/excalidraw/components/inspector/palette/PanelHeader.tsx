import { setPaletteLayout } from "@excalidraw/color";

import type { PaletteLayout } from "@excalidraw/color";

import { t } from "../../../i18n";

import type { HostPaletteTab } from "../../../hostPalette";

import type { PaletteTab } from "./types";

import type App from "../../App";

type DragHandlers = Pick<
  React.HTMLAttributes<HTMLDivElement>,
  "onPointerDown" | "onPointerMove" | "onPointerUp"
>;

export const PanelHeader = ({
  app,
  tab,
  onTabChange,
  hostTabs,
  layout,
  layersDetached,
  collapsed,
  dragHandlers,
}: {
  app: App;
  tab: PaletteTab;
  onTabChange: (tab: PaletteTab) => void;
  hostTabs: readonly HostPaletteTab[];
  layout: PaletteLayout;
  layersDetached: boolean;
  collapsed: boolean;
  dragHandlers: DragHandlers;
}) => {
  const docked = layout === "docked";
  const tabs: PaletteTab[] = [
    ...(layersDetached
      ? (["design", "symbols", "flow"] as const)
      : (["design", "layers", "symbols", "flow"] as const)),
    ...hostTabs.map((hostTab) => `host:${hostTab.id}` as const),
  ];
  const collapseLabel = collapsed
    ? t("labels.palette.expand")
    : t("labels.palette.collapse");

  return (
    <div
      className="inspector__head"
      data-testid="palette-handle"
      {...dragHandlers}
    >
      {collapsed && (
        <span className="inspector__collapsed-title">
          {t("labels.palette.title")}
        </span>
      )}
      <div className="inspector__tabs" role="tablist" hidden={collapsed}>
        {tabs.map((entry) => (
          <button
            key={entry}
            type="button"
            role="tab"
            className="inspector__tab"
            data-testid={`inspector-tab-${entry}`}
            aria-selected={tab === entry}
            onClick={() => onTabChange(entry)}
          >
            {entry.startsWith("host:")
              ? hostTabs.find((hostTab) => `host:${hostTab.id}` === entry)
                  ?.title
              : t(`labels.palette.tab_${entry}` as any)}
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
          setPaletteLayout(layout === "vertical" ? "horizontal" : "vertical")
        }
      >
        {layout === "horizontal" ? "↕" : "↔"}
      </button>
      <button
        type="button"
        className="inspector__iconbtn"
        data-testid="palette-collapse"
        aria-label={collapseLabel}
        aria-expanded={!collapsed}
        title={collapseLabel}
        onClick={() => app.setState({ paletteOpen: collapsed })}
      >
        {collapsed ? "▾" : "▴"}
      </button>
    </div>
  );
};
