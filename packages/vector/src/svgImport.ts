import { randomId } from "@excalidraw/common";
import {
  getPathUpdate,
  newElement,
  newLinearElement,
  newPathElement,
  newTextElement,
} from "@excalidraw/element";
import { pointFrom, type LocalPoint } from "@excalidraw/math";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { area, geometry } from "./svgGeometry";
import { circle, parsePath, rrect, type SubPath } from "./svgPath";
import { DEFAULT_STYLE, styleOf, type Style } from "./svgStyle";
import {
  apply,
  isAxisAligned,
  mul,
  numbers,
  parseTransform,
  scaleOf,
  type Matrix,
} from "./svgTransform";

/**
 * SVG files as editable shapes: paths, rectangles, circles, lines, polygons
 * and text become path, rectangle, ellipse, line and text elements, with their
 * colours, stroke widths and transforms; one group per file.
 */
export type SvgImportResult = {
  elements: ExcalidrawElement[];
  skipped: string[];
};

type Context = {
  group: string;
  out: ExcalidrawElement[];
  skipped: Set<string>;
};

/** tags whose content is not drawn */
const NOT_DRAWN = new Set([
  "defs",
  "clippath",
  "mask",
  "metadata",
  "title",
  "desc",
  "style",
  "filter",
  "symbol",
  "pattern",
]);
/** not drawn, and not worth telling the user about */
const SILENTLY_IGNORED = new Set([
  "defs",
  "metadata",
  "title",
  "desc",
  "style",
]);
const UNSUPPORTED = new Set(["image", "use", "foreignobject"]);

const common = (context: Context, style: Style, fillable = true) => ({
  strokeColor: style.stroke,
  backgroundColor: fillable ? style.fill : "transparent",
  fillStyle: "solid" as const,
  strokeWidth: Math.max(
    style.stroke === "transparent" ? 0 : 0.5,
    style.strokeWidth,
  ),
  roughness: 0,
  opacity: Math.round(Math.max(0, Math.min(1, style.opacity)) * 100),
  groupIds: [context.group],
});

/** the style with its stroke width taken through the transform's scale */
const scaledStyle = (style: Style, matrix: Matrix): Style => ({
  ...style,
  strokeWidth: style.strokeWidth * scaleOf(matrix),
});

const numAttr = (node: Element, name: string, fallback = 0) =>
  parseFloat(node.getAttribute(name) ?? "") || fallback;

type Geometry = ReturnType<typeof geometry>[number];

const toPoints = (points: readonly [number, number][]) =>
  points.map((point) => pointFrom<LocalPoint>(point[0], point[1]));

const pushPath = (
  context: Context,
  element: any,
  update: Parameters<typeof getPathUpdate>[1],
) => {
  context.out.push({ ...element, ...getPathUpdate(element, update) } as any);
};

/** several filled closed outlines: the biggest is the shape, the others holes */
const addHoledPath = (
  context: Context,
  base: ReturnType<typeof common>,
  subs: SubPath[],
  geos: Geometry[],
) => {
  const order = subs
    .map((subPath, index) => [area(subPath), index])
    .sort((first, second) => second[0] - first[0]);
  const main = geos[order[0][1]];
  const holes = order.slice(1).map(([, index]) => geos[index]);
  const element = newPathElement({
    ...base,
    x: 0,
    y: 0,
    points: toPoints(main.pts),
    handles: main.handles,
    closed: true,
    contours: holes.map((subShape) => ({
      points: toPoints(subShape.pts),
      handles: subShape.handles,
    })),
  });
  pushPath(context, element, {
    points: element.points,
    handles: element.handles,
    contours: element.contours,
  });
};

