import { useRef, useState, useSyncExternalStore } from "react";

import {
  getPaletteState,
  setLayersDetached,
  setLayersPosition,
  subscribePalette,
} from "@excalidraw/color";

import { useHostPaletteTabs } from "../hostPalette";

import { FlowPanel } from "./inspector/FlowPanel";
import { ModesSection } from "./inspector/ModesSection";
import { PaletteScroll } from "./inspector/PaletteScroll";
import { SymbolsPanel } from "./inspector/SymbolsPanel";
import { ToolsSection } from "./inspector/LayoutSections";
import { DesignBody } from "./inspector/palette/DesignBody";
import { DetachedLayers } from "./inspector/palette/DetachedLayers";
import { LayersBody } from "./inspector/palette/LayersBody";
import { PanelHeader } from "./inspector/palette/PanelHeader";
import { HeightGrip, WidthGrip } from "./inspector/palette/ResizeGrips";
import {
  useFocusTransformShortcut,
  useRepaintOnSceneChange,
} from "./inspector/palette/usePanelEffects";
import { usePanelDrag } from "./inspector/palette/usePanelDrag";
import {
  INSPECTOR_FOCUS_TRANSFORM,
  type ColorTarget,
  type PaletteTab,
} from "./inspector/palette/types";
import "./inspector/Inspector.scss";

import type App from "./App";

export { INSPECTOR_FOCUS_TRANSFORM };

/**
 * The inspector: one panel for everything about the selection, grouped the
 * way designers look for it, plus a Layers tab. Docked to the right or
 * floating (horizontal strip / vertical column).
 */
export const PalettePanel = ({ app }: { app: App }) => {
  const palette = useSyncExternalStore(subscribePalette, getPaletteState);
  const hostTabs = useHostPaletteTabs();
  const [tab, setTab] = useState<PaletteTab>("design");
  const [target, setTarget] = useState<ColorTarget>("stroke");
  const rootRef = useRef<HTMLDivElement>(null);

  useRepaintOnSceneChange(app);
  useFocusTransformShortcut(rootRef, () => setTab("design"));

  const { layout, position } = palette;
  const dragHandlers = usePanelDrag(rootRef, layout, position);

  const run = (action: any, value?: unknown) =>
    app.actionManager.executeAction(action, "ui", value);

  const hasSelection = app.scene.getSelectedElements(app.state).length > 0;

  const docked = layout === "docked";
  const collapsed = !app.state.paletteOpen;

  const toggleLayersDetached = () => {
    if (!palette.layersDetached) {
      const rect = rootRef.current?.getBoundingClientRect();
      setLayersPosition({
        x: Math.max(0, (rect?.left ?? 400) - 280),
        y: (rect?.top ?? 80) + 40,
      });
      setTab("design");
    }
    setLayersDetached(!palette.layersDetached);
  };

  const layersBody = (
    <LayersBody
      app={app}
      palette={palette}
      hasSelection={hasSelection}
      run={run}
      onToggleDetached={toggleLayersDetached}
    />
  );

  const designBody = (
    <DesignBody
      app={app}
      target={target}
      onTargetChange={setTarget}
      run={run}
    />
  );

  const hostTab = hostTabs.find((entry) => `host:${entry.id}` === tab);
  const body = hostTab ? (
    hostTab.render({ api: app.api })
  ) : tab === "flow" ? (
    <FlowPanel app={app} />
  ) : tab === "symbols" ? (
    <SymbolsPanel app={app} />
  ) : tab === "design" || palette.layersDetached ? (
    designBody
  ) : (
    layersBody
  );

  return (
    <>
      {!collapsed && palette.layersDetached && (
        <DetachedLayers
          position={palette.layersPosition}
          onMove={setLayersPosition}
          onAttach={() => setLayersDetached(false)}
        >
          {layersBody}
        </DetachedLayers>
      )}
      <div
        ref={rootRef}
        className={[
          "inspector",
          docked ? "inspector--docked" : "inspector--floating",
          layout === "horizontal" ? "inspector--horizontal" : "",
        ].join(" ")}
        data-testid="palette-panel"
        data-layout={layout}
        data-collapsed={collapsed || undefined}
        style={{
          ...(docked ? {} : { left: position.x, top: position.y }),
          ...(layout === "horizontal" ? {} : { width: palette.width }),
          ...(palette.height && !collapsed
            ? { height: palette.height, maxHeight: "none" }
            : {}),
        }}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {layout !== "horizontal" && (
          <WidthGrip docked={docked} width={palette.width} />
        )}
        <PanelHeader
          app={app}
          tab={tab}
          onTabChange={setTab}
          hostTabs={hostTabs}
          layout={layout}
          layersDetached={palette.layersDetached}
          collapsed={collapsed}
          dragHandlers={dragHandlers}
        />
        {!collapsed && (
          <PaletteScroll>
            {/* the tools stay in reach whichever tab is open */}
            <ToolsSection app={app} />
            <ModesSection app={app} />
            {body}
          </PaletteScroll>
        )}
        {!collapsed && <HeightGrip rootRef={rootRef} />}
      </div>
    </>
  );
};
