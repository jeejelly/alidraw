import { isImageFileHandle } from "./blob";
import { sceneAsJSONBlob } from "./json";
import { imageWithSceneBlob } from "./resave";

import type { JSONExportData } from "./json";

/** The browser has not granted this page write access to the file; only a user gesture can. */
export class WritePermissionNeededError extends Error {
  constructor(fileName: string) {
    super(`No write permission for ${fileName}`);
    this.name = "WritePermissionNeededError";
  }
}

type PermissionedHandle = FileSystemFileHandle & {
  queryPermission?: (descriptor: {
    mode: "read" | "readwrite";
  }) => Promise<PermissionState>;
};

/**
 * Writes the scene into the file [fileHandle] names, in that file's own format
 * (`.excalidraw`, or PNG/SVG with the scene embedded), the bytes Save writes.
 *
 * Never opens a file picker and never asks for permission: without a gesture the browser
 * would refuse the prompt, so a handle not yet granted write access throws
 * [WritePermissionNeededError] instead.
 */
export const writeSceneToHandle = async (
  data: JSONExportData,
  fileHandle: FileSystemFileHandle,
): Promise<void> => {
  const handle = fileHandle as PermissionedHandle;
  if (
    handle.queryPermission &&
    (await handle.queryPermission({ mode: "readwrite" })) !== "granted"
  ) {
    throw new WritePermissionNeededError(fileHandle.name);
  }
  const blob = isImageFileHandle(fileHandle)
    ? await imageWithSceneBlob(data, fileHandle)
    : await sceneAsJSONBlob(data);
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
};
