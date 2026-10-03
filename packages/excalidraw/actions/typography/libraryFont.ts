import { register } from "../register";

import { selectedTexts, updateTexts, warmLibraryFaces } from "./shared";

/** set the library font of the selected texts (null: back to the family they had) */
export const actionChangeLibraryFont = register<string | null>({
  name: "changeLibraryFont",
  label: "labels.libraryFont",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    const name = typeof value === "string" && value ? value : null;
    const texts = selectedTexts(appState, app);
    const ids = new Set(texts.map((text) => text.id));
    return (async () => {
      await warmLibraryFaces(app, texts, (text) => ({
        weight: text.fontWeight ?? 400,
        italic: text.fontStyle === "italic",
        family: name,
      }));
      const result = updateTexts(
        app,
        app.scene.getElementsIncludingDeleted(),
        app.state,
        { fontFamilyName: name },
        ids,
      );
      return {
        ...result,
        appState: { ...app.state, currentItemFontFamilyName: name },
      };
    })();
  },
});
