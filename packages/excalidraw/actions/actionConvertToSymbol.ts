import { CaptureUpdateAction } from "@excalidraw/element";

import { getFlowMeta } from "@excalidraw/flow";
import { expandSelection } from "@excalidraw/flow";

import { getSymbolMeta } from "@excalidraw/symbols";
import { makeCustomSymbol } from "@excalidraw/symbols";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { t } from "../i18n";

import { register } from "./register";

const NAME_FROM = (els: readonly ExcalidrawElement[]) => {
  const text = els.find((element) => element.type === "text") as any;
  const first = text?.text?.split("\n")[0]?.trim();
  return first ? first.slice(0, 30) : "Symbol";
};

/**
 * "Convert to symbol": a drawing (a group, or the selection) becomes a reusable
 * component with parameters (its background, outline, texts…) that the Symbols
 * tab edits. The drawing itself stays as drawn.
 */
export const actionConvertToSymbol = register({
  name: "convertToSymbol",
  label: "labels.convertToSymbol",
  trackEvent: { category: "element" },
  predicate: (_elements, appState, _props, app) =>
    !appState.viewModeEnabled &&
    app.scene.getSelectedElements(appState).length > 0,
  perform: (_elements, appState, _value, app) => {
    const all = app.scene.getElementsIncludingDeleted();
    const wanted = expandSelection(
      all,
      app.scene.getSelectedElements({
        selectedElementIds: appState.selectedElementIds,
        includeBoundTextElement: true,
      }),
    ).filter((element) => {
      const flow = getFlowMeta(element);
      return !(
        flow &&
        (flow.kind === "label" || flow.kind === "handle" || flow.wrap)
      );
    });
    if (!wanted.length || wanted.every((element) => getSymbolMeta(element))) {
      return {
        elements: all,
        appState: {
          ...appState,
          toast: { message: t("toast.alreadySymbol"), duration: 3500 },
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }
    // in the order they are drawn
    const ids = new Set(wanted.map((element) => element.id));
    const ordered = all.filter((element) => ids.has(element.id));
    const made = makeCustomSymbol(ordered, NAME_FROM(ordered));
    const byId = new Map(made.elements.map((element) => [element.id, element]));
    return {
      elements: all.map((element) => byId.get(element.id) ?? element),
      appState: {
        ...appState,
        selectedElementIds: Object.fromEntries(
          made.elements.map((element) => [element.id, true as const]),
        ),
        selectedGroupIds: {},
        toast: {
          message: t("toast.symbolMade", { count: made.params.length }),
          duration: 5000,
        },
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
