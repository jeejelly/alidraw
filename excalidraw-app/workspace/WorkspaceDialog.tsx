import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { useAtom } from "../app-jotai";

import { getWorkspaceBridge } from "./desktopBridge";
import { GitMissingBanner } from "./GitMissingBanner";
import { NewWorkspaceFold } from "./NewWorkspaceFold";
import { ServerSection } from "./ServerSection";
import { SharingFold } from "./SharingFold";
import { useCurrentScenePath } from "./useCurrentScenePath";
import { useGuardedBridge } from "./useGuardedBridge";
import { useWorkspaceData } from "./useWorkspaceData";
import { useWorkspaceNavigation } from "./useWorkspaceNavigation";
import { useWorkspaceSharing } from "./useWorkspaceSharing";
import { VersionHistoryFold } from "./VersionHistoryFold";
import { viewGitStatus } from "./gitStatusView";
import { WorkspaceGitHeader } from "./WorkspaceGitHeader";
import { WorkspaceList } from "./WorkspaceList";
import { WorkspaceSceneList } from "./WorkspaceSceneList";
import { WorkspaceSettingsFold } from "./WorkspaceSettingsFold";
import { activeWorkspaceAtom, workspaceDialogOpenAtom } from "./workspaceState";

import "./Workspace.scss";

/** Workspaces: named project folders, kept in git, opened and saved without file dialogs. */
export const WorkspaceDialog = ({
  api,
}: {
  api: ExcalidrawImperativeAPI | null;
}) => {
  const bridge = getWorkspaceBridge();
  const [open, setOpen] = useAtom(workspaceDialogOpenAtom);
  const [active] = useAtom(activeWorkspaceAtom);
  const [name, setName] = useState("");
  const [closedDirs, setClosedDirs] = useState<Record<string, boolean>>({});

  const currentPath = useCurrentScenePath(api, active);
  const guarded = useGuardedBridge(bridge, active);
  const data = useWorkspaceData({
    bridge,
    open,
    active,
    currentPath,
    guard: guarded.guard,
  });
  const sharing = useWorkspaceSharing({
    bridge,
    guarded,
    refresh: data.refresh,
    settings: data.settings,
    setSettings: data.setSettings,
    remoteUrl: data.remoteUrl,
  });
  const navigation = useWorkspaceNavigation({
    bridge,
    api,
    active,
    currentPath,
    guarded,
    refresh: data.refresh,
    onSelect: () => {
      data.setRemoteUrl("");
      sharing.setNotice(null);
    },
  });

  if (!bridge || !open) {
    return null;
  }

  const { changes, hasRemote, syncInfo, paused } = viewGitStatus(data.status);

  const installGit = () =>
    guarded.guard(async () => {
      const result = await bridge.installGit();
      if (result.help) {
        guarded.setError(result.help);
      }
      data.setGitInfo(await bridge.gitInfo());
    });

  const changeAssetMode = (mode: "embedded" | "linked") =>
    guarded.withActive(async (activeBridge, workspace) => {
      data.setAssets(mode);
      await activeBridge.setMeta(workspace.id, { assets: mode });
    });

  const sceneList = (
    <WorkspaceSceneList
      scenes={data.scenes}
      currentPath={currentPath}
      closedDirs={closedDirs}
      onToggleDir={(path) =>
        setClosedDirs((closed) => ({ ...closed, [path]: !closed[path] }))
      }
      onOpen={navigation.openScene}
    />
  );

  return (
    <Dialog
      onCloseRequest={() => setOpen(false)}
      title="Workspaces"
      size="wide"
      className="workspace-dialog"
    >
      {data.gitInfo && !data.gitInfo.installed && (
        <GitMissingBanner help={data.gitInfo.help} onInstall={installGit} />
      )}
      {guarded.error && (
        <div className="workspace__error" role="alert">
          {guarded.error}
        </div>
      )}

      <div className="workspace__browser">
        <aside className="workspace__tree">
          <WorkspaceList
            list={data.list}
            active={active}
            sceneList={sceneList}
            onSelect={navigation.select}
            onForget={navigation.forget}
            onOpenFolder={navigation.openFolder}
            onNewScene={navigation.newScene}
          />
          <NewWorkspaceFold
            name={name}
            expandedByDefault={data.list.length === 0}
            onNameChange={setName}
            onCreate={() => navigation.create(name, () => setName(""))}
          />
          <label className="workspace__setting workspace__pause">
            <input
              type="checkbox"
              data-testid="workspace-pause"
              checked={paused}
              onChange={(event) => sharing.setPaused(event.target.checked)}
            />
            Pause all network use
          </label>
        </aside>

        <main className="workspace__detail">
          {active ? (
            <>
              <WorkspaceGitHeader
                name={active.name}
                status={data.status}
                changeCount={changes.length}
                onCommitNow={() =>
                  guarded
                    .guard(() => bridge.commitNow(active.id))
                    .then(data.refresh)
                }
              />
              <VersionHistoryFold
                currentPath={currentPath}
                history={data.history}
                onRestore={navigation.restore}
              />
              <SharingFold
                hasRemote={hasRemote}
                remoteUrl={data.remoteUrl}
                settings={data.settings}
                syncInfo={syncInfo}
                notice={sharing.notice}
                onRemoteUrlChange={data.setRemoteUrl}
                onSaveRemote={sharing.saveRemote}
                onSaveSettings={sharing.saveSettings}
                onSync={sharing.runSync}
                onResolve={sharing.resolve}
              />
              <ServerSection key={active.id} bridge={bridge} id={active.id} />
              <WorkspaceSettingsFold
                settings={data.settings}
                assets={data.assets}
                onSaveSettings={sharing.saveSettings}
                onAssetsChange={changeAssetMode}
              />
            </>
          ) : (
            <p className="workspace__hint">
              Choose a workspace to see its scenes and settings.
            </p>
          )}
        </main>
      </div>
    </Dialog>
  );
};
