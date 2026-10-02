import {
  setFileOpenProvider,
  setFileSaveProvider,
  setHostCapabilities,
  setSceneOpenProvider,
} from "@excalidraw/excalidraw";

import { appJotaiStore } from "../app-jotai";

import { blobBase64, blobText } from "./blobText";
import { getWorkspaceBridge } from "./desktopBridge";
import { externalizeAssets } from "./linkedAssets";
import { WorkspaceFileHandle } from "./WorkspaceFileHandle";
import { activeWorkspaceAtom, openSceneDialogOpenAtom } from "./workspaceState";

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
export const installWorkspaceSave = (
  /** tells the user where something went (a toast) */
  notify: (message: string) => void = () => {},
) => {
  const bridge = getWorkspaceBridge();
  if (!bridge) {
    return () => {};
  }
  // images can be kept as linked files of the workspace
  setHostCapabilities({ linkedImages: true });
  setFileSaveProvider(async (blob, { name, extension }) => {
    let active = appJotaiStore.get(activeWorkspaceAtom);
    // an export (image, swatches…) goes to the workspace's exports/ folder, no dialog;
    // without a workspace it is left to the usual file dialog
    if (extension !== "excalidraw") {
      if (!active) {
        return undefined;
      }
      const { path } = await bridge.writeExport(
        active.id,
        `${name || "export"}.${extension}`,
        await blobBase64(await blob),
      );
      notify(`Saved to ${active.name}/${path}`);
      return null;
    }
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
  // Open is the project's own (a list of its scenes), never a warning about losing the canvas
  setSceneOpenProvider(() => {
    if (!appJotaiStore.get(activeWorkspaceAtom)) {
      return false;
    }
    appJotaiStore.set(openSceneDialogOpenAtom, true);
    return true;
  });
  // pickers for importing start in the workspace
  setFileOpenProvider(async ({ extensions, multiple }) => {
    const active = appJotaiStore.get(activeWorkspaceAtom);
    if (!active) {
      return undefined;
    }
    const picked = await bridge.pickFiles(
      active.id,
      extensions.map((e) => e.replace(/^\./, "")),
      multiple,
    );
    if (!picked) {
      return null;
    }
    return picked.map(({ name, base64 }) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      return new File([bytes], name);
    });
  });
  return () => {
    setSceneOpenProvider(null);
    setFileOpenProvider(null);
    setFileSaveProvider(null);
    setHostCapabilities({ linkedImages: false });
  };
};
