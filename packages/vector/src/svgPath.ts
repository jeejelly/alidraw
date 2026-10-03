/**
 * Path data (`M L H V C S Q T Z`, absolute or relative) as closed or open
 * sub-paths of anchors with bezier handles, the form a path element stores.
 * Handles are offsets from their anchor.
 */
export type Anchor = {
  x: number;
  y: number;
  in: [number, number] | null;
  out: [number, number] | null;
};

export type SubPath = { anchors: Anchor[]; closed: boolean };

type Cubic = [number, number, number, number, number, number];

const arcAngle = (ux: number, uy: number, vx: number, vy: number) =>
  Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);

/** the SVG endpoint form of an arc as its centre, start angle and sweep angle */
const arcCentre = (
  [x1, y1]: [number, number],
  [x2, y2]: [number, number],
  radii: [number, number],
  rotation: number,
  large: boolean,
  sweep: boolean,
) => {
  let [rx, ry] = radii;
  const phi = (rotation * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const scale = Math.sqrt(lambda);
    rx *= scale;
    ry *= scale;
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coef = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const startAngle = arcAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let sweepAngle = arcAngle(
    (x1p - cxp) / rx,
    (y1p - cyp) / ry,
    (-x1p - cxp) / rx,
    (-y1p - cyp) / ry,
  );
  if (!sweep && sweepAngle > 0) {
    sweepAngle -= 2 * Math.PI;
  } else if (sweep && sweepAngle < 0) {
    sweepAngle += 2 * Math.PI;
  }
  return {
    cx: cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2,
    cy: sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2,
    rx,
    ry,
    cosPhi,
    sinPhi,
    startAngle,
    sweepAngle,
  };
};

/** an SVG elliptical arc as cubic curves: [c1x, c1y, c2x, c2y, x, y] each */
export const arcToCubics = (
  x1: number,
  y1: number,
  rxIn: number,
  ryIn: number,
  rotation: number,
  large: boolean,
  sweep: boolean,
  x2: number,
  y2: number,
): Cubic[] => {
  const radiusX = Math.abs(rxIn);
  const radiusY = Math.abs(ryIn);
  if ((x1 === x2 && y1 === y2) || radiusX === 0 || radiusY === 0) {
    return [];
  }
  const { cx, cy, rx, ry, cosPhi, sinPhi, startAngle, sweepAngle } = arcCentre(
    [x1, y1],
    [x2, y2],
    [radiusX, radiusY],
    rotation,
    large,
    sweep,
  );
  const segments = Math.max(
    1,
    Math.ceil(Math.abs(sweepAngle) / (Math.PI / 2) - 1e-6),
  );
  const step = sweepAngle / segments;
  const handleLength = (4 / 3) * Math.tan(step / 4);
  const point = (angle: number): [number, number] => [
    cx + rx * Math.cos(angle) * cosPhi - ry * Math.sin(angle) * sinPhi,
    cy + rx * Math.cos(angle) * sinPhi + ry * Math.sin(angle) * cosPhi,
  ];
  const deriv = (angle: number): [number, number] => [
    -rx * Math.sin(angle) * cosPhi - ry * Math.cos(angle) * sinPhi,
    -rx * Math.sin(angle) * sinPhi + ry * Math.cos(angle) * cosPhi,
  ];
  const out: Cubic[] = [];
  for (let index = 0; index < segments; index++) {
    const fromAngle = startAngle + index * step;
    const toAngle = fromAngle + step;
    const from = point(fromAngle);
    const to = point(toAngle);
    const fromSlope = deriv(fromAngle);
    const toSlope = deriv(toAngle);
    out.push([
      from[0] + handleLength * fromSlope[0],
      from[1] + handleLength * fromSlope[1],
      to[0] - handleLength * toSlope[0],
      to[1] - handleLength * toSlope[1],
      index === segments - 1 ? x2 : to[0],
      index === segments - 1 ? y2 : to[1],
    ]);
  }
  return out;
};

const tokens = (pathData: string) =>
  pathData.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];

/** where the pen is while path data is read */
type Pen = {
  subPaths: SubPath[];
  current: SubPath | null;
  x: number;
  y: number;
  /** where the current sub-path started */
  startX: number;
  startY: number;
  /** the last control point, for smooth continuations */
  lastControl: [number, number] | null;
};

