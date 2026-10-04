import {
  fileOpen as _fileOpen,
  fileSave as _fileSave,
  supported as nativeFileSystemSupported,
} from "browser-fs-access";

import { MIME_TYPES } from "@excalidraw/common";

import { normalizeFile } from "./blob";

type FILE_EXTENSION = Exclude<keyof typeof MIME_TYPES, "binary">;

export const fileOpen = async <M extends boolean | undefined = false>(opts: {
  extensions?: FILE_EXTENSION[];
  description: string;
  multiple?: M;
}): Promise<M extends false | undefined ? File : File[]> => {
  // an unsafe TS hack, alas not much we can do AFAIK
  type RetType = M extends false | undefined ? File : File[];

  const mimeTypes = opts.extensions?.reduce((mimeTypes, type) => {
    mimeTypes.push(MIME_TYPES[type]);

    return mimeTypes;
  }, [] as string[]);

  const extensions = opts.extensions?.reduce((acc, ext) => {
    if (ext === "jpg") {
      return acc.concat(".jpg", ".jpeg");
    }
    return acc.concat(`.${ext}`);
  }, [] as string[]);

  // a host can offer its own picker (the desktop app starts in the workspace)
  const hosted = fileOpenProvider
    ? await fileOpenProvider({
        extensions: extensions ?? [],
        description: opts.description,
        multiple: !!opts.multiple,
      })
    : undefined;
  if (hosted === null) {
    const aborted = new Error("The user aborted a request.");
    aborted.name = "AbortError";
    throw aborted;
  }
  const files =
    hosted !== undefined
      ? opts.multiple
        ? hosted
        : hosted[0]
      : await _fileOpen({
          description: opts.description,
          extensions,
          mimeTypes,
          multiple: opts.multiple ?? false,
        });

  if (Array.isArray(files)) {
    return (await Promise.all(
      files.map((file) => normalizeFile(file)),
    )) as RetType;
  }
  return (await normalizeFile(files)) as RetType;
};

/** Host picker for files to read: `undefined` defers to the browser, `null` cancels. */
type FileOpenProvider = (opts: {
  extensions: string[];
  description: string;
  multiple: boolean;
}) => Promise<File[] | null | undefined>;

let fileOpenProvider: FileOpenProvider | null = null;

export const setFileOpenProvider = (provider: FileOpenProvider | null) => {
  fileOpenProvider = provider;
};

/** Host takeover of the Open command: returns true once it has opened something itself. */
let sceneOpenProvider: (() => boolean) | null = null;

export const setSceneOpenProvider = (provider: (() => boolean) | null) => {
  sceneOpenProvider = provider;
};

export const openSceneThroughHost = () =>
  sceneOpenProvider ? sceneOpenProvider() : false;

/** What a host needs to know to deal with the scene before a new canvas replaces it. */
type NewCanvasContext = {
  elementCount: number;
  fileHandle: FileSystemFileHandle | null;
  name: string;
};

/**
 * Host takeover of "New canvas": resolves `true` once the scene is safe and the canvas
 * may be cleared, `false` when the user backed out.
 */
type NewCanvasProvider = (scene: NewCanvasContext) => Promise<boolean>;

let newCanvasProvider: NewCanvasProvider | null = null;

export const setNewCanvasProvider = (provider: NewCanvasProvider | null) => {
  newCanvasProvider = provider;
};

/** `undefined` when no host takes it over: the usual confirmation applies. */
export const newCanvasThroughHost = (scene: NewCanvasContext) =>
  newCanvasProvider ? newCanvasProvider(scene) : Promise.resolve(undefined);

/**
 * Host takeover of saving: a handle for later saves (scene files), `null` once an export
 * is written, or `undefined` to defer to the default.
 */
type FileSaveProvider = (
  blob: Blob | Promise<Blob>,
  opts: { name: string; extension: string },
) => Promise<FileSystemFileHandle | null | undefined>;

let fileSaveProvider: FileSaveProvider | null = null;

export const setFileSaveProvider = (provider: FileSaveProvider | null) => {
  fileSaveProvider = provider;
};

export const hasFileSaveProvider = () => fileSaveProvider !== null;

/** What the host app can do beyond a browser (set once at startup). */
type HostCapabilities = { linkedImages: boolean };

let hostCapabilities: HostCapabilities = { linkedImages: false };

export const setHostCapabilities = (
  capabilities: Partial<HostCapabilities>,
) => {
  hostCapabilities = { ...hostCapabilities, ...capabilities };
};

export const getHostCapabilities = () => hostCapabilities;

export const fileSave = (
  blob: Blob | Promise<Blob>,
  opts: {
    /** supply without the extension */
    name: string;
    /** file extension */
    extension: FILE_EXTENSION;
    mimeTypes?: string[];
    description: string;
    /** existing FileSystemFileHandle */
    fileHandle?: FileSystemFileHandle | null;
  },
) => {
  const saveToDisk = () =>
    _fileSave(
      blob,
      {
        fileName: `${opts.name}.${opts.extension}`,
        description: opts.description,
        extensions: [`.${opts.extension}`],
        mimeTypes: opts.mimeTypes,
      },
      opts.fileHandle,
      false,
    );
  const provider = fileSaveProvider;
  if (!provider) {
    return saveToDisk();
  }
  return (async () => {
    const handled = await provider(blob, opts);
    return handled !== undefined ? (handled as any) : saveToDisk();
  })();
};

export { nativeFileSystemSupported };
