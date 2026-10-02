import { CaptureUpdateAction } from "@excalidraw/element";

import { DEFAULT_CATEGORIES } from "../components/CommandPalette/CommandPalette";

import { register } from "./register";

/** adds SVG and image files to the current design (Open replaces it) */
export const actionImportFiles = register({
  name: "importFiles",
  label: "labels.import",
  category: DEFAULT_CATEGORIES.editor,
  keywords: ["import", "svg", "image", "insert", "add"],
  trackEvent: { category: "export" },
  perform(_elements, appState, _value, app) {
    (app as any).imports.fromPicker();
    return { appState, captureUpdate: CaptureUpdateAction.EVENTUALLY };
  },
});
