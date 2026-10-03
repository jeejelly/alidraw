import { loadFromBlob } from "@excalidraw/excalidraw/data/blob";
import { CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { appJotaiStore } from "../app-jotai";
import { autosaveToFileAtom } from "../autosave/autosavePreference";

import { getWorkspaceBridge } from "./desktopBridge";
import { hydrateAssets } from "./linkedAssets";
import { WorkspaceFileHandle } from "./WorkspaceFileHandle";
import { activeWorkspaceAtom } from "./workspaceState";

/**
 * Opens a scene of a workspace: the file's content becomes the canvas and its
 * handle the active file, so Save and autosave write back to it. Autosave is
 * switched on, which is what a workspace is for.
 */
export const openWorkspaceScene = async (
  api: ExcalidrawImperativeAPI,
  workspace: { id: string; name: string },
  path: string,
  /** open this text instead of the file's (restoring an older version) */
  override?: string,
) => {
  const bridge = getWorkspaceBridge();
  if (!bridge) {
    throw new Error("not the desktop app");
  }
  const text = await hydrateAssets(
    bridge,
    workspace.id,
    override ?? (await bridge.read(workspace.id, path)),
  );
  const handle = new WorkspaceFileHandle(bridge, workspace.id, path);
  const file = new File([text], handle.name, { type: "application/json" });
  const data = await loadFromBlob(
    file,
    api.getAppState() as any,
    null,
    handle as unknown as FileSystemFileHandle,
  );
  api.updateScene({
    elements: data.elements,
    appState: { ...data.appState, fileHandle: handle as any },
    captureUpdate: CaptureUpdateAction.NEVER,
  });
  const files = Object.values(data.files ?? {});
  if (files.length) {
    api.addFiles(files);
  }
  api.history.clear();
  const live = data.elements.filter((element) => !element.isDeleted);
  if (live.length) {
    api.setViewport({ target: live, fit: "scale-down", animate: false } as any);
  }
  appJotaiStore.set(activeWorkspaceAtom, workspace);
  appJotaiStore.set(autosaveToFileAtom, true);
};
