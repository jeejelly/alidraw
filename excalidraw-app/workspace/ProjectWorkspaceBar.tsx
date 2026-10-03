import { useState } from "react";

import { IconButton } from "./ProjectIcons";

import type { WorkspaceEntry } from "./desktopBridge";
import type { ActiveWorkspace } from "./workspaceState";

/** Workspace picker with the open-folder, new and settings buttons. */
export const ProjectWorkspaceBar = ({
  list,
  active,
  onSelect,
  onOpenFolder,
  onCreate,
  onOpenSettings,
}: {
  list: WorkspaceEntry[];
  active: ActiveWorkspace | null;
  onSelect: (id: string) => void;
  onOpenFolder: () => void;
  onCreate: (name: string, onCreated: () => void) => void;
  onOpenSettings: () => void;
}) => {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const create = () =>
    onCreate(name, () => {
      setName("");
      setCreating(false);
    });

  return (
    <>
      <div className="project__row">
        <select
          className="project__select"
          data-testid="project-select"
          value={active?.id ?? ""}
          onChange={(event) => onSelect(event.target.value)}
        >
          <option value="">Choose a workspace…</option>
          {list.map((workspace) => (
            <option
              key={workspace.id}
              value={workspace.id}
              disabled={workspace.exists === false}
            >
              {workspace.name}
              {workspace.exists === false ? " (folder missing)" : ""}
            </option>
          ))}
        </select>
        <IconButton
          icon="folder"
          title="Use an existing folder as a workspace"
          onClick={onOpenFolder}
          testId="project-open-folder"
        />
        <IconButton
          icon="plus"
          title="New workspace"
          onClick={() => setCreating((isCreating) => !isCreating)}
          testId="project-new"
        />
        <IconButton
          icon="gear"
          title="Settings: sharing, backup server, images"
          onClick={onOpenSettings}
          disabled={!active}
          testId="project-settings"
        />
      </div>

      {creating && (
        <div className="project__row">
          <input
            className="project__input"
            data-testid="project-name"
            placeholder="Name of the new workspace"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter" && name.trim()) {
                create();
              }
            }}
          />
          <button
            type="button"
            className="project__button"
            disabled={!name.trim()}
            onClick={create}
            data-testid="project-create"
          >
            Choose folder…
          </button>
        </div>
      )}
    </>
  );
};
