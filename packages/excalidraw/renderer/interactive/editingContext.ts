import { getCommonBounds, getElementsInGroup } from "@excalidraw/element";

import type { ElementsMap } from "@excalidraw/element/types";

import { getThemedColor } from "./shared";

import type { InteractiveCanvasAppState } from "../../types";

const DIM_OPACITY = 0.7;

/**
 * Dims everything but the group being edited, so it is clear where new
 * shapes will go until the user clicks outside of it.
 */
export const renderEditingContext = (
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
  elementsMap: ElementsMap,
) => {
  if (!appState.editingGroupId) {
    return;
  }
  const members = getElementsInGroup(elementsMap, appState.editingGroupId);
  if (!members.length) {
    return;
  }
  const { zoom, scrollX, scrollY, width, height } = appState;
  const [minX, minY, maxX, maxY] = getCommonBounds(members);
  context.save();
  context.globalAlpha = DIM_OPACITY;
  context.fillStyle = getThemedColor(
    appState.viewBackgroundColor,
    appState.theme,
  );
  context.beginPath();
  context.rect(0, 0, width, height);
  context.rect(
    (minX + scrollX) * zoom.value,
    (minY + scrollY) * zoom.value,
    (maxX - minX) * zoom.value,
    (maxY - minY) * zoom.value,
  );
  context.fill("evenodd");
  context.restore();
};
