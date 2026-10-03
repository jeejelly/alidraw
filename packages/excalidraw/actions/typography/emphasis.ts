import { KEYS } from "@excalidraw/common";

import type { ElementUpdate } from "@excalidraw/element";
import type { ExcalidrawTextElement } from "@excalidraw/element/types";

import { register } from "../register";

import { selectedTexts, updateTexts, warmLibraryFaces } from "./shared";

const BOLD = 700;
const REGULAR = 400;

/** one switch for the whole selection: off when all of it is already on */
const makeToggle = (
  name: "toggleBold" | "toggleItalic",
  label: string,
  key: string,
  isOn: (text: ExcalidrawTextElement) => boolean,
  patch: (on: boolean) => ElementUpdate<ExcalidrawTextElement>,
) =>
  register({
    name,
    label,
    trackEvent: { category: "element" },
    predicate: (_elements, appState, _props, app) =>
      !appState.viewModeEnabled && selectedTexts(appState, app).length > 0,
    perform: (elements, appState, _value, app) => {
      const texts = selectedTexts(appState, app);
      const ids = new Set(texts.map((text) => text.id));
      const turnOn = !(texts.length > 0 && texts.every(isOn));
      const changes = patch(turnOn);
      if (!texts.some((text) => text.fontFamilyName)) {
        return updateTexts(app, elements, appState, changes, ids);
      }
      // a library font has its own bold and italic faces: they load first
      return (async () => {
        await warmLibraryFaces(app, texts, (text) => ({
          weight: changes.fontWeight ?? text.fontWeight ?? REGULAR,
          italic: (changes.fontStyle ?? text.fontStyle) === "italic",
        }));
        return updateTexts(
          app,
          app.scene.getElementsIncludingDeleted(),
          app.state,
          changes,
          ids,
        );
      })();
    },
    keyTest: (event) =>
      event[KEYS.CTRL_OR_CMD] &&
      !event.shiftKey &&
      !event.altKey &&
      event.key.toLowerCase() === key,
  });

export const actionToggleBold = makeToggle(
  "toggleBold",
  "labels.bold",
  "b",
  (text) => (text.fontWeight ?? REGULAR) >= 600,
  (on) => ({ fontWeight: on ? BOLD : REGULAR }),
);

export const actionToggleItalic = makeToggle(
  "toggleItalic",
  "labels.italic",
  "i",
  (text) => text.fontStyle === "italic",
  (on) => ({ fontStyle: on ? "italic" : "normal" }),
);
