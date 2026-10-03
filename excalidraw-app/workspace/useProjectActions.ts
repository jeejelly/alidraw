import { useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { useSetAtom } from "../app-jotai";

import { mimeOf } from "./assetMime";
import { openWorkspaceScene } from "./openWorkspaceScene";
import { activeWorkspaceAtom } from "./workspaceState";

import type {
  Commit,
  DesktopWorkspaceBridge,
  SceneEntry,
  SyncOutcome,
  WorkspaceEntry,
} from "./desktopBridge";
import type { useGuardedBridge } from "./useGuardedBridge";
import type { ProjectAsset } from "./useProjectData";
import type { ActiveWorkspace } from "./workspaceState";

const describeSync = (result: SyncOutcome): string => {
  switch (result.outcome) {
    case "pushed":
      return "Pushed.";
    case "pulled":
      return `Pulled ${result.files?.length ?? 0} file(s).`;
    case "in-sync":
      return "Up to date.";
    case "diverged":
      return "Both sides have new commits: open the settings to merge or branch.";
    case "no-remote":
      return "Set a remote in the settings first.";
    case "paused":
      return "Network is paused.";
    default:
      return result.message ?? "Done.";
  }
};

/** Everything the project panel does: choose, create, open, rename scenes, commit, sync, insert pictures. */
export const useProjectActions = ({
  bridge,
  api,
  active,
  currentPath,
  list,
  guarded,
  refresh,
}: {
  bridge: DesktopWorkspaceBridge | null;
  api: ExcalidrawImperativeAPI;
  active: ActiveWorkspace | null;
  currentPath: string | null;
  list: WorkspaceEntry[];
  guarded: ReturnType<typeof useGuardedBridge>;
  refresh: () => Promise<void>;
}) => {
  const setActive = useSetAtom(activeWorkspaceAtom);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { setError, withBridge, withActive } = guarded;

  const run = (label: string, action: () => Promise<unknown>) =>
    guarded
      .guard(async () => {
        setBusy(true);
        setNote(`${label}…`);
        try {
          await action();
        } finally {
          setBusy(false);
        }
      })
      .then(refresh);

  const select = (id: string) => {
    const workspace = list.find((entry) => entry.id === id);
    if (!workspace) {
      setActive(null);
      return;
    }
    setActive({ id: workspace.id, name: workspace.name });
    bridge?.activate(workspace.id).catch(() => {});
  };

  const create = (name: string, onCreated: () => void) =>
    withBridge(async (activeBridge) => {
      const folder = await activeBridge.pickFolder();
      if (!folder) {
        return;
      }
      const workspace = await activeBridge.create({
        name,
        token: folder.token,
      });
      onCreated();
      setActive({ id: workspace.id, name: workspace.name });
    }).then(refresh);

  const openFolder = () =>
    withBridge(async (activeBridge) => {
      const folder = await activeBridge.pickFolder();
      if (!folder) {
        return;
      }
      const workspace = await activeBridge.open({ token: folder.token });
      setActive({ id: workspace.id, name: workspace.name });
      if (workspace.gitNote) {
        setError(workspace.gitNote);
      }
    }).then(refresh);

  const openScene = (scene: SceneEntry) =>
    withActive((_bridge, workspace) =>
      openWorkspaceScene(api, workspace, scene.path),
    );

  const newScene = () =>
    withActive(async (activeBridge, workspace) => {
      const path = await activeBridge.newScene(workspace.id, "Untitled");
      await openWorkspaceScene(api, workspace, path);
    }).then(refresh);

  const renameScene = (path: string, value: string) =>
    withActive(async (activeBridge, workspace) => {
      const next = await activeBridge.renameScene(workspace.id, path, value);
      // the open file follows its new name
      if (path === currentPath) {
        await openWorkspaceScene(api, workspace, next);
      }
    }).then(refresh);

  const duplicateScene = (path: string) =>
    run("Duplicating", () => bridge!.duplicateScene(active!.id, path));

  const deleteScene = (path: string) =>
    run("Deleting", () => bridge!.deleteScene(active!.id, path));

  const commit = (message: string, onCommitted: () => void) =>
    run("Committing", async () => {
      const result = await bridge!.commitNow(
        active!.id,
        message.trim() || undefined,
      );
      onCommitted();
      setNote(result.hash ? `Committed ${result.hash}.` : "Nothing to commit.");
    });

  const sync = (options: { pull: boolean; push: boolean }, label: string) =>
    run(label, async () =>
      setNote(describeSync(await bridge!.sync(active!.id, options))),
    );

  const restoreVersion = (version: Commit) =>
    withActive(async (activeBridge, workspace) => {
      if (!currentPath) {
        return;
      }
      const text = await activeBridge.showVersion(
        workspace.id,
        version.hash,
        currentPath,
      );
      await openWorkspaceScene(api, workspace, currentPath, text);
    });

  const insertAsset = (asset: ProjectAsset) =>
    withActive(async (activeBridge, workspace) => {
      const base64 = await activeBridge.readAsset(workspace.id, asset.path);
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const file = new File([bytes], asset.path.split("/").pop()!, {
        type: mimeOf(asset.path),
      });
      await api.importFiles([file], "image");
    });

  return {
    note,
    busy,
    select,
    create,
    openFolder,
    openScene,
    newScene,
    renameScene,
    duplicateScene,
    deleteScene,
    commit,
    sync,
    restoreVersion,
    insertAsset,
  };
};
