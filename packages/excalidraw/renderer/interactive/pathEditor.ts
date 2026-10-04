import { pointFrom, pointRotateRads, type GlobalPoint } from "@excalidraw/math";

import { getElementAbsoluteCoords, getPathLoopView } from "@excalidraw/element";

import type { ExcalidrawPathElement } from "@excalidraw/element/types";

import { getThemedColor } from "./shared";

import type { InteractiveCanvasAppState } from "../../types";
import type { RenderableElementsMap } from "../../scene/types";

/** the thin pink dotted line the points mirror across; it exists only while editing */
const renderMirrorLine = (
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
  element: ExcalidrawPathElement,
  mirror: { axis: "x" | "y"; at: number },
  toScene: (point: readonly [number, number]) => readonly [number, number],
) => {
  const zoom = appState.zoom.value;
  const margin = 24 / zoom;
  const xs = element.points.map((point) => point[0]);
  const ys = element.points.map((point) => point[1]);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs) - margin,
    Math.max(...xs) + margin,
    Math.min(...ys) - margin,
    Math.max(...ys) + margin,
  ];
  const at = mirror.at - (mirror.axis === "x" ? element.x : element.y);
  const [from, to] =
    mirror.axis === "x"
      ? [toScene([at, minY]), toScene([at, maxY])]
      : [toScene([minX, at]), toScene([maxX, at])];
  context.save();
  context.strokeStyle = getThemedColor("#e0449b", appState.theme);
  context.lineWidth = 1 / zoom;
  context.setLineDash([3 / zoom, 3 / zoom]);
  context.beginPath();
  context.moveTo(from[0], from[1]);
  context.lineTo(to[0], to[1]);
  context.stroke();
  context.restore();
};

/** anchors of a path being edited, and the tangent handles of the selected one */
export const renderPathEditor = (
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
  element: ExcalidrawPathElement,
  elementsMap: RenderableElementsMap,
) => {
  const editing = appState.editingPath;
  if (!editing) {
    return;
  }
  const zoom = appState.zoom.value;
  const [, , , , cx, cy] = getElementAbsoluteCoords(element, elementsMap);
  const center = pointFrom<GlobalPoint>(cx, cy);
  const toScene = (point: readonly [number, number]) =>
    pointRotateRads(
      pointFrom<GlobalPoint>(element.x + point[0], element.y + point[1]),
      center,
      element.angle,
    );

  context.save();
  context.translate(appState.scrollX, appState.scrollY);
  context.lineWidth = 1 / zoom;
  const accent = getThemedColor("#5e5ad8", appState.theme);
  const fill = getThemedColor("rgba(255, 255, 255, 0.95)", appState.theme);
  const fillSelected = getThemedColor("#5e5ad8", appState.theme);
  const radius = 5 / zoom;

  const loops = 1 + (element.contours?.length ?? 0);
  for (let loop = 0; loop < loops; loop++) {
    const view = getPathLoopView(element, loop);
    const isActiveLoop: boolean = loop === (editing.loop ?? 0);
    const selected = isActiveLoop ? editing.selectedPoint : null;
    const marked = isActiveLoop
      ? editing.selectedPoints ??
        (editing.selectedPoint != null ? [editing.selectedPoint] : [])
      : [];
    if (
      selected != null &&
      view.handles[selected]?.mode !== "corner" &&
      view.handles[selected]
    ) {
      const anchor = toScene(view.points[selected]);
      for (const side of ["in", "out"] as const) {
        const handle = view.handles[selected][side];
        if (!handle) {
          continue;
        }
        const tip = toScene([
          view.points[selected][0] + handle[0],
          view.points[selected][1] + handle[1],
        ]);
        context.strokeStyle = accent;
        context.beginPath();
        context.moveTo(anchor[0], anchor[1]);
        context.lineTo(tip[0], tip[1]);
        context.stroke();
        context.fillStyle = fill;
        context.beginPath();
        context.arc(tip[0], tip[1], radius * 0.8, 0, Math.PI * 2);
        context.fill();
        context.stroke();
      }
    }

    view.points.forEach((point, index) => {
      const scenePoint = toScene(point);
      context.strokeStyle = accent;
      context.fillStyle = marked.includes(index) ? fillSelected : fill;
      context.beginPath();
      if (view.handles[index]?.mode === "corner") {
        context.rect(
          scenePoint[0] - radius,
          scenePoint[1] - radius,
          radius * 2,
          radius * 2,
        );
      } else {
        context.arc(scenePoint[0], scenePoint[1], radius, 0, Math.PI * 2);
      }
      context.fill();
      context.stroke();
    });
  }
  if (editing.mirror) {
    renderMirrorLine(context, appState, element, editing.mirror, toScene);
  }
  if (editing.marquee) {
    const { x1, y1, x2, y2 } = editing.marquee;
    context.fillStyle = getThemedColor(
      "rgba(94, 90, 216, 0.08)",
      appState.theme,
    );
    context.fillRect(x1, y1, x2 - x1, y2 - y1);
    context.setLineDash([4 / zoom, 3 / zoom]);
    context.strokeRect(x1, y1, x2 - x1, y2 - y1);
  }
  context.restore();
};
