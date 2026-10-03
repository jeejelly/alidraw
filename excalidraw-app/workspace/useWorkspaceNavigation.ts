import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { useSetAtom } from "../app-jotai";

import { openWorkspaceScene } from "./openWorkspaceScene";
import { activeWorkspaceAtom, workspaceDialogOpenAtom } from "./workspaceState";

import type {
  Commit,
  DesktopWorkspaceBridge,
  SceneEntry,
  WorkspaceEntry,
} from "./desktopBridge";
import type { useGuardedBridge } from "./useGuardedBridge";
import type { ActiveWorkspace } from "./workspaceState";

type Guarded = ReturnType<typeof useGuardedBridge>;

/** Choosing, creating, forgetting workspaces and opening their scenes or earlier versions. */
export const useWorkspaceNavigation = ({
  bridge,
  api,
  active,
  currentPath,
  guarded,
  refresh,
  onSelect,
}: {
  bridge: DesktopWorkspaceBridge | null;
  api: ExcalidrawImperativeAPI | null;
  active: ActiveWorkspace | null;
  currentPath: string | null;
  guarded: Guarded;
  refresh: () => Promise<void>;
  onSelect: () => void;
}) => {
  const setWorkspaceActive = useSetAtom(activeWorkspaceAtom);
  const setDialogOpen = useSetAtom(workspaceDialogOpenAtom);
  const { setError, withBridge, withActive } = guarded;

  const select = (workspace: WorkspaceEntry) => {
    onSelect();
    setWorkspaceActive({ id: workspace.id, name: workspace.name });
    // pulls what others pushed, when the workspace is set to
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
      select(workspace);
    }).then(refresh);

  const openFolder = () =>
    withBridge(async (activeBridge) => {
      const folder = await activeBridge.pickFolder();
      if (!folder) {
        return;
      }
      const workspace = await activeBridge.open({ token: folder.token });
      select(workspace);
      if (workspace.gitNote) {
        setError(workspace.gitNote);
      }
    }).then(refresh);

  const forget = (workspace: WorkspaceEntry) =>
    withBridge(async (activeBridge) => {
      await activeBridge.forget(workspace.id);
      if (active?.id === workspace.id) {
        setWorkspaceActive(null);
      }
    }).then(refresh);

  const openScene = (scene: SceneEntry) =>
    withActive(async (_bridge, activeWorkspace) => {
      if (!api) {
        return;
      }
      await openWorkspaceScene(api, activeWorkspace, scene.path);
      setDialogOpen(false);
    });

  const newScene = () =>
    withActive(async (activeBridge, activeWorkspace) => {
      if (!api) {
        return;
      }
      const path = await activeBridge.newScene(activeWorkspace.id, "Untitled");
      await openWorkspaceScene(api, activeWorkspace, path);
      setDialogOpen(false);
    });

  const restore = (commit: Commit) =>
    withActive(async (activeBridge, activeWorkspace) => {
      if (!api || !currentPath) {
        return;
      }
      const text = await activeBridge.showVersion(
        activeWorkspace.id,
        commit.hash,
        currentPath,
      );
      // opened as the current file: the next save records it as a new version
      await openWorkspaceScene(api, activeWorkspace, currentPath, text);
      setDialogOpen(false);
    });

  return { select, create, openFolder, forget, openScene, newScene, restore };
};
