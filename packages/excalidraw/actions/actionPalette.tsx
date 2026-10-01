import { CODES, KEYS } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  hasStrokeWidth,
  newElementWith,
} from "@excalidraw/element";

import { DEFAULT_CATEGORIES } from "../components/CommandPalette/CommandPalette";

import { changeProperty } from "./actionProperties";
import { register } from "./register";

export const actionTogglePalette = register({
  name: "togglePalette",
  label: "labels.palette.toggle",
  category: DEFAULT_CATEGORIES.editor,
  keywords: ["colors", "swatches", "palette", "panel"],
  trackEvent: { category: "canvas" },
  perform(elements, appState) {
    return {
      appState: { ...appState, paletteOpen: !appState.paletteOpen },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.paletteOpen,
  keyTest: (event) =>
    event.altKey &&
    event.shiftKey &&
    !event[KEYS.CTRL_OR_CMD] &&
    event.code === CODES.P,
});

/** any stroke weight, not only the three presets */
export const actionChangeStrokeWidthValue = register<number>({
  name: "changeStrokeWidthValue",
  label: "labels.strokeWidth",
  trackEvent: false,
  perform(elements, appState, value) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      return false;
    }
    return {
      elements: changeProperty(elements, appState, (el) =>
        hasStrokeWidth(el.type)
          ? newElementWith(el, { strokeWidth: value })
          : el,
      ),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

/** Ctrl+T transforms; here it opens the inspector on the W field */
export const actionOpenTransform = register({
  name: "openTransform",
  label: "labels.palette.transform",
  category: DEFAULT_CATEGORIES.editor,
  keywords: ["transform", "scale", "resize", "rotate", "size"],
  trackEvent: { category: "canvas" },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] &&
    !event.shiftKey &&
    !event.altKey &&
    event.code === CODES.T,
  perform(elements, appState) {
    // focus once the inspector has rendered
    setTimeout(
      () =>
        window.dispatchEvent(new Event("excalidraw:inspector-focus-transform")),
      0,
    );
    return {
      appState: { ...appState, paletteOpen: true },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
});
