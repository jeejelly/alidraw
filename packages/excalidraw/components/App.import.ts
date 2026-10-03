import {
  IMAGE_MIME_TYPES,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import { importSvg } from "@excalidraw/vector";

import { fileOpen } from "../data/filesystem";

import type App from "./App";

export type SvgMode = "shapes" | "image";

const MODE_STORAGE_KEY = "excalidraw-import-svg-mode";

export const getSvgMode = (): SvgMode => {
  try {
    return localStorage.getItem(MODE_STORAGE_KEY) === "image"
      ? "image"
      : "shapes";
  } catch {
    return "shapes";
  }
};

export const setSvgMode = (mode: SvgMode) => {
  try {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    // not kept
  }
};

const readAsText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });

const isSvg = (file: File) =>
  file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");

/**
 * Brings files into the current design instead of replacing it: pictures become
 * image elements, SVG files become editable shapes (or an image, as chosen).
 */
export class AppImport {
  constructor(private app: App) {}

  /** the middle of what is on screen, in scene coordinates */
  private centre = () => {
    const state = this.app.state;
    return viewportCoordsToSceneCoords(
      {
        clientX: state.width / 2 + state.offsetLeft,
        clientY: state.height / 2 + state.offsetTop,
      },
      state,
    );
  };

  fromPicker = async () => {
    try {
      const files = await fileOpen({
        description: "SVG and images",
        extensions: Object.keys(
          IMAGE_MIME_TYPES,
        ) as (keyof typeof IMAGE_MIME_TYPES)[],
        multiple: true,
      });
      return await this.importFiles(files);
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        this.app.setToast({
          message: error?.message ?? String(error),
          closable: true,
        });
      }
      return null;
    }
  };

  /** @returns the number of shapes added, or null when the file stays a picture */
  private importSvgAsShapes = async (file: File, notes: Set<string>) => {
    try {
      const { elements, skipped } = importSvg(await readAsText(file), {
        x: 0,
        y: 0,
      });
      skipped.forEach((note) => notes.add(note));
      if (!elements.length) {
        return null;
      }
      this.app.addElementsFromPasteOrLibrary({
        elements,
        files: null,
        position: "center",
      });
      return elements.length;
    } catch {
      // not drawable as shapes: kept as a picture
      return null;
    }
  };

  importFiles = async (files: File[], mode: SvgMode = getSvgMode()) => {
    const at = this.centre();
    let shapes = 0;
    const pictures: File[] = [];
    const notes = new Set<string>();
    for (const file of files) {
      const added =
        isSvg(file) && mode === "shapes"
          ? await this.importSvgAsShapes(file, notes)
          : null;
      if (added === null) {
        pictures.push(file);
      } else {
        shapes += added;
      }
    }
    if (pictures.length) {
      await this.app.insertImages(pictures, at.x, at.y);
    }
    const parts = [
      shapes ? `${shapes} shape${shapes === 1 ? "" : "s"}` : "",
      pictures.length
        ? `${pictures.length} image${pictures.length === 1 ? "" : "s"}`
        : "",
    ].filter(Boolean);
    const result = { shapes, images: pictures.length, notes: [...notes] };
    if (parts.length) {
      this.app.setToast({
        message: `Imported ${parts.join(" and ")}${
          notes.size ? ` (left out: ${[...notes].join(", ")})` : ""
        }.`,
        closable: true,
        duration: 4000,
      });
    }
    return result;
  };
}
