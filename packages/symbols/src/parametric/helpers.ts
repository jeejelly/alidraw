import { rectShape, type Param, type Shape } from "../shapes";

import type { Token } from "../theme";
export const STATES = [
  "enabled",
  "hover",
  "focus",
  "pressed",
  "disabled",
] as const;

export const stateParam: Param = {
  key: "state",
  label: "State",
  kind: "choice",
  def: "enabled",
  options: STATES,
};

export const num = (
  key: string,
  label: string,
  def: number,
  min: number,
  max: number,
): Param => ({ key, label, kind: "number", def, min, max });
export const bool = (key: string, label: string, def: boolean): Param => ({
  key,
  label,
  kind: "bool",
  def,
});
export const text = (key: string, label: string, def: string): Param => ({
  key,
  label,
  kind: "text",
  def,
});
export const pick = (
  key: string,
  label: string,
  def: string,
  options: readonly string[],
): Param => ({ key, label, kind: "choice", def, options });

export const ICON_CHOICES = [
  "none",
  "play",
  "plus",
  "download",
  "search",
  "menu",
  "close",
  "check",
  "heart",
  "star",
  "settings",
  "share",
  "layers",
  "folder-plus",
  "trash",
  "pencil",
  "more-vertical",
  "arrow-left",
  "user",
  "bell",
];

/** approximate width of a text at a size, enough to size pills and tabs */
export const tw = (content: string, size: number) =>
  Math.ceil(content.length * size * 0.58);
export const list = (csv: string) =>
  String(csv)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

/** Hover and pressed add an outline, focus a ring, disabled greys the control out. */
export const look = (
  state: string,
  fill: Token | null,
  stroke: Token | null,
  ink: Token,
) => {
  switch (state) {
    case "hover":
      return { f: fill, s: stroke ?? "text", ink, sw: 1, ring: false };
    case "pressed":
      return { f: fill, s: "text" as Token, ink, sw: 2.5, ring: false };
    case "focus":
      return { f: fill, s: stroke, ink, sw: 1, ring: true };
    case "disabled":
      return {
        f: fill ? ("surfaceAlt" as Token) : null,
        s: stroke ? ("border" as Token) : null,
        ink: "muted" as Token,
        sw: 1,
        ring: false,
      };
    default:
      return { f: fill, s: stroke, ink, sw: 1, ring: false };
  }
};

export const ring = (
  x: number,
  y: number,
  width: number,
  height: number,
  radius: any,
): Shape =>
  rectShape(x - 4, y - 4, width + 8, height + 8, {
    r: radius,
    f: null,
    s: "accent",
    sw: 2,
  });
