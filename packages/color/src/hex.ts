const byteToHex = (value: number) =>
  Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, "0");

export const rgbToHex = (red: number, green: number, blue: number) =>
  `#${byteToHex(red)}${byteToHex(green)}${byteToHex(blue)}`;

/** "#abc" / "#aabbcc" -> "#aabbcc"; null for anything else */
export const normalizeHex = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!match) {
    return null;
  }
  const hex = match[1].toLowerCase();
  return `#${
    hex.length === 3 ? [...hex].map((char) => char + char).join("") : hex
  }`;
};
