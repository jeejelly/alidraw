import {
  getPathLoopView,
  getPathUpdate,
  isPathElement,
  setPathBevel,
  withPathLoopGeometry,
} from "@excalidraw/element";

import type { ExcalidrawPathElement } from "@excalidraw/element/types";

import type { PathContext } from "./context";

export type BevelScope = "point" | "all";

/** the geometry of a path with every anchor of every outline bevelled */
const bevelAllOutlines = (element: ExcalidrawPathElement, radius: number) => ({
  ...setPathBevel(element, radius),
  contours: element.contours?.map((contour) => setPathBevel(contour, radius)),
});

/** Rounds the straight corners of paths; the anchors themselves stay put. */
export class PathBevel {
  constructor(private context: PathContext) {}

  private get app() {
    return this.context.app;
  }

  /** the paths a bevel applies to: the one being edited, else the selected */
  private targets = () => {
    const editing = this.context.getEditedElement();
    return editing
      ? [editing]
      : this.app.scene
          .getSelectedElements(this.app.state)
          .filter(isPathElement);
  };

  /** the bevel radius of the selected anchor, or the one shared by all */
  get = (scope: BevelScope): number | null => {
    const radii = new Set<number>();
    const editing = this.app.state.editingPath;
    for (const element of this.targets()) {
      if (scope === "point") {
        const selected = editing?.selectedPoint;
        if (selected == null) {
          return null;
        }
        radii.add(
          getPathLoopView(element, editing?.loop ?? 0).handles[selected]
            ?.radius ?? 0,
        );
      } else {
        for (const outline of [element, ...(element.contours ?? [])]) {
          outline.handles.forEach((handles) => radii.add(handles.radius ?? 0));
        }
      }
    }
    return radii.size === 1 ? [...radii][0] : null;
  };

  /**
   * Rounds straight corners: one anchor (while editing) or every anchor of the
   * path(s). The anchors stay put; the drawn outline is rounded.
   */
  set = (radius: number, scope: BevelScope) => {
    const editing = this.app.state.editingPath;
    for (const element of this.targets()) {
      if (scope === "all") {
        this.app.scene.mutateElement(
          element,
          getPathUpdate(element, bevelAllOutlines(element, radius)),
        );
        continue;
      }
      const selected = editing?.selectedPoint;
      if (selected == null) {
        continue;
      }
      const loop = editing?.loop ?? 0;
      this.context.apply(
        element,
        setPathBevel(getPathLoopView(element, loop), radius, [selected]),
        undefined,
        loop,
      );
    }
    this.context.commit();
  };

  /** one anchor's bevel (or all with `null`) of a given path, editing or not */
  setOf = (
    elementId: string,
    index: number | null,
    radius: number,
    commit = true,
    loop = 0,
  ) => {
    const element = this.app.scene.getNonDeletedElement(elementId);
    if (!element || !isPathElement(element)) {
      return;
    }
    this.app.scene.mutateElement(
      element,
      getPathUpdate(
        element,
        index === null
          ? bevelAllOutlines(element, radius)
          : withPathLoopGeometry(
              element,
              loop,
              setPathBevel(getPathLoopView(element, loop), radius, [index]),
            ),
      ),
    );
    if (commit) {
      this.context.commit();
    }
  };
}
