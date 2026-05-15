export interface Rng {
  next(): number;
  nextInt(minInclusive: number, maxInclusive: number): number;
}

export function createRng(seed: number | string): Rng {
  let state = typeof seed === 'string' ? hashStringSeed(seed) : normalizeNumericSeed(seed);

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const nextInt = (minInclusive: number, maxInclusive: number): number => {
    if (!Number.isInteger(minInclusive) || !Number.isInteger(maxInclusive)) {
      throw new Error(`nextInt bounds must be integers: got ${minInclusive}, ${maxInclusive}`);
    }
    if (minInclusive > maxInclusive) {
      throw new Error(`nextInt: min (${minInclusive}) must be <= max (${maxInclusive})`);
    }
    const range = maxInclusive - minInclusive + 1;
    return minInclusive + Math.floor(next() * range);
  };

  return { next, nextInt };
}

export function deriveChildSeed(parentSeed: number | string, label: string | number): number {
  const parent = typeof parentSeed === 'string' ? hashStringSeed(parentSeed) : normalizeNumericSeed(parentSeed);
  const child = typeof label === 'string' ? hashStringSeed(label) : normalizeNumericSeed(label);
  return mixSeeds(parent, child);
}

function hashStringSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

function normalizeNumericSeed(seed: number): number {
  if (!Number.isFinite(seed)) {
    throw new Error(`Numeric seed must be finite: got ${seed}`);
  }
  return Math.floor(Math.abs(seed)) >>> 0;
}

function mixSeeds(a: number, b: number): number {
  let h = (a ^ Math.imul(b, 2654435761)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}