const addPaths = (
  context: Context,
  subs: SubPath[],
  matrix: Matrix,
  style: Style,
  closedFill: boolean,
) => {
  const geos = geometry(subs, matrix);
  if (!geos.length) {
    return;
  }
  const filled = style.fill !== "transparent";
  const base = common(context, scaledStyle(style, matrix), closedFill);
  if (filled && geos.every((subShape) => subShape.closed) && geos.length > 1) {
    addHoledPath(context, base, subs, geos);
    return;
  }
  for (const subShape of geos) {
    const element = newPathElement({
      ...base,
      backgroundColor: subShape.closed ? base.backgroundColor : "transparent",
      x: 0,
      y: 0,
      points: toPoints(subShape.pts),
      handles: subShape.handles,
      closed: subShape.closed,
    });
    pushPath(context, element, {
      points: element.points,
      handles: element.handles,
    });
  }
};

/** rectangles and ellipses stay shapes unless the transform skews or flips them */
const keepsShape = (matrix: Matrix) =>
  isAxisAligned(matrix) && matrix[0] > 0 && matrix[3] > 0;

const addRect = (
  context: Context,
  node: Element,
  matrix: Matrix,
  style: Style,
) => {
  const x = numAttr(node, "x");
  const y = numAttr(node, "y");
  const width = numAttr(node, "width");
  const height = numAttr(node, "height");
  const radius = Math.min(
    numAttr(node, "rx", numAttr(node, "ry")),
    width / 2,
    height / 2,
  );
  if (!keepsShape(matrix)) {
    addPaths(
      context,
      parsePath(rrect(x, y, width, height, radius)),
      matrix,
      style,
      true,
    );
    return;
  }
  const [left, top] = apply(matrix, x, y);
  context.out.push(
    newElement({
      ...common(context, scaledStyle(style, matrix)),
      type: "rectangle",
      x: left,
      y: top,
      width: width * matrix[0],
      height: height * matrix[3],
      roundness: radius > 0 ? { type: 3, value: radius * matrix[0] } : null,
    }) as any,
  );
};

const addEllipse = (
  context: Context,
  node: Element,
  matrix: Matrix,
  style: Style,
  isCircle: boolean,
) => {
  const centerX = numAttr(node, "cx");
  const centerY = numAttr(node, "cy");
  const radiusX = isCircle ? numAttr(node, "r") : numAttr(node, "rx");
  const radiusY = isCircle ? numAttr(node, "r") : numAttr(node, "ry");
  if (!keepsShape(matrix)) {
    addPaths(
      context,
      parsePath(circle(centerX, centerY, radiusX)),
      matrix,
      style,
      true,
    );
    return;
  }
  const [left, top] = apply(matrix, centerX - radiusX, centerY - radiusY);
  context.out.push(
    newElement({
      ...common(context, scaledStyle(style, matrix)),
      type: "ellipse",
      x: left,
      y: top,
      width: radiusX * 2 * matrix[0],
      height: radiusY * 2 * matrix[3],
    }) as any,
  );
};

const addLine = (
  context: Context,
  node: Element,
  matrix: Matrix,
  style: Style,
) => {
  const [startX, startY] = apply(
    matrix,
    numAttr(node, "x1"),
    numAttr(node, "y1"),
  );
  const [endX, endY] = apply(matrix, numAttr(node, "x2"), numAttr(node, "y2"));
  context.out.push(
    newLinearElement({
      ...common(context, scaledStyle(style, matrix), false),
      strokeColor: style.stroke === "transparent" ? style.fill : style.stroke,
      type: "line",
      x: startX,
      y: startY,
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(endX - startX, endY - startY),
      ],
    }) as any,
  );
};

const addPoly = (
  context: Context,
  node: Element,
  matrix: Matrix,
  style: Style,
  isPolygon: boolean,
) => {
  const values = numbers(node.getAttribute("points") ?? "");
  const commands: string[] = [];
  for (let index = 0; index + 1 < values.length; index += 2) {
    commands.push(`${index ? "L" : "M"}${values[index]} ${values[index + 1]}`);
  }
  if (commands.length) {
    addPaths(
      context,
      parsePath(commands.join("") + (isPolygon ? "Z" : "")),
      matrix,
      style,
      isPolygon,
    );
  }
};

