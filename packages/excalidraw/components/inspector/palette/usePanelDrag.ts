import { useRef } from "react";

import {
  PANEL_MARGIN,
  setPaletteLayout,
  setPalettePosition,
} from "@excalidraw/color";

import type { PaletteLayout } from "@excalidraw/color";

import { placePanel, rectOf } from "./panelGeometry";

type Point = { x: number; y: number };

/** Pointer handlers that drag the palette by its header; a docked panel tears off. */
export const usePanelDrag = (
  rootRef: React.RefObject<HTMLDivElement | null>,
  layout: PaletteLayout,
  position: Point,
) => {
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const docked = layout === "docked";

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) {
      return;
    }
    let origin = position;
    if (docked) {
      const rect = rootRef.current?.getBoundingClientRect();
      origin = { x: rect?.left ?? position.x, y: rect?.top ?? position.y };
      setPaletteLayout("vertical");
      setPalettePosition(origin);
    }
    drag.current = {
      dx: event.clientX - origin.x,
      dy: event.clientY - origin.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) {
      return;
    }
    const { x, y } = placePanel(
      event.clientX - drag.current.dx,
      event.clientY - drag.current.dy,
      rootRef.current,
      "layers-panel",
      event.altKey,
    );
    setPalettePosition({ x, y });
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) {
      return;
    }
    drag.current = null;
    // let go against the right edge: the panel docks there again
    const size = rectOf(rootRef.current);
    if (
      !event.altKey &&
      size &&
      Math.abs(window.innerWidth - size.width - PANEL_MARGIN - size.x) < 1
    ) {
      setPaletteLayout("docked");
    }
  };

  return { onPointerDown, onPointerMove, onPointerUp };
};
