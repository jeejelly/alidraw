import type { SymbolTheme } from "../theme";
import type { Values } from "../components";

/** a symbol on the canvas, as the generators see it */
export type CodeItem = {
  component: string;
  values: Values;
  /** the size on the canvas, in px */
  width: number;
  height: number;
  x: number;
  y: number;
};

export type Out = { html: string; kt: string };
export type Generator = (values: Values, it: CodeItem) => Out;
export type GeneratorMap = Record<string, (theme: SymbolTheme) => Generator>;
