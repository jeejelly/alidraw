import { atom } from "../app-jotai";

export type ActiveWorkspace = { id: string; name: string };

/** the workspace new scenes are saved into */
export const activeWorkspaceAtom = atom<ActiveWorkspace | null>(null);

export const workspaceDialogOpenAtom = atom(false);

export const saveCopyDialogOpenAtom = atom(false);

export const openSceneDialogOpenAtom = atom(false);

export type SceneTarget = { name: string; dir?: string };

/** a save waiting for the user to name the scene and pick its folder */
export type SaveRequest = {
  defaultName: string;
  resolve: (target: SceneTarget) => void;
  cancel: () => void;
};

export const saveRequestAtom = atom<SaveRequest | null>(null);
