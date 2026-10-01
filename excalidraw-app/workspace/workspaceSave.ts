import {
  setFileSaveProvider,
  setHostCapabilities,
} from "@excalidraw/excalidraw";

import { appJotaiStore } from "../app-jotai";

import { blobText } from "./blobText";
import { getWorkspaceBridge } from "./desktopBridge";
import { externalizeAssets } from "./linkedAssets";
import { WorkspaceFileHandle } from "./WorkspaceFileHandle";
import { activeWorkspaceAtom } from "./workspaceState";

const abort = () => {
  const e = new Error("The user aborted a request.");
  e.name = "AbortError";
  return e;
};

/**
 * In the desktop app, saving a scene file never shows a file dialog: with an
 * active workspace the file goes straight into it; without one, the first
 * save asks only for a folder, and that folder becomes the workspace.
 */
export const installWorkspaceSave = () => {
  const bridge = getWorkspaceBridge();
  if (!bridge) {
    return () => {};
  }
  // images can be kept as linked files of the workspace
  setHostCapabilities({ linkedImages: true });
  setFileSaveProvider(async (blob, { name }) => {
    let active = appJotaiStore.get(activeWorkspaceAtom);
    if (!active) {
      const folder = await bridge.pickFolder();
      if (!folder) {
        throw abort();
      }
      const entry = await bridge.open({ token: folder.token });
      active = { id: entry.id, name: entry.name };
      appJotaiStore.set(activeWorkspaceAtom, active);
    }
    const text = await externalizeAssets(
      bridge,
      active.id,
      await blobText(await blob),
      (await bridge.meta(active.id)).assets === "linked"
        ? "linked"
        : "embedded",
    );
    const { path } = await bridge.saveNew(active.id, name || "Untitled", text);
    return new WorkspaceFileHandle(
      bridge,
      active.id,
      path,
    ) as unknown as FileSystemFileHandle;
  });
  return () => {
    setFileSaveProvider(null);
    setHostCapabilities({ linkedImages: false });
  };
};
