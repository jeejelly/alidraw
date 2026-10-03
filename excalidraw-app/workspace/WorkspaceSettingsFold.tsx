import { Fold } from "./Fold";

import type { WorkspaceEntry } from "./desktopBridge";

type Settings = WorkspaceEntry["settings"];
type AssetMode = "embedded" | "linked";

export const WorkspaceSettingsFold = ({
  settings,
  assets,
  onSaveSettings,
  onAssetsChange,
}: {
  settings: Settings;
  assets: AssetMode;
  onSaveSettings: (patch: Settings) => void;
  onAssetsChange: (mode: AssetMode) => void;
}) => (
  <Fold id="settings" title="Settings" defaultOpen={false}>
    <label className="workspace__setting">
      <input
        type="checkbox"
        data-testid="workspace-autocommit"
        checked={settings.autoCommit !== false}
        onChange={(event) =>
          onSaveSettings({ autoCommit: event.target.checked })
        }
      />
      Commit automatically after
      <input
        type="number"
        min={5}
        max={3600}
        value={settings.delaySec ?? 60}
        disabled={settings.autoCommit === false}
        onChange={(event) => onSaveSettings({ delaySec: +event.target.value })}
        onKeyDown={(event) => event.stopPropagation()}
      />
      s without edits
    </label>
    <label className="workspace__setting">
      New images are saved
      <select
        data-testid="workspace-assets"
        value={assets}
        onChange={(event) => onAssetsChange(event.target.value as AssetMode)}
      >
        <option value="embedded">inside the scene file</option>
        <option value="linked">as linked files in assets/</option>
      </select>
    </label>
  </Fold>
);
