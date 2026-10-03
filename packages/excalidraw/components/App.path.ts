import { isPathElement } from "@excalidraw/element";

import type {
  ExcalidrawPathElement,
  PathPointMode,
} from "@excalidraw/element/types";

import { PathBevel } from "./appPath/bevel";
import { PathContext } from "./appPath/context";
import { PathPen } from "./appPath/pen";
import { PathPointEditor } from "./appPath/pointEditor";

import type React from "react";

import type App from "./App";

/**
 * The path tool (pen) and the point editor of a selected path; the work is
 * done by `PathPen`, `PathPointEditor` and `PathBevel`.
 */
export class AppPath {
  private context: PathContext;
  private pen: PathPen;
  private editor: PathPointEditor;
  private bevel: PathBevel;

  constructor(app: App) {
    this.context = new PathContext(app);
    this.pen = new PathPen(this.context);
    this.editor = new PathPointEditor(this.context);
    this.bevel = new PathBevel(this.context);
    this.context.pointerHandlers = {
      move: this.onPointerMove,
      release: this.onPointerRelease,
    };
  }

  private get app() {
    return this.context.app;
  }

  isCreating = () => this.pen.isCreating();

  getEditedElement = (): ExcalidrawPathElement | null =>
    this.context.getEditedElement();

  finishCreating = (close = false) => this.pen.finishCreating(close);

  cancelCreating = () => this.pen.cancelCreating();

  startEditing = (element: ExcalidrawPathElement) =>
    this.editor.startEditing(element);

  stopEditing = () => this.editor.stopEditing();

  setPointMode = (mode: PathPointMode, index?: number) =>
    this.editor.setPointMode(mode, index);

  toggleClosed = () => this.editor.toggleClosed();

  splitAtSelectedPoint = () => this.editor.splitAtSelectedPoint();

  deleteSelectedPoint = () => this.editor.deleteSelectedPoint();

  getBevel: PathBevel["get"] = (scope) => this.bevel.get(scope);

  setBevel: PathBevel["set"] = (radius, scope) => this.bevel.set(radius, scope);

  setBevelOf: PathBevel["setOf"] = (...args) => this.bevel.setOf(...args);

  /** @returns true when the pointer down was consumed */
  handlePointerDown = (event: React.PointerEvent<HTMLElement>): boolean => {
    if (event.button !== 0) {
      return false;
    }
    const point = this.context.snapToGuides(
      this.context.scenePointer(event),
      event,
    );
    if (this.app.state.activeTool.type === "path") {
      return this.pen.pointerDown(point, event);
    }
    const element = this.context.getEditedElement();
    return element ? this.editor.pointerDown(element, point, event) : false;
  };

  /** @returns true when the double click was consumed */
  handleDoubleClick = (): boolean => {
    if (this.pen.isCreating() || this.app.state.editingPath) {
      return true;
    }
    const selected = this.app.scene.getSelectedElements(this.app.state);
    if (selected.length === 1 && isPathElement(selected[0])) {
      this.editor.startEditing(selected[0]);
      return true;
    }
    return false;
  };

  /** @returns true when the key was consumed */
  handleKeyDown = (event: KeyboardEvent | React.KeyboardEvent): boolean =>
    this.pen.isCreating()
      ? this.pen.handleKeyDown(event)
      : this.editor.handleKeyDown(event);

  /** the tool changed or the scene was replaced: nothing half-drawn is kept */
  reset = () => {
    if (this.pen.isCreating()) {
      this.pen.finishCreating();
    }
    this.context.gesture = null;
    this.context.unlisten();
  };

  private onPointerMove = (event: PointerEvent) => {
    const point = this.context.scenePointer(event);
    if (this.pen.isCreating()) {
      this.pen.pointerMove(this.context.snapToGuides(point, event));
    } else {
      this.editor.pointerMove(point, event);
    }
  };

  private onPointerRelease = () => {
    const wasEditing =
      this.context.gesture && this.context.gesture.kind !== "pen-handle";
    this.context.gesture = null;
    if (wasEditing) {
      this.context.commit();
      this.context.unlisten();
    }
    // pen: keep tracking the cursor until the path is finished
  };
}