const lastAnchor = (pen: Pen) =>
  pen.current!.anchors[pen.current!.anchors.length - 1];

const moveTo = (pen: Pen, px: number, py: number) => {
  pen.current = {
    anchors: [{ x: px, y: py, in: null, out: null }],
    closed: false,
  };
  pen.subPaths.push(pen.current);
  pen.startX = px;
  pen.startY = py;
  pen.x = px;
  pen.y = py;
  pen.lastControl = null;
};

const lineTo = (pen: Pen, px: number, py: number) => {
  pen.current!.anchors.push({ x: px, y: py, in: null, out: null });
  pen.x = px;
  pen.y = py;
  pen.lastControl = null;
};

const cubicTo = (
  pen: Pen,
  c1x: number,
  c1y: number,
  c2x: number,
  c2y: number,
  px: number,
  py: number,
) => {
  const from = lastAnchor(pen);
  from.out = [c1x - from.x, c1y - from.y];
  pen.current!.anchors.push({
    x: px,
    y: py,
    in: [c2x - px, c2y - py],
    out: null,
  });
  pen.x = px;
  pen.y = py;
  pen.lastControl = [c2x, c2y];
};

const closePath = (pen: Pen) => {
  const { current } = pen;
  if (current) {
    const first = current.anchors[0];
    const tail = lastAnchor(pen);
    // a final point on the start is the same anchor
    if (
      current.anchors.length > 1 &&
      Math.abs(tail.x - first.x) < 1e-6 &&
      Math.abs(tail.y - first.y) < 1e-6
    ) {
      first.in = tail.in;
      current.anchors.pop();
    }
    current.closed = true;
    pen.x = pen.startX;
    pen.y = pen.startY;
  }
  pen.lastControl = null;
};

const arcTo = (
  pen: Pen,
  radiusX: number,
  radiusY: number,
  rotation: number,
  large: boolean,
  sweep: boolean,
  px: number,
  py: number,
) => {
  const cubics = arcToCubics(
    pen.x,
    pen.y,
    radiusX,
    radiusY,
    rotation,
    large,
    sweep,
    px,
    py,
  );
  for (const cubic of cubics) {
    cubicTo(pen, cubic[0], cubic[1], cubic[2], cubic[3], cubic[4], cubic[5]);
  }
  if (!cubics.length) {
    lineTo(pen, px, py);
  }
  pen.x = px;
  pen.y = py;
};

/** Draws one command with `next()` as its numbers; returns the command to repeat. */
const runCommand = (
  pen: Pen,
  command: string,
  relative: boolean,
  next: () => number,
) => {
  const ox = relative ? pen.x : 0;
  const oy = relative ? pen.y : 0;
  switch (command.toUpperCase()) {
    case "M": {
      moveTo(pen, next() + ox, next() + oy);
      // further pairs are implicit lines
      return relative ? "l" : "L";
    }
    case "L":
      lineTo(pen, next() + ox, next() + oy);
      break;
    case "H":
      lineTo(pen, next() + ox, pen.y);
      break;
    case "V":
      lineTo(pen, pen.x, next() + oy);
      break;
    case "C": {
      const c1x = next() + ox;
      const c1y = next() + oy;
      const c2x = next() + ox;
      const c2y = next() + oy;
      cubicTo(pen, c1x, c1y, c2x, c2y, next() + ox, next() + oy);
      break;
    }
    case "S": {
      const c2x = next() + ox;
      const c2y = next() + oy;
      const c1: [number, number] = pen.lastControl
        ? [2 * pen.x - pen.lastControl[0], 2 * pen.y - pen.lastControl[1]]
        : [pen.x, pen.y];
      cubicTo(pen, c1[0], c1[1], c2x, c2y, next() + ox, next() + oy);
      break;
    }
    case "Q": {
      const qx = next() + ox;
      const qy = next() + oy;
      const px = next() + ox;
      const py = next() + oy;
      cubicTo(
        pen,
        pen.x + (2 / 3) * (qx - pen.x),
        pen.y + (2 / 3) * (qy - pen.y),
        px + (2 / 3) * (qx - px),
        py + (2 / 3) * (qy - py),
        px,
        py,
      );
      break;
    }
    case "Z":
      closePath(pen);
      break;
    case "A": {
      const radiusX = next();
      const radiusY = next();
      const rotation = next();
      const large = next();
      const sweep = next();
      arcTo(
        pen,
        radiusX,
        radiusY,
        rotation,
        large !== 0,
        sweep !== 0,
        next() + ox,
        next() + oy,
      );
      break;
    }
    default:
      throw new Error(`unsupported path command ${command}`);
  }
  return command;
};

