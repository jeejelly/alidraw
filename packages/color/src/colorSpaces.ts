/** Colour spaces: hex, RGB, HSL and HSV conversions, and WCAG contrast. */
import { rgbToHex } from "./hex";

export type HSL = { h: number; s: number; l: number };

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const wrap = (hue: number) => ((hue % 360) + 360) % 360;

export const hexToRgb = (hex: string): [number, number, number] => {
  let digits = hex.replace("#", "").trim();
  if (digits.length === 3) {
    digits = digits
      .split("")
      .map((char) => char + char)
      .join("");
  }
  const packed = parseInt(digits.slice(0, 6), 16);
  return Number.isFinite(packed)
    ? [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255]
    : [0, 0, 0];
};

export const hexToHsl = (hex: string): HSL => {
  const [red, green, blue] = hexToRgb(hex).map((x) => x / 255);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (!delta) {
    return { h: 0, s: 0, l: lightness * 100 };
  }
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue =
    max === red
      ? ((green - blue) / delta) % 6
      : max === green
      ? (blue - red) / delta + 2
      : (red - green) / delta + 4;
  hue *= 60;
  return { h: wrap(hue), s: saturation * 100, l: lightness * 100 };
};

export const hslToHex = ({ h: hue, s: saturation, l: lightness }: HSL) => {
  const wrappedHue = wrap(hue);
  const saturationRatio = clamp(saturation, 0, 100) / 100;
  const lightnessRatio = clamp(lightness, 0, 100) / 100;
  const chroma = (1 - Math.abs(2 * lightnessRatio - 1)) * saturationRatio;
  const x = chroma * (1 - Math.abs(((wrap(wrappedHue) / 60) % 2) - 1));
  const offset = lightnessRatio - chroma / 2;
  const [red, green, blue] =
    wrappedHue < 60
      ? [chroma, x, 0]
      : wrappedHue < 120
      ? [x, chroma, 0]
      : wrappedHue < 180
      ? [0, chroma, x]
      : wrappedHue < 240
      ? [0, x, chroma]
      : wrappedHue < 300
      ? [x, 0, chroma]
      : [chroma, 0, x];
  return rgbToHex(
    (red + offset) * 255,
    (green + offset) * 255,
    (blue + offset) * 255,
  );
};

/** relative luminance (WCAG) */
export const luminance = (hex: string) => {
  const [red, green, blue] = hexToRgb(hex).map((channel) => {
    const linear = channel / 255;
    return linear <= 0.03928
      ? linear / 12.92
      : ((linear + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

/** WCAG contrast ratio, 1 to 21 */
export const contrast = (first: string, second: string) => {
  const [hi, lo] = [luminance(first), luminance(second)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

export type HSV = { h: number; s: number; v: number };

export const hexToHsv = (hex: string): HSV => {
  const [red, green, blue] = hexToRgb(hex).map((x) => x / 255);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  if (delta) {
    hue =
      max === red
        ? ((green - blue) / delta) % 6
        : max === green
        ? (blue - red) / delta + 2
        : (red - green) / delta + 4;
    hue = wrap(hue * 60);
  }
  return { h: hue, s: max ? (delta / max) * 100 : 0, v: max * 100 };
};

export const hsvToHex = ({ h: hue, s: saturation, v: value }: HSV) => {
  const saturationRatio = clamp(saturation, 0, 100) / 100;
  const valueRatio = clamp(value, 0, 100) / 100;
  const chroma = valueRatio * saturationRatio;
  const hh = wrap(hue) / 60;
  const x = chroma * (1 - Math.abs((hh % 2) - 1));
  const offset = valueRatio - chroma;
  const [red, green, blue] =
    hh < 1
      ? [chroma, x, 0]
      : hh < 2
      ? [x, chroma, 0]
      : hh < 3
      ? [0, chroma, x]
      : hh < 4
      ? [0, x, chroma]
      : hh < 5
      ? [x, 0, chroma]
      : [chroma, 0, x];
  return rgbToHex(
    (red + offset) * 255,
    (green + offset) * 255,
    (blue + offset) * 255,
  );
};
