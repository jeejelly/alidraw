import {
  IMAGE_MIME_TYPES,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import { fileOpen } from "../data/filesystem";
import { importSvg } from "../svgImport";

import type App from "./App";

export type SvgMode = "shapes" | "image";

const KEY = "excalidraw-import-svg-mode";

export const getSvgMode = (): SvgMode => {
  try {
    return localStorage.getItem(KEY) === "image" ? "image" : "shapes";
  } catch {
    return "shapes";
  }
};

export const setSvgMode = (mode: SvgMode) => {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // not kept
  }
};

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
    const s = this.app.state;
    return viewportCoordsToSceneCoords(
      {
        clientX: s.width / 2 + s.offsetLeft,
        clientY: s.height / 2 + s.offsetTop,
      },
      s,
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

  importFiles = async (files: File[], mode: SvgMode = getSvgMode()) => {
    const at = this.centre();
    let shapes = 0;
    const pictures: File[] = [];
    const notes = new Set<string>();
    for (const file of files) {
      if (isSvg(file) && mode === "shapes") {
        try {
          const text = await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result));
            r.onerror = () => reject(r.error);
            r.readAsText(file);
          });
          const { elements, skipped } = importSvg(text, { x: 0, y: 0 });
          skipped.forEach((s) => notes.add(s));
          if (elements.length) {
            this.app.addElementsFromPasteOrLibrary({
              elements,
              files: null,
              position: "center",
            });
            shapes += elements.length;
          } else {
            pictures.push(file);
          }
        } catch {
          // not drawable as shapes: kept as a picture
          pictures.push(file);
        }
      } else {
        pictures.push(file);
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
