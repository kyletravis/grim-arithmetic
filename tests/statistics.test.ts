import { describe, expect, it } from 'vitest';
import { meanCI, median, proportionCI, proportionCIFromRate } from '../src/engine/statistics';

describe('statistics', () => {
  it('proportionCI clamps to [0,1] and is symmetric', () => {
    const ci = proportionCI(50, 100);
    expect(ci.lower).toBeCloseTo(0.402, 3);
    expect(ci.upper).toBeCloseTo(0.598, 3);
    expect(proportionCI(0, 100)).toEqual({ lower: 0, upper: 0 });
    expect(proportionCI(0, 0)).toEqual({ lower: 0, upper: 0 });
    expect(proportionCIFromRate(0.5, 100)).toEqual(ci);
  });
  it('meanCI and median', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    const ci = meanCI([2, 2, 2, 2]);
    expect(ci).toEqual({ lower: 2, upper: 2 });
  });
});
