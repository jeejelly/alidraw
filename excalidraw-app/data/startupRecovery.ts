import { restoreAppState, restoreElements } from "@excalidraw/excalidraw";
import { t } from "@excalidraw/excalidraw/i18n";

import type { ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";

import { STORAGE_KEYS } from "../app_constants";

import { importFromLocalStorage } from "./localStorage";

/** where a scene that could not be opened is kept, so nothing is lost */
export const DAMAGED_SCENE_KEY = "excalidraw-damaged";

/** set when the editor crashed at startup and the scene was set aside */
const CRASHED_FLAG_KEY = "excalidraw-startup-crashed";

const TOAST_MS = 15000;

/** moves the stored scene aside under `DAMAGED_SCENE_KEY` and clears the live copy */
export const quarantineStoredScene = () => {
  try {
    localStorage.setItem(
      DAMAGED_SCENE_KEY,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        elements: localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS),
        appState: localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE),
      }),
    );
    localStorage.removeItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS);
    localStorage.removeItem(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE);
    return true;
  } catch (error: any) {
    console.error(error);
    return false;
  }
};

const notice = (message: string): ExcalidrawInitialDataState["appState"] => ({
  toast: { message, closable: true, duration: TOAST_MS },
});

const takeCrashFlag = () => {
  try {
    const crashed = sessionStorage.getItem(CRASHED_FLAG_KEY) !== null;
    sessionStorage.removeItem(CRASHED_FLAG_KEY);
    return crashed;
  } catch {
    return false;
  }
};

/**
 * The scene this browser last saved. A scene that cannot be read or restored
 * is set aside and the editor starts blank with a notice, never with nothing.
 */
export const loadStartupScene = (): { scene: ExcalidrawInitialDataState } => {
  const crashed = takeCrashFlag();
  try {
    const stored = importFromLocalStorage();
    if (stored.damaged) {
      throw new Error("the stored scene cannot be read");
    }
    return {
      scene: {
        elements: restoreElements(stored.elements, null, {
          repairBindings: true,
          deleteInvisibleElements: true,
        }),
        appState: {
          ...restoreAppState(stored.appState, null),
          ...(crashed ? notice(t("errors.crashedScene")) : {}),
        },
      },
    };
  } catch (error: any) {
    console.error(error);
    quarantineStoredScene();
    const blank = importFromLocalStorage();
    return {
      scene: {
        elements: [],
        appState: {
          ...restoreAppState(blank.appState, null),
          ...notice(t("errors.damagedScene")),
        },
      },
    };
  }
};

/**
 * A crash right after startup with a stored scene is taken to be that scene's
 * fault: it is set aside and the page reloads blank, once.
 * @returns true when a reload was started
 */
export const recoverFromStartupCrash = (): boolean => {
  try {
    if (
      sessionStorage.getItem(CRASHED_FLAG_KEY) !== null ||
      performance.now() > 20000 ||
      !localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS)
    ) {
      return false;
    }
    sessionStorage.setItem(CRASHED_FLAG_KEY, "1");
    if (!quarantineStoredScene()) {
      return false;
    }
    window.location.reload();
    return true;
  } catch {
    return false;
  }
};
