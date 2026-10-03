import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";
import { useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { useAtom } from "../app-jotai";

import { getWorkspaceBridge } from "./desktopBridge";
import { externalizeAssets } from "./linkedAssets";
import { openWorkspaceScene } from "./openWorkspaceScene";
import { SceneTargetForm } from "./SceneTargetForm";
import {
  activeWorkspaceAtom,
  saveCopyDialogOpenAtom,
  saveRequestAtom,
  workspaceDialogOpenAtom,
  type ActiveWorkspace,
  type SceneTarget,
} from "./workspaceState";

import "./Workspace.scss";

const withoutExtension = (name: string) => name.replace(/\.excalidraw$/i, "");

/**
 * The one place a scene gets its name: the first save, a copy, or Save as.
 * A copy leaves you on the file you were editing; Save as moves you to the new one.
 */
export const SaveCopyDialog = ({
  api,
}: {
  api: ExcalidrawImperativeAPI | null;
}) => {
  const bridge = getWorkspaceBridge();
  const [copyOpen, setCopyOpen] = useAtom(saveCopyDialogOpenAtom);
  const [request] = useAtom(saveRequestAtom);
  const [workspace] = useAtom(activeWorkspaceAtom);
  const [, setWorkspaceDialogOpen] = useAtom(workspaceDialogOpenAtom);
  const [target, setTarget] = useState<SceneTarget>({ name: "" });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (!bridge || !api || !(copyOpen || request)) {
    return null;
  }

  const close = () => {
    if (request) {
      request.cancel();
    }
    setCopyOpen(false);
    setError(null);
    setDone(null);
  };

  if (!workspace) {
    return (
      <Dialog
        onCloseRequest={close}
        title="Save"
        size="small"
        className="workspace-dialog"
      >
        <div className="savecopy">
          <p className="workspace__note">
            Scenes are saved in a project. Choose or create one first.
          </p>
          <button
            type="button"
            data-testid="savecopy-choose-project"
            onClick={() => {
              setCopyOpen(false);
              setWorkspaceDialogOpen(true);
            }}
          >
            Choose a project…
          </button>
        </div>
      </Dialog>
    );
  }

  const copyScene = async (active: ActiveWorkspace, openIt: boolean) => {
    try {
      setError(null);
      const text = await externalizeAssets(
        bridge,
        active.id,
        serializeAsJSON(
          api.getSceneElements(),
          api.getAppState(),
          api.getFiles(),
          "local",
        ),
        (await bridge.meta(active.id)).assets === "linked"
          ? "linked"
          : "embedded",
      );
      const { path } = await bridge.saveNew(
        active.id,
        target.name || "Untitled",
        text,
        target.dir,
      );
      if (openIt) {
        await openWorkspaceScene(api, active, path);
        setCopyOpen(false);
      } else {
        setDone(`Saved a copy: ${path}`);
      }
    } catch (failure: any) {
      if (failure?.name !== "AbortError") {
        setError(failure?.message ?? String(failure));
      }
    }
  };

  const initialName = request
    ? request.defaultName
    : `${withoutExtension(api.getName() || "Untitled")} copy`;
  const ready = target.name.length > 0;

  return (
    <Dialog
      onCloseRequest={close}
      title={request ? "Save" : "Save a copy"}
      size="small"
      className="workspace-dialog"
    >
      <div className="savecopy">
        <SceneTargetForm
          workspace={workspace}
          initialName={withoutExtension(initialName)}
          onChange={setTarget}
          onSubmit={() =>
            request ? request.resolve(target) : copyScene(workspace, false)
          }
        />
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
        {request ? (
          <div className="savecopy__buttons">
            <button
              type="button"
              data-testid="savecopy-save"
              disabled={!ready}
              onClick={() => request.resolve(target)}
            >
              Save
            </button>
          </div>
        ) : (
          <>
            <div className="savecopy__buttons">
              <button
                type="button"
                data-testid="savecopy-copy"
                disabled={!ready}
                onClick={() => copyScene(workspace, false)}
              >
                Save a copy
              </button>
              <button
                type="button"
                data-testid="savecopy-open"
                disabled={!ready}
                onClick={() => copyScene(workspace, true)}
              >
                Save as and open it
              </button>
            </div>
            <p className="workspace__hint">
              A copy keeps you on the file you are editing. Save as moves you to
              the new file.
            </p>
          </>
        )}
      </div>
    </Dialog>
  );
};
