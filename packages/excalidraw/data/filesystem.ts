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

  const files = await _fileOpen({
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
 * A host (the desktop app) can take over saving a scene file: no file dialog,
 * it decides where the file goes (a workspace folder) and returns a handle for
 * later saves. Image exports are not affected.
 */
type FileSaveProvider = (
  blob: Blob | Promise<Blob>,
  opts: { name: string; extension: string },
) => Promise<FileSystemFileHandle | null>;

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
  if (fileSaveProvider && opts.extension === "excalidraw") {
    return fileSaveProvider(blob, opts) as Promise<any>;
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
