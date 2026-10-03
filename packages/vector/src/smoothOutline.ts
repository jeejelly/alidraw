/**
 * Pixel outlines to smooth curves: the outline is simplified (Douglas-Peucker),
 * sharp corners are kept, everything else becomes a cubic Bézier through the
 * points (Catmull-Rom tangents). Pure geometry, no dependencies.
 */
export type Pt = [number, number];

const dist2 = (first: Pt, second: Pt) =>
  (first[0] - second[0]) ** 2 + (first[1] - second[1]) ** 2;

/** distance from `point` to the segment `start`-`end` */
const segDist = (point: Pt, start: Pt, end: Pt) => {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const len2 = dx * dx + dy * dy;
  if (!len2) {
    return Math.sqrt(dist2(point, start));
  }
  const ratio = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / len2,
    ),
  );
  return Math.sqrt(
    dist2(point, [start[0] + ratio * dx, start[1] + ratio * dy]),
  );
};

const rdp = (pts: Pt[], eps: number): Pt[] => {
  if (pts.length < 3) {
    return pts;
  }
  const first = pts[0];
  const last = pts[pts.length - 1];
  let worst = 0;
  let at = -1;
  for (let index = 1; index < pts.length - 1; index++) {
    const distance = segDist(pts[index], first, last);
    if (distance > worst) {
      worst = distance;
      at = index;
    }
  }
  if (worst <= eps) {
    return [first, last];
  }
  return [
    ...rdp(pts.slice(0, at + 1), eps).slice(0, -1),
    ...rdp(pts.slice(at), eps),
  ];
};

/** simplifies a closed outline: split at its two farthest points, simplify each half */
export const simplifyClosed = (pts: Pt[], eps: number): Pt[] => {
  if (pts.length < 4) {
    return pts;
  }
  let i0 = 0;
  for (let index = 1; index < pts.length; index++) {
    if (
      pts[index][0] < pts[i0][0] ||
      (pts[index][0] === pts[i0][0] && pts[index][1] < pts[i0][1])
    ) {
      i0 = index;
    }
  }
  let i1 = i0;
  let far = -1;
  for (let index = 0; index < pts.length; index++) {
    const distance = dist2(pts[index], pts[i0]);
    if (distance > far) {
      far = distance;
      i1 = index;
    }
  }
  const [lo, hi] = i0 < i1 ? [i0, i1] : [i1, i0];
  const first = pts.slice(lo, hi + 1);
  const second = [...pts.slice(hi), ...pts.slice(0, lo + 1)];
  return [...rdp(first, eps).slice(0, -1), ...rdp(second, eps).slice(0, -1)];
};

const r2 = (value: number) => Math.round(value * 100) / 100;

/** a closed outline with its jaggedness averaged out (Gaussian window, sigma in points) */
export const relaxClosed = (pts: Pt[], sigma: number): Pt[] => {
  const count = pts.length;
  if (count < 5 || sigma <= 0.01) {
    return pts;
  }
  const half = Math.min(Math.ceil(sigma * 2.5), Math.floor((count - 1) / 2));
  const weights: number[] = [];
  let total = 0;
  for (let offset = -half; offset <= half; offset++) {
    const weight = Math.exp(-(offset * offset) / (2 * sigma * sigma));
    weights.push(weight);
    total += weight;
  }
  return pts.map((_p, index) => {
    let x = 0;
    let y = 0;
    for (let offset = -half; offset <= half; offset++) {
      const neighbour = pts[(index + offset + count * 4) % count];
      const weight = weights[offset + half];
      x += neighbour[0] * weight;
      y += neighbour[1] * weight;
    }
    return [x / total, y / total] as Pt;
  });
};

