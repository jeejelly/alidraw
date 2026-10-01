import { useEffect } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { useAtomValue } from "../app-jotai";

import { getWorkspaceBridge } from "./desktopBridge";
import { openWorkspaceScene } from "./openWorkspaceScene";
import { activeWorkspaceAtom } from "./workspaceState";

/**
 * Listens for what the desktop app reports. When a pull changed the scene that
 * is open, it offers to reload it (the canvas is never replaced silently).
 */
export const WorkspaceWatcher = ({
  api,
}: {
  api: ExcalidrawImperativeAPI | null;
}) => {
  const bridge = getWorkspaceBridge();
  const active = useAtomValue(activeWorkspaceAtom);

  useEffect(() => {
    if (!bridge || !api || !active) {
      return;
    }
    return bridge.onEvent((event) => {
      if (event.type !== "pulled" || event.id !== active.id) {
        return;
      }
      const handle = api.getAppState().fileHandle as unknown as
        | { workspaceId?: string; path?: string }
        | undefined;
      if (
        handle?.workspaceId === active.id &&
        handle.path &&
        event.files.includes(handle.path)
      ) {
        const path = handle.path;
        if (
          window.confirm(
            `"${path}" was updated by what was pulled. Reload it?\n\nChanges on the canvas that are not saved yet will be lost.`,
          )
        ) {
          openWorkspaceScene(api, active, path).catch((e) => console.error(e));
        }
      }
    });
  }, [bridge, api, active]);

  return null;
};
