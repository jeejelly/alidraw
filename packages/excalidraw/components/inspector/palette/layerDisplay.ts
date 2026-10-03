import { t } from "../../../i18n";

export const layerName = (element: { type: string; text?: string }) =>
  element.type === "text" && element.text
    ? element.text.split("\n")[0].slice(0, 40)
    : t(`element.${element.type}` as any) || element.type;

const LAYER_GLYPH: Record<string, string> = {
  rectangle: "▭",
  diamond: "◇",
  ellipse: "◯",
  arrow: "→",
  line: "╱",
  freedraw: "✎",
  path: "✒",
  text: "T",
  image: "▣",
  frame: "#",
  magicframe: "#",
  stickynote: "▤",
  embeddable: "⧉",
  iframe: "⧉",
};

export const layerGlyph = (type: string) => LAYER_GLYPH[type] ?? "•";
