import { getNonDeletedElements } from "@excalidraw/element";
import { LinearElementEditor } from "@excalidraw/element";
import { isLinearElement, isTextElement } from "@excalidraw/element";

import { arrayToMap, KEYS } from "@excalidraw/common";

import { selectGroupsForSelectedElements } from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { isInHiddenLayer } from "../layers";
import { selectAllIcon } from "../components/icons";

import { register } from "./register";

export const actionSelectAll = register({
  name: "selectAll",
  label: "labels.selectAll",
  icon: selectAllIcon,
  trackEvent: { category: "canvas" },
  viewMode: false,
  perform: (elements, appState, value, app) => {
    if (appState.selectedLinearElement?.isEditing) {
      return false;
    }

    const hiddenLayers = new Set(
      appState.layers.filter((l) => !l.visible).map((l) => l.id),
    );
    const selectedElementIds = elements
      .filter(
        (element) =>
          !element.isDeleted &&
          !(isTextElement(element) && element.containerId) &&
          !element.locked &&
          !isInHiddenLayer(element, hiddenLayers),
      )
      .reduce((map: Record<ExcalidrawElement["id"], true>, element) => {
        map[element.id] = true;
        return map;
      }, {});

    return {
      appState: {
        ...appState,
        ...selectGroupsForSelectedElements(
          {
            editingGroupId: null,
            selectedElementIds,
          },
          getNonDeletedElements(elements),
          appState,
          app,
        ),
        selectedLinearElement:
          // single linear element selected
          Object.keys(selectedElementIds).length === 1 &&
          isLinearElement(elements[0])
            ? new LinearElementEditor(
                elements[0] as NonDeleted<ExcalidrawLinearElement>,
                arrayToMap(elements),
              )
            : null,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.key === KEYS.A,
});
