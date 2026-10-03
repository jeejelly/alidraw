import { viewportCoordsToSceneCoords } from "@excalidraw/common";

import type App from "../App";

type GizmoState = NonNullable<App["state"]["gizmo"]>;

/** the gizmo's transient on-canvas state: hover zone, readout, alignment guides */
export class GizmoOverlay {
  constructor(private app: App) {}

  set = (patch: Partial<GizmoState>) =>
    this.app.setState((prev) => ({
      gizmo: {
        hover: prev.gizmo?.hover ?? null,
        readout: prev.gizmo?.readout ?? null,
        align: prev.gizmo?.align ?? [],
        ...patch,
      },
    }));

  /** a label that follows the pointer */
  readout = (event: PointerEvent, text: string) => {
    const point = viewportCoordsToSceneCoords(event, this.app.state);
    const offset = 14 / this.app.state.zoom.value;
    this.set({ readout: { x: point.x + offset, y: point.y + offset, text } });
  };

  clear = () =>
    this.app.setState((prev) => ({
      gizmo: { hover: prev.gizmo?.hover ?? null, readout: null, align: [] },
    }));
}
