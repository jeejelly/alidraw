import { CaptureUpdateAction } from "@excalidraw/element";

import { register } from "./register";

/** wrap the selection in a flow element: outline, label and a handle to link */
export const actionConvertToFlowElement = register({
  name: "convertToFlowElement",
  label: "labels.flow.convert",
  trackEvent: { category: "element" },
  predicate: (_elements, appState, _props, app) =>
    !appState.viewModeEnabled &&
    app.scene.getSelectedElements(appState).length > 0,
  perform: (_elements, _appState, _value, app) => {
    app.flow.convertSelection();
    return { captureUpdate: CaptureUpdateAction.EVENTUALLY };
  },
});
