import type { PixelData } from "./vectorize";

/** a line of text found in a bitmap, in its pixels */
export type OcrLine = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** 0 to 100 */
  confidence: number;
};

export type Ocr = (image: PixelData) => Promise<OcrLine[]>;

const toCanvas = (image: PixelData) => {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d")!;
  const data = new ImageData(
    new Uint8ClampedArray(image.data as ArrayLike<number> as any),
    image.width,
    image.height,
  );
  ctx.putImageData(data, 0, 0);
  return canvas;
};

/**
 * Text recognition with Tesseract (loaded on first use; it fetches its engine and
 * the language data from its CDN, so it needs a network connection once).
 */
export const recognizeLines: Ocr = async (image) => {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(
      toCanvas(image),
      {},
      { blocks: true },
    );
    const lines: OcrLine[] = [];
    for (const block of data.blocks ?? []) {
      for (const paragraph of block.paragraphs) {
        for (const line of paragraph.lines) {
          const text = line.text.replace(/\s+/g, " ").trim();
          if (!text) {
            continue;
          }
          lines.push({
            text,
            x: line.bbox.x0,
            y: line.bbox.y0,
            width: line.bbox.x1 - line.bbox.x0,
            height: line.bbox.y1 - line.bbox.y0,
            confidence: line.confidence,
          });
        }
      }
    }
    return lines;
  } finally {
    await worker.terminate();
  }
};
