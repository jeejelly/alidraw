export type ColorTarget = "stroke" | "background";
export type PaletteTab =
  | "design"
  | "layers"
  | "flow"
  | "symbols"
  | `host:${string}`;

export type RunAction = (action: any, value?: unknown) => unknown;

export const INSPECTOR_FOCUS_TRANSFORM = "excalidraw:inspector-focus-transform";
export const DEFAULT_STROKE = "#1e1e1e";
