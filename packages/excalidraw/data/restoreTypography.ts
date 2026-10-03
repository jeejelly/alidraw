import type { ExcalidrawTextElement } from "@excalidraw/element/types";
import type { Mutable } from "@excalidraw/common/utility-types";

const MAX_FONT_FAMILY_NAME_LENGTH = 200;

const isValidFontFamilyName = (name: unknown): name is string =>
  typeof name === "string" && !!name.trim();

const isValidFontWeight = (weight: unknown): weight is number =>
  typeof weight === "number" &&
  weight >= 100 &&
  weight <= 900 &&
  weight !== 400;

/** optional typography fields: keep them only when well formed */
export const dropMalformedTypography = (element: ExcalidrawTextElement) => {
  const mutable: Partial<Mutable<ExcalidrawTextElement>> = element;
  if (!isValidFontFamilyName(element.fontFamilyName)) {
    delete mutable.fontFamilyName;
  }
  if (element.fontUnit !== "dp" && element.fontUnit !== "px") {
    delete mutable.fontUnit;
  }
  if (!isValidFontWeight(element.fontWeight)) {
    delete mutable.fontWeight;
  }
  if (element.fontStyle !== "italic") {
    delete mutable.fontStyle;
  }
};

/** the typography fields left after `dropMalformedTypography`, normalized */
export const restoreTypography = (element: ExcalidrawTextElement) => ({
  ...(isValidFontFamilyName(element.fontFamilyName)
    ? {
        fontFamilyName: element.fontFamilyName
          .trim()
          .slice(0, MAX_FONT_FAMILY_NAME_LENGTH),
      }
    : {}),
  ...(element.fontUnit === "dp" || element.fontUnit === "px"
    ? { fontUnit: element.fontUnit }
    : {}),
  ...(typeof element.fontWeight === "number"
    ? { fontWeight: Math.round(element.fontWeight / 100) * 100 }
    : {}),
  ...(element.fontStyle === "italic" ? { fontStyle: "italic" as const } : {}),
});
