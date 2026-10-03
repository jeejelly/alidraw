import { useEffect, useState } from "react";

import { getWorkspaceBridge, type SceneEntry } from "./desktopBridge";

import type { SceneTarget } from "./workspaceState";

const foldersOf = (scenes: SceneEntry[]) =>
  [
    ...new Set(
      scenes
        .map((scene) => scene.path.split("/").slice(0, -1).join("/"))
        .filter(Boolean),
    ),
  ].sort();

/** the name of a scene and the folder of the workspace it goes to */
export const SceneTargetForm = ({
  workspace,
  initialName,
  onChange,
  onSubmit,
}: {
  workspace: { id: string; name: string };
  initialName: string;
  onChange: (target: SceneTarget) => void;
  onSubmit: () => void;
}) => {
  const bridge = getWorkspaceBridge();
  const [name, setName] = useState(initialName);
  const [dir, setDir] = useState("");
  const [folders, setFolders] = useState<string[]>([]);

  useEffect(() => {
    bridge
      ?.scenes(workspace.id)
      .then((scenes) => setFolders(foldersOf(scenes)))
      .catch(() => setFolders([]));
  }, [bridge, workspace.id]);

  useEffect(() => {
    onChange({ name: name.trim(), dir: dir || undefined });
  }, [name, dir, onChange]);

  return (
    <>
      <label>
        Name
        <input
          data-testid="savecopy-name"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter" && name.trim()) {
              onSubmit();
            }
          }}
        />
      </label>
      <label>
        In
        <select
          data-testid="savecopy-dir"
          value={dir}
          onChange={(event) => setDir(event.target.value)}
        >
          <option value="">{`${workspace.name} (top folder)`}</option>
          {folders.map((folder) => (
            <option key={folder} value={folder}>
              {folder}
            </option>
          ))}
        </select>
      </label>
    </>
  );
};
