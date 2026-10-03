import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import type { ActiveWorkspace } from "./workspaceState";

/** The path of the scene open in the editor, when it belongs to the active workspace. */
export const useCurrentScenePath = (
  api: ExcalidrawImperativeAPI | null,
  active: ActiveWorkspace | null,
): string | null => {
  const fileHandle = api?.getAppState().fileHandle as unknown as
    | { workspaceId?: string; path?: string }
    | undefined;
  return fileHandle?.workspaceId && fileHandle.workspaceId === active?.id
    ? fileHandle.path ?? null
    : null;
};
