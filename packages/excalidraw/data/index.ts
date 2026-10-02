import {
  DEFAULT_EXPORT_PADDING,
  DEFAULT_FILENAME,
  IMAGE_MIME_TYPES,
  isFirefox,
  MIME_TYPES,
  cloneJSON,
  SVG_DOCUMENT_PREAMBLE,
  arrayToMap,
} from "@excalidraw/common";

import { getNonDeletedElements } from "@excalidraw/element";

import { isFrameLikeElement } from "@excalidraw/element";

import { getElementsOverlappingFrame } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import {
  copyBlobToClipboardAsPng,
  copyTextToSystemClipboard,
} from "../clipboard";

import { t } from "../i18n";
import { getSelectedElements, isSomeElementSelected } from "../scene";
import { exportToCanvas, exportToSvg } from "../scene/export";

import { exportSvgToPdf } from "./pdfExport";

import { canvasToBlob } from "./blob";
import { fileSave } from "./filesystem";
import { serializeAsJSON } from "./json";

import type { ExportType } from "../scene/types";
import type { AppState, BinaryFiles } from "../types";

export { loadFromBlob } from "./blob";
export { loadFromJSON, saveAsJSON } from "./json";

export type ExportedElements = readonly NonDeletedExcalidrawElement[] & {
  _brand: "exportedElements";
};

export const prepareElementsForExport = (
  allElements: readonly ExcalidrawElement[],
  { selectedElementIds }: Pick<AppState, "selectedElementIds">,
  exportSelectionOnly: boolean,
) => {
  const elements = getNonDeletedElements(allElements);
  const elementsMap = arrayToMap(elements);

  const isExportingSelection =
    exportSelectionOnly &&
    isSomeElementSelected(elements, { selectedElementIds });

  let exportingFrame: NonDeleted<ExcalidrawFrameLikeElement> | null = null;
  let exportedElements = isExportingSelection
    ? getSelectedElements(
        elements,
        { selectedElementIds },
        {
          includeBoundTextElement: true,
        },
      )
    : elements;

  if (isExportingSelection) {
    const firstElement = exportedElements[0];
    if (exportedElements.length === 1 && isFrameLikeElement(firstElement)) {
      exportingFrame = firstElement;
      exportedElements = getElementsOverlappingFrame(
        elements,
        firstElement,
        elementsMap,
      );
    } else if (exportedElements.length > 1) {
      exportedElements = getSelectedElements(
        elements,
        { selectedElementIds },
        {
          includeBoundTextElement: true,
          includeElementsInFrames: true,
        },
      );
    }
  }

  return {
    exportingFrame,
    exportedElements: cloneJSON(exportedElements) as ExportedElements,
  };
};

/** The bytes of a PNG or SVG export, scene embedded when `appState.exportEmbedScene`. */
export const exportToImageBlob = async (
  type: "png" | "svg",
  elements: ExportedElements,
  appState: AppState,
  files: BinaryFiles,
  {
    exportBackground,
    exportPadding = DEFAULT_EXPORT_PADDING,
    viewBackgroundColor,
    exportingFrame = null,
  }: {
    exportBackground: boolean;
    exportPadding?: number;
    viewBackgroundColor: string;
    exportingFrame: NonDeleted<ExcalidrawFrameLikeElement> | null;
  },
): Promise<Blob> => {
  if (type === "svg") {
    const svg = await exportToSvg(
      elements,
      {
        exportBackground,
        exportWithDarkMode: appState.exportWithDarkMode,
        viewBackgroundColor,
        exportPadding,
        exportScale: appState.exportScale,
        exportEmbedScene: appState.exportEmbedScene,
      },
      files,
      { exportingFrame },
    );
    // adding SVG preamble so that older software parse the SVG file properly
    return new Blob([SVG_DOCUMENT_PREAMBLE + svg.outerHTML], {
      type: MIME_TYPES.svg,
    });
  }

  const blob = await canvasToBlob(
    exportToCanvas(elements, appState, files, {
      exportBackground,
      viewBackgroundColor,
      exportPadding,
      exportingFrame,
    }),
  );
  if (!appState.exportEmbedScene) {
    return blob;
  }
  const { encodePngMetadata } = await import("./image");
  return encodePngMetadata({
    blob,
    metadata: serializeAsJSON(elements, appState, files, "local"),
  });
};

