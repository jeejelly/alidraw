import {
  CaptureUpdateAction,
  isTextElement,
  newElementWith,
  redrawTextBoundingBox,
  updateBoundElements,
} from "@excalidraw/element";
import { getBoundTextElement } from "@excalidraw/element";

import type { ElementUpdate } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import {
  findLibraryFont,
  loadFontCatalogue,
  loadLibraryFace,
  pickLibraryStyle,
} from "../../fonts/library";

import { changeProperty } from "../actionProperties";

import type { AppState } from "../../types";

export const hasText = (element: any, app: any) =>
  isTextElement(element) ||
  getBoundTextElement(element, app.scene.getNonDeletedElementsMap()) !== null;

/** the text element itself, or the text bound to the container */
export const getTextOf = (element: ExcalidrawElement, app: any) =>
  isTextElement(element)
    ? element
    : getBoundTextElement(element, app.scene.getNonDeletedElementsMap());

export const selectedTexts = (
  appState: AppState,
  app: any,
): ExcalidrawTextElement[] => {
  const found = new Map<string, ExcalidrawTextElement>();
  for (const element of app.scene.getSelectedElements({
    selectedElementIds: appState.selectedElementIds,
    includeBoundTextElement: true,
  })) {
    if (isTextElement(element)) {
      found.set(element.id, element);
    }
  }
  if (appState.editingTextElement) {
    found.set(appState.editingTextElement.id, appState.editingTextElement);
  }
  return [...found.values()];
};

/** the faces texts set in library fonts will need, loaded before the text is measured */
export const warmLibraryFaces = async (
  app: any,
  texts: readonly ExcalidrawTextElement[],
  next: (text: ExcalidrawTextElement) => {
    weight: number;
    italic: boolean;
    family?: string | null;
  },
) => {
  const named = texts.filter(
    (text) => next(text).family ?? text.fontFamilyName,
  );
  if (!named.length) {
    return;
  }
  await loadFontCatalogue();
  const faces: FontFace[] = [];
  for (const text of named) {
    const { weight, italic, family } = next(text);
    const font = findLibraryFont(family ?? text.fontFamilyName);
    if (font) {
      const face = await loadLibraryFace(
        font,
        pickLibraryStyle(font, weight, italic),
        app.ownerDocument,
      );
      if (face) {
        faces.push(face);
      }
    }
  }
  // texts measured with a stand-in so far are measured again
  app.fonts.onLoaded(faces);
};

/** applies `changes` to the texts (only those in `ids`, when given) and re-measures them */
export const updateTexts = (
  app: any,
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  changes: ElementUpdate<ExcalidrawTextElement>,
  ids?: ReadonlySet<string>,
) => {
  const updated: ExcalidrawTextElement[] = [];
  const nextElements = changeProperty(
    elements,
    appState,
    (element) => {
      if (!isTextElement(element) || (ids && !ids.has(element.id))) {
        return element;
      }
      const changed = newElementWith(element, changes);
      updated.push(changed);
      redrawTextBoundingBox(
        changed,
        app.scene.getContainerElement(changed),
        app.scene,
      );
      return changed;
    },
    true,
  );
  updated.forEach((element) =>
    updateBoundElements(element as NonDeletedExcalidrawElement, app.scene),
  );
  return {
    elements: nextElements,
    appState,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  };
};
