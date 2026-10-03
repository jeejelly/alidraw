import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import {
  GIZMO_INNER,
  GIZMO_OUTER,
  getGizmoTarget,
  gizmoToScene,
  sameZone,
  type GizmoZone,
} from "../../gizmo";

import { drawPillLabel, getThemedColor } from "./shared";

import type { InteractiveCanvasAppState } from "../../types";
import type { RenderableElementsMap } from "../../scene/types";

type GizmoPaint = {
  context: CanvasRenderingContext2D;
  appState: InteractiveCanvasAppState;
  zoom: number;
  accent: string;
  /** selection-local coordinates to scene coordinates */
  at: (localX: number, localY: number) => [number, number];
  /** strokes the current path with a light halo so it reads over any drawing */
  strokeWithHalo: () => void;
  center: { x: number; y: number };
  halfWidth: number;
  halfHeight: number;
  angle: number;
  inner: number;
  mid: number;
  outer: number;
};

/** the pivot and the selection's own orientation, readable at a glance */
const renderAxes = ({
  context,
  appState,
  zoom,
  accent,
  at,
  center,
  halfWidth,
  halfHeight,
}: GizmoPaint) => {
  const reach = Math.max(halfWidth, halfHeight) + (GIZMO_OUTER * 2.2) / zoom;
  const axes: [number, number, string][] = [
    [1, 0, "#e5484d"],
    [0, 1, "#30a46c"],
  ];
  context.save();
  context.setLineDash([6 / zoom, 4 / zoom]);
  context.lineWidth = 1 / zoom;
  for (const [axisX, axisY, color] of axes) {
    const [startX, startY] = at(-axisX * reach, -axisY * reach);
    const [endX, endY] = at(axisX * reach, axisY * reach);
    context.strokeStyle = getThemedColor(color, appState.theme);
    context.globalAlpha = 0.55;
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.stroke();
  }
  context.restore();
  context.save();
  context.fillStyle = accent;
  context.strokeStyle = getThemedColor("#ffffff", appState.theme);
  context.lineWidth = 2 / zoom;
  context.beginPath();
  context.arc(center.x, center.y, 4 / zoom, 0, Math.PI * 2);
  context.stroke();
  context.fill();
  context.restore();
};

/** axes of other elements the rotation is locked onto */
const renderAlignGuides = ({
  context,
  appState,
  zoom,
  halfWidth,
  halfHeight,
}: GizmoPaint) => {
  for (const line of appState.gizmo?.align ?? []) {
    // a short guide from the turning selection to what it lined up with,
    // not a line across the whole canvas
    const deltaX = line.x - line.tx;
    const deltaY = line.y - line.ty;
    const distance = Math.hypot(deltaX, deltaY);
    const reach = Math.max(halfWidth, halfHeight) + (GIZMO_OUTER * 2) / zoom;
    const directionX = Math.cos(line.angle);
    const directionY = Math.sin(line.angle);
    const pad = 40 / zoom;
    const [startX, startY, endX, endY] =
      distance < 1e-6
        ? [
            line.tx - directionX * reach,
            line.ty - directionY * reach,
            line.tx + directionX * reach,
            line.ty + directionY * reach,
          ]
        : [
            line.tx - (deltaX / distance) * pad,
            line.ty - (deltaY / distance) * pad,
            line.x + (deltaX / distance) * pad,
            line.y + (deltaY / distance) * pad,
          ];
    context.save();
    context.strokeStyle = getThemedColor("#e0449b", appState.theme);
    context.lineWidth = 1 / zoom;
    context.setLineDash([5 / zoom, 4 / zoom]);
    context.globalAlpha = 0.9;
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.stroke();
    context.restore();
  }
};

/** an arc with an arrowhead around each corner */
const renderRotateHandles = (
  paint: GizmoPaint,
  isHot: (zone: GizmoZone) => boolean,
) => {
  const { context, zoom, accent, at, halfWidth, halfHeight, angle } = paint;
  for (const corner of ["nw", "ne", "se", "sw"] as const) {
    const signX = corner.endsWith("w") ? -1 : 1;
    const signY = corner.startsWith("n") ? -1 : 1;
    const active = isHot({ kind: "rotate", corner });
    context.strokeStyle = accent;
    context.globalAlpha = active ? 1 : 0.45;
    const [originX, originY] = at(
      signX * (halfWidth + paint.mid),
      signY * (halfHeight + paint.mid),
    );
    const radius = 10 / zoom;
    const base = Math.atan2(signY, signX) + angle;
    context.beginPath();
    context.arc(originX, originY, radius, base - 0.9, base + 0.9);
    paint.strokeWithHalo();
    // arrowheads at both ends
    for (const end of [-0.9, 0.9]) {
      const tipAngle = base + end;
      const tipX = originX + Math.cos(tipAngle) * radius;
      const tipY = originY + Math.sin(tipAngle) * radius;
      const direction = tipAngle + (end > 0 ? Math.PI / 2 : -Math.PI / 2);
      context.beginPath();
      context.moveTo(
        tipX - (Math.cos(direction - 0.5) * 4) / zoom,
        tipY - (Math.sin(direction - 0.5) * 4) / zoom,
      );
      context.lineTo(tipX, tipY);
      context.lineTo(
        tipX - (Math.cos(direction + 0.5) * 4) / zoom,
        tipY - (Math.sin(direction + 0.5) * 4) / zoom,
      );
      paint.strokeWithHalo();
    }
    if (active) {
      context.globalAlpha = 0.12;
      context.fillStyle = accent;
      const near = paint.inner * 0.35;
      const corners = [
        at(signX * (halfWidth + near), signY * (halfHeight + near)),
        at(signX * (halfWidth + paint.outer), signY * (halfHeight + near)),
        at(
          signX * (halfWidth + paint.outer),
          signY * (halfHeight + paint.outer),
        ),
        at(signX * (halfWidth + near), signY * (halfHeight + paint.outer)),
      ];
      context.beginPath();
      corners.forEach(([cornerX, cornerY], index) =>
        index
          ? context.lineTo(cornerX, cornerY)
          : context.moveTo(cornerX, cornerY),
      );
      context.closePath();
      context.fill();
    }
  }
};

