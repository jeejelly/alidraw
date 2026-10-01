import { nativeFileSystemSupported } from "@excalidraw/excalidraw/data/filesystem";
import {
  WritePermissionNeededError,
  writeSceneToHandle,
} from "@excalidraw/excalidraw/data/writeSceneToHandle";
import { useCallback, useEffect, useRef } from "react";

import type { JSONExportData } from "@excalidraw/excalidraw/data/json";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { appJotaiStore, useAtomValue } from "../app-jotai";
import { AUTOSAVE_TO_FILE_DELAY_MS } from "../app_constants";

import { FileAutosave } from "./FileAutosave";
import { autosaveToFileAtom } from "./autosavePreference";
import { autosaveStatusAtom } from "./autosaveStatus";

/** Feeds every scene change to one [FileAutosave]; returns the callback for `onChange`. */
export const useFileAutosave = (
  excalidrawAPI: ExcalidrawImperativeAPI | null,
) => {
  const enabled = useAtomValue(autosaveToFileAtom);
  const autosave = useRef<FileAutosave | null>(null);
  if (!autosave.current) {
    autosave.current = new FileAutosave({
      write: writeSceneToHandle,
      isPermissionError: (error) => error instanceof WritePermissionNeededError,
      supported: nativeFileSystemSupported,
      delayMs: AUTOSAVE_TO_FILE_DELAY_MS,
      report: (status) => appJotaiStore.set(autosaveStatusAtom, status),
    });
  }

  useEffect(() => () => autosave.current?.dispose(), []);

  // turning the preference on or off takes effect without waiting for an edit
  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }
    autosave.current!.observe(enabled, {
      elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
      appState: excalidrawAPI.getAppState(),
      files: excalidrawAPI.getFiles(),
    });
  }, [enabled, excalidrawAPI]);

  return useCallback((scene: JSONExportData) => {
    autosave.current!.observe(appJotaiStore.get(autosaveToFileAtom), scene);
  }, []);
};
