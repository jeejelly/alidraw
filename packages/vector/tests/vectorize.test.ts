import {
  traceToElements,
  traceToSvg,
  type PixelData,
} from "@excalidraw/vector";

/** a 60 x 60 picture: white background, a red disc, a blue square with a hole */
const picture = (): PixelData => {
  const width = 60;
  const data = new Uint8ClampedArray(width * width * 4);
  const put = (x: number, y: number, [red, green, blue]: number[]) => {
    const offset = (y * width + x) * 4;
    data.set([red, green, blue, 255], offset);
  };
  for (let y = 0; y < width; y++) {
    for (let x = 0; x < width; x++) {
      let color = [255, 255, 255];
      if ((x - 18) ** 2 + (y - 20) ** 2 < 12 ** 2) {
        color = [220, 40, 40];
      }
      if (x >= 34 && x < 54 && y >= 30 && y < 54) {
        color =
          (x - 44) ** 2 + (y - 42) ** 2 < 5 ** 2
            ? [255, 255, 255]
            : [30, 60, 200];
      }
      put(x, y, color);
    }
  }
  return { width, height: width, data };
};

const near = (hex: string, [red, green, blue]: number[], within = 40) => {
  const packed = parseInt(hex.slice(1), 16);
  return (
    Math.abs((packed >> 16) - red) < within &&
    Math.abs(((packed >> 8) & 255) - green) < within &&
    Math.abs((packed & 255) - blue) < within
  );
};

describe("vectorizing an image", () => {
  it("traces colour areas into paths in the picture's own colours, scaled to the target", async () => {
    const out = await traceToElements(
      picture(),
      { x: 100, y: 200, width: 120, height: 120 },
      { colors: 6, smoothing: 0.3 },
    );
    expect(new Set(out.map((element) => element.type))).toEqual(
      new Set(["path"]),
    );
    expect(new Set(out.map((element) => element.groupIds[0])).size).toBe(1);
    const fills = out.map((element) => element.backgroundColor);
    // the red disc, the blue square and the white page are all there, not blended
    expect(fills.some((fill) => near(fill, [220, 40, 40]))).toBe(true);
    expect(fills.some((fill) => near(fill, [30, 60, 200]))).toBe(true);
    expect(fills.some((fill) => near(fill, [255, 255, 255]))).toBe(true);
    // twice the size, from (100, 200)
    const xs = out.flatMap((element) => [element.x, element.x + element.width]);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(92);
    expect(Math.max(...xs)).toBeLessThanOrEqual(228);
    // the blue square has a round hole: kept as a contour
    const blue = out.find((element) =>
      near(element.backgroundColor, [30, 60, 200]),
    )!;
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
    const first = await traceToSvg(picture(), { colors: 5 });
    const second = await traceToSvg(picture(), { colors: 5 });
    expect(first).toBe(second);
  });
});
