import {
  CaptureUpdateAction,
  getBoundTextElement,
  newElementWith,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { t } from "../i18n";
import { textToPaths } from "../text/textToPaths";

import { register } from "./register";

const textsOf = (
  selected: readonly ExcalidrawElement[],
  map: Parameters<typeof getBoundTextElement>[1],
) => {
  const found = new Map<string, ExcalidrawTextElement>();
  for (const el of selected) {
    const text =
      el.type === "text"
        ? (el as ExcalidrawTextElement)
        : getBoundTextElement(el, map);
    if (text && !text.isDeleted) {
      found.set(text.id, text);
    }
  }
  return [...found.values()];
};

/** "Create outlines": the selected texts become vector shapes, glyph by glyph */
export const actionTextToVectors = register({
  name: "textToVectors",
  label: "labels.textToVectors",
  trackEvent: { category: "element" },
  predicate: (_elements, appState, _props, app) =>
    !appState.viewModeEnabled &&
    textsOf(
      app.scene.getSelectedElements(appState),
      app.scene.getNonDeletedElementsMap(),
    ).length > 0,
  perform: async (elements, appState, _value, app) => {
    const texts = textsOf(
      app.scene.getSelectedElements(appState),
      app.scene.getNonDeletedElementsMap(),
    );
    const made = new Map<string, ExcalidrawElement[]>();
    const missing = new Set<string>();
    for (const text of texts) {
      const out = await textToPaths(text);
      if (out) {
        made.set(text.id, out.elements);
        out.missing.forEach((char) => missing.add(char));
      }
    }
    if (!made.size) {
      return {
        elements,
        appState: {
          ...appState,
          toast: { message: t("toast.textToVectorsNone"), duration: 4000 },
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }
    const next: ExcalidrawElement[] = [];
    const selected: Record<string, true> = {};
    for (const el of app.scene.getElementsIncludingDeleted()) {
      const paths = made.get(el.id);
      if (!paths) {
        next.push(el);
        continue;
      }
      // the glyphs stand where the text was; the text is gone
      next.push(newElementWith(el, { isDeleted: true }), ...paths);
      paths.forEach((path) => (selected[path.id] = true));
    }
    return {
      elements: next,
      appState: {
        ...appState,
        selectedElementIds: selected,
        editingTextElement: null,
        toast: missing.size
          ? {
              message: t("toast.textToVectorsMissing", {
                chars: [...missing].slice(0, 12).join(" "),
              }),
              duration: 5000,
            }
          : appState.toast,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
