import { CODES, KEYS } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import { DEFAULT_CATEGORIES } from "../components/CommandPalette/CommandPalette";

import { register } from "./register";

export const actionToggleRulers = register({
  name: "toggleRulers",
  label: "labels.rulers.toggle",
  category: DEFAULT_CATEGORIES.editor,
  keywords: ["ruler", "guides", "measure"],
  viewMode: true,
  trackEvent: { category: "canvas" },
  perform(elements, appState) {
    return {
      appState: { ...appState, rulersEnabled: !appState.rulersEnabled },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.rulersEnabled,
  keyTest: (event) =>
    event.altKey &&
    event.shiftKey &&
    !event[KEYS.CTRL_OR_CMD] &&
    event.code === CODES.M,
});

export const actionToggleGuidesSnap = register({
  name: "toggleGuidesSnap",
  label: "labels.rulers.snap",
  category: DEFAULT_CATEGORIES.editor,
  keywords: ["magnet", "guides", "snap"],
  viewMode: true,
  trackEvent: { category: "canvas" },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        guidesSnapEnabled: !appState.guidesSnapEnabled,
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.guidesSnapEnabled,
});

export const actionClearGuides = register({
  name: "clearGuides",
  label: "labels.rulers.clear",
  category: DEFAULT_CATEGORIES.editor,
  keywords: ["guides", "remove"],
  trackEvent: { category: "canvas" },
  predicate: (elements, appState) => appState.guides.length > 0,
  perform(elements, appState) {
    return {
      appState: { ...appState, guides: [] },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
});
