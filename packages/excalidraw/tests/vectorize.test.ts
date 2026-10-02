import {
  traceToElements,
  traceToSvg,
  type PixelData,
} from "../image/vectorize";

/** a 60 x 60 picture: white background, a red disc, a blue square with a hole */
const picture = (): PixelData => {
  const w = 60;
  const data = new Uint8ClampedArray(w * w * 4);
  const put = (x: number, y: number, [r, g, b]: number[]) => {
    const i = (y * w + x) * 4;
    data.set([r, g, b, 255], i);
  };
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      let c = [255, 255, 255];
      if ((x - 18) ** 2 + (y - 20) ** 2 < 12 ** 2) {
        c = [220, 40, 40];
      }
      if (x >= 34 && x < 54 && y >= 30 && y < 54) {
        c =
          (x - 44) ** 2 + (y - 42) ** 2 < 5 ** 2
            ? [255, 255, 255]
            : [30, 60, 200];
      }
      put(x, y, c);
    }
  }
  return { width: w, height: w, data };
};

const near = (hex: string, [r, g, b]: number[], within = 40) => {
  const n = parseInt(hex.slice(1), 16);
  return (
    Math.abs((n >> 16) - r) < within &&
    Math.abs(((n >> 8) & 255) - g) < within &&
    Math.abs((n & 255) - b) < within
  );
};

describe("vectorizing an image", () => {
  it("traces colour areas into paths in the picture's own colours, scaled to the target", async () => {
    const out = await traceToElements(
      picture(),
      { x: 100, y: 200, width: 120, height: 120 },
      { colors: 6, smoothing: 0.3 },
    );
    expect(new Set(out.map((e) => e.type))).toEqual(new Set(["path"]));
    expect(new Set(out.map((e) => e.groupIds[0])).size).toBe(1);
    const fills = out.map((e) => e.backgroundColor);
    // the red disc, the blue square and the white page are all there, not blended
    expect(fills.some((f) => near(f, [220, 40, 40]))).toBe(true);
    expect(fills.some((f) => near(f, [30, 60, 200]))).toBe(true);
    expect(fills.some((f) => near(f, [255, 255, 255]))).toBe(true);
    // twice the size, from (100, 200)
    const xs = out.flatMap((e) => [e.x, e.x + e.width]);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(92);
    expect(Math.max(...xs)).toBeLessThanOrEqual(228);
    // the blue square has a round hole: kept as a contour
    const blue = out.find((e) => near(e.backgroundColor, [30, 60, 200]))!;
    expect(((blue as any).contours ?? []).length).toBeGreaterThan(0);
  });

  it("is curved, not a staircase, and smoother means fewer points", async () => {
    const curves = async (smoothing: number) =>
      (await traceToSvg(picture(), { colors: 6, smoothing })).match(/C/g)
        ?.length ?? 0;
    const fine = await curves(0);
    const smooth = await curves(1);
    expect(fine).toBeGreaterThan(10);
    expect(smooth).toBeLessThan(fine);
    // no straight pixel runs: the outline of the disc is made of curves only
    const svg = await traceToSvg(picture(), { colors: 6, smoothing: 0.4 });
    expect(svg).not.toMatch(/ L ?\d/);
  });

  it("is deterministic", async () => {
    const a = await traceToSvg(picture(), { colors: 5 });
    const b = await traceToSvg(picture(), { colors: 5 });
    expect(a).toBe(b);
  });
});
