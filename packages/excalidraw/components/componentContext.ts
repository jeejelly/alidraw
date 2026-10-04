import { getElementsInGroup } from "@excalidraw/element";
import { getFlowMeta } from "@excalidraw/flow";
import { symbolGroupOf } from "@excalidraw/symbols";

import type { ElementsMap, ExcalidrawElement } from "@excalidraw/element/types";

/**
 * The library component (a symbol, or a flow element) an element is part of:
 * the group a double click makes the context of drawing.
 */
export const componentGroupOf = (
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): string | null => {
  const symbolGroup = symbolGroupOf(element);
  if (symbolGroup) {
    return symbolGroup;
  }
  return (
    element.groupIds.find((groupId) =>
      getElementsInGroup(elementsMap, groupId).some(
        (member) => getFlowMeta(member)?.group === groupId,
      ),
    ) ?? null
  );
};
