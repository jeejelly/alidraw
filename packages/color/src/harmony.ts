/**
 * Colour harmonies on the colour wheel (the way Adobe Color and Inkscape's
 * palettes offer them), and a whole symbol theme built from one: a base colour
 * and a rule give a family of colours that go together.
 */
import { clamp, contrast, hexToHsl, hslToHex, type HSL } from "./colorSpaces";

export type HarmonyRule =
  | "analogous"
  | "monochromatic"
  | "triad"
  | "complementary"
  | "split"
  | "square"
  | "compound"
  | "shades";

export const HARMONIES: { id: HarmonyRule; label: string; hint: string }[] = [
  {
    id: "analogous",
    label: "Analogous",
    hint: "Neighbours on the wheel: calm and natural",
  },
  {
    id: "monochromatic",
    label: "Monochromatic",
    hint: "One hue, from dark to light",
  },
  {
    id: "triad",
    label: "Triad",
    hint: "Three hues, a third of the wheel apart",
  },
  {
    id: "complementary",
    label: "Complementary",
    hint: "Opposites: the strongest contrast",
  },
  {
    id: "split",
    label: "Split complementary",
    hint: "The base and the two beside its opposite",
  },
  {
    id: "square",
    label: "Square",
    hint: "Four hues, a quarter of the wheel apart",
  },
  {
    id: "compound",
    label: "Compound",
    hint: "The opposite and its neighbours, with the base",
  },
  {
    id: "shades",
    label: "Shades",
    hint: "The same colour in steps of lightness",
  },
];

/** [hue offset, saturation factor, lightness shift] of each of the five colours; the base is the one at index `base` */
type Step = [number, number, number];
const STEPS: Record<HarmonyRule, { base: number; steps: Step[] }> = {
  analogous: {
    base: 2,
    steps: [
      [-60, 1, 0],
      [-30, 1, 0],
      [0, 1, 0],
      [30, 1, 0],
      [60, 1, 0],
    ],
  },
  monochromatic: {
    base: 2,
    steps: [
      [0, 0.9, -28],
      [0, 1, -14],
      [0, 1, 0],
      [0, 0.85, 14],
      [0, 0.6, 28],
    ],
  },
  triad: {
    base: 0,
    steps: [
      [0, 1, 0],
      [120, 1, 0],
      [240, 1, 0],
      [0, 0.8, 22],
      [120, 0.8, -16],
    ],
  },
  complementary: {
    base: 1,
    steps: [
      [0, 1, -18],
      [0, 1, 0],
      [0, 0.7, 24],
      [180, 1, 0],
      [180, 0.8, -18],
    ],
  },
  split: {
    base: 0,
    steps: [
      [0, 1, 0],
      [150, 1, 0],
      [210, 1, 0],
      [0, 0.7, 24],
      [180, 0.4, 30],
    ],
  },
  square: {
    base: 0,
    steps: [
      [0, 1, 0],
      [90, 1, 0],
      [180, 1, 0],
      [270, 1, 0],
      [0, 0.7, 24],
    ],
  },
  compound: {
    base: 2,
    steps: [
      [165, 1, 0],
      [195, 1, 0],
      [0, 1, 0],
      [30, 0.9, 0],
      [330, 0.9, 0],
    ],
  },
  shades: {
    base: 2,
    steps: [
      [0, 1, 0],
      [0, 1, 0],
      [0, 1, 0],
      [0, 1, 0],
      [0, 1, 0],
    ],
  },
};

/** five colours that go with `base` under `rule`; `index` tells which one is the base */
export const harmony = (
  base: string,
  rule: HarmonyRule,
): { colors: string[]; index: number } => {
  const baseHsl = hexToHsl(base);
  const { steps, base: index } = STEPS[rule];
  if (rule === "shades") {
    const colors = [14, 32, baseHsl.l, 68, 88].map((lightness, position) =>
      position === 2 ? base : hslToHex({ ...baseHsl, l: lightness }),
    );
    return { colors, index };
  }
  const colors = steps.map(([dh, ds, dl], position) =>
    position === index && !dh && ds === 1 && !dl
      ? base
      : hslToHex({
          h: baseHsl.h + dh,
          s: clamp(baseHsl.s * ds, 0, 100),
          l: clamp(baseHsl.l + dl, 6, 94),
        }),
  );
  return { colors, index };
};

/** the hue offsets of the colours (for the handles on the wheel) */
export const harmonyAngles = (rule: HarmonyRule) =>
  STEPS[rule].steps.map(([dh]) => dh);

export type ThemeColors = {
  page: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  onAccent: string;
  success: string;
  danger: string;
};

const closestHue = (colors: string[], hue: number, within: number) => {
  let best: string | null = null;
  let gap = within;
  for (const color of colors) {
    const hsl = hexToHsl(color);
    const distance = Math.abs(((hsl.h - hue + 540) % 360) - 180);
    if (hsl.s > 25 && distance < gap) {
      gap = distance;
      best = color;
    }
  }
  return best;
};

/** a readable ink on `bg`: white or near-black, whichever contrasts more */
export const inkOn = (bg: string, light = "#ffffff", dark = "#14141f") =>
  contrast(bg, light) >= contrast(bg, dark) ? light : dark;

/**
 * The ten tokens of a symbol theme from a base colour and a harmony: neutrals
 * tinted with the base hue, the base as the accent (kept readable), and the
 * success and danger colours taken from the harmony when it has a green or a
 * red, otherwise made in the accent's own saturation and lightness.
 */
export const themeFromHarmony = (
  base: string,
  rule: HarmonyRule,
  mode: "light" | "dark" = "light",
): ThemeColors => {
  const baseHsl = hexToHsl(base);
  const family = harmony(base, rule).colors;
  const tint = clamp(baseHsl.s * 0.3, 4, 24);
  const dark = mode === "dark";
  const neutral = (lightness: number, saturation = tint) =>
    hslToHex({ h: baseHsl.h, s: saturation, l: lightness });
  // the accent stays recognisably the base, moved only as far as legibility needs
  let accent = base;
  const wantsLight = dark ? 52 : 0;
  if (dark && baseHsl.l < wantsLight) {
    accent = hslToHex({ ...baseHsl, l: wantsLight });
  }
  const pop = {
    s: clamp(Math.max(baseHsl.s, 55), 0, 90),
    l: clamp(baseHsl.l, 42, 58),
  };
  const green = closestHue(family, 140, 50) ?? hslToHex({ h: 150, ...pop });
  const red = closestHue(family, 5, 45) ?? hslToHex({ h: 4, ...pop });
  const page = dark ? neutral(9) : neutral(96);
  const surface = dark ? neutral(14) : "#ffffff";
  const text = dark ? neutral(96, tint * 0.4) : neutral(11, tint * 0.8);
  return {
    page,
    surface,
    surfaceAlt: dark ? neutral(19) : neutral(92),
    border: dark ? neutral(27) : neutral(86),
    text,
    muted: dark ? neutral(68, tint * 0.6) : neutral(42, tint * 0.6),
    accent,
    onAccent: inkOn(accent),
    success: green,
    danger: red,
  };
};

/** the colour of a palette that stands out most (the best accent) */
export const mostVivid = (colors: readonly string[]) =>
  [...colors].sort((first, second) => {
    const firstHsl = hexToHsl(first);
    const secondHsl = hexToHsl(second);
    const mid = (hsl: HSL) => 1 - Math.abs(hsl.l - 50) / 50;
    return secondHsl.s * mid(secondHsl) - firstHsl.s * mid(firstHsl);
  })[0];
