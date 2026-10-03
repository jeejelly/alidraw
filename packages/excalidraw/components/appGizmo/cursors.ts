import { MIME_TYPES } from "@excalidraw/common";

import type { GizmoZone } from "../../gizmo";

const ROTATE_ARROW =
  '<path d="M6 12a6 6 0 0 1 10.5-4" /><path d="M17 4v4h-4" /><path d="M18 12a6 6 0 0 1-10.5 4" /><path d="M7 20v-4h4" />';
const SKEW_ARROW =
  '<path d="M3 12h18" /><path d="M6 9l-3 3 3 3" /><path d="M18 9l3 3-3 3" />';

/** where each rotate corner's arrow points, in degrees */
const ROTATE_CORNER_ANGLE = { nw: 0, ne: 90, se: 180, sw: 270 };

/** a 24px cursor: the glyph turned by `degrees`, white outline under dark ink */
const makeCursor = (glyph: string, degrees: number) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><g transform="rotate(${degrees} 12 12)"><g stroke="#fff" stroke-width="4">${glyph}</g><g stroke="#1b1b1f" stroke-width="1.6">${glyph}</g></g></svg>`;
  return `url("data:${MIME_TYPES.svg},${encodeURIComponent(svg)}") 12 12, auto`;
};

/** the cursor for a gizmo zone of a frame turned by `frameAngle` radians */
export const getGizmoCursor = (zone: GizmoZone, frameAngle: number) => {
  const degrees = (frameAngle * 180) / Math.PI;
  if (zone.kind === "rotate") {
    return makeCursor(ROTATE_ARROW, degrees + ROTATE_CORNER_ANGLE[zone.corner]);
  }
  const along = zone.edge === "n" || zone.edge === "s" ? 0 : 90;
  return makeCursor(SKEW_ARROW, degrees + along);
};
