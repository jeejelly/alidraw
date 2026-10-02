/**
 * Pixel outlines to smooth curves: the outline is simplified (Douglas-Peucker),
 * sharp corners are kept, everything else becomes a cubic Bézier through the
 * points (Catmull-Rom tangents). Pure geometry, no dependencies.
 */
export type Pt = [number, number];

const dist2 = (a: Pt, b: Pt) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

/** distance from p to the segment ab */
const segDist = (p: Pt, a: Pt, b: Pt) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (!len2) {
    return Math.sqrt(dist2(p, a));
  }
  const t = Math.max(
    0,
    Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2),
  );
  return Math.sqrt(dist2(p, [a[0] + t * dx, a[1] + t * dy]));
};

const rdp = (pts: Pt[], eps: number): Pt[] => {
  if (pts.length < 3) {
    return pts;
  }
  const a = pts[0];
  const b = pts[pts.length - 1];
  let worst = 0;
  let at = -1;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = segDist(pts[i], a, b);
    if (d > worst) {
      worst = d;
      at = i;
    }
  }
  if (worst <= eps) {
    return [a, b];
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
  for (let i = 1; i < pts.length; i++) {
    if (
      pts[i][0] < pts[i0][0] ||
      (pts[i][0] === pts[i0][0] && pts[i][1] < pts[i0][1])
    ) {
      i0 = i;
    }
  }
  let i1 = i0;
  let far = -1;
  for (let i = 0; i < pts.length; i++) {
    const d = dist2(pts[i], pts[i0]);
    if (d > far) {
      far = d;
      i1 = i;
    }
  }
  const [lo, hi] = i0 < i1 ? [i0, i1] : [i1, i0];
  const first = pts.slice(lo, hi + 1);
  const second = [...pts.slice(hi), ...pts.slice(0, lo + 1)];
  return [...rdp(first, eps).slice(0, -1), ...rdp(second, eps).slice(0, -1)];
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** a closed outline with its jaggedness averaged out (Gaussian window, sigma in points) */
export const relaxClosed = (pts: Pt[], sigma: number): Pt[] => {
  const n = pts.length;
  if (n < 5 || sigma <= 0.01) {
    return pts;
  }
  const half = Math.min(Math.ceil(sigma * 2.5), Math.floor((n - 1) / 2));
  const weights: number[] = [];
  let total = 0;
  for (let k = -half; k <= half; k++) {
    const w = Math.exp(-(k * k) / (2 * sigma * sigma));
    weights.push(w);
    total += w;
  }
  return pts.map((_p, i) => {
    let x = 0;
    let y = 0;
    for (let k = -half; k <= half; k++) {
      const q = pts[(i + k + n * 4) % n];
      const w = weights[k + half];
      x += q[0] * w;
      y += q[1] * w;
    }
    return [x / total, y / total] as Pt;
  });
};

/** the outline's points about `step` apart, so smoothing works on the shape and not on the tracer's spacing */
export const resample = (pts: Pt[], step: number): Pt[] => {
  const n = pts.length;
  if (n < 3) {
    return pts;
  }
  const out: Pt[] = [];
  let carry = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let t = carry;
    while (t < len) {
      out.push([
        a[0] + ((b[0] - a[0]) * t) / len,
        a[1] + ((b[1] - a[1]) * t) / len,
      ]);
      t += step;
    }
    carry = t - len;
  }
  return out.length >= 3 ? out : pts;
};

/** the turning angle at b, in degrees (0 = straight on) */
const turn = (a: Pt, b: Pt, c: Pt) => {
  const v1 = [b[0] - a[0], b[1] - a[1]];
  const v2 = [c[0] - b[0], c[1] - b[1]];
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
  const n = pts.length;
  if (n < 3) {
    return "";
  }
  const sharp = pts.map(
    (p, i) => turn(pts[(i + n - 1) % n], p, pts[(i + 1) % n]) > corner,
  );
  const at = (i: number) => pts[(i + n) % n];
  let d = `M${r2(pts[0][0])} ${r2(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const j = (i + 1) % n;
    // a handle is a sixth of the chord across the neighbours, nothing at a corner
    const c1: Pt = sharp[i]
      ? p1
      : [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = sharp[j]
      ? p2
      : [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${r2(c1[0])} ${r2(c1[1])} ${r2(c2[0])} ${r2(c2[1])} ${r2(
      p2[0],
    )} ${r2(p2[1])}`;
  }
  return `${d}Z`;
};

/** the anchor points of each subpath of an M/L/Q/Z path (control points of curves are dropped) */
export const subpathPoints = (d: string): Pt[][] => {
  const out: Pt[][] = [];
  let cur: Pt[] = [];
  const tokens = d.match(/[MLQZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
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
  for (const t of tokens) {
    if (/[MLQZ]/i.test(t)) {
      flush();
      cmd = t.toUpperCase();
      if (cmd === "Z") {
        if (cur.length) {
          out.push(cur);
        }
        cur = [];
      }
    } else {
      nums.push(Number(t));
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
