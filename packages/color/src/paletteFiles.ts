/** Swatch palette files: .gpl and .ase, read and written. */
import { normalizeHex, rgbToHex } from "./hex";

export type ImportedColor = { name: string; color: string };

/** .gpl palette: "R G B  name" lines after a "GIMP Palette" header line */
export const parseGpl = (text: string): ImportedColor[] => {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  if (!/^GIMP Palette/i.test(lines[0]?.trim() ?? "")) {
    return [];
  }
  const colors: ImportedColor[] = [];
  for (const line of lines.slice(1)) {
    const match = /^\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(?:\s+(.*))?$/.exec(
      line,
    );
    if (match) {
      const [red, green, blue] = [match[1], match[2], match[3]].map(Number);
      if (red <= 255 && green <= 255 && blue <= 255) {
        const color = rgbToHex(red, green, blue);
        colors.push({ color, name: match[4]?.trim() || color });
      }
    }
  }
  return colors;
};

/** ASE swatch files: RGB, Gray and CMYK colour entries (Lab is skipped) */
export const parseAse = (buffer: ArrayBuffer): ImportedColor[] => {
  const view = new DataView(buffer);
  if (buffer.byteLength < 12 || view.getUint32(0) !== 0x41534546) {
    return [];
  }
  const blocks = view.getUint32(8);
  const colors: ImportedColor[] = [];
  let offset = 12;
  for (
    let index = 0;
    index < blocks && offset + 6 <= buffer.byteLength;
    index++
  ) {
    const type = view.getUint16(offset);
    const length = view.getUint32(offset + 2);
    const start = offset + 6;
    const end = start + length;
    if (end > buffer.byteLength) {
      break;
    }
    if (type === 0x0001) {
      let cursor = start;
      const nameLength = view.getUint16(cursor);
      cursor += 2;
      let name = "";
      for (let charIndex = 0; charIndex < nameLength - 1; charIndex++) {
        name += String.fromCharCode(view.getUint16(cursor + charIndex * 2));
      }
      cursor += nameLength * 2;
      const model = String.fromCharCode(
        ...[0, 1, 2, 3].map((byteIndex) => view.getUint8(cursor + byteIndex)),
      );
      cursor += 4;
      const readFloat = (slot: number) => view.getFloat32(cursor + slot * 4);
      let rgb: [number, number, number] | null = null;
      if (model === "RGB ") {
        rgb = [readFloat(0) * 255, readFloat(1) * 255, readFloat(2) * 255];
      } else if (model === "Gray") {
        rgb = [readFloat(0) * 255, readFloat(0) * 255, readFloat(0) * 255];
      } else if (model === "CMYK") {
        const black = readFloat(3);
        rgb = [
          255 * (1 - readFloat(0)) * (1 - black),
          255 * (1 - readFloat(1)) * (1 - black),
          255 * (1 - readFloat(2)) * (1 - black),
        ];
      }
      if (rgb) {
        const color = rgbToHex(...rgb);
        colors.push({ name: name.trim() || color, color });
      }
    }
    offset = end;
  }
  return colors;
};

const rgbOf = (hex: string): [number, number, number] => {
  const normalized = normalizeHex(hex) ?? "#000000";
  return [1, 3, 5].map((offset) =>
    parseInt(normalized.slice(offset, offset + 2), 16),
  ) as [number, number, number];
};

/** a .gpl file: the colours as "R G B  name" lines */
export const serializeGpl = (
  colors: readonly ImportedColor[],
  name = "Palette",
) =>
  `GIMP Palette\nName: ${name.replace(/[\r\n]/g, " ")}\nColumns: 8\n#\n${colors
    .map((entry) => {
      const [red, green, blue] = rgbOf(entry.color);
      return `${String(red).padStart(3)} ${String(green).padStart(3)} ${String(
        blue,
      ).padStart(3)}  ${entry.name.replace(/[\r\n]/g, " ")}`;
    })
    .join("\n")}\n`;

/** an .ase file: one RGB colour entry per swatch */
export const serializeAse = (colors: readonly ImportedColor[]): ArrayBuffer => {
  const entries = colors.map((entry) => {
    const name = entry.name.slice(0, 80);
    // name length counts the end mark; the entry is name, model, three floats, kind
    const length = 2 + (name.length + 1) * 2 + 4 + 12 + 2;
    return { name, length, rgb: rgbOf(entry.color) };
  });
  const total = 12 + entries.reduce((sum, entry) => sum + 6 + entry.length, 0);
  const buffer = new ArrayBuffer(total);
  const view = new DataView(buffer);
  view.setUint32(0, 0x41534546);
  view.setUint16(4, 1);
  view.setUint16(6, 0);
  view.setUint32(8, entries.length);
  let offset = 12;
  for (const entry of entries) {
    view.setUint16(offset, 0x0001);
    view.setUint32(offset + 2, entry.length);
    offset += 6;
    view.setUint16(offset, entry.name.length + 1);
    offset += 2;
    for (let index = 0; index < entry.name.length; index++) {
      view.setUint16(offset + index * 2, entry.name.charCodeAt(index));
    }
    view.setUint16(offset + entry.name.length * 2, 0);
    offset += (entry.name.length + 1) * 2;
    for (const [index, char] of "RGB ".split("").entries()) {
      view.setUint8(offset + index, char.charCodeAt(0));
    }
    offset += 4;
    for (const [index, channel] of entry.rgb.entries()) {
      view.setFloat32(offset + index * 4, channel / 255);
    }
    offset += 12;
    // "normal" colour
    view.setUint16(offset, 2);
    offset += 2;
  }
  return buffer;
};

export const parsePaletteFile = async (
  file: File,
): Promise<ImportedColor[]> => {
  const name = file.name.toLowerCase();
  if (name.endsWith(".ase")) {
    return parseAse(await file.arrayBuffer());
  }
  if (name.endsWith(".gpl")) {
    return parseGpl(await file.text());
  }
  return [];
};
