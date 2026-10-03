import { Fold } from "./Fold";

import type { WorkspaceEntry } from "./desktopBridge";
import type { ActiveWorkspace } from "./workspaceState";

/** The registered workspaces; the active one expands to show `sceneList`. */
export const WorkspaceList = ({
  list,
  active,
  sceneList,
  onSelect,
  onForget,
  onOpenFolder,
  onNewScene,
}: {
  list: WorkspaceEntry[];
  active: ActiveWorkspace | null;
  sceneList: React.ReactNode;
  onSelect: (workspace: WorkspaceEntry) => void;
  onForget: (workspace: WorkspaceEntry) => void;
  onOpenFolder: () => void;
  onNewScene: () => void;
}) => (
  <Fold
    id="workspaces"
    title="Workspaces"
    badge={list.length}
    actions={
      <>
        <button
          type="button"
          className="workspace__tool"
          data-testid="workspace-open-folder"
          title="Use an existing folder as a workspace"
          onClick={onOpenFolder}
        >
          ⌂
        </button>
        <button
          type="button"
          className="workspace__tool"
          data-testid="workspace-new-scene"
          title="New scene in this workspace"
          disabled={!active}
          onClick={onNewScene}
        >
          ＋
        </button>
      </>
    }
  >
    {list.length === 0 && (
      <p className="workspace__hint">
        A workspace is a folder for a project. Save a scene and choose a folder,
        or create one below.
      </p>
    )}
    <ul className="workspace__list">
      {list.map((workspace) => (
        <li key={workspace.id}>
          <div className="workspace__row">
            <button
              type="button"
              className={`workspace__item${
                active?.id === workspace.id ? " is-active" : ""
              }`}
              data-testid="workspace-item"
              disabled={workspace.exists === false}
              onClick={() => onSelect(workspace)}
            >
              <span className="workspace__chev">
                {active?.id === workspace.id ? "▾" : "▸"}
              </span>
              <span className="workspace__icon">▣</span>
              <span className="workspace__label">
                <strong>{workspace.name}</strong>
                <span>
                  {workspace.exists === false
                    ? "folder missing"
                    : workspace.path}
                </span>
              </span>
            </button>
            <button
              type="button"
              className="workspace__forget"
              title="Remove from the list (files stay)"
              onClick={() => onForget(workspace)}
            >
              ×
            </button>
          </div>
          {active?.id === workspace.id && sceneList}
        </li>
      ))}
    </ul>
    {active &&
      !list.some((workspace) => workspace.id === active.id) &&
      sceneList}
  </Fold>
);
