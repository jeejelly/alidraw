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
): [number, number, number, number, number, number][] => {
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if ((x1 === x2 && y1 === y2) || rx === 0 || ry === 0) {
    return [];
  }
  const phi = (rotation * Math.PI) / 180;
  const cp = Math.cos(phi);
  const sp = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cp * dx + sp * dy;
  const y1p = -sp * dx + cp * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const k = Math.sqrt(lambda);
    rx *= k;
    ry *= k;
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coef = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const cx = cp * cxp - sp * cyp + (x1 + x2) / 2;
  const cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dth = ang(
    (x1p - cxp) / rx,
    (y1p - cyp) / ry,
    (-x1p - cxp) / rx,
    (-y1p - cyp) / ry,
  );
  if (!sweep && dth > 0) {
    dth -= 2 * Math.PI;
  } else if (sweep && dth < 0) {
    dth += 2 * Math.PI;
  }
  const n = Math.max(1, Math.ceil(Math.abs(dth) / (Math.PI / 2) - 1e-6));
  const step = dth / n;
  const t = (4 / 3) * Math.tan(step / 4);
  const out: [number, number, number, number, number, number][] = [];
  const point = (a: number): [number, number] => [
    cx + rx * Math.cos(a) * cp - ry * Math.sin(a) * sp,
    cy + rx * Math.cos(a) * sp + ry * Math.sin(a) * cp,
  ];
  const deriv = (a: number): [number, number] => [
    -rx * Math.sin(a) * cp - ry * Math.cos(a) * sp,
    -rx * Math.sin(a) * sp + ry * Math.cos(a) * cp,
  ];
  for (let k = 0; k < n; k++) {
    const a0 = th1 + k * step;
    const a1 = a0 + step;
    const p0 = point(a0);
    const p1 = point(a1);
    const d0 = deriv(a0);
    const d1 = deriv(a1);
    out.push([
      p0[0] + t * d0[0],
      p0[1] + t * d0[1],
      p1[0] - t * d1[0],
      p1[1] - t * d1[1],
      k === n - 1 ? x2 : p1[0],
      k === n - 1 ? y2 : p1[1],
    ]);
  }
  return out;
};

const tokens = (d: string) =>
  d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];

export const parsePath = (d: string): SubPath[] => {
  const t = tokens(d);
  const out: SubPath[] = [];
  let cur = null as SubPath | null;
  let i = 0;
  let cmd = "";
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  // the last control point, for smooth continuations
  let lc: [number, number] | null = null;
  const num = () => Number(t[i++]);
  const last = () => cur!.anchors[cur!.anchors.length - 1];
  const start = (px: number, py: number) => {
    cur = { anchors: [{ x: px, y: py, in: null, out: null }], closed: false };
    out.push(cur);
    sx = px;
    sy = py;
  };
  const line = (px: number, py: number) => {
    cur!.anchors.push({ x: px, y: py, in: null, out: null });
    x = px;
    y = py;
    lc = null;
  };
  const cubic = (
    c1x: number,
    c1y: number,
    c2x: number,
    c2y: number,
    px: number,
    py: number,
  ) => {
    const from = last();
    from.out = [c1x - from.x, c1y - from.y];
    cur!.anchors.push({ x: px, y: py, in: [c2x - px, c2y - py], out: null });
    x = px;
    y = py;
    lc = [c2x, c2y];
  };
  while (i < t.length) {
    if (/[a-zA-Z]/.test(t[i])) {
      cmd = t[i++];
    }
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    switch (cmd.toUpperCase()) {
      case "M": {
        const px = num() + ox;
        const py = num() + oy;
        start(px, py);
        x = px;
        y = py;
        lc = null;
        // further pairs are implicit lines
        cmd = rel ? "l" : "L";
        break;
      }
      case "L":
        line(num() + ox, num() + oy);
        break;
      case "H":
        line(num() + ox, y);
        break;
      case "V":
        line(x, num() + oy);
        break;
      case "C": {
        const a = num() + ox;
        const b = num() + oy;
        const c = num() + ox;
        const e = num() + oy;
        cubic(a, b, c, e, num() + ox, num() + oy);
        break;
      }
      case "S": {
        const c2x = num() + ox;
        const c2y = num() + oy;
        const c1: [number, number] = lc
          ? [2 * x - lc[0], 2 * y - lc[1]]
          : [x, y];
        cubic(c1[0], c1[1], c2x, c2y, num() + ox, num() + oy);
        break;
      }
      case "Q": {
        const qx = num() + ox;
        const qy = num() + oy;
        const px = num() + ox;
        const py = num() + oy;
        cubic(
          x + (2 / 3) * (qx - x),
          y + (2 / 3) * (qy - y),
          px + (2 / 3) * (qx - px),
          py + (2 / 3) * (qy - py),
          px,
          py,
        );
        break;
      }
      case "Z": {
        if (cur) {
          const first = cur.anchors[0];
          const tail = last();
          // a final point on the start is the same anchor
          if (
            cur.anchors.length > 1 &&
            Math.abs(tail.x - first.x) < 1e-6 &&
            Math.abs(tail.y - first.y) < 1e-6
          ) {
            first.in = tail.in;
            cur.anchors.pop();
          }
          cur.closed = true;
          x = sx;
          y = sy;
        }
        lc = null;
        break;
      }
      case "A": {
        const rx = num();
        const ry = num();
        const rot = num();
        const large = num();
        const sweep = num();
        const px = num() + ox;
        const py = num() + oy;
        const segs = arcToCubics(
          x,
          y,
          rx,
          ry,
          rot,
          large !== 0,
          sweep !== 0,
          px,
          py,
        );
        for (const seg of segs) {
          cubic(seg[0], seg[1], seg[2], seg[3], seg[4], seg[5]);
        }
        if (!segs.length) {
          line(px, py);
        }
        x = px;
        y = py;
        break;
      }
      default:
        throw new Error(`unsupported path command ${cmd}`);
    }
  }
  return out;
};

