import type {
  ExcalidrawElement,
  ExcalidrawPathElement,
} from "@excalidraw/element/types";

import { roundTenth, solid } from "./text";

/** a path element as SVG path data, in its own frame */
export const pathData = (el: ExcalidrawPathElement) => {
  const loops = [
    { points: el.points, handles: el.handles, closed: el.closed },
    ...(el.contours ?? []).map((contour) => ({
      points: contour.points,
      handles: contour.handles,
      closed: true,
    })),
  ];
  return loops
    .map((loop) => {
      const pointCount = loop.points.length;
      if (!pointCount) {
        return "";
      }
      const hasHandle = (values: readonly number[] | null | undefined) =>
        !!values && (values[0] !== 0 || values[1] !== 0);
      let commands = `M${roundTenth(loop.points[0][0])} ${roundTenth(
        loop.points[0][1],
      )}`;
      const last = loop.closed ? pointCount : pointCount - 1;
      for (let index = 0; index < last; index++) {
        const current = loop.points[index];
        const next = loop.points[(index + 1) % pointCount];
        const out = loop.handles[index]?.out;
        const inn = loop.handles[(index + 1) % pointCount]?.in;
        if (hasHandle(out) || hasHandle(inn)) {
          commands += `C${roundTenth(
            current[0] + (out?.[0] ?? 0),
          )} ${roundTenth(current[1] + (out?.[1] ?? 0))} ${roundTenth(
            next[0] + (inn?.[0] ?? 0),
          )} ${roundTenth(next[1] + (inn?.[1] ?? 0))} ${roundTenth(
            next[0],
          )} ${roundTenth(next[1])}`;
        } else {
          commands += `L${roundTenth(next[0])} ${roundTenth(next[1])}`;
        }
      }
      return loop.closed ? `${commands}Z` : commands;
    })
    .join("");
};

const polylinePoints = (points: readonly number[][]) =>
  points
    .map((point) => `${roundTenth(point[0])},${roundTenth(point[1])}`)
    .join(" ");

export const svgFor = (el: ExcalidrawElement): string | null => {
  const stroke = solid(el.strokeColor) ? el.strokeColor : "none";
  const fill = solid(el.backgroundColor) ? el.backgroundColor : "none";
  const common = `fill="${fill}" stroke="${stroke}" stroke-width="${el.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"`;
  let inner = "";
  if (el.type === "path") {
    inner = `<path d="${pathData(el)}" ${common} fill-rule="evenodd"/>`;
  } else if (
    el.type === "line" ||
    el.type === "arrow" ||
    el.type === "freedraw"
  ) {
    const filled = el.type === "line" && (el as any).polygon;
    inner = `<polyline points="${polylinePoints(
      (el as any).points,
    )}" ${common} ${filled ? "" : 'fill="none"'}/>`;
  } else {
    return null;
  }
  return `<svg width="${roundTenth(el.width)}" height="${roundTenth(
    el.height,
  )}" viewBox="0 0 ${roundTenth(el.width)} ${roundTenth(
    el.height,
  )}" style="overflow:visible">${inner}</svg>`;
};
