import { CODES, KEYS } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import { DEFAULT_CATEGORIES } from "../components/CommandPalette/CommandPalette";

import { register } from "./register";

export const actionTogglePalette = register({
  name: "togglePalette",
  label: "labels.palette.toggle",
  category: DEFAULT_CATEGORIES.editor,
  keywords: ["colors", "swatches", "palette", "panel"],
  trackEvent: { category: "canvas" },
  perform(elements, appState) {
    return {
      appState: { ...appState, paletteOpen: !appState.paletteOpen },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.paletteOpen,
  keyTest: (event) =>
    event.altKey &&
    event.shiftKey &&
    !event[KEYS.CTRL_OR_CMD] &&
    event.code === CODES.P,
});