const addText = (
  context: Context,
  node: Element,
  matrix: Matrix,
  style: Style,
) => {
  const content = (node.textContent ?? "").replace(/\s+/g, " ").trim();
  if (!content) {
    return;
  }
  const [left, top] = apply(matrix, numAttr(node, "x"), numAttr(node, "y"));
  const size = style.fontSize * scaleOf(matrix);
  context.out.push(
    newTextElement({
      ...common(context, style),
      strokeColor: style.fill === "transparent" ? style.stroke : style.fill,
      backgroundColor: "transparent",
      text: content,
      fontSize: Math.max(6, size),
      x: left,
      y: top - size,
    }) as any,
  );
};

const walk = (
  context: Context,
  node: Element,
  matrix: Matrix,
  parent: Style,
) => {
  const tag = node.localName.toLowerCase();
  if (NOT_DRAWN.has(tag)) {
    if (!SILENTLY_IGNORED.has(tag)) {
      context.skipped.add(tag);
    }
    return;
  }
  if (node.getAttribute("display") === "none") {
    return;
  }
  const combined = mul(matrix, parseTransform(node.getAttribute("transform")));
  const style = styleOf(node, parent);
  switch (tag) {
    case "svg":
    case "g":
    case "a":
      for (const child of Array.from(node.children)) {
        walk(context, child, combined, style);
      }
      break;
    case "path":
      try {
        addPaths(
          context,
          parsePath(node.getAttribute("d") ?? ""),
          combined,
          style,
          true,
        );
      } catch {
        context.skipped.add("path data");
      }
      break;
    case "rect":
      addRect(context, node, combined, style);
      break;
    case "circle":
    case "ellipse":
      addEllipse(context, node, combined, style, tag === "circle");
      break;
    case "line":
      addLine(context, node, combined, style);
      break;
    case "polyline":
    case "polygon":
      addPoly(context, node, combined, style, tag === "polygon");
      break;
    case "text":
      addText(context, node, combined, style);
      break;
    default:
      if (UNSUPPORTED.has(tag)) {
        context.skipped.add(tag);
      }
  }
};

/** the viewBox decides the units: the drawing keeps its proportions */
const viewBoxMatrix = (
  root: Element,
  origin: { x: number; y: number },
  maxSize: number,
): Matrix => {
  const box = numbers(root.getAttribute("viewBox") ?? "");
  const svgWidth =
    parseFloat(root.getAttribute("width") ?? "") || box[2] || 100;
  const svgHeight =
    parseFloat(root.getAttribute("height") ?? "") || box[3] || 100;
  const hasBox = box.length === 4;
  const boxX = hasBox ? box[0] : 0;
  const boxY = hasBox ? box[1] : 0;
  const boxWidth = hasBox ? box[2] : svgWidth;
  const boxHeight = hasBox ? box[3] : svgHeight;
  let scale = Math.min(svgWidth / boxWidth, svgHeight / boxHeight) || 1;
  const biggest = Math.max(boxWidth * scale, boxHeight * scale);
  if (biggest > maxSize) {
    scale *= maxSize / biggest;
  }
  return [scale, 0, 0, scale, origin.x - boxX * scale, origin.y - boxY * scale];
};

export const importSvg = (
  text: string,
  origin: { x: number; y: number } = { x: 0, y: 0 },
  maxSize = 1200,
): SvgImportResult => {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const root = doc.documentElement;
  if (
    !root ||
    root.nodeName.toLowerCase() !== "svg" ||
    doc.querySelector("parsererror")
  ) {
    throw new Error("not a valid SVG file");
  }
  const context: Context = {
    group: randomId(),
    out: [],
    skipped: new Set(),
  };
  walk(context, root, viewBoxMatrix(root, origin, maxSize), DEFAULT_STYLE);
  return { elements: context.out, skipped: [...context.skipped] };
};
