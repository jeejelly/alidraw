import { Fold } from "./Fold";

import type { SyncInfo, WorkspaceEntry } from "./desktopBridge";

type Settings = WorkspaceEntry["settings"];

export const SharingFold = ({
  hasRemote,
  remoteUrl,
  settings,
  syncInfo,
  notice,
  onRemoteUrlChange,
  onSaveRemote,
  onSaveSettings,
  onSync,
  onResolve,
}: {
  hasRemote: boolean;
  remoteUrl: string;
  settings: Settings;
  syncInfo: SyncInfo | null;
  notice: string | null;
  onRemoteUrlChange: (url: string) => void;
  onSaveRemote: () => void;
  onSaveSettings: (patch: Settings) => void;
  onSync: (options?: { pull?: boolean; push?: boolean }) => void;
  onResolve: (choice: "merge" | "branch") => void;
}) => (
  <Fold id="sharing" title="Sharing" badge={hasRemote ? "remote" : ""}>
    <div className="workspace__remote">
      <input
        data-testid="workspace-remote"
        placeholder="Remote address: https://…, ssh://…, user@host:path"
        value={remoteUrl}
        onChange={(event) => onRemoteUrlChange(event.target.value)}
        onKeyDown={(event) => event.stopPropagation()}
      />
      <button
        type="button"
        data-testid="workspace-remote-save"
        disabled={!remoteUrl.trim()}
        onClick={onSaveRemote}
      >
        Save
      </button>
    </div>
    <label className="workspace__setting">
      Share
      <select
        data-testid="workspace-push"
        value={settings.push ?? "manual"}
        onChange={(event) =>
          onSaveSettings({ push: event.target.value as Settings["push"] })
        }
      >
        <option value="manual">only when I press Sync</option>
        <option value="afterCommit">after each automatic commit</option>
        <option value="interval">every few minutes</option>
      </select>
      {settings.push === "interval" && (
        <>
          <input
            type="number"
            min={30}
            value={settings.syncEverySec ?? 300}
            onChange={(event) =>
              onSaveSettings({ syncEverySec: +event.target.value })
            }
            onKeyDown={(event) => event.stopPropagation()}
          />
          s
        </>
      )}
    </label>
    <label className="workspace__setting">
      <input
        type="checkbox"
        data-testid="workspace-pull-on-open"
        checked={settings.pullOnOpen !== false}
        onChange={(event) =>
          onSaveSettings({ pullOnOpen: event.target.checked })
        }
      />
      Pull when I open this workspace
    </label>
    <div className="workspace__git">
      <button
        type="button"
        data-testid="workspace-sync"
        disabled={!hasRemote}
        onClick={() => onSync()}
      >
        Sync now
      </button>
      <button
        type="button"
        data-testid="workspace-pull"
        disabled={!hasRemote}
        onClick={() => onSync({ push: false })}
      >
        Pull
      </button>
      <button
        type="button"
        data-testid="workspace-push-now"
        disabled={!hasRemote}
        onClick={() => onSync({ pull: false })}
      >
        Push
      </button>
    </div>
    {(notice || syncInfo?.message) && (
      <div className="workspace__hint" data-testid="workspace-sync-message">
        {notice ?? syncInfo?.message}
      </div>
    )}
    {syncInfo?.state === "diverged" && (
      <div className="workspace__banner" data-testid="workspace-diverged">
        Both this workspace and its remote have new commits. Nothing has been
        pushed or overwritten.
        <div className="workspace__choices">
          <button
            type="button"
            data-testid="workspace-merge"
            onClick={() => onResolve("merge")}
          >
            Try to merge
          </button>
          <button
            type="button"
            data-testid="workspace-branch"
            onClick={() => onResolve("branch")}
          >
            Continue on a new branch
          </button>
        </div>
      </div>
    )}
  </Fold>
);
