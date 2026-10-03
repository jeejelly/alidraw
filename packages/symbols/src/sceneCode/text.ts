export { html as esc, indent } from "../codegen/text";

export const ktText = (text: string) =>
  `"${text
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\$/g, "\\$")
    .replace(/\n/g, "\\n")}"`;
export const roundTenth = (value: number) => Math.round(value * 10) / 10;
export const solid = (color: string) => color && color !== "transparent";
export const argb = (hex: string) =>
  `Color(0xFF${hex.replace("#", "").slice(0, 6).toUpperCase()})`;
