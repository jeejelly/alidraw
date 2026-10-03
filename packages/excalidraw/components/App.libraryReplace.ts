import { sceneCoordsToViewportCoords } from "@excalidraw/common";
import {
  flowReplaceTarget,
  getFlowMeta,
  refitFlowElement,
} from "@excalidraw/flow";
import { fitIntoBox, frameOf } from "@excalidraw/symbols";

import type { LibraryItem } from "../types";

import type App from "./App";

/** Replaces the selection with a library item, keeping a flow element's shell. */
export class AppLibraryReplace {
  constructor(private app: App) {}

  replaceSelection = (item: LibraryItem) => {
    const { app } = this;
    const selected = app.scene.getSelectedElements({
      selectedElementIds: app.state.selectedElementIds,
      includeBoundTextElement: true,
      includeElementsInFrames: true,
    });
    if (!selected.length) {
      return;
    }
    // a flow element keeps its outline, label, handle and links: only what it wraps is replaced
    const target = flowReplaceTarget(
      app.scene.getElementsIncludingDeleted(),
      selected,
    );
    const replaced = target ? target.remove : selected;
    const frame = frameOf(replaced);
    const fitted = fitIntoBox(item.elements, frame);
    if (!fitted.length) {
      return;
    }
    const knownIds = new Set(
      app.scene.getElementsIncludingDeleted().map((element) => element.id),
    );
    for (const element of replaced) {
      app.scene.mutateElement(element as any, { isDeleted: true });
    }
    const centre = sceneCoordsToViewportCoords(
      { sceneX: (frame.x0 + frame.x1) / 2, sceneY: (frame.y0 + frame.y1) / 2 },
      app.state,
    );
    app.addElementsFromPasteOrLibrary({
      elements: fitted,
      files: null,
      position: { clientX: centre.x, clientY: centre.y },
      retainSeed: false,
    });
    if (target) {
      this.joinFlowElement(target, knownIds);
    }
    app.store.scheduleCapture();
  };

  /** the new content joins the flow element's group and the outline hugs it */
  private joinFlowElement = (
    target: NonNullable<ReturnType<typeof flowReplaceTarget>>,
    knownIds: Set<string>,
  ) => {
    const { scene } = this.app;
    for (const element of scene.getNonDeletedElements()) {
      if (!knownIds.has(element.id)) {
        scene.mutateElement(element as any, {
          groupIds: [...element.groupIds, ...target.chain],
        });
      }
    }
    const meta = getFlowMeta(target.outline);
    if (meta?.placeholder) {
      scene.mutateElement(target.outline as any, {
        customData: {
          ...target.outline.customData,
          flow: { ...meta, placeholder: false },
        },
      });
    }
    refitFlowElement(scene, target.outline);
  };
}