/** the outline's points about `step` apart, so smoothing works on the shape and not on the tracer's spacing */
export const resample = (pts: Pt[], step: number): Pt[] => {
  const count = pts.length;
  if (count < 3) {
    return pts;
  }
  const out: Pt[] = [];
  let carry = 0;
  for (let index = 0; index < count; index++) {
    const start = pts[index];
    const end = pts[(index + 1) % count];
    const len = Math.hypot(end[0] - start[0], end[1] - start[1]);
    let cursor = carry;
    while (cursor < len) {
      out.push([
        start[0] + ((end[0] - start[0]) * cursor) / len,
        start[1] + ((end[1] - start[1]) * cursor) / len,
      ]);
      cursor += step;
    }
    carry = cursor - len;
  }
  return out.length >= 3 ? out : pts;
};

/** the turning angle at `current`, in degrees (0 = straight on) */
const turn = (previous: Pt, current: Pt, next: Pt) => {
  const v1 = [current[0] - previous[0], current[1] - previous[1]];
  const v2 = [next[0] - current[0], next[1] - current[1]];
  const l1 = Math.hypot(v1[0], v1[1]);
  const l2 = Math.hypot(v2[0], v2[1]);
  if (!l1 || !l2) {
    return 0;
  }
  const cos = (v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
};

/** SVG path data of a closed outline, curved except at corners sharper than `corner` degrees */
export const smoothClosedPath = (
  raw: Pt[],
  /** 0 to 1: how much the outline is relaxed and simplified */
  smoothing: number,
  corner = 75,
): string => {
  // even spacing, a gentle relaxation, then only the points the shape needs
  const even = resample(raw, 0.7);
  const relaxed = relaxClosed(even, 1 + smoothing * 3.5);
  const pts = simplifyClosed(relaxed, 0.2 + smoothing * 0.9);
  const count = pts.length;
  if (count < 3) {
    return "";
  }
  const sharp = pts.map(
    (point, index) =>
      turn(pts[(index + count - 1) % count], point, pts[(index + 1) % count]) >
      corner,
  );
  const at = (index: number) => pts[(index + count) % count];
  let pathData = `M${r2(pts[0][0])} ${r2(pts[0][1])}`;
  for (let index = 0; index < count; index++) {
    const p0 = at(index - 1);
    const p1 = at(index);
    const p2 = at(index + 1);
    const p3 = at(index + 2);
    const nextIndex = (index + 1) % count;
    // a handle is a sixth of the chord across the neighbours, nothing at a corner
    const c1: Pt = sharp[index]
      ? p1
      : [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = sharp[nextIndex]
      ? p2
      : [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    pathData += `C${r2(c1[0])} ${r2(c1[1])} ${r2(c2[0])} ${r2(c2[1])} ${r2(
      p2[0],
    )} ${r2(p2[1])}`;
  }
  return `${pathData}Z`;
};

/** the anchor points of each subpath of an M/L/Q/Z path (control points of curves are dropped) */
export const subpathPoints = (pathData: string): Pt[][] => {
  const out: Pt[][] = [];
  let cur: Pt[] = [];
  const tokens = pathData.match(/[MLQZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  let cmd = "";
  const nums: number[] = [];
  const flush = () => {
    if (cmd === "M" && nums.length >= 2) {
      if (cur.length) {
        out.push(cur);
      }
      cur = [[nums[0], nums[1]]];
    } else if (cmd === "L" && nums.length >= 2) {
      cur.push([nums[0], nums[1]]);
    } else if (cmd === "Q" && nums.length >= 4) {
      cur.push([nums[2], nums[3]]);
    }
    nums.length = 0;
  };
  for (const token of tokens) {
    if (/[MLQZ]/i.test(token)) {
      flush();
      cmd = token.toUpperCase();
      if (cmd === "Z") {
        if (cur.length) {
          out.push(cur);
        }
        cur = [];
      }
    } else {
      nums.push(Number(token));
      const need = cmd === "Q" ? 4 : 2;
      if (nums.length === need) {
        flush();
      }
    }
  }
  if (cur.length) {
    out.push(cur);
  }
  return out;
};
