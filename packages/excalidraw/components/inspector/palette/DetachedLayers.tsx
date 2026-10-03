import { useRef } from "react";

import { t } from "../../../i18n";
import { PaletteScroll } from "../PaletteScroll";

import { placePanel } from "./panelGeometry";

type Point = { x: number; y: number };

/** The layers list as a panel of its own: floats, drags by its header. */
export const DetachedLayers = ({
  position,
  onMove,
  onAttach,
  children,
}: {
  position: Point;
  onMove: (position: Point) => void;
  onAttach: () => void;
  children: React.ReactNode;
}) => {
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={panelRef}
      className="inspector inspector--floating inspector--layers"
      data-testid="layers-panel"
      style={{ left: position.x, top: position.y }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div
        className="inspector__head"
        data-testid="layers-handle"
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest("button")) {
            return;
          }
          drag.current = {
            dx: event.clientX - position.x,
            dy: event.clientY - position.y,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (drag.current) {
            const { x, y } = placePanel(
              event.clientX - drag.current.dx,
              event.clientY - drag.current.dy,
              panelRef.current,
              "palette-panel",
              event.altKey,
            );
            onMove({ x, y });
          }
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        <div className="inspector__tabs">
          <span className="inspector__tab" aria-selected="true">
            {t("labels.palette.tab_layers")}
          </span>
        </div>
        <button
          type="button"
          className="inspector__iconbtn"
          data-testid="layers-attach"
          title={t("labels.palette.attachLayers")}
          onClick={onAttach}
        >
          ⇤
        </button>
      </div>
      <PaletteScroll>{children}</PaletteScroll>
    </div>
  );
};
