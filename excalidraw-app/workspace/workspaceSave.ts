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
import { requireWorkspace, requestSceneTarget } from "./workspaceRequests";
import { WorkspaceFileHandle } from "./WorkspaceFileHandle";
import {
  activeWorkspaceAtom,
  openSceneDialogOpenAtom,
  type ActiveWorkspace,
} from "./workspaceState";

type Bridge = NonNullable<ReturnType<typeof getWorkspaceBridge>>;

const writeExport = async (
  bridge: Bridge,
  workspace: ActiveWorkspace,
  filename: string,
  blob: Blob,
  notify: (message: string) => void,
) => {
  const { path } = await bridge.writeExport(
    workspace.id,
    filename,
    await blobBase64(blob),
  );
  notify(`Saved to ${workspace.name}/${path}`);
};

const saveScene = async (bridge: Bridge, blob: Blob, defaultName: string) => {
  const workspace = await requireWorkspace();
  const target = await requestSceneTarget(defaultName);
  const text = await externalizeAssets(
    bridge,
    workspace.id,
    await blobText(blob),
    (await bridge.meta(workspace.id)).assets === "linked"
      ? "linked"
      : "embedded",
  );
  const { path } = await bridge.saveNew(
    workspace.id,
    target.name,
    text,
    target.dir,
  );
  return new WorkspaceFileHandle(
    bridge,
    workspace.id,
    path,
  ) as unknown as FileSystemFileHandle;
};

/**
 * In the desktop app a scene is saved into a project, named in the save dialog:
 * with no active project the project dialog opens first. Exports (images,
 * swatches…) go to the project's exports/ folder with no dialog at all.
 */
export const installWorkspaceSave = (
  /** tells the user where something went (a toast) */
  notify: (message: string) => void = () => {},
) => {
  const bridge = getWorkspaceBridge();
  if (!bridge) {
    return () => {};
  }
  setHostCapabilities({ linkedImages: true });
  setFileSaveProvider(async (blob, { name, extension }) => {
    if (extension === "excalidraw") {
      return saveScene(bridge, await blob, name || "Untitled");
    }
    const workspace = appJotaiStore.get(activeWorkspaceAtom);
    if (!workspace) {
      return undefined;
    }
    await writeExport(
      bridge,
      workspace,
      `${name || "export"}.${extension}`,
      await blob,
      notify,
    );
    return null;
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
      extensions.map((extension) => extension.replace(/^\./, "")),
      multiple,
    );
    if (!picked) {
      return null;
    }
    return picked.map(({ name, base64 }) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
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
