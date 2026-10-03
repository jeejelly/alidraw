import { reseed } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

/** Clears persisted state and pins the random seed so element ids are stable. */
export const resetTestState = () => {
  localStorage.clear();
  reseed(7);
};

/** Elements of the mounted editor that are not soft-deleted. */
export const liveElements = <
  T extends ExcalidrawElement = ExcalidrawElement,
>() => window.h.elements.filter((element) => !element.isDeleted) as T[];
