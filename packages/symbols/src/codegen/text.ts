export const html = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const kt = (text: string) =>
  `"${String(text)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\$/g, "\\$")}"`;
export const list = (text: string) =>
  String(text)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
export const num = (value: number) => Math.round(value);
export const pad2 = (value: number) => String(value).padStart(2, "0");

export const indent = (text: string, spaces: number) =>
  text
    .split("\n")
    .map((line) => " ".repeat(spaces) + line)
    .join("\n");
