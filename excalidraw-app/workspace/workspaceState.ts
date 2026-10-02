import { atom } from "../app-jotai";

export type ActiveWorkspace = { id: string; name: string };

/** the workspace new scenes are saved into */
export const activeWorkspaceAtom = atom<ActiveWorkspace | null>(null);

export const workspaceDialogOpenAtom = atom(false);

export const saveCopyDialogOpenAtom = atom(false);

export const openSceneDialogOpenAtom = atom(false);
