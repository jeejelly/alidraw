import {
  TRACE_PRESETS,
  traceImage,
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

/** a 200 x 120 screen: grey page, a white rounded card, a blue button, a dark "label" block */
const screen = (): PixelData => {
  const width = 200;
  const height = 120;
  const data = new Uint8ClampedArray(width * height * 4);
  const paint = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    [red, green, blue]: number[],
    radius = 0,
  ) => {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const dx = Math.max(x0 + radius - x, 0, x - (x1 - 1 - radius));
        const dy = Math.max(y0 + radius - y, 0, y - (y1 - 1 - radius));
        if (dx * dx + dy * dy <= radius * radius) {
          data.set([red, green, blue, 255], (y * width + x) * 4);
        }
      }
    }
  };
  paint(0, 0, width, height, [235, 235, 238]);
  paint(10, 10, 190, 110, [255, 255, 255], 8);
  paint(24, 70, 104, 96, [40, 90, 220], 6);
  paint(24, 24, 84, 36, [30, 30, 30]);
  return { width, height, data };
};

describe("vectorizing a screen capture", () => {
  const ocr = async () => [
    { text: "Welcome", x: 24, y: 24, width: 60, height: 12, confidence: 95 },
  ];

  it("keeps boxes as rectangles and the text as a text block", async () => {
    const out = await traceImage(
      screen(),
      { x: 0, y: 0, width: 400, height: 240 },
      { ...TRACE_PRESETS.ui, ocr },
    );
    const types = out.elements.map((element) => element.type);
    expect(
      types.filter((type) => type === "rectangle").length,
    ).toBeGreaterThanOrEqual(3);
    // the page is under the card, the card under the button
    expect(out.regions.length).toBe(types.length - out.textBlocks);
    const text = out.elements.find((element) => element.type === "text") as any;
    expect(text.text).toBe("Welcome");
    expect(out.textBlocks).toBe(1);
    // the letters were painted out: no dark rectangle where the text is
    expect(
      out.elements.some(
        (element) =>
          element.type !== "text" &&
          near(element.backgroundColor, [30, 30, 30]),
      ),
    ).toBe(false);
    // doubled: the button is at (48, 140), 160 wide
    const button = out.elements.find((element) =>
      near(element.backgroundColor, [40, 90, 220]),
    )!;
    expect(button.x).toBeCloseTo(48, 0);
    expect(button.width).toBeCloseTo(160, 0);
    expect((button as any).roundness).toBeTruthy();
  });

  it("goes on without text when the recogniser fails", async () => {
    const out = await traceImage(
      screen(),
      { x: 0, y: 0, width: 200, height: 120 },
      {
        ...TRACE_PRESETS.ui,
        ocr: async () => {
          throw new Error("offline");
        },
      },
    );
    expect(out.textBlocks).toBe(0);
    expect(out.warning).toMatch(/offline/);
    expect(out.elements.length).toBeGreaterThan(2);
  });
});
