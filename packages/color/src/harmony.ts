/**
 * Colour harmonies on the colour wheel (the way Adobe Color and Inkscape's
 * palettes offer them), and a whole symbol theme built from one: a base colour
 * and a rule give a family of colours that go together.
 */
import { rgbToHex } from "./swatches";

export type HSL = { h: number; s: number; l: number };

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const wrap = (h: number) => ((h % 360) + 360) % 360;

export const hexToRgb = (hex: string): [number, number, number] => {
  let v = hex.replace("#", "").trim();
  if (v.length === 3) {
    v = v
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const n = parseInt(v.slice(0, 6), 16);
  return Number.isFinite(n)
    ? [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    : [0, 0, 0];
};

export const hexToHsl = (hex: string): HSL => {
  const [r, g, b] = hexToRgb(hex).map((x) => x / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) {
    return { h: 0, s: 0, l: l * 100 };
  }
  const s = d / (1 - Math.abs(2 * l - 1));
  let h =
    max === r
      ? ((g - b) / d) % 6
      : max === g
      ? (b - r) / d + 2
      : (r - g) / d + 4;
  h *= 60;
  return { h: wrap(h), s: s * 100, l: l * 100 };
};

export const hslToHex = ({ h: hue, s, l }: HSL) => {
  const h = wrap(hue);
  const S = clamp(s, 0, 100) / 100;
  const L = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const x = c * (1 - Math.abs(((wrap(h) / 60) % 2) - 1));
  const m = L - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
      ? [x, c, 0]
      : h < 180
      ? [0, c, x]
      : h < 240
      ? [0, x, c]
      : h < 300
      ? [x, 0, c]
      : [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
};

/** relative luminance (WCAG) */
export const luminance = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio, 1 to 21 */
export const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

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
  const b = hexToHsl(base);
  const { steps, base: index } = STEPS[rule];
  if (rule === "shades") {
    const colors = [14, 32, b.l, 68, 88].map((l, i) =>
      i === 2 ? base : hslToHex({ ...b, l }),
    );
    return { colors, index };
  }
  const colors = steps.map(([dh, ds, dl], i) =>
    i === index && !dh && ds === 1 && !dl
      ? base
      : hslToHex({
          h: b.h + dh,
          s: clamp(b.s * ds, 0, 100),
          l: clamp(b.l + dl, 6, 94),
        }),
  );
  return { colors, index };
};

/** the hue offsets of the colours (for the handles on the wheel) */
export const harmonyAngles = (rule: HarmonyRule) =>
  STEPS[rule].steps.map(([dh]) => dh);

// -----------------------------------------------------------------------------
// a whole theme from a harmony
// -----------------------------------------------------------------------------

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
  for (const c of colors) {
    const hsl = hexToHsl(c);
    const d = Math.abs(((hsl.h - hue + 540) % 360) - 180);
    if (hsl.s > 25 && d < gap) {
      gap = d;
      best = c;
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
  const b = hexToHsl(base);
  const family = harmony(base, rule).colors;
  const tint = clamp(b.s * 0.3, 4, 24);
  const dark = mode === "dark";
  const neutral = (l: number, s = tint) => hslToHex({ h: b.h, s, l });
  // the accent stays recognisably the base, moved only as far as legibility needs
  let accent = base;
  const wantsLight = dark ? 52 : 0;
  if (dark && b.l < wantsLight) {
    accent = hslToHex({ ...b, l: wantsLight });
  }
  const pop = { s: clamp(Math.max(b.s, 55), 0, 90), l: clamp(b.l, 42, 58) };
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

// -----------------------------------------------------------------------------
// ready-made palettes
// -----------------------------------------------------------------------------

export type PalettePreset = {
  id: string;
  name: string;
  colors: string[];
  tags: string;
};

/** common, freely usable palettes (values of open palettes such as Material, Tailwind, Solarized, Nord) */
export const PALETTE_PRESETS: readonly PalettePreset[] = [
  {
    id: "material",
    name: "Material 500",
    tags: "google android",
    colors: [
      "#f44336",
      "#e91e63",
      "#9c27b0",
      "#673ab7",
      "#3f51b5",
      "#2196f3",
      "#03a9f4",
      "#00bcd4",
      "#009688",
      "#4caf50",
      "#8bc34a",
      "#cddc39",
      "#ffeb3b",
      "#ffc107",
      "#ff9800",
      "#ff5722",
    ],
  },
  {
    id: "tailwind",
    name: "Tailwind 500",
    tags: "web css",
    colors: [
      "#ef4444",
      "#f97316",
      "#f59e0b",
      "#eab308",
      "#84cc16",
      "#22c55e",
      "#10b981",
      "#14b8a6",
      "#06b6d4",
      "#0ea5e9",
      "#3b82f6",
      "#6366f1",
      "#8b5cf6",
      "#a855f7",
      "#d946ef",
      "#ec4899",
    ],
  },
  {
    id: "flat",
    name: "Flat UI",
    tags: "flat classic",
    colors: [
      "#1abc9c",
      "#2ecc71",
      "#3498db",
      "#9b59b6",
      "#34495e",
      "#f1c40f",
      "#e67e22",
      "#e74c3c",
      "#ecf0f1",
      "#95a5a6",
    ],
  },
  {
    id: "pastel",
    name: "Pastel",
    tags: "soft light",
    colors: [
      "#ffd1dc",
      "#ffdfba",
      "#fff5ba",
      "#c9f2c7",
      "#bae1ff",
      "#d7baff",
      "#f5c2e7",
      "#b5ead7",
    ],
  },
  {
    id: "earth",
    name: "Earth",
    tags: "natural warm",
    colors: [
      "#3d2b1f",
      "#6f4e37",
      "#a0785a",
      "#c8a27a",
      "#e8d5b5",
      "#7a8450",
      "#4f5d2f",
      "#b5651d",
    ],
  },
  {
    id: "ocean",
    name: "Ocean",
    tags: "blue sea",
    colors: [
      "#03045e",
      "#023e8a",
      "#0077b6",
      "#0096c7",
      "#00b4d8",
      "#48cae4",
      "#90e0ef",
      "#caf0f8",
    ],
  },
  {
    id: "forest",
    name: "Forest",
    tags: "green nature",
    colors: [
      "#081c15",
      "#1b4332",
      "#2d6a4f",
      "#40916c",
      "#52b788",
      "#74c69d",
      "#95d5b2",
      "#d8f3dc",
    ],
  },
  {
    id: "sunset",
    name: "Sunset",
    tags: "warm orange",
    colors: [
      "#2b1055",
      "#7597de",
      "#d4508b",
      "#ff6b57",
      "#ff9e57",
      "#ffd166",
      "#fff1c1",
    ],
  },
  {
    id: "candy",
    name: "Candy",
    tags: "bright fun",
    colors: [
      "#ff6b6b",
      "#feca57",
      "#48dbfb",
      "#ff9ff3",
      "#54a0ff",
      "#5f27cd",
      "#1dd1a1",
      "#ff9f43",
    ],
  },
  {
    id: "neon",
    name: "Neon",
    tags: "vivid dark",
    colors: [
      "#0d0221",
      "#261447",
      "#ff2a6d",
      "#05d9e8",
      "#d1f7ff",
      "#f9c80e",
      "#7d4cdb",
    ],
  },
  {
    id: "mono",
    name: "Greys",
    tags: "neutral",
    colors: [
      "#0b0b0f",
      "#23232b",
      "#3c3c46",
      "#5b5b66",
      "#8a8a95",
      "#b8b8c2",
      "#dcdce2",
      "#f4f4f7",
    ],
  },
  {
    id: "solarized",
    name: "Solarized",
    tags: "code",
    colors: [
      "#002b36",
      "#073642",
      "#586e75",
      "#839496",
      "#eee8d5",
      "#fdf6e3",
      "#b58900",
      "#cb4b16",
      "#dc322f",
      "#d33682",
      "#6c71c4",
      "#268bd2",
      "#2aa198",
      "#859900",
    ],
  },
  {
    id: "nord",
    name: "Nord",
    tags: "code cool",
    colors: [
      "#2e3440",
      "#3b4252",
      "#434c5e",
      "#4c566a",
      "#d8dee9",
      "#e5e9f0",
      "#eceff4",
      "#8fbcbb",
      "#88c0d0",
      "#81a1c1",
      "#5e81ac",
      "#bf616a",
      "#d08770",
      "#ebcb8b",
      "#a3be8c",
      "#b48ead",
    ],
  },
  {
    id: "dracula",
    name: "Dracula",
    tags: "code dark",
    colors: [
      "#282a36",
      "#44475a",
      "#f8f8f2",
      "#6272a4",
      "#8be9fd",
      "#50fa7b",
      "#ffb86c",
      "#ff79c6",
      "#bd93f9",
      "#ff5555",
      "#f1fa8c",
    ],
  },
  {
    id: "retro",
    name: "Retro",
    tags: "vintage",
    colors: [
      "#264653",
      "#2a9d8f",
      "#e9c46a",
      "#f4a261",
      "#e76f51",
      "#fefae0",
      "#bc6c25",
    ],
  },
  {
    id: "banking",
    name: "Fintech",
    tags: "app modern coral",
    colors: [
      "#20202e",
      "#6c5ce7",
      "#ff6b57",
      "#1fcf9b",
      "#4f8dff",
      "#f5c542",
      "#f4f5fb",
      "#ffffff",
    ],
  },
];

/** the colour of a palette that stands out most (the best accent) */
export const mostVivid = (colors: readonly string[]) =>
  [...colors].sort((a, b) => {
    const A = hexToHsl(a);
    const B = hexToHsl(b);
    const mid = (x: HSL) => 1 - Math.abs(x.l - 50) / 50;
    return B.s * mid(B) - A.s * mid(A);
  })[0];

// -----------------------------------------------------------------------------
// HSV, what a colour wheel is drawn in
// -----------------------------------------------------------------------------

export type HSV = { h: number; s: number; v: number };

export const hexToHsv = (hex: string): HSV => {
  const [r, g, b] = hexToRgb(hex).map((x) => x / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    h =
      max === r
        ? ((g - b) / d) % 6
        : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
    h = wrap(h * 60);
  }
  return { h, s: max ? (d / max) * 100 : 0, v: max * 100 };
};

export const hsvToHex = ({ h, s, v }: HSV) => {
  const S = clamp(s, 0, 100) / 100;
  const V = clamp(v, 0, 100) / 100;
  const c = V * S;
  const hh = wrap(h) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = V - c;
  const [r, g, b] =
    hh < 1
      ? [c, x, 0]
      : hh < 2
      ? [x, c, 0]
      : hh < 3
      ? [0, c, x]
      : hh < 4
      ? [0, x, c]
      : hh < 5
      ? [x, 0, c]
      : [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
};