export const parsePath = (pathData: string): SubPath[] => {
  const list = tokens(pathData);
  const pen: Pen = {
    subPaths: [],
    current: null,
    x: 0,
    y: 0,
    startX: 0,
    startY: 0,
    lastControl: null,
  };
  let cursor = 0;
  let command = "";
  const next = () => Number(list[cursor++]);
  while (cursor < list.length) {
    if (/[a-zA-Z]/.test(list[cursor])) {
      command = list[cursor++];
    }
    command = runCommand(pen, command, command === command.toLowerCase(), next);
  }
  return pen.subPaths;
};

const ARC_KAPPA = 0.5522847498;

/** path data for shapes the icons are drawn from */
export const circle = (cx: number, cy: number, radius: number) =>
  `M${cx - radius} ${cy}C${cx - radius} ${cy - radius * ARC_KAPPA} ${
    cx - radius * ARC_KAPPA
  } ${cy - radius} ${cx} ${cy - radius}C${cx + radius * ARC_KAPPA} ${
    cy - radius
  } ${cx + radius} ${cy - radius * ARC_KAPPA} ${cx + radius} ${cy}C${
    cx + radius
  } ${cy + radius * ARC_KAPPA} ${cx + radius * ARC_KAPPA} ${
    cy + radius
  } ${cx} ${cy + radius}C${cx - radius * ARC_KAPPA} ${cy + radius} ${
    cx - radius
  } ${cy + radius * ARC_KAPPA} ${cx - radius} ${cy}Z`;

export const rrect = (
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 0,
) => {
  const clamped = Math.min(radius, width / 2, height / 2);
  if (!clamped) {
    return `M${x} ${y}H${x + width}V${y + height}H${x}Z`;
  }
  const handle = clamped * (1 - ARC_KAPPA);
  return (
    `M${x + clamped} ${y}H${x + width - clamped}C${x + width - handle} ${y} ${
      x + width
    } ${y + handle} ${x + width} ${y + clamped}V${y + height - clamped}C${
      x + width
    } ${y + height - handle} ${x + width - handle} ${y + height} ${
      x + width - clamped
    } ${y + height}H${x + clamped}C${x + handle} ${y + height} ${x} ${
      y + height - handle
    } ${x} ${y + height - clamped}V${y + clamped}` +
    `C${x} ${y + handle} ${x + handle} ${y} ${x + clamped} ${y}Z`
  );
};

export const ticks = (
  cx: number,
  cy: number,
  r1: number,
  r2: number,
  sides: number,
  from = 0,
) => {
  let pathData = "";
  for (let index = 0; index < sides; index++) {
    const angle = from + (index * Math.PI * 2) / sides;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    pathData += `M${+(cx + cos * r1).toFixed(2)} ${+(cy + sin * r1).toFixed(
      2,
    )}L${+(cx + cos * r2).toFixed(2)} ${+(cy + sin * r2).toFixed(2)}`;
  }
  return pathData;
};

export const star = (
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  points = 5,
) => {
  let pathData = "";
  for (let index = 0; index < points * 2; index++) {
    const angle = -Math.PI / 2 + (index * Math.PI) / points;
    const rad = index % 2 ? innerRadius : outerRadius;
    pathData += `${index ? "L" : "M"}${+(cx + Math.cos(angle) * rad).toFixed(
      2,
    )} ${+(cy + Math.sin(angle) * rad).toFixed(2)}`;
  }
  return `${pathData}Z`;
};

/** `n` dots as tiny circles */
export const dot = (cx: number, cy: number, radius = 0.9) =>
  circle(cx, cy, radius);
