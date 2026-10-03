import { arcToCubics, parsePath } from "@excalidraw/vector";
import { importSvg, parseColor, parseTransform } from "@excalidraw/vector";

const svg = (
  body: string,
  attrs = 'width="100" height="50" viewBox="0 0 100 50"',
) => `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`;

describe("svg path arcs", () => {
  it("draws a half circle as two quarter curves ending where asked", () => {
    const segs = arcToCubics(0, 0, 10, 10, 0, false, true, 20, 0);
    expect(segs).toHaveLength(2);
    expect(segs[1].slice(4)).toEqual([20, 0]);
    const [sub] = parsePath("M0 0 A10 10 0 0 1 20 0");
    expect(sub.anchors).toHaveLength(3);
  });
});

describe("svg colours and transforms", () => {
  it("reads the colour forms", () => {
    expect(parseColor("#fc0")).toBe("#ffcc00");
    expect(parseColor("rgb(255, 0, 0)")).toBe("#ff0000");
    expect(parseColor("none")).toBe("transparent");
    expect(parseColor("red")).toBe("#ff0000");
    expect(parseColor("url(#g)")).toBeNull();
  });
  it("composes transforms", () => {
    expect(parseTransform("translate(10 5) scale(2)")).toEqual([
      2, 0, 0, 2, 10, 5,
    ]);
    const rotation = parseTransform("rotate(90)");
    expect(Math.round(rotation[0])).toBe(0);
    expect(Math.round(rotation[1])).toBe(1);
  });
});

describe("importing an svg as shapes", () => {
  it("makes one group of paths, rectangles, ellipses, lines and text", () => {
    const { elements } = importSvg(
      svg(
        `<rect x="10" y="5" width="40" height="20" rx="4" fill="#ff0000"/>
         <circle cx="70" cy="25" r="10" fill="blue" stroke="black" stroke-width="2"/>
         <path d="M0 0 L20 0 L10 20 Z" fill="#00ff00"/>
         <line x1="0" y1="40" x2="100" y2="40" stroke="#333"/>
         <text x="5" y="48" font-size="8" fill="#111">Hello</text>`,
      ),
    );
    const types = elements.map((element) => element.type).sort();
    expect(types).toEqual(["ellipse", "line", "path", "rectangle", "text"]);
    expect(new Set(elements.map((element) => element.groupIds[0])).size).toBe(
      1,
    );
    const rect = elements.find((element) => element.type === "rectangle")!;
    expect(rect).toMatchObject({
      x: 10,
      y: 5,
      width: 40,
      height: 20,
      backgroundColor: "#ff0000",
    });
    const dot = elements.find((element) => element.type === "ellipse")!;
    expect(dot).toMatchObject({
      width: 20,
      backgroundColor: "#0000ff",
      strokeColor: "#000000",
      strokeWidth: 2,
    });
  });

  it("applies group transforms and inherited styles", () => {
    const { elements } = importSvg(
      svg(
        `<g transform="translate(30 10)" fill="#abcdef"><rect width="10" height="10"/></g>`,
      ),
    );
    expect(elements[0]).toMatchObject({
      x: 30,
      y: 10,
      backgroundColor: "#abcdef",
    });
  });

  it("scales by the viewBox and caps the size", () => {
    const small = importSvg(
      svg(
        `<rect width="50" height="25"/>`,
        'width="200" height="100" viewBox="0 0 100 50"',
      ),
    );
    expect(small.elements[0].width).toBe(100);
    const huge = importSvg(
      svg(`<rect width="5000" height="5000"/>`, 'width="5000" height="5000"'),
      { x: 0, y: 0 },
      1000,
    );
    expect(huge.elements[0].width).toBe(1000);
  });

  it("keeps holes of a filled outline as contours", () => {
    const { elements } = importSvg(
      svg(`<path fill="#000" d="M0 0H40V40H0Z M10 10V30H30V10Z"/>`),
    );
    expect(elements).toHaveLength(1);
    const path = elements[0] as any;
    expect(path.type).toBe("path");
    expect(path.contours).toHaveLength(1);
  });

  it("turns a rotated rectangle into a path, and says what it left out", () => {
    const { elements, skipped } = importSvg(
      svg(
        `<rect width="20" height="10" transform="rotate(30)"/><image href="x.png"/><clipPath id="c"/>`,
      ),
    );
    expect(elements[0].type).toBe("path");
    expect(skipped).toEqual(expect.arrayContaining(["image", "clippath"]));
  });

  it("refuses what is not an svg", () => {
    expect(() => importSvg("<html></html>")).toThrow(/valid SVG/);
    expect(() => importSvg("nonsense")).toThrow();
  });
});
