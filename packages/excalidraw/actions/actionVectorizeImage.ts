import { CaptureUpdateAction } from "@excalidraw/element";

import { loadPixels } from "@excalidraw/vector";

import { traceImage, type TraceOptions } from "@excalidraw/vector";

import { iconElements, matchIcons } from "@excalidraw/symbols";

import type {
  ExcalidrawElement,
  ExcalidrawImageElement,
} from "@excalidraw/element/types";

import { t } from "../i18n";

import { register } from "./register";

const imagesOf = (selected: readonly ExcalidrawElement[]) =>
  selected.filter(
    (element): element is ExcalidrawImageElement =>
      element.type === "image" && !!element.fileId,
  );

/**
 * "Vectorize": the selected pictures are traced into smooth vector shapes,
 * placed beside the picture (which stays as it is).
 */
export type VectorizeOptions = Partial<TraceOptions> & {
  /** swap the shapes of library icons for the icons */
  icons?: boolean;
};

export const actionVectorizeImage = register<VectorizeOptions | undefined>({
  name: "vectorizeImage",
  label: "labels.vectorizeImage",
  trackEvent: { category: "element" },
  predicate: (_elements, appState, _props, app) =>
    !appState.viewModeEnabled &&
    imagesOf(app.scene.getSelectedElements(appState)).length > 0,
  perform: async (elements, appState, options, app) => {
    const images = imagesOf(app.scene.getSelectedElements(appState));
    const made: ExcalidrawElement[] = [];
    const warnings: string[] = [];
    let icons = 0;
    const { icons: matchLibrary, ...trace } = options ?? {};
    try {
      for (const image of images) {
        const file = app.files[image.fileId!];
        if (!file) {
          continue;
        }
        const pixels = await loadPixels(file.dataURL);
        const target = {
          x: image.x + image.width + 24,
          y: image.y,
          width: image.width,
          height: image.height,
        };
        const result = await traceImage(pixels, target, trace);
        if (result.warning) {
          warnings.push(result.warning);
        }
        let elements = result.elements;
        if (matchLibrary && result.regions.length) {
          const scaleX = target.width / pixels.width;
          const scaleY = target.height / pixels.height;
          const found = matchIcons(result.regions);
          const drop = new Set(found.flatMap((match) => match.regions));
          const swapped = found.flatMap((match) =>
            iconElements(
              match,
              {
                x: target.x + match.bounds.x * scaleX,
                y: target.y + match.bounds.y * scaleY,
                width: match.bounds.width * scaleX,
                height: match.bounds.height * scaleY,
              },
              result.elements[match.regions[0]].backgroundColor,
            ),
          );
          icons += found.length;
          const shapes = result.elements
            .slice(0, result.regions.length)
            .filter((_element, index) => !drop.has(index));
          const texts = result.elements.slice(result.regions.length);
          elements = [...shapes, ...swapped, ...texts];
        }
        made.push(...elements);
      }
    } catch (error: any) {
      return {
        elements,
        appState: {
          ...appState,
          errorMessage: error?.message ?? String(error),
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }
    if (!made.length) {
      return false;
    }
    return {
      elements: [...app.scene.getElementsIncludingDeleted(), ...made],
      appState: {
        ...appState,
        selectedElementIds: Object.fromEntries(
          made.map((element) => [element.id, true as const]),
        ),
        toast: {
          message: [
            t("toast.vectorized", { count: made.length }),
            icons ? t("toast.vectorizedIcons", { count: icons }) : "",
            ...warnings,
          ]
            .filter(Boolean)
            .join(" "),
          duration: 4000,
        },
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
