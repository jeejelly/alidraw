import { newTextElement } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { OcrLine } from "./ocr";
import type { PixelData } from "./vectorize";

type Rgb = [number, number, number];

const hex = ([red, green, blue]: Rgb) =>
  `#${[red, green, blue]
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`;

const median = (values: number[]) => {
  const sorted = [...values].sort((first, second) => first - second);
  return sorted[Math.floor(sorted.length / 2)] ?? 255;
};

const pixelAt = (image: PixelData, x: number, y: number): Rgb => {
  const offset = (y * image.width + x) * 4;
  return [image.data[offset], image.data[offset + 1], image.data[offset + 2]];
};

const distance = (first: Rgb, second: Rgb) =>
  Math.hypot(first[0] - second[0], first[1] - second[1], first[2] - second[2]);

type Box = { x0: number; y0: number; x1: number; y1: number };

const clampBox = (image: PixelData, line: OcrLine, pad: number): Box => ({
  x0: Math.max(0, Math.floor(line.x - pad)),
  y0: Math.max(0, Math.floor(line.y - pad)),
  x1: Math.min(image.width, Math.ceil(line.x + line.width + pad)),
  y1: Math.min(image.height, Math.ceil(line.y + line.height + pad)),
});

/** the colour around a box: the median of the ring of pixels just outside it */
const backgroundOf = (image: PixelData, box: Box): Rgb => {
  const reds: number[] = [];
  const greens: number[] = [];
  const blues: number[] = [];
  const take = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= image.width || y >= image.height) {
      return;
    }
    const [red, green, blue] = pixelAt(image, x, y);
    reds.push(red);
    greens.push(green);
    blues.push(blue);
  };
  for (let x = box.x0 - 1; x <= box.x1; x++) {
    take(x, box.y0 - 1);
    take(x, box.y1);
  }
  for (let y = box.y0; y < box.y1; y++) {
    take(box.x0 - 1, y);
    take(box.x1, y);
  }
  return [median(reds), median(greens), median(blues)];
};

/** the colour of the letters: the mean of the pixels farthest from the background */
const inkOf = (image: PixelData, box: Box, background: Rgb): Rgb => {
  let far = 0;
  for (let y = box.y0; y < box.y1; y++) {
    for (let x = box.x0; x < box.x1; x++) {
      far = Math.max(far, distance(pixelAt(image, x, y), background));
    }
  }
  if (far < 24) {
    return background;
  }
  const sum: Rgb = [0, 0, 0];
  let count = 0;
  for (let y = box.y0; y < box.y1; y++) {
    for (let x = box.x0; x < box.x1; x++) {
      const pixel = pixelAt(image, x, y);
      if (distance(pixel, background) > far * 0.7) {
        sum[0] += pixel[0];
        sum[1] += pixel[1];
        sum[2] += pixel[2];
        count++;
      }
    }
  }
  return count ? [sum[0] / count, sum[1] / count, sum[2] / count] : background;
};

export type TextLine = OcrLine & { color: string; background: Rgb };

/** the recognised lines worth keeping: sure enough, with letters, not a speck */
export const usableLines = (lines: readonly OcrLine[]) =>
  lines.filter(
    (line) =>
      line.confidence >= 55 &&
      line.height >= 6 &&
      line.width >= 4 &&
      /[\p{L}\p{N}]/u.test(line.text) &&
      // a line of one stray symbol is usually a piece of an icon
      (line.text.length > 1 || /[\p{L}\p{N}]/u.test(line.text)),
  );

/**
 * The lines with their colours, and a copy of the bitmap with the lines painted out in
 * the colour around them (so the letters do not turn into shapes).
 */
export const takeOutText = (
  image: PixelData,
  lines: readonly OcrLine[],
): { image: PixelData; lines: TextLine[] } => {
  const data = new Uint8ClampedArray(image.data as ArrayLike<number>);
  const out: PixelData = { width: image.width, height: image.height, data };
  const taken: TextLine[] = [];
  for (const line of lines) {
    const box = clampBox(image, line, 0);
    const background = backgroundOf(image, clampBox(image, line, 1));
    const color = hex(inkOf(image, box, background));
    taken.push({ ...line, color, background });
    const wide = clampBox(image, line, 1);
    for (let y = wide.y0; y < wide.y1; y++) {
      for (let x = wide.x0; x < wide.x1; x++) {
        const offset = (y * image.width + x) * 4;
        data[offset] = background[0];
        data[offset + 1] = background[1];
        data[offset + 2] = background[2];
        data[offset + 3] = 255;
      }
    }
  }
  return { image: out, lines: taken };
};

type Block = { lines: TextLine[] };

/** neighbouring lines of one size, colour and left edge are one paragraph */
const blocksOf = (lines: readonly TextLine[]): Block[] => {
  const ordered = [...lines].sort(
    (first, second) => first.y - second.y || first.x - second.x,
  );
  const blocks: Block[] = [];
  for (const line of ordered) {
    const block = blocks.find((candidate) => {
      const last = candidate.lines[candidate.lines.length - 1];
      const gap = line.y - (last.y + last.height);
      return (
        Math.abs(line.x - last.x) < last.height * 0.6 &&
        Math.abs(line.height - last.height) / last.height < 0.3 &&
        gap > -last.height * 0.3 &&
        gap < last.height * 0.9 &&
        line.color === last.color
      );
    });
    if (block) {
      block.lines.push(line);
    } else {
      blocks.push({ lines: [line] });
    }
  }
  return blocks;
};

/** text elements for the recognised lines, placed and scaled from bitmap pixels onto the target */
export const textElements = (
  lines: readonly TextLine[],
  scale: { x: number; y: number; scaleX: number; scaleY: number },
  group: string,
): ExcalidrawElement[] =>
  blocksOf(lines).map((block) => {
    const first = block.lines[0];
    const text = block.lines.map((line) => line.text).join("\n");
    const height =
      Math.max(...block.lines.map((line) => line.height)) * scale.scaleY;
    const make = (fontSize: number) =>
      newTextElement({
        text,
        fontSize,
        strokeColor: first.color,
        textAlign: "left",
        groupIds: [group],
        x: scale.x + first.x * scale.scaleX,
        y: scale.y + first.y * scale.scaleY,
      });
    let fontSize = Math.max(6, Math.round(height / 0.95));
    let element = make(fontSize);
    // the face is not the picture's: fit the width when it is a close call
    const wanted =
      Math.max(...block.lines.map((line) => line.width)) * scale.scaleX;
    const ratio = wanted / element.width;
    if (ratio > 0.7 && ratio < 1.4) {
      fontSize = Math.max(6, Math.round(fontSize * ratio));
      element = make(fontSize);
    }
    return element;
  });
