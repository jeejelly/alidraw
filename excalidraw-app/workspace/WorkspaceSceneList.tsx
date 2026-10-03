import { SceneTreeView } from "./SceneTree";

import type { SceneEntry } from "./desktopBridge";

export const WorkspaceSceneList = ({
  scenes,
  currentPath,
  closedDirs,
  onToggleDir,
  onOpen,
}: {
  scenes: SceneEntry[];
  currentPath: string | null;
  closedDirs: Record<string, boolean>;
  onToggleDir: (path: string) => void;
  onOpen: (scene: SceneEntry) => void;
}) => (
  <ul className="workspace__scenes">
    <SceneTreeView
      scenes={scenes}
      closed={closedDirs}
      onToggle={onToggleDir}
      leaf={(scene, depth, name) => (
        <button
          type="button"
          data-testid="workspace-scene"
          className={`workspace__leaf${
            scene.path === currentPath ? " is-active" : ""
          }`}
          style={{ paddingLeft: `${0.5 + depth * 0.9}rem` }}
          title={scene.path}
          onClick={() => onOpen(scene)}
        >
          <span className="workspace__icon">▧</span>
          {name}
        </button>
      )}
    />
    {scenes.length === 0 && <li className="workspace__hint">No scenes yet.</li>}
  </ul>
);
