/**
 * A palette of the picture's own colours, for flat artwork: the most common
 * colour first, then repeatedly the colour farthest from those chosen (small
 * features keep their colour instead of melting into the background), refined
 * by a few k-means rounds. Deterministic.
 */
export type Rgba = { r: number; g: number; b: number; a: number };

type Bin = { n: number; r: number; g: number; b: number };

const d2 = (a: Bin, b: Bin) =>
  (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;

export const buildPalette = (
  data: Uint8ClampedArray | number[],
  count: number,
  maxSamples = 80000,
): Rgba[] => {
  const total = data.length / 4;
  const step = Math.max(1, Math.floor(total / maxSamples));
  // a histogram on 4 bits per channel, keeping the true mean of each bin
  const bins = new Map<number, Bin>();
  let seen = 0;
  for (let i = 0; i < total; i += step) {
    const o = i * 4;
    if (data[o + 3] < 16) {
      continue;
    }
    seen++;
    const key =
      ((data[o] >> 4) << 8) | ((data[o + 1] >> 4) << 4) | (data[o + 2] >> 4);
    const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bin.n++;
    bin.r += data[o];
    bin.g += data[o + 1];
    bin.b += data[o + 2];
    bins.set(key, bin);
  }
  if (!seen) {
    return [{ r: 255, g: 255, b: 255, a: 255 }];
  }
  // true colours of the bins; stray colours (noise, anti-aliasing) do not get a vote
  const floor = Math.max(2, seen * 0.0005);
  const colors: Bin[] = [...bins.values()]
    .filter((b) => b.n >= floor)
    .map((b) => ({ n: b.n, r: b.r / b.n, g: b.g / b.n, b: b.b / b.n }));
  const pool = colors.length
    ? colors
    : [...bins.values()].map((b) => ({
        n: b.n,
        r: b.r / b.n,
        g: b.g / b.n,
        b: b.b / b.n,
      }));
  pool.sort((a, b) => b.n - a.n);

  const chosen: Bin[] = [pool[0]];
  const nearest = pool.map((c) => d2(c, pool[0]));
  while (chosen.length < Math.min(count, pool.length)) {
    let best = -1;
    let score = -1;
    pool.forEach((c, i) => {
      // far from what is chosen, a little favouring what is common
      const s = nearest[i] * Math.pow(c.n, 0.25);
      if (s > score) {
        score = s;
        best = i;
      }
    });
    if (best < 0 || nearest[best] < 9) {
      break;
    }
    chosen.push(pool[best]);
    pool.forEach((c, i) => {
      nearest[i] = Math.min(nearest[i], d2(c, pool[best]));
    });
  }

  // k-means rounds over the pool, weighted by how common each colour is
  let centres = chosen.map((c) => ({ ...c }));
  for (let round = 0; round < 4; round++) {
    const acc = centres.map(() => ({ n: 0, r: 0, g: 0, b: 0 }));
    for (const c of pool) {
      let k = 0;
      let best = Infinity;
      centres.forEach((m, i) => {
        const d = d2(c, m);
        if (d < best) {
          best = d;
          k = i;
        }
      });
      acc[k].n += c.n;
      acc[k].r += c.r * c.n;
      acc[k].g += c.g * c.n;
      acc[k].b += c.b * c.n;
    }
    centres = centres.map((m, i) =>
      acc[i].n
        ? {
            n: acc[i].n,
            r: acc[i].r / acc[i].n,
            g: acc[i].g / acc[i].n,
            b: acc[i].b / acc[i].n,
          }
        : m,
    );
  }
  return centres.map((c) => ({
    r: Math.round(c.r),
    g: Math.round(c.g),
    b: Math.round(c.b),
    a: 255,
  }));
};
