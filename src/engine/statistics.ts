import type { MeanConfidenceInterval, ProportionConfidenceInterval } from './simulation-types';

export const Z95 = 1.959963984540054;

export function proportionCI(successes: number, total: number): ProportionConfidenceInterval {
  if (total === 0) return { lower: 0, upper: 0 };
  const p = successes / total;
  const se = Math.sqrt((p * (1 - p)) / total);
  const margin = Z95 * se;
  return {
    lower: clamp01(p - margin),
    upper: clamp01(p + margin)
  };
}

export function proportionCIFromRate(p: number, total: number): ProportionConfidenceInterval {
  return proportionCI(p * total, total);
}

export function meanCI(values: number[]): MeanConfidenceInterval {
  const n = values.length;
  if (n === 0) return { lower: 0, upper: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  const se = Math.sqrt(variance / n);
  const margin = Z95 * se;
  return {
    lower: mean - margin,
    upper: mean + margin
  };
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
