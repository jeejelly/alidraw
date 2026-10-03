import { getFormValue } from "../actionProperties";
import { register } from "../register";

import { LocalFontPicker } from "./LocalFontPicker";
import { getTextOf, hasText, updateTexts } from "./shared";

export { LocalFontPicker };

export const actionChangeLocalFont = register<string | null>({
  name: "changeLocalFont",
  label: "labels.localFont",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    const name = typeof value === "string" && value ? value : null;
    const result = updateTexts(app, elements, appState, {
      fontFamilyName: name,
    });
    return {
      ...result,
      appState: { ...appState, currentItemFontFamilyName: name },
    };
  },
  PanelComponent: ({ elements, appState, updateData, app }) => {
    const current = getFormValue<string | null>(
      elements,
      app,
      (element) => getTextOf(element, app)?.fontFamilyName ?? null,
      (element) => hasText(element, app),
      (hasSelection) =>
        hasSelection ? null : appState.currentItemFontFamilyName,
    );
    return <LocalFontPicker current={current} onSelect={updateData} />;
  },
});
