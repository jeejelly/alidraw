import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { useEffect, useMemo, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { useAtom } from "../app-jotai";

import { getWorkspaceBridge, type SceneEntry } from "./desktopBridge";
import { openWorkspaceScene } from "./openWorkspaceScene";
import { SceneTreeView } from "./SceneTree";
import {
  activeWorkspaceAtom,
  openSceneDialogOpenAtom,
  saveCopyDialogOpenAtom,
} from "./workspaceState";

import "./Workspace.scss";

/**
 * Open, in a workspace: the project's scenes, nothing else to read. Whatever is
 * on the canvas is already kept (autosave, versions), so there is no warning,
 * only a note when the canvas is not a file of the project yet.
 */
export const OpenSceneDialog = ({
  api,
}: {
  api: ExcalidrawImperativeAPI | null;
}) => {
  const bridge = getWorkspaceBridge();
  const [open, setOpen] = useAtom(openSceneDialogOpenAtom);
  const [active] = useAtom(activeWorkspaceAtom);
  const [, setSaveCopy] = useAtom(saveCopyDialogOpenAtom);
  const [scenes, setScenes] = useState<SceneEntry[]>([]);
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !bridge || !active) {
      return;
    }
    setError(null);
    setQuery("");
    bridge
      .scenes(active.id)
      .then(setScenes)
      .catch((e) => setError(e?.message ?? String(e)));
  }, [open, bridge, active]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? scenes.filter((s) => s.path.toLowerCase().includes(q)) : scenes;
  }, [scenes, query]);

  if (!bridge || !open || !api || !active) {
    return null;
  }

  const unsaved =
    api.getSceneElements().length > 0 && !api.getAppState().fileHandle;

  const openScene = async (path: string) => {
    try {
      await openWorkspaceScene(api, active, path);
      setOpen(false);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  return (
    <Dialog
      onCloseRequest={() => setOpen(false)}
      title={`Open from ${active.name}`}
      size="small"
      className="workspace-dialog"
    >
      <div className="opensceme" data-testid="open-scene">
        {unsaved && (
          <p className="workspace__note" data-testid="open-unsaved">
            This canvas is not a file of the project yet.{" "}
            <button
              type="button"
              className="workspace__link"
              data-testid="open-save-copy"
              onClick={() => {
                setOpen(false);
                setSaveCopy(true);
              }}
            >
              Save it first…
            </button>
          </p>
        )}
        <input
          type="search"
          data-testid="open-search"
          placeholder="Find a scene"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
        />
        {shown.length ? (
          <ul className="workspace__tree" data-testid="open-list">
            <SceneTreeView
              scenes={shown}
              closed={query ? {} : closed}
              onToggle={(p) => setClosed((c) => ({ ...c, [p]: !c[p] }))}
              leaf={(scene, depth, name) => (
                <button
                  type="button"
                  className="workspace__leaf"
                  style={{ paddingLeft: `${0.5 + depth * 0.9}rem` }}
                  data-testid="open-scene-item"
                  onClick={() => openScene(scene.path)}
                >
                  {name}
                </button>
              )}
            />
          </ul>
        ) : (
          <p className="workspace__note">
            {scenes.length
              ? "No scene matches."
              : "No scene in this project yet."}
          </p>
        )}
        {error && <p className="workspace__error">{error}</p>}
        <div className="workspace__row">
          <button
            type="button"
            data-testid="open-import"
            onClick={() => {
              setOpen(false);
              api.importFromPicker?.();
            }}
          >
            Import files…
          </button>
        </div>
      </div>
    </Dialog>
  );
};
