import { useState, useSyncExternalStore } from "react";

import {
  getPaletteState,
  setToolHidden,
  subscribePalette,
} from "@excalidraw/color";

import { t } from "../../../i18n";
import { LockedIcon, UnlockedIcon } from "../../icons";
import { isToolButtonDisabled } from "../../Tools";
import { Section } from "../primitives";

import { getToolEntries, type ToolEntry } from "./toolEntries";

import type App from "../../App";

const toolTestId = (id: string) =>
  id === "path"
    ? "path-tool-pen"
    : id === "knife"
    ? "path-tool-knife"
    : `tool-${id}`;

/** The bucket icon with a chip showing the colour it pours. */
const BucketIcon = ({
  icon,
  pour,
}: {
  icon: React.ReactNode;
  pour: string;
}) => (
  <span
    style={{
      position: "relative",
      display: "inline-flex",
      width: "1.25rem",
      height: "1.25rem",
    }}
  >
    {icon}
    <span
      data-testid="bucket-chip"
      title={pour}
      style={{
        position: "absolute",
        right: -3,
        bottom: -3,
        width: 10,
        height: 10,
        borderRadius: 2,
        border: "1.5px solid var(--color-surface-lowest, #fff)",
        boxShadow: "0 0 0 1px rgba(0,0,0,0.45)",
        background: pour,
      }}
    />
  </span>
);

const ToolButton = ({
  app,
  entry,
  customizing,
  hidden,
  pour,
}: {
  app: App;
  entry: ToolEntry;
  customizing: boolean;
  hidden: boolean;
  pour: string;
}) => {
  const { activeTool } = app.state;
  const pressed = customizing
    ? !hidden
    : entry.id === "lock"
    ? !!activeTool.locked
    : entry.tool === activeTool.type;
  const shortcut = entry.shortcut ? ` (${entry.shortcut})` : "";
  const customizeHint = customizing ? ` — ${hidden ? "show" : "hide"}` : "";
  const icon =
    entry.id === "bucketfill" ? (
      <BucketIcon icon={entry.icon} pour={pour} />
    ) : entry.id === "lock" ? (
      activeTool.locked ? (
        LockedIcon
      ) : (
        UnlockedIcon
      )
    ) : (
      entry.icon
    );
  return (
    <button
      type="button"
      className="inspector__iconbtn"
      style={{
        width: "2rem",
        height: "2rem",
        opacity: customizing && hidden ? 0.35 : 1,
      }}
      data-testid={toolTestId(entry.id)}
      title={`${entry.title}${shortcut}${customizeHint}`}
      aria-pressed={pressed}
      disabled={
        !customizing && !!entry.tool && isToolButtonDisabled(app, entry.tool)
      }
      onClick={() =>
        customizing ? setToolHidden(entry.id, !hidden) : entry.run(app)
      }
    >
      {icon}
    </button>
  );
};

const BucketPour = ({ app, pour }: { app: App; pour: string }) => (
  <div className="inspector__row" data-testid="bucket-pour">
    <span className="inspector__label">{t("labels.tools.pours")}</span>
    <input
      type="color"
      data-testid="bucket-color"
      value={/^#[0-9a-f]{6}$/i.test(pour) ? pour : "#000000"}
      onChange={(event) =>
        app.setState({ currentItemBackgroundColor: event.target.value })
      }
      style={{ width: "2rem", height: "1.5rem", padding: 0, border: 0 }}
    />
    <span className="inspector__hint" style={{ padding: 0 }}>
      {pour}
    </span>
  </div>
);

/**
 * Every tool the toolbar keeps in its overflow menu, one click away, with
 * Mermaid in and out. The gear chooses which show (kept per browser).
 */
export const ToolsSection = ({ app }: { app: App }) => {
  const palette = useSyncExternalStore(subscribePalette, getPaletteState);
  const [customizing, setCustomizing] = useState(false);
  const hiddenTools = new Set(palette.hiddenTools);
  // the fill colour, shown on the bucket tool itself
  const pour = app.bucketFill.getBucketFillBackgroundColor(
    app.state.currentItemBackgroundColor,
  );
  const entries = getToolEntries().filter(
    (entry) => customizing || !hiddenTools.has(entry.id),
  );
  return (
    <Section title={t("labels.tools.title")} testId="inspector-tools">
      <div className="inspector__row" style={{ gap: 2, flexWrap: "wrap" }}>
        {entries.map((entry) => (
          <ToolButton
            key={entry.id}
            app={app}
            entry={entry}
            customizing={customizing}
            hidden={hiddenTools.has(entry.id)}
            pour={pour}
          />
        ))}
        <button
          type="button"
          className="inspector__iconbtn"
          style={{ width: "2rem", height: "2rem", marginLeft: "auto" }}
          data-testid="tools-customize"
          title={t("labels.tools.customize")}
          aria-pressed={customizing}
          onClick={() => setCustomizing(!customizing)}
        >
          ⚙
        </button>
      </div>
      {app.state.activeTool.type === "bucketfill" && !customizing && (
        <BucketPour app={app} pour={pour} />
      )}
    </Section>
  );
};