const K = 0.5522847498;

/** path data for shapes the icons are drawn from */
export const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}C${cx - r} ${cy - r * K} ${cx - r * K} ${cy - r} ${cx} ${
    cy - r
  }C${cx + r * K} ${cy - r} ${cx + r} ${cy - r * K} ${cx + r} ${cy}C${cx + r} ${
    cy + r * K
  } ${cx + r * K} ${cy + r} ${cx} ${cy + r}C${cx - r * K} ${cy + r} ${cx - r} ${
    cy + r * K
  } ${cx - r} ${cy}Z`;

export const rrect = (x: number, y: number, w: number, h: number, r = 0) => {
  const k = Math.min(r, w / 2, h / 2);
  if (!k) {
    return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
  }
  const c = k * (1 - K);
  return (
    `M${x + k} ${y}H${x + w - k}C${x + w - c} ${y} ${x + w} ${y + c} ${x + w} ${
      y + k
    }V${y + h - k}C${x + w} ${y + h - c} ${x + w - c} ${y + h} ${x + w - k} ${
      y + h
    }H${x + k}C${x + c} ${y + h} ${x} ${y + h - c} ${x} ${y + h - k}V${y + k}` +
    `C${x} ${y + c} ${x + c} ${y} ${x + k} ${y}Z`
  );
};

export const ticks = (
  cx: number,
  cy: number,
  r1: number,
  r2: number,
  n: number,
  from = 0,
) => {
  let d = "";
  for (let i = 0; i < n; i++) {
    const a = from + (i * Math.PI * 2) / n;
    const c = Math.cos(a);
    const s = Math.sin(a);
    d += `M${+(cx + c * r1).toFixed(2)} ${+(cy + s * r1).toFixed(2)}L${+(
      cx +
      c * r2
    ).toFixed(2)} ${+(cy + s * r2).toFixed(2)}`;
  }
  return d;
};

export const star = (cx: number, cy: number, R: number, r: number, n = 5) => {
  let d = "";
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const rad = i % 2 ? r : R;
    d += `${i ? "L" : "M"}${+(cx + Math.cos(a) * rad).toFixed(2)} ${+(
      cy +
      Math.sin(a) * rad
    ).toFixed(2)}`;
  }
  return `${d}Z`;
};

/** `n` dots as tiny circles */
export const dot = (cx: number, cy: number, r = 0.9) => circle(cx, cy, r);
