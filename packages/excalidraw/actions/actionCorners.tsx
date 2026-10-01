import { CaptureUpdateAction } from "@excalidraw/element";

import { DEFAULT_CATEGORIES } from "../components/CommandPalette/CommandPalette";

import { register } from "./register";

/** live corners: circle gizmos on the corners of the selected shape (Shift+B) */
export const actionToggleCornerMode = register({
  name: "toggleCornerMode" as any,
  label: "labels.corners.toggle" as any,
  category: DEFAULT_CATEGORIES.elements,
  keywords: ["corner", "bevel", "radius", "round", "gizmo"],
  trackEvent: { category: "element" },
  perform: (elements, appState) => ({
    elements,
    appState: { ...appState, cornerMode: !appState.cornerMode },
    captureUpdate: CaptureUpdateAction.EVENTUALLY,
  }),
  checked: (appState) => appState.cornerMode,
  keyTest: (event) =>
    event.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    event.code === "KeyB",
});
