import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";
import { useEffect, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { useAtom } from "../app-jotai";

import { getWorkspaceBridge, type SceneEntry } from "./desktopBridge";
import { externalizeAssets } from "./linkedAssets";
import { openWorkspaceScene } from "./openWorkspaceScene";
import { activeWorkspaceAtom, saveCopyDialogOpenAtom } from "./workspaceState";

import "./Workspace.scss";

/**
 * Save as, or as a copy: the drawing goes to a new file of the workspace under a name
 * you choose. A copy leaves you on the file you were editing; Save as moves you to the new one.
 */
export const SaveCopyDialog = ({
  api,
}: {
  api: ExcalidrawImperativeAPI | null;
}) => {
  const bridge = getWorkspaceBridge();
  const [open, setOpen] = useAtom(saveCopyDialogOpenAtom);
  const [active, setActive] = useAtom(activeWorkspaceAtom);
  const [name, setName] = useState("");
  const [dir, setDir] = useState("");
  const [dirs, setDirs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !api) {
      return;
    }
    const current = api.getName() || "Untitled";
    setName(`${current.replace(/\.excalidraw$/i, "")} copy`);
    setDone(null);
    setError(null);
    setDir("");
    if (bridge && active) {
      bridge
        .scenes(active.id)
        .then((scenes: SceneEntry[]) =>
          setDirs(
            [
              ...new Set(
                scenes
                  .map((s) => s.path.split("/").slice(0, -1).join("/"))
                  .filter(Boolean),
              ),
            ].sort(),
          ),
        )
        .catch(() => setDirs([]));
    } else {
      setDirs([]);
    }
  }, [open, api, bridge, active]);

  if (!bridge || !open || !api) {
    return null;
  }

  const save = async (openIt: boolean) => {
    try {
      setError(null);
      let ws = active;
      if (!ws) {
        const folder = await bridge.pickFolder();
        if (!folder) {
          return;
        }
        const entry = await bridge.open({ token: folder.token });
        ws = { id: entry.id, name: entry.name };
        setActive(ws);
      }
      const text = await externalizeAssets(
        bridge,
        ws.id,
        serializeAsJSON(
          api.getSceneElements(),
          api.getAppState(),
          api.getFiles(),
          "local",
        ),
        (await bridge.meta(ws.id)).assets === "linked" ? "linked" : "embedded",
      );
      const { path } = await bridge.saveNew(
        ws.id,
        name.trim() || "Untitled",
        text,
        dir || undefined,
      );
      if (openIt) {
        await openWorkspaceScene(api, ws, path);
        setOpen(false);
      } else {
        setDone(`Saved a copy: ${path}`);
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setError(e?.message ?? String(e));
      }
    }
  };

  return (
    <Dialog
      onCloseRequest={() => setOpen(false)}
      title="Save a copy"
      size="small"
      className="workspace-dialog"
    >
      <div className="savecopy">
        <label>
          Name
          <input
            data-testid="savecopy-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter" && name.trim()) {
                save(false);
              }
            }}
          />
        </label>
        <label>
          In
          <select
            data-testid="savecopy-dir"
            value={dir}
            onChange={(e) => setDir(e.target.value)}
          >
            <option value="">
              {active ? `${active.name} (top folder)` : "A folder you choose"}
            </option>
            {dirs.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <div className="workspace__error" role="alert">
            {error}
          </div>
        )}
        {done && (
          <div className="workspace__hint" data-testid="savecopy-done">
            {done}
          </div>
        )}
        <div className="savecopy__buttons">
          <button
            type="button"
            data-testid="savecopy-copy"
            disabled={!name.trim()}
            onClick={() => save(false)}
          >
            Save a copy
          </button>
          <button
            type="button"
            data-testid="savecopy-open"
            disabled={!name.trim()}
            onClick={() => save(true)}
          >
            Save as and open it
          </button>
        </div>
        <p className="workspace__hint">
          A copy keeps you on the file you are editing. Save as moves you to the
          new file.
        </p>
      </div>
    </Dialog>
  );
};
