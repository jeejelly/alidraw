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

type PermissionDescriptor = { mode: "read" | "readwrite" };

type PermissionedHandle = FileSystemFileHandle & {
  queryPermission?: (descriptor: PermissionDescriptor) => Promise<PermissionState>;
  requestPermission?: (
    descriptor: PermissionDescriptor,
  ) => Promise<PermissionState>;
};

const READ_WRITE: PermissionDescriptor = { mode: "readwrite" };

/** Write access to [handle]; asked for only when [ask], which needs a user gesture in progress. */
const hasWriteAccess = async (handle: PermissionedHandle, ask: boolean) => {
  if (!handle.queryPermission) {
    return true;
  }
  if ((await handle.queryPermission(READ_WRITE)) === "granted") {
    return true;
  }
  return (
    ask &&
    !!handle.requestPermission &&
    (await handle.requestPermission(READ_WRITE)) === "granted"
  );
};

/**
 * Writes the scene into the file [fileHandle] names, in that file's own format
 * (`.excalidraw`, or PNG/SVG with the scene embedded), the bytes Save writes.
 *
 * Never opens a file picker. Asks the browser for write access only with `askPermission`,
 * which a caller sets when a user gesture is in progress (Save); without it, a handle not yet
 * granted write access throws [WritePermissionNeededError].
 */
export const writeSceneToHandle = async (
  data: JSONExportData,
  fileHandle: FileSystemFileHandle,
  { askPermission = false }: { askPermission?: boolean } = {},
): Promise<void> => {
  if (!(await hasWriteAccess(fileHandle as PermissionedHandle, askPermission))) {
    throw new WritePermissionNeededError(fileHandle.name);
  }
  const blob = isImageFileHandle(fileHandle)
    ? await imageWithSceneBlob(data, fileHandle)
    : await sceneAsJSONBlob(data);
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
};
