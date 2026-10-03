/**
 * A palette of the picture's own colours, for flat artwork: the most common
 * colour first, then repeatedly the colour farthest from those chosen (small
 * features keep their colour instead of melting into the background), refined
 * by a few k-means rounds. Deterministic.
 */
export type Rgba = { r: number; g: number; b: number; a: number };

type Bin = { n: number; r: number; g: number; b: number };

const d2 = (first: Bin, second: Bin) =>
  (first.r - second.r) ** 2 +
  (first.g - second.g) ** 2 +
  (first.b - second.b) ** 2;

const meanOf = (bin: Bin): Bin => ({
  n: bin.n,
  r: bin.r / bin.n,
  g: bin.g / bin.n,
  b: bin.b / bin.n,
});

/** a histogram on 4 bits per channel, keeping the sum of each bin */
const histogram = (data: Uint8ClampedArray | number[], maxSamples: number) => {
  const total = data.length / 4;
  const step = Math.max(1, Math.floor(total / maxSamples));
  const bins = new Map<number, Bin>();
  let seen = 0;
  for (let index = 0; index < total; index += step) {
    const offset = index * 4;
    if (data[offset + 3] < 16) {
      continue;
    }
    seen++;
    const key =
      ((data[offset] >> 4) << 8) |
      ((data[offset + 1] >> 4) << 4) |
      (data[offset + 2] >> 4);
    const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bin.n++;
    bin.r += data[offset];
    bin.g += data[offset + 1];
    bin.b += data[offset + 2];
    bins.set(key, bin);
  }
  return { bins, seen };
};

/** the true colours of the bins, the most common first */
const colorPool = (bins: Map<number, Bin>, seen: number) => {
  // stray colours (noise, anti-aliasing) do not get a vote
  const floor = Math.max(2, seen * 0.0005);
  const colors: Bin[] = [...bins.values()]
    .filter((bin) => bin.n >= floor)
    .map(meanOf);
  const pool = colors.length ? colors : [...bins.values()].map(meanOf);
  pool.sort((first, second) => second.n - first.n);
  return pool;
};

/** the most common colour, then repeatedly the one farthest from those chosen */
const pickFarthest = (pool: Bin[], count: number) => {
  const chosen: Bin[] = [pool[0]];
  const nearest = pool.map((bin) => d2(bin, pool[0]));
  while (chosen.length < Math.min(count, pool.length)) {
    let best = -1;
    let score = -1;
    pool.forEach((bin, index) => {
      // far from what is chosen, a little favouring what is common
      const spread = nearest[index] * Math.pow(bin.n, 0.25);
      if (spread > score) {
        score = spread;
        best = index;
      }
    });
    if (best < 0 || nearest[best] < 9) {
      break;
    }
    chosen.push(pool[best]);
    pool.forEach((bin, index) => {
      nearest[index] = Math.min(nearest[index], d2(bin, pool[best]));
    });
  }
  return chosen;
};

/** k-means rounds over the pool, weighted by how common each colour is */
const refine = (pool: Bin[], chosen: Bin[]) => {
  let centres = chosen.map((centre) => ({ ...centre }));
  for (let round = 0; round < 4; round++) {
    const sums = centres.map(() => ({ n: 0, r: 0, g: 0, b: 0 }));
    for (const bin of pool) {
      let closest = 0;
      let best = Infinity;
      centres.forEach((centre, index) => {
        const distance = d2(bin, centre);
        if (distance < best) {
          best = distance;
          closest = index;
        }
      });
      sums[closest].n += bin.n;
      sums[closest].r += bin.r * bin.n;
      sums[closest].g += bin.g * bin.n;
      sums[closest].b += bin.b * bin.n;
    }
    centres = centres.map((centre, index) =>
      sums[index].n
        ? meanOf({
            n: sums[index].n,
            r: sums[index].r,
            g: sums[index].g,
            b: sums[index].b,
          })
        : centre,
    );
  }
  return centres;
};

export const buildPalette = (
  data: Uint8ClampedArray | number[],
  count: number,
  maxSamples = 80000,
): Rgba[] => {
  const { bins, seen } = histogram(data, maxSamples);
  if (!seen) {
    return [{ r: 255, g: 255, b: 255, a: 255 }];
  }
  const pool = colorPool(bins, seen);
  const centres = refine(pool, pickFarthest(pool, count));
  return centres.map((centre) => ({
    r: Math.round(centre.r),
    g: Math.round(centre.g),
    b: Math.round(centre.b),
    a: 255,
  }));
};
