import { CaptureUpdateAction } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawImageElement,
} from "@excalidraw/element/types";

import { t } from "../i18n";
import { loadPixels } from "@excalidraw/vector";
import { traceToElements, type TraceOptions } from "@excalidraw/vector";

import { register } from "./register";

const imagesOf = (selected: readonly ExcalidrawElement[]) =>
  selected.filter(
    (e): e is ExcalidrawImageElement => e.type === "image" && !!e.fileId,
  );

/**
 * "Vectorize": the selected pictures are traced into smooth vector shapes,
 * placed beside the picture (which stays as it is).
 */
export const actionVectorizeImage = register<Partial<TraceOptions> | undefined>(
  {
    name: "vectorizeImage",
    label: "labels.vectorizeImage",
    trackEvent: { category: "element" },
    predicate: (_elements, appState, _props, app) =>
      !appState.viewModeEnabled &&
      imagesOf(app.scene.getSelectedElements(appState)).length > 0,
    perform: async (elements, appState, options, app) => {
      const images = imagesOf(app.scene.getSelectedElements(appState));
      const made: ExcalidrawElement[] = [];
      try {
        for (const image of images) {
          const file = app.files[image.fileId!];
          if (!file) {
            continue;
          }
          const pixels = await loadPixels(file.dataURL);
          made.push(
            ...(await traceToElements(
              pixels,
              {
                x: image.x + image.width + 24,
                y: image.y,
                width: image.width,
                height: image.height,
              },
              options ?? {},
            )),
          );
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
            made.map((e) => [e.id, true as const]),
          ),
          toast: {
            message: t("toast.vectorized", { count: made.length }),
            duration: 4000,
          },
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      };
    },
  },
);
