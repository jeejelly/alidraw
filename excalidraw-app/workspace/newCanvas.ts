import { setNewCanvasProvider } from "@excalidraw/excalidraw";
import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";
import { writeSceneToHandle } from "@excalidraw/excalidraw/data/writeSceneToHandle";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { getWorkspaceBridge } from "./desktopBridge";
import { saveScene } from "./workspaceSave";

const isAbort = (error: unknown) =>
  (error as { name?: string } | null)?.name === "AbortError";

/**
 * In the desktop app a new canvas never asks "save first?" in a modal: a scene
 * that is a file of the project is written back, and one that is not is saved
 * through the project's own dialogs (the project, then a name and folder).
 * Backing out of those leaves the canvas as it is.
 */
export const installNewCanvas = (
  api: ExcalidrawImperativeAPI | null,
  notify: (message: string) => void = () => {},
) => {
  const bridge = getWorkspaceBridge();
  if (!bridge || !api) {
    return () => {};
  }
  setNewCanvasProvider(async ({ elementCount, fileHandle, name }) => {
    if (!elementCount) {
      return true;
    }
    const scene = {
      elements: api.getSceneElementsIncludingDeleted(),
      appState: api.getAppState(),
      files: api.getFiles(),
    };
    try {
      if (fileHandle) {
        await writeSceneToHandle(scene, fileHandle, { askPermission: true });
      } else {
        const blob = new Blob([
          serializeAsJSON(scene.elements, scene.appState, scene.files, "local"),
        ]);
        const saved = await saveScene(bridge, blob, name || "Untitled");
        notify(`Saved ${saved.name}`);
      }
      return true;
    } catch (error) {
      if (isAbort(error)) {
        return false;
      }
      throw error;
    }
  });
  return () => setNewCanvasProvider(null);
};
