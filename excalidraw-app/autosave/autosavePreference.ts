import { atom } from "../app-jotai";
import { STORAGE_KEYS } from "../app_constants";

const load = (): boolean => {
  try {
    return (
      localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_AUTOSAVE_TO_FILE) ===
      "true"
    );
  } catch (error: any) {
    console.error(error);
    return false;
  }
};

const store = (enabled: boolean) => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_AUTOSAVE_TO_FILE,
      String(enabled),
    );
  } catch (error: any) {
    console.error(error);
  }
};

const enabledAtom = atom(load());

/** Whether edits are written back to the open file. Off unless the person turned it on. */
export const autosaveToFileAtom = atom(
  (get) => get(enabledAtom),
  (_get, set, enabled: boolean) => {
    set(enabledAtom, enabled);
    store(enabled);
  },
);
