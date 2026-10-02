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

/**
 * A host (the desktop app) can take over picking files to read: `undefined`
 * leaves it to the browser's picker, `null` is a cancel, files are the choice.
 */
type FileOpenProvider = (opts: {
  extensions: string[];
  description: string;
  multiple: boolean;
}) => Promise<File[] | null | undefined>;

let fileOpenProvider: FileOpenProvider | null = null;

export const setFileOpenProvider = (provider: FileOpenProvider | null) => {
  fileOpenProvider = provider;
};

/**
 * A host can also take over the Open command of the menu (and Ctrl+O): it
 * shows its own way to open something and returns true, or false to leave it to
 * the default (a warning, then the file picker).
 */
let sceneOpenProvider: (() => boolean) | null = null;

export const setSceneOpenProvider = (provider: (() => boolean) | null) => {
  sceneOpenProvider = provider;
};

/** @returns true when the host opened something itself */
export const openSceneThroughHost = () =>
  sceneOpenProvider ? sceneOpenProvider() : false;

/**
 * A host (the desktop app) can take over saving a file: no file dialog, it
 * decides where the file goes (a workspace folder). For a scene file it returns
 * a handle for later saves; for an export (image, swatches…) null once written,
 * or `undefined` to leave it to the default.
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

export const setHostCapabilities = (c: Partial<HostCapabilities>) => {
  hostCapabilities = { ...hostCapabilities, ...c };
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
  if (fileSaveProvider) {
    const provider = fileSaveProvider;
    return (async () => {
      const handled = await provider(blob, opts);
      if (handled !== undefined) {
        return handled as any;
      }
      return _fileSave(
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
    })();
  }
  return _fileSave(
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
};

export { nativeFileSystemSupported };
