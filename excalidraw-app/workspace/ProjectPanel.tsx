import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { useAtom, useSetAtom } from "../app-jotai";

import { getWorkspaceBridge } from "./desktopBridge";
import { viewGitStatus } from "./gitStatusView";
import { ProjectPictures } from "./ProjectPictures";
import { ProjectScenes } from "./ProjectScenes";
import { ProjectVersions } from "./ProjectVersions";
import { ProjectWorkspaceBar } from "./ProjectWorkspaceBar";
import { useCurrentScenePath } from "./useCurrentScenePath";
import { useGuardedBridge } from "./useGuardedBridge";
import { useProjectActions } from "./useProjectActions";
import { useProjectData } from "./useProjectData";
import { activeWorkspaceAtom, workspaceDialogOpenAtom } from "./workspaceState";

import "./Workspace.scss";

/**
 * The project browser: workspaces, their scenes (rename, duplicate, delete),
 * versions (commit, check for updates, pull, push), and the pictures kept
 * with the project. It lives in the palette so it is always at hand.
 */
export const ProjectPanel = ({ api }: { api: ExcalidrawImperativeAPI }) => {
  const bridge = getWorkspaceBridge();
  const [active] = useAtom(activeWorkspaceAtom);
  const setSettingsOpen = useSetAtom(workspaceDialogOpenAtom);

  const currentPath = useCurrentScenePath(api, active);
  const guarded = useGuardedBridge(bridge, active);
  const data = useProjectData({
    bridge,
    active,
    currentPath,
    guard: guarded.guard,
  });
  const actions = useProjectActions({
    bridge,
    api,
    active,
    currentPath,
    list: data.list,
    guarded,
    refresh: data.refresh,
  });

  if (!bridge) {
    return null;
  }

  const { changes, isRepo, hasRemote, ahead, behind, branch } = viewGitStatus(
    data.status,
  );

  return (
    <div className="project" data-testid="project-panel">
      <ProjectWorkspaceBar
        list={data.list}
        active={active}
        onSelect={actions.select}
        onOpenFolder={actions.openFolder}
        onCreate={actions.create}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {guarded.error && (
        <div className="workspace__error" role="alert">
          {guarded.error}
        </div>
      )}

      {!active ? (
        <p className="workspace__hint">
          A workspace is a project folder, kept in git. Choose one, or make a
          new one.
        </p>
      ) : (
        <>
          <div className="project__status" data-testid="project-status">
            {isRepo ? (
              <>
                <span className="workspace__badge">⎇ {branch}</span>
                <span>
                  {changes.length
                    ? `${changes.length} change${changes.length > 1 ? "s" : ""}`
                    : "all committed"}
                </span>
                {hasRemote && (
                  <span title="to push / to pull">
                    ↑{ahead} ↓{behind}
                  </span>
                )}
              </>
            ) : (
              <span>Not under git</span>
            )}
          </div>

          <ProjectScenes
            scenes={data.scenes}
            currentPath={currentPath}
            onNewScene={actions.newScene}
            onOpen={actions.openScene}
            onRename={actions.renameScene}
            onDuplicate={actions.duplicateScene}
            onDelete={actions.deleteScene}
          />

          {isRepo && (
            <ProjectVersions
              changes={changes}
              hasRemote={hasRemote}
              behind={behind}
              busy={actions.busy}
              note={actions.note}
              currentPath={currentPath}
              history={data.history}
              onCommit={actions.commit}
              onSync={actions.sync}
              onRestore={actions.restoreVersion}
            />
          )}

          <ProjectPictures
            workspaceId={active.id}
            assets={data.assets}
            thumbs={data.thumbs}
            onInsert={actions.insertAsset}
            onImport={() => api.importFromPicker()}
          />
        </>
      )}
    </div>
  );
};
