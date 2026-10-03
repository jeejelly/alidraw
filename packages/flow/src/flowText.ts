import {
  getBoundTextElement,
  newElementWith,
  refreshTextDimensions,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

export const textOf = (
  element: ExcalidrawElement,
  map: Map<string, ExcalidrawElement>,
): ExcalidrawTextElement | null =>
  getBoundTextElement(element, map as any) as ExcalidrawTextElement | null;

/** a free text with new words, sized to them */
export const relabelText = (
  textElement: ExcalidrawTextElement,
  text: string,
): ExcalidrawTextElement => {
  const base = newElementWith(textElement, { text, originalText: text });
  const dims = refreshTextDimensions(
    base,
    null,
    new Map([[base.id, base]]) as any,
    text,
  );
  return dims ? newElementWith(base, dims) : base;
};
