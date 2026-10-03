import { useState } from "react";

import { IconButton } from "./ProjectIcons";
import { SceneTreeView } from "./SceneTree";

import type { SceneEntry } from "./desktopBridge";

const indent = (depth: number) => ({ paddingLeft: `${0.5 + depth * 0.9}rem` });

/** The scene browser: open, rename, duplicate and delete scenes. */
export const ProjectScenes = ({
  scenes,
  currentPath,
  onNewScene,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}: {
  scenes: SceneEntry[];
  currentPath: string | null;
  onNewScene: () => void;
  onOpen: (scene: SceneEntry) => void;
  onRename: (path: string, value: string) => void;
  onDuplicate: (path: string) => void;
  onDelete: (path: string) => void;
}) => {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [renaming, setRenaming] = useState<{
    path: string;
    value: string;
  } | null>(null);

  const finishRename = () => {
    const pending = renaming;
    setRenaming(null);
    if (pending) {
      onRename(pending.path, pending.value);
    }
  };

  const confirmDelete = (path: string) => {
    if (window.confirm(`Delete ${path}? Its versions stay in git.`)) {
      onDelete(path);
    }
  };

  return (
    <>
      <div className="project__head">
        <strong>Scenes</strong>
        <IconButton
          icon="plus"
          title="New scene"
          onClick={onNewScene}
          testId="project-new-scene"
        />
      </div>
      <ul
        className="workspace__scenes project__tree"
        data-testid="project-scenes"
      >
        <SceneTreeView
          scenes={scenes}
          closed={closed}
          onToggle={(path) =>
            setClosed((current) => ({ ...current, [path]: !current[path] }))
          }
          leaf={(scene, depth, label) =>
            renaming?.path === scene.path ? (
              <div className="project__row" style={indent(depth)}>
                <input
                  autoFocus
                  className="project__input"
                  data-testid="project-rename-input"
                  value={renaming.value}
                  onChange={(event) =>
                    setRenaming({ path: scene.path, value: event.target.value })
                  }
                  onBlur={finishRename}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Enter") {
                      finishRename();
                    } else if (event.key === "Escape") {
                      setRenaming(null);
                    }
                  }}
                />
              </div>
            ) : (
              <div
                className={`project__scene${
                  scene.path === currentPath ? " is-active" : ""
                }`}
              >
                <button
                  type="button"
                  className="workspace__leaf"
                  data-testid="project-scene"
                  style={indent(depth)}
                  title={scene.path}
                  onClick={() => onOpen(scene)}
                >
                  <span className="workspace__icon">▧</span>
                  {label}
                </button>
                <span className="project__actions">
                  <IconButton
                    icon="pencil"
                    title="Rename"
                    testId="project-rename"
                    onClick={() =>
                      setRenaming({ path: scene.path, value: label })
                    }
                  />
                  <IconButton
                    icon="copy"
                    title="Duplicate"
                    testId="project-duplicate"
                    onClick={() => onDuplicate(scene.path)}
                  />
                  <IconButton
                    icon="trash"
                    title="Delete (git keeps its history)"
                    testId="project-delete"
                    onClick={() => confirmDelete(scene.path)}
                  />
                </span>
              </div>
            )
          }
        />
        {scenes.length === 0 && (
          <li className="workspace__hint">No scenes yet.</li>
        )}
      </ul>
    </>
  );
};
