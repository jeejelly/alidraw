import type { MaybePromise } from "@excalidraw/common/utility-types";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { getFileHandleType, isImageFileHandleType } from "./blob";

// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import {
  exportCanvas,
  exportToImageBlob,
  prepareElementsForExport,
} from ".";

import { t } from "../i18n";

import type { AppState, BinaryFiles } from "../types";

/** Scene and appState as an image export embedding the scene, the form an image file handle is saved in. */
const withEmbeddedScene = async (
  data: MaybePromise<{
    elements: readonly ExcalidrawElement[];
    appState: AppState;
    files: BinaryFiles;
  }>,
) => {
  const { elements, appState, files } = await data;
  const embedding = { ...appState, exportEmbedScene: true };
  const { exportedElements, exportingFrame } = prepareElementsForExport(
    elements,
    embedding,
    false,
  );
  return {
    exportedElements,
    appState: embedding,
    files,
    options: {
      exportBackground: appState.exportBackground,
      viewBackgroundColor: appState.viewBackgroundColor,
      exportingFrame,
    },
  };
};

const imageTypeOf = (fileHandle: FileSystemFileHandle | null) => {
  const fileHandleType = getFileHandleType(fileHandle);

  if (!isImageFileHandleType(fileHandleType)) {
    throw new Error(
      "fileHandle should exist and should be of type svg or png when resaving",
    );
  }
  return fileHandleType;
};

/** The bytes `resaveAsImageWithScene` writes to [fileHandle]. */
export const imageWithSceneBlob = async (
  data: Parameters<typeof withEmbeddedScene>[0],
  fileHandle: FileSystemFileHandle,
): Promise<Blob> => {
  const type = imageTypeOf(fileHandle);
  const { exportedElements, appState, files, options } =
    await withEmbeddedScene(data);
  if (exportedElements.length === 0) {
    throw new Error(t("alerts.cannotExportEmptyCanvas"));
  }
  return exportToImageBlob(type, exportedElements, appState, files, options);
};

export const resaveAsImageWithScene = async (
  data: Parameters<typeof withEmbeddedScene>[0],
  fileHandle: FileSystemFileHandle,
  filename: string,
) => {
  const type = imageTypeOf(fileHandle);
  const { exportedElements, appState, files, options } =
    await withEmbeddedScene(data);

  await exportCanvas(type, exportedElements, appState, files, {
    ...options,
    name: filename,
    fileHandle,
  });

  return { fileHandle };
};
