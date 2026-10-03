import { useCallback, useEffect, useState } from "react";

import type {
  Commit,
  DesktopWorkspaceBridge,
  GitStatus,
  SceneEntry,
  WorkspaceEntry,
} from "./desktopBridge";
import type { ActiveWorkspace } from "./workspaceState";

type Guard = <T>(action: () => Promise<T>) => Promise<T | undefined>;

/** What the workspace dialog shows, reloaded while it is open and whenever the bridge reports a change. */
export const useWorkspaceData = ({
  bridge,
  open,
  active,
  currentPath,
  guard,
}: {
  bridge: DesktopWorkspaceBridge | null;
  open: boolean;
  active: ActiveWorkspace | null;
  currentPath: string | null;
  guard: Guard;
}) => {
  const [list, setList] = useState<WorkspaceEntry[]>([]);
  const [scenes, setScenes] = useState<SceneEntry[]>([]);
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [history, setHistory] = useState<Commit[]>([]);
  const [gitInfo, setGitInfo] = useState<{
    installed: boolean;
    help: string;
  } | null>(null);
  const [settings, setSettings] = useState<WorkspaceEntry["settings"]>({});
  const [assets, setAssets] = useState<"embedded" | "linked">("embedded");
  const [remoteUrl, setRemoteUrl] = useState("");

  const refresh = useCallback(async () => {
    if (!bridge) {
      return;
    }
    await guard(async () => {
      setList(await bridge.list());
      setGitInfo(await bridge.gitInfo());
      if (!active) {
        setScenes([]);
        setStatus(null);
        setHistory([]);
        return;
      }
      setScenes(await bridge.scenes(active.id));
      const gitStatus = await bridge.status(active.id);
      setStatus(gitStatus);
      if ("remote" in gitStatus) {
        setRemoteUrl((current) => current || gitStatus.remote?.url || "");
      }
      setSettings(await bridge.getSettings(active.id));
      setAssets(
        (await bridge.meta(active.id)).assets === "linked"
          ? "linked"
          : "embedded",
      );
      setHistory(
        currentPath ? await bridge.history(active.id, currentPath) : [],
      );
    });
  }, [bridge, active, currentPath, guard]);

  useEffect(() => {
    if (open) {
      refresh();
    }
  }, [open, refresh]);

  useEffect(() => {
    if (!bridge || !open) {
      return;
    }
    return bridge.onEvent(() => refresh());
  }, [bridge, open, refresh]);

  return {
    list,
    scenes,
    status,
    history,
    gitInfo,
    setGitInfo,
    settings,
    setSettings,
    assets,
    setAssets,
    remoteUrl,
    setRemoteUrl,
    refresh,
  };
};
