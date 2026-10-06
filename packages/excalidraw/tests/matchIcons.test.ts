import {
  getIcon,
  iconElements,
  matchIcons,
  type IconMatch,
} from "@excalidraw/symbols";
import { parsePath, traceImage, type PixelData } from "@excalidraw/vector";

/** the icon drawn as a bitmap: dark strokes on white, `size` pixels square, with a margin */
const draw = (name: string, size: number): PixelData => {
  const margin = Math.round(size * 0.4);
  const side = size + margin * 2;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);
  const scale = size / 24;
  const dots: [number, number][] = [];
  for (const sub of parsePath(getIcon(name)!.d)) {
    const count = sub.anchors.length;
    for (let index = 0; index < (sub.closed ? count : count - 1); index++) {
      const from = sub.anchors[index];
      const to = sub.anchors[(index + 1) % count];
      const c1 = [from.x + (from.out?.[0] ?? 0), from.y + (from.out?.[1] ?? 0)];
      const c2 = [to.x + (to.in?.[0] ?? 0), to.y + (to.in?.[1] ?? 0)];
      for (let step = 0; step <= 40; step++) {
        const t = step / 40;
        const u = 1 - t;
        dots.push([
          u ** 3 * from.x +
            3 * u * u * t * c1[0] +
            3 * u * t * t * c2[0] +
            t ** 3 * to.x,
          u ** 3 * from.y +
            3 * u * u * t * c1[1] +
            3 * u * t * t * c2[1] +
            t ** 3 * to.y,
        ]);
      }
    }
  }
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      if (
        dots.some(
          ([dx, dy]) =>
            Math.hypot(x - margin - dx * scale, y - margin - dy * scale) <=
            scale,
        )
      ) {
        data.set([20, 20, 20, 255], (y * side + x) * 4);
      }
    }
  }
  return { width: side, height: side, data };
};

const trace = (image: PixelData) =>
  traceImage(
    image,
    { x: 0, y: 0, width: image.width, height: image.height },
    { colors: 4, smoothing: 0.1, speckle: 1, shapes: true, corner: 50 },
  );

describe("matching traced shapes with library icons", () => {
  it.each(["search", "home", "close"])(
    "finds the %s icon in a picture of it",
    async (name) => {
      const { regions } = await trace(draw(name, 48));
      expect(matchIcons(regions).map((match) => match.name)).toContain(name);
    },
  );

  it("finds nothing in a blank picture", async () => {
    const { regions } = await trace({
      width: 40,
      height: 40,
      data: new Uint8ClampedArray(40 * 40 * 4).fill(255),
    });
    expect(matchIcons(regions)).toEqual([]);
  });

  it("places the icon over the match in the given colour", () => {
    const match: IconMatch = {
      name: "home",
      score: 1,
      regions: [0],
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      stroke: 2,
      fill: "#000",
    };
    const elements = iconElements(
      match,
      { x: 100, y: 200, width: 48, height: 48 },
      "#ff0000",
    );
    expect(elements.length).toBeGreaterThan(0);
    expect(new Set(elements.map((element) => element.strokeColor))).toEqual(
      new Set(["#ff0000"]),
    );
    expect(
      Math.min(...elements.map((element) => element.x)),
    ).toBeGreaterThanOrEqual(99);
  });
});
