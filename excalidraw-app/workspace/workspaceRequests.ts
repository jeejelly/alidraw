import { appJotaiStore } from "../app-jotai";

import {
  activeWorkspaceAtom,
  saveRequestAtom,
  workspaceDialogOpenAtom,
  type ActiveWorkspace,
  type SceneTarget,
} from "./workspaceState";

export const abortError = () => {
  const error = new Error("The user aborted a request.");
  error.name = "AbortError";
  return error;
};

/** the active workspace, asking through the workspace dialog when there is none */
export const requireWorkspace = () =>
  new Promise<ActiveWorkspace>((resolve, reject) => {
    const current = appJotaiStore.get(activeWorkspaceAtom);
    if (current) {
      resolve(current);
      return;
    }
    appJotaiStore.set(workspaceDialogOpenAtom, true);
    const stop = () => {
      stopWatchingActive();
      stopWatchingDialog();
    };
    const stopWatchingActive = appJotaiStore.sub(activeWorkspaceAtom, () => {
      const chosen = appJotaiStore.get(activeWorkspaceAtom);
      if (chosen) {
        stop();
        appJotaiStore.set(workspaceDialogOpenAtom, false);
        resolve(chosen);
      }
    });
    const stopWatchingDialog = appJotaiStore.sub(
      workspaceDialogOpenAtom,
      () => {
        const closedWithoutChoice =
          !appJotaiStore.get(workspaceDialogOpenAtom) &&
          !appJotaiStore.get(activeWorkspaceAtom);
        if (closedWithoutChoice) {
          stop();
          reject(abortError());
        }
      },
    );
  });

/** the name and folder of a scene about to be saved, asked in the save dialog */
export const requestSceneTarget = (defaultName: string) =>
  new Promise<SceneTarget>((resolve, reject) => {
    const settle = () => appJotaiStore.set(saveRequestAtom, null);
    appJotaiStore.set(saveRequestAtom, {
      defaultName,
      resolve: (target) => {
        settle();
        resolve(target);
      },
      cancel: () => {
        settle();
        reject(abortError());
      },
    });
  });