/** a slanted double bar on the middle of each edge */
const renderSkewHandles = (
  paint: GizmoPaint,
  isHot: (zone: GizmoZone) => boolean,
) => {
  const { context, zoom, accent, at, halfWidth, halfHeight, angle } = paint;
  // the rotation handle sits above the top edge
  for (const edge of ["e", "s", "w"] as const) {
    const horizontal = edge === "s";
    const side = edge === "s" || edge === "e" ? 1 : -1;
    const active = isHot({ kind: "skew", edge });
    context.strokeStyle = accent;
    context.globalAlpha = active ? 1 : 0.45;
    const [centerX, centerY] = horizontal
      ? at(0, side * (halfHeight + paint.mid))
      : at(side * (halfWidth + paint.mid), 0);
    const length = 11 / zoom;
    const slant = 4 / zoom;
    const along = horizontal ? angle : angle + Math.PI / 2;
    const alongX = Math.cos(along);
    const alongY = Math.sin(along);
    const normalX = -alongY;
    const normalY = alongX;
    for (const offset of [-2.5 / zoom, 2.5 / zoom]) {
      const shift = slant * Math.sign(offset || 1);
      context.beginPath();
      context.moveTo(
        centerX + alongX * (-length + shift) + normalX * offset,
        centerY + alongY * (-length + shift) + normalY * offset,
      );
      context.lineTo(
        centerX + alongX * (length + shift) + normalX * offset,
        centerY + alongY * (length + shift) + normalY * offset,
      );
      paint.strokeWithHalo();
    }
  }
};

/** the live value shown while dragging */
const renderReadout = ({ context, appState, zoom, accent }: GizmoPaint) => {
  const readout = appState.gizmo?.readout;
  if (!readout) {
    return;
  }
  context.globalAlpha = 1;
  context.fillStyle = accent;
  drawPillLabel(context, readout.text, readout.x, readout.y, zoom);
};

/** rotate arcs at the corners, skew grips on the edges, the hovered zone, a readout */
export const renderGizmo = (
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
  selected: readonly NonDeletedExcalidrawElement[],
  elementsMap: RenderableElementsMap,
) => {
  if (
    appState.activeTool.type !== "selection" ||
    appState.viewModeEnabled ||
    appState.editingPath ||
    appState.editingTextElement ||
    appState.croppingElementId
  ) {
    return;
  }
  const target = getGizmoTarget(selected, elementsMap);
  if (!target) {
    return;
  }
  const zoom = appState.zoom.value;
  const { cx, cy, hw, hh, angle } = target.frame;
  const hover = appState.gizmo?.hover ?? null;

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 2 / zoom;

  const paint: GizmoPaint = {
    context,
    appState,
    zoom,
    accent: getThemedColor("#6965db", appState.theme),
    at: (localX, localY) => gizmoToScene(localX, localY, cx, cy, angle),
    strokeWithHalo: () => {
      const color = context.strokeStyle;
      const width = context.lineWidth;
      const alpha = context.globalAlpha;
      context.strokeStyle = getThemedColor("#ffffff", appState.theme);
      context.lineWidth = width + 3 / zoom;
      context.globalAlpha = alpha * 0.9;
      context.stroke();
      context.strokeStyle = color;
      context.lineWidth = width;
      context.globalAlpha = alpha;
      context.stroke();
    },
    center: { x: cx, y: cy },
    halfWidth: hw,
    halfHeight: hh,
    angle,
    inner: GIZMO_INNER / zoom,
    mid: (GIZMO_INNER + 10) / zoom,
    outer: GIZMO_OUTER / zoom,
  };
  const isHot = (zone: GizmoZone) => !!hover && sameZone(hover, zone);

  renderAxes(paint);
  renderAlignGuides(paint);
  renderRotateHandles(paint, isHot);
  if (target.skewable) {
    renderSkewHandles(paint, isHot);
  }
  renderReadout(paint);
  context.restore();
};
