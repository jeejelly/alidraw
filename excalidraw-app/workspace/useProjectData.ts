import { useCallback, useEffect, useRef, useState } from "react";

import { mimeOf } from "./assetMime";

import type {
  Commit,
  DesktopWorkspaceBridge,
  GitStatus,
  SceneEntry,
  WorkspaceEntry,
} from "./desktopBridge";
import type { ActiveWorkspace } from "./workspaceState";

export type ProjectAsset = { path: string; bytes: number };

const REFRESH_INTERVAL_MS = 15000;
const MAX_THUMBNAILS = 40;

/** What the project panel shows, reloaded on bridge events and every 15 s. */
export const useProjectData = ({
  bridge,
  active,
  currentPath,
  guard,
}: {
  bridge: DesktopWorkspaceBridge | null;
  active: ActiveWorkspace | null;
  currentPath: string | null;
  guard: <T>(action: () => Promise<T>) => Promise<T | undefined>;
}) => {
  const [list, setList] = useState<WorkspaceEntry[]>([]);
  const [scenes, setScenes] = useState<SceneEntry[]>([]);
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<Commit[]>([]);

  const refresh = useCallback(async () => {
    if (!bridge) {
      return;
    }
    await guard(async () => {
      setList(await bridge.list());
      if (!active) {
        setScenes([]);
        setStatus(null);
        setAssets([]);
        setHistory([]);
        return;
      }
      setScenes(await bridge.scenes(active.id));
      setStatus(await bridge.status(active.id));
      setAssets(await bridge.assets(active.id));
      setHistory(
        currentPath ? await bridge.history(active.id, currentPath) : [],
      );
    });
  }, [bridge, active, currentPath, guard]);

  useEffect(() => {
    if (!bridge) {
      return;
    }
    refresh();
    const stopListening = bridge.onEvent(() => refresh());
    const timer = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => {
      stopListening();
      window.clearInterval(timer);
    };
  }, [bridge, refresh]);

  // thumbnails are loaded once per picture, as they appear
  const requested = useRef(new Set<string>());
  useEffect(() => {
    if (!bridge || !active) {
      return;
    }
    for (const asset of assets.slice(0, MAX_THUMBNAILS)) {
      const key = `${active.id}:${asset.path}`;
      if (requested.current.has(key)) {
        continue;
      }
      requested.current.add(key);
      bridge
        .readAsset(active.id, asset.path)
        .then((base64) =>
          setThumbs((current) => ({
            ...current,
            [key]: `data:${mimeOf(asset.path)};base64,${base64}`,
          })),
        )
        .catch(() => {});
    }
  }, [assets, active, bridge]);

  return { list, scenes, status, assets, thumbs, history, refresh };
};
