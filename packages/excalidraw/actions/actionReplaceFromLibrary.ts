import { CaptureUpdateAction } from "@excalidraw/element";

import { register } from "./register";

/** right-click: put an item of the library where the selection is */
export const actionReplaceFromLibrary = register({
  name: "replaceFromLibrary",
  label: "labels.replaceFromLibrary",
  trackEvent: { category: "element" },
  predicate: (_elements, appState, _props, app) =>
    !appState.viewModeEnabled &&
    app.scene.getSelectedElements(appState).length > 0,
  perform: (_elements, appState) => ({
    appState: { ...appState, openDialog: { name: "libraryReplace" } },
    captureUpdate: CaptureUpdateAction.EVENTUALLY,
  }),
});
