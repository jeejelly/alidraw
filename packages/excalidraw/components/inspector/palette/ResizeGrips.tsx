import {
  DEFAULT_PALETTE_STATE,
  setPaletteHeight,
  setPaletteWidth,
} from "@excalidraw/color";

import { t } from "../../../i18n";

/** Runs `onMove` for every pointer move until the button is released. */
const trackPointer = (onMove: (event: PointerEvent) => void) => {
  const up = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", up);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", up);
};

export const WidthGrip = ({
  docked,
  width,
}: {
  docked: boolean;
  width: number;
}) => (
  <div
    className={`inspector__grip inspector__grip--${docked ? "left" : "right"}`}
    data-testid="palette-resize"
    title={t("labels.palette.resize")}
    onPointerDown={(event) => {
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const sign = docked ? -1 : 1;
      trackPointer((move) =>
        setPaletteWidth(width + sign * (move.clientX - startX)),
      );
    }}
    onDoubleClick={() => setPaletteWidth(DEFAULT_PALETTE_STATE.width)}
  />
);

export const HeightGrip = ({
  rootRef,
}: {
  rootRef: React.RefObject<HTMLDivElement | null>;
}) => (
  <div
    className="inspector__grip inspector__grip--bottom"
    data-testid="palette-resize-height"
    title={t("labels.palette.resizeHeight")}
    onPointerDown={(event) => {
      event.preventDefault();
      event.stopPropagation();
      const startY = event.clientY;
      const startHeight =
        rootRef.current?.getBoundingClientRect().height ?? 400;
      trackPointer((move) =>
        setPaletteHeight(startHeight + (move.clientY - startY)),
      );
    }}
    onDoubleClick={() => setPaletteHeight(null)}
  />
);