export const exportCanvas = async (
  type: Omit<ExportType, "backend">,
  elements: ExportedElements,
  appState: AppState,
  files: BinaryFiles,
  {
    exportBackground,
    exportPadding = DEFAULT_EXPORT_PADDING,
    viewBackgroundColor,
    name = appState.name || DEFAULT_FILENAME,
    fileHandle = null,
    exportingFrame = null,
  }: {
    exportBackground: boolean;
    exportPadding?: number;
    viewBackgroundColor: string;
    /** filename, if applicable */
    name?: string;
    fileHandle?: FileSystemFileHandle | null;
    exportingFrame: NonDeleted<ExcalidrawFrameLikeElement> | null;
  },
) => {
  if (elements.length === 0) {
    throw new Error(t("alerts.cannotExportEmptyCanvas"));
  }
  const exportOptions = {
    exportBackground,
    exportPadding,
    viewBackgroundColor,
    exportingFrame,
  };
  if (type === "pdf") {
    const svg = await exportToSvg(
      elements,
      {
        exportBackground,
        exportWithDarkMode: appState.exportWithDarkMode,
        viewBackgroundColor,
        exportPadding,
        exportScale: appState.exportScale,
        exportEmbedScene: false,
      },
      files,
      { exportingFrame },
    );
    return exportSvgToPdf(svg, name) as any;
  }
  if (type === "svg" || type === "clipboard-svg") {
    if (type === "svg") {
      return fileSave(
        exportToImageBlob("svg", elements, appState, files, exportOptions),
        {
          description: "Export to SVG",
          name,
          extension: appState.exportEmbedScene ? "excalidraw.svg" : "svg",
          mimeTypes: [IMAGE_MIME_TYPES.svg],
          fileHandle,
        },
      );
    } else if (type === "clipboard-svg") {
      const svg = (
        await exportToSvg(
          elements,
          {
            exportBackground,
            exportWithDarkMode: appState.exportWithDarkMode,
            viewBackgroundColor,
            exportPadding,
            exportScale: appState.exportScale,
            exportEmbedScene: false,
          },
          files,
          { exportingFrame },
        )
      ).outerHTML;
      try {
        await copyTextToSystemClipboard(svg);
      } catch (e) {
        throw new Error(t("errors.copyToSystemClipboardFailed"));
      }
      return;
    }
  }

  if (type === "png") {
    const blob = exportToImageBlob(
      "png",
      elements,
      appState,
      files,
      exportOptions,
    );

    return fileSave(blob, {
      description: "Export to PNG",
      name,
      extension: appState.exportEmbedScene ? "excalidraw.png" : "png",
      mimeTypes: [IMAGE_MIME_TYPES.png],
      fileHandle,
    });
  } else if (type === "clipboard") {
    try {
      const blob = canvasToBlob(
        exportToCanvas(elements, appState, files, {
          exportBackground,
          viewBackgroundColor,
          exportPadding,
          exportingFrame,
        }),
      );
      await copyBlobToClipboardAsPng(blob);
    } catch (error: any) {
      console.warn(error);
      if (error.name === "CANVAS_POSSIBLY_TOO_BIG") {
        throw new Error(t("canvasError.canvasTooBig"));
      }
      // TypeError *probably* suggests ClipboardItem not defined, which
      // people on Firefox can enable through a flag, so let's tell them.
      if (isFirefox && error.name === "TypeError") {
        throw new Error(
          `${t("alerts.couldNotCopyToClipboard")}\n\n${t(
            "hints.firefox_clipboard_write",
          )}`,
        );
      } else {
        throw new Error(t("alerts.couldNotCopyToClipboard"));
      }
    }
  } else {
    // shouldn't happen
    throw new Error("Unsupported export type");
  }
};
